// 14 · NBC BP03 — Overview  (/projects-progress/nbc-bp03/overview)
var s14 = await surfacePage('14 · NBC BP03 — Overview', { sidebar: 'none', crumb: 'Projects Progress / NBC BP03 / Overview', x: 0, y: 12740 });
var c14 = s14.col;
c14.clipsContent = true;

// project title + tabs
var nbcTitle = FR('Title', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTL = FR('tl', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var nbcIcon = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcIcon.appendChild(ICO('building', 18, CF.blueText));
nbcTL.appendChild(nbcIcon);
nbcTL.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 26, style: 'Bold', color: CF.ink, lh: 32 }));
nbcTitle.appendChild(nbcTL);
nbcTitle.appendChild(buttonPrimary('Update progress', 'plus', { h: 32 }));
c14.appendChild(nbcTitle);
c14.appendChild(spacer(1, 14));

// tabs row
var tabRow = tabList([
  { label: 'Overview', count: null },
  { label: 'Activities', count: 3 },
  { label: 'Update Progress', count: null },
  { label: 'Issues', count: 0 }
], 0, { h: 34, gap: 8 });
c14.appendChild(tabRow);
c14.appendChild(spacer(1, 22));

// 4 KPI tiles
var kpis = FR('KPIs', { dir: 'h', w: 1080, gap: 14 });
var kpiList = [
  { label: 'Overall progress', value: '43.75%', sub: 'Target 100%', tone: CF.accent },
  { label: 'Versus plan', value: '12.50% behind', sub: 'Plan: 56.25% by now', tone: CF.redText },
  { label: 'Completion deadline', value: 'Dec 31, 2026', sub: '52 days left', tone: CF.ink },
  { label: 'Weekly reporting', value: '1 of 2 handlers', sub: 'Updated this week', tone: CF.amberText }
];
kpiList.forEach(function (k) {
  var tile = FR('kpi/' + k.label, { dir: 'v', w: 259, p: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 6 });
  tile.appendChild(T(k.label, { size: 12, color: CF.sec }));
  tile.appendChild(T(k.value, { size: 22, style: 'Bold', color: k.tone, lh: 28 }));
  tile.appendChild(T(k.sub, { size: 12, color: CF.sec }));
  kpis.appendChild(tile);
});
c14.appendChild(kpis);
c14.appendChild(spacer(1, 18));

// forecast banner
var banner = FR('Forecast banner', { dir: 'h', w: 1080, p: 14, r: 8, stroke: '#D3E5EF', fill: '#F0F7FB', gap: 10, cross: 'CENTER' });
banner.appendChild(chipPill('Forecast', CF.blue, CF.blueText));
banner.appendChild(T('At the current pace of 3.25% a week, milestone target completes around mid-December 2026.', { size: 13, color: CF.body }));
c14.appendChild(banner);
c14.appendChild(spacer(1, 22));

// handler breakdown table
var hPanel = FR('Handler breakdown', { dir: 'v', w: 1080, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var hHead = FR('Head', { dir: 'h', w: 1080, h: 42, pl: 18, pr: 18, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(hHead, 'Bottom', CF.border);
hHead.appendChild(T('Handler', { size: 12, style: 'Semi Bold', color: CF.sec, w: 260 }));
hHead.appendChild(T('Assigned activities', { size: 12, style: 'Semi Bold', color: CF.sec, w: 220 }));
hHead.appendChild(T('Weighted baseline', { size: 12, style: 'Semi Bold', color: CF.sec, w: 200 }));
hHead.appendChild(T('Current progress', { size: 12, style: 'Semi Bold', color: CF.sec, w: 200 }));
hHead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 160 }));
hPanel.appendChild(hHead);

var handlers = [
  ['Sitha', '1 activity (Survey)', '25.00%', '100.00%', 'Updated', CF.green, CF.greenText],
  ['Tola', '1 activity (Install board)', '75.00%', '25.00%', 'Pending update', CF.amber, CF.amberText]
];
handlers.forEach(function (h, idx) {
  var row = FR('row/' + h[0], { dir: 'h', w: 1080, h: 52, pl: 18, pr: 18, cross: 'CENTER' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);
  var userCol = FR('user', { dir: 'h', w: 260, gap: 8, cross: 'CENTER' });
  userCol.appendChild(avatar(h[0].charAt(0), 22));
  userCol.appendChild(T(h[0], { size: 13.5, style: 'Semi Bold', color: CF.ink }));
  row.appendChild(userCol);

  row.appendChild(T(h[1], { size: 13, color: CF.body, w: 220 }));
  row.appendChild(T(h[2], { size: 13, color: CF.sec, w: 200 }));
  row.appendChild(T(h[3], { size: 13, style: 'Bold', color: CF.ink, w: 200 }));
  var stCol = FR('st', { dir: 'h', w: 160, cross: 'CENTER' });
  stCol.appendChild(chipPill(h[4], h[5], h[6]));
  row.appendChild(stCol);
  hPanel.appendChild(row);
});
c14.appendChild(hPanel);

frameLabel(s14.page, '14 · NBC BP03 — Overview — /projects-progress/nbc-bp03', 0, 12696);

return { frame: s14.frame.id, name: s14.frame.name };
