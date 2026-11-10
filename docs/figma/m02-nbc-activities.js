// M02 · Mobile — NBC BP03 Activities  (/projects-progress/nbc-bp03/activities)
var m2 = await mobileScreen('M02 · Mobile — NBC Activities', { crumb: 'NBC BP03 Activities', tab: 'Progress', x: 0, y: 940, label: 'M02 · Activities — /projects-progress/nbc-bp03/activities' });
var c = m2.col;

c.appendChild(T('Activities', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('WBS breakdown & progress status', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 16));

c.appendChild(inputField('Filter activities…', { w: 353, h: 36, icon: 'search' }));
c.appendChild(spacer(1, 14));

var actList = FR('actList', { dir: 'v', w: 353, gap: 10 });
var acts = [
  { wbs: '1.6.1.1', name: 'Survey and layout grid', handler: 'Sitha', prog: 100, st: 'Done', tone: 'success' },
  { wbs: '1.6.1.2', name: 'Install board & reinforcement', handler: 'Tola', prog: 25, st: 'In progress', tone: 'primary' }
];

acts.forEach(function (a) {
  var aCard = FR('card/' + a.wbs, { dir: 'v', w: 353, p: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 8 });
  var aTop = FR('top', { dir: 'h', w: 325, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  aTop.appendChild(T(a.wbs + ' · ' + a.handler, { size: 11.5, style: 'Semi Bold', color: CF.sec }));
  aTop.appendChild(statusChip(a.st));
  aCard.appendChild(aTop);

  aCard.appendChild(T(a.name, { size: 13.5, style: 'Bold', color: CF.ink }));
  aCard.appendChild(progressBar(a.prog, { w: 325, h: 5 }));

  var aFoot = FR('foot', { dir: 'h', w: 325, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  aFoot.appendChild(T('Weight: ' + (a.prog === 100 ? '25%' : '75%'), { size: 11.5, color: CF.sec }));
  aFoot.appendChild(T(a.prog + '% achieved', { size: 12, style: 'Semi Bold', color: CF.ink }));
  aCard.appendChild(aFoot);

  actList.appendChild(aCard);
});
c.appendChild(actList);

return { frame: m2.frame.id, name: m2.frame.name };
