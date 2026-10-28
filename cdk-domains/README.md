# HealthDots domains (CDK)

Manages the certificate, apex/`.ca` redirects and DNS for the portfolio frontend's existing CloudFront distribution:

- `healthdots.net`, `healthdots.ca`, `*.healthdots.ca` → redirect to `https://www.healthdots.net` (path and query string kept)
- `www.healthdots.net` and every other `*.healthdots.net` subdomain → served as today

Everything is configured in [lib/config.ts](lib/config.ts).

## What it creates

| Piece | How | On re-run | On `cdk destroy` |
|---|---|---|---|
| ACM certificate (us-east-1) for `certificateDomains` | Created with DNS validation in both zones, **or** an issued certificate that already lists every name is reused | No change | Kept |
| CloudFront Function (viewer request) | Generated from config by [lib/redirect-function.ts](lib/redirect-function.ts) | No change unless config changes | Kept |
| Distribution aliases, certificate, function | Custom resource merges them into the existing distribution ([lambda/attach-to-distribution.ts](lambda/attach-to-distribution.ts)); existing aliases are never removed | Skips the update if already applied | Distribution left as is |
| Route 53 records for redirect hosts | `UPSERT`: A/AAAA alias at an apex, CNAME otherwise (or A alias if one is already there) | No change | Kept |

The distribution itself stays outside this stack; the frontend deploy workflow keeps using it as before.

## Re-runnable by design

Before building the stack, [lib/discover.ts](lib/discover.ts) reads AWS (read-only):

- **Certificate:** if this stack already created one, it stays managed (no change). Otherwise an `ISSUED` certificate in us-east-1 whose names include every entry in `certificateDomains` is reused. Only if neither exists is a new one requested.
- **DNS:** records are upserted, so an existing `healthdots.net` apex record is overwritten instead of failing with "already exists".
- **Distribution:** the update is computed against the live config; if nothing differs, `UpdateDistribution` is not called.

Running `npm run deploy` twice in a row makes no changes the second time.

## Safety checks (deploy fails instead of breaking the site)

- The certificate must cover every alias already on the distribution.
- An existing viewer-request function that this stack didn't attach is not replaced unless you pass `-c allowReplaceViewerRequestFunction=true`.
- A Lambda@Edge viewer-request function blocks the deploy (CloudFront can't run both on the same event).
- Config is validated: every host must be covered by the certificate, owned by a listed hosted zone, and the redirect hosts must not match the canonical host.

## Usage

Prerequisites: AWS credentials for the account (CDK reads them like the AWS CLI does) and a one-time bootstrap of us-east-1:

```bash
cd cdk-domains
npm install
npx cdk bootstrap aws://<account-id>/us-east-1
```

Then:

```bash
export CLOUDFRONT_DISTRIBUTION_ID=E...        # PowerShell: $env:CLOUDFRONT_DISTRIBUTION_ID = 'E...'
npm run diff      # preview
npm run deploy    # apply
```

A new certificate takes 5–30 minutes to validate; the deploy waits for it.

`redirectStatusCode` starts at `302`. Once the redirects check out, set it to `301` and deploy again:

```bash
curl -sI https://healthdots.net/about?x=1
curl -sI https://healthdots.ca
curl -sI https://www.healthdots.ca
```

## Development

```bash
npm run build   # type-check
npm test        # unit tests, no AWS access needed
```
