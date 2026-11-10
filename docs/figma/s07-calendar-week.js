// 07 · Calendar — Week  (/calendar/week/today)
var s7 = await surfacePage('07 · Calendar — Week', { sidebar: 'none', crumb: 'Calendar / Week', x: 0, y: 5880 });
var c7 = s7.col;
c7.clipsContent = true;

// calendar toolbar
var tb7 = FR('Calendar toolbar', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var tbLeft = FR('left controls', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
tbLeft.appendChild(T('Calendar', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
tbLeft.appendChild(buttonGhost('Today', null, { h: 32 }));
var navBtns = FR('nav', { dir: 'h', hug: true, gap: 4 });
navBtns.appendChild(buttonGhost('', 'chevron-left', { h: 32, w: 32 }));
navBtns.appendChild(buttonGhost('', 'chevron-right', { h: 32, w: 32 }));
tbLeft.appendChild(navBtns);
tbLeft.appendChild(T('November 2026', { size: 16, style: 'Semi Bold', color: CF.ink }));
tb7.appendChild(tbLeft);

var tbRight = FR('right controls', { dir: 'h', hug: true, gap: 10, cross: 'CENTER' });
tbRight.appendChild(segmented(['Week', 'Month', 'Day', 'Agenda'], 0, { h: 32 }));
tbRight.appendChild(buttonPrimary('New event', 'plus', { h: 32 }));
tb7.appendChild(tbRight);
c7.appendChild(tb7);
c7.appendChild(spacer(1, 16));

// week grid header
var weekDays = ['Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13', 'Sat 14', 'Sun 15'];
var gridHead = FR('Week header', { dir: 'h', w: 1080, h: 36, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(gridHead, 'Bottom', CF.border);
gridHead.appendChild(FR('gutter-h', { w: 60, h: 36 })); // hour gutter spacer
weekDays.forEach(function (d, i) {
  var colH = FR('day-h/' + d, { dir: 'h', w: 145, h: 36, main: 'CENTER', cross: 'CENTER' });
  colH.appendChild(T(d, { size: 12.5, style: i === 0 ? 'Bold' : 'Medium', color: i === 0 ? CF.accent : CF.ink }));
  gridHead.appendChild(colH);
});
c7.appendChild(gridHead);

// timeline body
var timeline = FR('Timeline', { dir: 'h', w: 1080, h: 560, stroke: CF.border, r: 8, clip: true, fill: '#FFFFFF' });
var gutter = FR('Hour gutter', { dir: 'v', w: 60, h: 560, gap: 0, pt: 10 });
var hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
hours.forEach(function (hr) {
  var hCell = FR('hr/' + hr, { dir: 'h', w: 60, h: 50, pr: 8, main: 'MAX', cross: 'MIN' });
  hCell.appendChild(T(hr, { size: 11, color: CF.sec }));
  gutter.appendChild(hCell);
});
timeline.appendChild(gutter);

// 7 day columns
weekDays.forEach(function (d, i) {
  var dayCol = FR('col/' + d, { dir: 'v', w: 145, h: 560, gap: 0, p: 4, fill: i % 2 === 1 ? '#FAFAF9' : '#FFFFFF' });
  BORDER(dayCol, 'Left', CF.borderSoft);

  if (i === 0) { // Monday
    var ev1 = FR('ev/standup', { dir: 'v', w: 137, h: 48, p: 6, r: 6, fill: CF.blue, gap: 2 });
    ev1.y = 60;
    ev1.appendChild(T('09:00 Engineering Standup', { size: 11, style: 'Semi Bold', color: CF.blueText }));
    ev1.appendChild(T('Google Meet', { size: 10, color: CF.blueText }));
    dayCol.appendChild(ev1);

    var ev2 = FR('ev/rfc', { dir: 'v', w: 137, h: 68, p: 6, r: 6, fill: CF.purple, gap: 2 });
    ev2.y = 310;
    ev2.appendChild(T('14:00 Architecture RFC', { size: 11, style: 'Semi Bold', color: CF.purpleText }));
    ev2.appendChild(T('Pipeline review', { size: 10, color: CF.purpleText }));
    dayCol.appendChild(ev2);
  } else if (i === 2) { // Wednesday
    var ev3 = FR('ev/design', { dir: 'v', w: 137, h: 56, p: 6, r: 6, fill: CF.green, gap: 2 });
    ev3.y = 110;
    ev3.appendChild(T('10:00 Design review', { size: 11, style: 'Semi Bold', color: CF.greenText }));
    dayCol.appendChild(ev3);
  } else if (i === 4) { // Friday
    var ev4 = FR('ev/planning', { dir: 'v', w: 137, h: 56, p: 6, r: 6, fill: CF.amber, gap: 2 });
    ev4.y = 360;
    ev4.appendChild(T('15:00 Weekly planning', { size: 11, style: 'Semi Bold', color: CF.amberText }));
    dayCol.appendChild(ev4);
  }

  timeline.appendChild(dayCol);
});
c7.appendChild(timeline);

frameLabel(s7.page, '07 · Calendar — Week — /calendar/week/today', 0, 5836);

return { frame: s7.frame.id, name: s7.frame.name };
