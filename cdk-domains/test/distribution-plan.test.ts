import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DistributionConfig } from '@aws-sdk/client-cloudfront';
import { planDistributionUpdate, type AttachProps } from '../lambda/attach-to-distribution';

const FN = 'arn:aws:cloudfront::111111111111:function/redirect-v1';
const CERT = 'arn:aws:acm:us-east-1:111111111111:certificate/new';

const props: AttachProps = {
  DistributionId: 'E123',
  Aliases: ['www.healthdots.net', 'healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
  CertificateArn: CERT,
  CertificateDomains: ['healthdots.net', '*.healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
  FunctionArn: FN,
  AllowReplaceViewerRequestFunction: 'false',
};

const currentConfig = (overrides: Partial<DistributionConfig> = {}): DistributionConfig =>
  ({
    CallerReference: 'ref',
    Comment: '',
    Enabled: true,
    Origins: { Quantity: 0, Items: [] },
    Aliases: { Quantity: 2, Items: ['*.healthdots.net', 'www.healthdots.net'] },
    ViewerCertificate: {
      ACMCertificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate/old',
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
    },
    DefaultCacheBehavior: {
      TargetOriginId: 's3',
      ViewerProtocolPolicy: 'redirect-to-https',
      FunctionAssociations: { Quantity: 0, Items: [] },
    },
    ...overrides,
  }) as DistributionConfig;

test('first run merges aliases, swaps the certificate and attaches the function', () => {
  const { config, changes } = planDistributionUpdate(currentConfig(), props);

  assert.deepEqual(config.Aliases?.Items, ['*.healthdots.net', 'www.healthdots.net', 'healthdots.net', 'healthdots.ca', '*.healthdots.ca']);
  assert.equal(config.ViewerCertificate?.ACMCertificateArn, CERT);
  assert.equal(config.ViewerCertificate?.MinimumProtocolVersion, 'TLSv1.2_2021');
  assert.deepEqual(config.DefaultCacheBehavior?.FunctionAssociations?.Items, [{ EventType: 'viewer-request', FunctionARN: FN }]);
  assert.equal(changes.length, 5);
});

test('re-running against the updated distribution changes nothing', () => {
  const once = planDistributionUpdate(currentConfig(), props).config;
  const twice = planDistributionUpdate(once, props);

  assert.deepEqual(twice.changes, []);
  assert.deepEqual(twice.config, once);
});

test('replaces the function this stack attached before, on a function update', () => {
  const attached = planDistributionUpdate(currentConfig(), props).config;
  const v2 = 'arn:aws:cloudfront::111111111111:function/redirect-v2';
  const { config } = planDistributionUpdate(attached, { ...props, FunctionArn: v2 }, FN);

  assert.deepEqual(config.DefaultCacheBehavior?.FunctionAssociations?.Items, [{ EventType: 'viewer-request', FunctionARN: v2 }]);
});

test('refuses to replace a viewer-request function it did not attach', () => {
  const foreign = currentConfig({
    DefaultCacheBehavior: {
      TargetOriginId: 's3',
      ViewerProtocolPolicy: 'redirect-to-https',
      FunctionAssociations: { Quantity: 1, Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:other' }] },
    },
  });

  assert.throws(() => planDistributionUpdate(foreign, props), /already has viewer-request function arn:other/);
  assert.doesNotThrow(() => planDistributionUpdate(foreign, { ...props, AllowReplaceViewerRequestFunction: 'true' }));
});

test('refuses a certificate that does not cover an existing alias', () => {
  const withApi = currentConfig({ Aliases: { Quantity: 1, Items: ['portfolio.example.com'] } });

  assert.throws(() => planDistributionUpdate(withApi, props), /does not cover existing alias\(es\) portfolio.example.com/);
});
