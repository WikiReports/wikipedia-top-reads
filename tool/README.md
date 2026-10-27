# Site tools

- `build.py <report.xml> <YYYY-MM-DD> <site dir>` turns a daily report (Claude Docs XML) into `<date>.html` and `index.html`, adds the footer notice, and merges the date into `assets/days.js`.
- `storylines.py` keeps `data/storylines.json` (one record per article: cause and its history, dated timeline, rank and views on each day charted, sources) and builds `storylines.html`.
  - `python3 tool/storylines.py check <date>.html` flags articles that charted before but are not marked as continuing, and continuing articles with no stored history.
  - `python3 tool/storylines.py update <date>.html` adds that day's records to the data (safe to run twice for the same date).
  - `python3 tool/storylines.py build` rewrites `storylines.html` and adds "See this storyline" links to every daily page.

Articles are matched on the canonical page title from their Wikipedia URL. Redirects or renames go in the `aliases` map in the data file, and linked articles are listed under `groups`. Storyline status is computed from the latest report: Active (charted on it), Cooling (within 14 days), Retired (older).
