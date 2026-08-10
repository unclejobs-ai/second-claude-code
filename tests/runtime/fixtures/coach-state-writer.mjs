import { writeState } from "../../../scripts/lib/coach-state.mjs";

// Writer fixture spawned as a separate OS process by coach-state.test.mjs to
// reproduce real concurrent-writer conditions (matching multiple Claude Code
// sessions writing the same project's state). Repeatedly overwrites the same
// state file with a large payload so a torn (non-atomic) write has a wide
// window to be observed by a concurrent reader.
const [, , root, tag, durationMsArg] = process.argv;
const deadline = Date.now() + Number(durationMsArg);
const payload = { tag, blob: tag.repeat(200_000) };

// Time-budgeted, not iteration-budgeted: this guarantees the writer keeps
// overwriting the file for the reader's entire read window, instead of
// racing to finish early and leaving the rest of the read loop to observe
// an already-stable file.
while (Date.now() < deadline) {
  writeState(root, payload);
}
