// MeetAuto — Background Service Worker

function extractCode(url) {
  try { var u = new URL(url); var p = u.pathname.replace(/^\//, '').split('/'); return p[p.length - 1] || ''; }
  catch (e) { return url; }
}

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

function isJoinedFor(m, joined) {
  if (m.repeat === 'none') return !!joined[m.id];
  return joined[m.id] === getNextDate(m);
}

function fmtTime(t) {
  var parts = t.split(':').map(Number);
  return (parts[0] % 12 || 12) + ':' + String(parts[1]).padStart(2, '0') + ' ' + (parts[0] >= 12 ? 'PM' : 'AM');
}

// Stores the tab ID that was active before auto-join
var previousTabId = null;

function triggerJoin(m) {
  chrome.storage.local.get(['cfg'], function (data) {
    var cfg = data.cfg || {};

    // Remember which tab is currently active so we can return to it
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) previousTabId = tabs[0].id;

      // Set auto-join flag for content script
      chrome.storage.local.set({ _autoJoin: { url: m.link, time: Date.now() } });

      // MUST open as active — background tabs can't render Meet's pre-join UI
      // Content script will refocus previous tab after joining
      chrome.tabs.create({ url: m.link, active: true });

      // Notification
      if (cfg.notif !== false) {
        chrome.notifications.create('meetauto-' + m.id, {
          type: 'basic',
          title: 'MeetAuto — Joining Now',
          message: extractCode(m.link) + ' at ' + fmtTime(m.time),
          priority: 2
        });
      }

      // Mark joined and schedule next for recurring
      chrome.storage.local.get(['joined'], function (data) {
        var joined = data.joined || {};
        var today = new Date().toISOString().split('T')[0];
        joined[m.id] = m.repeat === 'none' ? '1' : today;
        chrome.storage.local.set({ joined });

        if (m.repeat !== 'none') {
          var nextDate = getNextDate(m);
          var earlyMs = (cfg.early || 0) * 1000;
          var nextTime = new Date(nextDate + 'T' + m.time + ':00').getTime() - earlyMs;
          if (nextTime > Date.now() + 60000) {
            chrome.alarms.create(m.id, { when: nextTime });
          }
        }
      });
    });
  });
}

function syncAllAlarms() {
  chrome.storage.local.get(['meets', 'cfg', 'joined'], function (data) {
    var meets = data.meets || [];
    var cfg = data.cfg || {};
    var joined = data.joined || {};
    var now = Date.now();
    var earlyMs = (cfg.early || 0) * 1000;

    chrome.alarms.clearAll(function () {
      meets.forEach(function (m) {
        var nd = getNextDate(m);
        var j = isJoinedFor(m, joined);
        if (j) return;

        var alarmTime = new Date(nd + 'T' + m.time + ':00').getTime() - earlyMs;

        if (alarmTime <= now) {
          if (now - alarmTime < 120000) triggerJoin(m);
          return;
        }

        if (alarmTime - now < 30000) {
          triggerJoin(m);
          return;
        }

        chrome.alarms.create(m.id, { when: alarmTime });
      });
    });
  });
}

chrome.alarms.onAlarm.addListener(function (alarm) {
  chrome.storage.local.get(['meets'], function (data) {
    var m = (data.meets || []).find(function (x) { return x.id === alarm.name; });
    if (m) triggerJoin(m);
  });
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === 'syncAlarms') {
    syncAllAlarms();
    sendResponse({ ok: true });
  }

  // Content script says it finished joining — refocus previous tab
  if (msg.action === 'joined') {
    if (previousTabId) {
      chrome.tabs.update(previousTabId, { active: true }, function () {
        previousTabId = null;
      });
    }
    sendResponse({ ok: true });
  }
});

chrome.runtime.onInstalled.addListener(function () { syncAllAlarms(); });