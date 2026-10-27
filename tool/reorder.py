#!/usr/bin/env python3
"""One-off: reorder detail blocks in already-built day pages (News, Likely cause, Timeline first)."""
import glob, re, sys
ORDER = ['news', 'cause', 'story']
def key(b):
    c = re.match(r'<section class="blk ([a-z]+)', b).group(1)
    return ORDER.index(c) if c in ORDER else len(ORDER)
def fix_body(m):
    inner = m.group(2)
    parts = re.findall(r'<section class="blk [^"]*">.*?</section>', inner, re.S)
    rest = inner
    for p in parts: rest = rest.replace(p, '', 1)
    if not parts or rest.strip() and '<section' in rest: return m.group(0)
    return m.group(1) + ''.join(sorted(parts, key=key)) + rest + m.group(3)
for f in sorted(glob.glob('20??-??-??.html')) + ['index.html']:
    t = open(f, encoding='utf-8').read()
    n = re.sub(r'(<div class="body">)(.*?)(</div></details>)', fix_body, t, flags=re.S)
    open(f, 'w', encoding='utf-8').write(n)
    print(f, 'changed' if n != t else 'unchanged')
