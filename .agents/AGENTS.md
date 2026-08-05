# Project Workflow Rules

## Branching and Pull Requests
- **Never work directly on the `main` branch.**
- **Before the first edit of any request, ask the user which branch to work on.**
  This applies to every request, not only new tasks — continuing a multi-step
  piece of work on the branch that happens to be checked out is exactly how the
  wrong branch gets used. Check whether the current branch already has an open or
  recently merged PR and say so, because that usually changes the answer.
  - **Scope:** this covers anything that changes a file in this repository,
    including documentation and config. It does **not** cover writes outside the
    repository — scratch files, temporary scripts, an agent's own notes — which
    never reach a branch and so need no confirmation.
  - Asking costs one question; committing to the wrong branch costs a rebase, a
    reopened PR, or work stranded on a branch nobody is reviewing. All three
    happened on this project before the rule was tightened.
- Branch names depend on **where the work was tracked**. Pick the scheme that
  matches the tracker the task came from — they are not interchangeable, and the
  prefix is how anyone later finds the ticket the branch belongs to.

  | Work tracked in | Format | Example |
  |---|---|---|
  | **GitHub issue** | **`GH-<issue-no>-<semver>`** | `GH-12-1.5.0` |
  | **Jira ticket** | **`TECHDL-<ticket>-<semver>`** | `TECHDL-23-1.4.0` |

  Only the prefix and the identifier differ — the prefix names the tracker, the
  identifier names the ticket, and both schemes end in the **semver of the
  release the work is intended to land in**.

  - `<issue-no>` is the GitHub issue number, without a `#`.
  - `<semver>` is the target release version, not the current one. Several
    branches may share a version when several features land in the same
    release; that is expected, not a clash.
  - Read the prefix back to the user before creating the branch.
    `TEHCDL-10-1.2.0` reached `main` as a typo and is now permanent in three
    merge commit messages, so the check is worth the one line it costs.
  - Historical branches on this repository all use the `TECHDL-` form, which
    predates the GitHub-issue workflow. Do not rename or rewrite them.
- Once finished working, commit the changes and push the branch.
- Remind the user to raise a PR to the `main` branch, or use GitHub tools to raise the PR yourself if available.
- Ask the user for the PR title prefix to be added to the commits/PR.

## Terminal Commands
- No permission is needed to run terminal commands impacting this project while performing a task. When executing project-related shell commands, run them proactively without asking for the user's explicit permission.

## Documentation
Documentation drift in this repository has been systemic rather than incidental —
findings F-15 through F-22 were all cases of a document confidently describing
something that had stopped being true. Treat these as part of the change, not
follow-up work:

- Whenever the AI parsing mechanism (e.g., in `documentController.js`) is modified, you MUST automatically update `docs/ai_parsing_explained_simple.md` to accurately reflect the changes.
- Whenever a **route** is added, removed or renamed, update the API reference in
  `docs/TECHNICAL_DOCUMENTATION.md` §5 **and** its route count.
- Whenever a **schema** changes (`Question`, `ParsingJob`, `Config`), update the
  schema tables in `docs/TECHNICAL_DOCUMENTATION.md` §4.
- Whenever an **npm script or environment variable** is added or removed, update
  the corresponding table in `docs/TECHNICAL_DOCUMENTATION.md` §7 and §10.C.
- Whenever a **version** is released, it must move together in all three places:
  the git tag, all three `package.json` files, and the `> **Version:**` header in
  every file under `docs/`. The git tag is canonical.
- Documents that describe repository *status* — branch state, findings, what is
  open — should link to `docs/ARCHITECTURE_AND_ROADMAP.md` rather than restate
  it. Restated status went stale twice in a single day.

## PR Checklist
Confirm each of these before raising a PR:

- [ ] Branch name matches the scheme for its tracker, spelled correctly —
      `GH-<issue-no>-<semver>` for GitHub issues,
      `TECHDL-<ticket>-<semver>` for Jira
- [ ] Backend tests pass (`cd backend && npm test`)
- [ ] Frontend typecheck and tests pass (`cd frontend && npx tsc --noEmit && npm test`)
- [ ] Docs updated per the rules above, if routes, schemas, scripts, env vars or the parsing mechanism changed
- [ ] No new hardcoded absolute paths, and no component builds a backend URL outside `lib/api.ts`
- [ ] No build or test artifacts staged
