#!/usr/bin/env python3
"""Hardware-free logic checks for the device backend.

Run from the pi/ directory on any machine (no Pi, no Flask, no PIL needed):

    python3 dev_selftest.py
"""

from __future__ import annotations

import json
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from vlad_device.controller import Controller
from vlad_device.songs import SongLibrary
from vlad_device.state import WEEKDAYS, WEEKENDS, next_alarm, parse_alarms

FAILURES: list[str] = []


def expect(condition: bool, message: str) -> None:
    status = "ok" if condition else "FAIL"
    print(f"  [{status}] {message}")
    if not condition:
        FAILURES.append(message)


class FakeClock:
    def __init__(self, dt: datetime):
        self.dt = dt

    def now(self) -> datetime:
        return self.dt


class FakeRinger:
    def __init__(self):
        self.events: list[str] = []

    def start(self, kind: str, *, song_path=None) -> None:
        suffix = f":{song_path}" if song_path else ""
        self.events.append(f"start:{kind}{suffix}")

    def stop(self) -> None:
        self.events.append("stop")

    def say(self, text: str) -> None:
        self.events.append(f"say:{text}")

    def set_volume(self, volume: int) -> None:
        self.events.append(f"volume:{volume}")


def make(dt: datetime, state_file: Path | None = None):
    clock = FakeClock(dt)
    ringer = FakeRinger()
    if state_file is None:
        state_file = Path(tempfile.mkdtemp()) / "state.json"
    songs = SongLibrary(state_file.parent)
    controller = Controller(state_file, ringer=ringer, now_fn=clock.now, songs=songs)
    controller.tick()  # prime the tick clock
    return controller, clock, ringer, state_file


def advance(controller: Controller, clock: FakeClock, seconds: int) -> None:
    for _ in range(seconds):
        clock.dt += timedelta(seconds=1)
        controller.tick()


def jump(controller: Controller, clock: FakeClock, dt: datetime) -> None:
    clock.dt = dt
    controller.tick()


# 2026-07-06 is a Monday; 2026-07-11 the following Saturday (kept after Monday
# because the tick clock ignores backward time jumps).
MONDAY = datetime(2026, 7, 6)
SATURDAY = datetime(2026, 7, 11)
FRIDAY = datetime(2026, 7, 10)


def test_defaults():
    print("defaults")
    controller, _, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    snap = controller.snapshot()
    expect(len(snap["alarms"]) == 1, "one default alarm")
    expect(snap["alarms"][0]["hour"] == 7 and snap["alarms"][0]["minute"] == 30, "default 07:30")
    expect(snap["device"]["screen"] == "clock", "starts on clock")
    expect(snap["pomodoro"] == {"workMin": 25, "breakMin": 5, "longBreakMin": 15, "rounds": 4}, "pomodoro defaults")
    expect(snap["volume"] == 80, "default volume 80%")
    json.dumps(snap)
    expect(True, "snapshot is JSON serializable")


def test_weekday_weekend_alarms():
    print("weekday/weekend alarms, knob=snooze, red=off")
    controller, clock, ringer, _ = make(MONDAY.replace(hour=6, minute=59, second=30))
    controller.api_set_alarms(
        [
            {"id": "wd", "enabled": True, "hour": 7, "minute": 0, "repeatDays": WEEKDAYS},
            {"id": "we", "enabled": True, "hour": 9, "minute": 0, "repeatDays": WEEKENDS},
        ]
    )
    advance(controller, clock, 31)
    expect(controller.screen == "alarm_ringing", "weekday alarm rings Monday 07:00")
    expect(controller.ringing_alarm_id == "wd", "weekday alarm is the one ringing")
    expect("start:alarm" in ringer.events, "ring sound started")

    controller.knob_click()
    expect(controller.screen == "snoozing", "knob click snoozes")
    advance(controller, clock, 300)
    expect(controller.screen == "alarm_ringing", "alarm re-rings after 5 min snooze")

    controller.button_short()
    expect(controller.screen == "clock", "red button turns alarm off")
    expect(controller.dismissed.get("wd"), "weekday alarm marked dismissed for today")

    jump(controller, clock, MONDAY.replace(hour=8, minute=59, second=50))
    advance(controller, clock, 15)
    expect(controller.screen == "clock", "weekend alarm silent on Monday")

    jump(controller, clock, SATURDAY.replace(hour=6, minute=59, second=50))
    advance(controller, clock, 15)
    expect(controller.screen == "clock", "weekday alarm silent on Saturday")
    jump(controller, clock, SATURDAY.replace(hour=8, minute=59, second=50))
    advance(controller, clock, 15)
    expect(controller.screen == "alarm_ringing" and controller.ringing_alarm_id == "we", "weekend alarm rings Saturday 09:00")
    controller.button_long()
    expect(controller.screen == "clock", "long press also turns alarm off")


