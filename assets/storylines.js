(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('details.sl'));
  var btns = Array.prototype.slice.call(document.querySelectorAll('.sfbtn'));
  var clr = document.getElementById('sClear'), st = document.getElementById('sStatus'), q = document.getElementById('sSearch');
  var active = {};
  var openFor = function (id) { var el = id && document.getElementById(id); if (el && el.tagName === 'DETAILS') { el.open = true; el.hidden = false; } };
  var apply = function () {
    var on = Object.keys(active).filter(function (k) { return active[k]; });
    var text = (q && q.value || '').trim().toLowerCase(), shown = 0;
    var flt = document.querySelector('.filter'), before = flt ? flt.getBoundingClientRect().top : 0;
    cards.forEach(function (c) {
      var ok = (on.length === 0 || on.indexOf(c.getAttribute('data-status')) !== -1) && (!text || c.getAttribute('data-q').indexOf(text) !== -1);
      c.hidden = !ok; if (ok) { shown++; }
    });
    btns.forEach(function (b) { b.setAttribute('aria-pressed', active[b.getAttribute('data-status')] ? 'true' : 'false'); });
    if (clr) { clr.hidden = on.length === 0; }
    if (st) { st.textContent = (on.length === 0 && !text) ? 'Showing all ' + cards.length + ' storylines' : 'Showing ' + shown + ' of ' + cards.length + ' storylines'; }
    if (flt) { var delta = flt.getBoundingClientRect().top - before; if (delta) { window.scrollBy(0, delta); } }
  };
  btns.forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-status'); active[k] = !active[k]; apply(); }); });
  if (clr) { clr.addEventListener('click', function () { active = {}; apply(); }); }
  if (q) { q.addEventListener('input', apply); }
  var ex = document.getElementById('sExpand'), co = document.getElementById('sCollapse');
  if (ex) { ex.addEventListener('click', function () { cards.forEach(function (c) { if (!c.hidden) { c.open = true; } }); }); }
  if (co) { co.addEventListener('click', function () { cards.forEach(function (c) { c.open = false; }); }); }
  document.querySelectorAll('.glist a.chip').forEach(function (a) {
    a.addEventListener('click', function () { var id = (a.getAttribute('href') || '').slice(1); active = {}; if (q) { q.value = ''; } apply(); openFor(id); });
  });
  openFor(location.hash.slice(1));
  window.addEventListener('hashchange', function () { openFor(location.hash.slice(1)); });
})();
