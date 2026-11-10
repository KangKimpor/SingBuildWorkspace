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
