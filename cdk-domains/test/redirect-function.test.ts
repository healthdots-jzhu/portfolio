import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderRedirectFunction } from '../lib/redirect-function';

const handler = new Function(
  `${renderRedirectFunction({
    canonicalHost: 'www.healthdots.net',
    redirectHosts: ['healthdots.net', 'healthdots.ca', '*.healthdots.ca'],
    redirectStatusCode: 301,
  })}; return handler;`,
)();

const request = (host: string, uri = '/', querystring: Record<string, unknown> = {}) => ({
  request: { uri, querystring, headers: host ? { host: { value: host } } : {} },
});

const location = (result: { headers?: { location?: { value: string } } }) => result.headers?.location?.value;

test('redirects apex and .ca hosts, keeping path and query string', () => {
  assert.equal(location(handler(request('healthdots.net', '/about'))), 'https://www.healthdots.net/about');
  assert.equal(location(handler(request('HealthDots.CA'))), 'https://www.healthdots.net/');
  assert.equal(
    location(handler(request('www.healthdots.ca', '/p/x', { a: { value: '1' }, b: { value: '', multiValue: [{ value: '2' }, { value: '3' }] } }))),
    'https://www.healthdots.net/p/x?a=1&b=2&b=3',
  );
  assert.equal(handler(request('healthdots.ca')).statusCode, 301);
});

test('passes through the canonical host and every other subdomain', () => {
  for (const host of ['www.healthdots.net', 'karen.healthdots.net', 'api.healthdots.net', 'a.b.healthdots.ca', 'evilhealthdots.ca', '']) {
    const event = request(host);
    assert.equal(handler(event), event.request, host);
  }
});