def test_per_alarm_dismissal():
    print("two alarms on the same day")
    controller, clock, _, _ = make(MONDAY.replace(hour=6, minute=59, second=50))
    controller.api_set_alarms(
        [
            {"id": "a", "hour": 7, "minute": 0, "repeatDays": [True] * 7},
            {"id": "b", "hour": 7, "minute": 2, "repeatDays": [True] * 7},
        ]
    )
    advance(controller, clock, 15)
    expect(controller.ringing_alarm_id == "a", "first alarm rings at 07:00")
    controller.button_short()
    advance(controller, clock, 115)
    expect(controller.ringing_alarm_id == "b", "second alarm still rings at 07:02")
    controller.button_short()


def test_device_alarm_edit_flow():
    print("on-device alarm creation via knob")
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.knob_click()
    expect(controller.screen == "menu", "clock -> menu")
    controller.knob_click()
    expect(controller.screen == "alarm_list", "menu Alarm -> alarm list")
    controller.knob_turn(1)  # move to "+ New alarm"
    controller.knob_click()
    expect(controller.screen == "alarm_edit" and controller.edit["field"] == "hour", "new alarm editor opens on hour")
    controller.knob_turn(1)  # 7 -> 8
    controller.knob_click()
    for _ in range(30):
        controller.knob_turn(1)
    controller.knob_click()
    controller.knob_turn(1)  # Every day -> Weekdays
    controller.knob_click()
    controller.knob_click()  # confirm enabled + save
    expect(controller.screen == "alarm_list", "editor saves back to list")
    snap = controller.snapshot()
    created = snap["alarms"][1]
    expect(created["hour"] == 8 and created["minute"] == 30, "created alarm is 08:30")
    expect(created["repeatDays"] == WEEKDAYS, "created alarm repeats on weekdays")
    expect(created["enabled"], "created alarm enabled")
    expect(snap["device"]["flash"] == "SAVED", "SAVED flash shown")

    controller.button_long()
    expect(controller.screen == "clock", "long press returns home")


def test_edit_cancel():
    print("edit cancel with red button")
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.knob_click()
    controller.knob_click()  # alarm list
    controller.knob_click()  # edit existing alarm
    controller.knob_turn(1)
    controller.button_short()
    expect(controller.screen == "alarm_list", "red short cancels edit back to list")
    expect(controller.alarms[0].hour == 7, "cancel discards changes")


def test_pomodoro_preset_and_controls():
    print("pomodoro preset from device menu")
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.knob_click()
    controller.knob_turn(1)  # Pomo
    controller.knob_click()
    expect(controller.screen == "pomo_menu", "pomodoro menu opens")
    items = controller.snapshot()["device"]["items"]
    expect(items[0].startswith("Classic"), "presets listed when idle")
    expect("Custom" in items, "custom entry present")
    controller.knob_click()  # Classic
    expect(controller.screen == "pomodoro", "preset starts a session")
    expect(controller.pomodoro_rt.remaining_sec == 25 * 60, "classic work length applied")
    controller.knob_click()
    expect(controller.pomodoro_rt.status == "paused", "knob click pauses")
    controller.knob_click()
    expect(controller.pomodoro_rt.status == "running", "knob click resumes")
    controller.button_short()
    expect(controller.screen == "clock" and controller.pomodoro_rt.status == "running", "red short backgrounds the session")
    controller.knob_click()
    controller.knob_turn(1)
    controller.knob_click()
    items = controller.snapshot()["device"]["items"]
    expect(items[0] == "Resume", "resume entry appears while active")
    controller.knob_click()
    expect(controller.screen == "pomodoro", "resume returns to session")
    controller.button_long()
    expect(controller.pomodoro_rt.status == "idle" and controller.screen == "clock", "long press stops session")


