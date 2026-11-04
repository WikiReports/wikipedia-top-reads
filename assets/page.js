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
   of the screen (tool/mainpage_chart.py writes the figure; the colors come from the page's theme variables). */
(function () {
  var figs = document.querySelectorAll('figure.mpchart');
  if (!figs.length) { return; }
  var NS = 'http://www.w3.org/2000/svg';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
  function lab(iso) { return ord(parseInt(iso.slice(8, 10), 10)) + ' ' + MON[parseInt(iso.slice(5, 7), 10) - 1]; }
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) { e.setAttribute(k, attrs[k]); } }
    if (text != null) { e.textContent = text; }
    return e;
  }
  function fmtM(v) { var m = v / 1e6; return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M'; }
  function niceStep(max) {
    var steps = [0.5, 1, 2, 2.5, 5, 10, 20, 50], i;
    for (i = 0; i < steps.length; i++) { if (max / (steps[i] * 1e6) <= 4) { return steps[i] * 1e6; } }
    return 50e6;
  }
  function draw(fig) {
    var host = fig.querySelector('.mpc-plot');
    var pts = (fig.getAttribute('data-series') || '').split(';').map(function (s) {
      var p = s.split(':'); return { d: p[0], v: parseInt(p[1], 10) };
    }).filter(function (p) { return p.d && p.v > 0; });
    if (!host || pts.length < 2) { return; }
    var W = Math.max(host.clientWidth, 260), H = W < 520 ? 170 : 220;
    var L = 40, R = 46, T = 14, B = 28;
    var max = Math.max.apply(null, pts.map(function (p) { return p.v; }));
    var step = niceStep(max), top = Math.ceil(max / step) * step;
    var x = function (i) { return L + (W - L - R) * i / (pts.length - 1); };
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'class': 'mpc-svg' });
    var t;
    for (t = 0; t <= top + 1; t += step) {
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), 'class': 'mpc-grid' }));
      svg.appendChild(el('text', { x: L - 6, y: y(t) + 4, 'text-anchor': 'end', 'class': 'mpc-tick' }, t === 0 ? '0' : fmtM(t)));
    }
    var every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((W - L - R) / 62))));
    pts.forEach(function (p, i) {
      if ((pts.length - 1 - i) % every === 0) {
        svg.appendChild(el('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle'), 'class': 'mpc-tick' }, lab(p.d)));
      }
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    svg.appendChild(el('path', { d: line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0).toFixed(1) + ' ' + y(0) + ' Z', 'class': 'mpc-area' }));
    svg.appendChild(el('path', { d: line, 'class': 'mpc-line' }));
    pts.forEach(function (p, i) {
      var c = el('circle', { cx: x(i), cy: y(p.v), r: i === pts.length - 1 ? 5 : 3.5, 'class': i === pts.length - 1 ? 'mpc-dot last' : 'mpc-dot' });
      c.appendChild(el('title', {}, lab(p.d) + ': ' + p.v.toLocaleString('en-US') + ' views'));
      svg.appendChild(c);
    });
    var last = pts[pts.length - 1];
    svg.appendChild(el('text', { x: x(pts.length - 1) + 9, y: y(last.v) + 4, 'class': 'mpc-val' }, fmtM(last.v)));
    host.textContent = '';
    host.appendChild(svg);
  }
  function all() { Array.prototype.forEach.call(figs, draw); }
  all();
  var w = window.innerWidth, timer = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === w) { return; }
    w = window.innerWidth; clearTimeout(timer); timer = setTimeout(all, 120);
  });
})();
