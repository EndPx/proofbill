# ProofBill workflow

Deliver work in small, coherent tasks. After each task is complete and its relevant checks pass, create a commit and push it to `origin/main`; do not wait for the entire feature set to finish.

Use clear English commit messages that identify the concrete feature, fix or documentation change. Each commit should contain the completed task and its directly related checks or evidence.

Before committing, inspect the diff and stage explicit paths. Preserve unrelated user changes and keep credentials, real env files, private payloads and local operational files out of Git.

Use checks appropriate to the task. For documentation-only work, validate the diff and links; for financial, ownership or privacy behavior, run the relevant implementation checks before the commit.
