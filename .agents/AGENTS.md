# Project Workflow Rules

## Branching and Pull Requests
- **Never work directly on the `main` branch.**
- Before starting any new work, ask the user for the branch name to checkout to.
- Once finished working, commit the changes and push the branch.
- Remind the user to raise a PR to the `main` branch, or use GitHub tools to raise the PR yourself if available.
- Ask the user for the PR title prefix to be added to the commits/PR.

## Terminal Commands
- No permission is needed to run terminal commands impacting this project while performing a task. When executing project-related shell commands, run them proactively without asking for the user's explicit permission.

## Documentation
- Whenever the AI parsing mechanism (e.g., in `documentController.js`) is modified, you MUST automatically update `docs/ai_parsing_explained_simple.md` to accurately reflect the changes.
