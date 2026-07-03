# Vlad Brodyaga — Feature Description

Functional description of the desk device, its Python backend (`pi/`) and the
companion web app. See `CLAUDE.md` for hardware, wiring, and project status,
and `pi/README.md` for deployment + the HTTP API reference.

---

## 1. Product overview

A single-purpose desk gadget with a 128×64 OLED screen, a rotary knob and a
red button. It runs three modes:

- **Alarm clock** — multiple alarms (weekday / weekend / per-day), each with
  its own time and song.
- **Pomodoro timer** — work / break / long break cycles, presets + custom.
- **Regular timer** — countdown from presets or custom minutes + seconds.

Two implementations share one model:

- **`pi/vlad_device/`** — the real device: Python state machine, OLED
  rendering, GPIO inputs, and a Flask HTTP API on port 8787.
- **`web/`** — mobile-first settings app + OLED simulator. When the Pi is
  reachable on the LAN it syncs both ways and can remote-control the device;
  offline it works standalone (localStorage).

Web data model: `web/src/types.ts`, store: `web/src/store/useAppStore.ts`.
Pi equivalents: `pi/vlad_device/state.py`, `pi/vlad_device/controller.py`.

**Ring controls (product decision 2026-07-02):** while the alarm rings, the
**red button turns it off** (short or long press) and a **knob click snoozes
5 minutes**.

---

## 2. Modes

### 2.1 Alarm

Configuration surfaces: `web/src/components/web/AlarmPage.tsx` (list +
editor) and the on-device editor (`pi/vlad_device/controller.py`).
Data shape: `Alarm` in `web/src/types.ts` / `pi/vlad_device/state.py`.

- **Multiple alarms** — a list, each independently on/off. Separate weekday
  and weekend wake-up times are simply two alarms; one alarm per day also
  works (custom repeat days).
- Per alarm: **time** (HH:MM, 24-hour), **repeat days**
  (`repeatDays: boolean[7]`, index 0 = Sunday) with presets Every day /
  Weekdays / Weekends / custom day chips, and a **wake-up song**.
- **Song picking** (web): editor → Vlad / Karina person cards → song list
  (includes songs tagged `both`). Preview playback works for uploaded songs;
  seeded samples show a toast. Songs don't transfer to the Pi yet — the
  device rings with the espeak placeholder.
- **On-device editing**: Alarm menu → alarm list (+ `New alarm`) → knob
  steps through hour → minute → repeat preset → ON/OFF → save.

**Firing rules** (`useAppStore.tick` / `Controller.tick`):

- Alarm enabled, today in `repeatDays`, local time matches `hour:minute`.
- Not already turned off today — per-alarm daily stamp in
  `device.dismissed[alarmId] = YYYY-MM-DD` (two alarms on the same day ring
  independently).
- Web simulator fires only from the `clock` screen; the Pi fires from any
  screen except an already ringing/snoozing one (a wake-up alarm interrupts
  a running pomodoro/timer, then returns to it after dismissal).

**Ringing behaviour:**

- OLED shows `WAKE UP!`, the song name (web) or alarm time (Pi), and the
  hint `red=off knob=snooze`.
- **Knob click → snooze**: `snoozing` screen with a live 5-minute countdown
  (`SNOOZE_SEC = 5 * 60`); at zero the alarm re-fires.
- **Red button → turn off** (short or long press): back to `clock`, stamps
  today in `device.dismissed` for that alarm.
- From the web app, a connected device can be snoozed / turned off remotely
  (`DeviceSyncCard`).

### 2.2 Pomodoro

Configuration surface: `web/src/components/web/PomodoroPage.tsx` and the
on-device Pomo menu. Data shapes: `PomodoroSettings`, `PomodoroRuntime`.

**Presets** (`web/src/data/presets.ts` = `pi/vlad_device/state.py`):

