import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBinary } from "../install.mjs";
import { makeOk, makeFail, makeSkipped } from "../util.mjs";

const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;
const VIDEO_HOSTS_HINTS = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitch\.tv|dailymotion\.com|soundcloud\.com|bilibili\.com|nicovideo\.jp|naver\.com\/.+\/video|kakao\.com\/.+\/v\/|chzzk\.naver\.com|afreecatv\.com)/i;

export async function probeYtDlp(rawUrl, opts = {}) {
  const start = Date.now();
  const phase = "0c";
  const probe = "yt-dlp";
  if (!VIDEO_HOSTS_HINTS.test(rawUrl)) return makeSkipped({ phase, probe, reason: "not_media_host", start });
  const bin = opts.preresolved?.["yt-dlp"] ?? await ensureBinary("yt-dlp");
  if (!bin) return makeSkipped({ phase, probe, reason: "yt-dlp_unavailable", start });

  const subDir = mkdtempSync(join(tmpdir(), "unblock-subs-"));
  try {
    const { meta, subtitlesFile } = await runYtDlpCombined(bin, rawUrl, subDir);
    if (!meta || !meta.title) return makeFail({ phase, probe, reasons: ["no_metadata"], start });
    const subtitles = subtitlesFile ? readSubtitles(subtitlesFile) : "";
    const content = [
      `# ${meta.title}`,
      meta.uploader ? `Uploader: ${meta.uploader}` : null,
      meta.upload_date ? `Date: ${meta.upload_date}` : null,
      meta.duration ? `Duration: ${meta.duration}s` : null,
      "",
      meta.description || "",
      subtitles ? `\n## Transcript\n\n${subtitles}` : "",
    ].filter(Boolean).join("\n");
    return makeOk({
      phase, probe, code: 200,
      content,
      title: meta.title,
      meta: { uploader: meta.uploader, duration: meta.duration, has_subtitles: Boolean(subtitles) },
      start,
    });
  } catch (err) {
    return makeFail({ phase, probe, error: err, start });
  } finally {
    try { rmSync(subDir, { recursive: true, force: true }); } catch {}
  }
}

function runYtDlpCombined(bin, url, subDir) {
  return new Promise((resolve, reject) => {
    const args = [
      "--skip-download",
      "--dump-json",
      "--write-auto-subs",
      "--write-subs",
      "--sub-langs", "en,ko,ja",
      "--sub-format", "vtt",
      "--convert-subs", "srt",
      "--paths", `home:${subDir}`,
      "--print", "after_video:%(subtitles_filepath)s",
      "--ignore-no-formats-error",
      "--no-warnings",
      "--no-call-home",
      url,
    ];
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], timeout: TIMEOUT * 2 });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || `yt-dlp exit ${code}`));
      try {
        const lines = out.trim().split("\n").filter(Boolean);
        let meta = null;
        let subtitlesFile = null;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("{")) {
            try { meta = JSON.parse(trimmed); } catch { /* skip */ }
          } else if (trimmed.endsWith(".srt") || trimmed.endsWith(".vtt")) {
            subtitlesFile = trimmed;
          }
        }
        resolve({ meta, subtitlesFile });
      } catch (e) { reject(e); }
    });
    child.on("error", reject);
  });
}

function readSubtitles(file) {
  try {
    const text = readFileSync(file, "utf8");
    return text
      .replace(/^\d+\n/gm, "")
      .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3} --> .*$/gm, "")
      .replace(/\n{2,}/g, "\n")
      .trim()
      .slice(0, 12000);
  } catch { return ""; }
}
