/**
 * evolve-ledger.mjs — provenance ledger for the evolve skill.
 *
 * Records WHICH prompt asset is structurally weak, derived from real PDCA gate failures.
 * It NEVER stores a model-authored success criterion: `check_assertion` / `check_author`
 * are set only when the maintainer hand-authors a structural check (see setMaintainerCheck).
 *
 * Storage: .data/evolve/failures.jsonl (one JSON record per line). The store is rewritten
 * atomically (tmp + rename) so re-harvest can upsert by dedup_key while preserving any
 * maintainer-authored fields. Mirrors the JSONL convention in hooks/lib/event-log.mjs.
 *
 * Record shape:
 *   { id, ts, source_kind, asset_path, gate_rule, finding_excerpt, dedup_key,
 *     source_runs: string[], recurrence: number, checkable: boolean,
 *     check_assertion: (string|{source,flags})[] | null,
 *     check_author: "maintainer" | null,
 *     status: "open" | "harvested" }
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function evolveDir(dataDir) {
  return join(dataDir, "evolve");
}

export function ledgerPath(dataDir) {
  return join(evolveDir(dataDir), "failures.jsonl");
}

function ensureDir(dataDir) {
  mkdirSync(evolveDir(dataDir), { recursive: true });
}

/**
 * Read all records, optionally filtered.
 * @param {string} dataDir
 * @param {{ asset_path?: string, status?: string, id?: string, min_recurrence?: number }} [filter]
 * @returns {object[]}
 */
export function readRecords(dataDir, filter = {}) {
  const path = ledgerPath(dataDir);
  if (!existsSync(path)) return [];

  const records = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (filter.asset_path && obj.asset_path !== filter.asset_path) continue;
    if (filter.status && obj.status !== filter.status) continue;
    if (filter.id && obj.id !== filter.id) continue;
    if (typeof filter.min_recurrence === "number" && (obj.recurrence ?? 0) < filter.min_recurrence) {
      continue;
    }
    records.push(obj);
  }
  return records;
}

function writeAll(dataDir, records) {
  ensureDir(dataDir);
  const path = ledgerPath(dataDir);
  const tmp = `${path}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  writeFileSync(tmp, records.length ? `${body}\n` : "", "utf8");
  renameSync(tmp, path);
}

/**
 * Insert or refresh a provenance record by dedup_key. Maintainer-authored fields
 * (check_assertion / check_author / harvested status) are preserved across re-harvest.
 * @returns {object} the stored record
 */
export function upsertByDedup(dataDir, record) {
  const all = readRecords(dataDir);
  const index = all.findIndex((entry) => entry.dedup_key === record.dedup_key);

  if (index === -1) {
    all.push(record);
    writeAll(dataDir, all);
    return record;
  }

  const previous = all[index];
  const merged = {
    ...record,
    id: previous.id,
    check_assertion: previous.check_assertion ?? null,
    check_author: previous.check_author ?? null,
    status: previous.check_author ? "harvested" : record.status,
  };
  all[index] = merged;
  writeAll(dataDir, all);
  return merged;
}

/**
 * Attach a maintainer-authored structural check to a record. Enforces that the author is
 * the maintainer — the optimized model class can never set the success criterion here.
 * @param {string} dataDir
 * @param {string} id
 * @param {(string|{source:string,flags?:string})[]} assertions
 * @param {"maintainer"} [author]
 * @param {string|null} [assetPath] - when set, retarget the record to this asset (persisted to disk)
 * @returns {object} the updated record
 */
export function setMaintainerCheck(dataDir, id, assertions, author = "maintainer", assetPath = null) {
  if (author !== "maintainer") {
    throw new Error("evolve-ledger: check_author must be 'maintainer'");
  }
  if (!Array.isArray(assertions) || assertions.length === 0) {
    throw new Error("evolve-ledger: assertions must be a non-empty array");
  }

  const all = readRecords(dataDir);
  const record = all.find((entry) => entry.id === id);
  if (!record) {
    throw new Error(`evolve-ledger: no record with id "${id}"`);
  }

  if (assetPath) {
    record.asset_path = assetPath;
  }
  record.check_assertion = assertions;
  record.check_author = author;
  record.status = "harvested";
  writeAll(dataDir, all);
  return record;
}
