import re, html, xml.etree.ElementTree as ET

import sys, os, json, datetime
SRC, DATE_ISO, OUT = sys.argv[1], sys.argv[2], sys.argv[3]   # tool-result file (or raw XML), YYYY-MM-DD, site dir
HERE = os.path.dirname(os.path.abspath(__file__))
x = open(SRC).read()
try:
    x = json.loads(x)['data']['xml']
except Exception:
    pass
_d = datetime.date.fromisoformat(DATE_ISO)
def _ord(n): return '%d%s' % (n, 'th' if 11 <= n % 100 <= 13 else {1:'st',2:'nd',3:'rd'}.get(n % 10, 'th'))
DAY_ORD = _ord(_d.day)
DATE_LONG = '%s %s %s %d' % (_d.strftime('%A'), DAY_ORD, _d.strftime('%b'), _d.year)
DATE_SHORT = '%s %s %s %d' % (_d.strftime('%a'), DAY_ORD, _d.strftime('%b'), _d.year)
root = ET.fromstring(x)
E = html.escape


def inline(el):
    out = E(el.text or '')
    for c in el:
        t = c.tag
        inner = inline(c)
        if t == 'bold':
            out += '<strong>%s</strong>' % inner
        elif t == 'italic':
            out += '<em>%s</em>' % inner
        elif t == 'link':
            out += '<a href="%s">%s</a>' % (E(c.get('href', ''), quote=True), inner)
        elif t == 'date':
            out += E(c.get('value', ''))
        else:
            out += inner
        out += E(c.tail or '')
    return out


def para_text(p):
    return ''.join(p.itertext()).strip()


def para_html(p):
    return inline(p)


def hl_numbers(s):
    # highlight the multiple of baseline
    return re.sub(r'(\d[\d,.]* times (?:the )?baseline)', r'<mark class="key">\1</mark>', s)


KV = re.compile(r'^([^:<>]{1,30}): (.+)$', re.S)


def li_html(li, kv_ok, label):
    p = li.find('paragraph')
    sub = li.find('list')
    txt = para_text(p) if p is not None else ''
    has_link = p is not None and p.find('.//link') is not None
    has_bold = p is not None and p.find('.//bold') is not None
    m = KV.match(txt)
    if kv_ok and m and not has_link and not has_bold and sub is None:
        k, v = m.group(1), m.group(2)
        vh = E(v)
        if label == 'Views':
            vh = hl_numbers(vh)
            if re.match(r'^\d[\d,]*$', v.strip()) and k.endswith('Oct') and ('<mark' not in vh) and k.startswith(DAY_ORD):
                vh = '<mark class="key big">%s</mark>' % vh
            elif re.match(r'^\d[\d,]*', v) and k not in ('Baseline',):
                vh = re.sub(r'^(\d[\d,]*)', r'<b>\1</b>', vh)
        return '<li class="kv"><span class="k">%s</span><span class="v">%s</span></li>' % (E(k), vh)
    inner = para_html(p) if p is not None else ''
    if label == 'Views':
        inner = hl_numbers(inner)
    s = '<li>%s' % inner
    if sub is not None:
        s += list_html(sub, kv_ok, label)
    return s + '</li>'


def list_html(ul, kv_ok=False, label=''):
    items = [li_html(li, kv_ok, label) for li in ul.findall('listItem')]
    cls = ' class="kvlist"' if any('class="kv"' in i for i in items) else ''
    return '<ul%s>%s</ul>' % (cls, ''.join(items))


def table_rows(tb):
    rows = []
    for r in tb.findall('row'):
        rows.append([c for c in r.findall('cell')])
    return rows


def cell_html(c):
    return ''.join(para_html(p) for p in c.findall('paragraph'))


def cell_text(c):
    return ''.join(para_text(p) for p in c.findall('paragraph'))


CONF = re.compile(r'^(high|medium-high|medium-low|medium|low)\b(.*)$', re.I | re.S)
CONF_CLS = {'high': 'hi', 'medium-high': 'hi', 'medium': 'md', 'medium-low': 'lo', 'low': 'lo'}
CONF_SYM = {'hi': '●', 'md': '◐', 'lo': '○'}


def conf_chip(text):
    m = CONF.match(text.strip())
    if not m:
        return '', ''
    w = m.group(1).lower()
    cls = CONF_CLS[w]
    rest = m.group(2).strip(' ;:,.')
    chip = '<span class="chip conf %s"><span aria-hidden="true">%s</span> %s confidence</span>' % (cls, CONF_SYM[cls], w.capitalize())
    return chip, rest


