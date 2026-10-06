# Arthur Mota's personal site

Live at https://macroconvexity.github.io/arthurmota/, built by Jekyll from `main`. This repository is public, and so is
this file: write here only what a stranger may read.

## What is here

Pages and results. Each lab page (`/risk/`, `/yields/`, `/curve/`, `/fx/`, `/quant/`, `/rstar/`, `/spx/`,
`/inflation/`) is an `index.html`, one script and a `data/` folder of results. The models that produce the results,
their inputs and the paper sources live in Arthur's private models repository, and work on any of them belongs in a
session opened there. The `data/` folders are written by jobs in that repository every day: read them, never edit them.

## The disclosure rule

The site shows results and how to read them. It does not show how they are produced. A page says what each number
is, states its limits in terms of the outcome, and carries the line "The methodology, inputs and code behind this page
are not published." Sources, formulas of construction, parameters, sample choices, estimation steps, rule definitions
and code stay out of the HTML, the scripts, the data files and this repository. A request to explain a method on a
page is answered with what the number means.

A script only displays what `data/` holds. Anything that has to be computed is computed upstream and arrives as a
number.

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
