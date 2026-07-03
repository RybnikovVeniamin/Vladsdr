"""Song library: metadata JSON + audio files on disk."""

from __future__ import annotations

import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}
MAX_BYTES = 20 * 1024 * 1024
SAFE_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")
VALID_CATEGORIES = {"vlad", "karina", "both"}


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise ValueError(msg)


@dataclass
class Song:
    id: str
    name: str
    category: str

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "category": self.category}


class SongLibrary:
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.songs_dir = config_dir / "songs"
        self.meta_path = config_dir / "songs.json"
        self.songs_dir.mkdir(parents=True, exist_ok=True)
        self._songs: list[Song] = self._load()

    def _load(self) -> list[Song]:
        if not self.meta_path.is_file():
            return []
        try:
            raw = json.loads(self.meta_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
        _require(isinstance(raw, list), "songs metadata must be a list")
        songs: list[Song] = []
        for entry in raw:
            _require(isinstance(entry, dict), "each song must be an object")
            song_id = entry.get("id")
            name = entry.get("name")
            category = entry.get("category", "both")
            _require(isinstance(song_id, str) and SAFE_ID.match(song_id), "invalid song id")
            _require(isinstance(name, str) and name.strip(), "song name required")
            _require(category in VALID_CATEGORIES, "invalid song category")
            if self._file_for_id(song_id) is None:
                continue
            songs.append(Song(id=song_id, name=name.strip(), category=category))
        return songs

    def _save(self) -> None:
        self.config_dir.mkdir(parents=True, exist_ok=True)
        payload = json.dumps([s.to_dict() for s in self._songs], indent=2)
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

    def _file_for_id(self, song_id: str) -> Path | None:
        for path in self.songs_dir.glob(f"{song_id}.*"):
            if path.suffix.lower() in ALLOWED_EXTENSIONS and path.is_file():
                return path
        return None

    def list_songs(self) -> list[dict]:
        return [s.to_dict() for s in self._songs]

    def get_audio_path(self, song_id: str | None) -> Path | None:
        if not song_id:
            return None
        return self._file_for_id(song_id)

    def upsert(self, song_id: str, name: str, category: str, data: bytes, original_name: str) -> Song:
        _require(SAFE_ID.match(song_id), "invalid song id")
        _require(isinstance(name, str) and name.strip(), "song name required")
        _require(category in VALID_CATEGORIES, "invalid song category")
        _require(len(data) <= MAX_BYTES, "song file too large (max 20 MB)")
        ext = Path(original_name).suffix.lower()
        _require(ext in ALLOWED_EXTENSIONS, f"unsupported audio type (use {', '.join(sorted(ALLOWED_EXTENSIONS))})")

        dest = self.songs_dir / f"{song_id}{ext}"
        for old in self.songs_dir.glob(f"{song_id}.*"):
            if old != dest:
                old.unlink(missing_ok=True)

        fd, tmp = tempfile.mkstemp(dir=self.songs_dir, suffix=".tmp")
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

        song = Song(id=song_id, name=name.strip(), category=category)
        self._songs = [s for s in self._songs if s.id != song_id] + [song]
        self._save()
        return song

    def delete(self, song_id: str) -> None:
        _require(SAFE_ID.match(song_id), "invalid song id")
        for path in self.songs_dir.glob(f"{song_id}.*"):
            path.unlink(missing_ok=True)
        self._songs = [s for s in self._songs if s.id != song_id]
        self._save()