# ---- walk the document
kids = list(root)
sections = {}
cur = None
head = []
for k in kids:
    if k.tag == 'paragraph' and k.get('heading') == '2':
        cur = para_text(k)
        sections[cur] = []
    elif cur is None:
        head.append(k)
    else:
        sections[cur].append(k)

title_p = [k for k in head if k.tag == 'paragraph' and k.get('heading') == '1'][0]
gen = [k for k in head if k.tag == 'paragraph' and k.find('.//italic') is not None][0]
banner = [k for k in head if k.tag == 'blockquote'][0]

# ---- glance table data
glance = sections['At a glance']
gtable = [k for k in glance if k.tag == 'table'][0]
rows = table_rows(gtable)[1:]
meta = []
for r in rows:
    rank, art, typ, views, why = r
    a = art.find('.//link')
    why_t = cell_text(why)
    if why_t.startswith('Continuing from'):
        tag = ('cont', 'Continuing')
    elif why_t.startswith('Unknown') or (os.environ.get('LEGACY') and re.search(r'(?i)no confirmed trigger|no trigger|trigger unknown|unknown|no event found|no cause found|evergreen|unconfirmed|not confirmed', why_t)):
        tag = ('unk', 'No trigger found')
    else:
        tag = ('evt', 'New event')
    meta.append(dict(rank=cell_text(rank), name=cell_text(art), url=a.get('href') if a is not None else '#',
                     typ=cell_text(typ), views=cell_text(views), why=why_html if False else cell_html(why), why_t=why_t, tag=tag))

# ---- expanded
exp = sections['Expanded detail']
intro_p = [k for k in exp if k.tag == 'paragraph' and not k.get('heading')][0]
articles = []
i = 0
while i < len(exp):
    k = exp[i]
    if k.tag == 'paragraph' and k.get('heading') == '3':
        lst = exp[i + 1]
        articles.append((para_text(k), lst))
        i += 2
    else:
        i += 1
assert len(articles) == 20, len(articles)

BLK_CLS = {'Views': 'views', 'Rank history': 'rank', 'Edits': 'edits', 'Protection': 'prot', 'Talk page': 'talk', 'News': 'news'}


def timeline_html(sub):
    out = '<ol class="tl">'
    for li in sub.findall('listItem'):
        p = li.find('paragraph')
        b = p.find('.//bold')
        date = ''.join(b.itertext()) if b is not None else ''
        full = para_html(p)
        # remove leading bold from full
        full_rest = re.sub(r'^<strong>.*?</strong>', '', full, count=1).strip()
        out += '<li><span class="when">%s</span><span class="what">%s</span></li>' % (E(date.rstrip(':')), full_rest)
    return out + '</ol>'


LV = {}

# Detail order inside each article: News, Likely cause, Timeline, then the data blocks.
BLK_ORDER = ['news', 'cause', 'story']


def order_blocks(html_blocks):
    parts = re.findall(r'<section class="blk [^"]*">.*?</section>', html_blocks, re.S)
    assert ''.join(parts) == html_blocks
    def key(b):
        c = re.match(r'<section class="blk ([a-z]+)', b).group(1)
        return BLK_ORDER.index(c) if c in BLK_ORDER else len(BLK_ORDER)
    return ''.join(sorted(parts, key=key))  # stable: other blocks keep their order


