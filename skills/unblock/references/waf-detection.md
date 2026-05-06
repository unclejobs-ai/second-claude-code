# WAF Detection Reference

`engine/detect.mjs` exposes three detectors used by `validate.mjs` and the
chain orchestrator.

## Body-pattern signatures (`detectChallengeBody`)

Substring matches (case-insensitive, lowercase compared against the first 8 KB
of the body) defined in `engine/profiles.json` under `challenges.patterns`.
Generic vendor-agnostic phrases. Adding a new pattern should not introduce a
brand-specific identifier unless that identifier is itself the WAF vendor's
public signature (e.g. `cf-browser-verification`, `_Incapsula_Resource`).

## Header signatures (`detectChallengeHeaders`)

| Header | Pattern | Vendor / signal |
|--------|---------|-----------------|
| `server` | `cloudflare\|akamai\|imperva\|incapsula\|sucuri\|stackpath` | edge stack |
| `cf-ray` | any value | Cloudflare |
| `x-amz-cf-id` | any value | CloudFront |
| `x-akamai-transformed` | any value | Akamai |
| `x-iinfo` | any value | Imperva/Incapsula |
| `x-sucuri-id` | any value | Sucuri |
| `set-cookie` | `__cf_bm\|__cflb\|incap_ses\|visid_incap\|akm_` | edge cookies |

Hits are returned as `wafSignals: string[]`. They are advisory — they upgrade
"definitely WAF" classification but do not by themselves fail validation.

## Status classification

- `isBlockedStatus(status)` — true for any 4xx/5xx
- `isWafLikelyStatus(status)` — true for 403, 429, 503, and Cloudflare-extended 5xx range (520–526)

## Failure modes the detector cannot catch

These require Phase 4 (Playwright) or Phase 5 (archive) escalation:

- Pages that return 200 + a valid HTML shell but render content via XHR after
  load. Detection only catches *visible* challenge bodies.
- Login walls behind cookies that look like normal site content (LinkedIn-class).
- Geographic blocks that return generic "not available in your region"
  messaging without WAF headers.

For these, `validate.mjs` catches the issue via the body-length / strip-length
check, since the visible page is short.
