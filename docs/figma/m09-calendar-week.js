// M09 · Mobile — Calendar  (/calendar/week/today)
var m9 = await mobileScreen('M09 · Mobile — Calendar', { crumb: 'Calendar', tab: 'Workspace', x: 0, y: 7520, label: 'M09 · Calendar — /calendar' });
var c = m9.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('November 2026', { size: 22, style: 'Bold', color: CF.ink }));
head.appendChild(buttonPrimary('New', 'plus', { h: 28 }));
c.appendChild(head);
c.appendChild(spacer(1, 14));

// 7-day horizontal strip
var strip = FR('strip', { dir: 'h', w: 353, main: 'SPACE_BETWEEN' });
var days = [
  ['M', '9', true], ['T', '10', false], ['W', '11', false], ['T', '12', false], ['F', '13', false], ['S', '14', false], ['S', '15', false]
];

days.forEach(function (d) {
  var dCell = FR('d/' + d[1], { dir: 'v', w: 44, h: 58, r: 8, fill: d[2] ? CF.accent : '#F8F8F7', cross: 'CENTER', main: 'CENTER', gap: 4 });
  dCell.appendChild(T(d[0], { size: 11, style: 'Medium', color: d[2] ? '#FFFFFF' : CF.sec }));
  dCell.appendChild(T(d[1], { size: 14, style: 'Bold', color: d[2] ? '#FFFFFF' : CF.ink }));
  strip.appendChild(dCell);
});
c.appendChild(strip);
c.appendChild(spacer(1, 18));

// event cards
var evList = FR('evList', { dir: 'v', w: 353, gap: 10 });
var evs = [
  { time: '09:00 – 10:00', title: 'Engineering Standup', tag: 'Team', fill: CF.blue, text: CF.blueText },
  { time: '14:00 – 15:30', title: 'Architecture RFC & Pipeline', tag: 'Deep Work', fill: CF.purple, text: CF.purpleText },
  { time: '16:30 – 17:30', title: 'Strength Session: Pull Routine', tag: 'Personal', fill: CF.amber, text: CF.amberText }
];

evs.forEach(function (ev) {
  var eCard = FR('card/' + ev.title, { dir: 'v', w: 353, p: 12, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 6 });
  var eTop = FR('top', { dir: 'h', w: 329, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  eTop.appendChild(T(ev.time, { size: 11.5, style: 'Semi Bold', color: CF.sec }));
  eTop.appendChild(chipPill(ev.tag, ev.fill, ev.text));
  eCard.appendChild(eTop);
  eCard.appendChild(T(ev.title, { size: 13.5, style: 'Bold', color: CF.ink }));
  evList.appendChild(eCard);
});
c.appendChild(evList);

return { frame: m9.frame.id, name: m9.frame.name };
