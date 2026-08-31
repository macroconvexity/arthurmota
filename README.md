# Arthur Mota — Personal Research Site

GitHub Pages source for Arthur Mota's personal research website.

## Site structure

- `_layouts/` — shared site HTML shell and navigation
- `assets/css/` — shared visual system and responsive styling
- `papers/` — working papers, presentations, and downloadable research files
- `posts/` — long-form notes and discussions
- `index.md` — homepage
- `research.md` — research index
- `discussion.md` — notes index
- `dashboard.md` — curated Research Lab index
- `book.md` — books
- `lectures.md` — lecture material
- `cv.md` — professional profile

## Legacy interactive tools

The standalone HTML applications currently remain at repository root so their existing public URLs do not break. New tools should eventually be created under a dedicated `lab/` directory with stable redirects from legacy paths.

## Naming rules

For new files:

- use lowercase kebab-case names
- avoid spaces and parentheses in filenames
- group PDFs under `papers/`
- group long-form writing under `posts/`
- put shared CSS, JS, and images under `assets/`
- do not duplicate navigation or global styles inside individual pages

## Design

The site uses a custom editorial design rather than the default GitHub Pages theme. The visual system is defined centrally in `assets/css/site.css`.
