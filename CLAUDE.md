# Vlad Raspberry — Project Context

> This file helps AI assistants (and humans) understand the project quickly.
> Update it as decisions are made and the project grows.

---

## What is this project?

**One-line summary:** A small desk device on Raspberry Pi 3 A+ with a tiny OLED screen — works as an alarm clock, Pomodoro timer, or regular countdown timer.

**Status:** Pi **flashed and online** (SSH works). **OLED wired and working** — I2C demo shows text on screen. **Knob + red button wired** — Python demo responds to turns and presses. **Web UI prototype built** — mobile settings app + OLED device simulator in browser. **Python backend built (`pi/`)** — full alarm/pomodoro/timer logic, on-device menus, and a LAN HTTP API (port 8787) the web app syncs with. **Next:** deploy backend to the Pi and test on hardware; wire buzzer + speaker (sound is an espeak placeholder).

**Owner:** Vlad  
**Workspace:** `Vlad raspberry` on Desktop  
**Git repo:** [github.com/RybnikovVeniamin/Vladsdr](https://github.com/RybnikovVeniamin/Vladsdr)  
**Device name:** **Vlad_brodyaga** *(Pi hostname on network: `Vlad-brodyaga` — hyphens only, no underscores)*  
**SSH login:** `vladsdr@Vlad-brodyaga.local` *(password set in Imager)*

---

## Goals

What we want to achieve:

1. **Alarm clock** — set a time, device wakes you up (screen + sound).
2. **Pomodoro timer** — focus sessions (typically 25 min work / 5 min break) with clear on-screen feedback.
3. **Regular timer** — simple countdown for anything (cooking, breaks, etc.).

**Success looks like:** A compact, always-on gadget on the desk. You pick a mode on the small display, set the time, and it counts down or rings when done. Works reliably without needing a phone or computer.

---

## Repository layout

| Path | What it is |
|------|------------|
| `CLAUDE.md` | This file — project context for humans + AI |
| `GIFT.md` | User guide for the gift recipient (daily use, new Wi‑Fi, moving) |
| `FEATURES.md` | Detailed feature description of the product |
| `assets/` | Wiring reference photos (OLED diagram, GPIO pin guide) |
| `scripts/` | Small Python hardware tests/demos that run **on the Pi** |
| `pi/` | **The device app** — Python backend (OLED UI, inputs, alarm/pomo/timer logic, HTTP API). See `pi/README.md` |
| `web/` | React web app — settings UI + OLED simulator; syncs with the Pi over LAN when reachable |

---

## Hardware inventory (what Vlad has)

| # | Part | Model / specs | Role |
|---|------|---------------|------|
| 1 | **Raspberry Pi 3 A+** | 512 MB RAM, Wi‑Fi, Bluetooth | Brain of the device |
| 2 | **Power supply** | Official Raspberry Pi Micro USB (5V) | Powers the Pi |
| 3 | **microSD card** | SanDisk Ultra **32 GB**, A1, Class 10 | Stores the OS and app |
| 4 | **Display** | **0.96" OLED**, I2C, model **WPI438** | Shows time, countdown, mode |
| 5 | **Audio amp** | **MAX98357A** I2S 3W Class D (AZ-Delivery) | Makes the Pi loud enough for alarm |
| 6 | **Speaker** | **4 Ω, 3 W** (HIBOX3070-K) | Plays alarm / timer sounds |
| 7 | **Red button** | 1× arcade-style push button | Start / stop / confirm / snooze |
| 8 | **Knob** | **Rotary encoder** — clicks + haptic feedback each step | Set time (+/− per click), switch mode |
| 9 | **Sound buzzer** | 1× piezo / active buzzer | Short beeps when timer ends |
| 10 | **Jumper wires** | Multicolored ribbon / dupont wires | Connect everything to the Pi |
| 11 | **Cooling fan** | Small DC fan *(optional)* | Keeps Pi cool when always on |

**Not yet:** case / enclosure; buzzer and speaker wiring on Pi.

---

## Wiring overview (for developers)

GPIO pin assignments are **final** — see `assets/oled-pi-wiring-diagram.png` and `assets/pi-gpio-pin-counting-guide.png`.

### OLED display (I2C — 4 wires)

| OLED pin | Connect to Pi |
|----------|---------------|
| VCC | 3.3V (pin 1) |
| GND | Ground (pin 6) |
| SCL | GPIO 3 / SCL (pin 5) |
| SDA | GPIO 2 / SDA (pin 4) |

Driver chip: **SSD1306 or SH1106** (128×64, monochrome). I2C address **0x3C**. Python: `luma.oled` — `demo_actions.py` auto-detects SH1106 vs SSD1306.

### Audio (I2S — MAX98357A → speaker)

| Amp pin | Connect to Pi |
|---------|---------------|
| VIN | 5V (pin 2) |
| GND | Ground (pin 9) |
| BCLK | GPIO 18 (pin 12) |
| LRC (LRCLK) | GPIO 19 (pin 35) |
| DIN | GPIO 21 (pin 40) |
| GAIN, SD | **Do not connect** |

Speaker wires (red/black) → amp screw terminal (+/−). **Do not** connect the 3 W speaker directly to the Pi — use the amp.

### Sound buzzer (GPIO — simple beeps)

| Buzzer type | Wiring |
|-------------|--------|
| **Active buzzer** (2 pins) | + to GPIO via small resistor, − to GND; HIGH = beep |
| **Passive buzzer** (2 pins) | GPIO generates tone with PWM |

Use buzzer for **quick beeps** (timer done, button feedback). Use **speaker + amp** for **louder alarm** and richer sounds.

### Controls (2 inputs)

| Control | Role | Notes |
|---------|------|-------|
| **Knob (rotary encoder)** | Turn = adjust value / move cursor; click = select / next field; **click = snooze while ringing** | Physical click = haptic feedback |
| **Red button** | Back / pause; long press = stop / home; **turns the alarm off while ringing** (short or long) | Decision 2026-07-02: red = off, knob click = snooze |

**Device flow (implemented in `pi/vlad_device/`, see `pi/README.md` for the full map):**

1. Idle → **clock** screen: current time + next upcoming alarm (+ tiny P/T marker if a session runs in background).
2. **Knob click** → **menu** (Alarm / Pomo / Timer); turn to move, click to enter.
3. **Alarm** → alarm list (multiple alarms!) → editor: hour → minute → repeat preset → on/off → save.
4. **Pomo** → presets (Classic/Deep/Quick) or Custom (work→break→long→rounds) → runs.
5. **Timer** → presets (1–30 min) or Custom (minutes → seconds) → runs.
6. Alarm rings → **knob click = snooze 5 min**, **red button = turn off**.
7. Timer done → DONE screen + beeps until any button press.
8. Sound today = espeak voice placeholder; buzzer + speaker land later.

### Wiring — snooze / action button (GPIO)

| Button leg | Connect to Pi |
|------------|---------------|
| Leg 1 | GPIO 23 (pin 16) |
| Leg 2 | Ground (pin 20) |

Internal pull-up in software; press = pin goes LOW.

### Wiring — KY-040 rotary encoder (knob)

Confirmed: **clicks with haptic feedback** — KY-040 module.

| KY-040 pin | Connect to Pi |
|------------|---------------|
| + | 3.3V (pin 17) |
| GND | Ground (pin 14) |
| CLK | GPIO 17 (pin 11) |
| DT | GPIO 27 (pin 13) |
| SW | GPIO 22 (pin 15) |

Each physical **detent** (click) = one step in software. Python: `gpiozero.RotaryEncoder` or interrupt-based decoding (see `scripts/`).

### Pi 3 A+ notes

- **512 MB RAM** — keep the app lightweight (Python + simple UI, no heavy browser).
- **Internet not required** for core features.
- Enable **I2C** and **I2S** in Raspberry Pi OS config when setting up.

**Where it runs:** Desk / bedside — always plugged in.

---

## Features (detail)

### 1. Alarm
- **Multiple alarms** — e.g. one for weekdays, one for weekends, or one per day.
- Each alarm: hour + minute; **repeat by day of week** (every day / weekdays / weekends / custom); on/off.
- Pick wake-up song per alarm — categories **Vlad** and **Karina** (upload custom sounds in web app).
- Clock screen shows current time + the next upcoming alarm.
- **Snooze:** 5 minutes — **knob click** while ringing (also from web app).
- **Turn off:** **red button** (short or long press) — off for the rest of the day, per alarm.

### 2. Pomodoro timer
- **Presets:** Classic 25/5 ×4, Deep 50/10 ×3, Quick 15/3 ×4.
- **Custom:** work (1–120 min), break (1–60), long break (1–60), rounds (1–12).
- Show remaining time clearly; indicate work vs break phase and round.
- Knob click = pause/resume; red long press = stop; runs in background if you leave the screen.

### 3. Regular timer
- **Presets:** 1 / 3 / 5 / 10 / 15 / 30 min.
- **Custom:** minutes **and seconds** (seconds step by 5 on the device knob).
- Countdown on screen; DONE screen + beeps when finished (any button stops it).
- Start / pause / reset — from the device or the web app.

### Shared behavior
- Switch between modes via on-device menu (Alarm / Pomo / Timer).
- Large, readable UI on the **0.96" OLED** (128×64 — very small, keep text big and simple).
- Reliable timekeeping (system clock + timer logic).

---

## Software & tools

| Layer | Choice | Status |
|-------|--------|--------|
| OS on Pi | **Raspberry Pi OS Lite** | ✅ Flashed, SSH works |
| Pi app | **Python 3** — `pi/vlad_device/` | ✅ Built + logic self-tested; hardware test pending |
| Pi HTTP API | **Flask** on port **8787** (LAN only) | ✅ Built; also serves the web app from `pi/webroot/` |
| Display (Pi) | **luma.oled** (SSD1306 / SH1106) | ✅ Working (`demo_actions.py`, `pi/vlad_device/display.py`) |
| Audio (speaker) | **simpleaudio**, **pygame**, or **alsa** + WAV files | ⏳ Not wired yet |
| Audio (buzzer) | **gpiozero** Buzzer or PWM tone | ⏳ Not wired yet |
| Ring sound (interim) | **espeak-ng** voice loop | ✅ Placeholder in `pi/vlad_device/sound.py` |
| Input (Pi) | **RPi.GPIO** polling watcher | ✅ Knob + button (short/long press) |
| Web app | **React + Vite + TypeScript + Zustand** | ✅ Settings + simulator + **LAN sync with Pi** |
| Cloud | **None** for v1 | Fully offline; web ↔ Pi over home Wi-Fi only |
| Repo | **Git** on GitHub | ✅ Team can clone and collaborate |

---

## Web UI prototype (`web/`)

A **mobile-first browser app**: the settings UI for the device plus an OLED simulator. When the Pi is reachable on the home network it **syncs live** (polls every 3 s, pushes edits, shows "On device" cards to start/pause/stop sessions and snooze/turn off a ringing alarm remotely). Without the Pi it still works standalone with browser storage. It can run from the Mac dev server or be **served by the Pi itself** (see `pi/README.md`).

### Run locally

```bash
cd web
npm install
npm run dev
```

- **Settings app:** `http://localhost:5173` — Alarm, Pomodoro, Timer, Upload tabs
- **Device preview:** `http://localhost:5173/device.html` — 128×64 OLED simulator with virtual knob and red button

Settings persist in browser **localStorage**. See `web/README.md` for details.

### What the web app covers

| Tab | Features |
|-----|----------|
| **Alarm** | **List of alarms** (add/delete/toggle) — per alarm: time, repeat days (weekday/weekend presets), song (Vlad / Karina cards). Device connection card with remote snooze / turn off |
| **Pomodoro** | Presets (Classic/Deep/Quick) + custom work/break/long-break/rounds; custom session sound (Vlad/Karina cards); run locally or **start on the device** |
| **Timer** | Presets (1–30 min) + custom minutes **and seconds**; custom finish sound; run locally or on the device |
| **Upload** | Add custom sounds — usable for alarm, timer **and** pomodoro (stored in browser) |
| **Device preview** | Simulates OLED screens: clock (next alarm), menu, ringing (red=off / knob=snooze), snooze, pomodoro, timer |

The device simulator shares state with the settings app via Zustand — open both URLs to configure on one side and see the “device” react on the other.

---

## Pi scripts (`scripts/`)

Run these **on the Pi** (SSH in first):

| Script | Purpose |
|--------|---------|
| `demo_actions.py` | Full demo: OLED + knob turn/click + red button + espeak voice |
| `test_knob_rotation.py` | Test encoder rotation only (gpiozero) |
| `test_knob_raw.py` | Raw GPIO read of CLK/DT pins |
| `test_knob_manual.py` | Manual step-through knob decoding |

Example:

```bash
ssh vladsdr@Vlad-brodyaga.local
python3 ~/scripts/demo_actions.py
```

Requires on Pi: `python3-luma.oled`, `python3-pil`, `python3-rpi.gpio`, `python3-gpiozero`, `espeak-ng`.

---

## Architecture (high level)

```
   ┌──────────────────────────────────────┐     HTTP over home Wi-Fi
   │  web/ — React app (Mac dev server    │  ◄──────────────────────────┐
   │  or served by the Pi itself)         │   GET/PUT /api/* (port 8787)│
   │  Settings + OLED simulator + sync    │ ────────────────────────────┤
   └──────────────────────────────────────┘                             ▼
[Red button + knob]  →  [pi/vlad_device — Python app on Pi 3 A+]  ✅ BUILT
                              │        (Flask API + state machine + tick)
                              ├→ 0.96" OLED (I2C) — clock / menus / countdowns  ✅
                              ├→ espeak voice — interim ring sound              ✅
                              ├→ Buzzer — short beeps                           ⏳
                              └→ MAX98357A → 3W speaker — loud alarm            ⏳
```

No cloud in v1 — everything runs on the Pi; the web app talks to it only on
the local network (and still works standalone/offline as a simulator).

---

## Important decisions

| Date | Decision | Why |
|------|----------|-----|
| 2026-06-27 | Use `CLAUDE.md` for project context | Single place for AI + team context |
| 2026-06-27 | Raspberry Pi **3 A+** | Hardware Vlad has |
| 2026-06-27 | Three modes: alarm, pomodoro, regular timer | Core product scope |
| 2026-06-27 | Offline-first (no cloud v1) | Simpler, reliable desk gadget |
| 2026-06-27 | **0.96" I2C OLED (WPI438)** for display | Part in hand; simple 4-wire hookup |
| 2026-06-27 | **MAX98357A + 3W speaker** for sound | Proper alarm volume; I2S quality |
| 2026-06-27 | **Red button + buzzer** for input / short beeps | Simple desk controls; dual sound layers |
| 2026-06-27 | **Rotary encoder** knob (clicks + haptic) | Set time step-by-step; not a smooth pot |
| 2026-06-27 | Device name **Vlad_brodyaga** | Hostname `Vlad-brodyaga`; OS: Raspberry Pi OS Lite 32-bit |
| 2026-06-27 | GPIO pins finalized | Button GPIO 23, KY-040 on 17/27/22 — see wiring diagram |
| 2026-06-28 | **Web UI prototype** before Pi app | Faster iteration on screens and UX; share with team |
| 2026-06-28 | Alarm repeat by **day of week** | Everyday / weekdays / weekends / custom |
| 2026-06-28 | **Snooze 5 min**, dismiss via long press | Matches desk-alarm expectations |
| 2026-06-28 | Wake-up songs: **Vlad / Karina** categories | Personal alarm sounds; upload supported in web UI |
| 2026-06-28 | Git repo on **GitHub** | Team collaboration |
| 2026-07-02 | **Multiple alarms** (list), not one alarm | Separate weekday / weekend / per-day wake-up times |
| 2026-07-02 | Ring controls: **red = turn off, knob click = snooze** | Vlad's spec; simpler than short/long-press snooze |
| 2026-07-02 | **Pomodoro presets** (Classic/Deep/Quick) + custom | Fast start on a tiny screen |
| 2026-07-02 | **Timer presets** + custom minutes **and seconds** | Vlad's spec |
| 2026-07-02 | Backend = **Python + Flask**, LAN API on port **8787** | Lightweight for 512 MB RAM; web app syncs over home Wi-Fi |
| 2026-07-02 | Pi can **serve the built web app** (`pi/webroot/`) | Configure from any phone without the Mac |

---

## Constraints

- **512 MB RAM** on Pi 3 A+ — avoid heavy frameworks and full desktop browser on the device.
- **128×64 OLED** — UI must be minimal: big digits, short labels, few screens.
- Vlad is not a developer — explain steps clearly; prefer incremental milestones.
- Prefer small, working steps over big rewrites.

---

## How to work on this project

**For AI assistants:**

1. Read this file first before large changes.
2. Keep changes minimal and focused on the current task.
3. Commit to git when Vlad asks (or when syncing with the team).
4. Explain technical choices in plain language.
5. Update this file when button layout, UI screens, or enclosure are finalized.

**For humans (team onboarding):**

1. Clone: `git clone https://github.com/RybnikovVeniamin/Vladsdr.git`
2. Read this file (`CLAUDE.md`) — it is the single source of truth.
3. **Web UI:** `cd web && npm install && npm run dev`
4. **Pi hardware:** SSH to `vladsdr@Vlad-brodyaga.local`; the device app lives in `pi/` (deploy + run: `pi/README.md`); quick hardware demos in `scripts/`
5. Wiring photos are in `assets/`
6. When you change pins, screens, or features — update this file in the same PR/commit.

---

## Links & references

- [Raspberry Pi 3 A+](https://www.raspberrypi.com/products/raspberry-pi-3-model-a-plus/)
- [MAX98357A product info (AZ-Delivery)](https://www.az-delivery.de/)
- OLED: WPI438 — SSD1306 / SH1106 128×64 I2C
- GitHub: [RybnikovVeniamin/Vladsdr](https://github.com/RybnikovVeniamin/Vladsdr)

---

## Open questions

- [x] Which display? → **0.96" I2C OLED WPI438**
- [x] How to control? → **1 red button + 1 knob**
- [x] How to sound? → **Buzzer** (beeps) + **MAX98357A amp + 3W speaker** (alarm)
- [x] **Knob type:** **rotary encoder** — clicks + haptic feedback per step
- [x] **Alarm repeat:** by day of week (every day / weekdays / weekends / custom)
- [x] **Snooze:** 5 min (short press); dismiss (long press)
- [x] **Pomodoro:** user-adjustable work/break/long-break/rounds (defaults 25/5/15/4)
- [x] **UI on tiny screen:** clock idle → menu on knob click → mode screens
- [ ] **Case / enclosure** design?
- [x] **Web UI on Pi?** → Yes: Flask serves the built web app from `pi/webroot/` (optional)
- [x] **Sync settings** from web to Pi → **LAN HTTP API on port 8787**; web app polls every 3 s and pushes edits (device wins on reconnect)
- [ ] **Song files on the Pi** — upload/transfer so real songs play (espeak is the placeholder)

---

## Build progress

| Step | Status |
|------|--------|
| 1. Flash Raspberry Pi OS Lite; enable I2C + I2S | ✅ Done |
| 2. Wire OLED → show text on screen | ✅ Done (`demo_actions.py`) |
| 3. Wire red button + knob → detect input | ✅ Done |
| 4. Web UI prototype (settings + device simulator) | ✅ Done |
| 5. Python backend (`pi/`): full app logic + LAN API + web sync | ✅ Built; logic self-tested on Mac |
| 6. Deploy backend to the Pi; test on real hardware; enable systemd service | ⏳ Next |
| 7. Wire buzzer → beep when timer ends | ⏳ |
| 8. Add speaker + amp → louder alarm; play real song files | ⏳ |
| 9. Polish UI; build case | ⏳ |

---

## Changelog

| Date | What changed |
|------|----------------|
| 2026-06-27 | Created project folder and context file |
| 2026-06-27 | Defined features (alarm, pomodoro, timer), offline scope |
| 2026-06-27 | Added full parts list from photos: OLED, amp, speaker, buttons, SD, PSU |
| 2026-06-27 | Knob confirmed: rotary encoder with click/haptic feedback |
| 2026-06-27 | Pi hostname set to **Vlad-brodyaga** (device name Vlad_brodyaga) |
| 2026-06-27 | Pi online; SSH user **vladsdr**; Wi‑Fi + SSH configured via Imager |
| 2026-06-27 | GPIO pins finalized from wiring diagram (button GPIO 23, KY-040, MAX98357A) |
| 2026-06-28 | Web UI prototype: Alarm / Pomodoro / Timer / Upload + OLED device simulator |
| 2026-06-28 | Alarm repeat days, snooze/dismiss, Vlad/Karina song categories decided in web UI |
| 2026-06-28 | Python demos: OLED + knob + button working on Pi |
| 2026-06-28 | Repo pushed to GitHub; CLAUDE.md updated for team onboarding |
| 2026-07-02 | `FEATURES.md` added — detailed feature description |
| 2026-07-02 | **Python backend built (`pi/`)**: alarms (multiple, weekday/weekend), pomodoro presets, timer with seconds, on-device menus/editors, Flask LAN API :8787, espeak ring placeholder, systemd unit; 75 logic checks green |
| 2026-07-02 | Web app upgraded: alarm list, presets, seconds timer, **red=off / knob=snooze**, LAN sync with the Pi (poll + push), remote device cards |
