// 15 · NBC BP03 — Activities  (/projects-progress/nbc-bp03/activities)
var s15 = await surfacePage('15 · NBC BP03 — Activities', { sidebar: 'none', crumb: 'Projects Progress / NBC BP03 / Activities', x: 0, y: 13720 });
var c15 = s15.col;
c15.clipsContent = true;

// project title
var nbcTitle15 = FR('Title', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTL15 = FR('tl', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var nbcIcon15 = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcIcon15.appendChild(ICO('building', 18, CF.blueText));
nbcTL15.appendChild(nbcIcon15);
nbcTL15.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 26, style: 'Bold', color: CF.ink, lh: 32 }));
nbcTitle15.appendChild(nbcTL15);
nbcTitle15.appendChild(buttonPrimary('Update progress', 'plus', { h: 32 }));
c15.appendChild(nbcTitle15);
c15.appendChild(spacer(1, 14));

// tabs row
var tabRow15 = tabList([
  { label: 'Overview', count: null },
  { label: 'Activities', count: 3 },
  { label: 'Update Progress', count: null },
  { label: 'Issues', count: 0 }
], 1, { h: 34, gap: 8 });
c15.appendChild(tabRow15);
c15.appendChild(spacer(1, 20));

// activities toolbar
var actTb = FR('Activities toolbar', { dir: 'h', w: 1080, h: 40, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var actTbL = FR('left', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
actTbL.appendChild(inputField('Filter WBS or activity…', { w: 260, h: 32, icon: 'search' }));
actTbL.appendChild(selectPill('All handlers', null, { h: 32 }));
actTbL.appendChild(selectPill('All locations', null, { h: 32 }));
actTb.appendChild(actTbL);
actTb.appendChild(buttonGhost('Export Excel', 'download', { h: 32 }));
c15.appendChild(actTb);
c15.appendChild(spacer(1, 16));

// WBS Table
var wbsTable = FR('WBS Table', { dir: 'v', w: 1080, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var wbsHead = FR('Head', { dir: 'h', w: 1080, h: 40, pl: 16, pr: 16, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(wbsHead, 'Bottom', CF.border);
wbsHead.appendChild(T('WBS', { size: 12, style: 'Semi Bold', color: CF.sec, w: 120 }));
wbsHead.appendChild(T('Activity Name', { size: 12, style: 'Semi Bold', color: CF.sec, w: 320 }));
wbsHead.appendChild(T('Handler', { size: 12, style: 'Semi Bold', color: CF.sec, w: 150 }));
wbsHead.appendChild(T('Rel. Weight', { size: 12, style: 'Semi Bold', color: CF.sec, w: 130 }));
wbsHead.appendChild(T('Baseline', { size: 12, style: 'Semi Bold', color: CF.sec, w: 120 }));
wbsHead.appendChild(T('Progress', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
wbsHead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 80 }));
wbsTable.appendChild(wbsHead);

var wbsRows = [
  { wbs: '1.6.1', name: 'Test area', handler: '—', weight: '100.00%', base: '43.75%', prog: '43.75%', isGroup: true },
  { wbs: '1.6.1.1', name: 'Survey and layout grid inspection', handler: 'Sitha', weight: '25.00%', base: '100.00%', prog: '100.00%', isGroup: false, status: 'Done', tone: 'success' },
  { wbs: '1.6.1.2', name: 'Install board & reinforcement', handler: 'Tola', weight: '75.00%', base: '25.00%', prog: '25.00%', isGroup: false, status: 'In progress', tone: 'primary' }
];

wbsRows.forEach(function (r, idx) {
  var row = FR('row/' + r.wbs, { dir: 'h', w: 1080, h: 48, pl: 16, pr: 16, cross: 'CENTER', fill: r.isGroup ? '#FBFBFA' : '#FFFFFF' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);

  row.appendChild(T(r.wbs, { size: 12.5, style: r.isGroup ? 'Bold' : 'Medium', color: CF.ink, w: 120 }));
  var nameCell = FR('name', { dir: 'h', w: 320, gap: 8, cross: 'CENTER' });
  if (!r.isGroup) nameCell.appendChild(spacer(14, 1));
  nameCell.appendChild(T(r.name, { size: 13, style: r.isGroup ? 'Bold' : 'Regular', color: CF.ink }));
  row.appendChild(nameCell);

  var hCell = FR('handler', { dir: 'h', w: 150, gap: 6, cross: 'CENTER' });
  if (r.handler !== '—') {
    hCell.appendChild(avatar(r.handler.charAt(0), 18));
    hCell.appendChild(T(r.handler, { size: 12.5, color: CF.body }));
  } else {
    hCell.appendChild(T('—', { size: 12.5, color: CF.muted }));
  }
  row.appendChild(hCell);

  row.appendChild(T(r.weight, { size: 12.5, color: CF.sec, w: 130 }));
  row.appendChild(T(r.base, { size: 12.5, color: CF.sec, w: 120 }));

  var pCell = FR('pCell', { dir: 'h', w: 140, gap: 8, cross: 'CENTER' });
  pCell.appendChild(progressBar(parseFloat(r.prog), { w: 60, h: 6 }));
  pCell.appendChild(T(r.prog, { size: 12.5, style: 'Semi Bold', color: CF.ink }));
  row.appendChild(pCell);

  var stCell = FR('stCell', { dir: 'h', w: 80, cross: 'CENTER' });
  if (r.status) stCell.appendChild(statusChip(r.status));
  row.appendChild(stCell);

  wbsTable.appendChild(row);
});
c15.appendChild(wbsTable);

frameLabel(s15.page, '15 · NBC BP03 — Activities — /projects-progress/nbc-bp03/activities', 0, 13676);

return { frame: s15.frame.id, name: s15.frame.name };
