// 05 · Trash  (/trash)
var s5 = await surfacePage('05 · Trash', { sidebar: 'none', crumb: 'Trash', x: 0, y: 3920 });
var c5 = s5.col;
s5.surface.clipsContent = true;

var th5 = FR('Trash heading', { dir: 'h', w: 1080, h: 64, gap: 16, cross: 'CENTER' });
var emblem = FR('emblem', { dir: 'h', w: 54, h: 54, r: 14, fill: CF.red, main: 'CENTER', cross: 'CENTER' });
emblem.appendChild(ICO('trash', 26, CF.redText));
th5.appendChild(emblem);
var thText = FR('heading text', { dir: 'v', w: 700, gap: 4 });
thText.appendChild(T('Trash', { size: 34, style: 'Bold', color: CF.ink, lh: 40, ls: -1.5 }));
thText.appendChild(T('Restore what you need. Let go of the rest.', { size: 14, color: CF.sec, lh: 20 }));
th5.appendChild(thText);
th5.appendChild(growSpacer());
th5.appendChild(buttonGhost('Empty Trash', 'trash', { h: 34, color: CF.redText, iconColor: CF.redText }));
c5.appendChild(th5);
c5.appendChild(spacer(1, 26));

var panel = FR('Deleted items panel', { dir: 'v', w: 1080, gap: 0, r: 12, stroke: CF.border, clip: true });
var sum = FR('summary', { dir: 'h', w: 1080, h: 46, pl: 20, pr: 20, cross: 'CENTER', fill: '#FBFBFA' });
BORDER(sum, 'Bottom', CF.border);
sum.appendChild(T('Deleted items', { size: 13, style: 'Semi Bold', color: CF.ink }));
sum.appendChild(growSpacer());
sum.appendChild(T('3 items', { size: 12.5, color: CF.sec }));
panel.appendChild(sum);

var items = [
  ['Reading list', 'Page', 'file-text'],
  ['Capture onboarding research notes', 'Task', 'circle-check'],
  ['Sprint 42 Notes', 'Page', 'file-text']
];
items.forEach(function (it, i) {
  var row = FR('trash row', { dir: 'h', w: 1080, h: 68, pl: 20, pr: 20, gap: 14, cross: 'CENTER' });
  row.appendChild(ICO(it[2], 20, CF.ter));
  var col = FR('item', { dir: 'v', w: 700, gap: 3 });
  col.appendChild(T(it[0], { size: 14, style: 'Semi Bold', color: CF.ink, lh: 19 }));
  col.appendChild(T(it[1], { size: 12, color: CF.sec, lh: 16 }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(buttonGhost('Restore', 'rotate-ccw', { h: 30 }));
  panel.appendChild(row);
  if (i < items.length - 1) {
    var rl = FR('rule', { w: 1080, h: 1, fill: CF.borderSoft });
    panel.appendChild(rl);
  }
});
c5.appendChild(panel);
c5.appendChild(spacer(1, 18));
c5.appendChild(T('Items stay here until you empty Trash. Permanently deleted items can’t be recovered.', { size: 12.5, color: CF.sec }));

frameLabel(s5.page, '05 · Trash — /trash', 0, 3876);

return { frame: s5.frame.id, name: s5.frame.name, rows: items.length };
