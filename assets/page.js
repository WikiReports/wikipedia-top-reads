(function () {
  var arts = function () { return Array.prototype.slice.call(document.querySelectorAll('details.art')); };
  var setAll = function (v) { arts().forEach(function (d) { d.open = v; }); };
  var ex = document.getElementById('expandAll');
  var co = document.getElementById('collapseAll');
  if (ex) ex.addEventListener('click', function () { setAll(true); });
  if (co) co.addEventListener('click', function () { setAll(false); });
  var openFor = function (id) {
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; }
  };
  document.querySelectorAll('.jump a, table.glance a, .blk.linked a[href^="#a"]').forEach(function (a) {
    a.addEventListener('click', function () {
      var id = (a.getAttribute('href') || '').slice(1);
      var t = document.getElementById(id);
      if (t && t.hidden) { active = {}; apply(); }
      openFor(id);
    });
  });
  openFor(location.hash.slice(1));
  var active = {};
  var btns = Array.prototype.slice.call(document.querySelectorAll('.fbtn'));
  var clr = document.getElementById('clearF');
  var st = document.getElementById('fstatus');
  var names = { hi: 'High', md: 'Medium', lo: 'Low' };
  var apply = function () {
    var on = Object.keys(active).filter(function (k) { return active[k]; });
    var shown = 0;
    var total = document.querySelectorAll('details.art').length;
    var flt = document.querySelector('.filter');
    var before = flt ? flt.getBoundingClientRect().top : 0;
    document.querySelectorAll('details.art, .jump li').forEach(function (el) {
      var show = on.length === 0 || on.indexOf(el.getAttribute('data-conf')) !== -1;
      if (el.tagName === 'DETAILS') { el.hidden = !show; if (show) { shown++; } }
      else { el.classList.toggle('dim', !show); }
    });
    btns.forEach(function (b) { b.setAttribute('aria-pressed', active[b.getAttribute('data-level')] ? 'true' : 'false'); });
    if (clr) { clr.hidden = on.length === 0; }
    if (st) {
      st.textContent = on.length === 0 ? 'Showing all ' + total + ' articles'
        : 'Showing ' + shown + ' of ' + total + ' articles: ' + on.map(function (k) { return names[k]; }).join(' and ') + ' confidence';
    }
    if (flt) {
      var delta = flt.getBoundingClientRect().top - before;
      if (delta) { window.scrollBy(0, delta); }
    }
  };
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-level');
      active[k] = !active[k];
      apply();
    });
  });
  if (clr) { clr.addEventListener('click', function () { active = {}; apply(); }); }
  // Minimal collapse control at the bottom of each article's details
  document.querySelectorAll('details.art').forEach(function (d) {
    var body = d.querySelector('.body');
    if (!body) { return; }
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'collapse-end';
    b.innerHTML = '<span aria-hidden="true">\u25B2</span> Collapse';
    b.setAttribute('aria-label', 'Collapse this article');
    b.addEventListener('click', function () {
      d.open = false;
      var s = d.querySelector('summary');
      if (s) { s.scrollIntoView({ block: 'nearest' }); s.focus({ preventScroll: true }); }
    });
    body.appendChild(b);
  });
  // Long timelines: show the latest 3 entries, with a button for the earlier ones.
  document.querySelectorAll('ol.tl').forEach(function (ol, n) {
    var items = Array.prototype.slice.call(ol.children);
    var extra = items.length - 3;
    if (extra < 1) { return; }
    items.slice(0, extra).forEach(function (li) { li.classList.add('tl-old'); });
    if (!ol.id) { ol.id = 'tl' + n; }
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tl-toggle';
    b.setAttribute('aria-controls', ol.id);
    var set = function (open) {
      ol.classList.toggle('tl-collapsed', !open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? 'Show fewer' : 'Show ' + extra + ' earlier ' + (extra === 1 ? 'entry' : 'entries');
    };
    b.addEventListener('click', function () { set(ol.classList.contains('tl-collapsed')); });
    set(false);
    ol.parentNode.insertBefore(b, ol.nextSibling);
  });
})();

