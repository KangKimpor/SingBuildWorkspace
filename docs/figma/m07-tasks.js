// M07 · Mobile — My Tasks  (/tasks)
var m7 = await mobileScreen('M07 · Mobile — Tasks', { crumb: 'My tasks', tab: 'Workspace', x: 0, y: 5640, label: 'M07 · Tasks — /tasks' });
var c = m7.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('My tasks', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
head.appendChild(buttonPrimary('New', 'plus', { h: 32 }));
c.appendChild(head);
c.appendChild(spacer(1, 14));

c.appendChild(inputField('Search your tasks…', { w: 353, h: 36, icon: 'search' }));
c.appendChild(spacer(1, 16));

// overdue section
var oSec = FR('oSec', { dir: 'v', w: 353, p: 12, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 10 });
var oHead = FR('oHead', { dir: 'h', w: 329, main: 'SPACE_BETWEEN', cross: 'CENTER' });
oHead.appendChild(T('Overdue (2)', { size: 13, style: 'Bold', color: CF.redText }));
oSec.appendChild(oHead);

var oTasks = [
  { title: 'Map calendar provider requirements', proj: 'Website Redesign', pri: 'Urgent' },
  { title: 'Finalize token contrasts for WCAG AA', proj: 'Website Redesign', pri: 'High' }
];

oTasks.forEach(function (t) {
  var tRow = FR('trow', { dir: 'h', w: 329, p: 8, r: 6, fill: '#FFF8F7', stroke: '#FDDCD7', gap: 10, cross: 'CENTER' });
  tRow.appendChild(checkbox(false, 16));
  var col = FR('col', { dir: 'v', w: 220, gap: 2 });
  col.appendChild(T(t.title, { size: 12.5, style: 'Medium', color: CF.ink }));
  col.appendChild(T(t.proj, { size: 11, color: CF.sec }));
  tRow.appendChild(col);
  tRow.appendChild(growSpacer());
  tRow.appendChild(priorityChip(t.pri));
  oSec.appendChild(tRow);
});
c.appendChild(oSec);
c.appendChild(spacer(1, 14));

// today section
var tSec = FR('tSec', { dir: 'v', w: 353, p: 12, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 10 });
tSec.appendChild(T('Today (1)', { size: 13, style: 'Bold', color: CF.ink }));
var tRow1 = FR('trow1', { dir: 'h', w: 329, p: 8, r: 6, fill: '#FAFAF9', gap: 10, cross: 'CENTER' });
tRow1.appendChild(checkbox(false, 16));
var col1 = FR('col1', { dir: 'v', w: 220, gap: 2 });
col1.appendChild(T('Engineering Standup', { size: 12.5, style: 'Medium', color: CF.ink }));
col1.appendChild(T('09:00 – 10:00 · Team', { size: 11, color: CF.sec }));
tRow1.appendChild(col1);
tRow1.appendChild(growSpacer());
tRow1.appendChild(statusChip('In progress'));
tSec.appendChild(tRow1);
c.appendChild(tSec);

return { frame: m7.frame.id, name: m7.frame.name };
