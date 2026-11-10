// 13 · Project — Progress  (/projects-progress)
var s13 = await surfacePage('13 · Project — Progress', { sidebar: 'none', crumb: 'Projects Progress', x: 0, y: 11760 });
var c13 = s13.col;
c13.clipsContent = true;

// heading
var head13 = FR('Heading', { dir: 'v', w: 1080, gap: 6 });
head13.appendChild(T('Projects Progress', { size: 36, style: 'Bold', color: CF.ink, lh: 42, ls: -1.5 }));
head13.appendChild(T('Project quantities, progress updates and reporting.', { size: 14.5, color: CF.sec, lh: 20 }));
c13.appendChild(head13);
c13.appendChild(spacer(1, 28));

// projects grid
var progGrid = FR('Progress grid', { dir: 'h', w: 1080, gap: 16 });

var nbcCard = FR('card/NBC BP03', { dir: 'v', w: 340, p: 20, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 14 });
var nbcTop = FR('top', { dir: 'h', w: 300, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTile = FR('tile', { dir: 'h', w: 32, h: 32, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcTile.appendChild(ICO('building', 18, CF.blueText));
nbcTop.appendChild(nbcTile);
nbcTop.appendChild(T('44%', { size: 16, style: 'Bold', color: CF.accent }));
nbcCard.appendChild(nbcTop);

var nbcInfo = FR('info', { dir: 'v', w: 300, gap: 4 });
nbcInfo.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 15, style: 'Bold', color: CF.ink, lh: 20 }));
nbcInfo.appendChild(T('Synthetic test project — Structural & architectural interior fitout.', { size: 12.5, color: CF.sec, lh: 17 }));
nbcCard.appendChild(nbcInfo);

// progress bar
var progWrap = FR('progWrap', { dir: 'v', w: 300, gap: 6 });
progWrap.appendChild(progressBar(44, { w: 300, h: 6 }));
nbcCard.appendChild(progWrap);

var nbcFoot = FR('foot', { dir: 'h', w: 300, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcDue = FR('due', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
nbcDue.appendChild(ICO('flag', 13, CF.sec));
nbcDue.appendChild(T('Dec 31, 2026', { size: 12, color: CF.sec }));
nbcFoot.appendChild(nbcDue);
nbcFoot.appendChild(avatar('K', 20));
nbcCard.appendChild(nbcFoot);

progGrid.appendChild(nbcCard);
c13.appendChild(progGrid);

frameLabel(s13.page, '13 · Project — Progress — /projects-progress', 0, 11716);

return { frame: s13.frame.id, name: s13.frame.name };
