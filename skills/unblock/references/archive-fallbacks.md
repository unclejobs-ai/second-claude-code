# Archive Fallbacks (Phase 5)

When Phases 1–4 all fail to return validated content, Phase 5 attempts free
archive mirrors before declaring exhaustion.

## Sources tried (in order)

1. **Wayback Machine** — `https://archive.org/wayback/available?url=...` to
   find the latest snapshot, then fetch the snapshot URL. Fast and broad
   coverage, but snapshots can be weeks/months stale.

2. **archive.today** — `https://archive.ph/newest/<url>`. Often has cached
   renders of single-page apps that Wayback misses, especially for paywalled
   articles. Slower and rate-limited.

3. **AMP cache** — `https://cdn.ampproject.org/c/s/<host>/<path>`. Only works
   for sites that publish AMP variants. Returns a stripped-down but readable
   page.

4. **RSS / Atom discovery** — fetch the site root, parse
   `<link rel="alternate" type="application/rss+xml">` (and `application/atom+xml`),
   pull the feed, find the item whose `link` matches the target URL. Works
   well for blogs and news sites where the article body is published in the
   feed.

5. **OG-tag rescue** — last resort. Re-fetches the target URL with a
   Facebook-scraper UA (`facebookexternalhit/1.1`). Many sites that gate
   human visitors still return `og:title` / `og:description` / `og:image`
   to social bots. Returns a minimal `# {title}\n\n{description}` body
   tagged `partial: true`.

## Result flagging

All Phase 5 results carry `meta.via_archive: true`. OG-rescue results
additionally carry `meta.partial: true`. Downstream consumers (e.g. the
research brief writer) should surface these flags so the user knows the
content is not the live page.

## When Phase 5 helps

- Articles behind dynamic paywalls (publisher article often re-published in
  RSS feed)
- Pages that previously rendered fine but now block (Wayback snapshot
  often still works)
- Pages that show a login wall to humans but return OG metadata to scrapers
- Removed content (Wayback snapshot survives)

## When Phase 5 cannot help

- Time-sensitive data (live prices, scoreboards, social timelines) — archives
  are stale by design
- New URLs published after Wayback's last crawl and not in any feed
- Sites that serve OG tags pointing back to themselves (fine for the title,
  but the description is sometimes also gated)
- Pages where the actionable data is rendered post-load via XHR and is not in
  any feed or archive snapshot
