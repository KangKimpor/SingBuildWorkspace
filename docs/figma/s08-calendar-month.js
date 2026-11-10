// 08 · Calendar — Month  (/calendar/month/today)
var s8 = await surfacePage('08 · Calendar — Month', { sidebar: 'none', crumb: 'Calendar / Month', x: 0, y: 6860 });
var c8 = s8.col;
c8.clipsContent = true;

// toolbar
var tb8 = FR('Calendar toolbar', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var tbLeft8 = FR('left controls', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
tbLeft8.appendChild(T('Calendar', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
tbLeft8.appendChild(buttonGhost('Today', null, { h: 32 }));
var navBtns8 = FR('nav', { dir: 'h', hug: true, gap: 4 });
navBtns8.appendChild(buttonGhost('', 'chevron-left', { h: 32, w: 32 }));
navBtns8.appendChild(buttonGhost('', 'chevron-right', { h: 32, w: 32 }));
tbLeft8.appendChild(navBtns8);
tbLeft8.appendChild(T('November 2026', { size: 16, style: 'Semi Bold', color: CF.ink }));
tb8.appendChild(tbLeft8);

var tbRight8 = FR('right controls', { dir: 'h', hug: true, gap: 10, cross: 'CENTER' });
tbRight8.appendChild(segmented(['Week', 'Month', 'Day', 'Agenda'], 1, { h: 32 }));
tbRight8.appendChild(buttonPrimary('New event', 'plus', { h: 32 }));
tb8.appendChild(tbRight8);
c8.appendChild(tb8);
c8.appendChild(spacer(1, 16));

// days of week header
var dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var dowRow = FR('DOW header', { dir: 'h', w: 1080, h: 32, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(dowRow, 'Bottom', CF.border);
dow.forEach(function (d) {
  var cell = FR('dow/' + d, { dir: 'h', w: 154, h: 32, main: 'CENTER', cross: 'CENTER' });
  cell.appendChild(T(d, { size: 12, style: 'Medium', color: CF.sec }));
  dowRow.appendChild(cell);
});
c8.appendChild(dowRow);

// month grid (5 rows x 7 days)
var monthGrid = FR('Month grid', { dir: 'v', w: 1080, h: 560, stroke: CF.border, r: 8, clip: true, fill: '#FFFFFF' });
var daysMatrix = [
  [26, 27, 28, 29, 30, 31, 1],
  [2, 3, 4, 5, 6, 7, 8],
  [9, 10, 11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20, 21, 22],
  [23, 24, 25, 26, 27, 28, 29]
];

daysMatrix.forEach(function (week, rIdx) {
  var row = FR('week-row/' + rIdx, { dir: 'h', w: 1080, h: 112 });
  if (rIdx > 0) BORDER(row, 'Top', CF.borderSoft);

  week.forEach(function (d, cIdx) {
    var isOther = (rIdx === 0 && d > 20) || (rIdx === 4 && d < 10);
    var isToday = (rIdx === 2 && d === 9);
    var cell = FR('day-cell/' + d, { dir: 'v', w: 154, h: 112, p: 6, gap: 4, fill: isToday ? '#F8FAFC' : '#FFFFFF' });
    if (cIdx > 0) BORDER(cell, 'Left', CF.borderSoft);

    var numRow = FR('num-row', { dir: 'h', w: 142, main: 'SPACE_BETWEEN', cross: 'CENTER' });
    var numBadge = FR('badge', { dir: 'h', w: 22, h: 22, r: 11, main: 'CENTER', cross: 'CENTER', fill: isToday ? CF.accent : 'transparent' });
    numBadge.appendChild(T(String(d), { size: 12, style: isToday ? 'Bold' : 'Regular', color: isToday ? '#FFFFFF' : (isOther ? CF.muted : CF.ink) }));
    numRow.appendChild(numBadge);
    cell.appendChild(numRow);

    // event badges
    if (rIdx === 2 && d === 9) { // Nov 9
      var ev1 = FR('ev1', { dir: 'h', w: 142, h: 20, pl: 6, pr: 6, r: 4, fill: CF.blue, cross: 'CENTER' });
      ev1.appendChild(T('09:00 Standup', { size: 10.5, style: 'Medium', color: CF.blueText }));
      cell.appendChild(ev1);

      var ev2 = FR('ev2', { dir: 'h', w: 142, h: 20, pl: 6, pr: 6, r: 4, fill: CF.purple, cross: 'CENTER' });
      ev2.appendChild(T('14:00 RFC & Pipeline', { size: 10.5, style: 'Medium', color: CF.purpleText }));
      cell.appendChild(ev2);
    } else if (rIdx === 2 && d === 11) { // Nov 11
      var ev3 = FR('ev3', { dir: 'h', w: 142, h: 20, pl: 6, pr: 6, r: 4, fill: CF.green, cross: 'CENTER' });
      ev3.appendChild(T('10:00 Design review', { size: 10.5, style: 'Medium', color: CF.greenText }));
      cell.appendChild(ev3);
    } else if (rIdx === 2 && d === 13) { // Nov 13
      var ev4 = FR('ev4', { dir: 'h', w: 142, h: 20, pl: 6, pr: 6, r: 4, fill: CF.amber, cross: 'CENTER' });
      ev4.appendChild(T('15:00 Weekly planning', { size: 10.5, style: 'Medium', color: CF.amberText }));
      cell.appendChild(ev4);
    }

    row.appendChild(cell);
  });
  monthGrid.appendChild(row);
});
c8.appendChild(monthGrid);

frameLabel(s8.page, '08 · Calendar — Month — /calendar/month/today', 0, 6816);

return { frame: s8.frame.id, name: s8.frame.name };
