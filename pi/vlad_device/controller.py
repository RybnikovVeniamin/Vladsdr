"""Device state machine.

Single source of truth for the gadget. Physical inputs (knob, red button),
the HTTP API and the 1-second tick all funnel into this class; the display
just paints `snapshot()`.

Control mapping while the alarm rings (product decision, 2026-07-02):
  red button (short or long) = turn the alarm off
  knob click               = snooze 5 minutes
"""

from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path

from .songs import SongLibrary
from .state import (
    POMODORO_PRESETS,
    REPEAT_CHOICES,
    SNOOZE_SEC,
    TIMER_PRESETS_MIN,
    Alarm,
    Persistence,
    PomodoroRuntime,
    TimerState,
    date_key,
    js_day,
    next_alarm,
    parse_alarms,
    repeat_label,
    validate_timer_duration,
    validate_volume,
)

MENU_ITEMS = ["Alarm", "Pomo", "Timer"]

ALARM_EDIT_FIELDS = ["hour", "minute", "repeat", "enabled"]
POMO_EDIT_FIELDS = ["work", "break", "long", "rounds"]
TIMER_EDIT_FIELDS = ["min", "sec"]

FLASH_SEC = 2.0


class NullRinger:
    def start(self, kind: str, *, song_path=None) -> None:
        pass

    def stop(self) -> None:
        pass

    def say(self, text: str) -> None:
        pass

    def set_volume(self, volume: int) -> None:
        pass


