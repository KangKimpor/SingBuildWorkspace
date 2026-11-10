// M04 · Mobile — Projects  (/projects?workspace=personal)
var m4 = await mobileScreen('M04 · Mobile — Projects', { crumb: 'Personal Workspace', tab: 'Workspace', x: 0, y: 2820, label: 'M04 · Projects — /projects' });
var c = m4.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('Projects', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
head.appendChild(buttonPrimary('New', 'plus', { h: 32 }));
c.appendChild(head);
c.appendChild(spacer(1, 16));

var pList = [
  { name: 'Website Redesign', desc: 'Design system unification and performance refresh.', due: 'Due Nov 12', icon: 'globe', tint: '#D3E5EF', text: '#337EA9' },
  { name: 'Mobile App', desc: 'A thoughtful companion workspace for life on the go.', due: 'Due Dec 5', icon: 'smartphone', tint: '#FCE9E0', text: '#D9730D' },
  { name: 'Q4 Planning', desc: 'Strategic roadmap, priorities, and resource allocation.', due: 'Due Oct 31', icon: 'chart-column', tint: '#E4F1E2', text: '#3A7355' }
];

pList.forEach(function (p) {
  var pCard = FR('card/' + p.name, { dir: 'v', w: 353, p: 14, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 10 });
  var pTop = FR('top', { dir: 'h', w: 325, gap: 10, cross: 'CENTER' });
  var tile = FR('tile', { dir: 'h', w: 28, h: 28, r: 6, fill: p.tint, main: 'CENTER', cross: 'CENTER' });
  tile.appendChild(ICO(p.icon, 15, p.text));
  pTop.appendChild(tile);
  pTop.appendChild(T(p.name, { size: 14, style: 'Bold', color: CF.ink }));
  pCard.appendChild(pTop);

  pCard.appendChild(T(p.desc, { size: 12, color: CF.sec, lh: 16 }));

  var pFoot = FR('foot', { dir: 'h', w: 325, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  pFoot.appendChild(T(p.due, { size: 11.5, color: CF.sec }));
  pFoot.appendChild(avatar('K', 18));
  pCard.appendChild(pFoot);

  c.appendChild(pCard);
  c.appendChild(spacer(1, 10));
});

return { frame: m4.frame.id, name: m4.frame.name };
