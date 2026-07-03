"""Data model, presets, validation and JSON persistence.

JSON field names are camelCase to stay wire-compatible with the web app
(`web/src/types.ts`). repeatDays index 0 = Sunday ... 6 = Saturday, matching
JavaScript's Date.getDay().
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

SNOOZE_SEC = 5 * 60
LONG_PRESS_SEC = 0.8

ALL_DAYS = [True] * 7
WEEKDAYS = [False, True, True, True, True, True, False]
WEEKENDS = [True, False, False, False, False, False, True]
DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

POMODORO_PRESETS = [
    {"id": "classic", "label": "Classic 25/5", "workMin": 25, "breakMin": 5, "longBreakMin": 15, "rounds": 4},
    {"id": "deep", "label": "Deep 50/10", "workMin": 50, "breakMin": 10, "longBreakMin": 20, "rounds": 3},
    {"id": "quick", "label": "Quick 15/3", "workMin": 15, "breakMin": 3, "longBreakMin": 10, "rounds": 4},
]

TIMER_PRESETS_MIN = [1, 3, 5, 10, 15, 30]

REPEAT_CHOICES = [
    ("Every day", ALL_DAYS),
    ("Weekdays", WEEKDAYS),
    ("Weekends", WEEKENDS),
]


def js_day(dt: datetime) -> int:
    """Python weekday (Mon=0) -> JS getDay (Sun=0)."""
    return (dt.weekday() + 1) % 7


def date_key(dt: datetime) -> str:
    return dt.date().isoformat()


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise ValueError(msg)


def _int_in(value, lo: int, hi: int, name: str) -> int:
    _require(isinstance(value, int) and not isinstance(value, bool), f"{name} must be an integer")
    _require(lo <= value <= hi, f"{name} must be between {lo} and {hi}")
    return value


def normalize_repeat_days(days) -> list[bool]:
    _require(isinstance(days, (list, tuple)) and len(days) == 7, "repeatDays must have 7 entries")
    return [bool(d) for d in days]


@dataclass
class Alarm:
    id: str
    enabled: bool = True
    hour: int = 7
    minute: int = 0
    repeat_days: list[bool] = field(default_factory=lambda: list(ALL_DAYS))
    song_id: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "enabled": self.enabled,
            "hour": self.hour,
            "minute": self.minute,
            "repeatDays": list(self.repeat_days),
            "songId": self.song_id,
        }

    @staticmethod
    def from_dict(data: dict, fallback_id: str) -> "Alarm":
        _require(isinstance(data, dict), "alarm must be an object")
        alarm_id = data.get("id") or fallback_id
        _require(isinstance(alarm_id, str) and alarm_id, "alarm id must be a string")
        song_id = data.get("songId")
        _require(song_id is None or isinstance(song_id, str), "songId must be a string or null")
        return Alarm(
            id=alarm_id,
            enabled=bool(data.get("enabled", True)),
            hour=_int_in(data.get("hour", 7), 0, 23, "hour"),
            minute=_int_in(data.get("minute", 0), 0, 59, "minute"),
            repeat_days=normalize_repeat_days(data.get("repeatDays", ALL_DAYS)),
            song_id=song_id,
        )


@dataclass
class PomodoroSettings:
    work_min: int = 25
    break_min: int = 5
    long_break_min: int = 15
    rounds: int = 4

    def to_dict(self) -> dict:
        return {
            "workMin": self.work_min,
            "breakMin": self.break_min,
            "longBreakMin": self.long_break_min,
            "rounds": self.rounds,
        }

    def update(self, data: dict) -> None:
        _require(isinstance(data, dict), "pomodoro settings must be an object")
        if "workMin" in data:
            self.work_min = _int_in(data["workMin"], 1, 120, "workMin")
        if "breakMin" in data:
            self.break_min = _int_in(data["breakMin"], 1, 60, "breakMin")
        if "longBreakMin" in data:
            self.long_break_min = _int_in(data["longBreakMin"], 1, 60, "longBreakMin")
        if "rounds" in data:
            self.rounds = _int_in(data["rounds"], 1, 12, "rounds")


@dataclass
class PomodoroRuntime:
    phase: str = "idle"  # idle | work | break | long_break
    remaining_sec: int = 0
    status: str = "idle"  # idle | running | paused
    current_round: int = 0

    def to_dict(self) -> dict:
        return {
            "phase": self.phase,
            "remainingSec": self.remaining_sec,
            "status": self.status,
            "currentRound": self.current_round,
        }


@dataclass
class TimerState:
    duration_sec: int = 5 * 60
    remaining_sec: int = 5 * 60
    status: str = "idle"  # idle | running | paused | done

    def to_dict(self) -> dict:
        return {
            "durationSec": self.duration_sec,
            "remainingSec": self.remaining_sec,
            "status": self.status,
        }


MAX_TIMER_SEC = 180 * 60 + 59


def validate_timer_duration(value) -> int:
    return _int_in(value, 1, MAX_TIMER_SEC, "durationSec")


def default_alarms() -> list[Alarm]:
    return [Alarm(id="alarm-1", enabled=True, hour=7, minute=30)]


def parse_alarms(data) -> list[Alarm]:
    _require(isinstance(data, list), "alarms must be a list")
    _require(len(data) <= 20, "too many alarms (max 20)")
    alarms = [Alarm.from_dict(item, f"alarm-{i + 1}") for i, item in enumerate(data)]
    ids = [a.id for a in alarms]
    _require(len(ids) == len(set(ids)), "alarm ids must be unique")
    return alarms


def next_alarm(alarms: list[Alarm], dismissed: dict[str, str], now: datetime):
    """Earliest upcoming fire time across enabled alarms within 7 days.

    Returns (fire_datetime, alarm) or None.
    """
    best: tuple[datetime, Alarm] | None = None
    today = date_key(now)
    for alarm in alarms:
        if not alarm.enabled:
            continue
        for offset in range(8):
            day = now + timedelta(days=offset)
            if not alarm.repeat_days[js_day(day)]:
                continue
            fire = day.replace(hour=alarm.hour, minute=alarm.minute, second=0, microsecond=0)
            if offset == 0:
                if fire <= now or dismissed.get(alarm.id) == today:
                    continue
            if best is None or fire < best[0]:
                best = (fire, alarm)
            break
    return best


def repeat_label(days: list[bool]) -> str:
    if all(days):
        return "daily"
    if days == WEEKDAYS:
        return "Mo-Fr"
    if days == WEEKENDS:
        return "Sa-Su"
    picked = [DAY_SHORT[i] for i, on in enumerate(days) if on]
    if not picked:
        return "never"
    return ",".join(picked)


class Persistence:
    """Loads/saves durable settings (alarms, pomodoro, timer duration)."""

    def __init__(self, path: Path):
        self.path = Path(path)

    def load(self) -> tuple[list[Alarm], PomodoroSettings, int]:
        alarms = default_alarms()
        pomodoro = PomodoroSettings()
        timer_duration = 5 * 60
        try:
            raw = json.loads(self.path.read_text())
        except (OSError, ValueError):
            return alarms, pomodoro, timer_duration
        try:
            if isinstance(raw.get("alarms"), list):
                alarms = parse_alarms(raw["alarms"])
        except ValueError:
            pass
        try:
            pomodoro.update(raw.get("pomodoro") or {})
        except ValueError:
            pass
        try:
            timer_duration = validate_timer_duration((raw.get("timer") or {}).get("durationSec"))
        except ValueError:
            pass
        return alarms, pomodoro, timer_duration

    def save(self, alarms: list[Alarm], pomodoro: PomodoroSettings, timer_duration: int) -> None:
        data = {
            "alarms": [a.to_dict() for a in alarms],
            "pomodoro": pomodoro.to_dict(),
            "timer": {"durationSec": timer_duration},
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=str(self.path.parent), prefix=".state-", suffix=".json")
        try:
            with os.fdopen(fd, "w") as fh:
                json.dump(data, fh, indent=2)
            os.replace(tmp, self.path)
        except OSError:
            try:
                os.unlink(tmp)
            except OSError:
                pass
