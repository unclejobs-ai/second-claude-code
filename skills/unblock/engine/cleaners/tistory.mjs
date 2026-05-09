// Tistory body extractor.
// Tistory bodies live inside <div class="tt_article_useless_p_margin"> or
// <div class="article-view"> depending on theme; both are stable selectors.

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function decodeEntities(s) {
  return s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] || m);
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function findFirst(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

export function extractTistoryPost(html) {
  if (!html || typeof html !== "string") return null;
  const src = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  const title = findFirst(src, /property="og:title"\s+content="([^"]+)"/) || findFirst(src, /<title[^>]*>([^<]+)<\/title>/);
  if (!title) return null;
  const published = findFirst(src, /property="article:published_time"\s+content="([^"]+)"/);
  const author = findFirst(src, /property="article:author"\s+content="([^"]+)"/);

  const containerMatch =
    src.match(/<div[^>]*class="(?:tt_article_useless_p_margin|article-view|entry-content|tt-entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<(?:footer|div[^>]*class="(?:another_category|tt_article_inread))/) ||
    src.match(/<div[^>]*class="(?:tt_article_useless_p_margin|article-view|entry-content|tt-entry-content)[^"]*"[^>]*>([\s\S]*)/);
  if (!containerMatch) return null;
  const body = containerMatch[1];

  const blocks = [];
  const tokenRe = /<(p|h[1-6]|blockquote|li)[^>]*>([\s\S]*?)<\/\1>|<img[^>]*?(?:data-src|src)="([^"]+)"/g;
  let prevBlank = true;
  let m;
  while ((m = tokenRe.exec(body)) !== null) {
    const [, tag, inner, imgUrl] = m;
    if (tag) {
      const line = stripTags(inner);
      if (!line) continue;
      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag.slice(1));
        blocks.push("#".repeat(Math.min(level + 1, 6)) + " " + line);
      } else if (tag === "blockquote") {
        blocks.push("> " + line);
      } else if (tag === "li") {
        blocks.push("- " + line);
      } else {
        blocks.push(line);
      }
      prevBlank = false;
    } else if (imgUrl && /tistory\.com|daumcdn\.net/.test(imgUrl)) {
      blocks.push(`![](${imgUrl})`);
      prevBlank = false;
    }
  }

  while (blocks.length && blocks[blocks.length - 1] === "") blocks.pop();
  if (blocks.length < 3) return null;
  const cleanTitle = stripTags(title);
  const cleanAuthor = author ? stripTags(author) : null;
  const cleanPublished = published ? stripTags(published) : null;
  const bodyMd = blocks.join("\n\n");
  const meta = [cleanAuthor, cleanPublished].filter(Boolean).join(" · ");
  const header = `# ${cleanTitle}\n\n${meta ? `*${meta}*\n\n` : ""}`;

  return {
    ok: true,
    title: cleanTitle,
    author: cleanAuthor,
    published: cleanPublished,
    blocks: blocks.length,
    chars: bodyMd.length,
    markdown: header + "---\n\n" + bodyMd + "\n",
  };
}
