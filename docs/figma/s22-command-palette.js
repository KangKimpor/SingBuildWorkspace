// 22 · Command palette (overlay)  (⌘K)
var scr22 = await desktopScreen('22 · Command palette', { sidebar: 'none', crumb: 'Projects', x: 0, y: 20580 });
var canvas22 = scr22.canvas;

// backdrop overlay
var backdrop = FR('Backdrop overlay', { w: 1440, h: 900, fill: '#000000', cross: 'CENTER', main: 'CENTER' });
backdrop.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.35 }];
backdrop.layoutPositioning = 'ABSOLUTE';
backdrop.x = 0; backdrop.y = 0;
scr22.frame.appendChild(backdrop);

// centered palette modal (640 wide)
var modal = FR('Command palette modal', { dir: 'v', w: 640, r: 14, stroke: CF.border, fill: '#FFFFFF', clip: true, gap: 0 });
modal.layoutPositioning = 'ABSOLUTE';
modal.x = 400; modal.y = 160;

// search bar
var searchBar = FR('searchBar', { dir: 'h', w: 640, h: 56, pl: 18, pr: 18, gap: 12, cross: 'CENTER' });
searchBar.appendChild(ICO('search', 20, CF.sec));
searchBar.appendChild(T('Type a command or search workspace…', { size: 15, color: CF.sec }));
searchBar.appendChild(growSpacer());
var escPill = FR('esc', { dir: 'h', hug: true, h: 22, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: CF.neutral, cross: 'CENTER' });
escPill.appendChild(T('ESC', { size: 10.5, style: 'Semi Bold', color: CF.sec }));
searchBar.appendChild(escPill);
modal.appendChild(searchBar);
BORDER(searchBar, 'Bottom', CF.borderSoft);

// list of commands
var cmdList = FR('cmdList', { dir: 'v', w: 640, p: 10, gap: 4 });

// group 1: Actions
cmdList.appendChild(T('Actions', { size: 11, style: 'Semi Bold', color: CF.muted }));
var cmd1 = FR('cmd1', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, fill: CF.selected, cross: 'CENTER', gap: 10 });
cmd1.appendChild(ICO('plus', 16, CF.accent));
cmd1.appendChild(T('Create new task', { size: 13, style: 'Medium', color: CF.ink }));
cmd1.appendChild(growSpacer());
var kbd1 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd1.appendChild(T('N', { size: 10.5, color: CF.sec }));
cmd1.appendChild(kbd1);
cmdList.appendChild(cmd1);

var cmd2 = FR('cmd2', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 10 });
cmd2.appendChild(ICO('folder', 16, CF.sec));
cmd2.appendChild(T('Create new project', { size: 13, color: CF.body }));
cmd2.appendChild(growSpacer());
var kbd2 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd2.appendChild(T('P', { size: 10.5, color: CF.sec }));
cmd2.appendChild(kbd2);
cmdList.appendChild(cmd2);

// group 2: Navigation
cmdList.appendChild(spacer(1, 6));
cmdList.appendChild(T('Navigation', { size: 11, style: 'Semi Bold', color: CF.muted }));
var cmd3 = FR('cmd3', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 10 });
cmd3.appendChild(ICO('calendar', 16, CF.sec));
cmd3.appendChild(T('Go to Calendar', { size: 13, color: CF.body }));
cmd3.appendChild(growSpacer());
var kbd3 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd3.appendChild(T('G C', { size: 10.5, color: CF.sec }));
cmd3.appendChild(kbd3);
cmdList.appendChild(cmd3);

var cmd4 = FR('cmd4', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 10 });
cmd4.appendChild(ICO('chart-column', 16, CF.sec));
cmd4.appendChild(T('Go to Projects Progress', { size: 13, color: CF.body }));
cmd4.appendChild(growSpacer());
var kbd4 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd4.appendChild(T('G P', { size: 10.5, color: CF.sec }));
cmd4.appendChild(kbd4);
cmdList.appendChild(cmd4);

modal.appendChild(cmdList);

// footer
var foot22 = FR('foot', { dir: 'h', w: 640, h: 36, pl: 16, pr: 16, cross: 'CENTER', fill: '#FAFAF9', gap: 14 });
BORDER(foot22, 'Top', CF.borderSoft);
foot22.appendChild(T('↑↓ Navigate', { size: 11, color: CF.sec }));
foot22.appendChild(T('↵ Select', { size: 11, color: CF.sec }));
foot22.appendChild(T('esc Dismiss', { size: 11, color: CF.sec }));
modal.appendChild(foot22);

scr22.frame.appendChild(modal);

frameLabel(scr22.page, '22 · Command palette (overlay) — ⌘K', 0, 20536);

return { frame: scr22.frame.id, name: scr22.frame.name };
