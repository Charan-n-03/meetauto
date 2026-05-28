// ==================== HELPERS ====================
function ic(name, size) {
  size = size || 12;
  return '<svg width="' + size + '" height="' + size + '"><use href="#i-' + name + '"/></svg>';
}
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function extractCode(url) {
  try { var u = new URL(url); var p = u.pathname.replace(/^\//, '').split('/'); return p[p.length - 1] || url; }
  catch (e) { return url; }
}
function fmtTime(t) {
  var parts = t.split(':').map(Number);
  var h = parts[0], m = parts[1];
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
}
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function repLabel(r) { return { none: '', daily: 'Daily', weekly: 'Weekly', weekday: 'Weekdays' }[r] || ''; }
function isToday(d) { return d === new Date().toISOString().split('T')[0]; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function getNextDate(m) {
  var base = new Date(m.date + 'T' + m.time + ':00');
  if (m.repeat === 'none') return m.date;
  var now = new Date();
  var next = new Date(now);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (m.repeat === 'weekly') {
    while (next.getDay() !== base.getDay()) next.setDate(next.getDate() + 1);
  } else if (m.repeat === 'weekday') {
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  }
  return next.toISOString().split('T')[0];
}

function isJoinedFor(m, j) {
  if (m.repeat === 'none') return !!j[m.id];
  return j[m.id] === getNextDate(m);
}

function fmtCD(ms) {
  if (ms <= 0) return { t: 'Now', c: 'past' };
  var ts = Math.floor(ms / 1000), d = Math.floor(ts / 86400), h = Math.floor((ts % 86400) / 3600), mi = Math.floor((ts % 3600) / 60), s = ts % 60;
  if (d > 0) return { t: d + 'd ' + h + 'h', c: '' };
  if (h > 0) return { t: h + 'h ' + String(mi).padStart(2, '0') + 'm', c: '' };
  if (mi > 5) return { t: mi + 'm ' + String(s).padStart(2, '0') + 's', c: '' };
  return { t: String(mi).padStart(2, '0') + ':' + String(s).padStart(2, '0'), c: 'soon' };
}

// ==================== STATE ====================
var meets = [], cfg = {}, joined = {};
var currentTab = 'meets';

function load(cb) {
  chrome.storage.local.get(['meets', 'cfg', 'joined'], function (d) {
    meets = d.meets || [];
    cfg = d.cfg || { name: 'Work', email: '', early: 30, sound: true, notif: true, auto: true, autoJoinAll: true };
    joined = d.joined || {};
    if (cb) cb();
  });
}

function save() {
  chrome.storage.local.set({ meets: meets, cfg: cfg, joined: joined });
}

// ==================== CLOCK ====================
function tick() {
  var n = new Date();
  var h = String(n.getHours()).padStart(2, '0');
  var m = String(n.getMinutes()).padStart(2, '0');
  var s = String(n.getSeconds()).padStart(2, '0');
  document.getElementById('clk').innerHTML = h + ':' + m + '<span class="s">:' + s + '</span>';
}

// ==================== TABS ====================
function goTab(t) {
  currentTab = t;
  document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
  renderBody();
}

// ==================== RENDER ====================
function renderBody() {
  if (currentTab === 'meets') renderMeets();
  else renderSettings();
}

function renderMeets() {
  var now = new Date();
  var today = [], upcoming = [], past = [];

  meets.forEach(function (m) {
    var j = isJoinedFor(m, joined);
    var nd = getNextDate(m);
    var next = new Date(nd + 'T' + m.time + ':00');
    var ms = next - now;
    var cd = fmtCD(ms);
    var card = { m: m, j: j, ms: ms, cd: cd };
    if (j) past.push(card);
    else if (isToday(m.date) || (m.repeat !== 'none' && ms < 86400000)) today.push(card);
    else upcoming.push(card);
  });

  today.sort(function (a, b) { return a.ms - b.ms; });
  upcoming.sort(function (a, b) { return a.ms - b.ms; });

  var html = '';

  if (today.length) {
    html += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--wn);margin-bottom:8px;display:flex;align-items:center;gap:5px"><span style="width:5px;height:5px;border-radius:50%;background:var(--wn);display:inline-block"></span>Today</div>';
    today.forEach(function (c) { html += cardHtml(c); });
    html += '</div>';
  }
  if (upcoming.length) {
    html += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--ac);margin-bottom:8px;display:flex;align-items:center;gap:5px"><span style="width:5px;height:5px;border-radius:50%;background:var(--ac);display:inline-block"></span>Upcoming</div>';
    upcoming.forEach(function (c) { html += cardHtml(c); });
    html += '</div>';
  }
  if (past.length) {
    html += '<div><div style="font-size:11px;font-weight:600;color:var(--fg3);margin-bottom:8px;display:flex;align-items:center;gap:5px"><span style="width:5px;height:5px;border-radius:50%;background:var(--fg3);display:inline-block"></span>Auto-Joined</div>';
    past.forEach(function (c) { html += cardHtml(c); });
    html += '</div>';
  }

  if (!meets.length) {
    html = '<div class="empty"><svg><use href="#i-camoff"/></svg><h3>No Meets Scheduled</h3><p>Add a Google Meet link and let MeetAuto handle the rest.</p></div>';
  }

  html += '<button class="btn btn-p add-btn" data-action="add">' + ic('plus', 13) + ' Schedule Meet</button>';
  document.getElementById('body').innerHTML = html;
  updateStats();
}

function cardHtml(data) {
  var m = data.m, j = data.j, ms = data.ms, cd = data.cd;
  var code = extractCode(m.link);
  var imminent = ms > 0 && ms <= 60000 && !j;
  var cls = 'mc' + (j ? ' joined' : '') + (imminent ? ' soon' : '');
  var h = '<div class="' + cls + '" data-id="' + m.id + '">';
  if (j) h += '<div class="jb">Joined</div>';
  h += '<div class="mc-top"><div>';
  h += '<div class="mc-code">' + esc(code) + '</div>';
  h += '<div class="mc-meta">';
  h += '<span class="mc-mi">' + ic('cal', 10) + fmtDate(m.date) + (m.repeat !== 'none' ? ' &middot; ' + repLabel(m.repeat) : '') + '</span>';
  h += '<span class="mc-mi">' + ic('clock', 10) + fmtTime(m.time) + '</span>';
  h += '</div>';
  h += '<div class="mc-url">' + ic('link', 9) + esc(m.link) + '</div>';
  h += '</div></div>';
  h += '<div class="mc-tags">';
  h += '<span class="tag tag-off">' + ic('camoff', 8) + 'Cam Off</span>';
  h += '<span class="tag tag-off">' + ic('micoff', 8) + 'Mic Off</span>';
  if (m.repeat !== 'none') h += '<span class="tag tag-r">' + ic('redo', 8) + repLabel(m.repeat) + '</span>';
  if (m.notes) h += '<span class="tag tag-n">' + ic('note', 8) + esc(m.notes) + '</span>';
  h += '</div>';
  h += '<div class="mc-bot"><div>';
  h += '<div class="cd-label">' + (j ? 'Status' : imminent ? 'Starting soon' : 'Countdown') + '</div>';
  h += '<div class="cd ' + cd.c + '">' + (j ? 'Joined' : cd.t) + '</div>';
  h += '</div><div class="mc-acts">';
  if (!j) h += '<button class="btn btn-p btn-sm" data-action="join" data-id="' + m.id + '" title="Join Now">' + ic('join', 11) + '</button>';
  h += '<button class="btn btn-g btn-sm" data-action="edit" data-id="' + m.id + '" title="Edit">' + ic('edit', 11) + '</button>';
  h += '<button class="btn btn-g btn-sm" data-action="delete" data-id="' + m.id + '" title="Delete" style="color:var(--dn)">' + ic('trash', 11) + '</button>';
  h += '</div></div></div>';
  return h;
}

function updateStats() {
  var now = new Date();
  var up = 0, td = 0, jn = 0;
  meets.forEach(function (m) {
    if (isJoinedFor(m, joined)) { jn++; return; }
    var nd = getNextDate(m);
    var ms = new Date(nd + 'T' + m.time + ':00') - now;
    if (ms > 0) { up++; if (isToday(m.date) || (m.repeat !== 'none' && ms < 86400000)) td++; }
  });
  document.getElementById('sUp').textContent = up;
  document.getElementById('sTd').textContent = td;
  document.getElementById('sJn').textContent = jn;
}

// Countdown refresh
setInterval(function () {
  var now = new Date();
  document.querySelectorAll('.mc:not(.joined)').forEach(function (card) {
    var m = meets.find(function (x) { return x.id === card.dataset.id; });
    if (!m) return;
    var nd = getNextDate(m);
    var ms = new Date(nd + 'T' + m.time + ':00') - now;
    var cd = fmtCD(ms);
    var ct = card.querySelector('.cd');
    var cl = card.querySelector('.cd-label');
    if (ct) { ct.textContent = cd.t; ct.className = 'cd ' + cd.c; }
    if (cl) cl.textContent = ms > 0 && ms <= 60000 ? 'Starting soon' : 'Countdown';
    card.classList.toggle('soon', ms > 0 && ms <= 60000);
  });
}, 1000);

function renderSettings() {
  var s = cfg;
  var h = '';
  h += '<div class="sb"><h4>Account</h4><p>Browser\'s active Google login is used when joining</p>';
  h += '<div class="fg" style="margin-bottom:0"><label class="fl">Label</label><input class="fi" id="sN" value="' + esc(s.name || '') + '" placeholder="e.g. Work"></div>';
  h += '<div class="sr"><div><div class="sr-l">Email</div><div class="sr-d">Display only</div></div><input class="fi" id="sE" style="width:200px" value="' + esc(s.email || '') + '" placeholder="user@gmail.com"></div></div>';
  h += '<div class="sb"><h4>Auto-Join</h4><p>Controls when and how meetings are joined</p>';
  h += '<div class="sr"><div><div class="sr-l">Master Switch</div><div class="sr-d">Disable to stop all auto-joining</div></div><button class="tg ' + (s.auto !== false ? 'on' : '') + '" id="tAuto"></button></div>';
  h += '<div class="sr"><div><div class="sr-l">Auto-Join All Meet Pages</div><div class="sr-d">Any Meet page you open also auto-joins silently</div></div><button class="tg ' + (s.autoJoinAll !== false ? 'on' : '') + '" id="tAll"></button></div>';
  h += '<div class="sr"><div><div class="sr-l">Early Join</div><div class="sr-d">Open Meet link this early</div></div><select class="fs" id="sEarly" style="width:130px"><option value="0"' + (s.early == 0 ? ' selected' : '') + '>On time</option><option value="10"' + (s.early == 10 ? ' selected' : '') + '>10s early</option><option value="30"' + (s.early == 30 ? ' selected' : '') + '>30s early</option><option value="60"' + (s.early == 60 ? ' selected' : '') + '>1 min early</option><option value="120"' + (s.early == 120 ? ' selected' : '') + '>2 min early</option></select></div>';
  h += '<div class="sr"><div><div class="sr-l">Sound Alert</div><div class="sr-d">Play chime when joining</div></div><button class="tg ' + (s.sound !== false ? 'on' : '') + '" id="tSound"></button></div>';
  h += '<div class="sr"><div><div class="sr-l">Notification</div><div class="sr-d">System notification on join</div></div><button class="tg ' + (s.notif !== false ? 'on' : '') + '" id="tNotif"></button></div>';
  h += '</div>';
  h += '<div class="sb"><h4>Data</h4><p>Stored in Chrome - persists across restarts</p>';
  h += '<div class="sr"><div><div class="sr-l">Clear All</div><div class="sr-d">Remove all meetings</div></div><button class="btn btn-d btn-sm" data-action="clearAll">' + ic('trash', 11) + ' Clear</button></div>';
  h += '<div class="sr"><div><div class="sr-l">Export</div><div class="sr-d">Download JSON backup</div></div><button class="btn btn-g btn-sm" data-action="export">' + ic('link', 11) + ' Export</button></div>';
  h += '</div>';
  h += '<button class="btn btn-p save-btn" data-action="saveCfg">' + ic('check', 12) + ' Save Settings</button>';
  document.getElementById('body').innerHTML = h;
}

function saveCfg() {
  cfg.name = document.getElementById('sN').value || 'Work';
  cfg.email = document.getElementById('sE').value || '';
  cfg.early = parseInt(document.getElementById('sEarly').value);
  cfg.auto = document.getElementById('tAuto').classList.contains('on');
  cfg.autoJoinAll = document.getElementById('tAll').classList.contains('on');
  cfg.sound = document.getElementById('tSound').classList.contains('on');
  cfg.notif = document.getElementById('tNotif').classList.contains('on');
  save();
  chrome.runtime.sendMessage({ action: 'syncAlarms' });
  toast('Settings saved', 'ok');
}

// ==================== CRUD ====================
function openAdd() {
  document.getElementById('fId').value = '';
  document.getElementById('moTitle').textContent = 'Schedule Meet';
  document.getElementById('moBtn').innerHTML = ic('plus', 12) + '<span>Schedule</span>';
  document.getElementById('mForm').reset();
  var t = new Date(), nh = new Date(t.getTime() + 3600000);
  nh.setMinutes(0, 0, 0);
  document.getElementById('fDate').value = t.toISOString().split('T')[0];
  document.getElementById('fTime').value = nh.toTimeString().slice(0, 5);
  document.getElementById('fCam').classList.add('on');
  document.getElementById('fMic').classList.add('on');
  openMo('moAdd');
}

function openEdit(id) {
  var m = meets.find(function (x) { return x.id === id; });
  if (!m) return;
  document.getElementById('fId').value = m.id;
  document.getElementById('moTitle').textContent = 'Edit Meet';
  document.getElementById('moBtn').innerHTML = ic('check', 12) + '<span>Save</span>';
  document.getElementById('fLink').value = m.link;
  document.getElementById('fDate').value = m.date;
  document.getElementById('fTime').value = m.time;
  document.getElementById('fRepeat').value = m.repeat;
  document.getElementById('fNotes').value = m.notes || '';
  document.getElementById('fCam').classList.toggle('on', m.camOff);
  document.getElementById('fMic').classList.toggle('on', m.micOff);
  openMo('moAdd');
}

function handleSubmit(e) {
  e.preventDefault();
  var eid = document.getElementById('fId').value;
  var obj = {
    id: eid || genId(),
    link: document.getElementById('fLink').value.trim(),
    date: document.getElementById('fDate').value,
    time: document.getElementById('fTime').value,
    repeat: document.getElementById('fRepeat').value,
    camOff: document.getElementById('fCam').classList.contains('on'),
    micOff: document.getElementById('fMic').classList.contains('on'),
    notes: document.getElementById('fNotes').value.trim(),
    created: eid ? (meets.find(function (x) { return x.id === eid; }) || {}).created || Date.now() : Date.now()
  };
  if (eid) {
    var idx = meets.findIndex(function (x) { return x.id === eid; });
    if (idx !== -1) meets[idx] = obj;
    toast('Meet updated', 'ok');
  } else {
    meets.push(obj);
    toast('Meet scheduled', 'ok');
  }
  save();
  chrome.runtime.sendMessage({ action: 'syncAlarms' });
  renderBody();
  closeMo('moAdd');
}

function confirmDel(id) {
  var m = meets.find(function (x) { return x.id === id; });
  if (!m) return;
  document.getElementById('cfT').textContent = 'Delete Meet?';
  document.getElementById('cfP').textContent = '"' + extractCode(m.link) + '" will be removed.';
  document.getElementById('cfB').onclick = function () { del(id); closeMo('moCf'); };
  openMo('moCf');
}

function del(id) {
  meets = meets.filter(function (x) { return x.id !== id; });
  delete joined[id];
  save();
  chrome.runtime.sendMessage({ action: 'syncAlarms' });
  renderBody();
  toast('Deleted', 'er');
}

function confirmClear() {
  document.getElementById('cfT').textContent = 'Clear All?';
  document.getElementById('cfP').textContent = 'All meetings will be permanently removed.';
  document.getElementById('cfB').onclick = function () {
    meets = []; joined = {};
    save();
    chrome.runtime.sendMessage({ action: 'syncAlarms' });
    renderBody();
    closeMo('moCf');
    toast('All cleared', 'er');
  };
  openMo('moCf');
}

function joinNow(id) {
  var m = meets.find(function (x) { return x.id === id; });
  if (!m) return;
  var nd = getNextDate(m);
  joined[m.id] = m.repeat === 'none' ? '1' : nd;
  save();
  chrome.storage.local.set({ _autoJoin: { url: m.link, time: Date.now() } });
  chrome.tabs.create({ url: m.link });
  toast('Joining ' + extractCode(m.link), 'ok');
  setTimeout(function () { renderBody(); }, 500);
}

function doExport() {
  var blob = new Blob([JSON.stringify({ meets: meets, cfg: cfg, joined: joined }, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'meetauto-export.json';
  a.click();
  toast('Exported', 'in');
}

// ==================== MODALS ====================
function openMo(id) { document.getElementById(id).classList.add('on'); }
function closeMo(id) { document.getElementById(id).classList.remove('on'); }

// ==================== TOAST ====================
function toast(msg, type) {
  type = type || 'in';
  var cMap = { ok: 'check', wn: 'warn', er: 'trash', in: 'link' };
  var c = document.getElementById('toasts');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<svg class="t-ic ' + type + '"><use href="#i-' + cMap[type] + '"/></svg><span>' + esc(msg) + '</span><button class="t-cl"><svg width="10" height="10"><use href="#i-close"/></svg></button>';
  c.appendChild(t);
  // Close button on toast
  t.querySelector('.t-cl').addEventListener('click', function () {
    t.classList.add('out');
    setTimeout(function () { t.remove(); }, 200);
  });
  setTimeout(function () {
    if (t.parentElement) { t.classList.add('out'); setTimeout(function () { t.remove(); }, 200); }
  }, 3500);
}

// ==================== EVENT LISTENERS ====================
function bindEvents() {
  // Tab buttons
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { goTab(btn.dataset.t); });
  });

  // Form submit
  document.getElementById('mForm').addEventListener('submit', handleSubmit);

  // Form toggle buttons
  document.getElementById('fCam').addEventListener('click', function () { this.classList.toggle('on'); });
  document.getElementById('fMic').addEventListener('click', function () { this.classList.toggle('on'); });

  // Close buttons (data-close attribute)
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { closeMo(btn.dataset.close); });
  });

  // Modal overlay click-to-close
  document.querySelectorAll('.mo').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeMo(overlay.id);
    });
  });

  // Escape key to close modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.mo.on').forEach(function (m) { closeMo(m.id); });
    }
  });

  // Event delegation for dynamic content inside #body
  document.getElementById('body').addEventListener('click', function (e) {
    // Handle settings toggle buttons (inside .sb)
    var toggle = e.target.closest('.sb .tg');
    if (toggle) { toggle.classList.toggle('on'); return; }

    // Handle action buttons (data-action attribute)
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var id = btn.dataset.id;

    if (action === 'add') openAdd();
    else if (action === 'edit') openEdit(id);
    else if (action === 'delete') confirmDel(id);
    else if (action === 'join') joinNow(id);
    else if (action === 'saveCfg') saveCfg();
    else if (action === 'clearAll') confirmClear();
    else if (action === 'export') doExport();
  });
}

// ==================== INIT ====================
load(function () {
  tick();
  setInterval(tick, 1000);
  bindEvents();
  renderBody();
});