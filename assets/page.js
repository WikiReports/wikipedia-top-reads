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
      st.textContent = on.length === 0 ? 'Showing all 20 articles'
        : 'Showing ' + shown + ' of 20 articles: ' + on.map(function (k) { return names[k]; }).join(' and ') + ' confidence';
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
    b.innerHTML = '<span aria-hidden="true">\u2191</span> Collapse';
    b.setAttribute('aria-label', 'Collapse this article');
    b.addEventListener('click', function () {
      d.open = false;
      var s = d.querySelector('summary');
      if (s) { s.scrollIntoView({ block: 'nearest' }); s.focus({ preventScroll: true }); }
    });
    body.appendChild(b);
  });
})();
