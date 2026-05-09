// Brunch (Daum/Kakao) body extractor. Body lives in .wrap_body wrapping
// div.cont with a fixed paragraph structure.

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
function decodeEntities(s) { return s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] || m); }
function stripTags(s) { return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); }
function findFirst(html, re) { const m = html.match(re); return m ? m[1] : null; }

export function extractBrunchPost(html) {
  if (!html || typeof html !== "string") return null;
  const src = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  const title = findFirst(src, /property="og:title"\s+content="([^"]+)"/);
  if (!title) return null;
  const published = findFirst(src, /property="article:published_time"\s+content="([^"]+)"/);
  const author =
    findFirst(src, /class="link_user"[^>]*>([^<]+)</) ||
    findFirst(src, /class="user_info"[^>]*>\s*([^<]+?)\s*</);

  const wrap = src.match(/<div[^>]*class="wrap_body[^"]*"[^>]*>([\s\S]*?)<\/article>/) ||
               src.match(/<div[^>]*class="wrap_body[^"]*"[^>]*>([\s\S]*)/);
  if (!wrap) return null;
  const body = wrap[1];

  const blocks = [];
  const tokenRe = /<(?:h\d|p)[^>]*class="(?:wrap_item|cont|item)[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|p)>|<div[^>]*class="text"[^>]*>([\s\S]*?)<\/div>|<img[^>]*?(?:data-src|src)="([^"]+)"/g;
  let m;
  while ((m = tokenRe.exec(body)) !== null) {
    const [, p1, p2, imgUrl] = m;
    const inner = p1 || p2;
    if (inner) {
      const line = stripTags(inner);
      if (line) blocks.push(line);
    } else if (imgUrl && /img\d?\.daumcdn\.net|kakaocdn\.net/.test(imgUrl)) {
      blocks.push(`![](${imgUrl})`);
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
