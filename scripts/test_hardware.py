#!/usr/bin/env python3
"""
Full hardware check: OLED display, knob, both buttons, and speaker.

Run on the Pi:
    python3 ~/scripts/test_hardware.py

What it checks:
  1. OLED screen — shows messages while testing
  2. Knob turn RIGHT — rotate clockwise
  3. Knob turn LEFT — rotate counter-clockwise
  4. Knob click (GPIO 22) — push the knob like a button
  5. Red button (GPIO 23) — the arcade snooze/action button
  6. Speaker — plays a short test tone through the amp
"""

import os
import shutil
import subprocess
import sys
import time

import RPi.GPIO as GPIO
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106, ssd1306
from PIL import Image, ImageDraw

CLK_PIN = 17
DT_PIN = 27
KNOB_SW_PIN = 22
RED_BUTTON_PIN = 23

# How long to wait for button/knob input during each step (seconds)
WAIT_SEC = 12


def init_display():
    serial = i2c(port=1, address=0x3C)
    try:
        device = sh1106(serial)
    except Exception:
        device = ssd1306(serial)
    device.contrast(255)
    return device


def show(device, line1, line2="", line3=""):
    image = Image.new("1", device.size, 0)
    draw = ImageDraw.Draw(image)
    draw.text((2, 2), line1[:18], fill=255)
    if line2:
        draw.text((2, 22), line2[:18], fill=255)
    if line3:
        draw.text((2, 42), line3[:18], fill=255)
    device.display(image)
    print(f"  screen: {line1} | {line2} | {line3}")


def wait_for_button(label, pin, device, hint):
    """Wait until the given GPIO button goes LOW (pressed)."""
    show(device, label, hint, f"({WAIT_SEC}s max)")
    deadline = time.monotonic() + WAIT_SEC
    last = GPIO.input(pin)
    while time.monotonic() < deadline:
        now = GPIO.input(pin)
        if last == 1 and now == 0:
            show(device, label, "OK!", "")
            print(f"  {label}: detected")
            time.sleep(0.4)
            return True
        last = now
        time.sleep(0.01)
    show(device, label, "TIMEOUT", "Try again?")
    print(f"  {label}: not detected in {WAIT_SEC}s")
    time.sleep(1)
    return False


def wait_for_knob_turn(device, want_direction):
    """Wait until the encoder moves in the requested direction."""
    label = f"Turn {want_direction.lower()}"
    show(device, label, "Rotate knob", f"({WAIT_SEC}s max)")
    deadline = time.monotonic() + WAIT_SEC
    last_clk = GPIO.input(CLK_PIN)
    while time.monotonic() < deadline:
        clk = GPIO.input(CLK_PIN)
        if clk != last_clk and clk == 0:
            direction = "RIGHT" if GPIO.input(DT_PIN) != clk else "LEFT"
            if direction == want_direction:
                show(device, label, direction, "OK!")
                print(f"  Knob turn {direction}: detected")
                time.sleep(0.4)
                return True
            show(device, label, f"Got {direction}", f"Need {want_direction}")
            print(f"  Knob turn: got {direction}, need {want_direction}")
        last_clk = clk
        time.sleep(0.001)
    show(device, label, "TIMEOUT", "")
    print(f"  Knob turn {want_direction}: not detected in {WAIT_SEC}s")
    time.sleep(1)
    return False


def check_speaker(device):
    """Try to play a short tone through the I2S amp."""
    show(device, "Speaker test", "Listen...", "")

    if shutil.which("aplay"):
        result = subprocess.run(["aplay", "-l"], capture_output=True, text=True)
        print("  Audio devices (aplay -l):")
        print(result.stdout or result.stderr or "  (none)")
        if result.returncode != 0:
            show(device, "Speaker", "NO DEVICE", "Check I2S wiring")
            return False

        wav = "/usr/share/sounds/alsa/Front_Center.wav"
        if not os.path.isfile(wav):
            # Generate a short beep with speaker-test if available
            if shutil.which("speaker-test"):
                print("  Playing test tone via speaker-test...")
                subprocess.run(
                    ["speaker-test", "-t", "sine", "-f", "880", "-l", "1", "-c", "2"],
                    timeout=8,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                show(device, "Speaker", "Tone sent", "Did you hear it?")
                return True
            show(device, "Speaker", "SKIP", "No test wav")
            return False

        print(f"  Playing {wav}...")
        play = subprocess.run(["aplay", wav], capture_output=True, text=True, timeout=10)
        if play.returncode == 0:
            show(device, "Speaker", "Played OK", "Did you hear it?")
            print("  Speaker: playback finished")
            return True
        print(f"  aplay error: {play.stderr.strip()}")
        show(device, "Speaker", "PLAY FAIL", play.stderr[:18] or "error")
        return False

    show(device, "Speaker", "SKIP", "Install alsa-utils")
    print("  Tip: sudo apt install -y alsa-utils")
    return False


def setup_gpio():
    GPIO.setmode(GPIO.BCM)
    for pin in (CLK_PIN, DT_PIN, KNOB_SW_PIN, RED_BUTTON_PIN):
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)


def main():
    results = {}

    print("\n=== Vlad device hardware test ===\n")

    print("[1/6] OLED display...")
    try:
        device = init_display()
        show(device, "Hardware test", "Starting...", "")
        results["OLED"] = True
        print("  OLED: OK\n")
    except Exception as exc:
        print(f"  OLED: FAILED — {exc}\n")
        print("  Check I2C wiring (SDA/SCL) and run: sudo raspi-config → Interface Options → I2C")
        sys.exit(1)

    setup_gpio()

    print("[2/6] Knob RIGHT — turn the knob clockwise...")
    results["Knob RIGHT"] = wait_for_knob_turn(device, "RIGHT")
    print()

    print("[3/6] Knob LEFT — turn the knob counter-clockwise...")
    results["Knob LEFT"] = wait_for_knob_turn(device, "LEFT")
    print()

    print("[4/6] Knob click — push the knob down (like a button)...")
    results["Knob click"] = wait_for_button("Knob click", KNOB_SW_PIN, device, "Push knob down")
    print()

    print("[5/6] Red button — press the arcade button...")
    results["Red button"] = wait_for_button("Red button", RED_BUTTON_PIN, device, "Press red btn")
    print()

    print("[6/6] Speaker — listen for a tone...")
    results["Speaker"] = check_speaker(device)
    time.sleep(1.5)
    print()

    passed = sum(1 for v in results.values() if v)
    total = len(results)
    summary = f"{passed}/{total} passed"
    show(device, "Test done", summary, "")

    print("=== Results ===")
    for name, ok in results.items():
        status = "OK" if ok else "FAIL"
        print(f"  {name}: {status}")
    print()

    if passed == total:
        print("All checks passed! Hardware looks good.")
    else:
        print("Some checks failed — see messages above.")
        if not results.get("Speaker"):
            print("\nSpeaker tips:")
            print("  • Wires: VIN→5V, GND→GND, BCLK→GPIO18, LRC→GPIO19, DIN→GPIO21")
            print("  • Enable I2S: sudo raspi-config → Advanced → I2S → Enable")
            print("  • Reboot after enabling I2S")

    GPIO.cleanup()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
        GPIO.cleanup()
