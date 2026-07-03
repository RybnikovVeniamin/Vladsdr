"""LAN HTTP API + optional static hosting of the built web app.

CORS is wide open on purpose: the device lives on the home network only and
the settings app may be served from a dev machine (localhost:5173) or from
the Pi itself.
"""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from . import __version__


def create_app(controller, webroot: Path | None = None) -> Flask:
    has_webroot = webroot is not None and (webroot / "index.html").is_file()
    app = Flask(
        "vlad_device",
        static_folder=str(webroot) if has_webroot else None,
        static_url_path="",
    )

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, PUT, POST, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    @app.route("/api/<path:_rest>", methods=["OPTIONS"])
    def cors_preflight(_rest):
        return "", 204

    @app.errorhandler(ValueError)
    def handle_value_error(error):
        return jsonify({"error": str(error)}), 400

    def state():
        return jsonify(controller.snapshot())

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "name": "vlad-brodyaga", "version": __version__})

    @app.get("/api/state")
    def get_state():
        return state()

    @app.put("/api/alarms")
    def put_alarms():
        controller.api_set_alarms(request.get_json(silent=True))
        return state()

    @app.put("/api/pomodoro")
    def put_pomodoro():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValueError("body must be a JSON object")
        controller.api_update_pomodoro(data)
        return state()

    @app.put("/api/timer")
    def put_timer():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValueError("body must be a JSON object")
        controller.api_update_timer(data)
        return state()

    @app.put("/api/volume")
    def put_volume():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValueError("body must be a JSON object")
        controller.api_set_volume(data.get("volume"))
        return state()

    @app.post("/api/pomodoro/start")
    def pomodoro_start():
        data = request.get_json(silent=True)
        if isinstance(data, dict) and data:
            controller.api_update_pomodoro(data)
        controller.api_start_pomodoro()
        return state()

    @app.post("/api/pomodoro/pause")
    def pomodoro_pause():
        controller.api_pause_pomodoro()
        return state()

    @app.post("/api/pomodoro/stop")
    def pomodoro_stop():
        controller.api_stop_pomodoro()
        return state()

    @app.post("/api/timer/start")
    def timer_start():
        data = request.get_json(silent=True)
        duration = data.get("durationSec") if isinstance(data, dict) else None
        controller.api_start_timer(duration)
        return state()

    @app.post("/api/timer/pause")
    def timer_pause():
        controller.api_pause_timer()
        return state()

    @app.post("/api/timer/reset")
    def timer_reset():
        controller.api_reset_timer()
        return state()

    @app.post("/api/alarm/trigger")
    def alarm_trigger():
        controller.api_trigger_alarm()
        return state()

    @app.post("/api/alarm/snooze")
    def alarm_snooze():
        controller.api_snooze()
        return state()

    @app.post("/api/alarm/dismiss")
    def alarm_dismiss():
        controller.api_dismiss()
        return state()

    @app.get("/api/songs")
    def get_songs():
        return jsonify(controller.api_list_songs())

    @app.post("/api/songs")
    def post_song():
        song_id = request.form.get("id", "").strip()
        name = request.form.get("name", "").strip()
        category = request.form.get("category", "both").strip()
        upload = request.files.get("file")
        if not upload or not upload.filename:
            raise ValueError("file is required")
        data = upload.read()
        songs = controller.api_upsert_song(song_id, name, category, data, upload.filename)
        return jsonify(songs)

    @app.delete("/api/songs/<song_id>")
    def delete_song(song_id: str):
        songs = controller.api_delete_song(song_id)
        return jsonify(songs)

    @app.get("/api/songs/<song_id>/audio")
    def get_song_audio(song_id: str):
        path = controller.api_song_audio_path(song_id)
        return send_from_directory(path.parent, path.name, mimetype=None, as_attachment=False)

    @app.get("/api/appearance")
    def get_appearance():
        return jsonify(controller.api_appearance())

    @app.post("/api/avatars/<person>")
    def post_avatar(person: str):
        upload = request.files.get("file")
        if not upload or not upload.filename:
            raise ValueError("file is required")
        data = upload.read()
        appearance = controller.api_upsert_avatar(person, data, upload.filename)
        return jsonify(appearance)

    @app.delete("/api/avatars/<person>")
    def delete_avatar(person: str):
        appearance = controller.api_delete_avatar(person)
        return jsonify(appearance)

    @app.get("/api/avatars/<person>")
    def get_avatar(person: str):
        path = controller.api_avatar_path(person)
        return send_from_directory(path.parent, path.name, mimetype=None, as_attachment=False)

    @app.post("/api/background")
    def post_background():
        upload = request.files.get("file")
        if not upload or not upload.filename:
            raise ValueError("file is required")
        data = upload.read()
        appearance = controller.api_upsert_background(data, upload.filename)
        return jsonify(appearance)

    @app.delete("/api/background")
    def delete_background():
        appearance = controller.api_delete_background()
        return jsonify(appearance)

    @app.get("/api/background")
    def get_background():
        path = controller.api_background_path()
        return send_from_directory(path.parent, path.name, mimetype=None, as_attachment=False)

    if has_webroot:

        @app.get("/")
        def index():
            return send_from_directory(str(webroot), "index.html")

    return app
