"""Alarm/timer audio: speaker playback for songs, espeak fallback otherwise."""

from __future__ import annotations

import shutil
import subprocess
import threading
import time
from pathlib import Path

from .state import DEFAULT_VOLUME, MAX_VOLUME, MIN_VOLUME

PHRASES = {
    "alarm": "Wake up! Wake up!",
    "timer": "Timer finished",
}

INTERVAL_SEC = 2.5
TIMER_MAX_CYCLES = 30  # stop beeping after ~75 s; the DONE screen stays up


def _clamp_volume(volume: int) -> int:
    return max(MIN_VOLUME, min(MAX_VOLUME, int(volume)))


def _player_cmd(path: Path, volume: int) -> list[str] | None:
    ext = path.suffix.lower()
    volume = _clamp_volume(volume)
    if shutil.which("ffplay"):
        return [
            "ffplay",
            "-nodisp",
            "-autoexit",
            "-loglevel",
            "quiet",
            "-volume",
            str(volume),
            str(path),
        ]
    if ext == ".wav" and shutil.which("aplay"):
        return ["aplay", "-q", str(path)]
    if ext == ".mp3" and shutil.which("mpg123"):
        return ["mpg123", "-q", "-g", str(volume), str(path)]
    return None


class Ringer:
    def __init__(self, enabled: bool = True, volume: int = DEFAULT_VOLUME):
        self._espeak = next((c for c in ("espeak-ng", "espeak") if shutil.which(c)), None)
        self._enabled = enabled
        self._volume = _clamp_volume(volume)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._proc: subprocess.Popen | None = None
        self._lock = threading.Lock()

    def set_volume(self, volume: int) -> None:
        self._volume = _clamp_volume(volume)

    def _espeak_amplitude(self) -> str:
        return str(int(self._volume * 200 / MAX_VOLUME))

    def _speak_blocking(self, text: str) -> None:
        if not self._enabled:
            return
        if not self._espeak:
            print(f"[sound] {text}")
            return
        subprocess.run(
            [self._espeak, "-a", self._espeak_amplitude(), "-s", "140", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    def _play_file_blocking(self, path: Path) -> bool:
        cmd = _player_cmd(path, self._volume)
        if not cmd:
            return False
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except OSError:
            return False
        self._proc = proc
        try:
            while proc.poll() is None:
                if self._stop.is_set():
                    proc.terminate()
                    try:
                        proc.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    return True
                time.sleep(0.05)
            return True
        finally:
            self._proc = None

    def say(self, text: str) -> None:
        if not self._enabled:
            print(f"[sound] {text}")
            return
        if not self._espeak:
            print(f"[sound] {text}")
            return
        subprocess.Popen(
            [self._espeak, "-a", self._espeak_amplitude(), "-s", "140", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def notify(self, text: str, *, song_path: Path | str | None = None) -> None:
        """One-shot cue: play the given song once if present, else speak `text`.

        Used for pomodoro phase changes — fire-and-forget, does not loop and
        does not disturb an active alarm/timer ring.
        """
        if not self._enabled:
            print(f"[sound] {text}")
            return
        path = Path(song_path) if song_path else None
        if path and path.is_file():
            cmd = _player_cmd(path, self._volume)
            if cmd:
                try:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return
                except OSError:
                    pass
        self.say(text)

    def start(self, kind: str, *, song_path: Path | str | None = None) -> None:
        with self._lock:
            self._stop_locked()
            phrase = PHRASES.get(kind, "Alert")
            max_cycles = TIMER_MAX_CYCLES if kind == "timer" else None
            audio_path = Path(song_path) if song_path else None
            self._stop = threading.Event()
            stop = self._stop

            def loop() -> None:
                cycles = 0
                while not stop.is_set():
                    played = False
                    if audio_path and audio_path.is_file():
                        played = self._play_file_blocking(audio_path)
                    if not played:
                        self._speak_blocking(phrase)
                    cycles += 1
                    if max_cycles is not None and cycles >= max_cycles:
                        return
                    stop.wait(INTERVAL_SEC)

            label = f"{kind}" + (f" file={audio_path.name}" if audio_path else " espeak")
            print(f"[sound] ring start: {label} vol={self._volume}")
            self._thread = threading.Thread(target=loop, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        with self._lock:
            self._stop_locked()

    def _stop_locked(self) -> None:
        if self._thread is not None:
            self._stop.set()
            if self._proc is not None:
                self._proc.terminate()
                try:
                    self._proc.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    self._proc.kill()
                self._proc = None
            self._thread = None
            print("[sound] ring stop")