| Preset  | Work | Break | Long break | Rounds |
| ------- | ---- | ----- | ---------- | ------ |
| Classic | 25   | 5     | 15         | 4      |
| Deep    | 50   | 10    | 20         | 3      |
| Quick   | 15   | 3     | 10         | 4      |

On the device, picking a preset starts the session immediately; `Custom`
steps through the four values with the knob. In the web app presets fill the
steppers.

**Custom ranges** via steppers (defaults in parentheses):

| Setting     | Default | Range |
| ----------- | ------- | ----- |
| Work        | 25 min  | 1–120 |
| Break       | 5 min   | 1–60  |
| Long break  | 15 min  | 1–60  |
| Rounds      | 4       | 1–12  |

**Session lifecycle** (`startPomodoro`, `advancePomodoroPhase` in
`useAppStore.ts`):

1. `startPomodoro()` sets phase = `work`, remaining = `workMin·60`,
   round = 1, and the device switches to the `pomodoro` screen.
2. When the work phase reaches 0:
   - If `currentRound >= rounds` → phase becomes `long_break`.
   - Otherwise → phase becomes `break`.
3. When a `break` finishes → phase returns to `work`, round increments.
4. When a `long_break` finishes → runtime resets to idle and the device
   returns to the `clock` screen.

**Controls**:

- Web page: **Pause / Resume** and **Stop** buttons appear once the session
  is active.
- Device (`deviceButtonShort` while `screen === 'pomodoro'`): short red
  press toggles pause/resume; long press stops the session.

**OLED display** (`OledScreen`): phase label (`WORK`, `BREAK`, `LONG`),
large `MM:SS` countdown, and a status footer showing either `PAUSED` or the
current round marker (`R1`, `R2`, …).

### 2.3 Regular Timer

Configuration surface: `web/src/components/web/TimerPage.tsx` and the
on-device Timer menu. Data shape: `TimerState`.

- **Presets** — 1 / 3 / 5 / 10 / 15 / 30 minutes. On the device a preset
  starts immediately; in the web app it fills the duration.
- **Custom duration** — minutes (0–180) **and seconds** (0–59; the device
  knob steps seconds by 5). Starting at 0:00 is refused (`SET TIME` hint on
  the OLED, disabled button on the web).
- **Start / Pause / Reset** — knob click pauses/resumes on the device; red
  long press resets.

When the countdown hits 0: the web simulator marks `done` and returns to
`clock`; the Pi shows a dedicated `DONE!` screen and beeps (espeak
placeholder, auto-stops after ~75 s) until any button is pressed.

OLED display: large `M:SS` countdown, footer `TIMER` / `PAUSED`.

---

## 3. Device UX (OLED simulator)

The OLED simulator lives in `web/src/components/device/`. It renders a
128×64 pixel canvas scaled ×4 with pixel-perfect rendering. Behaviour is
identical to what the Pi app should implement.

### 3.1 Screens

Enum `DeviceScreen` in `web/src/types.ts`, drawn in
`OledScreen.tsx`:

| Screen          | Content                                                   |
| --------------- | --------------------------------------------------------- |
| `clock`         | Big current time; below it the **next upcoming alarm** across the list (`ALM 07:30` / `ALM Sa 09:00`, or `NO ALARM`). |
| `menu`          | Header `MODE` and three items: `Alarm`, `Pomo`, `Timer`. Cursor `>` marks the selection. |
| `alarm_ringing` | `WAKE UP!`, song name (web) / alarm time (Pi), `red=off knob=snooze` hint. |
| `snoozing`      | `SNOOZE` label, live snooze countdown, `red=off` hint.    |
| `pomodoro`      | Phase label, `MM:SS` countdown, `Rn` or `PAUSED` footer.  |
| `timer`         | `M:SS` countdown, `TIMER` / `PAUSED` footer.              |

The Pi adds screens the simulator doesn't have: `alarm_list`, `alarm_edit`,
`pomo_menu`, `pomo_edit`, `timer_menu`, `timer_edit`, `timer_done` — plus a
tiny `P`/`T` marker on the clock when a session runs in the background
(`pi/vlad_device/display.py`).

