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
