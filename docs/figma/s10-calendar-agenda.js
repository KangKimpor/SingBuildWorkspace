// 10 · Calendar — Agenda  (/calendar/agenda/today)
var s10 = await surfacePage('10 · Calendar — Agenda', { sidebar: 'none', crumb: 'Calendar / Agenda', x: 0, y: 8820 });
var c10 = s10.col;
c10.clipsContent = true;

// toolbar
var tb10 = FR('Calendar toolbar', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var tbLeft10 = FR('left controls', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
tbLeft10.appendChild(T('Calendar', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
tbLeft10.appendChild(buttonGhost('Today', null, { h: 32 }));
tbLeft10.appendChild(T('Upcoming agenda', { size: 16, style: 'Semi Bold', color: CF.ink }));
tb10.appendChild(tbLeft10);

var tbRight10 = FR('right controls', { dir: 'h', hug: true, gap: 10, cross: 'CENTER' });
tbRight10.appendChild(segmented(['Week', 'Month', 'Day', 'Agenda'], 3, { h: 32 }));
tbRight10.appendChild(buttonPrimary('New event', 'plus', { h: 32 }));
tb10.appendChild(tbRight10);
c10.appendChild(tb10);
c10.appendChild(spacer(1, 24));

var agendaPanel = FR('Agenda list', { dir: 'v', w: 1080, gap: 20 });

var agendaGroups = [
  {
    date: 'Monday, November 9, 2026', tag: 'Today', events: [
      { time: '09:00 – 10:00', title: 'Engineering Standup', tag: 'Google Meet', fill: CF.blue, text: CF.blueText, desc: 'Sync on sprint backlog, issues, and daily blockers.' },
      { time: '14:00 – 15:30', title: 'Architecture RFC & Pipeline', tag: 'Team', fill: CF.purple, text: CF.purpleText, desc: 'Cross-functional review of cloud sync and caching protocols.' },
      { time: '16:30 – 17:30', title: 'Strength Session: Pull Routine', tag: 'Personal', fill: CF.amber, text: CF.amberText, desc: 'Gym routine.' }
    ]
  },
  {
    date: 'Wednesday, November 11, 2026', events: [
      { time: '10:00 – 11:30', title: 'Design system review', tag: 'Design', fill: CF.green, text: CF.greenText, desc: 'Token contrast verification, dark mode validation.' }
    ]
  },
  {
    date: 'Friday, November 13, 2026', events: [
      { time: '15:00 – 16:00', title: 'Weekly planning & retrospective', tag: 'Workspace', fill: CF.amber, text: CF.amberText, desc: 'Wrap up milestones and plan sprint scope.' }
    ]
  }
];

agendaGroups.forEach(function (g) {
  var grp = FR('group/' + g.date, { dir: 'v', w: 1080, gap: 10 });
  var dateHead = FR('head', { dir: 'h', w: 1080, h: 32, cross: 'CENTER', gap: 10 });
  dateHead.appendChild(T(g.date, { size: 14, style: 'Bold', color: CF.ink }));
  if (g.tag) dateHead.appendChild(chipPill(g.tag, CF.selected, CF.accent));
  grp.appendChild(dateHead);

  var cardList = FR('events', { dir: 'v', w: 1080, r: 8, stroke: CF.border, clip: true, fill: '#FFFFFF' });
  g.events.forEach(function (ev, evIdx) {
    var evRow = FR('row/' + ev.title, { dir: 'h', w: 1080, h: 64, pl: 18, pr: 18, cross: 'CENTER', gap: 16 });
    if (evIdx > 0) BORDER(evRow, 'Top', CF.borderSoft);

    var timeCol = FR('time', { dir: 'v', w: 110, main: 'CENTER' });
    timeCol.appendChild(T(ev.time, { size: 12, style: 'Semi Bold', color: CF.ink }));
    evRow.appendChild(timeCol);

    var bar = FR('colorBar', { w: 4, h: 32, r: 2, fill: ev.text });
    evRow.appendChild(bar);

    var titleCol = FR('titleCol', { dir: 'v', w: 600, gap: 2 });
    titleCol.appendChild(T(ev.title, { size: 13.5, style: 'Semi Bold', color: CF.ink }));
    titleCol.appendChild(T(ev.desc, { size: 12, color: CF.sec }));
    evRow.appendChild(titleCol);

    evRow.appendChild(growSpacer());
    evRow.appendChild(chipPill(ev.tag, ev.fill, ev.text));
    cardList.appendChild(evRow);
  });

  grp.appendChild(cardList);
  agendaPanel.appendChild(grp);
});

c10.appendChild(agendaPanel);

frameLabel(s10.page, '10 · Calendar — Agenda — /calendar/agenda/today', 0, 8776);

return { frame: s10.frame.id, name: s10.frame.name };
