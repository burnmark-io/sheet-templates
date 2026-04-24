# Blockers

Things that genuinely require human input. Each entry names what's blocked and what's needed to unblock.

## Push to remote is blocked

**What's blocked:** `git push` after each step. The plan says "commit + push" at each gate.

**Why:** `github.com/burnmark-io/sheet-templates` returns 404 (repo not yet created on GitHub), no `origin` remote is configured locally, and `gh` CLI is not installed so I can't create the repo autonomously.

**What I'm doing instead:** committing locally at each gate. When the operator is back, they can:
1. Create the repo (via gh or the web UI) under `burnmark-io`
2. `git remote add origin https://github.com/burnmark-io/sheet-templates.git`
3. `git push -u origin main`
4. `git push --recurse-submodules=check` (or `on-demand`)

All commits will be ready on `main` waiting to push.

