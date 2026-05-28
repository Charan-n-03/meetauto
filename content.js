// MeetAuto — Content Script
// Uses MutationObserver for fast detection, works reliably

(function () {
  'use strict';
  if (!location.hostname.includes('meet.google.com')) return;

  chrome.storage.local.get(['_autoJoin', 'autoJoinAll'], function (data) {
    var currentUrl = location.href.split('?')[0];

    // Check if this was flagged as an auto-join
    var flagged = false;
    if (data._autoJoin) {
      var flagUrl = data._autoJoin.url.split('?')[0];
      if (flagUrl === currentUrl && Date.now() - data._autoJoin.time < 20000) {
        flagged = true;
        chrome.storage.local.remove('_autoJoin');
      }
    }

    var allMode = data.autoJoinAll !== false;
    if (!allMode && !flagged) return;

    var done = false;

    function findBtn(text) {
      var btns = document.querySelectorAll('button, [role="button"]');
      for (var i = 0; i < btns.length; i++) {
        var label = (btns[i].getAttribute('aria-label') || btns[i].textContent || '').toLowerCase();
        if (label.includes(text)) return btns[i];
      }
      return null;
    }

    function playChime() {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        [523.25, 659.25, 783.99].forEach(function (f, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = f;
          gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.15);
          osc.stop(ctx.currentTime + i * 0.15 + 0.5);
        });
      } catch (e) {}
    }

    function doJoin() {
      if (done) return;
      done = true;

      // Turn off camera (only if currently ON)
      var cam = findBtn('turn off camera');
      if (cam) {
        cam.click();
        console.log('[MeetAuto] Camera turned off');
      }

      // Turn off microphone (only if currently ON)
      var mic = findBtn('turn off microphone');
      if (mic) {
        mic.click();
        console.log('[MeetAuto] Microphone turned off');
      }

      // Wait shorter time — buttons are already rendered since tab is active
      setTimeout(function () {
        var join = findBtn('join now') || findBtn('ask to join');
        if (join) {
          join.click();
          playChime();
          console.log('[MeetAuto] Joined silently — cam off, mic off');

          // Tell background to refocus the previous tab
          setTimeout(function () {
            try { chrome.runtime.sendMessage({ action: 'joined' }); } catch (e) {}
          }, 1500);
        } else {
          // If join button still not found, retry once more
          console.log('[MeetAuto] Join button not found, retrying in 2s...');
          done = false;
          setTimeout(function () { doJoin(); }, 2000);
        }
      }, 1200);
    }

    // === MutationObserver approach — detects buttons as soon as they appear ===
    var observer = new MutationObserver(function () {
      if (done) {
        observer.disconnect();
        return;
      }
      // Only act when the page has the pre-join buttons
      if (findBtn('join now') || findBtn('ask to join')) {
        observer.disconnect();
        // Small delay to ensure all buttons are fully interactive
        setTimeout(doJoin, 500);
      }
    });

    // Start observing after DOM is ready
    function startObserving() {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });

      // Safety fallback: if observer misses it, poll as backup
      var pollCount = 0;
      var pollInterval = setInterval(function () {
        if (done) { clearInterval(pollInterval); return; }
        pollCount++;
        if (findBtn('join now') || findBtn('ask to join')) {
          clearInterval(pollInterval);
          observer.disconnect();
          setTimeout(doJoin, 500);
        }
        // Stop polling after 30 seconds
        if (pollCount > 60) clearInterval(pollInterval);
      }, 500);
    }

    if (document.readyState === 'complete') {
      startObserving();
    } else {
      window.addEventListener('load', startObserving);
    }
  });
})();