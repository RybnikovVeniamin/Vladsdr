# Vlad Raspberry — Project Context

> This file helps AI assistants (and humans) understand the project quickly.
> Update it as decisions are made and the project grows.

---

## What is this project?

**One-line summary:** A small desk device on Raspberry Pi 3 A+ with a tiny OLED screen — works as an alarm clock, Pomodoro timer, or regular countdown timer.

**Status:** Pi **flashed and online** (SSH works). **OLED wired and working** — I2C demo shows text on screen. **Knob + red button wired** — Python demo responds to turns and presses. **Web UI prototype built** — mobile settings app + OLED device simulator in browser. **Next:** port app logic from web prototype to Python on the Pi; add buzzer + speaker.

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
| `assets/` | Wiring reference photos (OLED diagram, GPIO pin guide) |
| `scripts/` | Python tests and demos that run **on the Pi** |
| `web/` | React web app — settings UI + OLED simulator (runs on Mac, not on Pi yet) |

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
| **Knob (rotary encoder)** | Each **click** = +1 or −1 minute, or step to next mode | Physical click = haptic feedback; optional tiny buzzer tick on each step |
| **Red button** | **Start / stop** countdown; **confirm** selection; **snooze** when alarm rings | Short press = action; long press = dismiss alarm |

**Device flow (from web prototype — target for Pi app):**

1. Idle → **clock** screen shows current time + next alarm.
2. **Knob click** → open **menu** (Alarm / Pomo / Timer).
3. **Knob turn** → move selection in menu.
4. **Red button** → start selected mode / snooze alarm.
5. **Red button long press** → dismiss ringing alarm.
6. Timer or alarm finishes → **buzzer beeps** + **speaker** for loud alarm.

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
- Set hour + minute; **repeat by day of week** (every day / weekdays / weekends / custom).
- Pick wake-up song — categories **Vlad** and **Karina** (upload custom sounds).
- Show current time on screen when idle; show next alarm time.
- Alert when time is reached (sound + visible cue on display).
- **Snooze:** 5 minutes (short press red button while ringing).
- **Dismiss:** long press red button.

### 2. Pomodoro timer
- User-adjustable: work (default **25 min**), break (**5 min**), long break (**15 min**), rounds (**4**).
- Show remaining time clearly; indicate work vs break phase.
- Start from device menu; pause with red button.

### 3. Regular timer
- User sets any duration (minutes).
- Countdown on screen; alert when finished.
- Start / pause / reset.

### Shared behavior
- Switch between modes via on-device menu (Alarm / Pomo / Timer).
- Large, readable UI on the **0.96" OLED** (128×64 — very small, keep text big and simple).
- Reliable timekeeping (system clock + timer logic).

---

## Software & tools

| Layer | Choice | Status |
|-------|--------|--------|
| OS on Pi | **Raspberry Pi OS Lite** | ✅ Flashed, SSH works |
| Pi app language | **Python 3** | 🔄 Demos done; full app not yet |
| Display (Pi) | **luma.oled** (SSD1306 / SH1106) | ✅ Working in `demo_actions.py` |
| Audio (speaker) | **simpleaudio**, **pygame**, or **alsa** + WAV files | ⏳ Not wired yet |
| Audio (buzzer) | **gpiozero** Buzzer or PWM tone | ⏳ Not wired yet |
| Input (Pi) | **RPi.GPIO** / **gpiozero** | ✅ Knob + button tested |
| Voice feedback (demo) | **espeak-ng** | ✅ Used in demo for debugging |
| Web prototype | **React + Vite + TypeScript + Zustand** | ✅ Settings + device simulator |
| Cloud / backend | **None** for v1 | Fully offline device |
| Repo | **Git** on GitHub | ✅ Team can clone and collaborate |

---

## Web UI prototype (`web/`)

A **mobile-first browser app** to design and test the product before porting to the Pi. Not deployed to the device yet — runs on your Mac.

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
| **Alarm** | Enable/disable, set time, repeat days, pick song (Vlad / Karina cards) |
| **Pomodoro** | Adjust work/break/long-break/rounds; run session timer |
| **Timer** | Set duration, start/pause/reset countdown |
| **Upload** | Add custom alarm sounds (stored in browser) |
| **Device preview** | Simulates OLED screens: clock, menu, alarm ringing, snooze, pomodoro, timer |

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
                    ┌─────────────────────────────────┐
                    │  web/ — React prototype (Mac)   │
                    │  Settings UI + OLED simulator   │
                    └──────────────┬──────────────────┘
                                   │ design reference
                                   ▼
[Red button + knob]  →  [Python app on Pi 3 A+]  ← TO BUILD
                              │
                              ├→ 0.96" OLED (I2C) — time / countdown / mode  ✅ demo
                              ├→ Buzzer — short beeps                         ⏳
                              └→ MAX98357A → 3W speaker — loud alarm           ⏳
```

No phone app or cloud in v1 — everything runs on the Pi. The web app is a **design and testing tool**, not part of the shipped product.

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
4. **Pi hardware:** SSH to `vladsdr@Vlad-brodyaga.local`, copy/run scripts from `scripts/`
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
- [ ] **Web UI on Pi?** Likely no — settings on device via knob; web stays dev tool unless we add a config page later
- [ ] **Sync settings** from web to Pi — how? (manual export, Wi‑Fi API, etc.)

---

## Build progress

| Step | Status |
|------|--------|
| 1. Flash Raspberry Pi OS Lite; enable I2C + I2S | ✅ Done |
| 2. Wire OLED → show text on screen | ✅ Done (`demo_actions.py`) |
| 3. Wire red button + knob → detect input | ✅ Done |
| 4. Web UI prototype (settings + device simulator) | ✅ Done |
| 5. Wire buzzer → beep when timer ends | ⏳ Next |
| 6. Add speaker + amp → louder alarm sound | ⏳ |
| 7. Port full app logic from web prototype to Python on Pi | ⏳ |
| 8. Polish UI; build case | ⏳ |

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
