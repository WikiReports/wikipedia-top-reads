#!/usr/bin/env python3
"""Replace the "At a glance" summary paragraph with a stacked bar and a breakdown table.

The numbers come from the page itself (the glance table's tag chips and each article's
data-conf attribute), so nothing depends on how the Doc paragraph was worded.

Used two ways:
  * imported by build.py:  page = apply(page)
  * CLI, to patch built pages in place:  python3 tool/glance_summary.py 2026-10-2*.html index.html
Running it twice is safe: an existing summary block is replaced, not duplicated.
"""
import re
import sys

CATS = [
    ('evt', 'New event', 'Newly charted, with a confirmed or likely trigger'),
    ('unk', 'No trigger found', 'Newly charted, no trigger found'),
    ('cont', 'Continuing', 'Already charted on an earlier day'),
]
CONF = [('hi', 'High'), ('md', 'Medium'), ('lo', 'Low')]

ROW = re.compile(
    r'<tr><td data-label="Rank" class="num"><b>(?P<rank>[^<]*)</b></td>'
    r'<td data-label="Article"><a href="#a(?P<n>\d+)">(?P<name>.*?)</a></td>'
    r'.*?<span class="chip tag (?P<tag>cont|evt|unk)">', re.S)
LEAD = re.compile(r'(<section id="glance">\s*<h2>At a glance</h2>\s*<p class="first">.*?</p>\s*)<p>.*?</p>(\s*<div class="tblwrap"><table class="glance">)', re.S)
LEAD_NEW = re.compile(r'(<section id="glance">\s*<h2>At a glance</h2>\s*<p class="first">.*?</p>\s*)<div class="gsum".*?</table>\s*</div>\s*</div>(\s*<div class="tblwrap"><table class="glance">)', re.S)


def _link(r):
    return '<a href="#a%s">%s</a>' % (r['n'], r['name'])


def summary_html(page):
    rows = [m.groupdict() for m in ROW.finditer(page)]
    if not rows:
        raise ValueError('no glance rows found')
    conf = {m.group(1): m.group(2) for m in re.finditer(r'<details class="art" id="a(\d+)" data-conf="(\w+)"', page)}
    total = len(rows)
    by = {c[0]: [r for r in rows if r['tag'] == c[0]] for c in CATS}
    byc = {c[0]: [r for r in rows if conf.get(r['n']) == c[0]] for c in CONF}

    parts = ['%d %s' % (len(by[k]), label.lower()) for k, label, _ in CATS if by[k]]
    bar_label = 'Of %d articles: %s.' % (total, ', '.join(parts))

    bar = ''.join('<span class="seg %s" style="flex-grow:%d"><b>%d</b><span>%s</span></span>' % (k, len(by[k]), len(by[k]), label)
                  for k, label, _ in CATS if by[k])

    trs = ''
    for k, label, hint in CATS:
        if not by[k]:
            continue
        trs += ('<tr><th scope="row"><span class="chip tag %s">%s</span><small>%s</small></th><td class="num">%d</td>'
                '<td class="arts">%s</td></tr>') % (k, label, hint, len(by[k]), ' · '.join(_link(r) for r in by[k]))

    ctr = ''
    for k, label in CONF:
        ctr += ('<tr><th scope="row"><span class="chip conf %s"><span aria-hidden="true">%s</span> %s confidence</span></th>'
                '<td class="num">%d</td><td class="arts">%s</td></tr>') % (
            k, {'hi': '●', 'md': '◐', 'lo': '○'}[k], label, len(byc[k]),
            ' · '.join(_link(r) for r in byc[k]))
    ctr = ctr.replace('<td class="arts"></td>', '<td class="arts muted">—</td>')

    return (
        '<div class="gsum" role="group" aria-label="Summary of the %d articles">'
        '<div class="gbar" role="img" aria-label="%s">%s</div>'
        '<div class="tblwrap"><table class="gsumt"><caption>Breakdown</caption>'
        '<thead><tr><th scope="col">Group</th><th scope="col">Articles</th><th scope="col">Which ones</th></tr></thead><tbody>%s'
        '<tr class="sep"><th scope="row" colspan="3">Confidence</th></tr>%s</tbody></table></div>'
        '</div>') % (total, bar_label, bar, trs, ctr)


def apply(page):
    s = summary_html(page)
    if '<div class="gsum"' in page:
        new, n = LEAD_NEW.subn(lambda m: m.group(1) + s + m.group(2), page, count=1)
    else:
        new, n = LEAD.subn(lambda m: m.group(1) + s + m.group(2), page, count=1)
    if n != 1:
        raise ValueError('glance lead paragraph not found')
    return new


if __name__ == '__main__':
    for path in sys.argv[1:]:
        src = open(path, encoding='utf-8').read()
        try:
            out = apply(src)
        except ValueError as e:
            print('skip', path, '-', e)
            continue
        open(path, 'w', encoding='utf-8').write(out)
        print('patched', path)
