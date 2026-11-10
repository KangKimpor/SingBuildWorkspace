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
