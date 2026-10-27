#!/usr/bin/env python3
"""Storyline data for the Wikipedia Top Reads site.

Commands (run from the repo root, or pass --root):
  check  <YYYY-MM-DD>.html      continuity check of a freshly built daily page against data/storylines.json
  update <YYYY-MM-DD>.html      append that day's rank, views, timeline entry, cause and sources to the data
  build                         write storylines.html and add storyline links to every daily page

The data file is append-only by date: running update twice for the same date replaces that
date's records and never touches other dates. Articles are matched on the canonical page title
taken from the Wikipedia URL (aliases in the data file cover redirects and renames).
"""
import html, json, os, re, sys, datetime
from urllib.parse import unquote

ROOT = '.'
if '--root' in sys.argv:
    i = sys.argv.index('--root'); ROOT = sys.argv[i + 1]; del sys.argv[i:i + 2]
DATA = os.path.join(ROOT, 'data', 'storylines.json')
E = html.escape


def ordinal(n): return '%d%s' % (n, 'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th'))
def pdate(s): return datetime.date.fromisoformat(s)
def short(s): d = pdate(s); return '%s %s' % (ordinal(d.day), d.strftime('%b'))
def long_(s): d = pdate(s); return '%s %s %s %d' % (d.strftime('%a'), ordinal(d.day), d.strftime('%b'), d.year)
def strip(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()
def canon(url): return unquote(url.split('/wiki/', 1)[-1]).replace(' ', '_')
def slug(c): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', c.lower())).strip('-')


def load():
    if os.path.exists(DATA):
        return json.load(open(DATA, encoding='utf-8'))
    return {'version': 1, 'groups': [], 'aliases': {}, 'storylines': []}


def save(d):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    d['storylines'].sort(key=lambda s: s['id'])
    json.dump(d, open(DATA, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    open(DATA, 'a').write('\n')


def find(d, c):
    c = d['aliases'].get(c, None) or c
    for s in d['storylines']:
        if s['id'] == c or s['canonical'] == c:
            return s
    return None


# ---------------------------------------------------------------- daily page parsing
def parse_daily(path):
    h = open(path, encoding='utf-8').read()
    date = re.search(r'id="daynav" data-day="([\d-]+)"', h).group(1)
    arts = []
    for m in re.finditer(r'<details class="art" id="a(\d+)" data-conf="(\w+)">(.*?)</details>(?=<details class="art"|\s*</section>)', h, re.S):
        idx, conf, b = int(m.group(1)), m.group(2), m.group(3)
        nm = re.search(r'<span class="nm"><a href="([^"]+)">(.*?)</a>', b)
        url = html.unescape(nm.group(1))
        tag = re.search(r'chip tag (\w+)', b).group(1)
        typ = strip(re.search(r'<span class="chip typ">(.*?)</span>', b).group(1))
        why = strip(re.search(r'<span class="why">(.*?)</span></span>', b, re.S).group(1))
        rank = int(re.search(r'<small>Rank</small>(\d+)', b).group(1))
        views = int(re.search(r'<small>Views</small><mark class="key">([\d,]+)', b).group(1).replace(',', ''))
        cause = re.search(r'<p class="causetext">(.*?)</p>', b, re.S)
        story = re.search(r'<section class="blk story">.*?</section>', b, re.S)
        last = None
        if story:
            lis = re.findall(r'<li><span class="when">(.*?)</span><span class="what">(.*?)</span></li>', story.group(0), re.S)
            if lis:
                last = strip(lis[-1][1])
        news = re.search(r'<section class="blk news">.*?</section>', b, re.S)
        links = []
        if news:
            for u, t in re.findall(r'<a href="([^"]+)">(.*?)</a>', news.group(0), re.S):
                links.append({'title': strip(t), 'url': html.unescape(u)})
        arts.append(dict(idx=idx, conf=conf if conf in ('hi', 'md', 'lo') else None, tag=tag, typ=typ, why=why, rank=rank,
                         views=views, url=url, name=strip(nm.group(2)), canonical=canon(url),
                         cause=strip(cause.group(1)) if cause else '', last=last, links=links))
    return date, arts


def merge_sources(s, links, keep=12):
    have = {x['url'] for x in s['sources']}
    for l in links:
        if l['url'] not in have and 'wikipedia.org' not in l['url'] and 'wikimedia.org' not in l['url']:
            s['sources'].append(l); have.add(l['url'])
    s['sources'] = s['sources'][-keep:]


REVISE = re.compile(r'replac|revis|correct|overturn|cause found|now explained|earlier (?:no-trigger|finding)', re.I)


# ---------------------------------------------------------------- commands
def cmd_check(path):
    d = load()
    date, arts = parse_daily(path)
    warn = []
    for a in arts:
        s = find(d, a['canonical'])
        prior = [c for c in s['charted'] if c['date'] < date] if s else []
        if prior and a['tag'] != 'cont':
            warn.append('RETURNING, NOT MARKED CONTINUING: %s (rank %d) charted before on %s' % (a['name'], a['rank'], ', '.join(short(c['date']) for c in prior)))
        if a['tag'] == 'cont' and not prior:
            warn.append('MARKED CONTINUING BUT NOT IN STORYLINE DATA: %s (rank %d)' % (a['name'], a['rank']))
        if s:
            for g in d['groups']:
                if s['id'] in g['members']:
                    others = [m for m in g['members'] if m != s['id']]
                    seen = [o for o in others if any(x['canonical'] == o or x['id'] == o for x in d['storylines'])]
                    inpage = {x['canonical'] for x in arts} | {find(d, x['canonical'])['id'] for x in arts if find(d, x['canonical'])}
                    missing = [o for o in seen if o not in inpage and find(d, o)['charted'] and find(d, o)['charted'][-1]['date'] >= (pdate(date) - datetime.timedelta(days=3)).isoformat()]
                    if missing and a['tag'] == 'cont':
                        warn.append('RELATED STORYLINE NOT IN TOP 20 (check its rank): %s linked to %s' % (', '.join(missing), a['name']))
    names = {a['canonical'] for a in arts}
    for s in d['storylines']:
        last = s['charted'][-1]['date'] if s['charted'] else None
        if last and last < date and (pdate(date) - pdate(last)).days <= 1 and s['canonical'] not in names:
            pass  # simply cooled off; not a problem
    if warn:
        print('CHECK: %d warning(s) for %s' % (len(warn), date))
        for w in warn: print(' -', w)
    else:
        print('CHECK: ok for %s (%d articles, %d continuing)' % (date, len(arts), sum(1 for a in arts if a['tag'] == 'cont')))


def cmd_update(path):
    d = load()
    date, arts = parse_daily(path)
    new = upd = 0
    for a in arts:
        s = find(d, a['canonical'])
        if not s:
            s = {'id': slug(a['canonical']), 'title': a['name'], 'canonical': a['canonical'], 'url': a['url'], 'type': a['typ'],
                 'first_charted': date, 'cause': {'text': a['cause'], 'confidence': a['conf']}, 'cause_history': [], 'sources': [],
                 'timeline': [], 'charted': []}
            s['cause_history'].append({'date': date, 'text': a['cause'], 'confidence': a['conf'], 'note': 'First stated'})
            d['storylines'].append(s); new += 1
        else:
            upd += 1
            s['type'] = a['typ'] or s.get('type', '')
            c = s['cause']
            changed = a['conf'] != c.get('confidence') or (a['cause'] and a['cause'] != c['text'])
            if a['cause'] and changed and (a['conf'] != c.get('confidence') or REVISE.search(a['cause'] + ' ' + a['why'])):
                if not any(h['date'] == date for h in s['cause_history']):
                    s['cause_history'].append({'date': date, 'text': a['cause'], 'confidence': a['conf'],
                                               'note': 'Confidence changed' if a['conf'] != c.get('confidence') else 'Cause revised'})
                    s['cause'] = {'text': a['cause'], 'confidence': a['conf']}
        s['charted'] = [x for x in s['charted'] if x['date'] != date] + [{'date': date, 'rank': a['rank'], 'views': a['views'], 'confidence': a['conf'], 'anchor': 'a%d' % a['idx']}]
        s['charted'].sort(key=lambda x: x['date'])
        text = a['last'] or a['why']
        s['timeline'] = [x for x in s['timeline'] if x['date'] != date] + [{'date': date, 'text': text}]
        s['timeline'].sort(key=lambda x: x['date'])
        s['first_charted'] = min(s['first_charted'], date)
        merge_sources(s, a['links'])
    d['updated'] = max(date, d.get('updated', ''))
    save(d)
    print('updated %s: %d new storylines, %d existing; %d total' % (date, new, upd, len(d['storylines'])))


# ---------------------------------------------------------------- page generation
CONF = {'hi': ('High confidence', '●'), 'md': ('Medium confidence', '◐'), 'lo': ('Low confidence', '○')}


def status_of(s, latest):
    last = s['charted'][-1]['date']
    if last == latest: return 'Active'
    return 'Cooling' if (pdate(latest) - pdate(last)).days <= 14 else 'Retired'


def chart(s):
    pts = s['charted']
    n = len(pts)
    W = max(260, 64 * n + 40); H = 150; base = 112; top = 22
    mx = max(p['views'] for p in pts)
    bw = 40
    out = ['<svg class="sl-chart" viewBox="0 0 %d %d" role="img" aria-label="%s" preserveAspectRatio="xMinYMid meet">' % (
        W, H, E('Views on each day charted: ' + '; '.join('%s %s views (rank %d)' % (short(p['date']), format(p['views'], ','), p['rank']) for p in pts)))]
    out.append('<line x1="8" y1="%d" x2="%d" y2="%d" stroke="var(--line)" stroke-width="2"/>' % (base, W - 8, base))
    for i, p in enumerate(pts):
        x = 20 + i * 64
        hgt = max(3, (base - top) * p['views'] / mx)
        out.append('<rect x="%d" y="%.1f" width="%d" height="%.1f" rx="3" fill="var(--accent)"/>' % (x, base - hgt, bw, hgt))
        out.append('<text x="%d" y="%.1f" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fg)">%s</text>' % (x + bw / 2, base - hgt - 5, format(p['views'], ',') if p['views'] < 1000000 else '%.1fM' % (p['views'] / 1e6)))
        out.append('<text x="%d" y="%d" text-anchor="middle" font-size="12" fill="var(--muted)">%s</text>' % (x + bw / 2, base + 16, short(p['date'])))
        out.append('<text x="%d" y="%d" text-anchor="middle" font-size="12" font-weight="700" fill="var(--accent)">#%d</text>' % (x + bw / 2, base + 32, p['rank']))
    out.append('</svg>')
    return ''.join(out)


def card(s, latest, groups):
    st = status_of(s, latest)
    pts = s['charted']
    peak = max(p['views'] for p in pts)
    best = min(p['rank'] for p in pts)
    conf = s['cause'].get('confidence')
    cchip = ('<span class="chip conf %s"><span aria-hidden="true">%s</span> %s</span>' % (conf, CONF[conf][1], CONF[conf][0])) if conf in CONF else ''
    why = s['cause']['text']
    why = (why[:150].rsplit(' ', 1)[0] + '…') if len(why) > 160 else why
    b = '<section class="blk cause"><h4>Cause so far</h4><p class="causetext">%s</p><p class="confrow">%s</p>' % (E(s['cause']['text']), cchip)
    if len(s['cause_history']) > 1:
        b += '<ul class="more">' + ''.join('<li><strong>%s (%s):</strong> %s</li>' % (E(short(h['date'])), E(h.get('note', '')), E(h['text'])) for h in s['cause_history'][1:]) + '</ul>'
    b += '</section>'
    b += '<section class="blk story"><h4>Timeline</h4><ol class="tl">' + ''.join(
        '<li><span class="when">%s</span><span class="what">%s</span></li>' % (E(short(t['date'])), E(t['text'])) for t in s['timeline']) + '</ol></section>'
    b += '<section class="blk chart"><h4>Views on days charted</h4><div class="chartwrap">%s</div></section>' % chart(s)
    b += '<section class="blk days"><h4>Reports it appears in</h4><ul class="kvlist">' + ''.join(
        '<li class="kv"><span class="k"><a href="%s.html#%s">%s</a></span><span class="v">rank <b>%d</b>, <b>%s</b> views</span></li>' % (
            p['date'], p.get('anchor', ''), E(short(p['date'])), p['rank'], format(p['views'], ',')) for p in reversed(pts)) + '</ul></section>'
    if s['sources']:
        b += '<section class="blk src"><h4>Key sources</h4><ul>' + ''.join('<li><a href="%s">%s</a></li>' % (E(x['url'], quote=True), E(x['title'])) for x in reversed(s['sources'][-8:])) + '</ul></section>'
    gl = [g for g in groups if s['id'] in g['members']]
    if gl:
        b += '<section class="blk group"><h4>Linked storylines</h4><ul>' + ''.join(
            '<li><a href="#g-%s">%s</a>: %s</li>' % (g['id'], E(g['title']), ', '.join('<a href="#%s">%s</a>' % (m['id'], E(m['title'])) for m in g['_m'] if m['id'] != s['id'])) for g in gl) + '</ul></section>'
    return ('<details class="art sl" id="%s" data-status="%s" data-conf="%s" data-q="%s"><summary>'
            '<span class="rk" aria-label="%d days charted"><small>Days</small>%d</span>'
            '<span class="ttl"><span class="nm"><a href="%s">%s</a></span><span class="why">%s</span></span>'
            '<span class="chips"><span class="chip st %s">%s</span><span class="chip typ">%s</span>%s</span>'
            '<span class="vw"><small>Top day</small><mark class="key">%s</mark></span></summary><div class="body">%s</div></details>') % (
        s['id'], st.lower(), conf or 'none', E((s['title'] + ' ' + s.get('type', '') + ' ' + s['cause']['text']).lower(), quote=True), len(pts), len(pts), E(s['url'], quote=True), E(s['title']),
        E(why), st.lower(), st, E(s.get('type', '')), cchip, format(peak, ','), b)


def cmd_build():
    d = load()
    S = d['storylines']
    if not S: sys.exit('no storylines')
    latest = max(s['charted'][-1]['date'] for s in S if s['charted'])
    dates = sorted({c['date'] for s in S for c in s['charted']})
    byid = {s['id']: s for s in S}
    groups = []
    for g in d['groups']:
        g = dict(g); g['_m'] = [byid[m] for m in g['members'] if m in byid]
        if len(g['_m']) > 1: groups.append(g)
    cnt = {k: sum(1 for s in S if status_of(s, latest) == k) for k in ('Active', 'Cooling', 'Retired')}
    order = {'Active': 0, 'Cooling': 1, 'Retired': 2}
    S2 = sorted(S, key=lambda s: (order[status_of(s, latest)], -pdate(s['charted'][-1]['date']).toordinal(), min(c['rank'] for c in s['charted']), s['title']))
    gh = ''
    if groups:
        gh = '<section id="groups"><h2>Linked storylines</h2><p class="intro">Articles that rose together because of one story.</p><ul class="glist">' + ''.join(
            '<li id="g-%s"><strong>%s</strong>%s<span class="gm">%s</span></li>' % (
                g['id'], E(g['title']), (' <span class="gs">%s</span>' % E(g['summary'])) if g.get('summary') else '',
                ' '.join('<a class="chip typ" href="#%s">%s <span class="chip st %s">%s</span></a>' % (m['id'], E(m['title']), status_of(m, latest).lower(), status_of(m, latest)) for m in g['_m']))
            for g in groups) + '</ul></section>'
    page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wikipedia Top Reads: Storylines</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@500;700&display=swap">
<link rel="stylesheet" href="assets/style.css?v=20261026e">
</head><body>
<nav class="daynav" aria-label="Site"><div class="dn-row"><a class="dn-btn" href="index.html"><span aria-hidden="true">←</span> Latest report</a><span class="dn-btn latest">Storylines</span><span></span></div></nav>
<div class="wrap">
<header class="top">
  <p class="eyebrow">English Wikipedia · most-read articles</p>
  <h1>Storylines</h1>
  <p class="date">%d articles tracked across %d reports, through %s (UTC)</p>
  <p class="gen"><em>This page was generated using Claude.</em></p>
</header>
<section id="how"><p class="intro">Each storyline follows one article through the daily reports: its verified cause, a dated timeline, and its rank and views on each day it charted. A storyline is <strong>Active</strong> if it charted on the latest report, <strong>Cooling</strong> if it charted in the 14 days before, and <strong>Retired</strong> after that. Tap a title to expand it.</p></section>
%s
<section id="all">
  <h2>All storylines</h2>
  <div class="filter" role="group" aria-label="Filter storylines">
    <p class="flabel">Filter by status <span class="fhint">(select one or more)</span></p>
    <div class="fbtns">
      <button type="button" class="chip st active sfbtn" data-status="active" aria-pressed="false">Active <span class="n">%d</span></button>
      <button type="button" class="chip st cooling sfbtn" data-status="cooling" aria-pressed="false">Cooling <span class="n">%d</span></button>
      <button type="button" class="chip st retired sfbtn" data-status="retired" aria-pressed="false">Retired <span class="n">%d</span></button>
      <button type="button" class="clear" id="sClear" hidden>Show all</button>
    </div>
    <label class="flabel" for="sSearch" style="display:block;margin-top:12px">Search by name, type or cause</label>
    <input id="sSearch" type="search" class="ssearch" autocomplete="off">
    <p class="fstatus" id="sStatus" role="status" aria-live="polite">Showing all %d storylines</p>
  </div>
  <div class="ctl" role="group" aria-label="Expand or collapse"><button type="button" id="sExpand">Expand all</button><button type="button" id="sCollapse">Collapse all</button></div>
  %s
</section>
<footer class="site-foot">
<p>Generated using Claude. Based on Wikipedia pageview data and article content; linked news sources remain the property of their publishers.</p>
<p>To the extent any copyright exists in this work, it is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Text from Wikipedia remains under its own CC BY-SA license.</p>
</footer>
</div>
<script src="assets/storylines.js"></script>
</body></html>
''' % (len(S), len(dates), long_(latest), gh, cnt['Active'], cnt['Cooling'], cnt['Retired'], len(S), ''.join(card(s, latest, groups) for s in S2))
    open(os.path.join(ROOT, 'storylines.html'), 'w', encoding='utf-8').write(page)
    # link every daily page article to its storyline
    ids = {}
    for s in S:
        ids[s['canonical']] = s['id']
    for a, c in d['aliases'].items():
        ids[a] = c
    linked = 0
    for fn in sorted(os.listdir(ROOT)):
        if not (re.match(r'\d{4}-\d\d-\d\d\.html$', fn) or fn == 'index.html'):
            continue
        p = os.path.join(ROOT, fn)
        h = open(p, encoding='utf-8').read()

        def fix(m):
            global_blk = m.group(0)
            if 'sl-link' in global_blk: return global_blk
            u = re.search(r'<span class="nm"><a href="([^"]+)"', global_blk)
            sid = ids.get(canon(html.unescape(u.group(1)))) if u else None
            if not sid: return global_blk
            return global_blk[:-len('</div></details>')] + '<p class="sl-link"><a href="storylines.html#%s">See this storyline across all reports <span aria-hidden="true">→</span></a></p></div></details>' % sid
        h2 = re.sub(r'<details class="art" id="a\d+".*?</div></details>(?=<details class="art"|\s*</section>)', fix, h, flags=re.S)
        if h2 != h:
            open(p, 'w', encoding='utf-8').write(h2); linked += 1
    print('built storylines.html (%d storylines, %d groups); linked %d daily page(s)' % (len(S), len(groups), linked))


if __name__ == '__main__':
    cmds = {'check': cmd_check, 'update': cmd_update, 'build': cmd_build}
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        sys.exit(__doc__)
    cmds[sys.argv[1]](*sys.argv[2:])
