"""Entry point. Run on the Pi from the pi/ directory:

    python3 -m vlad_device.main

Options:
    --no-hardware   run without OLED/GPIO (API + logic only; works on a Mac)
    --no-sound      disable the espeak ring placeholder
    --port 8787     HTTP port
"""

from __future__ import annotations

import argparse
import threading
import time
from pathlib import Path

from .controller import Controller
from .server import create_app
from .sound import Ringer

DEFAULT_PORT = 8787
DEFAULT_STATE = Path.home() / ".config" / "vlad-device" / "state.json"
DEFAULT_WEBROOT = Path(__file__).resolve().parent.parent / "webroot"


def tick_loop(controller: Controller, stop: threading.Event) -> None:
    while not stop.is_set():
        controller.tick()
        time.sleep(0.1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Vlad Brodyaga desk device")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--state-file", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--webroot", type=Path, default=DEFAULT_WEBROOT)
    parser.add_argument("--no-hardware", action="store_true", help="run without OLED/GPIO")
    parser.add_argument("--no-sound", action="store_true", help="disable espeak sounds")
    args = parser.parse_args()

    controller = Controller(args.state_file, ringer=Ringer(enabled=not args.no_sound))
    stop = threading.Event()

    threads = [threading.Thread(target=tick_loop, args=(controller, stop), daemon=True, name="tick")]
    watcher = None
    display = None
    if not args.no_hardware:
        from .display import Display
        from .inputs import InputWatcher

        display = Display(controller)
        watcher = InputWatcher(controller)
        threads.extend([display, watcher])

    for thread in threads:
        thread.start()

    app = create_app(controller, webroot=args.webroot)
    print(f"Vlad Brodyaga device backend on http://{args.host}:{args.port}")
    print(f"State file: {args.state_file}")
    try:
        app.run(host=args.host, port=args.port, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        if watcher:
            watcher.stop()
        if display:
            display.stop()
        controller.ringer.stop()
        time.sleep(0.2)


if __name__ == "__main__":
    main()
