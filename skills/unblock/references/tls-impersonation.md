# TLS Impersonation (Phase 2)

Phase 2 uses `curl-impersonate` (the upstream binary that the Python
`curl_cffi` wraps) to send requests with TLS fingerprints, JA3 hashes, and
HTTP/2 SETTINGS frames matching real browsers. Many WAFs block the default
OpenSSL fingerprint that vanilla `curl` advertises; impersonation alone
defeats those checks.

## Binary discovery

`engine/install.mjs` searches `$PATH` for any of:

- `curl_chrome131`
- `curl_chrome124`
- `curl_safari17_0`
- `curl-impersonate-chrome`

If none found and the host is macOS, the installer attempts
`brew install curl-impersonate` once. On Linux, the user must install the
binary manually (Debian/Ubuntu: `apt install curl-impersonate`; Arch:
`yay -S curl-impersonate`). Failure to install is logged and the chain
moves to Phase 3.

## Cookie warming + referrer chain

Phase 2 does not just send the target request. It runs:

1. **Warm-up GET** to `https://<host>/` with empty referrer and a fresh cookie
   jar. Captures `Set-Cookie` (e.g. `__cf_bm`, `incap_ses_*`).
2. **Target GET** to the original URL with:
   - Cookies from step 1
   - Referrer = locale-matched search engine (Naver for `.kr`, Baidu for `.cn`,
     Google elsewhere — see `transforms.mjs#inferReferrer`)
   - `Accept-Language` matched to TLD

This sequence defeats two common gating patterns:

- **Homepage cookie gate**: site refuses requests that don't carry a cookie
  set during the homepage visit
- **Referrer check**: site only accepts requests with a search-engine referrer

Both are handled without per-site rules.

## Tunables

- `UNBLOCK_TIMEOUT_MS` — caps both the warm-up and the target request
- `UNBLOCK_CACHE_DIR` — cookie jar files written here per call (cleaned up
  on exit)

## When Phase 2 still fails

- JS-rendered content — Phase 2 returns the static HTML body. Escalate to
  Phase 3 (LightPanda) or Phase 4 (Playwright).
- Per-IP blocks (Cloudflare bot challenge surviving fingerprint match) —
  the chain has no proxy support; user must provide one if needed.
- Korean PCC sites (e.g. some news outlets) that require a session token from
  a JS-evaluated POST — escalate to Phase 4.
