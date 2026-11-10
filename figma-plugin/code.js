// GENERATED FILE — do not edit. Source: docs/figma/*.js
// Build with: node scripts/figma-plugin-build.mjs
(async function () {
  var results = [];
  try {
    await figma.loadAllPagesAsync();

    // ---------------- library ----------------
// Shared helpers for the SingBuild Workspace -> Figma port.
// This file is fetched over HTTP and prepended to each use_figma code payload.

var FONTS = ['Regular', 'Medium', 'Semi Bold', 'Bold'];
await Promise.all(FONTS.map(function (s) { return figma.loadFontAsync({ family: 'Inter', style: s }); }));

var CF = {
  canvas: '#FFFFFF',
  pageBg: '#F2F2F0',
  sidebar: '#FAFAF9',
  border: '#EAE9E6',
  borderSoft: '#F1F0ED',
  ink: '#292824',
  body: '#37352F',
  sec: '#85837E',
  ter: '#6B6964',
  muted: '#B9B7B2',
  accent: '#2563EB',
  accentFill: '#2383E2',
  selected: '#EFF6FF',
  green: '#DBEDDB',
  greenText: '#3A7355',
  red: '#FFE2DD',
  redText: '#C93B3B',
  blue: '#D3E5EF',
  blueText: '#337EA9',
  purple: '#E8DEEE',
  purpleText: '#9065B0',
  amber: '#FDECC8',
  amberText: '#BB8420',
  orange: '#FADEC9',
  orangeText: '#D9730D',
  neutral: '#F1F1EF',
  navy: '#0F1B2D'
};

function rgbFromHex(h) {
  var s = String(h).replace('#', '');
  return {
    r: parseInt(s.slice(0, 2), 16) / 255,
    g: parseInt(s.slice(2, 4), 16) / 255,
    b: parseInt(s.slice(4, 6), 16) / 255
  };
}
function paint(h, o) { return { type: 'SOLID', color: rgbFromHex(h), opacity: o === undefined ? 1 : o }; }
function fill(h) { return [paint(h)]; }

// ---------------- text ----------------
function T(chars, o) {
  o = o || {};
  var t = figma.createText();
  t.fontName = { family: 'Inter', style: o.style || 'Regular' };
  t.fontSize = o.size || 14;
  t.lineHeight = { unit: 'PIXELS', value: o.lh || Math.round((o.size || 14) * 1.42) };
  t.letterSpacing = { unit: 'PERCENT', value: o.ls || 0 };
  t.fills = fill(o.color || CF.body);
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, o.h || 16); }
  if (o.grow) t.layoutGrow = 1;
  t.characters = String(chars);
  t.name = o.name || String(chars).slice(0, 44);
  return t;
}

// ---------------- frame ----------------
function FR(name, o) {
  o = o || {};
  var f = figma.createFrame();
  f.name = name;
  f.fills = o.fill ? fill(o.fill) : [];
  f.clipsContent = !!o.clip;
  if (o.r !== undefined) f.cornerRadius = o.r;
  if (o.stroke) { f.strokes = fill(o.stroke); f.strokeWeight = o.sw || 1; f.strokeAlign = 'INSIDE'; }
  if (o.dir) {
    f.layoutMode = o.dir === 'h' ? 'HORIZONTAL' : 'VERTICAL';
    f.itemSpacing = o.gap || 0;
    f.paddingTop = o.pt !== undefined ? o.pt : (o.p || 0);
    f.paddingBottom = o.pb !== undefined ? o.pb : (o.p || 0);
    f.paddingLeft = o.pl !== undefined ? o.pl : (o.p || 0);
    f.paddingRight = o.pr !== undefined ? o.pr : (o.p || 0);
    f.primaryAxisAlignItems = o.main || 'MIN';
    f.counterAxisAlignItems = o.cross || 'MIN';
  }
  f.resize(o.w || 100, o.h || 100);
  if (o.dir) {
    if (o.hug) { f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO'; }
    else {
      f.primaryAxisSizingMode = o.hugW ? 'AUTO' : 'FIXED';
      f.counterAxisSizingMode = o.hugH ? 'AUTO' : 'FIXED';
    }
  }
  if (o.grow) f.layoutGrow = 1;
  return f;
}

function BORDER(el, side, color) {
  el.strokes = fill(color);
  el.strokeWeight = 1;
  el.strokeAlign = 'INSIDE';
  try {
    ['Top', 'Right', 'Bottom', 'Left'].forEach(function (v) { el['stroke' + v + 'Weight'] = (v === side ? 1 : 0); });
  } catch (e) { }
}

function spacer(w, h) { return FR('spacer', { w: w || 1, h: h || 1 }); }
function growSpacer() { var s = FR('spacer', { w: 1, h: 1 }); s.layoutGrow = 1; return s; }

// ---------------- icons ----------------
var ICONS = {
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  'arrow-up-down': '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'more-v': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/>',
  kanban: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'list-filter': '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/>',
  'layout-grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'building': '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  'git-branch': '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'trending-up': '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  'workspace': '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'
};

function ICO(name, size, color) {
  var body = ICONS[name] || ICONS['chevron-right'];
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  var n = figma.createNodeFromSvg(svg);
  n.name = 'icon/' + name;
  return n;
}

function BRAND(size) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none">' +
    '<path d="M18.4 5.2c-3.9-2.7-9.3-1.1-9.3 2.3 0 2.9 3 3.5 4.9 4.2 2.2.8 3.1 1.7 3.1 2.9 0 2.2-2.4 3.4-4.6 2.9-1.8-.4-2.9-1.4-3.5-2.4" stroke="#E2455F" stroke-width="2.9" stroke-linecap="round"/>' +
    '<path d="M5.6 19.4c3.2 2.1 7.6 1.1 7.6-1.9" stroke="#E2455F" stroke-width="2.9" stroke-linecap="round" opacity="0.35"/></svg>';
  var n = figma.createNodeFromSvg(svg);
  n.name = 'brand/mark';
  return n;
}

// ---------------- composite atoms ----------------
function avatar(initial, size, bg, fg) {
  var s = size || 20;
  var a = FR('avatar', { dir: 'h', w: s, h: s, r: 999, main: 'CENTER', cross: 'CENTER', fill: bg || CF.green });
  a.appendChild(T(initial, { size: Math.round(s * 0.55), style: 'Semi Bold', color: fg || CF.greenText, lh: s }));
  return a;
}

function chipEl(tone, label) {
  var map = {
    green: [CF.green, CF.greenText], red: [CF.red, CF.redText], blue: [CF.blue, CF.blueText],
    purple: [CF.purple, CF.purpleText], amber: [CF.amber, CF.amberText], neutral: [CF.neutral, CF.sec],
    navy: [CF.navy, '#FFFFFF']
  };
  var pair = map[tone] || map.neutral;
  var c = FR('Chip / ' + tone, { dir: 'h', hug: true, gap: 5, pl: 8, pr: 8, pt: 2, pb: 2, r: 4, fill: pair[0], cross: 'CENTER' });
  var dot = figma.createEllipse();
  dot.resize(6, 6); dot.fills = fill(pair[1]); dot.name = 'dot';
  c.appendChild(dot);
  c.appendChild(T(label, { size: 11, style: 'Medium', color: pair[1], lh: 15, name: 'label' }));
  return c;
}

function countBadge(n, active) {
  var b = FR('count', { dir: 'h', hug: true, pl: 6, pr: 6, pt: 1, pb: 1, r: 999, fill: active ? '#DBEAFE' : CF.neutral, cross: 'CENTER', main: 'CENTER' });
  b.appendChild(T(String(n), { size: 11, style: 'Medium', color: active ? CF.accent : CF.sec, lh: 15 }));
  return b;
}

function tabList(items, activeIndex, opts) {
  opts = opts || {};
  var row = FR('tabs', { dir: 'h', hugW: true, h: opts.h || 32, gap: opts.gap === undefined ? 4 : opts.gap, cross: 'CENTER' });
  items.forEach(function (it, i) {
    var label = typeof it === 'string' ? it : it.label;
    var count = typeof it === 'string' ? null : it.count;
    var on = i === activeIndex;
    var tab = FR('tab/' + label, { dir: 'h', hug: true, h: opts.h || 32, gap: 6, pl: 10, pr: 10, r: 6, cross: 'CENTER', fill: on ? '#FFFFFF' : undefined, stroke: on ? CF.border : undefined });
    tab.appendChild(T(label, { size: 13, style: on ? 'Medium' : 'Regular', color: on ? CF.ink : CF.sec }));
    if (count !== null && count !== undefined) tab.appendChild(countBadge(count, on));
    row.appendChild(tab);
  });
  if (opts.wrapFill) {
    var wrap = FR('tabs-wrap', { dir: 'h', w: opts.wrapFill, h: (opts.h || 32) + 8, pl: 4, pr: 4, pt: 4, pb: 4, r: 8, fill: CF.neutral });
    row.remove();
    wrap.appendChild(row);
    return wrap;
  }
  return row;
}

function segmented(items, activeIndex, opts) {
  opts = opts || {};
  var h = opts.h || 28;
  var wrap = FR('segmented', { dir: 'h', hugW: true, h: h + 6, pl: 3, pr: 3, pt: 3, pb: 3, gap: 2, r: 7, fill: CF.neutral });
  items.forEach(function (it, i) {
    var on = i === activeIndex;
    var seg = FR('seg/' + it, { dir: 'h', hugW: true, h: h, pl: 10, pr: 10, r: 5, main: 'CENTER', cross: 'CENTER', fill: on ? '#FFFFFF' : undefined });
    seg.appendChild(T(it, { size: 12.5, style: on ? 'Medium' : 'Regular', color: on ? CF.ink : CF.sec }));
    wrap.appendChild(seg);
  });
  return wrap;
}

function inputField(placeholder, opts) {
  opts = opts || {};
  var f = FR('input', { dir: 'h', w: opts.w || 240, h: opts.h || 32, gap: 8, pl: 10, pr: 10, r: 7, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
  if (opts.icon) f.appendChild(ICO(opts.icon, 15, CF.sec));
  f.appendChild(T(placeholder, { size: 13, color: CF.sec }));
  if (opts.trailing) { f.appendChild(growSpacer()); f.appendChild(T(opts.trailing, { size: 11, color: CF.muted })); }
  return f;
}

function selectPill(label, iconName, opts) {
  opts = opts || {};
  var f = FR('select/' + label, { dir: 'h', hugW: true, h: opts.h || 32, gap: 6, pl: 10, pr: 8, r: 7, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
  if (iconName) f.appendChild(ICO(iconName, 15, CF.sec));
  f.appendChild(T(label, { size: 13, color: CF.body }));
  f.appendChild(ICO('chevron-down', 13, CF.sec));
  return f;
}

function buttonGhost(label, iconName, opts) {
  opts = opts || {};
  var f = FR('button/' + label, { dir: 'h', hugW: true, h: opts.h || 32, gap: 6, pl: 10, pr: 10, r: 7, stroke: opts.stroke === undefined ? CF.border : opts.stroke, fill: opts.fill || '#FFFFFF', cross: 'CENTER', main: 'CENTER' });
  if (iconName) f.appendChild(ICO(iconName, 15, opts.iconColor || CF.body));
  if (label) f.appendChild(T(label, { size: 13, style: 'Medium', color: opts.color || CF.body }));
  return f;
}

function buttonPrimary(label, iconName, opts) {
  opts = opts || {};
  var f = FR('button/' + label, { dir: 'h', hugW: true, h: opts.h || 32, gap: 6, pl: 12, pr: 12, r: 7, fill: CF.accentFill, cross: 'CENTER', main: 'CENTER' });
  if (iconName) f.appendChild(ICO(iconName, 15, '#FFFFFF'));
  f.appendChild(T(label, { size: 13, style: 'Medium', color: '#FFFFFF' }));
  return f;
}

function checkbox(checked, size) {
  var s = size || 16;
  var box = FR('checkbox', { w: s, h: s, r: 4, fill: checked ? CF.accentFill : '#FFFFFF', stroke: checked ? CF.accentFill : '#D9D8D4' });
  if (checked) {
    var ic = ICO('check', s - 3, '#FFFFFF');
    box.appendChild(ic);
    ic.x = 1.5; ic.y = 1.5;
  }
  return box;
}

function progressBar(pct, opts) {
  opts = opts || {};
  var w = opts.w || 120, h = opts.h || 6;
  var track = FR('progress', { w: w, h: h, r: 999, fill: opts.track || '#EDECE8' });
  var bar = FR('progress/fill', { w: Math.max(2, Math.round(w * pct / 100)), h: h, r: 999, fill: opts.color || CF.greenText });
  track.appendChild(bar); bar.x = 0; bar.y = 0;
  return track;
}

function statTile(label, value, opts) {
  opts = opts || {};
  var t = FR('stat/' + label, { dir: 'v', w: opts.w || 220, h: opts.h || 76, p: 14, r: 8, stroke: CF.border, fill: opts.fill || '#FFFFFF', gap: 4 });
  t.appendChild(T(label.toUpperCase(), { size: 10.5, style: 'Semi Bold', color: CF.sec, ls: 5 }));
  t.appendChild(T(value, { size: opts.valueSize || 22, style: 'Semi Bold', color: CF.ink, lh: 28 }));
  if (opts.sub) t.appendChild(T(opts.sub, { size: 11.5, color: CF.sec }));
  return t;
}

// ---------------- shell components ----------------
function findPage(name) {
  var all = figma.root.children;
  for (var i = 0; i < all.length; i++) if (all[i].name === name) return all[i];
  return null;
}

function navRow(label, iconName, active, opts) {
  opts = opts || {};
  var row = FR('nav/' + label, {
    dir: 'h', w: opts.w || 238, h: opts.h || 32, gap: 9, pl: 8, pr: 8, r: 7,
    cross: 'CENTER', fill: active ? CF.selected : undefined
  });
  if (iconName) row.appendChild(ICO(iconName, 16, active ? CF.accent : CF.sec));
  row.appendChild(T(label, { size: 13, style: active ? 'Medium' : 'Regular', color: active ? CF.accent : CF.ter, lh: 18 }));
  return row;
}

function makeSidebar(active) {
  var c = figma.createComponent();
  c.name = 'Active=' + active;
  c.resize(270, 900);
  c.fills = fill(CF.sidebar);
  BORDER(c, 'Right', CF.border);
  c.layoutMode = 'VERTICAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'FIXED';
  c.paddingTop = 8; c.paddingBottom = 8; c.paddingLeft = 8; c.paddingRight = 8;
  c.itemSpacing = 0;

  var hdr = FR('Header', { dir: 'h', w: 254, h: 44, gap: 10, pl: 4, pr: 4, pb: 8, cross: 'CENTER' });
  hdr.appendChild(BRAND(24));
  var brand = T('SingBuild Workspace', { size: 14, style: 'Semi Bold', color: CF.ink });
  brand.layoutGrow = 1;
  hdr.appendChild(brand);
  var colbtn = FR('action/collapse', { dir: 'h', w: 30, h: 30, main: 'CENTER', cross: 'CENTER', r: 6 });
  colbtn.appendChild(ICO('panel-left', 18, CF.sec));
  hdr.appendChild(colbtn);
  c.appendChild(hdr);

  var body = FR('Body', { dir: 'v', w: 254, pl: 4, pr: 4, pt: 4, pb: 4, gap: 0 });
  body.layoutGrow = 1;
  c.appendChild(body);

  var capWrap = FR('Caption', { dir: 'v', w: 246, pl: 8, pb: 10 });
  capWrap.appendChild(T('PROJECTS PROGRESS', { size: 11, style: 'Semi Bold', color: CF.ter, ls: 4 }));
  body.appendChild(capWrap);

  var proj = FR('Project/NBC BP03', { dir: 'h', w: 246, h: 52, gap: 8, pl: 8, pr: 8, pt: 5, pb: 5, cross: 'CENTER', r: 8 });
  proj.appendChild(ICO('chevron-down', 16, CF.ink));
  var ph = FR('heading', { dir: 'v', hugW: true, hugH: true, gap: 2 });
  ph.appendChild(T('NBC BP03', { size: 13, style: 'Semi Bold', color: CF.ink, lh: 17 }));
  ph.appendChild(T('Pan Pacific Hotel', { size: 12, color: CF.sec, lh: 15 }));
  ph.layoutGrow = 1;
  proj.appendChild(ph);
  var meta = FR('pill/44', { dir: 'h', hug: true, r: 999, pl: 8, pr: 8, pt: 2, pb: 2, main: 'CENTER', cross: 'CENTER', fill: '#DCFCE7' });
  meta.appendChild(T('44%', { size: 11.5, style: 'Semi Bold', color: '#166534', lh: 15 }));
  proj.appendChild(meta);
  body.appendChild(proj);

  var viewWrap = FR('Views', { dir: 'v', w: 246, pl: 34, pt: 2 });
  var rail = FR('Views/list', { dir: 'v', w: 212, gap: 2, pl: 8, pt: 2, pb: 2 });
  BORDER(rail, 'Left', CF.border);
  rail.appendChild(navRow('Overview', 'eye', active === 'overview', { w: 204, h: 36 }));
  rail.appendChild(navRow('Project Progress', 'chart-column', active === 'progress', { w: 204, h: 36 }));
  rail.appendChild(navRow('Update Progress', 'square-pen', active === 'update', { w: 204, h: 36 }));
  viewWrap.appendChild(rail);
  body.appendChild(viewWrap);

  var foot = FR('Footer', { dir: 'v', w: 254, pt: 10 });
  BORDER(foot, 'Top', CF.border);
  foot.appendChild(navRow('Settings', 'settings', false, { w: 246, h: 36 }));
  c.appendChild(foot);
  return c;
}

function makeTopbar() {
  var c = figma.createComponent();
  c.name = 'Shell / Top bar';
  c.resize(1170, 44);
  c.fills = fill(CF.canvas);
  BORDER(c, 'Bottom', CF.border);
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'FIXED';
  c.paddingLeft = 24; c.paddingRight = 16;
  c.itemSpacing = 8;
  c.counterAxisAlignItems = 'CENTER';

  var crumbs = FR('crumbs', { dir: 'h', h: 20, hugW: true, gap: 4, cross: 'CENTER' });
  crumbs.appendChild(T('SingBuild', { size: 13, style: 'Medium', color: CF.sec }));
  crumbs.appendChild(T('/', { size: 13, color: CF.muted }));
  var cur = T('Projects', { size: 13, style: 'Medium', color: CF.ink });
  cur.name = 'crumb/current';
  crumbs.appendChild(cur);
  crumbs.layoutGrow = 1;
  c.appendChild(crumbs);

  var actions = FR('actions', { dir: 'h', h: 32, hugW: true, gap: 4, cross: 'CENTER' });
  var pill = FR('pill/sync', { dir: 'h', hug: true, h: 20, gap: 4, pl: 8, pr: 8, main: 'CENTER', cross: 'CENTER', r: 999, fill: CF.green });
  pill.appendChild(ICO('check', 12, CF.body));
  pill.appendChild(T('Demo · local', { size: 11, style: 'Medium', color: CF.body, lh: 14 }));
  actions.appendChild(pill);
  ['search', 'more'].forEach(function (n) {
    var b = FR('action/' + n, { dir: 'h', w: 32, h: 32, main: 'CENTER', cross: 'CENTER', r: 6 });
    b.appendChild(ICO(n, 18, CF.sec));
    actions.appendChild(b);
  });
  c.appendChild(actions);
  return c;
}

async function ensureComponents() {
  var cp = findPage('03 · Components');
  if (!cp) { cp = figma.createPage(); cp.name = '03 · Components'; cp.backgrounds = fill('#F5F5F3'); }
  await figma.setCurrentPageAsync(cp);

  var out = {};
  var set = null;
  for (var i = 0; i < cp.children.length; i++) if (cp.children[i].name === 'Shell / Sidebar') set = cp.children[i];
  if (!set) {
    var variants = ['none', 'overview', 'progress', 'update'].map(makeSidebar);
    set = figma.combineAsVariants(variants, cp);
    set.name = 'Shell / Sidebar';
    set.x = 40; set.y = 200;
    variants.forEach(function (v) { v.x = 0; v.y = 0; });
    var t1 = T('SingBuild Workspace — design system', { size: 28, style: 'Bold', color: CF.ink, ls: -2 });
    cp.appendChild(t1); t1.x = 40; t1.y = 60;
    var t2 = T('Sidebar (4 nav variants) · top bar · buttons · chips — tokens from src/styles/tokens.css', { size: 13, color: CF.sec });
    cp.appendChild(t2); t2.x = 40; t2.y = 104;
  }
  out.sidebarSet = set;

  function comp(name, builder, x, y) {
    var found = null;
    for (var j = 0; j < cp.children.length; j++) if (cp.children[j].name === name) found = cp.children[j];
    if (!found) { found = builder(); found.x = x; found.y = y; }
    return found;
  }
  out.topbar = comp('Shell / Top bar', makeTopbar, 40, 1160);
  out.buttonPrimary = comp('Button / Primary', function () { return buttonPrimary('New project', 'plus'); }, 40, 1240);
  out.chips = {};
  var tones = ['green', 'red', 'blue', 'purple', 'amber', 'neutral'];
  var cx = 40;
  tones.forEach(function (t) {
    var b = function () { return chipEl(t, t === 'neutral' ? 'Label' : 'Status'); };
    var node = null;
    for (var k = 0; k < cp.children.length; k++) if (cp.children[k].name === 'Chip / ' + t) node = cp.children[k];
    if (!node) { node = b(); node.x = cx; node.y = 1310; cx += node.width + 12; }
    out.chips[t] = node;
  });
  return out;
}

function variantOf(set, value) {
  for (var i = 0; i < set.children.length; i++) {
    var vb = set.children[i];
    if (vb.type === 'COMPONENT' && vb.name === 'Active=' + value) return vb;
  }
  return set.children[0];
}

// ---------------- screens ----------------
async function gotoPage(name, bg) {
  var p = findPage(name);
  if (!p) { p = figma.createPage(); p.name = name; }
  if (bg) p.backgrounds = fill(bg);
  await figma.setCurrentPageAsync(p);
  return p;
}

// Desktop screen scaffold: sidebar + top bar + content column.
async function desktopScreen(name, opts) {
  opts = opts || {};
  var page = await gotoPage('01 · Desktop screens', CF.pageBg);
  var existing = null;
  for (var i = 0; i < page.children.length; i++) if (page.children[i].name === name) existing = page.children[i];
  if (existing) existing.remove();

  var comps = await ensureComponents();
  await figma.setCurrentPageAsync(page);

  var f = FR(name, { w: 1440, h: 900, fill: CF.canvas, clip: true });
  f.x = opts.x || 0; f.y = opts.y || 0;

  var sb = variantOf(comps.sidebarSet, opts.sidebar || 'none').createInstance();
  f.appendChild(sb); sb.x = 0; sb.y = 0;

  var tb = comps.topbar.createInstance();
  f.appendChild(tb); tb.x = 270; tb.y = 0;
  var crumb = tb.findOne(function (n) { return n.name === 'crumb/current'; });
  if (crumb && opts.crumb) crumb.characters = opts.crumb;

  var canvas = FR('Canvas', { dir: 'v', w: 1170, h: 856 });
  f.appendChild(canvas); canvas.x = 270; canvas.y = 44;

  return { frame: f, canvas: canvas, page: page, comps: comps };
}

// Content column for plain pages (Projects, Search): 978 wide, 96 padding.
function plainContent(canvas, opts) {
  opts = opts || {};
  var c = FR('Content', { dir: 'v', w: 978, h: 856, gap: 0 });
  canvas.appendChild(c); c.x = 96; c.y = opts.y || 32;
  return c;
}

// Page heading row: 40/48 title on the left, optional actions on the right.
function pageHeading(title, subtitle, opts) {
  opts = opts || {};
  var wrap = FR('Page heading', { dir: 'v', w: opts.w || 978, gap: 8 });
  var top = FR('Title row', { dir: 'h', w: opts.w || 978, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  top.appendChild(T(title, { size: 40, style: 'Bold', color: CF.ink, lh: 48, ls: -2 }));
  if (opts.action) top.appendChild(opts.action);
  wrap.appendChild(top);
  if (subtitle) wrap.appendChild(T(subtitle, { size: 14, color: CF.sec, lh: 20 }));
  return wrap;
}

// ---------------- generic layout helpers ----------------
function vcol(name, w, gap, opts) {
  opts = opts || {};
  var f = FR(name, { dir: 'v', w: w || 200, gap: gap || 0, fill: opts.fill, r: opts.r, stroke: opts.stroke, clip: opts.clip });
  return f;
}
function divider(w, color) {
  var d = FR('divider', { w: w || 200, h: 1, fill: color || CF.border });
  return d;
}
function dot8(color) {
  var e = figma.createEllipse();
  e.resize(7, 7); e.fills = fill(color); e.name = 'dot';
  return e;
}
function sectionSummary(label, count, tone) {
  var row = hrow('summary/' + label, 1080, 8);
  var iconName = tone === 'danger' ? 'alert-triangle' : tone === 'today' ? 'calendar' : 'clock';
  row.appendChild(ICO(iconName, 16, tone === 'danger' ? '#C93B3B' : CF.body));
  row.appendChild(T(label, { size: 14, style: 'Semi Bold', color: CF.ink }));
  row.appendChild(countBadge(count, false));
  row.appendChild(growSpacer());
  row.appendChild(ICO('chevron-down', 16, CF.sec));
  return row;
}

// A single task card from the Tasks page: checkbox + fields.

// ---------------- page scaffolds ----------------
// Surface page: sidebar + top bar + workspace-surface card, content inset 32.

// Wide page (NBC views): full-bleed canvas content, 36 inset.

// Simple centered column page (Search).
async function centerPage(name, opts) {
  opts = opts || {};
  var scr = await desktopScreen(name, opts);
  var col = FR('Content', { dir: 'v', w: 720, gap: 0 });
  scr.canvas.appendChild(col); col.x = 225; col.y = 40;
  return { frame: scr.frame, page: scr.page, col: col };
}

function card(name, o) {
  return FR(name, Object.assign({ dir: 'v', r: 10, stroke: CF.border, fill: '#FFFFFF' }, o || {}));
}

// Accepts either hrow(name, { w, gap }) or the older positional hrow(name, w, gap).
function hrow(name, o, gap) {
  if (typeof o === 'number') o = { w: o, gap: gap || 0 };
  return FR(name, Object.assign({ dir: 'h' }, o || {}));
}
function vrow(name, o, gap) {
  if (typeof o === 'number') o = { w: o, gap: gap || 0 };
  return FR(name, Object.assign({ dir: 'v' }, o || {}));
}
function rule(parent, color) {
  var r = FR('divider', { w: parent.width, h: 1, fill: color || CF.border });
  parent.appendChild(r);
  return r;
}

function sectionTitle(text, o) {
  o = o || {};
  var row = FR('section/' + text, { dir: 'h', w: o.w || 1035, h: o.h || 28, gap: 8, cross: 'CENTER' });
  if (o.icon) row.appendChild(ICO(o.icon, 16, o.tone === 'danger' ? CF.redText : CF.ter));
  row.appendChild(T(text, { size: 13, style: 'Semi Bold', color: o.tone === 'danger' ? CF.redText : CF.ink }));
  if (o.count !== undefined) {
    var pill = FR('pill/count', { dir: 'h', hug: true, pl: 6, pr: 6, pt: 1, pb: 1, r: 999, fill: o.tone === 'danger' ? CF.red : CF.neutral, main: 'CENTER', cross: 'CENTER' });
    pill.appendChild(T(String(o.count), { size: 11, style: 'Medium', color: o.tone === 'danger' ? CF.redText : CF.sec, lh: 15 }));
    row.appendChild(pill);
  }
  if (o.right !== false) { row.appendChild(growSpacer()); row.appendChild(ICO(o.expanded === false ? 'chevron-right' : 'chevron-down', 16, CF.sec)); }
  return row;
}

function chipPill(text, bg, fg, opts) {
  opts = opts || {};
  var p = FR('chip/' + text, { dir: 'h', hug: true, h: opts.h || 24, gap: 5, pl: 8, pr: 8, r: 6, fill: bg, cross: 'CENTER', stroke: opts.stroke });
  if (opts.dot) {
    var d = figma.createEllipse(); d.resize(6, 6); d.fills = fill(fg); d.name = 'dot';
    p.appendChild(d);
  }
  p.appendChild(T(text, { size: 12, style: 'Medium', color: fg, lh: 16 }));
  if (opts.caret) p.appendChild(ICO('chevron-down', 13, fg));
  return p;
}

var STATUS_TONE = {
  'Blocked': ['#FFE2DD', '#C93B3B'],
  'In progress': ['#E0F2FE', '#2563EB'],
  'In review': ['#FDECC8', '#BB8420'],
  'Not started': ['#F1F1EF', '#6B6964'],
  'Done': ['#DBEDDB', '#3A7355']
};
var PRIORITY_TONE = {
  'Urgent': ['#FFE2DD', '#C93B3B'],
  'High': ['#FDECC8', '#BB8420'],
  'Medium': ['#D3E5EF', '#337EA9'],
  'Low': ['#F1F1EF', '#6B6964']
};

function statusChip(status) {
  var tone = STATUS_TONE[status] || STATUS_TONE['Not started'];
  return chipPill(status, tone[0], tone[1], { dot: true, caret: true });
}
function priorityChip(priority) {
  var tone = PRIORITY_TONE[priority] || PRIORITY_TONE['Low'];
  return chipPill(priority, tone[0], tone[1], { dot: true, caret: true });
}

// Task row card used by Tasks page and mobile.
function taskCard(o) {
  o = o || {};
  var w = o.w || 1035;
  var wrap = FR('Task/' + (o.title || 'row'), { dir: 'h', w: w, gap: 12, cross: 'MIN' });
  var check = checkbox(!!o.checked, 16);
  wrap.appendChild(check);
  var col = FR('fields', { dir: 'v', w: w - 28, gap: 6 });
  var title = FR('title', { dir: 'h', w: w - 28, h: 34, pl: 10, r: 6, stroke: o.focus ? CF.accentFill : CF.borderSoft, cross: 'CENTER' });
  title.appendChild(T(o.title || 'Untitled task', { size: 15, style: 'Medium', color: CF.ink }));
  col.appendChild(title);
  if (o.project) col.appendChild(T(o.project, { size: 12, color: CF.sec, lh: 16 }));
  if (o.chips !== false) {
    var chips = FR('meta', { dir: 'h', w: w - 28, h: 30, gap: 8, cross: 'CENTER' });
    if (o.status) chips.appendChild(statusChip(o.status));
    if (o.priority) chips.appendChild(priorityChip(o.priority));
    if (o.date) {
      chips.appendChild(T(o.date, { size: 13, color: CF.body }));
      chips.appendChild(ICO('calendar', 15, CF.sec));
    }
    col.appendChild(chips);
  }
  if (o.notes) {
    var note = FR('notes', { dir: 'v', w: w - 28, h: 58, p: 10, r: 8, stroke: CF.borderSoft });
    note.appendChild(T(o.notes, { size: 13, color: CF.body, w: w - 48, lh: 19 }));
    col.appendChild(note);
  }
  var more = FR('more', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
  more.appendChild(ICO('chevron-right', 12, CF.sec));
  more.appendChild(T('More fields', { size: 12, color: CF.sec }));
  col.appendChild(more);
  wrap.appendChild(col);
  return wrap;
}

// Mobile scaffold: 393 x 852 with app bar and bottom tab bar.

// Card surface (workspace-surface): 1144 x 832 at 10,12 inside canvas.
function surfaceCard(canvas, opts) {
  opts = opts || {};
  var s = FR('Surface', {
    dir: 'v', w: opts.w || 1144, h: opts.h || 832, p: 32, r: 8,
    stroke: CF.border, fill: '#FFFFFF', gap: 0
  });
  canvas.appendChild(s);
  s.x = opts.x === undefined ? 10 : opts.x;
  s.y = opts.y === undefined ? 12 : opts.y;
  return s;
}

// Page inside a workspace-surface card (Tasks, Settings, project views).
async function surfacePage(name, opts) {
  opts = opts || {};
  var scr = await desktopScreen(name, opts);
  var s = surfaceCard(scr.canvas, { w: opts.w || 1144, h: opts.h || 832 });
  var col = FR('Surface body', { dir: 'v', w: (opts.w || 1144) - 64, gap: 0 });
  s.appendChild(col); col.x = 32; col.y = 32;
  return { frame: scr.frame, page: scr.page, surface: s, col: col };
}

// Wide plain page used by the NBC project views.
async function widePage(name, opts) {
  opts = opts || {};
  var scr = await desktopScreen(name, opts);
  var col = FR('Content', { dir: 'v', w: 1108, gap: 0 });
  scr.canvas.appendChild(col); col.x = 36; col.y = 32;
  return { frame: scr.frame, page: scr.page, col: col };
}

function frameLabel(page, text, x, y) {
  var lbl = T(text, { size: 16, style: 'Semi Bold', color: CF.ink, name: 'label' });
  page.appendChild(lbl); lbl.x = x; lbl.y = y;
  return lbl;
}

// ---------------- mobile scaffold ----------------
var MOBILE_ICONS = {
  workspace: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/>',
  'file-stack': '<path d="M9 3h6l4 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v4h4"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'
};

function mTopBar(crumb) {
  var bar = FR('Top bar', { dir: 'h', w: 393, h: 54, pl: 16, pr: 16, gap: 10, cross: 'CENTER' });
  BORDER(bar, 'Bottom', CF.borderSoft);
  var icon = ICO('panel-left', 19, CF.ink);
  bar.appendChild(icon);
  bar.appendChild(T(crumb, { size: 14, style: 'Medium', color: CF.ink }));
  bar.appendChild(growSpacer());
  var pill = FR('pill/sync', { dir: 'h', hug: true, h: 22, gap: 4, pl: 8, pr: 8, r: 999, fill: CF.green, cross: 'CENTER' });
  pill.appendChild(ICO('check', 11, CF.body));
  pill.appendChild(T('Demo · local', { size: 11, style: 'Medium', color: CF.body, lh: 14 }));
  bar.appendChild(pill);
  bar.appendChild(ICO('search', 18, CF.ink));
  bar.appendChild(ICO('more', 18, CF.ink));
  return bar;
}

function mTabBar(active) {
  var items = [
    ['Workspace', 'workspace'], ['', 'plus'], ['Progress', 'chart'], ['Search', 'search'], ['Settings', 'settings']
  ];
  var bar = FR('Tab bar', { dir: 'h', w: 393, h: 64, pl: 8, pr: 8, cross: 'CENTER', main: 'SPACE_BETWEEN', fill: '#FDFDFC' });
  BORDER(bar, 'Top', CF.border);
  items.forEach(function (it) {
    if (!it[1] || it[1] === 'plus') {
      var fab = FR('fab', { dir: 'h', w: 56, h: 56, r: 16, main: 'CENTER', cross: 'CENTER', fill: CF.accentFill });
      fab.appendChild(ICO('plus', 22, '#FFFFFF'));
      bar.appendChild(fab);
      return;
    }
    var on = it[0] === active;
    var cell = FR('tab/' + it[0], { dir: 'v', w: 64, gap: 3, cross: 'CENTER', main: 'CENTER' });
    cell.appendChild(ICO(it[1], 20, on ? CF.ink : CF.sec));
    cell.appendChild(T(it[0], { size: 10.5, color: on ? CF.ink : CF.sec }));
    bar.appendChild(cell);
  });
  return bar;
}

async function mobileScreen(name, opts) {
  opts = opts || {};
  var page = await gotoPage('02 · Mobile screens', CF.pageBg);
  var existing = null;
  for (var i = 0; i < page.children.length; i++) if (page.children[i].name === name) existing = page.children[i];
  if (existing) existing.remove();

  var f = FR(name, { w: 393, h: 852, fill: CF.canvas, clip: true });
  f.x = opts.x || 0; f.y = opts.y || 0;

  var bar = mTopBar(opts.crumb || 'Projects');
  f.appendChild(bar); bar.x = 0; bar.y = 0;

  var col = FR('Content', { dir: 'v', w: 393, h: 734, pl: 20, pr: 20, pt: 20, gap: 0, clip: true });
  f.appendChild(col); col.x = 0; col.y = 54;

  var tabs = mTabBar(opts.tab || 'Workspace');
  f.appendChild(tabs); tabs.x = 0; tabs.y = 788;

  frameLabel(page, opts.label || name, 0, (opts.y || 0) - 34);
  return { frame: f, col: col, page: page };
}


    // ---------------- screens ----------------
    // ===== m01-progress.js =====
    results.push(await (async function () {
// M01 · Mobile — Projects Progress  (/projects-progress)
var m1 = await mobileScreen('M01 · Mobile — Projects Progress', { crumb: 'Projects Progress', tab: 'Progress', x: 0, y: 0, label: 'M01 · Progress — /projects-progress' });
var c = m1.col;

c.appendChild(T('Projects Progress', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('Project quantities & updates', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 20));

// NBC project card
var card = FR('card/NBC BP03', { dir: 'v', w: 353, p: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 12 });
var top = FR('top', { dir: 'h', w: 321, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var tile = FR('tile', { dir: 'h', w: 30, h: 30, r: 6, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
tile.appendChild(ICO('building', 16, CF.blueText));
top.appendChild(tile);
top.appendChild(T('44%', { size: 15, style: 'Bold', color: CF.accent }));
card.appendChild(top);

var info = FR('info', { dir: 'v', w: 321, gap: 3 });
info.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 14.5, style: 'Bold', color: CF.ink }));
info.appendChild(T('Interior fitout and services', { size: 12, color: CF.sec }));
card.appendChild(info);

card.appendChild(progressBar(44, { w: 321, h: 6 }));

var foot = FR('foot', { dir: 'h', w: 321, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var due = FR('due', { dir: 'h', hug: true, gap: 5, cross: 'CENTER' });
due.appendChild(ICO('flag', 12, CF.sec));
due.appendChild(T('Dec 31, 2026', { size: 11.5, color: CF.sec }));
foot.appendChild(due);
foot.appendChild(avatar('K', 18));
card.appendChild(foot);

c.appendChild(card);

return { frame: m1.frame.id, name: m1.frame.name };

    })());

    // ===== m02-nbc-activities.js =====
    results.push(await (async function () {
// M02 · Mobile — NBC BP03 Activities  (/projects-progress/nbc-bp03/activities)
var m2 = await mobileScreen('M02 · Mobile — NBC Activities', { crumb: 'NBC BP03 Activities', tab: 'Progress', x: 0, y: 940, label: 'M02 · Activities — /projects-progress/nbc-bp03/activities' });
var c = m2.col;

c.appendChild(T('Activities', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('WBS breakdown & progress status', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 16));

c.appendChild(inputField('Filter activities…', { w: 353, h: 36, icon: 'search' }));
c.appendChild(spacer(1, 14));

var actList = FR('actList', { dir: 'v', w: 353, gap: 10 });
var acts = [
  { wbs: '1.6.1.1', name: 'Survey and layout grid', handler: 'Sitha', prog: 100, st: 'Done', tone: 'success' },
  { wbs: '1.6.1.2', name: 'Install board & reinforcement', handler: 'Tola', prog: 25, st: 'In progress', tone: 'primary' }
];

acts.forEach(function (a) {
  var aCard = FR('card/' + a.wbs, { dir: 'v', w: 353, p: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 8 });
  var aTop = FR('top', { dir: 'h', w: 325, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  aTop.appendChild(T(a.wbs + ' · ' + a.handler, { size: 11.5, style: 'Semi Bold', color: CF.sec }));
  aTop.appendChild(statusChip(a.st));
  aCard.appendChild(aTop);

  aCard.appendChild(T(a.name, { size: 13.5, style: 'Bold', color: CF.ink }));
  aCard.appendChild(progressBar(a.prog, { w: 325, h: 5 }));

  var aFoot = FR('foot', { dir: 'h', w: 325, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  aFoot.appendChild(T('Weight: ' + (a.prog === 100 ? '25%' : '75%'), { size: 11.5, color: CF.sec }));
  aFoot.appendChild(T(a.prog + '% achieved', { size: 12, style: 'Semi Bold', color: CF.ink }));
  aCard.appendChild(aFoot);

  actList.appendChild(aCard);
});
c.appendChild(actList);

return { frame: m2.frame.id, name: m2.frame.name };

    })());

    // ===== m03-nbc-update.js =====
    results.push(await (async function () {
// M03 · Mobile — NBC Update Progress  (/projects-progress/nbc-bp03/update)
var m3 = await mobileScreen('M03 · Mobile — NBC Update', { crumb: 'Update Progress', tab: 'Progress', x: 0, y: 1880, label: 'M03 · Update — /projects-progress/nbc-bp03/update' });
var c = m3.col;

c.appendChild(T('Update Progress', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('Week 46 (Nov 9 – 15, 2026)', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 16));

var form = FR('formCard', { dir: 'v', w: 353, p: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 14 });
var hRow = FR('hrow', { dir: 'h', w: 321, main: 'SPACE_BETWEEN', cross: 'CENTER' });
hRow.appendChild(T('Handler', { size: 12.5, style: 'Medium', color: CF.ink }));
hRow.appendChild(selectPill('Tola', 'user', { h: 30 }));
form.appendChild(hRow);
form.appendChild(divider(321));

var aTitle = FR('atitle', { dir: 'v', w: 321, gap: 2 });
aTitle.appendChild(T('1.6.1.2 · Install board & reinforcement', { size: 13.5, style: 'Bold', color: CF.ink }));
aTitle.appendChild(T('Baseline: 25% · Relative weight: 75%', { size: 11.5, color: CF.sec }));
form.appendChild(aTitle);

var valCol = FR('val', { dir: 'v', w: 321, gap: 6 });
valCol.appendChild(T('New progress (%)', { size: 12, style: 'Medium', color: CF.ink }));
valCol.appendChild(inputField('50', { w: 321, h: 38 }));
form.appendChild(valCol);

var noteCol = FR('note', { dir: 'v', w: 321, gap: 6 });
noteCol.appendChild(T('Site remarks', { size: 12, style: 'Medium', color: CF.ink }));
noteCol.appendChild(inputField('Frames fixed and inspected.', { w: 321, h: 38 }));
form.appendChild(noteCol);

var fBtn = FR('fbtn', { dir: 'h', w: 321, h: 38, r: 8, fill: CF.accent, main: 'CENTER', cross: 'CENTER' });
fBtn.appendChild(T('Submit update', { size: 13.5, style: 'Semi Bold', color: '#FFFFFF' }));
form.appendChild(fBtn);

c.appendChild(form);

return { frame: m3.frame.id, name: m3.frame.name };

    })());

    // ===== m04-projects.js =====
    results.push(await (async function () {
// M04 · Mobile — Projects  (/projects?workspace=personal)
var m4 = await mobileScreen('M04 · Mobile — Projects', { crumb: 'Personal Workspace', tab: 'Workspace', x: 0, y: 2820, label: 'M04 · Projects — /projects' });
var c = m4.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('Projects', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
head.appendChild(buttonPrimary('New', 'plus', { h: 32 }));
c.appendChild(head);
c.appendChild(spacer(1, 16));

var pList = [
  { name: 'Website Redesign', desc: 'Design system unification and performance refresh.', due: 'Due Nov 12', icon: 'globe', tint: '#D3E5EF', text: '#337EA9' },
  { name: 'Mobile App', desc: 'A thoughtful companion workspace for life on the go.', due: 'Due Dec 5', icon: 'smartphone', tint: '#FCE9E0', text: '#D9730D' },
  { name: 'Q4 Planning', desc: 'Strategic roadmap, priorities, and resource allocation.', due: 'Due Oct 31', icon: 'chart-column', tint: '#E4F1E2', text: '#3A7355' }
];

pList.forEach(function (p) {
  var pCard = FR('card/' + p.name, { dir: 'v', w: 353, p: 14, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 10 });
  var pTop = FR('top', { dir: 'h', w: 325, gap: 10, cross: 'CENTER' });
  var tile = FR('tile', { dir: 'h', w: 28, h: 28, r: 6, fill: p.tint, main: 'CENTER', cross: 'CENTER' });
  tile.appendChild(ICO(p.icon, 15, p.text));
  pTop.appendChild(tile);
  pTop.appendChild(T(p.name, { size: 14, style: 'Bold', color: CF.ink }));
  pCard.appendChild(pTop);

  pCard.appendChild(T(p.desc, { size: 12, color: CF.sec, lh: 16 }));

  var pFoot = FR('foot', { dir: 'h', w: 325, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  pFoot.appendChild(T(p.due, { size: 11.5, color: CF.sec }));
  pFoot.appendChild(avatar('K', 18));
  pCard.appendChild(pFoot);

  c.appendChild(pCard);
  c.appendChild(spacer(1, 10));
});

return { frame: m4.frame.id, name: m4.frame.name };

    })());

    // ===== m05-project-table.js =====
    results.push(await (async function () {
// M05 · Mobile — Project Table  (/projects/website/table)
var m5 = await mobileScreen('M05 · Mobile — Project Table', { crumb: 'Website Redesign', tab: 'Workspace', x: 0, y: 3760, label: 'M05 · Table — /projects/website/table' });
var c = m5.col;

var pHead = FR('phead', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitle = FR('ptitle', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
var pIcon = FR('picon', { dir: 'h', w: 26, h: 26, r: 6, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pIcon.appendChild(ICO('globe', 14, CF.blueText));
pTitle.appendChild(pIcon);
pTitle.appendChild(T('Website Redesign', { size: 18, style: 'Bold', color: CF.ink }));
pHead.appendChild(pTitle);
pHead.appendChild(buttonPrimary('New', 'plus', { h: 28 }));
c.appendChild(pHead);
c.appendChild(spacer(1, 14));

var tbRow = FR('tbrow', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
tbRow.appendChild(selectPill('All Tasks', 'table', { h: 30 }));
tbRow.appendChild(selectPill('Filter', 'sliders', { h: 30 }));
c.appendChild(tbRow);
c.appendChild(spacer(1, 14));

var tRows = [
  { title: 'Finalize token contrasts for WCAG AA', pri: 'High', due: 'Nov 6', done: true },
  { title: 'Build navigation drawer gesture prototype', pri: 'High', due: 'Nov 10', done: false },
  { title: 'Review engineering OKR draft', pri: 'Medium', due: 'Nov 12', done: false },
  { title: 'Export typography hierarchy tokens', pri: 'Medium', due: 'Nov 8', done: false },
  { title: 'Map calendar provider requirements', pri: 'Urgent', due: 'Nov 8', done: false }
];

tRows.forEach(function (t) {
  var row = FR('row/' + t.title, { dir: 'h', w: 353, p: 12, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 10, cross: 'CENTER' });
  row.appendChild(checkbox(t.done, 16));
  var col = FR('col', { dir: 'v', w: 230, gap: 2 });
  col.appendChild(T(t.title, { size: 12.5, style: t.done ? 'Regular' : 'Medium', color: t.done ? CF.sec : CF.ink }));
  col.appendChild(T('Due ' + t.due, { size: 11, color: CF.sec }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(priorityChip(t.pri));
  c.appendChild(row);
  c.appendChild(spacer(1, 8));
});

return { frame: m5.frame.id, name: m5.frame.name };

    })());

    // ===== m06-project-board.js =====
    results.push(await (async function () {
// M06 · Mobile — Project Board  (/projects/website/board)
var m6 = await mobileScreen('M06 · Mobile — Project Board', { crumb: 'Website Redesign', tab: 'Workspace', x: 0, y: 4700, label: 'M06 · Board — /projects/website/board' });
var c = m6.col;

var pHead = FR('phead', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitle = FR('ptitle', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
var pIcon = FR('picon', { dir: 'h', w: 26, h: 26, r: 6, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pIcon.appendChild(ICO('globe', 14, CF.blueText));
pTitle.appendChild(pIcon);
pTitle.appendChild(T('Website Redesign', { size: 18, style: 'Bold', color: CF.ink }));
pHead.appendChild(pTitle);
pHead.appendChild(buttonPrimary('New', 'plus', { h: 28 }));
c.appendChild(pHead);
c.appendChild(spacer(1, 14));

var tbRow = FR('tbrow', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
tbRow.appendChild(selectPill('Board', 'kanban', { h: 30 }));
tbRow.appendChild(selectPill('Filter', 'sliders', { h: 30 }));
c.appendChild(tbRow);
c.appendChild(spacer(1, 14));

// mobile kanban section (showing In progress)
var colSec = FR('colSec', { dir: 'v', w: 353, p: 12, r: 10, fill: '#F8F8F7', gap: 10 });
var colHead = FR('colHead', { dir: 'h', w: 329, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var colTitle = FR('ct', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
colTitle.appendChild(T('In progress', { size: 13, style: 'Bold', color: CF.ink }));
colTitle.appendChild(countBadge(2, true));
colHead.appendChild(colTitle);
colHead.appendChild(ICO('plus', 14, CF.sec));
colSec.appendChild(colHead);

var bCards = [
  { title: 'Build navigation drawer gesture prototype', pri: 'High', due: 'Nov 10' },
  { title: 'Export typography hierarchy tokens', pri: 'Medium', due: 'Nov 8' }
];

bCards.forEach(function (card) {
  var kCard = FR('card/' + card.title, { dir: 'v', w: 329, p: 12, r: 8, stroke: CF.border, fill: '#FFFFFF', gap: 8 });
  kCard.appendChild(T(card.title, { size: 13, style: 'Medium', color: CF.ink, lh: 17 }));
  var kFoot = FR('foot', { dir: 'h', w: 305, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  kFoot.appendChild(priorityChip(card.pri));
  kFoot.appendChild(T(card.due, { size: 11.5, color: CF.sec }));
  kCard.appendChild(kFoot);
  colSec.appendChild(kCard);
});

c.appendChild(colSec);

return { frame: m6.frame.id, name: m6.frame.name };

    })());

    // ===== m07-tasks.js =====
    results.push(await (async function () {
// M07 · Mobile — My Tasks  (/tasks)
var m7 = await mobileScreen('M07 · Mobile — Tasks', { crumb: 'My tasks', tab: 'Workspace', x: 0, y: 5640, label: 'M07 · Tasks — /tasks' });
var c = m7.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('My tasks', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
head.appendChild(buttonPrimary('New', 'plus', { h: 32 }));
c.appendChild(head);
c.appendChild(spacer(1, 14));

c.appendChild(inputField('Search your tasks…', { w: 353, h: 36, icon: 'search' }));
c.appendChild(spacer(1, 16));

// overdue section
var oSec = FR('oSec', { dir: 'v', w: 353, p: 12, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 10 });
var oHead = FR('oHead', { dir: 'h', w: 329, main: 'SPACE_BETWEEN', cross: 'CENTER' });
oHead.appendChild(T('Overdue (2)', { size: 13, style: 'Bold', color: CF.redText }));
oSec.appendChild(oHead);

var oTasks = [
  { title: 'Map calendar provider requirements', proj: 'Website Redesign', pri: 'Urgent' },
  { title: 'Finalize token contrasts for WCAG AA', proj: 'Website Redesign', pri: 'High' }
];

oTasks.forEach(function (t) {
  var tRow = FR('trow', { dir: 'h', w: 329, p: 8, r: 6, fill: '#FFF8F7', stroke: '#FDDCD7', gap: 10, cross: 'CENTER' });
  tRow.appendChild(checkbox(false, 16));
  var col = FR('col', { dir: 'v', w: 220, gap: 2 });
  col.appendChild(T(t.title, { size: 12.5, style: 'Medium', color: CF.ink }));
  col.appendChild(T(t.proj, { size: 11, color: CF.sec }));
  tRow.appendChild(col);
  tRow.appendChild(growSpacer());
  tRow.appendChild(priorityChip(t.pri));
  oSec.appendChild(tRow);
});
c.appendChild(oSec);
c.appendChild(spacer(1, 14));

// today section
var tSec = FR('tSec', { dir: 'v', w: 353, p: 12, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 10 });
tSec.appendChild(T('Today (1)', { size: 13, style: 'Bold', color: CF.ink }));
var tRow1 = FR('trow1', { dir: 'h', w: 329, p: 8, r: 6, fill: '#FAFAF9', gap: 10, cross: 'CENTER' });
tRow1.appendChild(checkbox(false, 16));
var col1 = FR('col1', { dir: 'v', w: 220, gap: 2 });
col1.appendChild(T('Engineering Standup', { size: 12.5, style: 'Medium', color: CF.ink }));
col1.appendChild(T('09:00 – 10:00 · Team', { size: 11, color: CF.sec }));
tRow1.appendChild(col1);
tRow1.appendChild(growSpacer());
tRow1.appendChild(statusChip('In progress'));
tSec.appendChild(tRow1);
c.appendChild(tSec);

return { frame: m7.frame.id, name: m7.frame.name };

    })());

    // ===== m08-pages.js =====
    results.push(await (async function () {
// M08 · Mobile — Pages  (/p/weekly-plan)
var m8 = await mobileScreen('M08 · Mobile — Page Editor', { crumb: 'Weekly plan', tab: 'Workspace', x: 0, y: 6580, label: 'M08 · Pages — /p/weekly-plan' });
var c = m8.col;

var pIcon = FR('picon', { dir: 'h', w: 32, h: 32, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pIcon.appendChild(ICO('star', 16, CF.blueText));
c.appendChild(pIcon);
c.appendChild(spacer(1, 10));

c.appendChild(T('Weekly plan', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('Inside Workspace · Edited today', { size: 12, color: CF.sec }));
c.appendChild(spacer(1, 16));
c.appendChild(divider(353));
c.appendChild(spacer(1, 16));

// block note content
c.appendChild(T('Sprint Priorities', { size: 16, style: 'Bold', color: CF.ink }));
c.appendChild(spacer(1, 8));
c.appendChild(T('Align on the mobile responsive navigation patterns and verify glass blur fallback on WebKit engines.', { size: 13, color: CF.body, lh: 19 }));
c.appendChild(spacer(1, 14));

var checkList = FR('checks', { dir: 'v', w: 353, gap: 8 });
var cItems = [
  ['Validate offline synchronization in IndexedDB', true],
  ['Audit WCAG AA color contrast across theme tokens', false],
  ['Prepare weekly progress report for Pan Pacific project', false]
];

cItems.forEach(function (ci) {
  var row = FR('checkRow', { dir: 'h', w: 353, gap: 10, cross: 'CENTER' });
  row.appendChild(checkbox(ci[1], 16));
  row.appendChild(T(ci[0], { size: 13, color: ci[1] ? CF.sec : CF.ink, style: ci[1] ? 'Regular' : 'Medium' }));
  checkList.appendChild(row);
});
c.appendChild(checkList);

return { frame: m8.frame.id, name: m8.frame.name };

    })());

    // ===== m09-calendar-week.js =====
    results.push(await (async function () {
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

    })());

    // ===== m10-settings-appearance.js =====
    results.push(await (async function () {
// M10 · Mobile — Settings Appearance  (/settings/appearance)
var m10 = await mobileScreen('M10 · Mobile — Settings', { crumb: 'Settings', tab: 'Settings', x: 0, y: 8460, label: 'M10 · Settings — /settings/appearance' });
var c = m10.col;

c.appendChild(T('Settings', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
c.appendChild(spacer(1, 4));
c.appendChild(T('A workspace that feels like yours.', { size: 13, color: CF.sec }));
c.appendChild(spacer(1, 16));

// section tabs
var sTabs = segmented(['Appearance', 'Account'], 0, { h: 32, w: 353 });
c.appendChild(sTabs);
c.appendChild(spacer(1, 16));

// Display card
var dCard = FR('dcard', { dir: 'h', w: 353, p: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var dText = FR('dt', { dir: 'v', hug: true, gap: 2 });
dText.appendChild(T('Reduce motion', { size: 13.5, style: 'Medium', color: CF.ink }));
dText.appendChild(T('Gentler transitions', { size: 11.5, color: CF.sec }));
dCard.appendChild(dText);
dCard.appendChild(checkbox(false, 18));
c.appendChild(dCard);
c.appendChild(spacer(1, 14));

// Calendar options card
var cCard = FR('ccard', { dir: 'v', w: 353, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var cRow1 = FR('row1', { dir: 'h', w: 353, h: 48, pl: 14, pr: 14, cross: 'CENTER', main: 'SPACE_BETWEEN' });
cRow1.appendChild(T('Week starts on', { size: 13, color: CF.ink }));
cRow1.appendChild(T('Monday ›', { size: 12.5, color: CF.sec }));
cCard.appendChild(cRow1);
BORDER(cRow1, 'Bottom', CF.borderSoft);

var cRow2 = FR('row2', { dir: 'h', w: 353, h: 48, pl: 14, pr: 14, cross: 'CENTER', main: 'SPACE_BETWEEN' });
cRow2.appendChild(T('Time format', { size: 13, color: CF.ink }));
cRow2.appendChild(T('24-hour ›', { size: 12.5, color: CF.sec }));
cCard.appendChild(cRow2);
c.appendChild(cCard);
c.appendChild(spacer(1, 14));

// Backup card
var bCard = FR('bcard', { dir: 'h', w: 353, p: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var bText = FR('bt', { dir: 'v', hug: true, gap: 2 });
bText.appendChild(T('Export backup', { size: 13.5, style: 'Medium', color: CF.ink }));
bText.appendChild(T('Save JSON workspace archive', { size: 11.5, color: CF.sec }));
bCard.appendChild(bText);
bCard.appendChild(buttonGhost('Export', 'download', { h: 30 }));
c.appendChild(bCard);

return { frame: m10.frame.id, name: m10.frame.name };

    })());

    // ===== m11-trash.js =====
    results.push(await (async function () {
// M11 · Mobile — Trash  (/trash)
var m11 = await mobileScreen('M11 · Mobile — Trash', { crumb: 'Trash', tab: 'Workspace', x: 0, y: 9400, label: 'M11 · Trash — /trash' });
var c = m11.col;

var head = FR('head', { dir: 'h', w: 353, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('Trash', { size: 26, style: 'Bold', color: CF.ink, lh: 32, ls: -1 }));
head.appendChild(buttonGhost('Empty', 'trash', { h: 28, color: CF.redText, iconColor: CF.redText }));
c.appendChild(head);
c.appendChild(spacer(1, 4));
c.appendChild(T('3 items · Deleted pages and tasks', { size: 12.5, color: CF.sec }));
c.appendChild(spacer(1, 16));

var tPanel = FR('tpanel', { dir: 'v', w: 353, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var items = [
  ['Reading list', 'Page · Deleted today', 'file-text'],
  ['Capture onboarding research notes', 'Task · Deleted Nov 6', 'circle-check'],
  ['Sprint 42 Notes', 'Page · Deleted Nov 4', 'file-text']
];

items.forEach(function (it, idx) {
  var row = FR('row/' + it[0], { dir: 'h', w: 353, p: 12, cross: 'CENTER', gap: 10 });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);
  row.appendChild(ICO(it[2], 18, CF.ter));
  var col = FR('col', { dir: 'v', w: 230, gap: 2 });
  col.appendChild(T(it[0], { size: 13, style: 'Semi Bold', color: CF.ink }));
  col.appendChild(T(it[1], { size: 11, color: CF.sec }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(buttonGhost('', 'rotate-ccw', { h: 28, w: 28 }));
  tPanel.appendChild(row);
});
c.appendChild(tPanel);
c.appendChild(spacer(1, 14));
c.appendChild(T('Items stay here until you empty Trash.', { size: 11.5, color: CF.sec }));

return { frame: m11.frame.id, name: m11.frame.name };

    })());

    // ===== s01-projects.js =====
    results.push(await (async function () {
// 01 · Projects — Personal Workspace  (/projects)
var scr = await desktopScreen('01 · Projects — Personal Workspace', { sidebar: 'none', crumb: 'Projects', x: 0, y: 0 });
var canvas = scr.canvas;

var content = plainContent(canvas, { y: 32 });

var head = FR('Page heading', { dir: 'h', w: 978, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
head.appendChild(T('Personal Workspace', { size: 40, style: 'Bold', color: CF.ink, lh: 48, ls: -2 }));
head.appendChild(buttonPrimary('New project', 'plus'));
content.appendChild(head);

content.appendChild(spacer(1, 76));

var projects = [
  { name: 'Website Redesign', desc: 'Design system unification and performance refresh.', due: 'Due Nov 12', icon: 'globe', tint: '#D3E5EF', tintText: '#337EA9' },
  { name: 'Mobile App', desc: 'A thoughtful companion workspace for life on the go.', due: 'Due Dec 5', icon: 'smartphone', tint: '#FCE9E0', tintText: '#D9730D' },
  { name: 'Q4 Planning', desc: 'Strategic roadmap, priorities, and resource allocation.', due: 'Due Oct 31', icon: 'chart-column', tint: '#E4F1E2', tintText: '#3A7355' }
];

var row = FR('Projects grid', { dir: 'h', w: 978, h: 180, gap: 16 });
projects.forEach(function (p) {
  var card = FR('Project card / ' + p.name, { dir: 'v', w: 315, h: 180, p: 16, r: 8, stroke: '#E9E8E5', fill: '#FFFFFF' });
  var tile = FR('icon tile', { dir: 'h', w: 30, h: 30, r: 8, main: 'CENTER', cross: 'CENTER', fill: p.tint });
  tile.appendChild(ICO(p.icon, 16, p.tintText));
  card.appendChild(tile);
  card.appendChild(spacer(1, 14));
  card.appendChild(T(p.name, { size: 14.5, style: 'Semi Bold', color: CF.ink, lh: 20 }));
  card.appendChild(spacer(1, 6));
  card.appendChild(T(p.desc, { size: 12.5, color: CF.sec, w: 283, lh: 19 }));
  card.appendChild(growSpacer());
  var foot = FR('footer', { dir: 'h', w: 283, h: 20, gap: 6, cross: 'CENTER' });
  foot.appendChild(ICO('flag', 13, CF.sec));
  foot.appendChild(T(p.due, { size: 12, color: CF.sec }));
  foot.appendChild(growSpacer());
  foot.appendChild(avatar('K', 18));
  card.appendChild(foot);
  row.appendChild(card);
});
content.appendChild(row);

// page label above the frame
var lbl = T('01 · Projects — /projects', { size: 16, style: 'Semi Bold', color: CF.ink, name: 'label' });
scr.page.appendChild(lbl); lbl.x = 0; lbl.y = -44;

// retire the bootstrap page
var p1 = findPage('Page 1');
if (p1) {
  p1.children.slice().forEach(function (n) { n.remove(); });
  p1.name = '00 · Cover';
}

return {
  frame: scr.frame.id,
  frameName: scr.frame.name,
  size: [scr.frame.width, scr.frame.height],
  sidebar: scr.frame.children[0].name,
  note: 'projects screen built'
};

    })());

    // ===== s02-tasks.js =====
    results.push(await (async function () {
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

    })());

    // ===== s03-search.js =====
    results.push(await (async function () {
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

    })());

    // ===== s04-page.js =====
    results.push(await (async function () {
// 04 · Page editor — Weekly plan  (/pages/weekly-plan)
var s4 = await surfacePage('04 · Page editor — Weekly plan', { sidebar: 'none', crumb: 'Pages / Weekly plan', x: 0, y: 2940 });
var c4 = s4.col;
c4.clipsContent = true;

// breadcrumb row
var bc4 = hrow('Breadcrumb', 1080, 8);
bc4.appendChild(T('Pages', { size: 12.5, color: CF.sec }));
bc4.appendChild(T('/', { size: 12.5, color: CF.muted }));
bc4.appendChild(T('Weekly plan', { size: 12.5, color: CF.body }));
bc4.appendChild(growSpacer());
var starBtn = FR('action/star', { dir: 'h', w: 28, h: 28, r: 6, main: 'CENTER', cross: 'CENTER', fill: CF.neutral });
starBtn.appendChild(ICO('star', 15, CF.ink));
bc4.appendChild(starBtn);
bc4.appendChild(ICO('download', 16, CF.ter));
bc4.appendChild(ICO('trash', 16, CF.ter));
c4.appendChild(bc4);
c4.appendChild(spacer(1, 34));

// toolbar
var tb4 = hrow('Page toolbar', 1080, 10);
tb4.appendChild(selectPill('star', 'star', { h: 30 }));
tb4.appendChild(T('Emoji', { size: 12.5, color: CF.sec }));
tb4.appendChild(T('🙂', { size: 14, color: CF.body }));
tb4.appendChild(T('Upload icon', { size: 12.5, color: CF.sec }));
tb4.appendChild(T('Cover', { size: 12.5, color: CF.sec }));
tb4.appendChild(T('Font', { size: 12.5, color: CF.sec }));
tb4.appendChild(selectPill('default', null, { h: 30 }));
tb4.appendChild(checkbox(false, 14));
tb4.appendChild(T('Full width', { size: 12.5, color: CF.body }));
tb4.appendChild(checkbox(false, 14));
tb4.appendChild(T('Small text', { size: 12.5, color: CF.body }));
c4.appendChild(tb4);

// page body column (720 wide, inset)
var pg4 = vcol('Page body', 720, 0);
pg4.layoutAlign = 'INHERIT';
c4.appendChild(pg4);
pg4.layoutSizingHorizontal = 'FIXED';
pg4.x = 180;
pg4.layoutPositioning = 'ABSOLUTE';

var iconTile = FR('Page icon', { dir: 'h', w: 34, h: 34, r: 7, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
iconTile.appendChild(ICO('star', 18, CF.blueText));
pg4.appendChild(iconTile);
pg4.appendChild(spacer(1, 18));
pg4.appendChild(T('Weekly plan', { size: 40, style: 'Bold', color: CF.ink, lh: 48, ls: -2 }));
pg4.appendChild(spacer(1, 14));

// meta row
var meta4 = hrow('meta', 720, 12);
meta4.appendChild(T('Inside', { size: 12.5, color: CF.sec }));
meta4.appendChild(selectPill('Workspace', null, { h: 30 }));
meta4.appendChild(T('+ Subpage', { size: 12.5, color: CF.sec }));
meta4.appendChild(T('Edited 11/9/2026, 9:36:06 AM', { size: 12.5, color: CF.sec }));
pg4.appendChild(meta4);
pg4.appendChild(spacer(1, 18));
pg4.appendChild(divider(720));
pg4.appendChild(spacer(1, 20));

pg4.appendChild(T('A little space to think clearly, plan intentionally, and make progress on what matters.', { size: 15, color: CF.body, lh: 26, w: 720 }));
pg4.appendChild(spacer(1, 18));
pg4.appendChild(T('Focus for this week', { size: 30, style: 'Bold', color: CF.ink, lh: 38, ls: -1.5 }));
pg4.appendChild(spacer(1, 12));

var quote4 = hrow('quote', 720, 14);
var qbar = FR('quote bar', { w: 3, h: 34, fill: CF.ink });
quote4.appendChild(qbar);
quote4.appendChild(T('Keep the workspace quiet. Make the next step clear.', { size: 15, color: CF.body, lh: 24 }));
pg4.appendChild(quote4);
pg4.appendChild(spacer(1, 14));

function todoRow4(text, done) {
  var r = hrow('todo', 720, 10);
  r.appendChild(checkbox(done, 16));
  r.appendChild(T(text, { size: 15, color: done ? CF.muted : CF.body, lh: 22 }));
  return r;
}
pg4.appendChild(todoRow4('Review the design system and refine the details', true));
pg4.appendChild(spacer(1, 8));
pg4.appendChild(todoRow4('Plan the next milestone and capture open questions', false));
pg4.appendChild(spacer(1, 24));
pg4.appendChild(T('Notes & ideas', { size: 30, style: 'Bold', color: CF.ink, lh: 38, ls: -1.5 }));
pg4.appendChild(spacer(1, 12));
pg4.appendChild(T('Use this page for notes, decisions, and useful links. Type / in an empty block to choose a block type.', { size: 15, color: CF.body, lh: 26, w: 720 }));

frameLabel(s4.page, '04 · Page editor — /pages/weekly-plan', 0, 2896);

return { frame: s4.frame.id, name: s4.frame.name };

    })());

    // ===== s05-trash.js =====
    results.push(await (async function () {
// 05 · Trash  (/trash)
var s5 = await surfacePage('05 · Trash', { sidebar: 'none', crumb: 'Trash', x: 0, y: 3920 });
var c5 = s5.col;
s5.surface.clipsContent = true;

var th5 = FR('Trash heading', { dir: 'h', w: 1080, h: 64, gap: 16, cross: 'CENTER' });
var emblem = FR('emblem', { dir: 'h', w: 54, h: 54, r: 14, fill: CF.red, main: 'CENTER', cross: 'CENTER' });
emblem.appendChild(ICO('trash', 26, CF.redText));
th5.appendChild(emblem);
var thText = FR('heading text', { dir: 'v', w: 700, gap: 4 });
thText.appendChild(T('Trash', { size: 34, style: 'Bold', color: CF.ink, lh: 40, ls: -1.5 }));
thText.appendChild(T('Restore what you need. Let go of the rest.', { size: 14, color: CF.sec, lh: 20 }));
th5.appendChild(thText);
th5.appendChild(growSpacer());
th5.appendChild(buttonGhost('Empty Trash', 'trash', { h: 34, color: CF.redText, iconColor: CF.redText }));
c5.appendChild(th5);
c5.appendChild(spacer(1, 26));

var panel = FR('Deleted items panel', { dir: 'v', w: 1080, gap: 0, r: 12, stroke: CF.border, clip: true });
var sum = FR('summary', { dir: 'h', w: 1080, h: 46, pl: 20, pr: 20, cross: 'CENTER', fill: '#FBFBFA' });
BORDER(sum, 'Bottom', CF.border);
sum.appendChild(T('Deleted items', { size: 13, style: 'Semi Bold', color: CF.ink }));
sum.appendChild(growSpacer());
sum.appendChild(T('3 items', { size: 12.5, color: CF.sec }));
panel.appendChild(sum);

var items = [
  ['Reading list', 'Page', 'file-text'],
  ['Capture onboarding research notes', 'Task', 'circle-check'],
  ['Sprint 42 Notes', 'Page', 'file-text']
];
items.forEach(function (it, i) {
  var row = FR('trash row', { dir: 'h', w: 1080, h: 68, pl: 20, pr: 20, gap: 14, cross: 'CENTER' });
  row.appendChild(ICO(it[2], 20, CF.ter));
  var col = FR('item', { dir: 'v', w: 700, gap: 3 });
  col.appendChild(T(it[0], { size: 14, style: 'Semi Bold', color: CF.ink, lh: 19 }));
  col.appendChild(T(it[1], { size: 12, color: CF.sec, lh: 16 }));
  row.appendChild(col);
  row.appendChild(growSpacer());
  row.appendChild(buttonGhost('Restore', 'rotate-ccw', { h: 30 }));
  panel.appendChild(row);
  if (i < items.length - 1) {
    var rl = FR('rule', { w: 1080, h: 1, fill: CF.borderSoft });
    panel.appendChild(rl);
  }
});
c5.appendChild(panel);
c5.appendChild(spacer(1, 18));
c5.appendChild(T('Items stay here until you empty Trash. Permanently deleted items can’t be recovered.', { size: 12.5, color: CF.sec }));

frameLabel(s5.page, '05 · Trash — /trash', 0, 3876);

return { frame: s5.frame.id, name: s5.frame.name, rows: items.length };

    })());

    // ===== s06-projects-team.js =====
    results.push(await (async function () {
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

    })());

    // ===== s07-calendar-week.js =====
    results.push(await (async function () {
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

    })());

    // ===== s08-calendar-month.js =====
    results.push(await (async function () {
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

    })());

    // ===== s09-calendar-day.js =====
    results.push(await (async function () {
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

    })());

    // ===== s10-calendar-agenda.js =====
    results.push(await (async function () {
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

    })());

    // ===== s11-project-table.js =====
    results.push(await (async function () {
// 11 · Project — Table  (/projects/website/table)
var s11 = await surfacePage('11 · Project — Table', { sidebar: 'none', crumb: 'Projects / Website Redesign', x: 0, y: 9800 });
var c11 = s11.col;
c11.clipsContent = true;

// project header
var pHead = FR('Project heading', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitleL = FR('left', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var pTile = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pTile.appendChild(ICO('globe', 18, CF.blueText));
pTitleL.appendChild(pTile);
pTitleL.appendChild(T('Website Redesign', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
pHead.appendChild(pTitleL);
pHead.appendChild(buttonPrimary('New task', 'plus', { h: 32 }));
c11.appendChild(pHead);
c11.appendChild(spacer(1, 16));

// project toolbar
var tb11 = FR('Project toolbar', { dir: 'h', w: 1080, h: 40, cross: 'CENTER' });
var viewTabs = FR('views', { dir: 'h', hug: true, gap: 4 });
var tabAll = FR('tab/all', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, fill: CF.selected, cross: 'CENTER' });
tabAll.appendChild(ICO('table', 14, CF.accent));
tabAll.appendChild(T('All Tasks', { size: 12.5, style: 'Semi Bold', color: CF.accent }));
viewTabs.appendChild(tabAll);

var tabBoard = FR('tab/board', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, cross: 'CENTER' });
tabBoard.appendChild(ICO('kanban', 14, CF.sec));
tabBoard.appendChild(T('By Status', { size: 12.5, color: CF.sec }));
viewTabs.appendChild(tabBoard);
tb11.appendChild(viewTabs);

tb11.appendChild(growSpacer());
var tbFilter = FR('filters', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
tbFilter.appendChild(inputField('Search project tasks…', { w: 240, h: 32, icon: 'search' }));
tbFilter.appendChild(selectPill('All priorities', 'sliders', { h: 32 }));
tb11.appendChild(tbFilter);
c11.appendChild(tb11);
c11.appendChild(spacer(1, 16));

// table component
var table = FR('Task Table', { dir: 'v', w: 1080, r: 8, stroke: CF.border, clip: true, fill: '#FFFFFF' });
var thead = FR('Thead', { dir: 'h', w: 1080, h: 36, pl: 16, pr: 16, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(thead, 'Bottom', CF.border);
thead.appendChild(FR('chk', { w: 36, h: 36, main: 'CENTER', cross: 'CENTER' }));
thead.appendChild(T('Title', { size: 12, style: 'Semi Bold', color: CF.sec, w: 430 }));
thead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 150 }));
thead.appendChild(T('Priority', { size: 12, style: 'Semi Bold', color: CF.sec, w: 130 }));
thead.appendChild(T('Due date', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
thead.appendChild(T('Assignee', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
table.appendChild(thead);

var rows = [
  ['Finalize token contrasts for WCAG AA', 'Done', 'High', 'Nov 6, 2026', 'Sitha', true],
  ['Build navigation drawer gesture prototype', 'In progress', 'High', 'Nov 10, 2026', 'Kim', false],
  ['Review engineering OKR draft and capacity', 'Not started', 'Medium', 'Nov 12, 2026', 'Por', false],
  ['Export typography hierarchy tokens', 'In progress', 'Medium', 'Nov 8, 2026', 'Sitha', false],
  ['Map calendar provider requirements', 'Blocked', 'Urgent', 'Nov 8, 2026', 'Kim', false],
  ['Verify Safari glass fallback', 'Done', 'Low', 'Nov 4, 2026', 'Por', true]
];

rows.forEach(function (r, idx) {
  var row = FR('row/' + r[0], { dir: 'h', w: 1080, h: 48, pl: 16, pr: 16, cross: 'CENTER' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);

  var chkCell = FR('chkCell', { dir: 'h', w: 36, h: 48, cross: 'CENTER' });
  chkCell.appendChild(checkbox(r[5], 16));
  row.appendChild(chkCell);

  var titleCol = FR('titleCol', { dir: 'h', w: 430, cross: 'CENTER' });
  titleCol.appendChild(T(r[0], { size: 13, style: r[5] ? 'Regular' : 'Medium', color: r[5] ? CF.sec : CF.ink }));
  row.appendChild(titleCol);

  var statusCol = FR('statusCol', { dir: 'h', w: 150, cross: 'CENTER' });
  statusCol.appendChild(statusChip(r[1]));
  row.appendChild(statusCol);

  var priCol = FR('priCol', { dir: 'h', w: 130, cross: 'CENTER' });
  priCol.appendChild(priorityChip(r[2]));
  row.appendChild(priCol);

  var dateCol = FR('dateCol', { dir: 'h', w: 140, cross: 'CENTER' });
  dateCol.appendChild(T(r[3], { size: 12.5, color: CF.sec }));
  row.appendChild(dateCol);

  var assCol = FR('assCol', { dir: 'h', w: 140, gap: 6, cross: 'CENTER' });
  assCol.appendChild(avatar(r[4].charAt(0), 20));
  assCol.appendChild(T(r[4], { size: 12.5, color: CF.body }));
  row.appendChild(assCol);

  table.appendChild(row);
});
c11.appendChild(table);

frameLabel(s11.page, '11 · Project — Table — /projects/website/table', 0, 9756);

return { frame: s11.frame.id, name: s11.frame.name };

    })());

    // ===== s12-project-board.js =====
    results.push(await (async function () {
// 12 · Project — Board  (/projects/website/board)
var s12 = await surfacePage('12 · Project — Board', { sidebar: 'none', crumb: 'Projects / Website Redesign', x: 0, y: 10780 });
var c12 = s12.col;
c12.clipsContent = true;

// project header
var pHead12 = FR('Project heading', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var pTitleL12 = FR('left', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var pTile12 = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
pTile12.appendChild(ICO('globe', 18, CF.blueText));
pTitleL12.appendChild(pTile12);
pTitleL12.appendChild(T('Website Redesign', { size: 28, style: 'Bold', color: CF.ink, lh: 34 }));
pHead12.appendChild(pTitleL12);
pHead12.appendChild(buttonPrimary('New task', 'plus', { h: 32 }));
c12.appendChild(pHead12);
c12.appendChild(spacer(1, 16));

// project toolbar
var tb12 = FR('Project toolbar', { dir: 'h', w: 1080, h: 40, cross: 'CENTER' });
var viewTabs12 = FR('views', { dir: 'h', hug: true, gap: 4 });
var tabAll12 = FR('tab/all', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, cross: 'CENTER' });
tabAll12.appendChild(ICO('table', 14, CF.sec));
tabAll12.appendChild(T('All Tasks', { size: 12.5, color: CF.sec }));
viewTabs12.appendChild(tabAll12);

var tabBoard12 = FR('tab/board', { dir: 'h', hug: true, h: 32, pl: 10, pr: 10, gap: 6, r: 6, fill: CF.selected, cross: 'CENTER' });
tabBoard12.appendChild(ICO('kanban', 14, CF.accent));
tabBoard12.appendChild(T('By Status', { size: 12.5, style: 'Semi Bold', color: CF.accent }));
viewTabs12.appendChild(tabBoard12);
tb12.appendChild(viewTabs12);

tb12.appendChild(growSpacer());
var tbFilter12 = FR('filters', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
tbFilter12.appendChild(inputField('Search project tasks…', { w: 240, h: 32, icon: 'search' }));
tbFilter12.appendChild(selectPill('All priorities', 'sliders', { h: 32 }));
tb12.appendChild(tbFilter12);
c12.appendChild(tb12);
c12.appendChild(spacer(1, 16));

// kanban board
var board = FR('Kanban board', { dir: 'h', w: 1080, h: 560, gap: 14, clip: true });

var columns = [
  {
    name: 'Not started', count: 1, tone: 'neutral', tasks: [
      { title: 'Review engineering OKR draft and capacity', pri: 'Medium', due: 'Nov 12', avatar: 'P' }
    ]
  },
  {
    name: 'In progress', count: 2, tone: 'primary', tasks: [
      { title: 'Build navigation drawer gesture prototype', pri: 'High', due: 'Nov 10', avatar: 'K' },
      { title: 'Export typography hierarchy tokens', pri: 'Medium', due: 'Nov 8', avatar: 'S' }
    ]
  },
  {
    name: 'In review', count: 0, tone: 'neutral', tasks: []
  },
  {
    name: 'Blocked', count: 1, tone: 'danger', tasks: [
      { title: 'Map calendar provider requirements', pri: 'Urgent', due: 'Nov 8', avatar: 'K' }
    ]
  },
  {
    name: 'Done', count: 2, tone: 'success', tasks: [
      { title: 'Finalize token contrasts for WCAG AA', pri: 'High', due: 'Nov 6', avatar: 'S' },
      { title: 'Verify Safari glass fallback', pri: 'Low', due: 'Nov 4', avatar: 'P' }
    ]
  }
];

columns.forEach(function (col) {
  var colFrame = FR('col/' + col.name, { dir: 'v', w: 204, h: 560, p: 8, gap: 10, r: 8, fill: '#F8F8F7' });
  var colHead = FR('head', { dir: 'h', w: 188, h: 28, main: 'SPACE_BETWEEN', cross: 'CENTER' });
  var titleWrap = FR('titleWrap', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
  titleWrap.appendChild(T(col.name, { size: 12.5, style: 'Semi Bold', color: CF.ink }));
  titleWrap.appendChild(countBadge(col.count, false));
  colHead.appendChild(titleWrap);
  colHead.appendChild(ICO('plus', 14, CF.sec));
  colFrame.appendChild(colHead);

  col.tasks.forEach(function (t) {
    var kCard = FR('card/' + t.title, { dir: 'v', w: 188, p: 12, r: 6, stroke: CF.border, fill: '#FFFFFF', gap: 8 });
    kCard.appendChild(T(t.title, { size: 12.5, style: 'Medium', color: CF.ink, lh: 17 }));
    var kFoot = FR('foot', { dir: 'h', w: 164, main: 'SPACE_BETWEEN', cross: 'CENTER' });
    kFoot.appendChild(priorityChip(t.pri));
    var kMeta = FR('meta', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
    kMeta.appendChild(T(t.due, { size: 11, color: CF.sec }));
    kMeta.appendChild(avatar(t.avatar, 18));
    kFoot.appendChild(kMeta);
    kCard.appendChild(kFoot);
    colFrame.appendChild(kCard);
  });

  board.appendChild(colFrame);
});
c12.appendChild(board);

frameLabel(s12.page, '12 · Project — Board — /projects/website/board', 0, 10736);

return { frame: s12.frame.id, name: s12.frame.name };

    })());

    // ===== s13-project-progress.js =====
    results.push(await (async function () {
// 13 · Project — Progress  (/projects-progress)
var s13 = await surfacePage('13 · Project — Progress', { sidebar: 'none', crumb: 'Projects Progress', x: 0, y: 11760 });
var c13 = s13.col;
c13.clipsContent = true;

// heading
var head13 = FR('Heading', { dir: 'v', w: 1080, gap: 6 });
head13.appendChild(T('Projects Progress', { size: 36, style: 'Bold', color: CF.ink, lh: 42, ls: -1.5 }));
head13.appendChild(T('Project quantities, progress updates and reporting.', { size: 14.5, color: CF.sec, lh: 20 }));
c13.appendChild(head13);
c13.appendChild(spacer(1, 28));

// projects grid
var progGrid = FR('Progress grid', { dir: 'h', w: 1080, gap: 16 });

var nbcCard = FR('card/NBC BP03', { dir: 'v', w: 340, p: 20, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 14 });
var nbcTop = FR('top', { dir: 'h', w: 300, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTile = FR('tile', { dir: 'h', w: 32, h: 32, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcTile.appendChild(ICO('building', 18, CF.blueText));
nbcTop.appendChild(nbcTile);
nbcTop.appendChild(T('44%', { size: 16, style: 'Bold', color: CF.accent }));
nbcCard.appendChild(nbcTop);

var nbcInfo = FR('info', { dir: 'v', w: 300, gap: 4 });
nbcInfo.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 15, style: 'Bold', color: CF.ink, lh: 20 }));
nbcInfo.appendChild(T('Synthetic test project — Structural & architectural interior fitout.', { size: 12.5, color: CF.sec, lh: 17 }));
nbcCard.appendChild(nbcInfo);

// progress bar
var progWrap = FR('progWrap', { dir: 'v', w: 300, gap: 6 });
progWrap.appendChild(progressBar(44, { w: 300, h: 6 }));
nbcCard.appendChild(progWrap);

var nbcFoot = FR('foot', { dir: 'h', w: 300, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcDue = FR('due', { dir: 'h', hug: true, gap: 6, cross: 'CENTER' });
nbcDue.appendChild(ICO('flag', 13, CF.sec));
nbcDue.appendChild(T('Dec 31, 2026', { size: 12, color: CF.sec }));
nbcFoot.appendChild(nbcDue);
nbcFoot.appendChild(avatar('K', 20));
nbcCard.appendChild(nbcFoot);

progGrid.appendChild(nbcCard);
c13.appendChild(progGrid);

frameLabel(s13.page, '13 · Project — Progress — /projects-progress', 0, 11716);

return { frame: s13.frame.id, name: s13.frame.name };

    })());

    // ===== s14-nbc-overview.js =====
    results.push(await (async function () {
// 14 · NBC BP03 — Overview  (/projects-progress/nbc-bp03/overview)
var s14 = await surfacePage('14 · NBC BP03 — Overview', { sidebar: 'none', crumb: 'Projects Progress / NBC BP03 / Overview', x: 0, y: 12740 });
var c14 = s14.col;
c14.clipsContent = true;

// project title + tabs
var nbcTitle = FR('Title', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTL = FR('tl', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var nbcIcon = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcIcon.appendChild(ICO('building', 18, CF.blueText));
nbcTL.appendChild(nbcIcon);
nbcTL.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 26, style: 'Bold', color: CF.ink, lh: 32 }));
nbcTitle.appendChild(nbcTL);
nbcTitle.appendChild(buttonPrimary('Update progress', 'plus', { h: 32 }));
c14.appendChild(nbcTitle);
c14.appendChild(spacer(1, 14));

// tabs row
var tabRow = tabList([
  { label: 'Overview', count: null },
  { label: 'Activities', count: 3 },
  { label: 'Update Progress', count: null },
  { label: 'Issues', count: 0 }
], 0, { h: 34, gap: 8 });
c14.appendChild(tabRow);
c14.appendChild(spacer(1, 22));

// 4 KPI tiles
var kpis = FR('KPIs', { dir: 'h', w: 1080, gap: 14 });
var kpiList = [
  { label: 'Overall progress', value: '43.75%', sub: 'Target 100%', tone: CF.accent },
  { label: 'Versus plan', value: '12.50% behind', sub: 'Plan: 56.25% by now', tone: CF.redText },
  { label: 'Completion deadline', value: 'Dec 31, 2026', sub: '52 days left', tone: CF.ink },
  { label: 'Weekly reporting', value: '1 of 2 handlers', sub: 'Updated this week', tone: CF.amberText }
];
kpiList.forEach(function (k) {
  var tile = FR('kpi/' + k.label, { dir: 'v', w: 259, p: 16, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 6 });
  tile.appendChild(T(k.label, { size: 12, color: CF.sec }));
  tile.appendChild(T(k.value, { size: 22, style: 'Bold', color: k.tone, lh: 28 }));
  tile.appendChild(T(k.sub, { size: 12, color: CF.sec }));
  kpis.appendChild(tile);
});
c14.appendChild(kpis);
c14.appendChild(spacer(1, 18));

// forecast banner
var banner = FR('Forecast banner', { dir: 'h', w: 1080, p: 14, r: 8, stroke: '#D3E5EF', fill: '#F0F7FB', gap: 10, cross: 'CENTER' });
banner.appendChild(chipPill('Forecast', CF.blue, CF.blueText));
banner.appendChild(T('At the current pace of 3.25% a week, milestone target completes around mid-December 2026.', { size: 13, color: CF.body }));
c14.appendChild(banner);
c14.appendChild(spacer(1, 22));

// handler breakdown table
var hPanel = FR('Handler breakdown', { dir: 'v', w: 1080, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var hHead = FR('Head', { dir: 'h', w: 1080, h: 42, pl: 18, pr: 18, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(hHead, 'Bottom', CF.border);
hHead.appendChild(T('Handler', { size: 12, style: 'Semi Bold', color: CF.sec, w: 260 }));
hHead.appendChild(T('Assigned activities', { size: 12, style: 'Semi Bold', color: CF.sec, w: 220 }));
hHead.appendChild(T('Weighted baseline', { size: 12, style: 'Semi Bold', color: CF.sec, w: 200 }));
hHead.appendChild(T('Current progress', { size: 12, style: 'Semi Bold', color: CF.sec, w: 200 }));
hHead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 160 }));
hPanel.appendChild(hHead);

var handlers = [
  ['Sitha', '1 activity (Survey)', '25.00%', '100.00%', 'Updated', CF.green, CF.greenText],
  ['Tola', '1 activity (Install board)', '75.00%', '25.00%', 'Pending update', CF.amber, CF.amberText]
];
handlers.forEach(function (h, idx) {
  var row = FR('row/' + h[0], { dir: 'h', w: 1080, h: 52, pl: 18, pr: 18, cross: 'CENTER' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);
  var userCol = FR('user', { dir: 'h', w: 260, gap: 8, cross: 'CENTER' });
  userCol.appendChild(avatar(h[0].charAt(0), 22));
  userCol.appendChild(T(h[0], { size: 13.5, style: 'Semi Bold', color: CF.ink }));
  row.appendChild(userCol);

  row.appendChild(T(h[1], { size: 13, color: CF.body, w: 220 }));
  row.appendChild(T(h[2], { size: 13, color: CF.sec, w: 200 }));
  row.appendChild(T(h[3], { size: 13, style: 'Bold', color: CF.ink, w: 200 }));
  var stCol = FR('st', { dir: 'h', w: 160, cross: 'CENTER' });
  stCol.appendChild(chipPill(h[4], h[5], h[6]));
  row.appendChild(stCol);
  hPanel.appendChild(row);
});
c14.appendChild(hPanel);

frameLabel(s14.page, '14 · NBC BP03 — Overview — /projects-progress/nbc-bp03', 0, 12696);

return { frame: s14.frame.id, name: s14.frame.name };

    })());

    // ===== s15-nbc-activities.js =====
    results.push(await (async function () {
// 15 · NBC BP03 — Activities  (/projects-progress/nbc-bp03/activities)
var s15 = await surfacePage('15 · NBC BP03 — Activities', { sidebar: 'none', crumb: 'Projects Progress / NBC BP03 / Activities', x: 0, y: 13720 });
var c15 = s15.col;
c15.clipsContent = true;

// project title
var nbcTitle15 = FR('Title', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTL15 = FR('tl', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var nbcIcon15 = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcIcon15.appendChild(ICO('building', 18, CF.blueText));
nbcTL15.appendChild(nbcIcon15);
nbcTL15.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 26, style: 'Bold', color: CF.ink, lh: 32 }));
nbcTitle15.appendChild(nbcTL15);
nbcTitle15.appendChild(buttonPrimary('Update progress', 'plus', { h: 32 }));
c15.appendChild(nbcTitle15);
c15.appendChild(spacer(1, 14));

// tabs row
var tabRow15 = tabList([
  { label: 'Overview', count: null },
  { label: 'Activities', count: 3 },
  { label: 'Update Progress', count: null },
  { label: 'Issues', count: 0 }
], 1, { h: 34, gap: 8 });
c15.appendChild(tabRow15);
c15.appendChild(spacer(1, 20));

// activities toolbar
var actTb = FR('Activities toolbar', { dir: 'h', w: 1080, h: 40, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var actTbL = FR('left', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
actTbL.appendChild(inputField('Filter WBS or activity…', { w: 260, h: 32, icon: 'search' }));
actTbL.appendChild(selectPill('All handlers', null, { h: 32 }));
actTbL.appendChild(selectPill('All locations', null, { h: 32 }));
actTb.appendChild(actTbL);
actTb.appendChild(buttonGhost('Export Excel', 'download', { h: 32 }));
c15.appendChild(actTb);
c15.appendChild(spacer(1, 16));

// WBS Table
var wbsTable = FR('WBS Table', { dir: 'v', w: 1080, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });
var wbsHead = FR('Head', { dir: 'h', w: 1080, h: 40, pl: 16, pr: 16, cross: 'CENTER', fill: '#FAFAF9' });
BORDER(wbsHead, 'Bottom', CF.border);
wbsHead.appendChild(T('WBS', { size: 12, style: 'Semi Bold', color: CF.sec, w: 120 }));
wbsHead.appendChild(T('Activity Name', { size: 12, style: 'Semi Bold', color: CF.sec, w: 320 }));
wbsHead.appendChild(T('Handler', { size: 12, style: 'Semi Bold', color: CF.sec, w: 150 }));
wbsHead.appendChild(T('Rel. Weight', { size: 12, style: 'Semi Bold', color: CF.sec, w: 130 }));
wbsHead.appendChild(T('Baseline', { size: 12, style: 'Semi Bold', color: CF.sec, w: 120 }));
wbsHead.appendChild(T('Progress', { size: 12, style: 'Semi Bold', color: CF.sec, w: 140 }));
wbsHead.appendChild(T('Status', { size: 12, style: 'Semi Bold', color: CF.sec, w: 80 }));
wbsTable.appendChild(wbsHead);

var wbsRows = [
  { wbs: '1.6.1', name: 'Test area', handler: '—', weight: '100.00%', base: '43.75%', prog: '43.75%', isGroup: true },
  { wbs: '1.6.1.1', name: 'Survey and layout grid inspection', handler: 'Sitha', weight: '25.00%', base: '100.00%', prog: '100.00%', isGroup: false, status: 'Done', tone: 'success' },
  { wbs: '1.6.1.2', name: 'Install board & reinforcement', handler: 'Tola', weight: '75.00%', base: '25.00%', prog: '25.00%', isGroup: false, status: 'In progress', tone: 'primary' }
];

wbsRows.forEach(function (r, idx) {
  var row = FR('row/' + r.wbs, { dir: 'h', w: 1080, h: 48, pl: 16, pr: 16, cross: 'CENTER', fill: r.isGroup ? '#FBFBFA' : '#FFFFFF' });
  if (idx > 0) BORDER(row, 'Top', CF.borderSoft);

  row.appendChild(T(r.wbs, { size: 12.5, style: r.isGroup ? 'Bold' : 'Medium', color: CF.ink, w: 120 }));
  var nameCell = FR('name', { dir: 'h', w: 320, gap: 8, cross: 'CENTER' });
  if (!r.isGroup) nameCell.appendChild(spacer(14, 1));
  nameCell.appendChild(T(r.name, { size: 13, style: r.isGroup ? 'Bold' : 'Regular', color: CF.ink }));
  row.appendChild(nameCell);

  var hCell = FR('handler', { dir: 'h', w: 150, gap: 6, cross: 'CENTER' });
  if (r.handler !== '—') {
    hCell.appendChild(avatar(r.handler.charAt(0), 18));
    hCell.appendChild(T(r.handler, { size: 12.5, color: CF.body }));
  } else {
    hCell.appendChild(T('—', { size: 12.5, color: CF.muted }));
  }
  row.appendChild(hCell);

  row.appendChild(T(r.weight, { size: 12.5, color: CF.sec, w: 130 }));
  row.appendChild(T(r.base, { size: 12.5, color: CF.sec, w: 120 }));

  var pCell = FR('pCell', { dir: 'h', w: 140, gap: 8, cross: 'CENTER' });
  pCell.appendChild(progressBar(parseFloat(r.prog), { w: 60, h: 6 }));
  pCell.appendChild(T(r.prog, { size: 12.5, style: 'Semi Bold', color: CF.ink }));
  row.appendChild(pCell);

  var stCell = FR('stCell', { dir: 'h', w: 80, cross: 'CENTER' });
  if (r.status) stCell.appendChild(statusChip(r.status));
  row.appendChild(stCell);

  wbsTable.appendChild(row);
});
c15.appendChild(wbsTable);

frameLabel(s15.page, '15 · NBC BP03 — Activities — /projects-progress/nbc-bp03/activities', 0, 13676);

return { frame: s15.frame.id, name: s15.frame.name };

    })());

    // ===== s16-nbc-update.js =====
    results.push(await (async function () {
// 16 · NBC BP03 — Update progress  (/projects-progress/nbc-bp03/update)
var s16 = await surfacePage('16 · NBC BP03 — Update progress', { sidebar: 'none', crumb: 'Projects Progress / NBC BP03 / Update', x: 0, y: 14700 });
var c16 = s16.col;
c16.clipsContent = true;

// project title
var nbcTitle16 = FR('Title', { dir: 'h', w: 1080, h: 48, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var nbcTL16 = FR('tl', { dir: 'h', hug: true, gap: 12, cross: 'CENTER' });
var nbcIcon16 = FR('tile', { dir: 'h', w: 34, h: 34, r: 8, fill: CF.blue, main: 'CENTER', cross: 'CENTER' });
nbcIcon16.appendChild(ICO('building', 18, CF.blueText));
nbcTL16.appendChild(nbcIcon16);
nbcTL16.appendChild(T('NBC BP03 – Pan Pacific Hotel', { size: 26, style: 'Bold', color: CF.ink, lh: 32 }));
nbcTitle16.appendChild(nbcTL16);
c16.appendChild(nbcTitle16);
c16.appendChild(spacer(1, 14));

// tabs row
var tabRow16 = tabList([
  { label: 'Overview', count: null },
  { label: 'Activities', count: 3 },
  { label: 'Update Progress', count: null },
  { label: 'Issues', count: 0 }
], 2, { h: 34, gap: 8 });
c16.appendChild(tabRow16);
c16.appendChild(spacer(1, 24));

// update form container (centered card, 760 wide)
var updateForm = FR('Update form', { dir: 'v', w: 760, p: 24, r: 12, stroke: CF.border, fill: '#FFFFFF', gap: 20 });
var formHead = FR('head', { dir: 'v', w: 712, gap: 4 });
formHead.appendChild(T('Submit weekly progress update', { size: 18, style: 'Bold', color: CF.ink }));
formHead.appendChild(T('Week 46 (Nov 9 – 15, 2026) · Enter progress achieved on site.', { size: 13, color: CF.sec }));
updateForm.appendChild(formHead);
updateForm.appendChild(divider(712));

// handler picker row
var hPicker = FR('picker', { dir: 'h', w: 712, main: 'SPACE_BETWEEN', cross: 'CENTER' });
hPicker.appendChild(T('Updating as Handler', { size: 13, style: 'Medium', color: CF.ink }));
var handlerPill = selectPill('Tola (Site Supervisor)', 'user', { h: 34 });
hPicker.appendChild(handlerPill);
updateForm.appendChild(hPicker);

// editable item card
var itemCard = FR('itemCard', { dir: 'v', w: 712, p: 16, r: 8, stroke: CF.borderSoft, fill: '#FAFAF9', gap: 12 });
var itemHead = FR('head', { dir: 'h', w: 680, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var itemInfo = FR('info', { dir: 'v', hug: true, gap: 2 });
itemInfo.appendChild(T('1.6.1.2 · Install board & reinforcement', { size: 14, style: 'Bold', color: CF.ink }));
itemInfo.appendChild(T('GF · Test area · Trade: Board installation · Weight: 75%', { size: 12, color: CF.sec }));
itemHead.appendChild(itemInfo);
itemHead.appendChild(chipPill('Baseline: 25%', CF.selected, CF.accent));
itemCard.appendChild(itemHead);

// input row
var inputRow = FR('inputs', { dir: 'h', w: 680, gap: 16, cross: 'CENTER' });
var valCol = FR('val', { dir: 'v', w: 160, gap: 6 });
valCol.appendChild(T('New progress (%)', { size: 12, style: 'Medium', color: CF.ink }));
valCol.appendChild(inputField('50', { w: 160, h: 36 }));
inputRow.appendChild(valCol);

var noteCol = FR('note', { dir: 'v', w: 504, gap: 6 });
noteCol.appendChild(T('Site remarks', { size: 12, style: 'Medium', color: CF.ink }));
noteCol.appendChild(inputField('Reinforcement bars inspected and fixed.', { w: 504, h: 36 }));
inputRow.appendChild(noteCol);
itemCard.appendChild(inputRow);
updateForm.appendChild(itemCard);

// footer actions
var formFoot = FR('foot', { dir: 'h', w: 712, main: 'SPACE_BETWEEN', cross: 'CENTER', pt: 8 });
formFoot.appendChild(buttonGhost('Attach photos', 'upload', { h: 36 }));
var actRight = FR('right', { dir: 'h', hug: true, gap: 8 });
actRight.appendChild(buttonGhost('Save draft', null, { h: 36 }));
actRight.appendChild(buttonPrimary('Submit update', 'check', { h: 36 }));
formFoot.appendChild(actRight);
updateForm.appendChild(formFoot);

c16.appendChild(updateForm);

frameLabel(s16.page, '16 · NBC BP03 — Update progress — /projects-progress/nbc-bp03/update', 0, 14656);

return { frame: s16.frame.id, name: s16.frame.name };

    })());

    // ===== s17-nbc-issues.js =====
    results.push(await (async function () {
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

    })());

    // ===== s18-settings-appearance.js =====
    results.push(await (async function () {
// 18 · Settings — Appearance  (/settings/appearance)
var s18 = await surfacePage('18 · Settings — Appearance', { sidebar: 'none', crumb: 'Settings / Appearance', x: 0, y: 16660 });
var c18 = s18.col;
c18.clipsContent = true;

// page heading
var setHead18 = FR('Heading', { dir: 'v', w: 1080, gap: 6 });
setHead18.appendChild(T('Settings', { size: 36, style: 'Bold', color: CF.ink, lh: 42, ls: -1.5 }));
setHead18.appendChild(T('A workspace that feels like yours.', { size: 14.5, color: CF.sec, lh: 20 }));
c18.appendChild(setHead18);
c18.appendChild(spacer(1, 24));

// settings layout: 2-column (nav 240, content 800)
var sLayout18 = FR('Settings layout', { dir: 'h', w: 1080, gap: 32 });

// nav column
var sNav18 = FR('Settings nav', { dir: 'v', w: 220, gap: 4 });
var navIt1 = FR('item/appearance', { dir: 'h', w: 220, h: 36, pl: 10, pr: 10, r: 6, fill: CF.selected, cross: 'CENTER', gap: 8 });
navIt1.appendChild(ICO('monitor', 16, CF.accent));
navIt1.appendChild(T('Appearance', { size: 13, style: 'Semi Bold', color: CF.accent }));
navIt1.appendChild(growSpacer());
navIt1.appendChild(ICO('chevron-right', 14, CF.accent));
sNav18.appendChild(navIt1);

var navIt2 = FR('item/account', { dir: 'h', w: 220, h: 36, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 8 });
navIt2.appendChild(ICO('user', 16, CF.sec));
navIt2.appendChild(T('Account & sync', { size: 13, color: CF.body }));
navIt2.appendChild(growSpacer());
navIt2.appendChild(ICO('chevron-right', 14, CF.sec));
sNav18.appendChild(navIt2);
sLayout18.appendChild(sNav18);

// content column
var sCont18 = FR('Settings content', { dir: 'v', w: 828, gap: 24 });
var cHead18 = FR('chead', { dir: 'v', w: 828, gap: 4 });
cHead18.appendChild(T('Appearance', { size: 20, style: 'Bold', color: CF.ink }));
cHead18.appendChild(T('Make yourself at home.', { size: 13, color: CF.sec }));
sCont18.appendChild(cHead18);
sCont18.appendChild(divider(828));

// section 1: Display
var sec1 = FR('sec/display', { dir: 'v', w: 828, gap: 10 });
sec1.appendChild(T('Display', { size: 14, style: 'Semi Bold', color: CF.ink }));
var card1 = FR('card', { dir: 'h', w: 828, h: 64, pl: 16, pr: 16, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var card1L = FR('left', { dir: 'v', hug: true, gap: 2 });
card1L.appendChild(T('Reduce motion', { size: 13.5, style: 'Medium', color: CF.ink }));
card1L.appendChild(T('Gentler animations and simpler transitions across the app.', { size: 12, color: CF.sec }));
card1.appendChild(card1L);
card1.appendChild(checkbox(false, 18));
sec1.appendChild(card1);
sCont18.appendChild(sec1);

// section 2: Calendar display
var sec2 = FR('sec/calendar', { dir: 'v', w: 828, gap: 10 });
sec2.appendChild(T('Calendar display', { size: 14, style: 'Semi Bold', color: CF.ink }));
var card2 = FR('card', { dir: 'v', w: 828, r: 8, stroke: CF.border, fill: '#FFFFFF', clip: true });

var row2A = FR('rowA', { dir: 'h', w: 828, h: 54, pl: 16, pr: 16, cross: 'CENTER', main: 'SPACE_BETWEEN' });
row2A.appendChild(T('Week start day', { size: 13, color: CF.body }));
row2A.appendChild(selectPill('Monday', null, { h: 32 }));
card2.appendChild(row2A);
BORDER(row2A, 'Bottom', CF.borderSoft);

var row2B = FR('rowB', { dir: 'h', w: 828, h: 54, pl: 16, pr: 16, cross: 'CENTER', main: 'SPACE_BETWEEN' });
row2B.appendChild(T('Time format', { size: 13, color: CF.body }));
row2B.appendChild(selectPill('24-hour (14:00)', null, { h: 32 }));
card2.appendChild(row2B);
sec2.appendChild(card2);
sCont18.appendChild(sec2);

// section 3: Storage
var sec3 = FR('sec/storage', { dir: 'v', w: 828, gap: 10 });
sec3.appendChild(T('Data & storage', { size: 14, style: 'Semi Bold', color: CF.ink }));
var card3 = FR('card', { dir: 'h', w: 828, h: 64, pl: 16, pr: 16, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var card3L = FR('left', { dir: 'v', hug: true, gap: 2 });
card3L.appendChild(T('Export workspace backup', { size: 13.5, style: 'Medium', color: CF.ink }));
card3L.appendChild(T('Save all pages, projects, and tasks to a JSON archive.', { size: 12, color: CF.sec }));
card3.appendChild(card3L);
card3.appendChild(buttonGhost('Export archive', 'download', { h: 32 }));
sec3.appendChild(card3);
sCont18.appendChild(sec3);

sLayout18.appendChild(sCont18);
c18.appendChild(sLayout18);

frameLabel(s18.page, '18 · Settings — Appearance — /settings/appearance', 0, 16616);

return { frame: s18.frame.id, name: s18.frame.name };

    })());

    // ===== s19-settings-account.js =====
    results.push(await (async function () {
// 19 · Settings — Account  (/settings/account)
var s19 = await surfacePage('19 · Settings — Account', { sidebar: 'none', crumb: 'Settings / Account', x: 0, y: 17640 });
var c19 = s19.col;
c19.clipsContent = true;

// page heading
var setHead19 = FR('Heading', { dir: 'v', w: 1080, gap: 6 });
setHead19.appendChild(T('Settings', { size: 36, style: 'Bold', color: CF.ink, lh: 42, ls: -1.5 }));
setHead19.appendChild(T('A workspace that feels like yours.', { size: 14.5, color: CF.sec, lh: 20 }));
c19.appendChild(setHead19);
c19.appendChild(spacer(1, 24));

// settings layout
var sLayout19 = FR('Settings layout', { dir: 'h', w: 1080, gap: 32 });

// nav column
var sNav19 = FR('Settings nav', { dir: 'v', w: 220, gap: 4 });
var nav19_1 = FR('item/appearance', { dir: 'h', w: 220, h: 36, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 8 });
nav19_1.appendChild(ICO('monitor', 16, CF.sec));
nav19_1.appendChild(T('Appearance', { size: 13, color: CF.body }));
nav19_1.appendChild(growSpacer());
nav19_1.appendChild(ICO('chevron-right', 14, CF.sec));
sNav19.appendChild(nav19_1);

var nav19_2 = FR('item/account', { dir: 'h', w: 220, h: 36, pl: 10, pr: 10, r: 6, fill: CF.selected, cross: 'CENTER', gap: 8 });
nav19_2.appendChild(ICO('user', 16, CF.accent));
nav19_2.appendChild(T('Account & sync', { size: 13, style: 'Semi Bold', color: CF.accent }));
nav19_2.appendChild(growSpacer());
nav19_2.appendChild(ICO('chevron-right', 14, CF.accent));
sNav19.appendChild(nav19_2);
sLayout19.appendChild(sNav19);

// content column
var sCont19 = FR('Settings content', { dir: 'v', w: 828, gap: 24 });
var cHead19 = FR('chead', { dir: 'v', w: 828, gap: 4 });
cHead19.appendChild(T('Account & sync', { size: 20, style: 'Bold', color: CF.ink }));
cHead19.appendChild(T('Your account, your work. Always together.', { size: 13, color: CF.sec }));
sCont19.appendChild(cHead19);
sCont19.appendChild(divider(828));

// user profile card
var uCard = FR('profile card', { dir: 'h', w: 828, p: 18, r: 10, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', gap: 16 });
uCard.appendChild(avatar('K', 44, CF.accent, '#FFFFFF'));
var uInfo = FR('info', { dir: 'v', hug: true, gap: 4 });
uInfo.appendChild(T('Kim Por', { size: 16, style: 'Bold', color: CF.ink }));
uInfo.appendChild(T('por@example.invalid · Workspace Owner', { size: 13, color: CF.sec }));
uCard.appendChild(uInfo);
uCard.appendChild(growSpacer());
uCard.appendChild(chipPill('Active session', CF.green, CF.greenText));
sCont19.appendChild(uCard);

// cloud sync card
var syncCard = FR('sync card', { dir: 'v', w: 828, p: 18, r: 10, stroke: CF.border, fill: '#FFFFFF', gap: 12 });
var sHead = FR('shead', { dir: 'h', w: 792, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var sTitleL = FR('stl', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
sTitleL.appendChild(ICO('database', 16, CF.accent));
sTitleL.appendChild(T('Supabase Cloud Sync', { size: 14, style: 'Semi Bold', color: CF.ink }));
sHead.appendChild(sTitleL);
sHead.appendChild(chipPill('Realtime connected', CF.green, CF.greenText));
syncCard.appendChild(sHead);
syncCard.appendChild(T('Changes are synchronized seamlessly across all linked devices via Supabase database replication.', { size: 12.5, color: CF.sec }));
var syncFoot = FR('sfoot', { dir: 'h', w: 792, main: 'SPACE_BETWEEN', cross: 'CENTER', pt: 6 });
syncFoot.appendChild(T('Last synced: Just now', { size: 12, color: CF.sec }));
syncFoot.appendChild(buttonGhost('Force sync', 'rotate-ccw', { h: 30 }));
syncCard.appendChild(syncFoot);
sCont19.appendChild(syncCard);

// danger / sign out card
var signoutCard = FR('signout card', { dir: 'h', w: 828, p: 18, r: 10, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER', main: 'SPACE_BETWEEN' });
var soL = FR('sol', { dir: 'v', hug: true, gap: 2 });
soL.appendChild(T('Sign out of SingBuild Workspace', { size: 14, style: 'Semi Bold', color: CF.redText }));
soL.appendChild(T('Offline changes will remain preserved in your local IndexedDB cache.', { size: 12, color: CF.sec }));
signoutCard.appendChild(soL);
signoutCard.appendChild(buttonGhost('Sign out', 'log-out', { h: 32, color: CF.redText, iconColor: CF.redText }));
sCont19.appendChild(signoutCard);

sLayout19.appendChild(sCont19);
c19.appendChild(sLayout19);

frameLabel(s19.page, '19 · Settings — Account — /settings/account', 0, 17596);

return { frame: s19.frame.id, name: s19.frame.name };

    })());

    // ===== s20-design.js =====
    results.push(await (async function () {
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

    })());

    // ===== s21-sign-in.js =====
    results.push(await (async function () {
// 21 · Sign-in  (/signin)
var s21 = await centerPage('21 · Sign-in', { sidebar: 'none', crumb: 'Sign in', x: 0, y: 19600 });
var c21 = s21.col;

// auth container card (440 wide, centered)
var authCard = FR('Auth container', { dir: 'v', w: 440, p: 36, r: 16, stroke: CF.border, fill: '#FFFFFF', gap: 24, cross: 'CENTER' });

// brand header
var bRow = FR('Brand', { dir: 'h', hug: true, gap: 10, cross: 'CENTER' });
var bIcon = FR('bicon', { dir: 'h', w: 36, h: 36, r: 8, fill: CF.accent, main: 'CENTER', cross: 'CENTER' });
bIcon.appendChild(ICO('building', 20, '#FFFFFF'));
bRow.appendChild(bIcon);
bRow.appendChild(T('SingBuild', { size: 22, style: 'Bold', color: CF.ink }));
authCard.appendChild(bRow);

var aHead = FR('heading', { dir: 'v', w: 368, gap: 6, cross: 'CENTER' });
aHead.appendChild(T('Welcome to your workspace', { size: 18, style: 'Bold', color: CF.ink, align: 'CENTER' }));
aHead.appendChild(T('Sign in to sync pages, projects, and activities across devices.', { size: 13, color: CF.sec, align: 'CENTER', lh: 18 }));
authCard.appendChild(aHead);

// inputs
var fCol = FR('formFields', { dir: 'v', w: 368, gap: 14 });
var emailField = FR('email', { dir: 'v', w: 368, gap: 6 });
emailField.appendChild(T('Email address', { size: 12.5, style: 'Medium', color: CF.ink }));
emailField.appendChild(inputField('por@example.invalid', { w: 368, h: 40, icon: 'mail' }));
fCol.appendChild(emailField);

var passField = FR('password', { dir: 'v', w: 368, gap: 6 });
passField.appendChild(T('Password', { size: 12.5, style: 'Medium', color: CF.ink }));
passField.appendChild(inputField('••••••••••••', { w: 368, h: 40, icon: 'lock' }));
fCol.appendChild(passField);

var remRow = FR('remember', { dir: 'h', w: 368, main: 'SPACE_BETWEEN', cross: 'CENTER' });
var remL = FR('reml', { dir: 'h', hug: true, gap: 8, cross: 'CENTER' });
remL.appendChild(checkbox(true, 16));
remL.appendChild(T('Keep me signed in', { size: 12.5, color: CF.body }));
remRow.appendChild(remL);
remRow.appendChild(T('Forgot password?', { size: 12.5, style: 'Medium', color: CF.accent }));
fCol.appendChild(remRow);
authCard.appendChild(fCol);

// submit buttons
var btnCol = FR('actions', { dir: 'v', w: 368, gap: 10 });
var signinBtn = FR('signinBtn', { dir: 'h', w: 368, h: 40, r: 8, fill: CF.accent, main: 'CENTER', cross: 'CENTER' });
signinBtn.appendChild(T('Sign in', { size: 14, style: 'Semi Bold', color: '#FFFFFF' }));
btnCol.appendChild(signinBtn);

var guestBtn = FR('guestBtn', { dir: 'h', w: 368, h: 40, r: 8, stroke: CF.border, fill: '#FFFFFF', main: 'CENTER', cross: 'CENTER' });
guestBtn.appendChild(T('Continue as guest (local only)', { size: 13, style: 'Medium', color: CF.ink }));
btnCol.appendChild(guestBtn);
authCard.appendChild(btnCol);

c21.appendChild(authCard);
c21.appendChild(spacer(1, 24));
c21.appendChild(T('SingBuild Workspace · Offline-first project management', { size: 12, color: CF.sec }));

frameLabel(s21.page, '21 · Sign-in — /signin', 0, 19556);

return { frame: s21.frame.id, name: s21.frame.name };

    })());

    // ===== s22-command-palette.js =====
    results.push(await (async function () {
// 22 · Command palette (overlay)  (⌘K)
var scr22 = await desktopScreen('22 · Command palette', { sidebar: 'none', crumb: 'Projects', x: 0, y: 20580 });
var canvas22 = scr22.canvas;

// backdrop overlay
var backdrop = FR('Backdrop overlay', { w: 1440, h: 900, fill: '#000000', cross: 'CENTER', main: 'CENTER' });
backdrop.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.35 }];
backdrop.layoutPositioning = 'ABSOLUTE';
backdrop.x = 0; backdrop.y = 0;
scr22.frame.appendChild(backdrop);

// centered palette modal (640 wide)
var modal = FR('Command palette modal', { dir: 'v', w: 640, r: 14, stroke: CF.border, fill: '#FFFFFF', clip: true, gap: 0 });
modal.layoutPositioning = 'ABSOLUTE';
modal.x = 400; modal.y = 160;

// search bar
var searchBar = FR('searchBar', { dir: 'h', w: 640, h: 56, pl: 18, pr: 18, gap: 12, cross: 'CENTER' });
searchBar.appendChild(ICO('search', 20, CF.sec));
searchBar.appendChild(T('Type a command or search workspace…', { size: 15, color: CF.sec }));
searchBar.appendChild(growSpacer());
var escPill = FR('esc', { dir: 'h', hug: true, h: 22, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: CF.neutral, cross: 'CENTER' });
escPill.appendChild(T('ESC', { size: 10.5, style: 'Semi Bold', color: CF.sec }));
searchBar.appendChild(escPill);
modal.appendChild(searchBar);
BORDER(searchBar, 'Bottom', CF.borderSoft);

// list of commands
var cmdList = FR('cmdList', { dir: 'v', w: 640, p: 10, gap: 4 });

// group 1: Actions
cmdList.appendChild(T('Actions', { size: 11, style: 'Semi Bold', color: CF.muted }));
var cmd1 = FR('cmd1', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, fill: CF.selected, cross: 'CENTER', gap: 10 });
cmd1.appendChild(ICO('plus', 16, CF.accent));
cmd1.appendChild(T('Create new task', { size: 13, style: 'Medium', color: CF.ink }));
cmd1.appendChild(growSpacer());
var kbd1 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd1.appendChild(T('N', { size: 10.5, color: CF.sec }));
cmd1.appendChild(kbd1);
cmdList.appendChild(cmd1);

var cmd2 = FR('cmd2', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 10 });
cmd2.appendChild(ICO('folder', 16, CF.sec));
cmd2.appendChild(T('Create new project', { size: 13, color: CF.body }));
cmd2.appendChild(growSpacer());
var kbd2 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd2.appendChild(T('P', { size: 10.5, color: CF.sec }));
cmd2.appendChild(kbd2);
cmdList.appendChild(cmd2);

// group 2: Navigation
cmdList.appendChild(spacer(1, 6));
cmdList.appendChild(T('Navigation', { size: 11, style: 'Semi Bold', color: CF.muted }));
var cmd3 = FR('cmd3', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 10 });
cmd3.appendChild(ICO('calendar', 16, CF.sec));
cmd3.appendChild(T('Go to Calendar', { size: 13, color: CF.body }));
cmd3.appendChild(growSpacer());
var kbd3 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd3.appendChild(T('G C', { size: 10.5, color: CF.sec }));
cmd3.appendChild(kbd3);
cmdList.appendChild(cmd3);

var cmd4 = FR('cmd4', { dir: 'h', w: 620, h: 42, pl: 10, pr: 10, r: 6, cross: 'CENTER', gap: 10 });
cmd4.appendChild(ICO('chart-column', 16, CF.sec));
cmd4.appendChild(T('Go to Projects Progress', { size: 13, color: CF.body }));
cmd4.appendChild(growSpacer());
var kbd4 = FR('kbd', { dir: 'h', hug: true, h: 20, pl: 6, pr: 6, r: 4, stroke: CF.border, fill: '#FFFFFF', cross: 'CENTER' });
kbd4.appendChild(T('G P', { size: 10.5, color: CF.sec }));
cmd4.appendChild(kbd4);
cmdList.appendChild(cmd4);

modal.appendChild(cmdList);

// footer
var foot22 = FR('foot', { dir: 'h', w: 640, h: 36, pl: 16, pr: 16, cross: 'CENTER', fill: '#FAFAF9', gap: 14 });
BORDER(foot22, 'Top', CF.borderSoft);
foot22.appendChild(T('↑↓ Navigate', { size: 11, color: CF.sec }));
foot22.appendChild(T('↵ Select', { size: 11, color: CF.sec }));
foot22.appendChild(T('esc Dismiss', { size: 11, color: CF.sec }));
modal.appendChild(foot22);

scr22.frame.appendChild(modal);

frameLabel(scr22.page, '22 · Command palette (overlay) — ⌘K', 0, 20536);

return { frame: scr22.frame.id, name: scr22.frame.name };

    })());

    figma.notify("SingBuild: built " + results.length + " screens");
    console.log("SingBuild screens", JSON.stringify(results, null, 2));
  } catch (err) {
    var msg = (err && err.message) || String(err);
    console.error(err);
    figma.notify("SingBuild failed: " + msg, { error: true, timeout: 30000 });
  } finally {
    figma.closePlugin();
  }
})();
