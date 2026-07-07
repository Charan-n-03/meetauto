# MeetAuto
<img src= "https://img.shields.io/badge/vibe-coded-red">
MeetAuto is a Chrome extension that automates joining Google Meet calls silently. It schedules Meet links, opens them at the right time, disables camera and microphone, and clicks the join button automatically.

## Features

- Schedule Google Meet links from the extension popup UI
- Automatically open Meet links at the scheduled time
- Auto-disable camera and microphone before joining
- Auto-click the Meet join button
- Supports recurring meetings: daily, weekly, and weekdays
- Shows upcoming, today, and joined meeting stats
- Uses Chrome storage, alarms, and notifications

## Files

- `manifest.json` - Manifest V3 configuration for the Chrome extension
- `popup.html` - Popup UI layout and styles
- `popup.js` - Popup logic for scheduling meetings, editing, and saving data
- `background.js` - Service worker for alarms, scheduling, and auto-join orchestration
- `content.js` - Injected content script on `meet.google.com` to mute camera/mic and join Meet
- `meetauto_deep_dive.md` - Design notes and technical deep dive documentation

## Installation
1. Run `git clone https://github.com/Charan-n-03/meetauto.git` or Download zip file of meetauto.  
2. Open Chrome and go to `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the `MeetAuto` project folder
6. The extension should appear as `MeetAuto`

## Usage

1. Click the MeetAuto toolbar icon
2. Add a new Google Meet link with date, time, and repeat options
3. Save the meeting schedule
4. MeetAuto will automatically launch and join the meeting at the scheduled time

## Notes

- The extension needs permission to access `https://meet.google.com/*`
- It relies on Google Meet's pre-join UI and may require updates if Meet’s interface changes
- The extension is designed to open the Meet tab actively so the silent join flow can complete

## License

This project has no license file. Add one if you want to share or reuse this code.
