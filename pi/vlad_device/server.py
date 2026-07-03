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
        response.headers["Access-Control-Allow-Methods"] = "GET, PUT, POST, OPTIONS"
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
        controller.api_set_timer_duration(data.get("durationSec"))
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

    if has_webroot:

        @app.get("/")
        def index():
            return send_from_directory(str(webroot), "index.html")

    return app
