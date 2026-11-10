// M01 · Mobile — Projects Progress  (/projects-progress)
var m1 = await mobileScreen('M01 · Mobile — Projects Progress', { crumb: 'Projects Progress', tab: 'Progress', x: 0, y: 0, label: 'M01 · Progress — /projects-progress' });
var c = m1.col;

c.appendChild(T('Projects Progress', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('Project quantities & updates', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 20));

// NBC project card
var card = FR('card/NBC BP03', { dir: 'v', w: 353, p: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 12 });
var top = FR('top', { dir: 'h', w: 321, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var tile = FR('tile', { dir: 'h', w: 30, h: 30, r: 6, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
tile.appendChild(ICO('building', 16, CF.blueText));
top.appendChild(tile);
top.appendChild(T('44%', { size: 15, style: 'Bold', color: CF.accent }));
card.appendChild(top);

var info = FR('info', { dir: 'v', w: 321, gap: 3 });
info.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 14.5, style: 'Bold', color: CF.ink }));
info.appendChild(T('Interior fitout and services', { size: 12, color: CF.sec }));
card.appendChild(info);

card.appendChild(progressBar(44, { w: 321, h: 6 }));

var foot = FR('foot', { dir: 'h', w: 321, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var due = FR('due', { dir: 'h', hug: true, gap: 5, cross: 'CENTER' });
due.appendChild(ICO('flag', 12, CF.sec));
due.appendChild(T('Dec 31, 2026', { size: 11.5, color: CF.sec }));
foot.appendChild(due);
foot.appendChild(avatar('K', 18));
card.appendChild(foot);

c.appendChild(card);

return { frame: m1.frame.id, name: m1.frame.name };