def test_pomodoro_phases():
    print("pomodoro phase transitions")
    controller, clock, ringer, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.api_update_pomodoro({"workMin": 1, "breakMin": 1, "longBreakMin": 1, "rounds": 2})
    controller.api_start_pomodoro()
    advance(controller, clock, 60)
    expect(controller.pomodoro_rt.phase == "break", "work -> break")
    advance(controller, clock, 60)
    expect(controller.pomodoro_rt.phase == "work" and controller.pomodoro_rt.current_round == 2, "break -> work round 2")
    advance(controller, clock, 60)
    expect(controller.pomodoro_rt.phase == "long_break", "last round -> long break")
    advance(controller, clock, 60)
    expect(controller.pomodoro_rt.status == "idle" and controller.screen == "clock", "long break -> idle")
    expect("say:Break time" in ringer.events and "say:Pomodoro finished" in ringer.events, "voice cues fired")


def test_timer_custom_flow():
    print("custom timer with seconds")
    controller, clock, ringer, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.knob_click()
    controller.knob_turn(-1)  # wrap to Timer
    controller.knob_click()
    expect(controller.screen == "timer_menu", "timer menu opens")
    items = controller.snapshot()["device"]["items"]
    custom_index = items.index("Custom")
    while controller.cursor != custom_index:
        controller.knob_turn(1)
    controller.knob_click()
    expect(controller.screen == "timer_edit" and controller.edit["field"] == "min", "custom editor opens")
    for _ in range(5):
        controller.knob_turn(-1)  # 5 -> 0 minutes
    controller.knob_click()
    controller.knob_turn(1)
    controller.knob_turn(1)  # +10 seconds
    controller.knob_click()
    expect(controller.screen == "timer" and controller.timer.status == "running", "custom timer starts")
    expect(controller.timer.duration_sec == 10, "duration is 0:10")

    advance(controller, clock, 3)
    controller.knob_click()
    remaining = controller.timer.remaining_sec
    advance(controller, clock, 5)
    expect(controller.timer.remaining_sec == remaining, "pause holds the countdown")
    controller.knob_click()
    advance(controller, clock, 7)
    expect(controller.screen == "timer_done", "timer completion shows DONE")
    expect("start:timer" in ringer.events, "timer completion sound")
    controller.button_short()
    expect(controller.screen == "clock" and controller.timer.status == "idle", "red press clears DONE")
    expect(controller.timer.remaining_sec == 10, "timer resets to duration")


def test_timer_zero_guard():
    print("timer 0:00 guard")
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.knob_click()
    controller.knob_turn(-1)
    controller.knob_click()
    items = controller.snapshot()["device"]["items"]
    custom_index = items.index("Custom")
    while controller.cursor != custom_index:
        controller.knob_turn(1)
    controller.knob_click()
    for _ in range(5):
        controller.knob_turn(-1)
    controller.knob_click()  # min -> sec (0)
    controller.knob_click()  # try to start 0:00
    expect(controller.screen == "timer_edit", "0:00 refuses to start")
    expect(controller.snapshot()["device"]["flash"] == "SET TIME", "SET TIME hint shown")


def test_timer_presets():
    print("timer preset start")
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.knob_click()
    controller.knob_turn(1)
    controller.knob_turn(1)  # Timer
    controller.knob_click()
    controller.knob_turn(1)  # 1 min -> 3 min
    controller.knob_click()
    expect(controller.timer.status == "running" and controller.timer.duration_sec == 180, "3 min preset starts")
    controller.button_long()
    expect(controller.timer.status == "idle", "long press resets timer")


