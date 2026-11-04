"""Main Page views trend: adds a small chart under the Main Page summary of a day page.

The data is the Main Page's daily views for the 28 days up to the report date. The research task writes them as an extra
paragraph at the end of the Main Page banner in the Doc ("Main Page daily views: 2026-10-06=6123456; 2026-10-07=...");
build.py removes that paragraph from the shown banner (take_series) and passes the numbers to apply(). If a Doc has no such
paragraph, apply() falls back to the Main Page figure stated in each report's banner (every report up to its own date).

The page itself carries the data (data-series on <figure class="mpchart">); assets/page.js draws the chart at the
real width of the screen. The series is the Main Page view count stated in the banner of every report up to and
including the page's own date, read from the day pages that are already in the output folder plus the page being built.

Used by tool/build.py (apply). From the repo root, `python3 tool/mainpage_chart.py` adds or refreshes the chart on
every day page and index.html. Safe to run any number of times."""
import glob, os, re, sys

FIG_RE = re.compile(r'\n?<figure class="mpchart".*?</figure>', re.S)
BANNER_RE = re.compile(r'(<aside class="banner"[^>]*>)(.*?)(</aside>)', re.S)
DAY_RE = re.compile(r'(20\d\d-\d\d-\d\d)\.html$')
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def ordinal(n):
    return '%d%s' % (n, 'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th'))


def label(iso):
    return '%s %s' % (ordinal(int(iso[8:10])), MONTHS[int(iso[5:7]) - 1])


def views_from_banner(html):
    """First number with thousands separators in the banner text (the Main Page's views for the day)."""
    m = BANNER_RE.search(html)
    if not m:
        return None
    text = re.sub(r'<[^>]+>', ' ', m.group(2))
    v = re.search(r'(?<![\d,])(\d{1,3}(?:,\d{3})+)(?![\d,])', text)
    return int(v.group(1).replace(',', '')) if v else None


SERIES_START = re.compile(r'^\s*main page daily views', re.I)
PAIR_RE = re.compile(r'(20\d\d-\d\d-\d\d)\s*[=:]\s*(\d[\d,]*)')


def parse_series(text):
    """'Main Page daily views: 2026-10-06=6123456; ...' -> sorted [(iso, views)], or [] if it does not look right."""
    data = {}
    for d, v in PAIR_RE.findall(text):
        v = int(v.replace(',', ''))
        if v > 0:
            data[d] = v
    return sorted(data.items()) if len(data) >= 7 else []


def take_series(paragraphs):
    """Split banner paragraph elements into (paragraphs to show, series). The series paragraph is not shown."""
    keep, ser = [], []
    for p in paragraphs:
        t = ''.join(p.itertext())
        if SERIES_START.match(t):
            ser = parse_series(t) or ser
        else:
            keep.append(p)
    return keep, ser


def series(out_dir, date_iso, page_html):
    data = {}
    for p in glob.glob(os.path.join(out_dir, '20??-??-??.html')):
        d = DAY_RE.search(p).group(1)
        if d >= date_iso:
            continue
        v = views_from_banner(open(p, encoding='utf-8').read())
        if v:
            data[d] = v
    v = views_from_banner(page_html)
    if v:
        data[date_iso] = v
    return sorted(data.items())


def figure(points):
    if len(points) < 2:
        return ''
    ser = ';'.join('%s:%d' % p for p in points)
    rows = ''.join('<tr><th scope="row">%s</th><td>%s</td></tr>' % (label(d), format(v, ',')) for d, v in points)
    return ('\n<figure class="mpchart" data-series="%s">'
            '<figcaption>Main Page views per day, %s to %s</figcaption>'
            '<div class="mpc-plot" aria-hidden="true"></div>'
            '<table class="sr"><caption>Main Page views per day</caption><tbody>%s</tbody></table>'
            '</figure>') % (ser, label(points[0][0]), label(points[-1][0]), rows)


def apply(page, out_dir, date_iso, explicit=None):
    page = FIG_RE.sub('', page)
    pts = [p for p in (explicit or []) if p[0] <= date_iso]
    fig = figure(pts if len(pts) >= 2 else series(out_dir, date_iso, page))
    if not fig:
        return page
    m = BANNER_RE.search(page)
    if not m:
        return page
    return page[:m.end(2)] + fig + page[m.end(2):]


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    files = sorted(glob.glob(os.path.join(root, '20??-??-??.html')))
    newest = None
    for f in files:
        d = DAY_RE.search(f).group(1)
        h = open(f, encoding='utf-8').read()
        h2 = apply(h, root, d)
        # series() reads the other pages' banners, which are not changed by this script, so one pass is enough
        if h2 != h:
            open(f, 'w', encoding='utf-8').write(h2)
        newest = (d, h2)
    if newest and os.path.exists(os.path.join(root, 'index.html')):
        open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(newest[1])
    print('chart added to', len(files), 'pages; newest', newest[0] if newest else None)