class Controller:
    def __init__(self, state_path: Path, ringer=None, now_fn=datetime.now, songs=None):
        self._lock = threading.RLock()
        self._now = now_fn
        self.ringer = ringer or NullRinger()
        self._persistence = Persistence(state_path)
        self._songs = songs or SongLibrary(state_path.parent)

        self.alarms, self.pomodoro, timer_duration, self.volume = self._persistence.load()
        self.pomodoro_rt = PomodoroRuntime()
        self.timer = TimerState(duration_sec=timer_duration, remaining_sec=timer_duration)
        self.ringer.set_volume(self.volume)

        self.screen = "clock"
        self.cursor = 0
        self.snooze_until: float | None = None
        self.ringing_alarm_id: str | None = None
        self.dismissed: dict[str, str] = {}
        self.return_screen: str | None = None
        self.edit: dict | None = None
        self.flash_text: str | None = None
        self.flash_until = 0.0

        self._last_sec: int | None = None

    # ------------------------------------------------------------------ utils

    def _save(self) -> None:
        self._persistence.save(self.alarms, self.pomodoro, self.timer.duration_sec, self.volume)

    def _flash(self, text: str) -> None:
        self.flash_text = text
        self.flash_until = self._now().timestamp() + FLASH_SEC

    def _goto(self, screen: str, cursor: int = 0) -> None:
        self.screen = screen
        self.cursor = cursor

    def _alarm_list_items(self) -> list[str]:
        items = []
        for alarm in self.alarms:
            state = "on" if alarm.enabled else "off"
            items.append(f"{alarm.hour:02d}:{alarm.minute:02d} {repeat_label(alarm.repeat_days)} {state}")
        items.append("+ New alarm")
        items.append(f"Volume {self.volume}%")
        return items

    def _pomo_menu_items(self) -> list[str]:
        items = []
        if self.pomodoro_rt.status != "idle":
            items.append("Resume")
        items.extend(p["label"] for p in POMODORO_PRESETS)
        items.append("Custom")
        items.append(f"Volume {self.volume}%")
        return items

    def _timer_menu_items(self) -> list[str]:
        items = []
        if self.timer.status in ("running", "paused"):
            items.append("Resume")
        items.extend(f"{m} min" for m in TIMER_PRESETS_MIN)
        items.append("Custom")
        items.append(f"Volume {self.volume}%")
        return items

    def _repeat_choices(self, current_days: list[bool]) -> list[tuple[str, list[bool]]]:
        choices = [(label, list(days)) for label, days in REPEAT_CHOICES]
        if current_days not in [days for _, days in choices]:
            choices.append(("Custom", list(current_days)))
        return choices

    # ------------------------------------------------------- ringing helpers

    def _alarm_song_path(self, alarm_id: str):
        alarm = next((a for a in self.alarms if a.id == alarm_id), None)
        if not alarm:
            return None
        return self._songs.get_audio_path(alarm.song_id)

    def _ring(self, alarm_id: str) -> None:
        if self.screen in ("pomodoro", "timer"):
            self.return_screen = self.screen
        self.edit = None
        self.ringing_alarm_id = alarm_id
        self.snooze_until = None
        self._goto("alarm_ringing")
        self.ringer.start("alarm", song_path=self._alarm_song_path(alarm_id))

    def _stop_ringing_to_previous(self) -> None:
        self.ringer.stop()
        target = "clock"
        if self.return_screen == "pomodoro" and self.pomodoro_rt.status != "idle":
            target = "pomodoro"
        elif self.return_screen == "timer" and self.timer.status in ("running", "paused"):
            target = "timer"
        self.return_screen = None
        self._goto(target)

    def _do_snooze(self) -> None:
        if self.screen != "alarm_ringing":
            return
        self.ringer.stop()
        self.snooze_until = self._now().timestamp() + SNOOZE_SEC
        self._goto("snoozing")

    def _do_dismiss(self) -> None:
        if self.screen not in ("alarm_ringing", "snoozing"):
            return
        if self.ringing_alarm_id:
            self.dismissed[self.ringing_alarm_id] = date_key(self._now())
        self.ringing_alarm_id = None
        self.snooze_until = None
        self._stop_ringing_to_previous()
        if self.timer.status == "done":
            self.timer.status = "idle"
            self.timer.remaining_sec = self.timer.duration_sec

    def _finish_timer_done(self) -> None:
        self.ringer.stop()
        self.timer.status = "idle"
        self.timer.remaining_sec = self.timer.duration_sec
        self._goto("clock")

    # ------------------------------------------------------------ edit flows

    def _open_alarm_edit(self, alarm: Alarm | None) -> None:
        source = alarm or Alarm(id="", hour=7, minute=0)
        choices = self._repeat_choices(source.repeat_days)
        repeat_index = next(
            (i for i, (_, days) in enumerate(choices) if days == source.repeat_days), 0
        )
        self.edit = {
            "kind": "alarm",
            "id": alarm.id if alarm else None,
            "hour": source.hour,
            "minute": source.minute,
            "choices": choices,
            "repeat_index": repeat_index,
            "enabled": source.enabled,
            "field": "hour",
        }
        self._goto("alarm_edit")

    def _commit_alarm_edit(self) -> None:
        edit = self.edit
        assert edit is not None
        days = edit["choices"][edit["repeat_index"]][1]
        alarm_id = edit["id"]
        if alarm_id is None:
            existing = {a.id for a in self.alarms}
            n = 1
            while f"alarm-{n}" in existing:
                n += 1
            alarm_id = f"alarm-{n}"
            self.alarms.append(Alarm(id=alarm_id))
        for alarm in self.alarms:
            if alarm.id == alarm_id:
                alarm.hour = edit["hour"]
                alarm.minute = edit["minute"]
                alarm.repeat_days = list(days)
                alarm.enabled = edit["enabled"]
                break
        self.dismissed.pop(alarm_id, None)
        self.edit = None
        self._save()
        self._flash("SAVED")
        self._goto("alarm_list")

    def _open_pomo_edit(self) -> None:
        self.edit = {
            "kind": "pomo",
            "work": self.pomodoro.work_min,
            "break": self.pomodoro.break_min,
            "long": self.pomodoro.long_break_min,
            "rounds": self.pomodoro.rounds,
            "field": "work",
        }
        self._goto("pomo_edit")

    def _open_timer_edit(self) -> None:
        minutes = min(self.timer.duration_sec // 60, 180)
        self.edit = {
            "kind": "timer",
            "min": minutes,
            "sec": self.timer.duration_sec % 60,
            "field": "min",
        }
        self._goto("timer_edit")

    def _open_volume_edit(self, return_screen: str) -> None:
        self.edit = {
            "kind": "volume",
            "value": self.volume,
            "return": return_screen,
        }
        self._goto("volume_edit")

    def _commit_volume_edit(self) -> None:
        edit = self.edit
        if not edit or edit.get("kind") != "volume":
            return
        self.volume = validate_volume(edit["value"])
        self.ringer.set_volume(self.volume)
        return_screen = edit.get("return", "menu")
        self.edit = None
        self._save()
        self._flash("SAVED")
        self._goto(return_screen)

    def _is_volume_item(self, item: str) -> bool:
        return item.startswith("Volume ")

    # -------------------------------------------------------- physical input

    def knob_turn(self, direction: int) -> None:
        direction = 1 if direction > 0 else -1
        with self._lock:
            if self.screen in ("menu", "alarm_list", "pomo_menu", "timer_menu"):
                items = self._items_for_screen()
                if items:
                    self.cursor = (self.cursor + direction) % len(items)
            elif self.screen == "alarm_edit":
                self._turn_alarm_edit(direction)
            elif self.screen == "pomo_edit":
                self._turn_pomo_edit(direction)
            elif self.screen == "timer_edit":
                self._turn_timer_edit(direction)
            elif self.screen == "volume_edit":
                self._turn_volume_edit(direction)

    def _turn_alarm_edit(self, direction: int) -> None:
        edit = self.edit
        if not edit:
            return
        field = edit["field"]
        if field == "hour":
            edit["hour"] = (edit["hour"] + direction) % 24
        elif field == "minute":
            edit["minute"] = (edit["minute"] + direction) % 60
        elif field == "repeat":
            edit["repeat_index"] = (edit["repeat_index"] + direction) % len(edit["choices"])
        elif field == "enabled":
            edit["enabled"] = not edit["enabled"]

    def _turn_pomo_edit(self, direction: int) -> None:
        edit = self.edit
        if not edit:
            return
        limits = {"work": (1, 120), "break": (1, 60), "long": (1, 60), "rounds": (1, 12)}
        field = edit["field"]
        lo, hi = limits[field]
        edit[field] = min(hi, max(lo, edit[field] + direction))

    def _turn_timer_edit(self, direction: int) -> None:
        edit = self.edit
        if not edit:
            return
        if edit["field"] == "min":
            edit["min"] = min(180, max(0, edit["min"] + direction))
        else:
            edit["sec"] = (edit["sec"] + direction * 5) % 60

    def _turn_volume_edit(self, direction: int) -> None:
        edit = self.edit
        if not edit or edit.get("kind") != "volume":
            return
        edit["value"] = min(100, max(0, edit["value"] + direction * 5))

    def knob_click(self) -> None:
        with self._lock:
            screen = self.screen
            if screen == "alarm_ringing":
                self._do_snooze()
            elif screen == "snoozing":
                pass
            elif screen == "clock":
                self._goto("menu")
            elif screen == "menu":
                self._select_menu()
            elif screen == "alarm_list":
                self._select_alarm_list()
            elif screen == "pomo_menu":
                self._select_pomo_menu()
            elif screen == "timer_menu":
                self._select_timer_menu()
            elif screen == "alarm_edit":
                self._advance_alarm_edit()
            elif screen == "pomo_edit":
                self._advance_pomo_edit()
            elif screen == "timer_edit":
                self._advance_timer_edit()
            elif screen == "volume_edit":
                self._commit_volume_edit()
            elif screen == "pomodoro":
                self._toggle_pomodoro_pause()
            elif screen == "timer":
                self._toggle_timer_pause()
            elif screen == "timer_done":
                self._finish_timer_done()

    def _select_menu(self) -> None:
        item = MENU_ITEMS[self.cursor % len(MENU_ITEMS)]
        if item == "Alarm":
            self._goto("alarm_list")
        elif item == "Pomo":
            self._goto("pomo_menu")
        elif item == "Timer":
            self._goto("timer_menu")

    def _select_alarm_list(self) -> None:
        items = self._alarm_list_items()
        item = items[self.cursor % len(items)]
        if self._is_volume_item(item):
            self._open_volume_edit("alarm_list")
        elif self.cursor < len(self.alarms):
            self._open_alarm_edit(self.alarms[self.cursor])
        else:
            self._open_alarm_edit(None)

    def _select_pomo_menu(self) -> None:
        items = self._pomo_menu_items()
        item = items[self.cursor % len(items)]
        if item == "Resume":
            self._goto("pomodoro")
        elif self._is_volume_item(item):
            self._open_volume_edit("pomo_menu")
        elif item == "Custom":
            self._open_pomo_edit()
        else:
            preset = next(p for p in POMODORO_PRESETS if p["label"] == item)
            self.pomodoro.update(
                {k: preset[k] for k in ("workMin", "breakMin", "longBreakMin", "rounds")}
            )
            self._save()
            self._start_pomodoro()

    def _select_timer_menu(self) -> None:
        items = self._timer_menu_items()
        item = items[self.cursor % len(items)]
        if item == "Resume":
            self._goto("timer")
        elif self._is_volume_item(item):
            self._open_volume_edit("timer_menu")
        elif item == "Custom":
            self._open_timer_edit()
        else:
            minutes = int(item.split()[0])
            self.timer.duration_sec = minutes * 60
            self._save()
            self._start_timer()

    def _advance_alarm_edit(self) -> None:
        edit = self.edit
        if not edit:
            return
        index = ALARM_EDIT_FIELDS.index(edit["field"])
        if index + 1 < len(ALARM_EDIT_FIELDS):
            edit["field"] = ALARM_EDIT_FIELDS[index + 1]
        else:
            self._commit_alarm_edit()

    def _advance_pomo_edit(self) -> None:
        edit = self.edit
        if not edit:
            return
        index = POMO_EDIT_FIELDS.index(edit["field"])
        if index + 1 < len(POMO_EDIT_FIELDS):
            edit["field"] = POMO_EDIT_FIELDS[index + 1]
        else:
            self.pomodoro.update(
                {
                    "workMin": edit["work"],
                    "breakMin": edit["break"],
                    "longBreakMin": edit["long"],
                    "rounds": edit["rounds"],
                }
            )
            self.edit = None
            self._save()
            self._start_pomodoro()

    def _advance_timer_edit(self) -> None:
        edit = self.edit
        if not edit:
            return
        if edit["field"] == "min":
            edit["field"] = "sec"
            return
        total = edit["min"] * 60 + edit["sec"]
        if total <= 0:
            self._flash("SET TIME")
            return
        self.timer.duration_sec = total
        self.edit = None
        self._save()
        self._start_timer()

    def button_short(self) -> None:
        with self._lock:
            screen = self.screen
            if screen in ("alarm_ringing", "snoozing"):
                self._do_dismiss()
            elif screen == "timer_done":
                self._finish_timer_done()
            elif screen in ("pomodoro", "timer"):
                self._goto("clock")
            elif screen == "menu":
                self._goto("clock")
            elif screen == "alarm_list":
                self._goto("menu")
            elif screen in ("pomo_menu", "timer_menu"):
                self._goto("menu", MENU_ITEMS.index("Pomo" if screen == "pomo_menu" else "Timer"))
            elif screen == "alarm_edit":
                self.edit = None
                self._goto("alarm_list")
            elif screen == "pomo_edit":
                self.edit = None
                self._goto("pomo_menu")
            elif screen == "timer_edit":
                self.edit = None
                self._goto("timer_menu")
            elif screen == "volume_edit":
                edit = self.edit
                self.edit = None
                self._goto(edit.get("return", "menu") if edit else "menu")

    def button_long(self) -> None:
        with self._lock:
            screen = self.screen
            if screen in ("alarm_ringing", "snoozing"):
                self._do_dismiss()
            elif screen == "timer_done":
                self._finish_timer_done()
            elif screen == "pomodoro":
                self._stop_pomodoro()
            elif screen == "timer":
                self._reset_timer()
            else:
                self.edit = None
                self._goto("clock")

    # ------------------------------------------------------------ mode logic

    def _start_pomodoro(self) -> None:
        self.pomodoro_rt = PomodoroRuntime(
            phase="work",
            remaining_sec=self.pomodoro.work_min * 60,
            status="running",
            current_round=1,
        )
        self.edit = None
        self._goto("pomodoro")

    def _toggle_pomodoro_pause(self) -> None:
        if self.pomodoro_rt.status == "running":
            self.pomodoro_rt.status = "paused"
        elif self.pomodoro_rt.status == "paused":
            self.pomodoro_rt.status = "running"

    def _stop_pomodoro(self) -> None:
        self.pomodoro_rt = PomodoroRuntime()
        if self.screen == "pomodoro":
            self._goto("clock")

    def _start_timer(self) -> None:
        self.timer.remaining_sec = self.timer.duration_sec
        self.timer.status = "running"
        self.edit = None
        self._goto("timer")

    def _toggle_timer_pause(self) -> None:
        if self.timer.status == "running":
            self.timer.status = "paused"
        elif self.timer.status == "paused":
            self.timer.status = "running"

    def _reset_timer(self) -> None:
        self.timer.status = "idle"
        self.timer.remaining_sec = self.timer.duration_sec
        if self.screen in ("timer", "timer_done"):
            self.ringer.stop()
            self._goto("clock")

    def _advance_pomodoro_phase(self) -> None:
        rt = self.pomodoro_rt
        settings = self.pomodoro
        if rt.phase == "work":
            if rt.current_round >= settings.rounds:
                rt.phase = "long_break"
                rt.remaining_sec = settings.long_break_min * 60
                self.ringer.say("Long break")
            else:
                rt.phase = "break"
                rt.remaining_sec = settings.break_min * 60
                self.ringer.say("Break time")
        elif rt.phase == "break":
            rt.phase = "work"
            rt.current_round += 1
            rt.remaining_sec = settings.work_min * 60
            self.ringer.say("Focus time")
        elif rt.phase == "long_break":
            self.pomodoro_rt = PomodoroRuntime()
            self.ringer.say("Pomodoro finished")
            self._flash("POMO DONE")
            if self.screen == "pomodoro":
                self._goto("clock")

    # ------------------------------------------------------------------ tick

    def tick(self) -> None:
        with self._lock:
            now = self._now()
            sec = int(now.timestamp())
            if self._last_sec is None:
                self._last_sec = sec
                return
            delta = sec - self._last_sec
            if delta <= 0:
                return
            self._last_sec = sec
            delta = min(delta, 3600)

            today = date_key(now)
            if any(v != today for v in self.dismissed.values()):
                self.dismissed = {k: v for k, v in self.dismissed.items() if v == today}

            if (
                self.screen == "snoozing"
                and self.snooze_until is not None
                and now.timestamp() >= self.snooze_until
                and self.ringing_alarm_id
            ):
                self._ring(self.ringing_alarm_id)
            elif self.screen not in ("alarm_ringing", "snoozing"):
                day = js_day(now)
                for alarm in self.alarms:
                    if (
                        alarm.enabled
                        and alarm.repeat_days[day]
                        and alarm.hour == now.hour
                        and alarm.minute == now.minute
                        and self.dismissed.get(alarm.id) != today
                    ):
                        self._ring(alarm.id)
                        break

            rt = self.pomodoro_rt
            if rt.status == "running":
                rt.remaining_sec -= delta
                if rt.remaining_sec <= 0:
                    self._advance_pomodoro_phase()

            if self.timer.status == "running":
                self.timer.remaining_sec -= delta
                if self.timer.remaining_sec <= 0:
                    self.timer.remaining_sec = 0
                    self.timer.status = "done"
                    if self.screen not in ("alarm_ringing", "snoozing"):
                        self.edit = None
                        self._goto("timer_done")
                    self.ringer.start("timer")

    # ------------------------------------------------------------------- API

    def api_set_alarms(self, data) -> None:
        alarms = parse_alarms(data)
        with self._lock:
            old = {a.id: a for a in self.alarms}
            for alarm in alarms:
                previous = old.get(alarm.id)
                if previous is None or (previous.hour, previous.minute, previous.repeat_days) != (
                    alarm.hour,
                    alarm.minute,
                    alarm.repeat_days,
                ):
                    self.dismissed.pop(alarm.id, None)
            self.alarms = alarms
            if self.ringing_alarm_id and self.ringing_alarm_id not in {a.id for a in alarms}:
                self._do_dismiss()
            self.cursor = 0 if self.screen == "alarm_list" else self.cursor
            self._save()

    def api_update_pomodoro(self, data) -> None:
        with self._lock:
            self.pomodoro.update(data)
            self._save()

    def api_set_timer_duration(self, value) -> None:
        duration = validate_timer_duration(value)
        with self._lock:
            if self.timer.status == "done":
                self.ringer.stop()
            self.timer.duration_sec = duration
            self.timer.remaining_sec = duration
            self.timer.status = "idle"
            if self.screen in ("timer", "timer_done"):
                self._goto("clock")
            self._save()

    def api_set_volume(self, value) -> None:
        volume = validate_volume(value)
        with self._lock:
            self.volume = volume
            self.ringer.set_volume(volume)
            self._save()

    def api_start_pomodoro(self) -> None:
        with self._lock:
            self._start_pomodoro()

    def api_pause_pomodoro(self) -> None:
        with self._lock:
            self._toggle_pomodoro_pause()

    def api_stop_pomodoro(self) -> None:
        with self._lock:
            self._stop_pomodoro()

    def api_start_timer(self, duration_sec=None) -> None:
        if duration_sec is not None:
            duration_sec = validate_timer_duration(duration_sec)
        with self._lock:
            if duration_sec is not None:
                self.timer.duration_sec = duration_sec
                self._save()
            self._start_timer()

    def api_pause_timer(self) -> None:
        with self._lock:
            self._toggle_timer_pause()

    def api_reset_timer(self) -> None:
        with self._lock:
            self._reset_timer()

    def api_trigger_alarm(self) -> None:
        with self._lock:
            alarm = next((a for a in self.alarms if a.enabled), None) or (
                self.alarms[0] if self.alarms else None
            )
            self._ring(alarm.id if alarm else "test")

    def api_snooze(self) -> None:
        with self._lock:
            self._do_snooze()

    def api_dismiss(self) -> None:
        with self._lock:
            self._do_dismiss()

    def api_list_songs(self) -> list[dict]:
        with self._lock:
            return self._songs.list_songs()

    def api_upsert_song(self, song_id: str, name: str, category: str, data: bytes, filename: str) -> list[dict]:
        with self._lock:
            self._songs.upsert(song_id, name, category, data, filename)
            return self._songs.list_songs()

    def api_delete_song(self, song_id: str) -> list[dict]:
        with self._lock:
            self._songs.delete(song_id)
            for alarm in self.alarms:
                if alarm.song_id == song_id:
                    alarm.song_id = None
            self._save()
            return self._songs.list_songs()

    def api_song_audio_path(self, song_id: str):
        with self._lock:
            path = self._songs.get_audio_path(song_id)
            if path is None:
                raise ValueError("song not found")
            return path

    # -------------------------------------------------------------- snapshot

    def _items_for_screen(self) -> list[str]:
        if self.screen == "menu":
            return list(MENU_ITEMS)
        if self.screen == "alarm_list":
            return self._alarm_list_items()
        if self.screen == "pomo_menu":
            return self._pomo_menu_items()
        if self.screen == "timer_menu":
            return self._timer_menu_items()
        return []

    def snapshot(self) -> dict:
        with self._lock:
            now = self._now()
            epoch = now.timestamp()
            if self.flash_text and epoch >= self.flash_until:
                self.flash_text = None

            upcoming = next_alarm(self.alarms, self.dismissed, now)
            next_info = None
            if upcoming:
                fire, alarm = upcoming
                next_info = {
                    "alarmId": alarm.id,
                    "hour": alarm.hour,
                    "minute": alarm.minute,
                    "isToday": fire.date() == now.date(),
                    "dayLabel": ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][js_day(fire)],
                }

            edit = None
            if self.edit:
                edit = {k: v for k, v in self.edit.items() if k != "choices"}
                if self.edit["kind"] == "alarm":
                    edit["repeatLabel"] = self.edit["choices"][self.edit["repeat_index"]][0]

            return {
                "now": now.isoformat(timespec="seconds"),
                "nowMs": int(epoch * 1000),
                "songs": self._songs.list_songs(),
                "alarms": [a.to_dict() for a in self.alarms],
                "pomodoro": self.pomodoro.to_dict(),
                "pomodoroRuntime": self.pomodoro_rt.to_dict(),
                "timer": self.timer.to_dict(),
                "volume": self.volume,
                "device": {
                    "screen": self.screen,
                    "cursor": self.cursor,
                    "items": self._items_for_screen(),
                    "snoozeUntil": int(self.snooze_until * 1000) if self.snooze_until else None,
                    "ringingAlarmId": self.ringing_alarm_id,
                    "dismissed": dict(self.dismissed),
                    "flash": self.flash_text,
                    "nextAlarm": next_info,
                },
                "edit": edit,
                "presets": {
                    "pomodoro": POMODORO_PRESETS,
                    "timerMinutes": TIMER_PRESETS_MIN,
                },
            }
