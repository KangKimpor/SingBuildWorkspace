// 20 · Design  (/design)
var s20 = await surfacePage('20 · Design', { sidebar: 'none', crumb: 'Design system', x: 0, y: 18620 });
var c20 = s20.col;
c20.clipsContent = true;

// page heading
var dHead = FR('Heading', { dir: 'v', w: 1080, gap: 6 });
dHead.appendChild(T('Design system', { size: 36, style: 'Bold', color: CF.ink, lh: 42, ls: -1.5 }));
dHead.appendChild(T('SingBuild Workspace tokens, typography, surfaces, and interactive components.', { size: 14.5, color: CF.sec, lh: 20 }));
c20.appendChild(dHead);
c20.appendChild(spacer(1, 28));

// 1. Color palette swatches
var colorSec = FR('Colors section', { dir: 'v', w: 1080, gap: 14 });
colorSec.appendChild(T('Color Palette & Semantic Tones', { size: 16, style: 'Bold', color: CF.ink }));
var swatchRow = FR('Swatches', { dir: 'h', w: 1080, gap: 12 });
var swatches = [
  ['Ink', CF.ink, '#FFFFFF'],
  ['Body', CF.body, '#FFFFFF'],
  ['Secondary', CF.sec, '#FFFFFF'],
  ['Border', CF.border, CF.ink],
  ['Accent', CF.accent, '#FFFFFF'],
  ['Green', CF.green, CF.greenText],
  ['Red', CF.red, CF.redText],
  ['Blue', CF.blue, CF.blueText],
  ['Amber', CF.amber, CF.amberText],
  ['Purple', CF.purple, CF.purpleText]
];
swatches.forEach(function (sw) {
  var b = FR('swatch/' + sw[0], { dir: 'v', w: 97, h: 72, p: 8, r: 8, fill: sw[1], stroke: CF.borderSoft, main: 'SPACE_BETWEEN' });
  b.appendChild(T(sw[0], { size: 11, style: 'Semi Bold', color: sw[2] }));
  b.appendChild(T(sw[1], { size: 10, color: sw[2] }));
  swatchRow.appendChild(b);
});
colorSec.appendChild(swatchRow);
c20.appendChild(colorSec);
c20.appendChild(spacer(1, 28));

// 2. Typography scale
var typeSec = FR('Typography scale', { dir: 'v', w: 1080, p: 20, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 14 });
typeSec.appendChild(T('Typography Hierarchy', { size: 16, style: 'Bold', color: CF.ink }));
typeSec.appendChild(divider(1040));
var typeSamples = [
  ['Display title · 40px Bold', 40, 'Bold', CF.ink, 48, -2],
  ['Page heading · 28px Bold', 28, 'Bold', CF.ink, 34, -1],
  ['Section title · 20px Bold', 20, 'Bold', CF.ink, 26, -0.5],
  ['Card heading · 15px Semi Bold', 15, 'Semi Bold', CF.ink, 21, 0],
  ['Body text · 13.5px Regular', 13.5, 'Regular', CF.body, 19, 0],
  ['Caption & metadata · 11.5px Regular', 11.5, 'Regular', CF.sec, 16, 0]
];
typeSamples.forEach(function (ts) {
  var tRow = FR('trow', { dir: 'h', w: 1040, cross: 'CENTER', main: 'SPACE_BETWEEN' });
  tRow.appendChild(T(ts[0], { size: ts[1], style: ts[2], color: ts[3], lh: ts[4], ls: ts[5] }));
  tRow.appendChild(T(ts[1] + 'px / ' + ts[2], { size: 12, color: CF.sec }));
  typeSec.appendChild(tRow);
});
c20.appendChild(typeSec);
c20.appendChild(spacer(1, 28));

// 3. Component specimens
var compSec = FR('Components specimen', { dir: 'v', w: 1080, p: 20, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 16 });
compSec.appendChild(T('Buttons & Interactive Components', { size: 16, style: 'Bold', color: CF.ink }));
compSec.appendChild(divider(1040));

var btnRow = FR('btnRow', { dir: 'h', w: 1040, gap: 12, cross: 'CENTER' });
btnRow.appendChild(buttonPrimary('Primary Action', 'plus', { h: 36 }));
btnRow.appendChild(buttonGhost('Ghost Action', 'download', { h: 36 }));
btnRow.appendChild(buttonGhost('Danger Action', 'trash', { h: 36, color: CF.redText, iconColor: CF.redText }));
btnRow.appendChild(selectPill('Dropdown Option', 'chevron-down', { h: 36 }));
btnRow.appendChild(checkbox(true, 18));
btnRow.appendChild(checkbox(false, 18));
compSec.appendChild(btnRow);

var chipRow = FR('chipRow', { dir: 'h', w: 1040, gap: 10, cross: 'CENTER' });
chipRow.appendChild(statusChip('Not started'));
chipRow.appendChild(statusChip('In progress'));
chipRow.appendChild(statusChip('In review'));
chipRow.appendChild(statusChip('Blocked'));
chipRow.appendChild(statusChip('Done'));
chipRow.appendChild(spacer(20, 1));
chipRow.appendChild(priorityChip('Low'));
chipRow.appendChild(priorityChip('Medium'));
chipRow.appendChild(priorityChip('High'));
chipRow.appendChild(priorityChip('Urgent'));
compSec.appendChild(chipRow);
c20.appendChild(compSec);

frameLabel(s20.page, '20 · Design — /design', 0, 18576);

return { frame: s20.frame.id, name: s20.frame.name };
