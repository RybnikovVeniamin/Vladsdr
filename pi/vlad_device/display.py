"""OLED rendering for the 128x64 SSD1306/SH1106 display.

Paints Controller.snapshot(); redraws only when the frame actually changes
to keep I2C traffic low.
"""

from __future__ import annotations

import threading
import time

from PIL import Image, ImageDraw, ImageFont

W, H = 128, 64
LIST_ROWS = 4

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _font(size: int):
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def format_short(total_sec: int) -> str:
    total_sec = max(0, int(total_sec))
    m, s = divmod(total_sec, 60)
    if m >= 60:
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


class Renderer:
    """Hardware-independent frame builder (unit-testable off the Pi)."""

    def __init__(self):
        self.big = _font(24)
        self.mid = _font(18)
        self.med = _font(12)
        self.small = _font(11)
        self.tiny = _font(9)

    def _center(self, draw, text, y, font):
        w = draw.textbbox((0, 0), text, font=font)[2]
        x = max(0, (W - w) // 2)
        draw.text((x, y), text, font=font, fill=255)
        return x, w

    def render(self, snap: dict) -> Image.Image:
        image = Image.new("1", (W, H), 0)
        draw = ImageDraw.Draw(image)
        screen = snap["device"]["screen"]
        painter = getattr(self, f"_paint_{screen}", None)
        if painter:
            painter(draw, snap)
        else:
            self._center(draw, screen, 26, self.med)
        return image

    # ---------------------------------------------------------------- clock

    def _paint_clock(self, draw, snap):
        now = snap["now"]  # ISO string
        hhmm = now[11:16]
        self._center(draw, hhmm, 8, self.big)

        marks = []
        if snap["pomodoroRuntime"]["status"] != "idle":
            marks.append(f"P {format_short(snap['pomodoroRuntime']['remainingSec'])}")
        if snap["timer"]["status"] in ("running", "paused"):
            marks.append(f"T {format_short(snap['timer']['remainingSec'])}")
        if marks:
            draw.text((2, 1), "  ".join(marks)[:20], font=self.tiny, fill=255)

        flash = snap["device"].get("flash")
        if flash:
            self._center(draw, flash, 44, self.med)
            return

        upcoming = snap["device"].get("nextAlarm")
        if upcoming:
            day = "" if upcoming["isToday"] else f"{upcoming['dayLabel']} "
            line = f"ALM {day}{upcoming['hour']:02d}:{upcoming['minute']:02d}"
        else:
            line = "NO ALARM"
        self._center(draw, line, 46, self.med)

    # ---------------------------------------------------------------- lists

    def _paint_list(self, draw, snap, header):
        draw.text((2, 1), header, font=self.tiny, fill=255)
        items = snap["device"]["items"]
        cursor = snap["device"]["cursor"]
        if not items:
            return
        cursor = cursor % len(items)
        start = min(max(0, cursor - LIST_ROWS + 1), max(0, len(items) - LIST_ROWS))
        for row, index in enumerate(range(start, min(len(items), start + LIST_ROWS))):
            prefix = ">" if index == cursor else " "
            draw.text(
                (2, 13 + row * 13),
                f"{prefix} {items[index]}"[:21],
                font=self.small,
                fill=255,
            )

    def _paint_menu(self, draw, snap):
        self._paint_list(draw, snap, "MODE")

    def _paint_alarm_list(self, draw, snap):
        self._paint_list(draw, snap, "ALARMS")

    def _paint_pomo_menu(self, draw, snap):
        self._paint_list(draw, snap, "POMODORO")

    def _paint_timer_menu(self, draw, snap):
        self._paint_list(draw, snap, "TIMER")

    # ---------------------------------------------------------------- edits

    def _underline_time(self, draw, text, y, font, part):
        x, _ = self._center(draw, text, y, font)
        if part is None:
            return
        left, right = (0, 2) if part == "first" else (3, 5)
        prefix_w = draw.textbbox((0, 0), text[:left], font=font)[2] if left else 0
        part_w = draw.textbbox((0, 0), text[left:right], font=font)[2]
        bbox = draw.textbbox((0, 0), text, font=font)
        underline_y = y + bbox[3] + 2
        draw.line(
            (x + prefix_w, underline_y, x + prefix_w + part_w, underline_y),
            fill=255,
            width=2,
        )

    def _paint_alarm_edit(self, draw, snap):
        edit = snap.get("edit") or {}
        field = edit.get("field", "hour")
        headers = {
            "hour": "ALARM: HOUR",
            "minute": "ALARM: MINUTE",
            "repeat": "ALARM: REPEAT",
            "enabled": "ON/OFF - SAVE",
        }
        draw.text((2, 1), headers.get(field, "ALARM"), font=self.tiny, fill=255)
        time_text = f"{edit.get('hour', 0):02d}:{edit.get('minute', 0):02d}"
        part = {"hour": "first", "minute": "second"}.get(field)
        self._underline_time(draw, time_text, 13, self.mid, part)

        repeat = edit.get("repeatLabel", "")
        prefix = "> " if field == "repeat" else "  "
        draw.text((4, 40), f"{prefix}{repeat}"[:21], font=self.small, fill=255)

        state = "ON" if edit.get("enabled") else "OFF"
        prefix = "> " if field == "enabled" else "  "
        draw.text((4, 52), f"{prefix}Alarm {state}", font=self.small, fill=255)

    def _paint_pomo_edit(self, draw, snap):
        edit = snap.get("edit") or {}
        field = edit.get("field", "work")
        headers = {
            "work": "POMO: WORK MIN",
            "break": "POMO: BREAK MIN",
            "long": "POMO: LONG BREAK",
            "rounds": "ROUNDS - START",
        }
        draw.text((2, 1), headers.get(field, "POMO"), font=self.tiny, fill=255)
        self._center(draw, str(edit.get(field, "")), 16, self.big)
        summary = (
            f"{edit.get('work', '?')}/{edit.get('break', '?')}"
            f"/{edit.get('long', '?')} x{edit.get('rounds', '?')}"
        )
        self._center(draw, summary, 50, self.tiny)

    def _paint_timer_edit(self, draw, snap):
        edit = snap.get("edit") or {}
        field = edit.get("field", "min")
        header = "TIMER: MINUTES" if field == "min" else "SECONDS - START"
        draw.text((2, 1), header, font=self.tiny, fill=255)
        text = f"{edit.get('min', 0):02d}:{edit.get('sec', 0):02d}"
        part = "first" if field == "min" else "second"
        self._underline_time(draw, text, 18, self.big, part)
        flash = snap["device"].get("flash")
        if flash:
            self._center(draw, flash, 52, self.tiny)

    def _paint_volume_edit(self, draw, snap):
        edit = snap.get("edit") or {}
        draw.text((2, 1), "VOLUME", font=self.tiny, fill=255)
        self._center(draw, f"{edit.get('value', 0)}%", 18, self.big)
        self._center(draw, "click = save", 50, self.tiny)

    # -------------------------------------------------------------- running

    def _paint_pomodoro(self, draw, snap):
        rt = snap["pomodoroRuntime"]
        label = {"work": "WORK", "break": "BREAK", "long_break": "LONG"}.get(rt["phase"], "POMO")
        self._center(draw, label, 2, self.med)
        self._center(draw, format_short(rt["remainingSec"]), 18, self.big)
        rounds = snap["pomodoro"]["rounds"]
        footer = "PAUSED" if rt["status"] == "paused" else f"R{rt['currentRound']}/{rounds}"
        self._center(draw, footer, 50, self.small)

    def _paint_timer(self, draw, snap):
        timer = snap["timer"]
        self._center(draw, format_short(timer["remainingSec"]), 10, self.big)
        footer = "PAUSED" if timer["status"] == "paused" else "TIMER"
        self._center(draw, footer, 46, self.small)

    def _paint_timer_done(self, draw, snap):
        self._center(draw, "DONE!", 8, self.big)
        self._center(draw, "press button", 44, self.small)

    # -------------------------------------------------------------- ringing

    def _paint_alarm_ringing(self, draw, snap):
        self._center(draw, "WAKE UP!", 4, self.mid)
        alarm = next(
            (a for a in snap["alarms"] if a["id"] == snap["device"]["ringingAlarmId"]),
            None,
        )
        if alarm:
            song = next(
                (s for s in snap.get("songs", []) if s["id"] == alarm.get("songId")),
                None,
            )
            line = song["name"][:16] if song else f"{alarm['hour']:02d}:{alarm['minute']:02d}"
            self._center(draw, line, 26, self.med)
        self._center(draw, "red=off knob=snooze", 52, self.tiny)

    def _paint_snoozing(self, draw, snap):
        self._center(draw, "SNOOZE", 2, self.med)
        snooze_until = snap["device"].get("snoozeUntil")
        left = max(0, (snooze_until - snap["nowMs"]) // 1000) if snooze_until else 0
        self._center(draw, format_short(int(left)), 18, self.big)
        self._center(draw, "red=off", 52, self.tiny)


class Display(threading.Thread):
    def __init__(self, controller):
        super().__init__(daemon=True, name="display")
        self.controller = controller
        self.renderer = Renderer()
        self._stop = threading.Event()

        from luma.core.interface.serial import i2c
        from luma.oled.device import sh1106, ssd1306

        serial = i2c(port=1, address=0x3C)
        try:
            self.device = sh1106(serial)
        except Exception:
            self.device = ssd1306(serial)
        self.device.contrast(255)

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        last_frame = None
        while not self._stop.is_set():
            image = self.renderer.render(self.controller.snapshot())
            frame = image.tobytes()
            if frame != last_frame:
                self.device.display(image)
                last_frame = frame
            time.sleep(0.1)