def article_html(idx, head_text, lst, m):
    blocks = ''
    cause_chip = ''
    cause_html = ''
    for li in lst.findall('listItem'):
        p = li.find('paragraph')
        label = para_text(p)
        sub = li.find('list')
        if label.startswith('Storyline so far'):
            blocks += '<section class="blk story"><h4>%s</h4>%s</section>' % (E(label), timeline_html(sub))
        elif label.startswith('Likely cause'):
            cause = ''
            conf = ''
            note = ''
            extra = ''
            for s in sub.findall('listItem'):
                t = para_text(s.find('paragraph'))
                if not (t.startswith('Cause:') or t.startswith('Confidence:')):
                    extra += '<li>%s</li>' % para_html(s.find('paragraph'))
                if t.startswith('Cause:'):
                    cause = para_html(s.find('paragraph'))[len('Cause:'):].strip()
                elif t.startswith('Confidence:'):
                    conf, note = conf_chip(t[len('Confidence:'):])
            cause_chip = conf
            blocks += ('<section class="blk cause"><h4>Likely cause <span class="inf">inference</span></h4>'
                       '<p class="causetext">%s</p><p class="confrow">%s%s</p>%s</section>') % (
                cause[0:1].upper() + cause[1:], conf, (' <span class="confnote">%s</span>' % E(note)) if note else '', ('<ul class="more">%s</ul>' % extra) if extra else '')
        else:
            cls = BLK_CLS.get(label, 'misc')
            blocks += '<section class="blk %s"><h4>%s</h4>%s</section>' % (cls, E(label), list_html(sub, True, label))
    blocks = order_blocks(blocks)
    tag_cls, tag_txt = m['tag']
    lvl = re.search(r'conf (hi|md|lo)"', cause_chip)
    lvl = lvl.group(1) if lvl else 'none'
    LV[idx] = lvl
    return ('<details class="art" id="a%d" data-conf="' + lvl + '"%s><summary>'
            '<span class="rk" aria-label="Rank %s"><small>Rank</small>%s</span>'
            '<span class="ttl"><span class="nm"><a href="%s">%s</a></span><span class="why">%s</span></span>'
            '<span class="chips"><span class="chip tag %s">%s</span><span class="chip typ">%s</span>%s</span>'
            '<span class="vw"><small>Views</small><mark class="key">%s</mark></span>'
            '</summary><div class="body">%s</div></details>') % (
        idx, '', E(m['rank']), E(m['rank']), E(m['url'], quote=True), E(m['name']), m['why'],
        tag_cls, tag_txt, E(m['typ']), cause_chip, E(m['views']), blocks)


arts_html = ''.join(article_html(n + 1, h, l, meta[n]) for n, (h, l) in enumerate(articles))

# ---- jump list
jump = ''.join('<li data-conf="%s"><a href="#a%d"><span class="jr">%s</span><span class="jt"><span class="jn">%s</span><span class="jy">%s</span></span></a></li>' % (
    LV[n + 1], n + 1, E(m['rank']), E(m['name']), E(m['typ'])) for n, m in enumerate(meta))
CNT = {k: sum(1 for v in LV.values() if v == k) for k in ('hi', 'md', 'lo')}

# ---- glance table (responsive)
gt = '<div class="tblwrap"><table class="glance"><thead><tr><th>Rank</th><th>Article</th><th>Type</th><th>Views</th><th>What it is and why it is up</th></tr></thead><tbody>'
for n, m in enumerate(meta):
    gt += ('<tr><td data-label="Rank" class="num"><b>%s</b></td><td data-label="Article"><a href="#a%d">%s</a></td>'
           '<td data-label="Type"><span class="chip typ">%s</span></td><td data-label="Views" class="num"><mark class="key">%s</mark></td>'
           '<td data-label="Why"><span class="whyc"><span class="chip tag %s">%s</span> %s</span></td></tr>') % (
        E(m['rank']), n + 1, E(m['name']), E(m['typ']), E(m['views']), m['tag'][0], m['tag'][1], m['why'])
gt += '</tbody></table></div>'

glance_paras = [k for k in glance if k.tag == 'paragraph']
g_first, g_lead, g_note = [para_html(p) for p in glance_paras[:3]]


def generic(elems):
    out = ''
    for k in elems:
        if k.tag == 'paragraph':
            out += '<p>%s</p>' % para_html(k)
        elif k.tag == 'list':
            out += list_html(k)
        elif k.tag == 'table':
            rs = table_rows(k)
            t = '<div class="tblwrap"><table class="plain"><thead><tr>%s</tr></thead><tbody>' % ''.join('<th>%s</th>' % cell_html(c) for c in rs[0])
            for r in rs[1:]:
                t += '<tr>%s</tr>' % ''.join('<td>%s</td>' % cell_html(c) for c in r)
            out += t + '</tbody></table></div>'
    return out


method = generic(sections['Method and gaps'])
sources = generic(sections['Sources'])
hidden_els = sections.get('Hidden pages in the ranking')
hidden = generic(hidden_els) if hidden_els else None

banner_html = ''.join(para_html(p) for p in banner.findall('paragraph')) or inline(banner)
gen_html = para_html(gen)


