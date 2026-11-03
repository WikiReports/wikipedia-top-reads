# Site tools

- `build.py <report.xml> <YYYY-MM-DD> <site dir>` turns a daily report (Claude Docs XML) into `<date>.html` and `index.html`, adds the footer notice, and merges the date into `assets/days.js`.
- `assemble.py <out.xml> <page1> [<continuation> ...]` stitches a capped Claude Docs read (a 42-article Doc is about 380,000 characters and one read returns about 250,000) into one complete XML file. Pass the saved first read, then each saved follow-up read. It prints the follow-up reads still needed (`STILL NEEDED: read payload {...}`) and exits 3 until nothing is missing and no pending block remains; exit 0 means `<out.xml>` is complete and can go to `build.py`. `build.py` refuses an incomplete file.
- `storylines.py` keeps `data/storylines.json` (one record per article: cause and its history, dated timeline, rank and views on each day charted, sources) and builds `storylines.html`.
  - `python3 tool/storylines.py check <date>.html` flags articles that charted before but are not marked as continuing, and continuing articles with no stored history.
  - `python3 tool/storylines.py update <date>.html` adds that day's records to the data (safe to run twice for the same date).
  - `python3 tool/storylines.py build` rewrites `storylines.html` and adds "See this storyline" links to every daily page.

Articles are matched on the canonical page title from their Wikipedia URL. Redirects or renames go in the `aliases` map in the data file, and linked articles are listed under `groups`. Storyline status is computed from the latest report: Active (charted on it), Cooling (within 14 days), Retired (older).
