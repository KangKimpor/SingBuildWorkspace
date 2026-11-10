// M06 · Mobile — Project Board  (/projects/website/board)
var m6 = await mobileScreen('M06 · Mobile — Project Board', { crumb: 'Website Redesign', tab: 'Workspace', x: 0, y: 4700, label: 'M06 · Board — /projects/website/board' });
var c = m6.col;

var pHead = FR('phead', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitle = FR('ptitle', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
var pIcon = FR('picon', { dir: 'h', w: 26, h: 26, r: 6, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pIcon.appendChild(ICO('globe', 14, CF.blueText));
pTitle.appendChild(pIcon);
pTitle.appendChild(T('Website Redesign', { size: 18, style: 'Bold', color: CF.ink }));
pHead.appendChild(pTitle);
pHead.appendChild(buttonPrimary('New', 'plus', { h: 28 }));
c.appendChild(pHead);
c.appendChild(spacer(1, 14));

var tbRow = FR('tbrow', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
tbRow.appendChild(selectPill('Board', 'kanban', { h: 30 }));
tbRow.appendChild(selectPill('Filter', 'sliders', { h: 30 }));
c.appendChild(tbRow);
c.appendChild(spacer(1, 14));

// mobile kanban section (showing In progress)
var colSec = FR('colSec', { dir: 'v', w: 353, p: 12, r: 10, fill: '#F8F8F7', gap: 10 });
var colHead = FR('colHead', { dir: 'h', w: 329, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var colTitle = FR('ct', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
colTitle.appendChild(T('In progress', { size: 13, style: 'Bold', color: CF.ink }));
colTitle.appendChild(countBadge(2, true));
colHead.appendChild(colTitle);
colHead.appendChild(ICO('plus', 14, CF.sec));
colSec.appendChild(colHead);

var bCards = [
  { title: 'Build navigation drawer gesture prototype', pri: 'High', due: 'Nov 10' },
  { title: 'Export typography hierarchy tokens', pri: 'Medium', due: 'Nov 8' }
];

bCards.forEach(function (card) {
  var kCard = FR('card/' + card.title, { dir: 'v', w: 329, p: 12, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 8 });
  kCard.appendChild(T(card.title, { size: 13, style: 'Medium', color: CF.ink, lh: 17 }));
  var kFoot = FR('foot', { dir: 'h', w: 305, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  kFoot.appendChild(priorityChip(card.pri));
  kFoot.appendChild(T(card.due, { size: 11.5, color: CF.sec }));
  kCard.appendChild(kFoot);
  colSec.appendChild(kCard);
});

c.appendChild(colSec);

return { frame: m6.frame.id, name: m6.frame.name };
