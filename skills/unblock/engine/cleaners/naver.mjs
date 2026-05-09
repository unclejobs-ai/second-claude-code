// Naver SmartEditor (m.blog.naver.com) body extractor.
// Walks se-text-paragraph / se-quotation-line / img tags in document order
// and returns clean markdown with no UI chrome.

const ZWSP_RE = /​/g;
const NBSP_RE = / /g;
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function decodeEntities(s) {
  return s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] || m);
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(ZWSP_RE, "").replace(NBSP_RE, " ").replace(/\s+/g, " ").trim();
}

function findFirst(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

export function extractNaverPost(html) {
  if (!html || typeof html !== "string") return null;
  const cleanedSrc = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  const title =
    findFirst(cleanedSrc, /property="og:title"\s+content="([^"]+)"/) ||
    findFirst(cleanedSrc, /<title[^>]*>([^<]+)<\/title>/);
  if (!title) return null;

  const author =
    findFirst(cleanedSrc, /property="naverblog:nickname"\s+content="([^"]+)"/) ||
    findFirst(cleanedSrc, /class="nick[^"]*"[^>]*>\s*<[^>]+>\s*([^<]+?)\s*</);
  const published =
    findFirst(cleanedSrc, /class="se_publishDate[^"]*"[^>]*>([^<]+)</) ||
    findFirst(cleanedSrc, /<p[^>]*class="blog_date[^"]*"[^>]*>([^<]+)<\/p>/) ||
    findFirst(cleanedSrc, /property="article:published_time"\s+content="([^"]+)"/);

  const containerMatch =
    cleanedSrc.match(/class="se-main-container[^"]*"[^>]*>([\s\S]*?)<div[^>]*id="postBottomTitleArea"/) ||
    cleanedSrc.match(/class="se-main-container[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="post_footer/) ||
    cleanedSrc.match(/class="se-main-container[^"]*"[^>]*>([\s\S]*)/);
  if (!containerMatch) return null;
  const body = containerMatch[1];

  const tokenRe = new RegExp(
    String.raw`<p[^>]*class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>` +
      String.raw`|<blockquote[^>]*class="(?:se-quote-line|se-quotation-line)[^"]*"[^>]*>([\s\S]*?)<\/blockquote>` +
      String.raw`|<img[^>]*?(?:data-lazy-src|data-src|src)="([^"]+)"`,
    "g",
  );

  const blocks = [];
  let prevBlank = true;
  let m;
  while ((m = tokenRe.exec(body)) !== null) {
    const [, para, quote, imgUrl] = m;
    if (para !== undefined) {
      const line = stripTags(para);
      if (!line) {
        if (!prevBlank) {
          blocks.push("");
          prevBlank = true;
        }
        continue;
      }
      blocks.push(line);
      prevBlank = false;
    } else if (quote !== undefined) {
      const line = stripTags(quote);
      if (line) {
        blocks.push("> " + line);
        prevBlank = false;
      }
    } else if (imgUrl) {
      if (/mblogthumb|blogthumb|pstatic\.net/.test(imgUrl)) {
        blocks.push(`![](${imgUrl})`);
        prevBlank = false;
      }
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
