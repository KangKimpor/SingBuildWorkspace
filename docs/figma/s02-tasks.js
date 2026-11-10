// 02 · Tasks — My tasks  (/tasks)
var t2 = await surfacePage('02 · Tasks — My tasks', { sidebar: 'none', crumb: 'My tasks', x: 0, y: 980 });
t2.surface.clipsContent = true;
var c2 = t2.col;

var head2 = FR('Page heading', { dir: 'h', w: 1080, h: 60, main: 'SPACE_BETWEEN', cross: 'MIN' });
var headL = FR('heading', { dir: 'v', w: 600, hugH: true, gap: 8 });
headL.appendChild(T('My tasks', { size: 40, style: 'Bold', color: CF.ink, lh: 46, ls: -2 }));
headL.appendChild(T('Your personal agenda across 4 projects. One place to focus.', { size: 15, color: CF.sec, lh: 21 }));
head2.appendChild(headL);
head2.appendChild(buttonPrimary('New task', 'plus', { h: 36 }));
c2.appendChild(head2);
c2.appendChild(spacer(1, 20));

// scope tabs + search
var scopeRow = FR('tasks-topline', { dir: 'h', w: 1080, h: 44, cross: 'CENTER' });
var scopeTabs = tabList([{ label: 'All', count: 11 }, { label: 'Project tasks', count: 11 }, { label: 'Personal', count: 0 }], 0, { h: 34, gap: 4 });
scopeTabs.name = 'task-scope';
scopeRow.appendChild(scopeTabs);
scopeRow.appendChild(growSpacer());
scopeRow.appendChild(inputField('Search your tasks…', { w: 340, h: 40, icon: 'search' }));
c2.appendChild(scopeRow);
c2.appendChild(spacer(1, 16));

// filter line
var filterRow = FR('tasks-filterline', { dir: 'h', w: 1080, h: 36, cross: 'CENTER' });
var controls = FR('filter-controls', { dir: 'h', hug: true, h: 36, gap: 8, cross: 'CENTER' });
controls.appendChild(selectPill('All projects', null, { h: 34 }));
controls.appendChild(selectPill('All priorities', null, { h: 34 }));
controls.appendChild(selectPill('All labels', null, { h: 34 }));
controls.appendChild(selectPill('Priority', 'arrow-up-down', { h: 34 }));
filterRow.appendChild(controls);
filterRow.appendChild(growSpacer());
var saved = buttonGhost('Saved views', 'sliders', { h: 34 });
filterRow.appendChild(saved);
c2.appendChild(filterRow);
c2.appendChild(spacer(1, 20));

function group(name, count, tone, tasks) {
  var g = FR('Group/' + name, { dir: 'v', w: 1080, gap: 14, p: 20, r: 12, stroke: CF.border });
  g.appendChild(sectionSummary(name, count, tone));
  var inner = FR('group body', { dir: 'v', w: 1040, gap: 12 });
  tasks.forEach(function (t) { inner.appendChild(t); });
  g.appendChild(inner);
  c2.appendChild(g);
  c2.appendChild(spacer(1, 16));
  return g;
}

group('Overdue', 2, 'danger', [
  taskCard({
    title: 'Map calendar provider requirements', project: 'Website Redesign', status: 'Blocked',
    priority: 'Urgent', date: '11/08/2026', focus: true,
    notes: 'Waiting for the Google Cloud OAuth configuration.', w: 1040
  }),
  taskCard({
    title: 'Finalize token contrasts for WCAG AA', project: 'Website Redesign', status: 'In progress',
    priority: 'High', date: '11/06/2026', focus: true,
    notes: 'Audit the light and dark palettes. Check text, focus rings, and status chips on every surface.', w: 1040
  })
]);

group('Today, Monday, Nov 9', 2, 'today', [
  taskCard({
    title: 'Build navigation drawer gesture prototype', project: 'Mobile App', status: 'In review',
    priority: 'High', date: '11/09/2026', focus: true,
    notes: 'Test the drawer with touch, keyboard, and trackpad.', w: 1040, notesH: 40
  }),
  taskCard({
    title: 'Review engineering OKR draft and capacity', project: 'Q4 Planning', status: 'Not started',
    priority: 'Medium', date: '11/09/2026', w: 1040
  })
]);

frameLabel(t2.page, '02 · Tasks — /tasks', 0, 936);

return { frame: t2.frame.id, name: t2.frame.name, groups: 2, note: 'tasks built' };
