// M03 · Mobile — NBC Update Progress  (/projects-progress/nbc-bp03/update)
var m3 = await mobileScreen('M03 · Mobile — NBC Update', { crumb: 'Update Progress', tab: 'Progress', x: 0, y: 1880, label: 'M03 · Update — /projects-progress/nbc-bp03/update' });
var c = m3.col;

c.appendChild(T('Update Progress', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('Week 46 (Nov 9 – 15, 2026)', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 16));

var form = FR('formCard', { dir: 'v', w: 353, p: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 14 });
var hRow = FR('hrow', { dir: 'h', w: 321, main: 'SPACE_BETWEEN', cross: 'CENTER' });
hRow.appendChild(T('Handler', { size: 12.5, style: 'Medium', color: CF.ink }));
hRow.appendChild(selectPill('Tola', 'user', { h: 30 }));
form.appendChild(hRow);
form.appendChild(divider(321));

var aTitle = FR('atitle', { dir: 'v', w: 321, gap: 2 });
aTitle.appendChild(T('1.6.1.2 · Install board & reinforcement', { size: 13.5, style: 'Bold', color: CF.ink }));
aTitle.appendChild(T('Baseline: 25% · Relative weight: 75%', { size: 11.5, color: CF.sec }));
form.appendChild(aTitle);

var valCol = FR('val', { dir: 'v', w: 321, gap: 6 });
valCol.appendChild(T('New progress (%)', { size: 12, style: 'Medium', color: CF.ink }));
valCol.appendChild(inputField('50', { w: 321, h: 38 }));
form.appendChild(valCol);

var noteCol = FR('note', { dir: 'v', w: 321, gap: 6 });
noteCol.appendChild(T('Site remarks', { size: 12, style: 'Medium', color: CF.ink }));
noteCol.appendChild(inputField('Frames fixed and inspected.', { w: 321, h: 38 }));
form.appendChild(noteCol);

var fBtn = FR('fbtn', { dir: 'h', w: 321, h: 38, r: 8, fill: CF.accent, main: 'CENTER', cross: 'CENTER' });
fBtn.appendChild(T('Submit update', { size: 13.5, style: 'Semi Bold', color: '#FFFFFF' }));
form.appendChild(fBtn);

c.appendChild(form);

return { frame: m3.frame.id, name: m3.frame.name };
