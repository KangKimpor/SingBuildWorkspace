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
function statusChip(label) {
  var map = {
    'Blocked': [CF.red, CF.redText], 'Urgent': [CF.red, CF.redText],
    'In progress': [CF.blue, CF.blueText], 'In review': [CF.amber, CF.amberText],
    'Not started': [CF.neutral, CF.sec], 'Done': [CF.green, CF.greenText],
    'Active': [CF.green, CF.greenText], 'On track': [CF.green, CF.greenText],
    'At risk': [CF.amber, CF.amberText], 'Overdue': [CF.red, CF.redText]
  };
  var pair = map[label] || map['Not started'];
  var p = FR('status/' + label, { dir: 'h', hug: true, h: 24, gap: 6, pl: 8, pr: 8, r: 7, fill: pair[0], cross: 'CENTER' });
  p.appendChild(dot8(pair[1]));
  p.appendChild(T(label, { size: 12, style: 'Medium', color: pair[1], lh: 16 }));
  p.appendChild(ICO('chevron-down', 11, pair[1]));
  return p;
}
function priorityChip(label) {
  var map = { 'Urgent': [CF.red, CF.redText], 'High': [CF.red, CF.redText], 'Medium': [CF.blue, CF.blueText], 'Low': [CF.neutral, CF.sec] };
  var pair = map[label] || map['Low'];
  var p = FR('priority/' + label, { dir: 'h', hug: true, h: 24, gap: 6, pl: 8, pr: 8, r: 7, fill: pair[0], cross: 'CENTER' });
  p.appendChild(dot8(pair[1]));
  p.appendChild(T(label, { size: 12, style: 'Medium', color: pair[1], lh: 16 }));
  p.appendChild(ICO('chevron-down', 11, pair[1]));
  return p;
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
function taskCard(o) {
  var w = o.w || 1035;
  var card = FR('task/' + o.title, { dir: 'h', w: w, gap: 12, pt: 12, pb: 12, pl: 12, pr: 14, r: 8, stroke: CF.border, fill: '#FFFFFF', cross: 'MIN' });
  var box = checkbox(!!o.done, 16);
  card.appendChild(box);
  box.layoutAlign = 'INHERIT';
  box.y = 26;

  var col = vcol('fields', w - 12 - 16 - 12 - 8, 8);
  col.appendChild(T(o.title, { size: 14, style: 'Semi Bold', color: CF.ink, lh: 20 }));
  col.appendChild(T(o.project, { size: 12, color: CF.sec }));
  var chips = hrow('meta', w - 60, 8);
  chips.appendChild(statusChip(o.status));
  chips.appendChild(priorityChip(o.priority));
  chips.appendChild(T(o.due, { size: 12.5, color: CF.body }));
  chips.appendChild(ICO('calendar', 15, CF.sec));
  col.appendChild(chips);
  if (o.notes) {
    var note = FR('notes', { dir: 'v', w: w - 60, h: o.notesH || 66, p: 10, r: 7, stroke: CF.border, fill: '#FFFFFF' });
    note.appendChild(T(o.notes, { size: 13, color: CF.body, w: w - 82, lh: 19 }));
    col.appendChild(note);
  }
  var more = hrow('more fields', 120, 6);
  more.appendChild(ICO('chevron-right', 13, CF.sec));
  more.appendChild(T('More fields', { size: 12, color: CF.sec }));
  col.appendChild(more);
  card.appendChild(col);
  return card;
}

// ---------------- page scaffolds ----------------
// Surface page: sidebar + top bar + workspace-surface card, content inset 32.
async function surfacePage(name, opts) {
  opts = opts || {};
  var scr = await desktopScreen(name, opts);
  var w = opts.w || 1144, h = opts.h || 832;
  var s = surfaceCard(scr.canvas, { w: w, h: h });
  var col = FR('Surface body', { dir: 'v', w: w - 64, gap: 0 });
  s.appendChild(col); col.x = 32; col.y = 32;
  return { frame: scr.frame, page: scr.page, surface: s, col: col };
}

// Wide page (NBC views): full-bleed canvas content, 36 inset.
async function widePage(name, opts) {
  opts = opts || {};
  var scr = await desktopScreen(name, opts);
  var col = FR('Content', { dir: 'v', w: 1108, gap: 0 });
  scr.canvas.appendChild(col); col.x = 36; col.y = 32;
  return { frame: scr.frame, page: scr.page, col: col };
}

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
async function mobileScreen(name, opts) {
  opts = opts || {};
  var page = await gotoPage('02 · Mobile screens', CF.pageBg);
  for (var i = 0; i < page.children.length; i++) if (page.children[i].name === name) page.children[i].remove();

  var f = FR(name, { w: 393, h: 852, fill: CF.canvas, clip: true });
  f.x = opts.x || 0; f.y = opts.y || 0;

  // status bar
  var sb = FR('Status bar', { dir: 'h', w: 393, h: 30, pl: 22, pr: 22, cross: 'CENTER' });
  sb.appendChild(T(opts.time || '9:41', { size: 12, style: 'Semi Bold', color: CF.ink }));
  sb.appendChild(growSpacer());
  var sig = FR('icons', { dir: 'h', hug: true, gap: 5, cross: 'CENTER' });
  sig.appendChild(ICO('signal', 14, CF.ink));
  sig.appendChild(ICO('wifi', 14, CF.ink));
  sig.appendChild(ICO('battery', 16, CF.ink));
  sb.appendChild(sig);
  f.appendChild(sb); sb.x = 0; sb.y = 0;

  // app bar
  var bar = FR('Mobile app bar', { dir: 'h', w: 393, h: 46, pl: 16, pr: 16, gap: 12, cross: 'CENTER' });
  var panel = FR('action/menu', { dir: 'h', w: 22, h: 22, main: 'CENTER', cross: 'CENTER' });
  panel.appendChild(ICO('panel-left', 20, CF.ink));
  bar.appendChild(panel);
  bar.appendChild(T(opts.crumb || 'Projects', { size: 14, style: 'Semi Bold', color: CF.ink }));
  bar.appendChild(growSpacer());
  var pill = FR('pill/sync', { dir: 'h', hug: true, h: 22, gap: 4, pl: 8, pr: 8, r: 999, fill: CF.green, main: 'CENTER', cross: 'CENTER' });
  pill.appendChild(ICO('check', 11, CF.body));
  pill.appendChild(T('Demo · local', { size: 10.5, style: 'Medium', color: CF.body, lh: 14 }));
  bar.appendChild(pill);
  bar.appendChild(ICO('search', 19, CF.body));
  bar.appendChild(ICO('more', 19, CF.body));
  f.appendChild(bar); bar.x = 0; bar.y = 30;

  // body column
  var body = FR('Mobile body', { dir: 'v', w: 393, h: 706, pl: 16, pr: 16, pt: 8, gap: 0 });
  f.appendChild(body); body.x = 0; body.y = 76;

  // bottom navigation
  var nav = FR('Bottom nav', { dir: 'h', w: 393, h: 70, pl: 20, pr: 20, cross: 'CENTER', fill: '#FFFFFF' });
  BORDER(nav, 'Top', CF.border);
  var items = [['Workspace', 'grid'], ['Progress', 'chart'], null, ['Search', 'search'], ['Settings', 'settings']];
  items.forEach(function (it) {
    if (!it) {
      var fab = FR('fab', { dir: 'h', w: 56, h: 44, r: 12, main: 'CENTER', cross: 'CENTER', fill: CF.accentFill });
      fab.appendChild(ICO('plus', 24, '#FFFFFF'));
      nav.appendChild(fab);
      var sp = FR('spacer', { w: 12, h: 1 }); nav.appendChild(sp);
      return;
    }
    var item = FR('nav/' + it[0], { dir: 'v', w: 53, gap: 4, cross: 'CENTER', main: 'CENTER' });
    item.appendChild(ICO(it[1], 20, it[0] === 'Settings' ? CF.sec : CF.body));
    item.appendChild(T(it[0], { size: 10.5, color: it[0] === 'Settings' ? CF.sec : CF.body, lh: 13 }));
    nav.appendChild(item);
  });
  f.appendChild(nav); nav.x = 0; nav.y = 782;

  // page label to the left of the frame
  return { frame: f, body: body, page: page };
}

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
