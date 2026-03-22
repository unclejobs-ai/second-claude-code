# Workflow Gotchas

## Common failure patterns in workflows

### 1. Assuming shared memory between steps
**Symptom**: Step 2 tries to access variables from Step 1
**Fix**: Each step is an independent subagent. Data moves only through files.

### 2. Losing all work on failure
**Symptom**: Step 4 fails and the outputs from Steps 1-3 disappear
**Fix**: Save intermediate outputs after every step and allow `on_fail: skip` where appropriate.

### 3. Unbounded workflows
**Symptom**: A workflow grows past 10 steps and becomes unmanageable
**Fix**: Enforce the 10-step limit and split large workflows into smaller ones.

### 4. Losing state on interruption
**Symptom**: The session ends mid-run and no one knows which step completed
**Fix**: Store `current_step` and `total_steps` in `workflow-active.json` and resume from there.
