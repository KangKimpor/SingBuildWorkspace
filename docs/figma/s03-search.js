// 03 · Search  (/search)
var s3 = await centerPage('03 · Search — workspace search', { sidebar: 'none', crumb: 'Search', x: 0, y: 1960 });
var c3 = s3.col;

c3.appendChild(T('Search', { size: 40, style: 'Bold', color: CF.ink, lh: 46, ls: -2 }));
c3.appendChild(spacer(1, 8));
c3.appendChild(T('Find a thought, a task, or your next plan.', { size: 15, color: CF.sec, lh: 21 }));
c3.appendChild(spacer(1, 36));

// big search field
var big = FR('Search field', { dir: 'h', w: 720, h: 48, gap: 12, pl: 16, pr: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
big.appendChild(ICO('search', 18, CF.sec));
big.appendChild(T('Search your workspace…', { size: 16, color: CF.sec }));
c3.appendChild(big);
c3.appendChild(spacer(1, 28));

var results = [
  ['Weekly plan', 'Page · SingBuild Workspace'],
  ['Reading list', 'Page · SingBuild Workspace'],
  ['Workspace Overview', 'Page · SingBuild Workspace'],
  ['Team Wiki', 'Page · SingBuild Workspace'],
  ['Monday notes', 'Page · SingBuild Workspace'],
  ['Quarterly Goals', 'Page · SingBuild Workspace']
];

results.forEach(function (r) {
  var row = FR('Result/' + r[0], { dir: 'h', w: 720, h: 68, gap: 12, cross: 'CENTER' });
  row.appendChild(ICO('file-text', 20, CF.ter));
  var col = FR('text', { dir: 'v', w: 600, hugH: true, gap: 3, main: 'CENTER' });
  col.appendChild(T(r[0], { size: 15, style: 'Semi Bold', color: CF.ink, lh: 20 }));
  col.appendChild(T(r[1], { size: 12.5, color: CF.sec, lh: 17 }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(ICO('arrow-up-right', 16, CF.sec));
  c3.appendChild(row);
  c3.appendChild(rule(null, CF.borderSoft));
});

frameLabel(s3.page, '03 · Search — /search', 0, 1916);

return { frame: s3.frame.id, name: s3.frame.name, results: results.length };
