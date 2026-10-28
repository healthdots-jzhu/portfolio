import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { loadConfig } from '../lib/config';
import type { Discovery } from '../lib/discover';
import { DomainsStack } from '../lib/domains-stack';

const config = loadConfig((key) => (key === 'distributionId' ? 'E123' : undefined));

const discovery = (certificate: Discovery['certificate']): Discovery => ({
  distribution: {
    id: 'E123',
    arn: 'arn:aws:cloudfront::111111111111:distribution/E123',
    domainName: 'd111111abcdef8.cloudfront.net',
    ipv6Enabled: true,
  },
  hostedZones: { 'healthdots.net': 'ZNET', 'healthdots.ca': 'ZCA' },
  certificate,
  records: [
    { name: 'healthdots.net', zone: 'healthdots.net', kind: 'alias' },
    { name: 'healthdots.ca', zone: 'healthdots.ca', kind: 'alias' },
    { name: '*.healthdots.ca', zone: 'healthdots.ca', kind: 'cname' },
  ],
});

const synth = (certificate: Discovery['certificate']) =>
  Template.fromStack(
    new DomainsStack(new App(), 'Test', {
      env: { account: '111111111111', region: 'us-east-1' },
      config,
      discovery: discovery(certificate),
    }),
  );

test('creates and retains a certificate when none exists', () => {
  const template = synth({ mode: 'managed' });

  template.resourceCountIs('AWS::CertificateManager::Certificate', 1);
  template.hasResource('AWS::CertificateManager::Certificate', {
    DeletionPolicy: 'Retain',
    Properties: {
      DomainName: 'healthdots.net',
      SubjectAlternativeNames: ['*.healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
      DomainValidationOptions: Match.arrayWith([{ DomainName: 'healthdots.ca', HostedZoneId: 'ZCA' }]),
    },
  });
});

test('reuses an existing certificate without creating one', () => {
  const template = synth({ mode: 'existing', arn: 'arn:aws:acm:us-east-1:111111111111:certificate/abc', domains: config.certificateDomains });

  template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
  template.hasResourceProperties('Custom::AttachToDistribution', {
    DistributionId: 'E123',
    CertificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate/abc',
    Aliases: ['www.healthdots.net', 'healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
  });
});

test('redirect function and DNS upserts', () => {
  const template = synth({ mode: 'managed' });

  template.hasResource('AWS::CloudFront::Function', {
    DeletionPolicy: 'Retain',
    Properties: { FunctionConfig: Match.objectLike({ Runtime: 'cloudfront-js-2.0' }), AutoPublish: true },
  });

  const dns = Object.values(template.findResources('Custom::AWS'));
  assert.equal(dns.length, 3);
  const creates = dns.map((r) => JSON.stringify(r.Properties.Create));
  assert.ok(creates.some((c) => c.includes('\\"Type\\":\\"AAAA\\"') && c.includes('healthdots.ca')));
  assert.ok(creates.some((c) => c.includes('\\"Type\\":\\"CNAME\\"') && c.includes('*.healthdots.ca')));
  assert.ok(creates.every((c) => c.includes('UPSERT')));
});
