"""GPIO input watcher: KY-040 encoder + red button.

Pins (BCM, final per CLAUDE.md): CLK=17 DT=27 SW=22 RED=23.
Red button: release before 0.8 s = short press, held 0.8 s = long press.
Polling loop mirrors the approach proven in scripts/demo_actions.py.
"""

from __future__ import annotations

import threading
import time

CLK_PIN = 17
DT_PIN = 27
KNOB_SW_PIN = 22
RED_PIN = 23

LONG_PRESS_SEC = 0.8
DEBOUNCE_SEC = 0.03
POLL_SEC = 0.001


class InputWatcher(threading.Thread):
    def __init__(self, controller):
        super().__init__(daemon=True, name="inputs")
        self.controller = controller
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        import RPi.GPIO as GPIO

        GPIO.setmode(GPIO.BCM)
        for pin in (CLK_PIN, DT_PIN, KNOB_SW_PIN, RED_PIN):
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

        last_clk = GPIO.input(CLK_PIN)
        last_sw = GPIO.input(KNOB_SW_PIN)
        last_red = GPIO.input(RED_PIN)
        sw_changed_at = 0.0
        red_changed_at = 0.0
        red_pressed_at: float | None = None
        red_long_fired = False

        try:
            while not self._stop.is_set():
                now = time.monotonic()

                clk = GPIO.input(CLK_PIN)
                if clk != last_clk and clk == 0:
                    direction = 1 if GPIO.input(DT_PIN) != clk else -1
                    self.controller.knob_turn(direction)
                last_clk = clk

                sw = GPIO.input(KNOB_SW_PIN)
                if sw != last_sw and now - sw_changed_at >= DEBOUNCE_SEC:
                    sw_changed_at = now
                    if sw == 0:
                        self.controller.knob_click()
                    last_sw = sw

                red = GPIO.input(RED_PIN)
                if red != last_red and now - red_changed_at >= DEBOUNCE_SEC:
                    red_changed_at = now
                    if red == 0:
                        red_pressed_at = now
                        red_long_fired = False
                    else:
                        if red_pressed_at is not None and not red_long_fired:
                            self.controller.button_short()
                        red_pressed_at = None
                    last_red = red

                if (
                    red_pressed_at is not None
                    and not red_long_fired
                    and now - red_pressed_at >= LONG_PRESS_SEC
                ):
                    red_long_fired = True
                    self.controller.button_long()

                time.sleep(POLL_SEC)
        finally:
            GPIO.cleanup()