def test_next_alarm():
    print("next alarm computation")
    alarms = parse_alarms(
        [
            {"id": "wd", "hour": 7, "minute": 0, "repeatDays": WEEKDAYS},
            {"id": "we", "hour": 9, "minute": 0, "repeatDays": WEEKENDS},
        ]
    )
    fire, alarm = next_alarm(alarms, {}, MONDAY.replace(hour=8))
    expect(alarm.id == "wd" and fire.weekday() == 1, "Monday 08:00 -> Tuesday 07:00")
    fire, alarm = next_alarm(alarms, {}, FRIDAY.replace(hour=10))
    expect(alarm.id == "we" and fire.weekday() == 5, "Friday 10:00 -> Saturday 09:00")
    fire, alarm = next_alarm(alarms, {}, MONDAY.replace(hour=6))
    expect(alarm.id == "wd" and fire.date() == MONDAY.date(), "Monday 06:00 -> Monday 07:00")
    fire, alarm = next_alarm(alarms, {"wd": "2026-07-06"}, MONDAY.replace(hour=6))
    expect(fire.weekday() == 1, "dismissed today -> tomorrow")
    expect(next_alarm([], {}, MONDAY) is None, "no alarms -> None")


def test_api_validation():
    print("API validation")
    controller, _, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    for bad_call in (
        lambda: controller.api_set_alarms([{"id": "x", "hour": 24, "minute": 0, "repeatDays": [True] * 7}]),
        lambda: controller.api_set_alarms({"not": "a list"}),
        lambda: controller.api_update_pomodoro({"workMin": 0}),
        lambda: controller.api_set_timer_duration(0),
        lambda: controller.api_set_timer_duration("nope"),
    ):
        try:
            bad_call()
            expect(False, "invalid input rejected")
        except ValueError:
            expect(True, "invalid input rejected")


def test_api_ring_control():
    print("API trigger/snooze/dismiss")
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.api_trigger_alarm()
    expect(controller.screen == "alarm_ringing", "API trigger rings")
    controller.api_snooze()
    expect(controller.screen == "snoozing", "API snooze")
    controller.api_dismiss()
    expect(controller.screen == "clock", "API dismiss")


def test_persistence_roundtrip():
    print("persistence roundtrip")
    controller, clock, _, state_file = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.api_set_alarms(
        [{"id": "keep", "hour": 6, "minute": 45, "repeatDays": WEEKDAYS, "enabled": False}]
    )
    controller.api_update_pomodoro({"workMin": 50})
    controller.api_set_timer_duration(90)
    controller.api_set_volume(45)
    reloaded, _, ringer, _ = make(datetime(2026, 7, 2, 12, 0, 0), state_file=state_file)
    snap = reloaded.snapshot()
    expect(snap["alarms"] == [
        {"id": "keep", "enabled": False, "hour": 6, "minute": 45, "repeatDays": WEEKDAYS, "songId": None}
    ], "alarms survive restart")
    expect(snap["pomodoro"]["workMin"] == 50, "pomodoro settings survive restart")
    expect(snap["timer"]["durationSec"] == 90, "timer duration survives restart")
    expect(snap["volume"] == 45, "volume survives restart")
    expect("volume:45" in ringer.events, "ringer volume restored on load")


def test_volume_api_and_menu():
    print("volume api and device menu")
    controller, _, ringer, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.api_set_volume(60)
    expect(controller.snapshot()["volume"] == 60, "api sets volume")
    expect("volume:60" in ringer.events, "api updates ringer volume")
    controller.knob_click()
    controller.knob_click()
    items = controller.snapshot()["device"]["items"]
    expect(any(item.startswith("Volume ") for item in items), "alarm list shows volume item")
    volume_index = next(i for i, item in enumerate(items) if item.startswith("Volume "))
    while controller.cursor != volume_index:
        controller.knob_turn(1)
    controller.knob_click()
    expect(controller.snapshot()["device"]["screen"] == "volume_edit", "volume edit screen opens")
    controller.knob_turn(1)
    controller.knob_turn(1)
    controller.knob_click()
    expect(controller.snapshot()["volume"] == 70, "device volume edit saves")


def test_alarm_song_playback():
    print("alarm song playback path")
    controller, clock, ringer, state_file = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.api_upsert_song("song-1", "Morning", "vlad", b"RIFF", "tone.wav")
    controller.api_set_alarms(
        [{"id": "a1", "enabled": True, "hour": 7, "minute": 0, "repeatDays": [True] * 7, "songId": "song-1"}]
    )
    controller.api_trigger_alarm()
    path = controller.api_song_audio_path("song-1")
    expect(path is not None, "song file stored")
    expect(any(str(path) in event for event in ringer.events if event.startswith("start:alarm")), "alarm rings with song file")


