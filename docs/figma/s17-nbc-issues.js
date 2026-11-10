// 17 · NBC BP03 — Issues  (/projects-progress/nbc-bp03/issues)
var s17 = await surfacePage('17 · NBC BP03 — Issues', { sidebar: 'none', crumb: 'Projects Progress / NBC BP03 / Issues', x: 0, y: 15680 });
var c17 = s17.col;
c17.clipsContent = true;

// project title
var nbcTitle17 = FR('Title', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTL17 = FR('tl', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var nbcIcon17 = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcIcon17.appendChild(ICO('building', 18, CF.blueText));
nbcTL17.appendChild(nbcIcon17);
nbcTL17.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 26, style: 'Bold', color: CF.ink, lh: 32 }));
nbcTitle17.appendChild(nbcTL17);
nbcTitle17.appendChild(buttonPrimary('Report issue', 'plus', { h: 32 }));
c17.appendChild(nbcTitle17);
c17.appendChild(spacer(1, 14));

// tabs row
var tabRow17 = tabList([
  { label: 'Overview', count: null },
  { label: 'Activities', count: 3 },
  { label: 'Update Progress', count: null },
  { label: 'Issues', count: 2 }
], 3, { h: 34, gap: 8 });
c17.appendChild(tabRow17);
c17.appendChild(spacer(1, 20));

// issues toolbar
var issTb = FR('Issues toolbar', { dir: 'h', w: 1080, h: 40, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var issTbL = FR('left', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
issTbL.appendChild(inputField('Search issues…', { w: 260, h: 32, icon: 'search' }));
issTbL.appendChild(selectPill('All severities', null, { h: 32 }));
issTbL.appendChild(selectPill('Open issues', null, { h: 32 }));
issTb.appendChild(issTbL);
c17.appendChild(issTb);
c17.appendChild(spacer(1, 16));

// issues list panel
var issPanel = FR('Issues panel', { dir: 'v', w: 1080, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var issHead = FR('Head', { dir: 'h', w: 1080, h: 40, pl: 18, pr: 18, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(issHead, 'Bottom', CF.border);
issHead.appendChild(T('Issue', { size: 12, style: 'Semi Bold', color: CF.sec, w: 420 }));
issHead.appendChild(T('Location', { size: 12, style: 'Semi Bold', color: CF.sec, w: 160 }));
issHead.appendChild(T('Severity', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
issHead.appendChild(T('Reporter', { size: 12, style: 'Semi Bold', color: CF.sec, w: 160 }));
issHead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 160 }));
issPanel.appendChild(issHead);

var issueRows = [
  { title: 'Material delivery delay on GF drywall studs', loc: 'GF · Test area', sev: 'High', rep: 'Tola', st: 'Open', tone: 'danger' },
  { title: 'Ceiling conduit routing conflict with HVAC duct', loc: 'Level 2 · Corridor', sev: 'Medium', rep: 'Sitha', st: 'Under review', tone: 'primary' }
];

issueRows.forEach(function (iss, idx) {
  var row = FR('row/' + iss.title, { dir: 'h', w: 1080, h: 56, pl: 18, pr: 18, cross: 'CENTER' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);

  var titleCol = FR('titleCol', { dir: 'v', w: 420, gap: 2 });
  titleCol.appendChild(T(iss.title, { size: 13.5, style: 'Semi Bold', color: CF.ink }));
  titleCol.appendChild(T('Reported Nov 8, 2026', { size: 11.5, color: CF.sec }));
  row.appendChild(titleCol);

  row.appendChild(T(iss.loc, { size: 12.5, color: CF.body, w: 160 }));

  var sevCol = FR('sev', { dir: 'h', w: 140, cross: 'CENTER' });
  sevCol.appendChild(priorityChip(iss.sev));
  row.appendChild(sevCol);

  var repCol = FR('rep', { dir: 'h', w: 160, gap: 6, cross: 'CENTER' });
  repCol.appendChild(avatar(iss.rep.charAt(0), 20));
  repCol.appendChild(T(iss.rep, { size: 12.5, color: CF.body }));
  row.appendChild(repCol);

  var stCol = FR('st', { dir: 'h', w: 160, cross: 'CENTER' });
  stCol.appendChild(statusChip(iss.st));
  row.appendChild(stCol);

  issPanel.appendChild(row);
});
c17.appendChild(issPanel);

frameLabel(s17.page, '17 · NBC BP03 — Issues — /projects-progress/nbc-bp03/issues', 0, 15636);

return { frame: s17.frame.id, name: s17.frame.name };
