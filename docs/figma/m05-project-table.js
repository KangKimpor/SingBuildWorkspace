// M05 · Mobile — Project Table  (/projects/website/table)
var m5 = await mobileScreen('M05 · Mobile — Project Table', { crumb: 'Website Redesign', tab: 'Workspace', x: 0, y: 3760, label: 'M05 · Table — /projects/website/table' });
var c = m5.col;

var pHead = FR('phead', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitle = FR('ptitle', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
var pIcon = FR('picon', { dir: 'h', w: 26, h: 26, r: 6, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pIcon.appendChild(ICO('globe', 14, CF.blueText));
pTitle.appendChild(pIcon);
pTitle.appendChild(T('Website Redesign', { size: 18, style: 'Bold', color: CF.ink }));
pHead.appendChild(pTitle);
pHead.appendChild(buttonPrimary('New', 'plus', { h: 28 }));
c.appendChild(pHead);
c.appendChild(spacer(1, 14));

var tbRow = FR('tbrow', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
tbRow.appendChild(selectPill('All Tasks', 'table', { h: 30 }));
tbRow.appendChild(selectPill('Filter', 'sliders', { h: 30 }));
c.appendChild(tbRow);
c.appendChild(spacer(1, 14));

var tRows = [
  { title: 'Finalize token contrasts for WCAG AA', pri: 'High', due: 'Nov 6', done: true },
  { title: 'Build navigation drawer gesture prototype', pri: 'High', due: 'Nov 10', done: false },
  { title: 'Review engineering OKR draft', pri: 'Medium', due: 'Nov 12', done: false },
  { title: 'Export typography hierarchy tokens', pri: 'Medium', due: 'Nov 8', done: false },
  { title: 'Map calendar provider requirements', pri: 'Urgent', due: 'Nov 8', done: false }
];

tRows.forEach(function (t) {
  var row = FR('row/' + t.title, { dir: 'h', w: 353, p: 12, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 10, cross: 'CENTER' });
  row.appendChild(checkbox(t.done, 16));
  var col = FR('col', { dir: 'v', w: 230, gap: 2 });
  col.appendChild(T(t.title, { size: 12.5, style: t.done ? 'Regular' : 'Medium', color: t.done ? CF.sec : CF.ink }));
  col.appendChild(T('Due ' + t.due, { size: 11, color: CF.sec }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(priorityChip(t.pri));
  c.appendChild(row);
  c.appendChild(spacer(1, 8));
});

return { frame: m5.frame.id, name: m5.frame.name };
