import { existsSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { runProcess } from "./util.mjs";

const CACHE_DIR = process.env.UNBLOCK_CACHE_DIR || join(homedir(), ".cache", "unblock");
const RESOLVED = new Map();

async function which(bin) {
  const r = await runProcess("which", [bin], { timeoutMs: 4000 });
  return r.code === 0 ? r.stdout.trim() : null;
}

async function commandWorks(cmd, args = ["--version"]) {
  const r = await runProcess(cmd, args, { timeoutMs: 8000 });
  return r.code === 0;
}

async function ensureYtDlp() {
  if (RESOLVED.has("yt-dlp")) return RESOLVED.get("yt-dlp");
  let path = await which("yt-dlp");
  if (path) { RESOLVED.set("yt-dlp", path); return path; }
  const pip = (await which("pipx")) || (await which("pip3")) || (await which("pip"));
  if (pip) {
    const args = pip.endsWith("pipx") ? ["install", "yt-dlp"] : ["install", "--user", "yt-dlp"];
    await runProcess(pip, args, { timeoutMs: 60000 });
    path = await which("yt-dlp");
  }
  RESOLVED.set("yt-dlp", path);
  return path;
}

const IMPERSONATE_CANDIDATES = [
  "curl_chrome131",
  "curl_chrome124",
  "curl_chrome120",
  "curl_safari17_0",
  "curl_safari16_0",
  "curl_firefox133",
  "curl_firefox117",
  "curl_edge99",
  "curl-impersonate-chrome",
];

async function ensureCurlImpersonate() {
  if (RESOLVED.has("curl-impersonate")) return RESOLVED.get("curl-impersonate");
  const found = [];
  for (const cmd of IMPERSONATE_CANDIDATES) {
    const path = await which(cmd);
    if (path) found.push({ binary: cmd, path });
  }
  if (found.length) {
    RESOLVED.set("curl-impersonate", { primary: found[0], all: found });
    return RESOLVED.get("curl-impersonate");
  }
  if (platform() === "darwin") {
    const brew = await which("brew");
    if (brew) {
      await runProcess(brew, ["install", "curl-impersonate"], { timeoutMs: 180000 });
      for (const cmd of IMPERSONATE_CANDIDATES) {
        const path = await which(cmd);
        if (path) found.push({ binary: cmd, path });
      }
      if (found.length) {
        RESOLVED.set("curl-impersonate", { primary: found[0], all: found });
        return RESOLVED.get("curl-impersonate");
      }
    }
  }
  RESOLVED.set("curl-impersonate", null);
  return null;
}

async function ensureLightpanda() {
  if (RESOLVED.has("lightpanda")) return RESOLVED.get("lightpanda");
  const path = await which("lightpanda");
  if (path && (await commandWorks("lightpanda", ["--version"]))) {
    RESOLVED.set("lightpanda", path);
    return path;
  }
  if (await which("npx")) {
    const r = await runProcess("npx", ["--yes", "lightpanda-cli", "--version"], { timeoutMs: 60000 });
    if (r.code === 0) {
      RESOLVED.set("lightpanda", "npx-lightpanda");
      return "npx-lightpanda";
    }
  }
  RESOLVED.set("lightpanda", null);
  return null;
}

async function ensurePlaywright() {
  if (RESOLVED.has("playwright")) return RESOLVED.get("playwright");
  if (!(await which("npx"))) { RESOLVED.set("playwright", null); return null; }
  const probe = await runProcess("npx", ["--yes", "playwright", "--version"], { timeoutMs: 90000 });
  if (probe.code === 0) {
    RESOLVED.set("playwright", "npx-playwright");
    return "npx-playwright";
  }
  RESOLVED.set("playwright", null);
  return null;
}

export async function ensureBinary(name) {
  switch (name) {
    case "yt-dlp": return ensureYtDlp();
    case "curl-impersonate": return ensureCurlImpersonate();
    case "lightpanda": return ensureLightpanda();
    case "playwright": return ensurePlaywright();
    default: throw new Error(`unknown binary ${name}`);
  }
}

export function cacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}
