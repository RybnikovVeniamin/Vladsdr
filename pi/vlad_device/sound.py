"""Sound placeholder: espeak voice until the buzzer + MAX98357A speaker are wired.

Swap the internals of Ringer for buzzer/speaker playback later; the
Controller only relies on start(kind) / stop() / say(text).
"""

from __future__ import annotations

import shutil
import subprocess
import threading

PHRASES = {
    "alarm": "Wake up! Wake up!",
    "timer": "Timer finished",
}

INTERVAL_SEC = 2.5
TIMER_MAX_CYCLES = 30  # stop beeping after ~75 s; the DONE screen stays up


class Ringer:
    def __init__(self, enabled: bool = True):
        self._cmd = next((c for c in ("espeak-ng", "espeak") if shutil.which(c)), None)
        self._enabled = enabled and self._cmd is not None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def _speak_blocking(self, text: str) -> None:
        if not self._enabled:
            return
        subprocess.run(
            [self._cmd, "-a", "200", "-s", "140", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    def say(self, text: str) -> None:
        if not self._enabled:
            print(f"[sound] {text}")
            return
        subprocess.Popen(
            [self._cmd, "-a", "200", "-s", "140", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def start(self, kind: str) -> None:
        with self._lock:
            self._stop_locked()
            phrase = PHRASES.get(kind, "Alert")
            max_cycles = TIMER_MAX_CYCLES if kind == "timer" else None
            self._stop = threading.Event()
            stop = self._stop

            def loop() -> None:
                cycles = 0
                while not stop.is_set():
                    self._speak_blocking(phrase)
                    cycles += 1
                    if max_cycles is not None and cycles >= max_cycles:
                        return
                    stop.wait(INTERVAL_SEC)

            print(f"[sound] ring start: {kind}")
            self._thread = threading.Thread(target=loop, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        with self._lock:
            self._stop_locked()

    def _stop_locked(self) -> None:
        if self._thread is not None:
            self._stop.set()
            self._thread = None
            print("[sound] ring stop")
