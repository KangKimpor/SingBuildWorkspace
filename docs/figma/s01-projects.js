// 01 · Projects — Personal Workspace  (/projects)
var scr = await desktopScreen('01 · Projects — Personal Workspace', { sidebar: 'none', crumb: 'Projects', x: 0, y: 0 });
var canvas = scr.canvas;

var content = plainContent(canvas, { y: 32 });

var head = FR('Page heading', { dir: 'h', w: 978, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('Personal Workspace', { size: 40, style: 'Bold', color: CF.ink, lh: 48, ls: -2 }));
head.appendChild(buttonPrimary('New project', 'plus'));
content.appendChild(head);

content.appendChild(spacer(1, 76));

var projects = [
  { name: 'Website Redesign', desc: 'Design system unification and performance refresh.', due: 'Due Nov 12', icon: 'globe', tint: '#D3E5EF', tintText: '#337EA9' },
  { name: 'Mobile App', desc: 'A thoughtful companion workspace for life on the go.', due: 'Due Dec 5', icon: 'smartphone', tint: '#FCE9E0', tintText: '#D9730D' },
  { name: 'Q4 Planning', desc: 'Strategic roadmap, priorities, and resource allocation.', due: 'Due Oct 31', icon: 'chart-column', tint: '#E4F1E2', tintText: '#3A7355' }
];

var row = FR('Projects grid', { dir: 'h', w: 978, h: 180, gap: 16 });
projects.forEach(function (p) {
  var card = FR('Project card / ' + p.name, { dir: 'v', w: 315, h: 180, p: 16, r: 8, stroke: '#E9E8E5', fill: '#FFFFFF' });
  var tile = FR('icon tile', { dir: 'h', w: 30, h: 30, r: 8, main: 'CENTER', cross: 'CENTER', fill: p.tint });
  tile.appendChild(ICO(p.icon, 16, p.tintText));
  card.appendChild(tile);
  card.appendChild(spacer(1, 14));
  card.appendChild(T(p.name, { size: 14.5, style: 'Semi Bold', color: CF.ink, lh: 20 }));
  card.appendChild(spacer(1, 6));
  card.appendChild(T(p.desc, { size: 12.5, color: CF.sec, w: 283, lh: 19 }));
  card.appendChild(growSpacer());
  var foot = FR('footer', { dir: 'h', w: 283, h: 20, gap: 6, cross: 'CENTER' });
  foot.appendChild(ICO('flag', 13, CF.sec));
  foot.appendChild(T(p.due, { size: 12, color: CF.sec }));
  foot.appendChild(growSpacer());
  foot.appendChild(avatar('K', 18));
  card.appendChild(foot);
  row.appendChild(card);
});
content.appendChild(row);

// page label above the frame
var lbl = T('01 · Projects — /projects', { size: 16, style: 'Semi Bold', color: CF.ink, name: 'label' });
scr.page.appendChild(lbl); lbl.x = 0; lbl.y = -44;

// retire the bootstrap page
var p1 = findPage('Page 1');
if (p1) {
  p1.children.slice().forEach(function (n) { n.remove(); });
  p1.name = '00 · Cover';
}

return {
  frame: scr.frame.id,
  frameName: scr.frame.name,
  size: [scr.frame.width, scr.frame.height],
  sidebar: scr.frame.children[0].name,
  note: 'projects screen built'
};
