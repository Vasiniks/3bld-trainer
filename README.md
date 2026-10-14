# 3BLD Trainer

A general 3x3 blindfolded trainer that goes beyond a plain Speffz reference:
Speffz lettering drills, letter-pair word manager + quiz, memo recall sequences,
and a stackmat-style timer with stats. 100% static (HTML/CSS/JS, no build step,
no server) — deployable to Cloudflare Pages or GitHub Pages as-is.

## Run locally

Any static server works, e.g.:

```bash
cd 3bld-trainer
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

**Cloudflare Pages:** dashboard → Pages → Create → Upload assets (drag this folder),
or connect the git repo and set the build output directory to `3bld-trainer/`
(or repo root if this folder becomes its own repo). No build command.

**GitHub Pages:** push this folder's contents to a repo, then
Settings → Pages → Deploy from branch → `main` + `/ (root)`.
The `.nojekyll` file is included so Pages serves everything verbatim.

## Publish to GitHub (from the parent folder)

```bash
! git init 3bld-trainer 2>/dev/null || true
! cd 3bld-trainer && git add -A && git commit -m "3BLD trainer: Speffz, pairs, memo, timer"
! gh repo create 3bld-trainer --public --source=3bld-trainer --push
```

(`!` runs the command in this session so its output lands here.)

## Features

- **Learn** — Speffz grids for all six faces, edges + corners, buffer highlighted.
- **Drill** — sticker→letter, letter→sticker, or mixed; multiple choice or type-in
  with an on-screen A–X pad; skip-buffers option; streak/best tracking.
- **Pairs** — your letter-pair word list with add/delete, JSON import/export,
  self-graded flashcard quiz. Saved pairs appear as hints in Memo.
- **Memo** — random letter sequences (single or paired), timed or manual peek,
  typed recall with per-position diff.
- **Timer** — hold-to-arm spacebar/touch timer, random-move scrambles,
  click a time to cycle OK → +2 → DNF, best/ao5/ao12, manual entry.
- **Settings** — edge/corner buffers, theme, full data export/import/wipe.
- All data persists in `localStorage` (`bld3.trainer.v1`); nothing leaves the browser.

## Speffz tables (checkable)

Edges (piece → face stickers):

| Face | Clockwise from top (as seen facing it) |
|------|----------------------------------------|
| U | UB=A, UR=B, UF=C, UL=D |
| L | UL=E, FL=F, DL=G, BL=H |
| F | UF=I, FR=J, DF=K, FL=L |
| R | UR=M, BR=N, DR=O, FR=P |
| B | UB=Q, BL=R, DB=S, BR=T |
| D | DF=U, DR=V, DB=W, DL=X |

Corners:

| Face | Clockwise from top (as seen facing it) |
|------|----------------------------------------|
| U | UBL=A, UBR=B, UFR=C, UFL=D |
| L | UBL=E, UFL=F, DFL=G, DBL=H |
| F | UFL=I, UFR=J, DFR=K, DFL=L |
| R | UFR=M, UBR=N, DBR=O, DFR=P |
| B | UBR=Q, UBL=R, DBL=S, DBR=T |
| D | DFL=U, DFR=V, DBR=W, DBL=X |

Ways to check: the UB edge carries A (U sticker) and Q (B sticker);
the UFR corner carries C (U), J (F), M (R). Default buffers: DF edges, UFR corners.

## Status / roadmap

- [x] v1: drills, pairs, memo, timer, settings, Pages-ready static build
- [ ] Exact-clone teardown of `speffz-trainer.pages.dev` (network was unavailable
      during the build, so v1 was built from the published Speffz standard instead
      of a file-by-file reverse-engineer — diff against the reference when online)
- [ ] Real-trace memo mode (cube simulator: scramble → true memo sequence)
- [ ] Commutator / execution drills, edge-flip and corner-twist cycles
- [ ] Audio recall mode, day-graph stats

## License

MIT — do what you want, credit appreciated.
