# Arthur Mota's personal site

Live at https://macroconvexity.github.io/arthurmota/, built by Jekyll from `main`. This repository is public, and so is
this file: write here only what a stranger may read.

## What is here

Pages and results. Each lab page (`/risk/`, `/yields/`, `/curve/`, `/fx/`, `/quant/`, `/rstar/`, `/spx/`,
`/inflation/`) is an `index.html`, one script and a `data/` folder of results. The models that produce the results,
their inputs and the paper sources live in Arthur's private models repository, and work on any of them belongs in a
session opened there. The `data/` folders are written by jobs in that repository every day: read them, never edit them.

## Page style

Arthur's rule, 2026-10-06: a page is exhibits, tables and tools, with short captions and a short Limits section.

- Show the substance: every estimate by name, the tables behind a result, the interactive tools.
- Leave out the hand-holding: no "How to read this page" section, no paragraphs teaching how to interpret a table,
  no method write-ups.
- Pages do not link to code. The inflation page shows the forecast and its record, never how it is made.
- The S&P 500 page runs its valuation in the browser. Its script mirrors the model in the private repository, so a
  change to one needs the other.

## Publishing

- `main` is the site. Pages rebuilds about a minute after a push; confirm with a cache-busted `curl`, not the browser.
- Data commits land on `main` every day. Run `git pull --rebase -X theirs` before every push. In a conflict under
  `*/data` the remote copy wins.
- A cloud session pushes to a `claude/` branch and opens a pull request. The change is live once Arthur merges it.
- Files for maintenance go in dot-directories, which Jekyll leaves out of the site. A Markdown file at the root is
  published as a page.
- A change to what a page reads from `data/` needs the matching change in the private repository first, or the page
  breaks at the next data commit.

## Writing and design

- One kit: `assets/mono.css` and `assets/plot.js` (`Plot.line`, `Plot.stack`, `Plot.bar`; SVG, monochrome). New
  pages use it.
- Pages are in English, in plain words, punctuated with periods, commas, colons and parentheses.
- Views only: the site gives no trade recommendations. It carries no employer branding and names no bank or broker.
- Personal details (address, phone) stay off the site. Static pages carry no countdowns.
- A number on a page comes from `data/`. One that is missing is shown as not available.
