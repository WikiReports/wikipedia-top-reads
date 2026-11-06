/* Display settings: light/dark mode and color themes.
   Loaded in <head> so the saved choice is applied before the page paints. The choice is kept in
   this browser only (localStorage). CSS for the themes is at the end of style.css. */
(function () {
  var KEY_MODE = 'wtr-mode', KEY_PAL = 'wtr-palette', KEY_PAPER = 'wtr-paper';
  var PAPERS = [['off', 'Plain'], ['on', 'Paper']];
  var MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  // id, label, swatch accent, swatch background (light-mode colors, only used for the little swatches)
  var PALETTES = [
    ['contrast', 'Contrast', '#0033CC', '#FFFFFF'],
    ['ocean', 'Ocean', '#1A4B9C', '#F4F6FA'],
    ['pink', 'Pink', '#B3125B', '#FEF2F8'],
    ['violet', 'Violet', '#6A3FB5', '#F6F3FB'],
    ['crimson', 'Crimson', '#A61B1B', '#FBF3F2'],
    ['graphite', 'Graphite', '#374151', '#F3F4F6']
  ];
  var root = document.documentElement;

  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: choice lasts for this page view only */ } }
  function valid(list, v) { return list.some(function (x) { return x[0] === v; }); }

  var mode = get(KEY_MODE); if (!valid(MODES, mode)) { mode = 'auto'; }
  var pal = get(KEY_PAL); if (!valid(PALETTES, pal)) { pal = 'ocean'; }
  var paper = get(KEY_PAPER); if (!valid(PAPERS, paper)) { paper = 'off'; }

  function apply() {
    if (mode === 'auto') { root.removeAttribute('data-theme'); } else { root.setAttribute('data-theme', mode); }
    if (pal === 'ocean') { root.removeAttribute('data-palette'); } else { root.setAttribute('data-palette', pal); }
    if (paper === 'on') { root.setAttribute('data-paper', 'on'); } else { root.removeAttribute('data-paper'); }
  }
  apply();

  function build() {
    if (document.getElementById('disp')) { return; }
    var wrap = document.createElement('div');
    wrap.id = 'disp';
    wrap.className = 'disp';

    var h = '<button type="button" class="disp-btn" id="dispBtn" aria-expanded="false" aria-controls="dispPanel">' +
      '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>' +
      '<span>Display</span></button>' +
      '<div class="disp-panel" id="dispPanel" role="group" aria-label="Display settings" hidden>' +
      '<fieldset class="disp-set"><legend>Mode</legend><div class="disp-modes">';
    MODES.forEach(function (m) {
      h += '<label class="disp-opt"><input type="radio" name="wtr-mode" value="' + m[0] + '"><span>' + m[1] + '</span></label>';
    });
    h += '</div></fieldset><fieldset class="disp-set"><legend>Background</legend><div class="disp-bgs">';
    PAPERS.forEach(function (b) {
      h += '<label class="disp-opt"><input type="radio" name="wtr-paper" value="' + b[0] + '"><span>' + b[1] + '</span></label>';
    });
    h += '</div></fieldset><fieldset class="disp-set"><legend>Color theme</legend><div class="disp-pals">';
    PALETTES.forEach(function (p) {
      h += '<label class="disp-opt pal"><input type="radio" name="wtr-palette" value="' + p[0] + '">' +
        '<span><i class="disp-sw" style="background:linear-gradient(135deg,' + p[2] + ' 50%,' + p[3] + ' 50%)" aria-hidden="true"></i>' + p[1] + '</span></label>';
    });
    h += '</div></fieldset><p class="disp-note">Auto follows your device. Paper works in Auto, Light and Dark. Saved in this browser only.</p></div>';
    wrap.innerHTML = h;
    document.body.appendChild(wrap);

    // Back-to-top button (arrow only), shown after the reader has scrolled down a little.
    if (!document.getElementById('toTop')) {
      var up = document.createElement('button');
      up.type = 'button'; up.id = 'toTop'; up.className = 'to-top'; up.hidden = true;
      up.setAttribute('aria-label', 'Back to top');
      up.innerHTML = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
      document.body.appendChild(up);
      var showUp = function () { up.hidden = (window.pageYOffset || document.documentElement.scrollTop || 0) < 400; };
      window.addEventListener('scroll', showUp, { passive: true });
      showUp();
      up.addEventListener('click', function () {
        var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
      });
    }

    var btn = wrap.querySelector('#dispBtn'), panel = wrap.querySelector('#dispPanel');
    function sync() {
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="wtr-mode"]'), function (i) { i.checked = i.value === mode; });
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="wtr-palette"]'), function (i) { i.checked = i.value === pal; });
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="wtr-paper"]'), function (i) { i.checked = i.value === paper; });
    }
    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    sync();
    btn.addEventListener('click', function () { setOpen(panel.hidden); });
    wrap.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.type !== 'radio') { return; }
      if (t.name === 'wtr-mode') { mode = t.value; put(KEY_MODE, mode); }
      if (t.name === 'wtr-palette') { pal = t.value; put(KEY_PAL, pal); }
      if (t.name === 'wtr-paper') { paper = t.value; put(KEY_PAPER, paper); }
      apply();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) { setOpen(false); }
    });
    // Keep several open tabs in step.
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY_MODE && e.key !== KEY_PAL && e.key !== KEY_PAPER) { return; }
      var m = get(KEY_MODE), p = get(KEY_PAL), q = get(KEY_PAPER);
      mode = valid(MODES, m) ? m : 'auto';
      pal = valid(PALETTES, p) ? p : 'ocean';
      paper = valid(PAPERS, q) ? q : 'off';
      apply(); sync();
    });
  }

  // The date bar's "All reports" list (a <details> drawn by nav.js) closes on Escape or a click elsewhere.
  document.addEventListener('click', function (e) {
    var d = document.querySelector('details.dn-all[open]');
    if (d && !d.contains(e.target)) { d.open = false; }
  });
  document.addEventListener('keydown', function (e) {
    var d = document.querySelector('details.dn-all[open]');
    if (d && e.key === 'Escape') { d.open = false; var s = d.querySelector('summary'); if (s) { s.focus(); } }
  });

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }
})();
