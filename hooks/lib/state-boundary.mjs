import { lstatSync } from "fs";
import { tmpdir } from "os";
import { dirname, isAbsolute, join, parse, relative, resolve } from "path";

function pathIsWithin(candidate, root) {
  const offset = relative(root, candidate);
  return offset === "" || (!offset.startsWith("..") && !isAbsolute(offset));
}

export function dataDirectoryIsSafe(dataDirectory) {
  const resolvedDataDirectory = resolve(dataDirectory);
  // macOS exposes its temporary tree through lexical aliases such as /var ->
  // /private/var. Treat the host-provided temp root as the trust anchor, then
  // reject every symlink from that anchor down to the plugin data directory.
  const temporaryRoot = resolve(tmpdir());
  const boundary = pathIsWithin(resolvedDataDirectory, temporaryRoot)
    ? temporaryRoot
    : parse(resolvedDataDirectory).root;
  let cursor = resolvedDataDirectory;

  while (true) {
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
    } catch (error) {
      if (error?.code !== "ENOENT") return false;
    }

    if (cursor === boundary) return true;
    const parent = dirname(cursor);
    if (parent === cursor) return true;
    cursor = parent;
  }
}

export function stateDirectoryIsSafe(stateDirectory) {
  try {
    const stat = lstatSync(stateDirectory);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

export function eventLogBoundaryIsSafe(dataDirectory, runId) {
  if (
    typeof runId !== "string"
    || runId.includes("..")
    || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(runId)
  ) {
    return false;
  }
  const eventsDirectory = join(resolve(dataDirectory), "events");
  try {
    const eventsStat = lstatSync(eventsDirectory);
    if (eventsStat.isSymbolicLink() || !eventsStat.isDirectory()) return false;
  } catch (error) {
    return error?.code === "ENOENT";
  }

  try {
    const eventStat = lstatSync(join(eventsDirectory, `pdca-${runId}.jsonl`));
    return eventStat.isFile() && !eventStat.isSymbolicLink();
  } catch (error) {
    return error?.code === "ENOENT";
  }
}
