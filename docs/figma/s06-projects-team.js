// 06 · Projects — Team Workspace  (/projects?workspace=team)
var scr6 = await desktopScreen('06 · Projects — Team Workspace', { sidebar: 'none', crumb: 'Projects', x: 0, y: 4900 });
var canvas6 = scr6.canvas;
var c6 = plainContent(canvas6, { y: 32 });

var head6 = FR('Page heading', { dir: 'h', w: 978, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head6.appendChild(T('Team Workspace', { size: 40, style: 'Bold', color: CF.ink, lh: 48, ls: -2 }));
head6.appendChild(buttonPrimary('New project', 'plus'));
c6.appendChild(head6);
c6.appendChild(spacer(1, 48));

// empty state panel
var empty6 = FR('Team empty state', { dir: 'v', w: 978, p: 48, r: 12, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'CENTER', gap: 12 });
empty6.appendChild(ICO('users', 32, CF.sec));
empty6.appendChild(T('No team projects yet', { size: 16, style: 'Semi Bold', color: CF.ink }));
empty6.appendChild(T('Create shared projects and track collaborative delivery across your team.', { size: 13, color: CF.sec, align: 'CENTER' }));
empty6.appendChild(spacer(1, 6));
empty6.appendChild(buttonGhost('Create a team project', 'plus', { h: 32 }));
c6.appendChild(empty6);

frameLabel(scr6.page, '06 · Projects — /projects?workspace=team', 0, 4856);

return { frame: scr6.frame.id, name: scr6.frame.name };