### 3.2 Navigation flow

Modelled in `useAppStore.deviceKnobTurn`, `deviceKnobClick`,
`deviceButtonShort`, `deviceButtonLong`:

```
       ┌──────────┐  knob click   ┌──────────┐  select Pomo/Timer
Idle → │  clock   │ ────────────▶ │   menu   │ ─────────────────────▶ pomodoro / timer
       │          │               │          │  (Pi: via preset/custom submenus)
       └──────────┘               └──────────┘
             │                            ▲
             │ alarm fires                │ red long press = home (clock)
             ▼                            │
       ┌─────────────┐  KNOB CLICK   ┌──────────┐  snooze expires
       │alarm_ringing│ ────────────▶ │ snoozing │ ────────────────▶ alarm_ringing
       │             │               │          │
       └─────────────┘  RED BUTTON = turn off ──▶ clock  (also from snoozing)
```

### 3.3 Controls

Physical:

- **Rotary encoder (knob)** — turn to move cursors / adjust values (wraps);
  click to select / advance edit fields / pause a running session /
  **snooze a ringing alarm**.
- **Red button** — short press ≈ back / cancel; long press ≥ 800 ms ≈
  stop session / return to clock; **while ringing or snoozing, any red press
  turns the alarm off**.

Virtual (`web/src/components/device/VirtualControls.tsx`) mirrors the
same actions in the browser: two chevron buttons for knob turn, a centre
button for knob click, and a red disc that measures press duration with
an 800 ms threshold to distinguish short from long presses.

The device preview also exposes a **Trigger alarm now** button
(`DevicePreview.tsx`) for testing the ringing / snooze flow without
waiting for the wall clock.

---

## 4. Web app UI

Entry points:

- `web/index.html` → `web/src/main.tsx` → `App.tsx` — the mobile settings
  app.
- `web/device.html` → `web/src/device-main.tsx` → `DevicePreview.tsx` —
  the standalone OLED simulator page.

### 4.1 Layout

`MobileShell.tsx` provides a sticky top bar (title + `Open device preview`
link) and a bottom tab bar. The device preview link opens `device.html` in
a new tab so configuration and the simulator can run side by side.

### 4.2 Bottom navigation

`BottomNav.tsx` — four tabs, driven by the `Tab` union in `types.ts`:

| Tab       | Component        | Purpose                                   |
| --------- | ---------------- | ----------------------------------------- |
| Alarm     | `AlarmPage`      | Alarm list (add/toggle/delete) + per-alarm editor; device connection card. |
| Pomo      | `PomodoroPage`   | Presets + custom intervals; local session or start on the device. |
| Timer     | `TimerPage`      | Presets + minutes/seconds; local countdown or on the device. |
| Upload    | `UploadPage`     | Manage the song library (browser-side).   |

Toast notifications (`sonner`) confirm saves and surface errors
(e.g. non-audio file, empty song name).

---

## 5. Sound library

Data shape: `Song { id, name, category, blobUrl? }`.
Categories: `vlad`, `karina`, `both`.

### 5.1 Seeded content

`web/src/data/seedSongs.ts` ships six sample entries (three per person,
including one shared `both` entry). They have no `blobUrl` — selecting one
is fine, but pressing play shows a toast telling the user to upload a real
file.

### 5.2 Uploads (`UploadPage.tsx`)

- File picker restricted to `audio/*`.
- Optional song name (auto-filled from the file name).
- Category selector: **Vlad**, **Karina**, or **Both**.
- Upload creates a blob URL and adds a `Song` with id `song-<timestamp>`.
- Uploads list supports deletion via a confirmation dialog. Deleting a song
  clears `songId` on every alarm that used it.

### 5.3 Selection filter

`songsForCategory(songs, category)` in `web/src/lib/format.ts` returns
songs matching the picked category plus anything tagged `both`. This is
what powers the per-person song lists on the Alarm page.

