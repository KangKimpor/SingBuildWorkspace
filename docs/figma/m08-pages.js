// M08 · Mobile — Pages  (/p/weekly-plan)
var m8 = await mobileScreen('M08 · Mobile — Page Editor', { crumb: 'Weekly plan', tab: 'Workspace', x: 0, y: 6580, label: 'M08 · Pages — /p/weekly-plan' });
var c = m8.col;

var pIcon = FR('picon', { dir: 'h', w: 32, h: 32, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pIcon.appendChild(ICO('star', 16, CF.blueText));
c.appendChild(pIcon);
c.appendChild(spacer(1, 10));

c.appendChild(T('Weekly plan', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('Inside Workspace · Edited today', { size: 12, color: CF.sec }));
c.appendChild(spacer(1, 16));
c.appendChild(divider(353));
c.appendChild(spacer(1, 16));

// block note content
c.appendChild(T('Sprint Priorities', { size: 16, style: 'Bold', color: CF.ink }));
c.appendChild(spacer(1, 8));
c.appendChild(T('Align on the mobile responsive navigation patterns and verify glass blur fallback on WebKit engines.', { size: 13, color: CF.body, lh: 19 }));
c.appendChild(spacer(1, 14));

var checkList = FR('checks', { dir: 'v', w: 353, gap: 8 });
var cItems = [
  ['Validate offline synchronization in IndexedDB', true],
  ['Audit WCAG AA color contrast across theme tokens', false],
  ['Prepare weekly progress report for Pan Pacific project', false]
];

cItems.forEach(function (ci) {
  var row = FR('checkRow', { dir: 'h', w: 353, gap: 10, cross: 'CENTER' });
  row.appendChild(checkbox(ci[1], 16));
  row.appendChild(T(ci[0], { size: 13, color: ci[1] ? CF.sec : CF.ink, style: ci[1] ? 'Regular' : 'Medium' }));
  checkList.appendChild(row);
});
c.appendChild(checkList);

return { frame: m8.frame.id, name: m8.frame.name };
