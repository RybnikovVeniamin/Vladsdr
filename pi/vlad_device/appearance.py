"""Profile photos and app background images for the web settings UI."""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

VALID_PERSONS = frozenset({"vlad", "karina"})
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 5 * 1024 * 1024


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise ValueError(msg)


class AppearanceStore:
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.media_dir = config_dir / "media"
        self.avatars_dir = self.media_dir / "avatars"
        self.meta_path = config_dir / "appearance.json"
        self.avatars_dir.mkdir(parents=True, exist_ok=True)
        self._meta = self._load()

    def _load(self) -> dict:
        if not self.meta_path.is_file():
            return {"avatars": {}, "background": None}
        try:
            raw = json.loads(self.meta_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"avatars": {}, "background": None}
        _require(isinstance(raw, dict), "appearance metadata must be an object")
        avatars = raw.get("avatars", {})
        _require(isinstance(avatars, dict), "appearance.avatars must be an object")
        background = raw.get("background")
        _require(background is None or isinstance(background, int), "appearance.background must be int or null")
        return {"avatars": avatars, "background": background}

    def _save(self) -> None:
        self.config_dir.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self._meta, indent=2)
        fd, tmp = tempfile.mkstemp(dir=self.config_dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
            os.replace(tmp, self.meta_path)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def _avatar_path(self, person: str) -> Path | None:
        for path in self.avatars_dir.glob(f"{person}.*"):
            if path.suffix.lower() in ALLOWED_EXTENSIONS and path.is_file():
                return path
        return None

    def _background_path(self) -> Path | None:
        for path in self.media_dir.glob("background.*"):
            if path.suffix.lower() in ALLOWED_EXTENSIONS and path.is_file():
                return path
        return None

    def snapshot(self) -> dict:
        avatars = {}
        for person in ("vlad", "karina"):
            ts = self._meta["avatars"].get(person)
            avatars[person] = ts if isinstance(ts, int) and self._avatar_path(person) else None
        background = self._meta.get("background")
        if not isinstance(background, int) or self._background_path() is None:
            background = None
        return {"avatars": avatars, "background": background}

    def get_avatar_path(self, person: str) -> Path | None:
        _require(person in VALID_PERSONS, "invalid person")
        path = self._avatar_path(person)
        if path is None:
            return None
        ts = self._meta["avatars"].get(person)
        if not isinstance(ts, int):
            return None
        return path

    def get_background_path(self) -> Path | None:
        path = self._background_path()
        if path is None:
            return None
        background = self._meta.get("background")
        if not isinstance(background, int):
            return None
        return path

    def upsert_avatar(self, person: str, data: bytes, original_name: str) -> dict:
        _require(person in VALID_PERSONS, "invalid person")
        _require(len(data) <= MAX_BYTES, "image file too large (max 5 MB)")
        ext = Path(original_name).suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        _require(ext in ALLOWED_EXTENSIONS, f"unsupported image type (use {', '.join(sorted(ALLOWED_EXTENSIONS))})")

        dest = self.avatars_dir / f"{person}{ext}"
        for old in self.avatars_dir.glob(f"{person}.*"):
            if old != dest:
                old.unlink(missing_ok=True)

        fd, tmp = tempfile.mkstemp(dir=self.avatars_dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
            os.replace(tmp, dest)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

        self._meta.setdefault("avatars", {})[person] = int(time.time() * 1000)
        self._save()
        return self.snapshot()

    def delete_avatar(self, person: str) -> dict:
        _require(person in VALID_PERSONS, "invalid person")
        for path in self.avatars_dir.glob(f"{person}.*"):
            path.unlink(missing_ok=True)
        self._meta.setdefault("avatars", {}).pop(person, None)
        self._save()
        return self.snapshot()

    def upsert_background(self, data: bytes, original_name: str) -> dict:
        _require(len(data) <= MAX_BYTES, "image file too large (max 5 MB)")
        ext = Path(original_name).suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        _require(ext in ALLOWED_EXTENSIONS, f"unsupported image type (use {', '.join(sorted(ALLOWED_EXTENSIONS))})")

        dest = self.media_dir / f"background{ext}"
        for old in self.media_dir.glob("background.*"):
            if old != dest:
                old.unlink(missing_ok=True)

        fd, tmp = tempfile.mkstemp(dir=self.media_dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
            os.replace(tmp, dest)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

        self._meta["background"] = int(time.time() * 1000)
        self._save()
        return self.snapshot()

    def delete_background(self) -> dict:
        for path in self.media_dir.glob("background.*"):
            path.unlink(missing_ok=True)
        self._meta["background"] = None
        self._save()
        return self.snapshot()
