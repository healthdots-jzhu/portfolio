import {
  ACMClient,
  DescribeCertificateCommand,
  KeyAlgorithm,
  ListCertificatesCommand,
  type CertificateDetail,
} from '@aws-sdk/client-acm';
import { CloudFormationClient, DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import { CloudFrontClient, GetDistributionCommand } from '@aws-sdk/client-cloudfront';
import { ListHostedZonesByNameCommand, ListResourceRecordSetsCommand, Route53Client } from '@aws-sdk/client-route-53';
import type { DomainsConfig } from './config';
import { zoneFor } from './config';

/** CloudFront only accepts certificates and functions from us-east-1. */
export const REGION = 'us-east-1';

export interface Discovery {
  distribution: { id: string; arn: string; domainName: string; ipv6Enabled: boolean };
  hostedZones: Record<string, string>;
  /**
   * "managed": this stack creates (or already owns) the certificate.
   * "existing": an issued certificate created elsewhere already covers certificateDomains, so it is reused as-is.
   */
  certificate: { mode: 'managed' } | { mode: 'existing'; arn: string; domains: string[] };
  /** How each redirect host is (or will be) pointed at the distribution. */
  records: DnsRecordPlan[];
}

export interface DnsRecordPlan {
  name: string;
  zone: string;
  /** "alias": A (+ AAAA) alias records, required at a zone apex. "cname": a CNAME to the distribution. */
  kind: 'alias' | 'cname';
}

/**
 * Reads the current state of AWS so a re-run reuses what is already there instead of recreating it.
 * Read-only: nothing is changed here.
 */
export const discover = async (config: DomainsConfig): Promise<Discovery> => {
  const cloudfront = new CloudFrontClient({ region: REGION });
  const route53 = new Route53Client({ region: REGION });

  const { Distribution } = await cloudfront.send(new GetDistributionCommand({ Id: config.distributionId }));
  if (!Distribution?.DomainName || !Distribution.ARN) {
    throw new Error(`CloudFront distribution ${config.distributionId} not found`);
  }

  const hostedZones: Record<string, string> = {};
  for (const zone of config.hostedZones) {
    hostedZones[zone] = await findHostedZoneId(route53, zone);
  }

  const records: DnsRecordPlan[] = [];
  for (const name of config.redirectHosts) {
    const zone = zoneFor(config.hostedZones, name)!;
    const isApex = name.toLowerCase() === zone;
    const existingTypes = isApex ? [] : await recordTypesAt(route53, hostedZones[zone], name);
    // Keep an existing A alias rather than fighting it with a CNAME (the two cannot coexist).
    records.push({ name, zone, kind: isApex || existingTypes.includes('A') ? 'alias' : 'cname' });
  }

  return {
    distribution: {
      id: config.distributionId,
      arn: Distribution.ARN,
      domainName: Distribution.DomainName,
      ipv6Enabled: Distribution.DistributionConfig?.IsIPV6Enabled ?? false,
    },
    hostedZones,
    certificate: await chooseCertificate(config),
    records,
  };
};

const findHostedZoneId = async (route53: Route53Client, zone: string): Promise<string> => {
  const { HostedZones = [] } = await route53.send(new ListHostedZonesByNameCommand({ DNSName: zone }));
  const match = HostedZones.find((z) => z.Name === `${zone}.` && !z.Config?.PrivateZone);
  if (!match?.Id) {
    throw new Error(`Public Route 53 hosted zone ${zone} not found in this account`);
  }
  return match.Id.replace('/hostedzone/', '');
};

const recordTypesAt = async (route53: Route53Client, zoneId: string, name: string): Promise<string[]> => {
  const { ResourceRecordSets = [] } = await route53.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId, StartRecordName: name, MaxItems: 10 }),
  );
  const wanted = `${name.toLowerCase()}.`;
  return ResourceRecordSets
    // Route 53 returns "*" escaped as \052
    .filter((r) => r.Name?.replace(/\\052/g, '*').toLowerCase() === wanted)
    .map((r) => r.Type ?? '');
};

const chooseCertificate = async (config: DomainsConfig): Promise<Discovery['certificate']> => {
  // A certificate this stack already created stays under its management (no change on re-run).
  if (await stackOwnsCertificate(config.stackName)) {
    return { mode: 'managed' };
  }

  // Otherwise reuse an issued certificate that already lists every required name.
  const existing = await findCoveringCertificate(config.certificateDomains);
  if (existing?.CertificateArn) {
    return { mode: 'existing', arn: existing.CertificateArn, domains: existing.SubjectAlternativeNames ?? [] };
  }

  return { mode: 'managed' };
};

const stackOwnsCertificate = async (stackName: string): Promise<boolean> => {
  const cfn = new CloudFormationClient({ region: REGION });
  try {
    const { StackResources = [] } = await cfn.send(new DescribeStackResourcesCommand({ StackName: stackName }));
    return StackResources.some(
      (r) => r.ResourceType === 'AWS::CertificateManager::Certificate' && r.ResourceStatus !== 'DELETE_COMPLETE',
    );
  } catch (err) {
    if (err instanceof Error && /does not exist/i.test(err.message)) return false;
    throw err;
  }
};

const findCoveringCertificate = async (domains: string[]): Promise<CertificateDetail | undefined> => {
  const acm = new ACMClient({ region: REGION });
  const wanted = domains.map((d) => d.toLowerCase());
  const candidates: CertificateDetail[] = [];

  let NextToken: string | undefined;
  do {
    const page = await acm.send(
      new ListCertificatesCommand({
        CertificateStatuses: ['ISSUED'],
        // Without this, ListCertificates only returns RSA-2048 certificates.
        Includes: { keyTypes: Object.values(KeyAlgorithm) },
        NextToken,
      }),
    );
    for (const summary of page.CertificateSummaryList ?? []) {
      const { Certificate } = await acm.send(new DescribeCertificateCommand({ CertificateArn: summary.CertificateArn }));
      const names = (Certificate?.SubjectAlternativeNames ?? []).map((n) => n.toLowerCase());
      if (Certificate && wanted.every((d) => names.includes(d))) {
        candidates.push(Certificate);
      }
    }
    NextToken = page.NextToken;
  } while (NextToken);

  // Prefer one already in use, then the one that expires last.
  return candidates.sort(
    (a, b) =>
      (b.InUseBy?.length ?? 0) - (a.InUseBy?.length ?? 0) ||
      (b.NotAfter?.getTime() ?? 0) - (a.NotAfter?.getTime() ?? 0),
  )[0];
};