---

## 6. Shared state, persistence and LAN sync

All web state lives in a single Zustand store (`useAppStore.ts`) consumed by
both the settings app and the simulator.

**Browser persistence** — `persist` under key `vlad-brodyaga-store`
(localStorage), version 1. Saved: `alarms`, `songs`, `pomodoro`, timer
`durationSec`. Runtime state (device screen, snooze, per-alarm `dismissed`
map, pomodoro runtime) resets on load. `migrate` upgrades the old
single-`alarm` shape into the `alarms` list; `merge` re-normalizes every
alarm's `repeatDays`.

**Pi persistence** — `~/.config/vlad-device/state.json` (atomic writes,
`pi/vlad_device/state.py`): alarms, pomodoro settings, timer duration.

**LAN sync** (`web/src/hooks/useDeviceSync.ts`):

- Polls `GET /api/state` every 3 s → `deviceOnline` flag + `remote` snapshot
  in the store.
- Local edits to alarms / pomodoro settings / timer duration are pushed
  (debounced 400 ms) via `PUT /api/alarms|pomodoro|timer`.
- The device wins on (re)connect: remote settings overwrite local ones
  unless you edited locally in the last 3 s.
- `DeviceSyncCard` (Alarm tab) shows connection status, lets you change the
  device address (default `http://vlad-brodyaga.local:8787`, override via
  the pencil button or `?device=...` URL param), and snoozes / turns off a
  remotely ringing alarm. `DeviceRuntimeCard` (Pomo/Timer tabs) starts,
  pauses, stops sessions on the physical device.

---

## 7. Tick loop

The device preview mounts a 1-second interval (`DevicePreview.tsx`) that
calls `useAppStore.tick()`; on the Pi a 10 Hz loop calls `Controller.tick()`
which gates all logic to wall-second changes. One tick handles all
time-driven work:

1. Snooze expiry → re-fire the snoozed alarm.
2. Alarm fire check per alarm (repeat day + HH:MM + per-alarm daily
   dismissal).
3. Pomodoro countdown and phase transitions.
4. Timer countdown and completion.

There is no separate scheduler — the same single-tick model runs in both
implementations (`useAppStore.tick` and `pi/vlad_device/controller.py`).

---

## 8. Formatting helpers

`web/src/lib/format.ts`:

