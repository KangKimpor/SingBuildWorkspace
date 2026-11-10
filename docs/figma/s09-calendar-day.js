// 09 · Calendar — Day  (/calendar/day/today)
var s9 = await surfacePage('09 · Calendar — Day', { sidebar: 'none', crumb: 'Calendar / Day', x: 0, y: 7840 });
var c9 = s9.col;
c9.clipsContent = true;

// toolbar
var tb9 = FR('Calendar toolbar', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var tbLeft9 = FR('left controls', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
tbLeft9.appendChild(T('Calendar', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
tbLeft9.appendChild(buttonGhost('Today', null, { h: 32 }));
var navBtns9 = FR('nav', { dir: 'h', hug: true, gap: 4 });
navBtns9.appendChild(buttonGhost('', 'chevron-left', { h: 32, w: 32 }));
navBtns9.appendChild(buttonGhost('', 'chevron-right', { h: 32, w: 32 }));
tbLeft9.appendChild(navBtns9);
tbLeft9.appendChild(T('Monday, November 9, 2026', { size: 16, style: 'Semi Bold', color: CF.ink }));
tb9.appendChild(tbLeft9);

var tbRight9 = FR('right controls', { dir: 'h', hug: true, gap: 10, cross: 'CENTER' });
tbRight9.appendChild(segmented(['Week', 'Month', 'Day', 'Agenda'], 2, { h: 32 }));
tbRight9.appendChild(buttonPrimary('New event', 'plus', { h: 32 }));
tb9.appendChild(tbRight9);
c9.appendChild(tb9);
c9.appendChild(spacer(1, 16));

// day timeline container
var dayTimeline = FR('Day timeline', { dir: 'h', w: 1080, h: 560, stroke: CF.border, r: 8, clip: true, fill: '#FFFFFF' });
var dayGutter = FR('Hour gutter', { dir: 'v', w: 70, h: 560, gap: 0, pt: 10 });
var dayHours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
dayHours.forEach(function (hr) {
  var hCell = FR('hr/' + hr, { dir: 'h', w: 70, h: 50, pr: 12, main: 'MAX', cross: 'MIN' });
  hCell.appendChild(T(hr, { size: 11.5, color: CF.sec }));
  dayGutter.appendChild(hCell);
});
dayTimeline.appendChild(dayGutter);

var dayMain = FR('Events column', { dir: 'v', w: 1010, h: 560, p: 12, gap: 12 });
BORDER(dayMain, 'Left', CF.borderSoft);

// event 1: Standup
var evCard1 = FR('ev/standup', { dir: 'v', w: 986, h: 72, p: 12, r: 8, fill: CF.blue, stroke: '#B9D5E8', gap: 4 });
var evCard1Top = FR('top', { dir: 'h', w: 962, main: 'SPACE_BETWEEN', cross: 'CENTER' });
evCard1Top.appendChild(T('09:00 – 10:00 · Engineering Standup', { size: 13.5, style: 'Bold', color: CF.blueText }));
evCard1Top.appendChild(chipPill('Google Meet', CF.selected, CF.accent));
evCard1.appendChild(evCard1Top);
evCard1.appendChild(T('Daily sync on sprint priorities, blockages, and milestone deliverables.', { size: 12, color: CF.blueText }));
dayMain.appendChild(evCard1);

// event 2: Architecture RFC
var evCard2 = FR('ev/rfc', { dir: 'v', w: 986, h: 96, p: 12, r: 8, fill: CF.purple, stroke: '#D9C8E5', gap: 4 });
evCard2.y = 260;
var evCard2Top = FR('top', { dir: 'h', w: 962, main: 'SPACE_BETWEEN', cross: 'CENTER' });
evCard2Top.appendChild(T('14:00 – 15:30 · Architecture RFC & Pipeline Review', { size: 13.5, style: 'Bold', color: CF.purpleText }));
evCard2Top.appendChild(chipPill('Deep Work', CF.purple, CF.purpleText));
evCard2.appendChild(evCard2Top);
evCard2.appendChild(T('Reviewing the database replication strategy and migration plan for offline-first sync.', { size: 12, color: CF.purpleText }));
var attRow = FR('attendees', { dir: 'h', hug: true, gap: 6, pt: 4 });
attRow.appendChild(avatar('K', 18));
attRow.appendChild(avatar('P', 18));
attRow.appendChild(avatar('S', 18));
evCard2.appendChild(attRow);
dayMain.appendChild(evCard2);

// event 3: Strength Session
var evCard3 = FR('ev/workout', { dir: 'v', w: 986, h: 68, p: 12, r: 8, fill: CF.amber, stroke: '#F4DCAD', gap: 4 });
evCard3.y = 440;
var evCard3Top = FR('top', { dir: 'h', w: 962, main: 'SPACE_BETWEEN', cross: 'CENTER' });
evCard3Top.appendChild(T('16:30 – 17:30 · Strength Session: Pull Routine', { size: 13.5, style: 'Bold', color: CF.amberText }));
evCard3Top.appendChild(chipPill('Personal', CF.amber, CF.amberText));
evCard3.appendChild(evCard3Top);
evCard3.appendChild(T('Upper back, lats, and biceps focus.', { size: 12, color: CF.amberText }));
dayMain.appendChild(evCard3);

dayTimeline.appendChild(dayMain);
c9.appendChild(dayTimeline);

frameLabel(s9.page, '09 · Calendar — Day — /calendar/day/today', 0, 7796);

return { frame: s9.frame.id, name: s9.frame.name };
