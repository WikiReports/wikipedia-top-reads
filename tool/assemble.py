#!/usr/bin/env python3
"""Stitch a capped Claude Docs read into one complete XML file.

usage: assemble.py OUT.xml PAGE1 [CONT ...]
  PAGE1 / CONT are saved Docs read results (the JSON text, or bare XML), in any order after PAGE1.
Prints the reads still needed (one per unresolved gap) and exits 3 if any remain, 0 when complete.
"""
import sys, re, json
import xml.etree.ElementTree as ET

def load(path):
    t = open(path, encoding='utf-8').read()
    try:
        t = json.loads(t)['data']['xml']
    except Exception:
        pass
    return ET.fromstring(t)

def norm(i, sess):
    if i is None: return None
    return i if '.' in i and not i.startswith('.') else sess + i if i.startswith('.') else i

def sid(i):  # short id: the part after the session prefix
    return i[i.index('.'):] if i and '.' in i else i

def capgaps(root):
    for parent in root.iter():
        for ch in list(parent):
            if ch.tag == 'gap' and ch.get('cap') == 'true':
                yield parent, ch

def main():
    out, first, conts = sys.argv[1], sys.argv[2], sys.argv[3:]
    root = load(first)
    pool = {}   # short id -> (element, following siblings) from every continuation read
    for c in conts:
        cr = load(c)
        for parent in cr.iter():
            kids = list(parent)
            for n, k in enumerate(kids):
                if k.get('id'):
                    pool.setdefault(sid(k.get('id')), kids[n:])
    changed = True
    while changed:
        changed = False
        for parent, gap in list(capgaps(root)):
            src = pool.get(sid(gap.get('from')))
            if src is None: continue
            idx = list(parent).index(gap)
            parent.remove(gap)
            for j, el in enumerate(src):
                parent.insert(idx + j, el)
            changed = True
    left = [(p, g) for p, g in capgaps(root)]
    for p, g in left:
        par = p.get('id')
        print('STILL NEEDED: read payload {"kind":"view",%s"from":"%s"}' % (('"parentId":"%s",' % (g.get('from').split('.')[0] + par if par.startswith('.') else par)) if par and p.tag != 'doc' else '', g.get('from')))
    if not left:
        root.attrib.pop('complete', None)
    ET.ElementTree(root).write(out, encoding='unicode')
    pend = len(root.findall('.//pending'))
    print('written %s; unresolved gaps: %d; pending blocks: %d' % (out, len(left), pend))
    sys.exit(3 if left or pend else 0)
main()
