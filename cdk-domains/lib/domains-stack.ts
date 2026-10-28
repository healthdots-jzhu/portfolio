import * as path from 'path';
import { CfnOutput, CustomResource, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cr from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import { zoneFor, type DomainsConfig } from './config';
import type { Discovery, DnsRecordPlan } from './discover';
import { renderRedirectFunction } from './redirect-function';

/** Fixed hosted zone ID that Route 53 uses for every CloudFront alias target. */
const CLOUDFRONT_HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2';

export interface DomainsStackProps extends StackProps {
  config: DomainsConfig;
  discovery: Discovery;
}

/**
 * Certificate, redirect function and DNS for the HealthDots domains.
 *
 * Everything here is safe to re-run: CloudFormation skips unchanged resources, the distribution
 * update is a merge that no-ops when already applied, and DNS records are UPSERTs. Deleting the
 * stack leaves the certificate, function, distribution settings and DNS records in place.
 */
export class DomainsStack extends Stack {
  constructor(scope: Construct, id: string, props: DomainsStackProps) {
    super(scope, id, props);
    const { config, discovery } = props;

    const zones = Object.fromEntries(
      Object.entries(discovery.hostedZones).map(([zoneName, hostedZoneId]) => [
        zoneName,
        route53.HostedZone.fromHostedZoneAttributes(this, `Zone-${zoneName}`, { zoneName, hostedZoneId }),
      ]),
    );

    // ── Certificate ──
    let certificateArn: string;
    let certificateDomains: string[];
    if (discovery.certificate.mode === 'existing') {
      certificateArn = discovery.certificate.arn;
      certificateDomains = discovery.certificate.domains;
    } else {
      const [domainName, ...subjectAlternativeNames] = config.certificateDomains;
      const certificate = new acm.Certificate(this, 'SiteCertificate', {
        domainName,
        subjectAlternativeNames,
        validation: acm.CertificateValidation.fromDnsMultiZone(
          Object.fromEntries(config.certificateDomains.map((d) => [d, zones[zoneFor(config.hostedZones, d)!]])),
        ),
      });
      // CloudFront keeps using it even if this stack is deleted, so never delete it with the stack.
      certificate.applyRemovalPolicy(RemovalPolicy.RETAIN);
      certificateArn = certificate.certificateArn;
      certificateDomains = config.certificateDomains;
    }

    // ── Redirect function ──
    const redirectFunction = new cloudfront.Function(this, 'RedirectFunction', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(renderRedirectFunction(config)),
      comment: `Redirect ${config.redirectHosts.join(', ')} to ${config.canonicalHost}`.slice(0, 128),
      autoPublish: true,
    });
    // Still attached to the distribution after a stack delete; CloudFront refuses to delete it then.
    redirectFunction.applyRemovalPolicy(RemovalPolicy.RETAIN);

    // ── Attach aliases, certificate and function to the existing distribution ──
    const attachHandler = new NodejsFunction(this, 'AttachToDistributionHandler', {
      entry: path.join(__dirname, '../lambda/attach-to-distribution.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.minutes(2),
    });
    attachHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:GetDistributionConfig', 'cloudfront:UpdateDistribution'],
        resources: [discovery.distribution.arn],
      }),
    );
    attachHandler.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['acm:DescribeCertificate', 'acm:ListCertificates'], resources: ['*'] }),
    );

    const attach = new CustomResource(this, 'AttachToDistribution', {
      serviceToken: new cr.Provider(this, 'AttachProvider', { onEventHandler: attachHandler }).serviceToken,
      resourceType: 'Custom::AttachToDistribution',
      properties: {
        DistributionId: discovery.distribution.id,
        Aliases: [config.canonicalHost, ...config.redirectHosts],
        CertificateArn: certificateArn,
        CertificateDomains: certificateDomains,
        FunctionArn: redirectFunction.functionArn,
        AllowReplaceViewerRequestFunction: String(config.allowReplaceViewerRequestFunction),
      },
    });

    // ── DNS: point each redirect host at the distribution (after CloudFront accepts the alias) ──
    for (const record of discovery.records) {
      const upsert = this.upsertRecord(record, discovery);
      upsert.node.addDependency(attach);
    }

    new CfnOutput(this, 'CertificateArn', { value: certificateArn });
    new CfnOutput(this, 'CertificateSource', {
      value: discovery.certificate.mode === 'existing' ? 'reused existing certificate' : 'managed by this stack',
    });
    new CfnOutput(this, 'RedirectFunctionArn', { value: redirectFunction.functionArn });
  }

  /**
   * UPSERT rather than a CloudFormation RecordSet: a RecordSet fails if the record already
   * exists (e.g. the healthdots.net apex), while UPSERT creates or overwrites it either way.
   */
  private upsertRecord(record: DnsRecordPlan, discovery: Discovery): cr.AwsCustomResource {
    const zoneId = discovery.hostedZones[record.zone];
    const target = discovery.distribution.domainName;

    const changes =
      record.kind === 'alias'
        ? ['A', ...(discovery.distribution.ipv6Enabled ? ['AAAA'] : [])].map((type) => ({
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: record.name,
              Type: type,
              AliasTarget: { HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID, DNSName: target, EvaluateTargetHealth: false },
            },
          }))
        : [
            {
              Action: 'UPSERT',
              ResourceRecordSet: { Name: record.name, Type: 'CNAME', TTL: 300, ResourceRecords: [{ Value: target }] },
            },
          ];

    const call: cr.AwsSdkCall = {
      service: 'Route53',
      action: 'changeResourceRecordSets',
      parameters: {
        HostedZoneId: zoneId,
        ChangeBatch: { Comment: `Managed by ${this.stackName}`, Changes: changes },
      },
      physicalResourceId: cr.PhysicalResourceId.of(`${zoneId}/${record.name}`),
    };

    // No onDelete: removing the stack leaves DNS as it is.
    return new cr.AwsCustomResource(this, `Dns-${record.name.replace('*', 'wildcard')}`, {
      onCreate: call,
      onUpdate: call,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: [`arn:aws:route53:::hostedzone/${zoneId}`] }),
      installLatestAwsSdk: false,
    });
  }
}
