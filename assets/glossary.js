(function () {
  var G = [
    { k: 'baseline', rx: 'baseline', t: 'Baseline', d: 'The article’s normal daily views before it got attention, usually the median of the quiet days earlier in the 28-day window. “5 times baseline” means five times as many views as a normal day.' },
    { k: 'median', rx: '(?:28-day |whole-window )?median', t: 'Median', d: 'The middle value when daily views are sorted from lowest to highest. Unlike an average, one huge spike does not pull it up. When a page was never quiet, the median of the whole 28 days is used as its baseline.' },
    { k: 'peak', rx: 'peak', t: 'Peak', d: 'The single busiest day in the 28-day window.' },
    { k: 'rank', rx: 'rank history', t: 'Rank history', d: 'Where the article placed in the full most-read list on each day. 1 is the most read. Pages such as the Main Page and search are in the list, so the top article is not always rank 1.' },
    { k: 'edits', rx: 'edits by \\d+ editors|revisions', t: 'Edits', d: 'Changes made to the article in the 28-day window, and how many different editors made them. Busy editing often follows news about the subject, but not always.' },
    { k: 'revert', rx: 'revert-tagged|tagged as reverts|revert tags|revert or undo tags|reverts?', t: 'Revert-tagged', d: 'Edits that Wikipedia flags as undoing or rolling back someone else’s edit. A high number can mean vandalism or an editing dispute.' },
    { k: 'prot', rx: 'extended-confirmed|semi-protected|autoconfirmed', t: 'Page protection', d: 'A limit on who can edit. Semi-protected (autoconfirmed): only accounts at least 4 days old with 10 edits. Extended-confirmed: only accounts at least 30 days old with 500 edits. It is usually added after vandalism or an edit war.' },
    { k: 'talk', rx: 'talk page', t: 'Talk page', d: 'The discussion page where editors argue about and plan changes to the article. New sections can point to a dispute or to news that people are reacting to.' },
    { k: 'utc', rx: 'UTC', t: 'UTC', d: 'The time standard used for all dates in these reports. A “day” runs from midnight to midnight UTC, which is 8 pm to 8 pm Eastern during daylight saving time.' }
  ];
  var CONF = {
    hi: ['High confidence', 'Direct, dated evidence (such as a news report or the article’s own text) explains the surge, and nothing else competes with it.'],
    md: ['Medium confidence', 'A likely cause with partial evidence, or a good fit for the timing but not directly confirmed.'],
    lo: ['Low confidence', 'A guess. No direct evidence was found, or the cause is unknown.']
  };
  var CAUSE = ['Likely cause (inference)', 'The report’s best explanation for why the article was read so much. Views and edits are measured facts; this part is a judgement, so it is labelled as an inference with a confidence level.'];

  var tip = document.createElement('div');
  tip.id = 'tip'; tip.className = 'tip'; tip.setAttribute('role', 'dialog'); tip.hidden = true;
  tip.innerHTML = '<button type="button" class="tip-x" aria-label="Close explanation">×</button><p class="tip-t"></p><p class="tip-d"></p>';
  document.body.appendChild(tip);
  var cur = null;
  function hide() { tip.hidden = true; if (cur) { cur.setAttribute('aria-expanded', 'false'); cur = null; } }
  function show(el, title, text) {
    if (cur === el && !tip.hidden) { hide(); return; }
    hide();
    tip.querySelector('.tip-t').textContent = title;
    tip.querySelector('.tip-d').textContent = text;
    tip.hidden = false; cur = el; el.setAttribute('aria-expanded', 'true');
    var r = el.getBoundingClientRect(), w = Math.min(320, document.documentElement.clientWidth - 24);
    tip.style.width = w + 'px';
    var left = Math.max(12, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - w - 12));
    tip.style.left = left + 'px'; tip.style.top = (r.bottom + window.scrollY + 8) + 'px';
  }
  document.addEventListener('click', function (e) {
    if (tip.contains(e.target)) { if (e.target.classList.contains('tip-x')) { var c = cur; hide(); if (c) { c.focus(); } } return; }
    if (e.target.closest && e.target.closest('.term')) { return; }
    hide();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !tip.hidden) { var c = cur; hide(); if (c) { c.focus(); } } });

  function term(text, title, desc) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'term'; b.textContent = text; b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', text + ': what does this mean?');
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show(b, title, desc); });
    return b;
  }

  // Mark the first use of each term inside every expanded article section.
  document.querySelectorAll('details.art .body').forEach(function (body) {
    var seen = {};
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) { return NodeFilter.FILTER_REJECT; }
        return n.parentElement.closest('a, button, .term, .chip, .tip') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = []; while (walker.nextNode()) { nodes.push(walker.currentNode); }
    nodes.forEach(function (n) {
      var txt = n.nodeValue, frag = document.createDocumentFragment(), pos = 0, changed = false;
      while (true) {
        var best = null;
        G.forEach(function (g) {
          if (seen[g.k]) { return; }
          var re = new RegExp('(^|[^A-Za-z])(' + g.rx + ')(?![A-Za-z])', 'i'); re.lastIndex = 0;
          var m = re.exec(txt.slice(pos));
          if (m) { var s = pos + m.index + m[1].length; if (!best || s < best.s) { best = { s: s, e: s + m[2].length, g: g }; } }
        });
        if (!best) { break; }
        frag.appendChild(document.createTextNode(txt.slice(pos, best.s)));
        frag.appendChild(term(txt.slice(best.s, best.e), best.g.t, best.g.d));
        seen[best.g.k] = true; pos = best.e; changed = true;
      }
      if (changed) { frag.appendChild(document.createTextNode(txt.slice(pos))); n.parentNode.replaceChild(frag, n); }
    });
    // Likely cause heading and confidence chip
    body.querySelectorAll('.blk.cause h4').forEach(function (h) {
      var s = h.querySelector('.inf');
      if (s) { s.classList.add('term'); s.setAttribute('role', 'button'); s.tabIndex = 0; s.setAttribute('aria-expanded', 'false');
        var f = function (e) { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') { return; } e.preventDefault(); e.stopPropagation(); show(s, CAUSE[0], CAUSE[1]); };
        s.addEventListener('click', f); s.addEventListener('keydown', f); }
    });
    body.querySelectorAll('.confrow .chip.conf').forEach(function (c) {
      var lv = c.classList.contains('hi') ? 'hi' : c.classList.contains('md') ? 'md' : 'lo';
      c.classList.add('term'); c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('aria-expanded', 'false');
      var f = function (e) { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') { return; } e.preventDefault(); e.stopPropagation(); show(c, CONF[lv][0], CONF[lv][1]); };
      c.addEventListener('click', f); c.addEventListener('keydown', f);
    });
  });

  // Collapsed guide for first-time readers
  var jump = document.querySelector('nav.jump');
  if (jump) {
    var g = document.createElement('details'); g.className = 'guide';
    var h = '<summary>New here? What the terms mean</summary><div class="guide-b"><p>Tap any dotted-underline word in an article’s details for a short explanation. The same terms are listed here.</p><dl>';
    G.forEach(function (x) { h += '<dt>' + x.t + '</dt><dd>' + x.d + '</dd>'; });
    ['hi', 'md', 'lo'].forEach(function (k) { h += '<dt>' + CONF[k][0] + '</dt><dd>' + CONF[k][1] + '</dd>'; });
    h += '<dt>' + CAUSE[0] + '</dt><dd>' + CAUSE[1] + '</dd>';
    h += '<dt>New event / Continuing / No trigger found</dt><dd>New event: something that happened around that date explains the surge. Continuing: the story began on an earlier day and is still drawing readers. No trigger found: nothing explaining the surge was found.</dd></dl></div>';
    g.innerHTML = h; jump.parentNode.insertBefore(g, jump);
  }
})();
