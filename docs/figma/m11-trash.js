// M11 · Mobile — Trash  (/trash)
var m11 = await mobileScreen('M11 · Mobile — Trash', { crumb: 'Trash', tab: 'Workspace', x: 0, y: 9400, label: 'M11 · Trash — /trash' });
var c = m11.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('Trash', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
head.appendChild(buttonGhost('Empty', 'trash', { h: 28, color: CF.redText, iconColor: CF.redText }));
c.appendChild(head);
c.appendChild(spacer(1, 4));
c.appendChild(T('3 items · Deleted pages and tasks', { size: 12.5, color: CF.sec }));
c.appendChild(spacer(1, 16));

var tPanel = FR('tpanel', { dir: 'v', w: 353, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var items = [
  ['Reading list', 'Page · Deleted today', 'file-text'],
  ['Capture onboarding research notes', 'Task · Deleted Nov 6', 'circle-check'],
  ['Sprint 42 Notes', 'Page · Deleted Nov 4', 'file-text']
];

items.forEach(function (it, idx) {
  var row = FR('row/' + it[0], { dir: 'h', w: 353, p: 12, cross: 'CENTER', gap: 10 });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);
  row.appendChild(ICO(it[2], 18, CF.ter));
  var col = FR('col', { dir: 'v', w: 230, gap: 2 });
  col.appendChild(T(it[0], { size: 13, style: 'Semi Bold', color: CF.ink }));
  col.appendChild(T(it[1], { size: 11, color: CF.sec }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(buttonGhost('', 'rotate-ccw', { h: 28, w: 28 }));
  tPanel.appendChild(row);
});
c.appendChild(tPanel);
c.appendChild(spacer(1, 14));
c.appendChild(T('Items stay here until you empty Trash.', { size: 11.5, color: CF.sec }));

return { frame: m11.frame.id, name: m11.frame.name };
