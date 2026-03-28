import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUTS = {
  review: 120_000,
  gate: 60_000,
  embrace: 600_000,
};

export class TimeoutError extends Error {
  constructor(message = "mmbridge request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFlagName(key) {
  return `--${String(key).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

function buildCliArgs(options = {}) {
  const args = [];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === false) continue;

    const flag = toFlagName(key);
    if (value === true) {
      args.push(flag);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === false) continue;
        args.push(flag, String(item));
      }
      continue;
    }

    args.push(flag, String(value));
  }

  return args;
}

function isMissingBinaryError(error) {
  return (
    error?.code === "ENOENT" ||
    /ENOENT/i.test(error?.message || "") ||
    /not found/i.test(error?.message || "")
  );
}

function normalizeReviewResponse(value, fallbackStatus = "ok") {
  if (!isPlainObject(value)) {
    return {
      status: fallbackStatus,
      findings: [],
      summary: "",
      score: null,
    };
  }

  return {
    status: typeof value.status === "string" ? value.status : fallbackStatus,
    findings: Array.isArray(value.findings) ? value.findings : [],
    summary: typeof value.summary === "string" ? value.summary : "",
    score: typeof value.score === "number" ? value.score : null,
  };
}

function normalizeGateResponse(value, fallbackStatus = "warn", fallbackWarnings = []) {
  const allowed = new Set(["pass", "warn", "fail"]);
  if (!isPlainObject(value)) {
    return {
      status: fallbackStatus,
      warnings: cloneValue(fallbackWarnings),
    };
  }

  const warnings = Array.isArray(value.warnings) ? value.warnings.map(String) : cloneValue(fallbackWarnings);
  return {
    status: allowed.has(value.status) ? value.status : fallbackStatus,
    warnings,
  };
}

function normalizeEmbraceResponse(value) {
  if (!isPlainObject(value)) {
    return {
      overallScore: null,
      recommendations: [],
    };
  }

  return {
    overallScore: typeof value.overallScore === "number" ? value.overallScore : null,
    recommendations: Array.isArray(value.recommendations)
      ? value.recommendations.map(String)
      : [],
  };
}

function toErrorMessage(prefix, error) {
  return `${prefix}: ${error?.message || "unknown mmbridge error"}`;
}

async function defaultRunner(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    encoding: "utf8",
    timeout: options.timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export class MmBridgeAdapter {
  defaultReviewResponse(status = "skipped") {
    return {
      status,
      findings: [],
      summary: "",
      score: null,
    };
  }

  defaultGateResponse(status = "warn", warnings = []) {
    return {
      status,
      warnings: cloneValue(warnings),
    };
  }

  defaultEmbraceResponse() {
    return {
      overallScore: null,
      recommendations: [],
    };
  }

  async review() {
    throw new Error("MmBridgeAdapter.review() must be implemented by a subclass");
  }

  async gate() {
    throw new Error("MmBridgeAdapter.gate() must be implemented by a subclass");
  }

  async embrace() {
    throw new Error("MmBridgeAdapter.embrace() must be implemented by a subclass");
  }
}

export class MmBridgeCliAdapter extends MmBridgeAdapter {
  constructor({
    binary = "mmbridge",
    runner = defaultRunner,
    logger = () => {},
    timeouts = {},
  } = {}) {
    super();
    this.binary = binary;
    this.runner = runner;
    this.logger = logger;
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...timeouts };
  }

  async review(options = {}) {
    return this.#runJsonCommand({
      method: "review",
      options,
      extraArgs: ["--json"],
      onSuccess: (parsed) => normalizeReviewResponse(parsed),
      onFailure: (error) => {
        if (isMissingBinaryError(error)) {
          return this.defaultReviewResponse("skipped");
        }

        this.logger(toErrorMessage("mmbridge review failed", error));
        return this.defaultReviewResponse("skipped");
      },
    });
  }

  async gate(options = {}) {
    return this.#runJsonCommand({
      method: "gate",
      options,
      extraArgs: ["--json"],
      onSuccess: (parsed) => normalizeGateResponse(parsed),
      onFailure: (error) => {
        if (isMissingBinaryError(error)) {
          return this.defaultGateResponse("warn");
        }

        this.logger(toErrorMessage("mmbridge gate failed", error));
        return this.defaultGateResponse("warn", [toErrorMessage("mmbridge gate warning", error)]);
      },
    });
  }

  async embrace(options = {}) {
    return this.#runJsonCommand({
      method: "embrace",
      options,
      extraArgs: ["--json"],
      onSuccess: (parsed) => normalizeEmbraceResponse(parsed),
      onFailure: (error) => {
        if (!isMissingBinaryError(error)) {
          this.logger(toErrorMessage("mmbridge embrace failed", error));
        }

        return this.defaultEmbraceResponse();
      },
    });
  }

  async #runJsonCommand({ method, options, extraArgs, onSuccess, onFailure }) {
    const args = [method, ...buildCliArgs(options), ...extraArgs];

    try {
      const raw = await this.runner(this.binary, args, {
        timeoutMs: this.timeouts[method] ?? DEFAULT_TIMEOUTS[method],
        method,
      });

      try {
        const parsed = JSON.parse(typeof raw === "string" ? raw : String(raw ?? ""));
        return onSuccess(parsed);
      } catch (error) {
        return onFailure(new Error(`Failed to parse mmbridge ${method} JSON: ${error.message}`));
      }
    } catch (error) {
      return onFailure(error);
    }
  }
}

export class MmBridgeStubAdapter extends MmBridgeAdapter {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async review(options = {}) {
    return this.#resolve("review", options, this.defaultReviewResponse("stub"));
  }

  async gate(options = {}) {
    return this.#resolve("gate", options, this.defaultGateResponse("warn"));
  }

  async embrace(options = {}) {
    return this.#resolve("embrace", options, this.defaultEmbraceResponse());
  }

  async #resolve(method, options, fallback) {
    const behavior = this.config[method] ?? {};

    if (behavior.timeout) {
      throw new TimeoutError(behavior.message || `${method} timed out`);
    }

    if (behavior.error) {
      throw behavior.error;
    }

    const response =
      typeof behavior.response === "function" ? await behavior.response(options) : behavior.response;

    if (response === undefined) {
      return cloneValue(fallback);
    }

    if (method === "review") {
      return normalizeReviewResponse(response, "stub");
    }

    if (method === "gate") {
      return normalizeGateResponse(response, "warn");
    }

    return normalizeEmbraceResponse(response);
  }
}

export class MmBridgeRecordingAdapter extends MmBridgeAdapter {
  constructor({
    adapter = null,
    recordingPath,
    mode = "record",
    logger = () => {},
  } = {}) {
    super();
    this.adapter = adapter;
    this.recordingPath = recordingPath;
    this.mode = mode;
    this.logger = logger;
    this._records = null;
    this._offsets = new Map();
  }

  async review(options = {}) {
    return this.#invoke("review", options);
  }

  async gate(options = {}) {
    return this.#invoke("gate", options);
  }

  async embrace(options = {}) {
    return this.#invoke("embrace", options);
  }

  async #invoke(method, options) {
    if (this.mode === "replay") {
      return this.#replay(method);
    }

    if (!this.adapter || typeof this.adapter[method] !== "function") {
      throw new Error(`MmBridgeRecordingAdapter requires an adapter with ${method}()`);
    }

    const result = await this.adapter[method](options);
    this.#record(method, options, result);
    return result;
  }

  #record(method, options, result) {
    if (!this.recordingPath) {
      throw new Error("MmBridgeRecordingAdapter requires a recordingPath");
    }

    mkdirSync(dirname(this.recordingPath), { recursive: true });
    appendFileSync(
      this.recordingPath,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        method,
        options,
        result,
      })}\n`,
      "utf8"
    );
  }

  #loadRecords() {
    if (this._records) return this._records;

    if (!this.recordingPath || !existsSync(this.recordingPath)) {
      throw new Error(`No recorded mmbridge response file found at ${this.recordingPath || "<missing>"}`);
    }

    this._records = readFileSync(this.recordingPath, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    return this._records;
  }

  #replay(method) {
    const records = this.#loadRecords().filter((entry) => entry.method === method);
    const offset = this._offsets.get(method) ?? 0;

    if (offset >= records.length) {
      throw new Error(`No recorded mmbridge response remaining for ${method}`);
    }

    this._offsets.set(method, offset + 1);
    return cloneValue(records[offset].result);
  }
}