def test_song_api():
    print("song upload/delete API")
    controller, _, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    controller.api_upsert_song("song-x", "Test", "both", b"RIFF", "x.wav")
    controller.api_set_alarms(
        [{"id": "a1", "enabled": True, "hour": 7, "minute": 0, "repeatDays": [True] * 7, "songId": "song-x"}]
    )
    listed = controller.api_list_songs()
    expect(len(listed) == 1 and listed[0]["name"] == "Test", "songs listed in API")
    controller.api_delete_song("song-x")
    snap = controller.snapshot()
    expect(snap["alarms"][0]["songId"] is None, "deleted song cleared from alarms")
    expect(snap["songs"] == [], "song removed from library")


def test_appearance_api():
    print("appearance upload/delete API")
    controller, _, _, state_file = make(datetime(2026, 7, 2, 12, 0, 0))
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    appearance = controller.api_upsert_avatar("vlad", png, "vlad.png")
    expect(appearance["avatars"]["vlad"] is not None, "avatar timestamp stored")
    expect(controller.api_avatar_path("vlad") is not None, "avatar file stored")
    snap = controller.snapshot()
    expect(snap["appearance"]["avatars"]["vlad"] is not None, "avatar in snapshot")
    appearance = controller.api_upsert_background(png, "bg.png")
    expect(appearance["background"] is not None, "background timestamp stored")
    expect(controller.api_background_path() is not None, "background file stored")
    controller.api_delete_avatar("vlad")
    controller.api_delete_background()
    snap = controller.snapshot()
    expect(snap["appearance"]["avatars"]["vlad"] is None, "avatar removed")
    expect(snap["appearance"]["background"] is None, "background removed")


def test_renderer_smoke():
    print("renderer smoke test (needs PIL)")
    try:
        from vlad_device.display import Renderer
    except ImportError:
        print("  [skip] PIL not installed here")
        return
    renderer = Renderer()
    controller, clock, _, _ = make(datetime(2026, 7, 2, 12, 0, 0))
    script = [
        lambda: None,
        controller.knob_click,                      # menu
        controller.knob_click,                      # alarm_list
        controller.knob_click,                      # alarm_edit
        controller.knob_click,                      # minute field
        controller.knob_click,                      # repeat field
        controller.knob_click,                      # enabled field
        controller.knob_click,                      # save -> list
        controller.button_long,                     # clock
        controller.api_trigger_alarm,               # ringing
        controller.api_snooze,                      # snoozing
        controller.api_dismiss,
        controller.api_start_pomodoro,              # pomodoro
        controller.api_stop_pomodoro,
        lambda: controller.api_start_timer(65),     # timer
        controller.api_reset_timer,
    ]
    seen = set()
    for step in script:
        step()
        snap = controller.snapshot()
        seen.add(snap["device"]["screen"])
        renderer.render(snap)
    controller.knob_click()
    controller.knob_turn(1)
    controller.knob_turn(1)
    controller.knob_click()
    renderer.render(controller.snapshot())          # timer_menu
    controller.knob_turn(-1)
    controller.knob_click()
    renderer.render(controller.snapshot())          # timer_edit
    controller.button_long()
    controller.api_start_timer(1)
    advance(controller, clock, 1)
    renderer.render(controller.snapshot())          # timer_done
    seen.add("timer_done")
    expect(len(seen) >= 8, f"rendered {len(seen)} screens without error")


def main() -> int:
    tests = [
        test_defaults,
        test_weekday_weekend_alarms,
        test_per_alarm_dismissal,
        test_device_alarm_edit_flow,
        test_edit_cancel,
        test_pomodoro_preset_and_controls,
        test_pomodoro_phases,
        test_timer_custom_flow,
        test_timer_zero_guard,
        test_timer_presets,
        test_next_alarm,
        test_api_validation,
        test_api_ring_control,
        test_alarm_song_playback,
        test_song_api,
        test_appearance_api,
        test_persistence_roundtrip,
        test_volume_api_and_menu,
        test_renderer_smoke,
    ]
    for test in tests:
        test()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for failure in FAILURES:
            print(f"  - {failure}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
