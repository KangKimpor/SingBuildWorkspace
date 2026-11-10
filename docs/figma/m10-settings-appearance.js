// M10 · Mobile — Settings Appearance  (/settings/appearance)
var m10 = await mobileScreen('M10 · Mobile — Settings', { crumb: 'Settings', tab: 'Settings', x: 0, y: 8460, label: 'M10 · Settings — /settings/appearance' });
var c = m10.col;

c.appendChild(T('Settings', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('A workspace that feels like yours.', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 16));

// section tabs
var sTabs = segmented(['Appearance', 'Account'], 0, { h: 32, w: 353 });
c.appendChild(sTabs);
c.appendChild(spacer(1, 16));

// Display card
var dCard = FR('dcard', { dir: 'h', w: 353, p: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var dText = FR('dt', { dir: 'v', hug: true, gap: 2 });
dText.appendChild(T('Reduce motion', { size: 13.5, style: 'Medium', color: CF.ink }));
dText.appendChild(T('Gentler transitions', { size: 11.5, color: CF.sec }));
dCard.appendChild(dText);
dCard.appendChild(checkbox(false, 18));
c.appendChild(dCard);
c.appendChild(spacer(1, 14));

// Calendar options card
var cCard = FR('ccard', { dir: 'v', w: 353, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var cRow1 = FR('row1', { dir: 'h', w: 353, h: 48, pl: 14, pr: 14, cross: 'CENTER', main: 'SPACE_BETWEEN' });
cRow1.appendChild(T('Week starts on', { size: 13, color: CF.ink }));
cRow1.appendChild(T('Monday ›', { size: 12.5, color: CF.sec }));
cCard.appendChild(cRow1);
BORDER(cRow1, 'Bottom', CF.borderSoft);

var cRow2 = FR('row2', { dir: 'h', w: 353, h: 48, pl: 14, pr: 14, cross: 'CENTER', main: 'SPACE_BETWEEN' });
cRow2.appendChild(T('Time format', { size: 13, color: CF.ink }));
cRow2.appendChild(T('24-hour ›', { size: 12.5, color: CF.sec }));
cCard.appendChild(cRow2);
c.appendChild(cCard);
c.appendChild(spacer(1, 14));

// Backup card
var bCard = FR('bcard', { dir: 'h', w: 353, p: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var bText = FR('bt', { dir: 'v', hug: true, gap: 2 });
bText.appendChild(T('Export backup', { size: 13.5, style: 'Medium', color: CF.ink }));
bText.appendChild(T('Save JSON workspace archive', { size: 11.5, color: CF.sec }));
bCard.appendChild(bText);
bCard.appendChild(buttonGhost('Export', 'download', { h: 30 }));
c.appendChild(bCard);

return { frame: m10.frame.id, name: m10.frame.name };
