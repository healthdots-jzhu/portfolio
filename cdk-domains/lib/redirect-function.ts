import type { DomainsConfig } from './config';

/**
 * Source for the viewer-request CloudFront Function (cloudfront-js-2.0 runtime).
 * Requests for redirectHosts get a redirect to canonicalHost with path and query string kept;
 * every other host (www, api, karen, jason, ...) passes through untouched.
 */
export const renderRedirectFunction = (
  config: Pick<DomainsConfig, 'canonicalHost' | 'redirectHosts' | 'redirectStatusCode'>,
): string => {
  const exact = config.redirectHosts.filter((h) => !h.startsWith('*.')).map((h) => h.toLowerCase());
  const suffixes = config.redirectHosts.filter((h) => h.startsWith('*.')).map((h) => h.slice(1).toLowerCase());
  const statusDescription = config.redirectStatusCode === 301 ? 'Moved Permanently' : 'Found';

  return `var CANONICAL_HOST = ${JSON.stringify(config.canonicalHost.toLowerCase())};
var EXACT_HOSTS = ${JSON.stringify(exact)};
var WILDCARD_SUFFIXES = ${JSON.stringify(suffixes)};

function shouldRedirect(host) {
  if (!host || host === CANONICAL_HOST) return false;
  if (EXACT_HOSTS.indexOf(host) !== -1) return true;
  for (var i = 0; i < WILDCARD_SUFFIXES.length; i++) {
    var suffix = WILDCARD_SUFFIXES[i];
    var label = host.slice(0, host.length - suffix.length);
    if (host.length > suffix.length && host.endsWith(suffix) && label.indexOf('.') === -1) return true;
  }
  return false;
}

function buildQueryString(querystring) {
  var parts = [];
  Object.keys(querystring).forEach(function (key) {
    var param = querystring[key];
    var values = param.multiValue ? param.multiValue : [param];
    values.forEach(function (v) {
      parts.push(v.value ? key + '=' + v.value : key);
    });
  });
  return parts.length ? '?' + parts.join('&') : '';
}

function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value.toLowerCase() : '';

  if (!shouldRedirect(host)) {
    return request;
  }

  return {
    statusCode: ${config.redirectStatusCode},
    statusDescription: ${JSON.stringify(statusDescription)},
    headers: {
      location: { value: 'https://' + CANONICAL_HOST + request.uri + buildQueryString(request.querystring) }
    }
  };
}
`;
};