- `formatClock(h, m)` → `HH:MM`.
- `formatDuration(sec)` → `MM:SS` (used in the web UI's large digits).
- `formatDurationShort(sec)` → `M:SS`, or `H:MM:SS` past an hour (used on
  the OLED where every pixel counts).
- `todayKey()` → `YYYY-MM-DD` from the local date, used to remember alarm
  dismissals.

`web/src/lib/alarmRepeat.ts`:

- `DAY_LABELS` / `DAY_NAMES` — starts with Sunday to match
  `Date.getDay()`.
- `ALL_DAYS`, `WEEKDAYS`, `WEEKENDS` — preset masks.
- `repeatPresetFromDays` / `formatRepeatSummary` — map a mask to a preset
  or a human summary (`Every day`, `Weekdays`, `Weekends`, or a list of
  day names).
- `isAlarmDayToday(days, date)` — used by the tick loop.
- `nextAlarmOccurrence(alarms, dismissed, now)` — earliest upcoming fire
  across all enabled alarms (clock screen). Python twin: `next_alarm` in
  `pi/vlad_device/state.py`.

---

## 9. Python backend (`pi/`)

The full device app — see `pi/README.md` for setup, deployment and the
complete API table.

- `state.py` — data model, presets, validation, JSON persistence
  (`~/.config/vlad-device/state.json`).
- `controller.py` — the state machine: screens/menus/editors, knob and
  button events, the 1-second tick (alarm fire, snooze, pomodoro phases,
  timer), and the `api_*` methods the HTTP server calls. Thread-safe via a
  single lock; hardware-free (unit-testable anywhere).
- `display.py` — OLED painters (luma.oled + PIL); redraws only when the
  frame changes.
- `inputs.py` — GPIO polling watcher; red button short (<0.8 s) vs long
  press, 30 ms debounce. Pins: CLK 17, DT 27, knob SW 22, red 23.
- `server.py` — Flask API (port 8787) + CORS + optional static hosting of
  the built web app from `pi/webroot/`.
- `sound.py` — espeak ring/cue placeholder until buzzer + speaker are wired.
- `dev_selftest.py` — 75 logic checks that run on any machine
  (`python3 pi/dev_selftest.py`).

`main.py` flags: `--no-hardware` (run the backend on a Mac), `--no-sound`,
`--port`, `--state-file`, `--webroot`. A systemd unit
(`pi/vlad-device.service`) is provided for autostart.

The `scripts/` directory keeps the original low-level hardware demos
(`demo_actions.py`, knob tests) for quick wiring checks.

---

## 10. Feature status

| Feature                                              | Web UI | OLED sim | Pi backend |
| ---------------------------------------------------- | :----: | :------: | :--------: |
| Clock screen with next alarm                         |   —    |    ✅    |     ✅     |
| Menu navigation via knob                             |   —    |    ✅    |     ✅     |
| Multiple alarms (weekday/weekend/custom), song pick  |   ✅   |    ✅    |     ✅     |
| On-device alarm editing (hour/min/repeat/on-off)     |   —    |    —     |     ✅     |
| Ringing: knob click = snooze, red = turn off         |   ✅   |    ✅    |     ✅     |
| Pomodoro presets + custom + session lifecycle        |   ✅   |    ✅    |     ✅     |
| Timer presets + custom minutes:seconds               |   ✅   |    ✅    |     ✅     |
| Web ⇄ device LAN sync + remote control               |   ✅   |    —     |     ✅     |
| Song library (seeds + uploads, category filter)      |   ✅   |    —     |     ⏳     |
| Real alarm sound (buzzer + speaker; espeak interim)  |   —    |    —     |     ⏳     |
| Persistence between restarts                         |   ✅   |    ✅    |     ✅     |
| Verified on real Pi hardware                         |   —    |    —     |     ⏳     |

Legend: ✅ implemented · ⏳ planned · — not applicable.
(Backend logic is verified by `pi/dev_selftest.py`; the on-hardware test on
the Pi is the next milestone.)

---

## 11. Where to change what

Most product behavior now lives in **two places** — the web store and the
Pi controller. Change both to keep them in step.

- **New device screen** — Pi: add a painter (`_paint_<name>`) in
  `pi/vlad_device/display.py` and route into it in `controller.py`.
  Simulator (optional): `DeviceScreen` in `types.ts` + `OledScreen.tsx`.
- **New alarm behaviour** — extend `Alarm` in `types.ts` +
  `pi/vlad_device/state.py`; update `AlarmPage.tsx`, the fire logic in
  `useAppStore.tick` and `Controller.tick`, and PUT validation in
  `state.py`.
- **New Pomodoro rule** — `advancePomodoroPhase` in `useAppStore.ts` and
  `_advance_pomodoro_phase` in `controller.py`.
- **New preset** — `web/src/data/presets.ts` **and**
  `pi/vlad_device/state.py` (kept in sync by hand).
- **New sound category** — extend `SongCategory` in `types.ts`, then
  update `songsForCategory` and the `AlarmPage` / `UploadPage` selectors.
- **New persisted field** — web: `partialize`/`merge` in `useAppStore.ts`;
  Pi: `Persistence` in `state.py`.
- **New API endpoint** — `pi/vlad_device/server.py` (+ an `api_*` method on
  the controller) and `web/src/lib/deviceApi.ts`.
- **Real buzzer/speaker sound** — replace the internals of
  `pi/vlad_device/sound.py` (`Ringer.start/stop/say` is the whole
  contract).
