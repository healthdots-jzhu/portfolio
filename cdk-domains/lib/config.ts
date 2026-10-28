/**
 * Everything this stack manages is driven by this file.
 * Edit it and re-run `npm run deploy`; unchanged values cause no changes in AWS.
 */
export interface DomainsConfig {
  /** CloudFormation stack name. Also used to tell "our" certificate apart from one created elsewhere. */
  stackName: string;
  /** Existing CloudFront distribution that serves the portfolio frontend (not owned by this stack). */
  distributionId: string;
  /** Host every redirected request lands on. */
  canonicalHost: string;
  /** Hosts redirected to canonicalHost. A leading "*." matches any single-level subdomain. */
  redirectHosts: string[];
  /** 302 while testing; switch to 301 once verified (browsers cache 301s aggressively). */
  redirectStatusCode: 301 | 302;
  /** Names on the CloudFront certificate. Must cover canonicalHost, redirectHosts and every existing alias. */
  certificateDomains: string[];
  /** Public Route 53 hosted zones that own the names above. */
  hostedZones: string[];
  /**
   * Allow replacing a viewer-request CloudFront Function that this stack did not attach.
   * Leave false unless you know the existing function is no longer needed.
   */
  allowReplaceViewerRequestFunction: boolean;
}

export const loadConfig = (context: (key: string) => unknown): DomainsConfig => {
  const distributionId = String(context('distributionId') ?? process.env.CLOUDFRONT_DISTRIBUTION_ID ?? '').trim();
  if (!distributionId) {
    throw new Error('Set the distribution ID: CLOUDFRONT_DISTRIBUTION_ID=E... npm run deploy  (or -c distributionId=E...)');
  }

  const config: DomainsConfig = {
    stackName: 'HealthdotsDomains',
    distributionId,
    canonicalHost: 'www.healthdots.net',
    redirectHosts: ['healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
    redirectStatusCode: 302,
    certificateDomains: ['healthdots.net', '*.healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
    hostedZones: ['healthdots.net', 'healthdots.ca'],
    allowReplaceViewerRequestFunction: context('allowReplaceViewerRequestFunction') === 'true',
  };

  validateConfig(config);
  return config;
};

/** True when `host` matches `pattern` ("example.com" or "*.example.com"). */
export const hostMatches = (host: string, pattern: string): boolean => {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (!p.startsWith('*.')) return h === p;
  const suffix = p.slice(1);
  return h.endsWith(suffix) && !h.slice(0, -suffix.length).includes('.') && h.length > suffix.length;
};

/** True when a certificate listing `certNames` is valid for `host` (which may itself be a wildcard). */
export const certificateCovers = (certNames: string[], host: string): boolean =>
  certNames.some((name) => name.toLowerCase() === host.toLowerCase() || (!host.startsWith('*.') && hostMatches(host, name)));

/** Hosted zone that owns `host`, e.g. "*.healthdots.ca" -> "healthdots.ca". */
export const zoneFor = (zones: string[], host: string): string | undefined => {
  const bare = host.replace(/^\*\./, '').toLowerCase();
  return zones
    .filter((zone) => bare === zone || bare.endsWith(`.${zone}`))
    .sort((a, b) => b.length - a.length)[0];
};

export const validateConfig = (config: DomainsConfig): void => {
  const problems: string[] = [];
  const hosts = [config.canonicalHost, ...config.redirectHosts];

  for (const host of hosts) {
    if (!certificateCovers(config.certificateDomains, host)) {
      problems.push(`certificateDomains does not cover ${host}`);
    }
  }
  for (const host of [...hosts, ...config.certificateDomains]) {
    if (!zoneFor(config.hostedZones, host)) {
      problems.push(`no hosted zone in hostedZones owns ${host}`);
    }
  }
  if (config.redirectHosts.some((pattern) => hostMatches(config.canonicalHost, pattern))) {
    problems.push(`redirectHosts must not match canonicalHost ${config.canonicalHost} (redirect loop)`);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid domains config:\n  - ${problems.join('\n  - ')}`);
  }
};
