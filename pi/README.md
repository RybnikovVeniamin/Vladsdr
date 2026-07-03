# Pi backend — `vlad_device`

The Python app that runs on the Raspberry Pi and drives the whole gadget:
OLED screens, knob + red button, alarm/pomodoro/timer logic, and an HTTP
API so the web app can manage the device over the home network.

```
pi/
  vlad_device/
    main.py        entry point (threads + CLI flags)
    controller.py  state machine: screens, inputs, tick, alarm logic
    state.py       data model, presets, validation, JSON persistence
    display.py     OLED painters (luma.oled + PIL)
    inputs.py      GPIO watcher: encoder + red button (short/long press)
    server.py      Flask JSON API + CORS + optional static web hosting
    sound.py       alarm songs via speaker + espeak fallback
    songs.py       song file library (uploaded from the web app)
  dev_selftest.py  logic checks that run on any machine (no hardware)
  vlad-device.service  systemd unit for autostart
```

## Controls (final mapping)

| Where | Knob turn | Knob click | Red short | Red long |
|---|---|---|---|---|
| Clock | — | open menu | — | — |
| Menus / lists | move cursor | select | back | home (clock) |
| Edit screens (alarm, pomo, timer) | change value | next field / save | cancel | home |
| Pomodoro / Timer running | — | pause / resume | back (keeps running) | stop / reset |
| **Alarm ringing** | — | **snooze 5 min** | **turn off** | **turn off** |
| Snoozing | — | — | turn off | turn off |
| Timer DONE | stop beeping | stop beeping | stop beeping | stop beeping |

On-device flows:

- **Alarm** → list of alarms + `+ New alarm` → editor steps: hour → minute →
  repeat (Every day / Weekdays / Weekends / Custom) → ON/OFF → saved.
  Separate weekday and weekend alarms = just two alarms in the list.
- **Pomo** → presets (Classic 25/5, Deep 50/10, Quick 15/3) or Custom
  (work → break → long break → rounds → starts). `Resume` appears while a
  session is active.
- **Timer** → presets (1/3/5/10/15/30 min) or Custom (minutes → seconds,
  seconds step by 5 → starts).

## First-time setup on the Pi

```bash
ssh vladsdr@Vlad-brodyaga.local
sudo apt update
sudo apt install -y python3-flask python3-luma.oled python3-pil \
                    python3-rpi.gpio fonts-dejavu-core espeak-ng \
                    alsa-utils mpg123 ffmpeg
```

(The luma/PIL/GPIO/espeak packages are already there if the demos from
`scripts/` ran; new ones are `python3-flask` and `fonts-dejavu-core`.)

Make sure the timezone is right (alarms use local time):

```bash
sudo raspi-config   # Localisation Options -> Timezone
```

## Deploy from the Mac

```bash
# from the repo root
scp -r pi vladsdr@Vlad-brodyaga.local:~/
```

Optional — host the settings web app on the Pi so any phone on the Wi-Fi
can open it (no Mac needed):

```bash
cd web && npm run build
ssh vladsdr@Vlad-brodyaga.local "mkdir -p ~/pi/webroot"
scp -r web/dist/* vladsdr@Vlad-brodyaga.local:~/pi/webroot/
```

## Run

```bash
ssh vladsdr@Vlad-brodyaga.local
cd ~/pi
python3 -m vlad_device.main
```

- Settings app (if webroot deployed): `http://vlad-brodyaga.local:8787`
- API: `http://vlad-brodyaga.local:8787/api/state`
- Settings persist in `~/.config/vlad-device/state.json`

Useful flags: `--no-sound` (quiet), `--no-hardware` (API + logic only, works
on the Mac too), `--port`.

## Autostart on boot

```bash
sudo cp ~/pi/vlad-device.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vlad-device
systemctl status vlad-device        # check it's running
journalctl -u vlad-device -f        # live logs
```

## HTTP API

All responses return the full state snapshot (same shape as
`web/src/lib/deviceApi.ts` → `DeviceApiState`). Validation errors → 400
with `{"error": "..."}`.

| Method | Path | Body | Effect |
|---|---|---|---|
| GET | `/api/health` | — | ping |
| GET | `/api/state` | — | full snapshot |
| PUT | `/api/alarms` | `[{id?, enabled, hour, minute, repeatDays[7], songId?}]` | replace alarm list |
| PUT | `/api/pomodoro` | `{workMin?, breakMin?, longBreakMin?, rounds?}` | update settings |
| PUT | `/api/timer` | `{durationSec}` | set duration (resets timer) |
| POST | `/api/pomodoro/start` | optional settings | start session (device screen follows) |
| POST | `/api/pomodoro/pause` | — | pause/resume |
| POST | `/api/pomodoro/stop` | — | stop session |
| POST | `/api/timer/start` | optional `{durationSec}` | start countdown |
| POST | `/api/timer/pause` | — | pause/resume |
| POST | `/api/timer/reset` | — | reset |
| POST | `/api/alarm/trigger` | — | ring now (test) |
| POST | `/api/alarm/snooze` | — | snooze 5 min |
| POST | `/api/alarm/dismiss` | — | turn off |
| GET | `/api/songs` | — | list wake-up songs |
| POST | `/api/songs` | multipart: `id`, `name`, `category`, `file` | upload/replace a song |
| DELETE | `/api/songs/<id>` | — | delete song (clears it from alarms) |
| GET | `/api/songs/<id>/audio` | — | stream the audio file |

`repeatDays` index 0 = Sunday … 6 = Saturday (same as the web app).

Song files live in `~/.config/vlad-device/songs/` (metadata in `songs.json`).
Supported formats: MP3, WAV, M4A, OGG, FLAC, AAC (max 20 MB). Playback uses
`ffplay` (from **ffmpeg** — all listed formats), else `aplay` (WAV) or `mpg123`
(MP3). Espeak is the fallback if no song is set or playback fails.

## Development without the Pi

```bash
python3 pi/dev_selftest.py                      # logic checks, no deps
python3 -m vlad_device.main --no-hardware       # needs flask (see .venv)
```

Point the web dev app at a local backend with
`http://localhost:5173/?device=http://localhost:8787`.

## Still to do here

- Buzzer beeps for timer-done (speaker plays alarm songs today).
- Alarms that fire while another alarm is snoozing are skipped.
