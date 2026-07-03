# Vlad Brodyaga — Web UI

Mobile-first web app to configure the desk device. Works standalone
(browser storage) and **syncs with the Pi over the home network** when it's
reachable (`pi/` backend, port 8787).

## Run locally

```bash
cd web
npm install
npm run dev
```

- **Settings app:** `http://localhost:5173` — Alarm, Pomodoro, Timer, Upload
- **Device preview:** `http://localhost:5173/device.html` — OLED simulator in a separate window (use “Open device preview” in the sidebar, or open the link directly)

Open the settings URL in Chrome and use DevTools → iPhone size to preview mobile layout. Keep device preview in a second tab or window while you configure alarm/timer settings.

## Features

- **Alarm** — list of alarms (weekday / weekend / custom days), per-alarm time + wake-up song (Vlad / Karina cards); snooze / turn off a ringing device remotely
- **Pomodoro** — presets (Classic / Deep / Quick) + custom; run locally or start on the device
- **Timer** — presets + custom minutes **and seconds**; run locally or on the device
- **Upload** — add alarm sounds (stored in browser)
- **Device preview** (`/device.html`) — 128×64 OLED simulator with virtual knob and red button (ringing: red = off, knob click = snooze)

Settings persist in browser localStorage and are pushed to the Pi when connected.

## Device connection

- Default address: `http://vlad-brodyaga.local:8787` (when running on `localhost`); same origin when the app is served by the Pi itself.
- Override via the pencil button on the Alarm tab, or with a URL param: `http://localhost:5173/?device=http://localhost:8787`.
- To host this app on the Pi: `npm run build`, then copy `dist/*` to `~/pi/webroot/` on the Pi (see `pi/README.md`).
