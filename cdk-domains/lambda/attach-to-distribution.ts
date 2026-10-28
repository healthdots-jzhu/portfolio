import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  type DistributionConfig,
} from '@aws-sdk/client-cloudfront';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { certificateCovers } from '../lib/config';

/**
 * Custom resource that adds aliases, the certificate and the redirect function to an
 * existing CloudFront distribution that this stack does not own.
 *
 * - Merges: existing aliases are kept, only missing ones are added.
 * - Idempotent: if the distribution already matches, UpdateDistribution is not called.
 * - Delete is a no-op so removing the stack never takes the site down.
 */

export interface AttachProps {
  DistributionId: string;
  Aliases: string[];
  CertificateArn: string;
  CertificateDomains: string[];
  FunctionArn: string;
  /** CloudFormation passes booleans as strings. */
  AllowReplaceViewerRequestFunction: string;
}

const cloudfront = new CloudFrontClient({});

export const handler = async (event: CloudFormationCustomResourceEvent) => {
  const props = event.ResourceProperties as unknown as AttachProps;

  if (event.RequestType === 'Delete') {
    console.log(`Delete: leaving distribution ${props.DistributionId} unchanged`);
    return { PhysicalResourceId: event.PhysicalResourceId };
  }

  const previousFunctionArn =
    event.RequestType === 'Update' ? (event.OldResourceProperties as unknown as AttachProps).FunctionArn : undefined;

  for (let attempt = 1; ; attempt++) {
    const { DistributionConfig: current, ETag } = await cloudfront.send(
      new GetDistributionConfigCommand({ Id: props.DistributionId }),
    );
    if (!current) throw new Error(`Distribution ${props.DistributionId} not found`);

    const { config, changes } = planDistributionUpdate(current, props, previousFunctionArn);
    if (changes.length === 0) {
      console.log('Distribution already up to date; nothing to change');
      return { PhysicalResourceId: props.DistributionId };
    }

    console.log(`Updating distribution ${props.DistributionId}:\n  - ${changes.join('\n  - ')}`);
    try {
      await cloudfront.send(
        new UpdateDistributionCommand({ Id: props.DistributionId, IfMatch: ETag, DistributionConfig: config }),
      );
      return { PhysicalResourceId: props.DistributionId };
    } catch (err) {
      // Someone else changed the distribution between our read and write; re-read and retry.
      if (err instanceof Error && err.name === 'PreconditionFailed' && attempt < 3) continue;
      throw err;
    }
  }
};

/** Pure: returns the desired config and a human-readable list of what differs (empty = no update needed). */
export const planDistributionUpdate = (
  current: DistributionConfig,
  props: AttachProps,
  previousFunctionArn?: string,
): { config: DistributionConfig; changes: string[] } => {
  const config: DistributionConfig = structuredClone(current);
  const changes: string[] = [];

  // ── Aliases: keep existing order, append missing ones ──
  const aliases = [...(config.Aliases?.Items ?? [])];
  for (const alias of props.Aliases) {
    if (!aliases.some((a) => a.toLowerCase() === alias.toLowerCase())) {
      aliases.push(alias);
      changes.push(`add alias ${alias}`);
    }
  }
  config.Aliases = { Quantity: aliases.length, Items: aliases };

  const uncovered = aliases.filter((alias) => !certificateCovers(props.CertificateDomains, alias));
  if (uncovered.length > 0) {
    throw new Error(
      `Certificate ${props.CertificateArn} does not cover existing alias(es) ${uncovered.join(', ')}. ` +
        'Add them to certificateDomains in lib/config.ts.',
    );
  }

  // ── Certificate ──
  const viewerCert = config.ViewerCertificate ?? {};
  if (viewerCert.ACMCertificateArn !== props.CertificateArn) {
    config.ViewerCertificate = {
      ACMCertificateArn: props.CertificateArn,
      CloudFrontDefaultCertificate: false,
      SSLSupportMethod: viewerCert.SSLSupportMethod && !viewerCert.CloudFrontDefaultCertificate ? viewerCert.SSLSupportMethod : 'sni-only',
      MinimumProtocolVersion:
        viewerCert.MinimumProtocolVersion && !viewerCert.CloudFrontDefaultCertificate
          ? viewerCert.MinimumProtocolVersion
          : 'TLSv1.2_2021',
    };
    changes.push(`use certificate ${props.CertificateArn}`);
  }

  // ── Viewer-request function on the default behavior ──
  const behavior = config.DefaultCacheBehavior!;
  const edgeViewerRequest = behavior.LambdaFunctionAssociations?.Items?.find((a) => a.EventType === 'viewer-request');
  if (edgeViewerRequest) {
    throw new Error(
      `Default behavior already has a Lambda@Edge viewer-request function (${edgeViewerRequest.LambdaFunctionARN}); ` +
        'CloudFront cannot run a CloudFront Function on the same event. Remove it or merge the redirect into it.',
    );
  }

  const associations = [...(behavior.FunctionAssociations?.Items ?? [])];
  const existing = associations.find((a) => a.EventType === 'viewer-request');
  if (existing?.FunctionARN !== props.FunctionArn) {
    const ours = existing?.FunctionARN === previousFunctionArn;
    if (existing && !ours && props.AllowReplaceViewerRequestFunction !== 'true') {
      throw new Error(
        `Default behavior already has viewer-request function ${existing.FunctionARN}. ` +
          'Merge the redirect logic into it, or deploy with -c allowReplaceViewerRequestFunction=true to replace it.',
      );
    }
    const others = associations.filter((a) => a.EventType !== 'viewer-request');
    const updated = [...others, { EventType: 'viewer-request' as const, FunctionARN: props.FunctionArn }];
    behavior.FunctionAssociations = { Quantity: updated.length, Items: updated };
    changes.push(`attach viewer-request function ${props.FunctionArn}`);
  }

  return { config, changes };
};