page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wikipedia Top Reads: @@DS@@</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@500;700&display=swap">
<link rel="stylesheet" href="assets/style.css?v=20261026e">
</head><body>
<div id="daynav" data-day="%s"></div>
<div class="wrap">
<header class="top">
  <p class="eyebrow">English Wikipedia · most-read articles</p>
  <h1>Wikipedia Top Reads</h1>
  <p class="date">@@DL@@ (UTC)</p>
  <p class="gen">%s</p>
</header>
<aside class="banner" aria-label="Main Page summary"><h2 class="sr">Main Page</h2><p>%s</p></aside>

<nav class="jump" aria-label="Jump to an article">
  <h2>Jump to an article</h2>
  <ol>%s</ol>
</nav>

<section id="glance">
  <h2>At a glance</h2>
  <p class="first">%s</p>
  <p>%s</p>
  %s
  <p class="note">%s</p>
</section>

<section id="detail">
  <h2>Expanded detail</h2>
  <p class="intro">%s</p>
  <div class="ctl" role="group" aria-label="Expand or collapse sections">
    <button type="button" id="expandAll">Expand all</button>
    <button type="button" id="collapseAll">Collapse all</button>
  </div>
  <div class="filter" role="group" aria-label="Filter articles by confidence">
    <p class="flabel" id="flabel">Filter by confidence <span class="fhint">(select one or more)</span></p>
    <div class="fbtns">
      <button type="button" class="chip conf hi fbtn" data-level="hi" aria-pressed="false"><span aria-hidden="true">●</span> High <span class="n">%d</span></button>
      <button type="button" class="chip conf md fbtn" data-level="md" aria-pressed="false"><span aria-hidden="true">◐</span> Medium <span class="n">%d</span></button>
      <button type="button" class="chip conf lo fbtn" data-level="lo" aria-pressed="false"><span aria-hidden="true">○</span> Low <span class="n">%d</span></button>
      <button type="button" class="clear" id="clearF" hidden>Show all</button>
    </div>
    <p class="fstatus" id="fstatus" role="status" aria-live="polite">Showing all 20 articles</p>
  </div>
  %s
</section>

<section id="method">
  <details class="ref"><summary><h2>Method and gaps</h2></summary><div class="refbody">%s</div></details>
  <details class="ref"><summary><h2>Sources</h2></summary><div class="refbody">%s</div></details>
  %s
</section>
</div>
<script src="assets/days.js"></script>
<script src="assets/nav.js"></script>
<script src="assets/page.js?v=20261026b"></script>
</body></html>
''' % (DATE_ISO, gen_html, banner_html, jump, g_first, g_lead, gt, g_note, para_html(intro_p), CNT['hi'], CNT['md'], CNT['lo'], arts_html,
       method, sources, ('<details class="ref"><summary><h2>Hidden pages in the ranking</h2></summary><div class="refbody">%s</div></details>' % hidden) if hidden else '<p class="note">This earlier report did not include a list of hidden pages.</p>')

FOOT = (
    '<footer class="site-foot">\n'
    '<p>Generated using Claude. Based on Wikipedia pageview data and article content; linked news sources remain the property of their publishers.</p>\n'
    '<p>To the extent any copyright exists in this work, it is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Text from Wikipedia remains under its own CC BY-SA license.</p>\n'
    '</footer>\n')
_m = '</div>\n<script src="assets/days.js">'
assert page.count(_m) == 1
page = page.replace(_m, FOOT + _m)
page = page.replace('@@DS@@', DATE_SHORT.split(' ',1)[1]).replace('@@DL@@', DATE_LONG)
os.makedirs(OUT + '/assets', exist_ok=True)
page = re.sub(r'(<mark class="key[^"]*">[^<]*</mark>)([)\].,;:]+)', r'<span class="nw">\1\2</span>', page)  # keep trailing punctuation with highlight
open(OUT + '/%s.html' % DATE_ISO, 'w').write(page)
open(OUT + '/index.html', 'w').write(page)
# merge into the day list
dp = OUT + '/assets/days.js'
days = []
if os.path.exists(dp):
    days = [(m.group(1), m.group(2)) for m in re.finditer(r"d: '([^']+)', label: '([^']+)'", open(dp).read())]
days = [d for d in days if d[0] != DATE_ISO] + [(DATE_ISO, DATE_SHORT)]
days.sort(reverse=True)
open(dp, 'w').write('window.DAYS = [\n' + ',\n'.join("  { d: '%s', label: '%s' }" % d for d in days) + '\n];\n')
print('built', DATE_ISO, len(page), 'days:', len(days))
