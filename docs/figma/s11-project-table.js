// 11 · Project — Table  (/projects/website/table)
var s11 = await surfacePage('11 · Project — Table', { sidebar: 'none', crumb: 'Projects / Website Redesign', x: 0, y: 9800 });
var c11 = s11.col;
c11.clipsContent = true;

// project header
var pHead = FR('Project heading', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitleL = FR('left', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var pTile = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pTile.appendChild(ICO('globe', 18, CF.blueText));
pTitleL.appendChild(pTile);
pTitleL.appendChild(T('Website Redesign', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
pHead.appendChild(pTitleL);
pHead.appendChild(buttonPrimary('New task', 'plus', { h: 32 }));
c11.appendChild(pHead);
c11.appendChild(spacer(1, 16));

// project toolbar
var tb11 = FR('Project toolbar', { dir: 'h', w: 1080, h: 40, cross: 'CENTER' });
var viewTabs = FR('views', { dir: 'h', hug: true, gap: 4 });
var tabAll = FR('tab/all', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, fill: CF.selected, cross: 'CENTER' });
tabAll.appendChild(ICO('table', 14, CF.accent));
tabAll.appendChild(T('All Tasks', { size: 12.5, style: 'Semi Bold', color: CF.accent }));
viewTabs.appendChild(tabAll);

var tabBoard = FR('tab/board', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, cross: 'CENTER' });
tabBoard.appendChild(ICO('kanban', 14, CF.sec));
tabBoard.appendChild(T('By Status', { size: 12.5, color: CF.sec }));
viewTabs.appendChild(tabBoard);
tb11.appendChild(viewTabs);

tb11.appendChild(growSpacer());
var tbFilter = FR('filters', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
tbFilter.appendChild(inputField('Search project tasks…', { w: 240, h: 32, icon: 'search' }));
tbFilter.appendChild(selectPill('All priorities', 'sliders', { h: 32 }));
tb11.appendChild(tbFilter);
c11.appendChild(tb11);
c11.appendChild(spacer(1, 16));

// table component
var table = FR('Task Table', { dir: 'v', w: 1080, r: 8, stroke: CF.border, clip: true, fill: '#FFFFFF' });
var thead = FR('Thead', { dir: 'h', w: 1080, h: 36, pl: 16, pr: 16, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(thead, 'Bottom', CF.border);
thead.appendChild(FR('chk', { w: 36, h: 36, main: 'CENTER', cross: 'CENTER' }));
thead.appendChild(T('Title', { size: 12, style: 'Semi Bold', color: CF.sec, w: 430 }));
thead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 150 }));
thead.appendChild(T('Priority', { size: 12, style: 'Semi Bold', color: CF.sec, w: 130 }));
thead.appendChild(T('Due date', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
thead.appendChild(T('Assignee', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
table.appendChild(thead);

var rows = [
  ['Finalize token contrasts for WCAG AA', 'Done', 'High', 'Nov 6, 2026', 'Sitha', true],
  ['Build navigation drawer gesture prototype', 'In progress', 'High', 'Nov 10, 2026', 'Kim', false],
  ['Review engineering OKR draft and capacity', 'Not started', 'Medium', 'Nov 12, 2026', 'Por', false],
  ['Export typography hierarchy tokens', 'In progress', 'Medium', 'Nov 8, 2026', 'Sitha', false],
  ['Map calendar provider requirements', 'Blocked', 'Urgent', 'Nov 8, 2026', 'Kim', false],
  ['Verify Safari glass fallback', 'Done', 'Low', 'Nov 4, 2026', 'Por', true]
];

rows.forEach(function (r, idx) {
  var row = FR('row/' + r[0], { dir: 'h', w: 1080, h: 48, pl: 16, pr: 16, cross: 'CENTER' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);

  var chkCell = FR('chkCell', { dir: 'h', w: 36, h: 48, cross: 'CENTER' });
  chkCell.appendChild(checkbox(r[5], 16));
  row.appendChild(chkCell);

  var titleCol = FR('titleCol', { dir: 'h', w: 430, cross: 'CENTER' });
  titleCol.appendChild(T(r[0], { size: 13, style: r[5] ? 'Regular' : 'Medium', color: r[5] ? CF.sec : CF.ink }));
  row.appendChild(titleCol);

  var statusCol = FR('statusCol', { dir: 'h', w: 150, cross: 'CENTER' });
  statusCol.appendChild(statusChip(r[1]));
  row.appendChild(statusCol);

  var priCol = FR('priCol', { dir: 'h', w: 130, cross: 'CENTER' });
  priCol.appendChild(priorityChip(r[2]));
  row.appendChild(priCol);

  var dateCol = FR('dateCol', { dir: 'h', w: 140, cross: 'CENTER' });
  dateCol.appendChild(T(r[3], { size: 12.5, color: CF.sec }));
  row.appendChild(dateCol);

  var assCol = FR('assCol', { dir: 'h', w: 140, gap: 6, cross: 'CENTER' });
  assCol.appendChild(avatar(r[4].charAt(0), 20));
  assCol.appendChild(T(r[4], { size: 12.5, color: CF.body }));
  row.appendChild(assCol);

  table.appendChild(row);
});
c11.appendChild(table);

frameLabel(s11.page, '11 · Project — Table — /projects/website/table', 0, 9756);

return { frame: s11.frame.id, name: s11.frame.name };
