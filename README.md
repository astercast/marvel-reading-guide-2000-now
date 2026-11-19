# Marvel Reading Guide 2000–Now

A comprehensive, curated fast track through Marvel Comics from 2000 to now —
the important and great stories, in backbone reading order, with every entry
linking straight to the comic on
[marvelcomicsapp.com](https://www.marvelcomicsapp.com).

**Status: LOCAL ONLY — not deployed yet.** Deployment (creating the GitHub
repo + enabling GitHub Pages) happens in one move when the guide data is
complete and the owner says go.

## How it will be hosted

- Public GitHub repo (planned name: `marvel-reading-guide-2000-now`, owner `astercast`)
- GitHub Pages served from the `main` branch, root folder — this is a fully
  static site (`index.html` + `data/guide.json`), no build step, `.nojekyll` included.
- Planned URLs once deployed:
  - Repo: `https://github.com/astercast/marvel-reading-guide-2000-now`
  - Site: `https://astercast.github.io/marvel-reading-guide-2000-now/`

## Using the guide

Open the site, read top to bottom — the default view is the full order.
Filters (era, tier, event, character/team, link status, search) narrow it
without changing the order. Tiers:

- **Must-Read** — the spine
- **Expert Depth** — major arcs and context
- **Completionist** — everything else worth tracking

Click **▶ Start reading** on any collection to open its first issue on
marvelcomicsapp.com, expand it for per-issue links, and tick the checkbox
when done — progress is saved in your browser only (localStorage).

**Two layers:** the numbered main list is **Earth-616 continuity only**.
Alternate universes (Ultimate 1610, Ultimate 6160, …) are **side tracks**:
they appear as callouts at the main-order point where they branch off, with
their own reading window, a note on whether/where they cross back into 616
(e.g. Miles Morales → Secret Wars 2015), and their own ordered,
link-verified lists. They never interrupt the main numbering.

Each era section states what was **skipped and why**, so the curation is
transparent.

## Data & link verification

All data lives in `data/guide.json` (format documented in the project’s
`DATA_FORMAT.md`). Every `seriesId` / `issueId` was resolved and verified
against the marvelcomicsapp.com API (`/api/v1`): no ID is typed by hand.
Each collection carries a `status`:

- `verified` / `verified_mu` / `verified_series` — link checked, title + issue number match
- `partial` — some requested issues are not listed on the app (named in the entry’s note)
- `mismatch` / `unresolved` / `not_on_app` — flagged honestly, never disguised

## Updating

1. Resolve new/changed collections with `../resolver.py` (incremental, resumable).
2. Merge into the site data with `../merge_to_repo.py`.
3. Commit + push — Pages redeploys automatically.
