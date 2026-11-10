// 12 · Project — Board  (/projects/website/board)
var s12 = await surfacePage('12 · Project — Board', { sidebar: 'none', crumb: 'Projects / Website Redesign', x: 0, y: 10780 });
var c12 = s12.col;
c12.clipsContent = true;

// project header
var pHead12 = FR('Project heading', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitleL12 = FR('left', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var pTile12 = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pTile12.appendChild(ICO('globe', 18, CF.blueText));
pTitleL12.appendChild(pTile12);
pTitleL12.appendChild(T('Website Redesign', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
pHead12.appendChild(pTitleL12);
pHead12.appendChild(buttonPrimary('New task', 'plus', { h: 32 }));
c12.appendChild(pHead12);
c12.appendChild(spacer(1, 16));

// project toolbar
var tb12 = FR('Project toolbar', { dir: 'h', w: 1080, h: 40, cross: 'CENTER' });
var viewTabs12 = FR('views', { dir: 'h', hug: true, gap: 4 });
var tabAll12 = FR('tab/all', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, cross: 'CENTER' });
tabAll12.appendChild(ICO('table', 14, CF.sec));
tabAll12.appendChild(T('All Tasks', { size: 12.5, color: CF.sec }));
viewTabs12.appendChild(tabAll12);

var tabBoard12 = FR('tab/board', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, fill: CF.selected, cross: 'CENTER' });
tabBoard12.appendChild(ICO('kanban', 14, CF.accent));
tabBoard12.appendChild(T('By Status', { size: 12.5, style: 'Semi Bold', color: CF.accent }));
viewTabs12.appendChild(tabBoard12);
tb12.appendChild(viewTabs12);

tb12.appendChild(growSpacer());
var tbFilter12 = FR('filters', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
tbFilter12.appendChild(inputField('Search project tasks…', { w: 240, h: 32, icon: 'search' }));
tbFilter12.appendChild(selectPill('All priorities', 'sliders', { h: 32 }));
tb12.appendChild(tbFilter12);
c12.appendChild(tb12);
c12.appendChild(spacer(1, 16));

// kanban board
var board = FR('Kanban board', { dir: 'h', w: 1080, h: 560, gap: 14, clip: true });

var columns = [
  {
    name: 'Not started', count: 1, tone: 'neutral', tasks: [
      { title: 'Review engineering OKR draft and capacity', pri: 'Medium', due: 'Nov 12', avatar: 'P' }
    ]
  },
  {
    name: 'In progress', count: 2, tone: 'primary', tasks: [
      { title: 'Build navigation drawer gesture prototype', pri: 'High', due: 'Nov 10', avatar: 'K' },
      { title: 'Export typography hierarchy tokens', pri: 'Medium', due: 'Nov 8', avatar: 'S' }
    ]
  },
  {
    name: 'In review', count: 0, tone: 'neutral', tasks: []
  },
  {
    name: 'Blocked', count: 1, tone: 'danger', tasks: [
      { title: 'Map calendar provider requirements', pri: 'Urgent', due: 'Nov 8', avatar: 'K' }
    ]
  },
  {
    name: 'Done', count: 2, tone: 'success', tasks: [
      { title: 'Finalize token contrasts for WCAG AA', pri: 'High', due: 'Nov 6', avatar: 'S' },
      { title: 'Verify Safari glass fallback', pri: 'Low', due: 'Nov 4', avatar: 'P' }
    ]
  }
];

columns.forEach(function (col) {
  var colFrame = FR('col/' + col.name, { dir: 'v', w: 204, h: 560, p: 8, gap: 10, r: 8, fill: '#F8F8F7' });
  var colHead = FR('head', { dir: 'h', w: 188, h: 28, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  var titleWrap = FR('titleWrap', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
  titleWrap.appendChild(T(col.name, { size: 12.5, style: 'Semi Bold', color: CF.ink }));
  titleWrap.appendChild(countBadge(col.count, false));
  colHead.appendChild(titleWrap);
  colHead.appendChild(ICO('plus', 14, CF.sec));
  colFrame.appendChild(colHead);

  col.tasks.forEach(function (t) {
    var kCard = FR('card/' + t.title, { dir: 'v', w: 188, p: 12, r: 6, stroke: CF.border, fill: '#FFFFFF', gap: 8 });
    kCard.appendChild(T(t.title, { size: 12.5, style: 'Medium', color: CF.ink, lh: 17 }));
    var kFoot = FR('foot', { dir: 'h', w: 164, main: 'SPACE_BETWEEN', cross: 'CENTER' });
    kFoot.appendChild(priorityChip(t.pri));
    var kMeta = FR('meta', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
    kMeta.appendChild(T(t.due, { size: 11, color: CF.sec }));
    kMeta.appendChild(avatar(t.avatar, 18));
    kFoot.appendChild(kMeta);
    kCard.appendChild(kFoot);
    colFrame.appendChild(kCard);
  });

  board.appendChild(colFrame);
});
c12.appendChild(board);

frameLabel(s12.page, '12 · Project — Board — /projects/website/board', 0, 10736);

return { frame: s12.frame.id, name: s12.frame.name };
