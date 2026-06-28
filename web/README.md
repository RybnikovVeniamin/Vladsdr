# Vlad Brodyaga — Web UI

Mobile-first web app to configure the alarm device (mock data, no backend yet).

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

- **Alarm** — set time, pick wake-up song via Vlad / Karina cards
- **Pomodoro** — work/break settings and session timer
- **Timer** — countdown
- **Upload** — add alarm sounds (stored in browser)
- **Device preview** (`/device.html`) — 128×64 OLED simulator with virtual knob and red button

Settings persist in browser localStorage.
