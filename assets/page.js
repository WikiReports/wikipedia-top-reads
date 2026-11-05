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
  document.querySelectorAll('.jump a, table.glance a').forEach(function (a) {
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
   Reading a day: hover, tap or drag on the chart, or focus it and use the arrow keys, Home, End and Escape. Weekends are shaded,
   every day has a tick, and a button switches the axis between "from 0" and "zoom to the range". */
(function () {
  var figs = document.querySelectorAll('figure.mpchart');
  if (!figs.length) { return; }
  var NS = 'http://www.w3.org/2000/svg';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
  function lab(iso) { return ord(parseInt(iso.slice(8, 10), 10)) + ' ' + MON[parseInt(iso.slice(5, 7), 10) - 1]; }
  function dow(iso) { return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay(); }
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
  function niceStep(range) {
    var steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 50], i;
    for (i = 0; i < steps.length; i++) { if (range / (steps[i] * 1e6) <= 5) { return Math.round(steps[i] * 1e6); } }
    return 50e6;
  }
  function pct(a, b) {
    var d = (a - b) / b * 100;
    return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '%';
  }
  var state = [];
  function draw(fig, st) {
    var host = fig.querySelector('.mpc-plot');
    var pts = st.pts;
    if (!host || pts.length < 2) { return; }
    var n = pts.length;
    var W = Math.max(host.clientWidth, 260), H = W < 520 ? 200 : (W > 900 ? 290 : 250);
    var L = 52, R = 46, T = 14, B = 42;
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
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'class': 'mpc-svg', role: 'group', tabindex: '0',
      'aria-label': 'Main Page views per day. Use the left and right arrow keys to read each day.' });
    var i, k, cnt = Math.round((hi - lo) / step);
    pts.forEach(function (p, j) {
      var w = dow(p.d);
      if (w === 0 || w === 6) {
        var x0 = Math.max(L, x(j) - dx / 2), x1 = Math.min(W - R, x(j) + dx / 2);
        svg.appendChild(el('rect', { x: x0, y: T, width: x1 - x0, height: H - T - B, 'class': 'mpc-wkend' }));
      }
    });
    for (k = 0; k <= cnt; k++) {
      var t = lo + k * step;
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), 'class': 'mpc-grid' }));
      svg.appendChild(el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end', 'class': 'mpc-tick' }, (t === 0 && !st.fit) ? '0' : fmtM(t, step)));
    }
    var every = Math.max(1, Math.ceil(58 / dx));
    pts.forEach(function (p, j) {
      svg.appendChild(el('line', { x1: x(j), x2: x(j), y1: H - B, y2: H - B + 4, 'class': 'mpc-xtick' }));
      if ((n - 1 - j) % every === 0) {
        var anchor = 'middle';
        svg.appendChild(el('text', { x: x(j), y: H - B + 18, 'text-anchor': anchor, 'class': 'mpc-tick' }, lab(p.d)));
        svg.appendChild(el('text', { x: x(j), y: H - B + 33, 'text-anchor': anchor, 'class': 'mpc-tick mpc-dow' }, DOW[dow(p.d)].slice(0, 3)));
      }
    });
    var line = pts.map(function (p, j) { return (j ? 'L' : 'M') + x(j).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    svg.appendChild(el('path', { d: line + ' L' + x(n - 1).toFixed(1) + ' ' + y(lo) + ' L' + x(0).toFixed(1) + ' ' + y(lo) + ' Z', 'class': 'mpc-area' }));
    svg.appendChild(el('path', { d: line, 'class': 'mpc-line' }));
    var cross = el('line', { x1: 0, x2: 0, y1: T, y2: H - B, 'class': 'mpc-cross', visibility: 'hidden' });
    svg.appendChild(cross);
    pts.forEach(function (p, j) {
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
      tDay.textContent = DOW[dow(p.d)] + ' ' + lab(p.d);
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
      if (key === 'ArrowLeft') { j -= 1; } else if (key === 'ArrowRight') { j += 1; }
      else if (key === 'Home') { j = 0; } else if (key === 'End') { j = n - 1; }
      else if (key === 'Escape') { clear(); return; } else { return; }
      e.preventDefault();
      show(j, true);
    });
    if (st.sel != null) { show(st.sel, false); }
  }
  function setup(fig) {
    var pts = (fig.getAttribute('data-series') || '').split(';').map(function (s) {
      var p = s.split(':'); return { d: p[0], v: parseInt(p[1], 10) };
    }).filter(function (p) { return p.d && p.v > 0; });
    var host = fig.querySelector('.mpc-plot');
    if (!host || pts.length < 2) { return; }
    host.removeAttribute('aria-hidden');
    var st = { pts: pts, fit: false, sel: null };
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
    bar.appendChild(html('span', 'mpc-hint', 'Hover, tap or use the arrow keys to read a day. Shaded columns are weekends.'));
    host.parentNode.insertBefore(bar, host);
    state.push({ fig: fig, st: st });
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
