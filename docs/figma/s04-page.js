// 04 · Page editor — Weekly plan  (/pages/weekly-plan)
var s4 = await surfacePage('04 · Page editor — Weekly plan', { sidebar: 'none', crumb: 'Pages / Weekly plan', x: 0, y: 2940 });
var c4 = s4.col;
c4.clipsContent = true;

// breadcrumb row
var bc4 = hrow('Breadcrumb', 1080, 8);
bc4.appendChild(T('Pages', { size: 12.5, color: CF.sec }));
bc4.appendChild(T('/', { size: 12.5, color: CF.muted }));
bc4.appendChild(T('Weekly plan', { size: 12.5, color: CF.body }));
bc4.appendChild(growSpacer());
var starBtn = FR('action/star', { dir: 'h', w: 28, h: 28, r: 6, main: 'CENTER', cross: 'CENTER', fill: CF.neutral });
starBtn.appendChild(ICO('star', 15, CF.ink));
bc4.appendChild(starBtn);
bc4.appendChild(ICO('download', 16, CF.ter));
bc4.appendChild(ICO('trash', 16, CF.ter));
c4.appendChild(bc4);
c4.appendChild(spacer(1, 34));

// toolbar
var tb4 = hrow('Page toolbar', 1080, 10);
tb4.appendChild(selectPill('star', 'star', { h: 30 }));
tb4.appendChild(T('Emoji', { size: 12.5, color: CF.sec }));
tb4.appendChild(T('🙂', { size: 14, color: CF.body }));
tb4.appendChild(T('Upload icon', { size: 12.5, color: CF.sec }));
tb4.appendChild(T('Cover', { size: 12.5, color: CF.sec }));
tb4.appendChild(T('Font', { size: 12.5, color: CF.sec }));
tb4.appendChild(selectPill('default', null, { h: 30 }));
tb4.appendChild(checkbox(false, 14));
tb4.appendChild(T('Full width', { size: 12.5, color: CF.body }));
tb4.appendChild(checkbox(false, 14));
tb4.appendChild(T('Small text', { size: 12.5, color: CF.body }));
c4.appendChild(tb4);

// page body column (720 wide, inset)
var pg4 = vcol('Page body', 720, 0);
pg4.layoutAlign = 'INHERIT';
c4.appendChild(pg4);
pg4.layoutSizingHorizontal = 'FIXED';
pg4.x = 180;
pg4.layoutPositioning = 'ABSOLUTE';

var iconTile = FR('Page icon', { dir: 'h', w: 34, h: 34, r: 7, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
iconTile.appendChild(ICO('star', 18, CF.blueText));
pg4.appendChild(iconTile);
pg4.appendChild(spacer(1, 18));
pg4.appendChild(T('Weekly plan', { size: 40, style: 'Bold', color: CF.ink, lh: 48, ls: -2 }));
pg4.appendChild(spacer(1, 14));

// meta row
var meta4 = hrow('meta', 720, 12);
meta4.appendChild(T('Inside', { size: 12.5, color: CF.sec }));
meta4.appendChild(selectPill('Workspace', null, { h: 30 }));
meta4.appendChild(T('+ Subpage', { size: 12.5, color: CF.sec }));
meta4.appendChild(T('Edited 11/9/2026, 9:36:06 AM', { size: 12.5, color: CF.sec }));
pg4.appendChild(meta4);
pg4.appendChild(spacer(1, 18));
pg4.appendChild(divider(720));
pg4.appendChild(spacer(1, 20));

pg4.appendChild(T('A little space to think clearly, plan intentionally, and make progress on what matters.', { size: 15, color: CF.body, lh: 26, w: 720 }));
pg4.appendChild(spacer(1, 18));
pg4.appendChild(T('Focus for this week', { size: 30, style: 'Bold', color: CF.ink, lh: 38, ls: -1.5 }));
pg4.appendChild(spacer(1, 12));

var quote4 = hrow('quote', 720, 14);
var qbar = FR('quote bar', { w: 3, h: 34, fill: CF.ink });
quote4.appendChild(qbar);
quote4.appendChild(T('Keep the workspace quiet. Make the next step clear.', { size: 15, color: CF.body, lh: 24 }));
pg4.appendChild(quote4);
pg4.appendChild(spacer(1, 14));

function todoRow4(text, done) {
  var r = hrow('todo', 720, 10);
  r.appendChild(checkbox(done, 16));
  r.appendChild(T(text, { size: 15, color: done ? CF.muted : CF.body, lh: 22 }));
  return r;
}
pg4.appendChild(todoRow4('Review the design system and refine the details', true));
pg4.appendChild(spacer(1, 8));
pg4.appendChild(todoRow4('Plan the next milestone and capture open questions', false));
pg4.appendChild(spacer(1, 24));
pg4.appendChild(T('Notes & ideas', { size: 30, style: 'Bold', color: CF.ink, lh: 38, ls: -1.5 }));
pg4.appendChild(spacer(1, 12));
pg4.appendChild(T('Use this page for notes, decisions, and useful links. Type / in an empty block to choose a block type.', { size: 15, color: CF.body, lh: 26, w: 720 }));

frameLabel(s4.page, '04 · Page editor — /pages/weekly-plan', 0, 2896);

return { frame: s4.frame.id, name: s4.frame.name };
