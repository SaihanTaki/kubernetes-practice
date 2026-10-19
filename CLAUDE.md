# CLAUDE.md

## Working style

- Use the `ponytail` skill for all coding tasks: smallest change that fully solves the task, no over-engineering.
- Use the `antislop` skill (plus `antislop-code` for code comments) to keep AI slop out of code.
- Use the `caveman` skill for replies: terse, answer first, keep every technical fact.
- Delegate independent subtasks to subagents and run them in parallel (e.g. separate chapters, a search while you edit elsewhere). Keep work that depends on a previous step's result in the main thread.
- When the same kind of subtask repeats (e.g. writing a chapter, reviewing content against the simulator), create a custom subagent for it in `.claude/agents/<name>.md` with a focused prompt and only the tools it needs. Reuse existing agents before adding new ones.

## Git commits

- Follow the `git-workflow-and-versioning` skill for branching, atomic commits, PRs, and releases.
- Write commit messages with the `caveman-commit` skill (Conventional Commits, intent only).
- Do NOT add a `Co-Authored-By` trailer or any other attribution line to commit messages.
