/* Display settings: light/dark mode and color themes.
   Loaded in <head> so the saved choice is applied before the page paints. The choice is kept in
   this browser only (localStorage). CSS for the themes is at the end of style.css. */
(function () {
  var KEY_MODE = 'wtr-mode', KEY_PAL = 'wtr-palette';
  var MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  // id, label, swatch accent, swatch background (light-mode colors, only used for the little swatches)
  var PALETTES = [
    ['ocean', 'Ocean', '#1A4B9C', '#F4F6FA'],
    ['forest', 'Forest', '#1B6B3A', '#F2F7F3'],
    ['sunset', 'Sunset', '#B3430F', '#FBF5F0'],
    ['violet', 'Violet', '#6A3FB5', '#F6F3FB'],
    ['rose', 'Rose', '#B02358', '#FBF3F6'],
    ['contrast', 'High contrast', '#0033CC', '#FFFFFF']
  ];
  var root = document.documentElement;

  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: choice lasts for this page view only */ } }
  function valid(list, v) { return list.some(function (x) { return x[0] === v; }); }

  var mode = get(KEY_MODE); if (!valid(MODES, mode)) { mode = 'auto'; }
  var pal = get(KEY_PAL); if (!valid(PALETTES, pal)) { pal = 'ocean'; }

  function apply() {
    if (mode === 'auto') { root.removeAttribute('data-theme'); } else { root.setAttribute('data-theme', mode); }
    if (pal === 'ocean') { root.removeAttribute('data-palette'); } else { root.setAttribute('data-palette', pal); }
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
    h += '</div></fieldset><fieldset class="disp-set"><legend>Color theme</legend><div class="disp-pals">';
    PALETTES.forEach(function (p) {
      h += '<label class="disp-opt pal"><input type="radio" name="wtr-palette" value="' + p[0] + '">' +
        '<span><i class="disp-sw" style="background:linear-gradient(135deg,' + p[2] + ' 50%,' + p[3] + ' 50%)" aria-hidden="true"></i>' + p[1] + '</span></label>';
    });
    h += '</div></fieldset><p class="disp-note">Auto follows your device. Saved in this browser only.</p></div>';
    wrap.innerHTML = h;
    document.body.appendChild(wrap);

    var btn = wrap.querySelector('#dispBtn'), panel = wrap.querySelector('#dispPanel');
    function sync() {
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="wtr-mode"]'), function (i) { i.checked = i.value === mode; });
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="wtr-palette"]'), function (i) { i.checked = i.value === pal; });
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
      if (e.key !== KEY_MODE && e.key !== KEY_PAL) { return; }
      var m = get(KEY_MODE), p = get(KEY_PAL);
      mode = valid(MODES, m) ? m : 'auto';
      pal = valid(PALETTES, p) ? p : 'ocean';
      apply(); sync();
    });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }
})();
