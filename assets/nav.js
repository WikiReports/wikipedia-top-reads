(function () {
  var host = document.getElementById('daynav');
  if (!host || !window.DAYS) { return; }
  var days = window.DAYS.slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  var cur = host.getAttribute('data-day');
  var i = days.map(function (x) { return x.d; }).indexOf(cur);
  var href = function (x) { return x.d + '.html'; };
  var older = i >= 0 && i < days.length - 1 ? days[i + 1] : null;
  var newer = i > 0 ? days[i - 1] : null;
  var h = '<nav class="daynav" aria-label="Report dates"><div class="dn-row">';
  h += older ? '<a class="dn-btn" href="' + href(older) + '" rel="prev"><span aria-hidden="true">←</span> Older<span class="dn-d">' + older.label + '</span></a>'
             : '<span class="dn-btn off"><span aria-hidden="true">←</span> Older</span>';
  h += '<a class="dn-btn latest" href="index.html">Latest report</a>';
  h += newer ? '<a class="dn-btn" href="' + href(newer) + '" rel="next">Newer <span aria-hidden="true">→</span><span class="dn-d">' + newer.label + '</span></a>'
             : '<span class="dn-btn off">Newer <span aria-hidden="true">→</span></span>';
  h += '</div><details class="dn-all"><summary>All reports (' + days.length + ')</summary><ol>';
  days.forEach(function (x) {
    h += '<li>' + (x.d === cur ? '<span aria-current="page">' + x.label + ' (this report)</span>' : '<a href="' + href(x) + '">' + x.label + '</a>') + '</li>';
  });
  h += '</ol></details></nav>';
  host.innerHTML = h;
})();
(function () {
  var cs = document.currentScript, s = document.createElement('script');
  s.src = (cs && cs.src ? cs.src : 'assets/nav.js').replace('nav.js', 'glossary.js');
  document.body.appendChild(s);
})();