/* Main Page views chart: draws the data in <figure class="mpchart" data-series="YYYY-MM-DD:views;..."> as an SVG at the real width
   of the screen (tool/mainpage_chart.py writes the figure; the colors come from the page's theme variables).
   Range buttons: 7, 14 and 28 days come from the series stored in the page (it ends on the report date). 3, 6 and 12 months
   and Year to date are loaded once, on demand, from the Wikimedia pageviews REST API (Main_Page, all-access, user), always
   ending on the report date; if that fails, data/mainpage-daily.json (same site, {"YYYY-MM-DD": views}) is tried, and
   otherwise the stored days stay on screen with a note. A line under the buttons gives the total and daily average.
   Reading a day: hover, tap or drag on the chart, or focus it and use the arrow keys, Home, End and Escape. Short ranges
   shade weekends and tick every day; long ranges tick each month. A button switches the axis between "from 0" and the range. */
(function () {
  var figs = document.querySelectorAll('figure.mpchart');
  if (!figs.length) { return; }
  var NS = 'http://www.w3.org/2000/svg';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var RANGES = [
    ['d7', '7 days', 7], ['d14', '14 days', 14], ['d28', '28 days', 28],
    ['m3', '3 months', 3], ['m6', '6 months', 6], ['m12', '12 months', 12], ['ytd', 'Year to date', 0]
  ];
  var API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Main_Page/daily/';
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
  function lab(iso, yr) { return ord(parseInt(iso.slice(8, 10), 10)) + ' ' + MON[parseInt(iso.slice(5, 7), 10) - 1] + (yr ? ' ' + iso.slice(0, 4) : ''); }
  function toDate(iso) { return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function dow(s) { return toDate(s).getUTCDay(); }
  function addDays(s, n) { var d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function addMonths(s, n) {
    var d = toDate(s), day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
    var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return iso(d);
  }
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) { e.setAttribute(k, attrs[k]); } }
    if (text != null) { e.textContent = text; }
    return e;
  }
  function html(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
  }
  function fmtM(v, step) {
    var m = v / 1e6, dec = (step % 1e6 === 0) ? 0 : ((step % 1e5 === 0) ? 1 : 2);
    return m.toFixed(dec) + 'M';
  }
  function big(v) {
    if (v >= 1e9) { return (v / 1e9).toFixed(2) + ' billion'; }
    if (v >= 1e6) { return (v / 1e6).toFixed(1) + ' million'; }
    return v.toLocaleString('en-US');
  }
  function niceStep(range) {
    var steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 50], i;
    for (i = 0; i < steps.length; i++) { if (range / (steps[i] * 1e6) <= 5) { return Math.round(steps[i] * 1e6); } }
    return 50e6;
  }
  function pct(a, b) {
    var d = (a - b) / b * 100;
    return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '%';
  }
  /* Long history, loaded once per page and shared by every chart on it. */
  var longReq = null;
  function loadLong(end) {
    if (longReq) { return longReq; }
    var start = addMonths(end, -12);
    var jan = end.slice(0, 4) + '-01-01';
    if (jan < start) { start = jan; }
    var url = API + start.replace(/-/g, '') + '00/' + end.replace(/-/g, '') + '00';
    function fromApi(j) {
      var out = {};
      (j.items || []).forEach(function (it) {
        var t = String(it.timestamp);
        out[t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6, 8)] = it.views;
      });
      if (Object.keys(out).length < 30) { throw new Error('short'); }
      return out;
    }
    function fromFile(j) {
      if (!j || typeof j !== 'object' || Object.keys(j).length < 30) { throw new Error('short'); }
      return j;
    }
    var get = function (u) { return fetch(u).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); }); };
    longReq = get(url).then(fromApi).catch(function () { return get('data/mainpage-daily.json').then(fromFile); });
    longReq.catch(function () { longReq = null; });
    return longReq;
  }
  var state = [];
  function draw(fig, st) {
    var host = fig.querySelector('.mpc-plot');
    var pts = st.pts;
    if (!host || pts.length < 2) { return; }
    var n = pts.length, dense = n > 62;
    var crossYear = pts[0].d.slice(0, 4) !== pts[n - 1].d.slice(0, 4);
    var W = Math.max(host.clientWidth, 260), H = W < 520 ? 200 : (W > 900 ? 290 : 250);
    var L = 52, R = 46, T = 14, B = dense ? 30 : 42;
    var vals = pts.map(function (p) { return p.v; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    var lo = 0, hi, step;
    if (st.fit) {
      step = niceStep(max - min);
      lo = Math.floor(min / step) * step; hi = Math.ceil(max / step) * step;
      if (hi === lo) { hi = lo + step; }
    } else {
      step = niceStep(max); hi = Math.ceil(max / step) * step;
    }
    var dx = (W - L - R) / (n - 1);
    var x = function (i) { return L + dx * i; };
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'class': 'mpc-svg' + (dense ? ' dense' : ''), role: 'group', tabindex: '0',
      'aria-label': 'Main Page views per day. Use the left and right arrow keys to read each day.' });
    var k, cnt = Math.round((hi - lo) / step);
    if (!dense) {
      pts.forEach(function (p, j) {
        var w = dow(p.d);
        if (w === 0 || w === 6) {
          var x0 = Math.max(L, x(j) - dx / 2), x1 = Math.min(W - R, x(j) + dx / 2);
          svg.appendChild(el('rect', { x: x0, y: T, width: x1 - x0, height: H - T - B, 'class': 'mpc-wkend' }));
        }
      });
    }
    for (k = 0; k <= cnt; k++) {
      var t = lo + k * step;
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), 'class': 'mpc-grid' }));
      svg.appendChild(el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end', 'class': 'mpc-tick' }, (t === 0 && !st.fit) ? '0' : fmtM(t, step)));
    }
    if (dense) {
      var lastX = -1e9;
      pts.forEach(function (p, j) {
        if (p.d.slice(8, 10) !== '01') { return; }
        svg.appendChild(el('line', { x1: x(j), x2: x(j), y1: T, y2: H - B + 4, 'class': 'mpc-mline' }));
        if (x(j) - lastX < 34) { return; }
        lastX = x(j);
        var m = MON[parseInt(p.d.slice(5, 7), 10) - 1];
        svg.appendChild(el('text', { x: x(j) + 3, y: H - B + 18, 'text-anchor': 'start', 'class': 'mpc-tick' }, m === 'Jan' || j === 0 ? m + ' ' + p.d.slice(2, 4).replace(/^/, "'") : m));
      });
    } else {
      var every = Math.max(1, Math.ceil(58 / dx));
      pts.forEach(function (p, j) {
        svg.appendChild(el('line', { x1: x(j), x2: x(j), y1: H - B, y2: H - B + 4, 'class': 'mpc-xtick' }));
        if ((n - 1 - j) % every === 0) {
          svg.appendChild(el('text', { x: x(j), y: H - B + 18, 'text-anchor': 'middle', 'class': 'mpc-tick' }, lab(p.d)));
          svg.appendChild(el('text', { x: x(j), y: H - B + 33, 'text-anchor': 'middle', 'class': 'mpc-tick mpc-dow' }, DOW[dow(p.d)].slice(0, 3)));
        }
      });
    }
    var line = pts.map(function (p, j) { return (j ? 'L' : 'M') + x(j).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    svg.appendChild(el('path', { d: line + ' L' + x(n - 1).toFixed(1) + ' ' + y(lo) + ' L' + x(0).toFixed(1) + ' ' + y(lo) + ' Z', 'class': 'mpc-area' }));
    svg.appendChild(el('path', { d: line, 'class': 'mpc-line' }));
    var cross = el('line', { x1: 0, x2: 0, y1: T, y2: H - B, 'class': 'mpc-cross', visibility: 'hidden' });
    svg.appendChild(cross);
    pts.forEach(function (p, j) {
      if (dense && j !== n - 1) { return; }
      svg.appendChild(el('circle', { cx: x(j), cy: y(p.v), r: j === n - 1 ? 5 : 3, 'class': j === n - 1 ? 'mpc-dot last' : 'mpc-dot' }));
    });
    var halo = el('circle', { cx: 0, cy: 0, r: 7.5, 'class': 'mpc-sel', visibility: 'hidden' });
    svg.appendChild(halo);
    var lastP = pts[n - 1];
    var lastLab = el('text', { x: x(n - 1) + 9, y: y(lastP.v) + 4, 'class': 'mpc-val' }, fmtM(lastP.v, 1e5));
    svg.appendChild(lastLab);
    var hit = el('rect', { x: L - dx / 2, y: T, width: W - L - R + dx, height: H - T - B, 'class': 'mpc-hit' });
    svg.appendChild(hit);

    host.textContent = '';
    host.appendChild(svg);
    var tip = html('div', 'mpc-tip');
    tip.setAttribute('aria-hidden', 'true');
    var tDay = html('strong'), tViews = html('span'), tChg = html('span', 'mpc-tipchg');
    tip.appendChild(tDay); tip.appendChild(tViews); tip.appendChild(tChg);
    host.appendChild(tip);
    var live = html('div', 'sr');
    live.setAttribute('aria-live', 'polite');
    host.appendChild(live);

    function show(j, speak) {
      j = Math.max(0, Math.min(n - 1, j));
      st.sel = j;
      var p = pts[j];
      cross.setAttribute('x1', x(j)); cross.setAttribute('x2', x(j)); cross.setAttribute('visibility', 'visible');
      halo.setAttribute('cx', x(j)); halo.setAttribute('cy', y(p.v)); halo.setAttribute('visibility', 'visible');
      lastLab.setAttribute('visibility', j === n - 1 ? 'visible' : 'hidden');
      tDay.textContent = DOW[dow(p.d)] + ' ' + lab(p.d, dense || crossYear);
      tViews.textContent = p.v.toLocaleString('en-US') + ' views';
      tChg.textContent = j ? pct(p.v, pts[j - 1].v) + ' vs ' + lab(pts[j - 1].d) : 'First day shown';
      tip.style.display = 'block';
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = Math.min(Math.max(x(j) - tw / 2, 0), W - tw);
      var top = y(p.v) - th - 14;
      if (top < 0) { top = y(p.v) + 16; }
      if (top + th > H - B) { top = Math.max(0, H - B - th); }
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      if (speak) { live.textContent = tDay.textContent + ': ' + tViews.textContent + ', ' + tChg.textContent; }
    }
    function clear() {
      st.sel = null;
      cross.setAttribute('visibility', 'hidden'); halo.setAttribute('visibility', 'hidden');
      lastLab.setAttribute('visibility', 'visible');
      tip.style.display = 'none';
    }
    function idxAt(e) {
      var r = svg.getBoundingClientRect();
      var px = (e.clientX - r.left) * (W / (r.width || W));
      return Math.round((px - L) / dx);
    }
    hit.addEventListener('pointermove', function (e) { show(idxAt(e), false); });
    hit.addEventListener('pointerdown', function (e) { show(idxAt(e), true); });
    hit.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && document.activeElement !== svg) { clear(); } });
    svg.addEventListener('focus', function () { if (st.sel == null) { show(n - 1, true); } });
    svg.addEventListener('blur', function () { clear(); });
    svg.addEventListener('keydown', function (e) {
      var j = st.sel == null ? n - 1 : st.sel, key = e.key;
      var big7 = dense ? 7 : 1;
      if (key === 'ArrowLeft') { j -= e.shiftKey ? big7 * 4 : big7; } else if (key === 'ArrowRight') { j += e.shiftKey ? big7 * 4 : big7; }
      else if (key === 'Home') { j = 0; } else if (key === 'End') { j = n - 1; }
      else if (key === 'Escape') { clear(); return; } else { return; }
      e.preventDefault();
      show(j, true);
    });
    if (st.sel != null && st.sel < n) { show(st.sel, false); }
  }
  function summarise(fig, st, label) {
    var pts = st.pts, n = pts.length;
    var total = pts.reduce(function (a, p) { return a + p.v; }, 0);
    var span = lab(pts[0].d, pts[0].d.slice(0, 4) !== pts[n - 1].d.slice(0, 4)) + ' to ' + lab(pts[n - 1].d, true);
    var cap = fig.querySelector('figcaption');
    if (cap) { cap.textContent = 'Main Page views per day, ' + lab(pts[0].d, pts[0].d.slice(0, 4) !== pts[n - 1].d.slice(0, 4)) + ' to ' + lab(pts[n - 1].d); }
    st.sum.innerHTML = '';
    var b = html('strong', null, (st.range === 'ytd' ? 'Year to date' : label) + ': ' + total.toLocaleString('en-US') + ' views');
    st.sum.appendChild(b);
    st.sum.appendChild(html('span', 'mpc-sub', ' · ' + big(total) + ' · daily average ' + Math.round(total / n).toLocaleString('en-US') + ' · ' + span + (n !== 28 && n !== 7 && n !== 14 ? ' (' + n + ' days)' : '')));
  }
  function pick(fig, st, id) {
    var r = RANGES.filter(function (x) { return x[0] === id; })[0];
    if (!r) { return; }
    var end = st.base[st.base.length - 1].d;
    function apply(pts, note) {
      st.range = id; st.pts = pts; st.sel = null;
      st.btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-r') === id ? 'true' : 'false'); });
      st.note.textContent = note || '';
      summarise(fig, st, r[1]);
      draw(fig, st);
    }
    if (id.charAt(0) === 'd' && st.base.length >= r[2]) { apply(st.base.slice(-r[2])); return; }
    var start = id === 'ytd' ? end.slice(0, 4) + '-01-01' : (id.charAt(0) === 'd' ? addDays(end, 1 - r[2]) : addDays(addMonths(end, -r[2]), 1));
    st.note.textContent = 'Loading ' + r[1].toLowerCase() + ' from the Wikimedia pageviews API…';
    st.btns.forEach(function (b) { b.disabled = true; });
    loadLong(end).then(function (data) {
      var pts = [], d = start;
      while (d <= end) {
        var v = data[d];
        if (v == null) { var bp = st.base.filter(function (p) { return p.d === d; })[0]; v = bp ? bp.v : null; }
        if (v != null) { pts.push({ d: d, v: v }); }
        d = addDays(d, 1);
      }
      st.btns.forEach(function (b) { b.disabled = false; });
      if (pts.length < 2) { throw new Error('empty'); }
      var want = Math.round((toDate(end) - toDate(start)) / 864e5) + 1;
      apply(pts, pts.length < want ? (want - pts.length) + ' day(s) in this range had no data.' : '');
    }).catch(function () {
      st.btns.forEach(function (b) { b.disabled = false; });
      apply(st.base.slice(-28), 'The longer history could not be loaded here (it comes live from the Wikimedia pageviews API). Showing the days stored in this report.');
      st.btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-r') === (st.base.length >= 28 ? 'd28' : '') ? 'true' : 'false'); });
      st.range = 'd28';
    });
  }
  function setup(fig) {
    var base = (fig.getAttribute('data-series') || '').split(';').map(function (s) {
      var p = s.split(':'); return { d: p[0], v: parseInt(p[1], 10) };
    }).filter(function (p) { return p.d && p.v > 0; });
    var host = fig.querySelector('.mpc-plot');
    if (!host || base.length < 2) { return; }
    host.removeAttribute('aria-hidden');
    var st = { base: base, pts: base.slice(-28), fit: false, sel: null, range: 'd28', btns: [] };
    var ctl = html('div', 'mpc-ranges');
    ctl.setAttribute('role', 'group');
    ctl.setAttribute('aria-label', 'Range shown');
    var gDays = html('div', 'mpc-seg'), gMon = html('div', 'mpc-seg');
    RANGES.forEach(function (r) {
      var b = html('button', 'mpc-r', r[0] === 'ytd' ? 'YTD' : r[1].replace(' days', 'd').replace(' months', 'm'));
      b.type = 'button';
      b.setAttribute('data-r', r[0]);
      b.setAttribute('aria-label', r[1]);
      b.title = r[1];
      b.setAttribute('aria-pressed', r[0] === 'd28' ? 'true' : 'false');
      b.addEventListener('click', function () { pick(fig, st, r[0]); });
      (r[0].charAt(0) === 'd' ? gDays : gMon).appendChild(b);
      st.btns.push(b);
    });
    ctl.appendChild(html('span', 'mpc-lbl', 'Days'));
    ctl.appendChild(gDays);
    ctl.appendChild(html('span', 'mpc-lbl', 'Months'));
    ctl.appendChild(gMon);
    var bar = html('div', 'mpc-bar');
    var btn = html('button', 'mpc-zoom', 'Zoom to range');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      st.fit = !st.fit;
      btn.setAttribute('aria-pressed', st.fit ? 'true' : 'false');
      btn.textContent = st.fit ? 'Start axis at 0' : 'Zoom to range';
      draw(fig, st);
    });
    bar.appendChild(btn);
    bar.appendChild(html('span', 'mpc-hint', 'Hover, tap or use the arrow keys to read a day.'));
    st.sum = html('p', 'mpc-sum');
    st.note = html('p', 'mpc-note');
    st.note.setAttribute('aria-live', 'polite');
    host.parentNode.insertBefore(ctl, host);
    host.parentNode.insertBefore(st.sum, host);
    host.parentNode.insertBefore(st.note, host);
    host.parentNode.insertBefore(bar, host);
    state.push({ fig: fig, st: st });
    if (base.length < 28) {
      st.btns.forEach(function (b) { if (b.getAttribute('data-r') === 'd28') { b.setAttribute('aria-pressed', 'false'); } });
      st.range = 'stored';
      summarise(fig, st, 'Days stored in this report');
      draw(fig, st);
      return;
    }
    summarise(fig, st, '28 days');
    draw(fig, st);
  }
  Array.prototype.forEach.call(figs, setup);
  function all() { state.forEach(function (s) { draw(s.fig, s.st); }); }
  var w = window.innerWidth, timer = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === w) { return; }
    w = window.innerWidth; clearTimeout(timer); timer = setTimeout(all, 120);
  });
})();
