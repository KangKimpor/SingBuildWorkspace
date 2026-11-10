// 18 · Settings — Appearance  (/settings/appearance)
var s18 = await surfacePage('18 · Settings — Appearance', { sidebar: 'none', crumb: 'Settings / Appearance', x: 0, y: 16660 });
var c18 = s18.col;
c18.clipsContent = true;

// page heading
var setHead18 = FR('Heading', { dir: 'v', w: 1080, gap: 6 });
setHead18.appendChild(T('Settings', { size: 36, style: 'Bold', color: CF.ink, lh: 42, ls: -1.5 }));
setHead18.appendChild(T('A workspace that feels like yours.', { size: 14.5, color: CF.sec, lh: 20 }));
c18.appendChild(setHead18);
c18.appendChild(spacer(1, 24));

// settings layout: 2-column (nav 240, content 800)
var sLayout18 = FR('Settings layout', { dir: 'h', w: 1080, gap: 32 });

// nav column
var sNav18 = FR('Settings nav', { dir: 'v', w: 220, gap: 4 });
var navIt1 = FR('item/appearance', { dir: 'h', w: 220, h: 36, pl: 10, pr: 10, r: 6, fill: CF.selected, cross: 'CENTER', gap: 8 });
navIt1.appendChild(ICO('monitor', 16, CF.accent));
navIt1.appendChild(T('Appearance', { size: 13, style: 'Semi Bold', color: CF.accent }));
navIt1.appendChild(growSpacer());
navIt1.appendChild(ICO('chevron-right', 14, CF.accent));
sNav18.appendChild(navIt1);

var navIt2 = FR('item/account', { dir: 'h', w: 220, h: 36, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 8 });
navIt2.appendChild(ICO('user', 16, CF.sec));
navIt2.appendChild(T('Account & sync', { size: 13, color: CF.body }));
navIt2.appendChild(growSpacer());
navIt2.appendChild(ICO('chevron-right', 14, CF.sec));
sNav18.appendChild(navIt2);
sLayout18.appendChild(sNav18);

// content column
var sCont18 = FR('Settings content', { dir: 'v', w: 828, gap: 24 });
var cHead18 = FR('chead', { dir: 'v', w: 828, gap: 4 });
cHead18.appendChild(T('Appearance', { size: 20, style: 'Bold', color: CF.ink }));
cHead18.appendChild(T('Make yourself at home.', { size: 13, color: CF.sec }));
sCont18.appendChild(cHead18);
sCont18.appendChild(divider(828));

// section 1: Display
var sec1 = FR('sec/display', { dir: 'v', w: 828, gap: 10 });
sec1.appendChild(T('Display', { size: 14, style: 'Semi Bold', color: CF.ink }));
var card1 = FR('card', { dir: 'h', w: 828, h: 64, pl: 16, pr: 16, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var card1L = FR('left', { dir: 'v', hug: true, gap: 2 });
card1L.appendChild(T('Reduce motion', { size: 13.5, style: 'Medium', color: CF.ink }));
card1L.appendChild(T('Gentler animations and simpler transitions across the app.', { size: 12, color: CF.sec }));
card1.appendChild(card1L);
card1.appendChild(checkbox(false, 18));
sec1.appendChild(card1);
sCont18.appendChild(sec1);

// section 2: Calendar display
var sec2 = FR('sec/calendar', { dir: 'v', w: 828, gap: 10 });
sec2.appendChild(T('Calendar display', { size: 14, style: 'Semi Bold', color: CF.ink }));
var card2 = FR('card', { dir: 'v', w: 828, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });

var row2A = FR('rowA', { dir: 'h', w: 828, h: 54, pl: 16, pr: 16, cross: 'CENTER', main: 'SPACE_BETWEEN' });
row2A.appendChild(T('Week start day', { size: 13, color: CF.body }));
row2A.appendChild(selectPill('Monday', null, { h: 32 }));
card2.appendChild(row2A);
BORDER(row2A, 'Bottom', CF.borderSoft);

var row2B = FR('rowB', { dir: 'h', w: 828, h: 54, pl: 16, pr: 16, cross: 'CENTER', main: 'SPACE_BETWEEN' });
row2B.appendChild(T('Time format', { size: 13, color: CF.body }));
row2B.appendChild(selectPill('24-hour (14:00)', null, { h: 32 }));
card2.appendChild(row2B);
sec2.appendChild(card2);
sCont18.appendChild(sec2);

// section 3: Storage
var sec3 = FR('sec/storage', { dir: 'v', w: 828, gap: 10 });
sec3.appendChild(T('Data & storage', { size: 14, style: 'Semi Bold', color: CF.ink }));
var card3 = FR('card', { dir: 'h', w: 828, h: 64, pl: 16, pr: 16, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var card3L = FR('left', { dir: 'v', hug: true, gap: 2 });
card3L.appendChild(T('Export workspace backup', { size: 13.5, style: 'Medium', color: CF.ink }));
card3L.appendChild(T('Save all pages, projects, and tasks to a JSON archive.', { size: 12, color: CF.sec }));
card3.appendChild(card3L);
card3.appendChild(buttonGhost('Export archive', 'download', { h: 32 }));
sec3.appendChild(card3);
sCont18.appendChild(sec3);

sLayout18.appendChild(sCont18);
c18.appendChild(sLayout18);

frameLabel(s18.page, '18 · Settings — Appearance — /settings/appearance', 0, 16616);

return { frame: s18.frame.id, name: s18.frame.name };
