#!/usr/bin/env python3
"""
Demo: OLED + voice for knob turn, knob push, and snooze button.
Run on Pi:  python3 demo_actions.py
"""

import shutil
import subprocess
import sys
import threading
import time

import RPi.GPIO as GPIO
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106, ssd1306
from PIL import Image, ImageDraw

CLK_PIN = 17
DT_PIN = 27
KNOB_SW_PIN = 22
SNOOZE_PIN = 23
VOICE_COOLDOWN_SEC = 0.4
VOICE_AMPLITUDE = 200  # espeak volume: 0–200 (200 = loudest)

_lock = threading.Lock()
_last_voice_time = 0.0
_step_count = 0
VOICE_CMD = next((c for c in ("espeak-ng", "espeak") if shutil.which(c)), None)


def speak(text):
    global _last_voice_time
    now = time.monotonic()
    if now - _last_voice_time < VOICE_COOLDOWN_SEC:
        return
    _last_voice_time = now
    print(f"[voice] {text}")
    if VOICE_CMD:
        subprocess.Popen(
            [VOICE_CMD, "-a", str(VOICE_AMPLITUDE), "-s", "140", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def init_display():
    serial = i2c(port=1, address=0x3C)
    try:
        device = sh1106(serial)
    except Exception:
        device = ssd1306(serial)
    device.contrast(255)
    return device


def show_screen(device, title, subtitle=""):
    with _lock:
        image = Image.new("1", device.size, 0)
        draw = ImageDraw.Draw(image)
        draw.text((2, 4), title[:16], fill=255)
        if subtitle:
            draw.text((2, 28), subtitle[:16], fill=255)
        device.display(image)
    print(f"[screen] {title} | {subtitle}")


def report(device, title, subtitle, say):
    show_screen(device, title, subtitle)
    speak(say)


def on_knob_click(device):
    report(device, "Knob push", "SELECT", "Select")


def on_snooze(device):
    report(device, "Snooze btn", "PRESSED", "Snooze")


def on_turn(device, direction):
    global _step_count
    _step_count += 1 if direction == "RIGHT" else -1
    show_screen(device, f"Turn {direction}", f"Value: {_step_count}")
    speak("Right" if direction == "RIGHT" else "Left")


def pressed(now, last):
    """True on falling edge: button just pushed."""
    return now == 0 and last == 1


def watch_inputs(device):
    GPIO.setmode(GPIO.BCM)
    for pin in (CLK_PIN, DT_PIN, KNOB_SW_PIN, SNOOZE_PIN):
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    last_clk = GPIO.input(CLK_PIN)
    last_sw = GPIO.input(KNOB_SW_PIN)
    last_snooze = GPIO.input(SNOOZE_PIN)

    try:
        while True:
            clk = GPIO.input(CLK_PIN)
            if clk != last_clk and clk == 0:
                on_turn(device, "RIGHT" if GPIO.input(DT_PIN) != clk else "LEFT")
            last_clk = clk

            sw = GPIO.input(KNOB_SW_PIN)
            if pressed(sw, last_sw):
                on_knob_click(device)
            last_sw = sw

            snooze = GPIO.input(SNOOZE_PIN)
            if pressed(snooze, last_snooze):
                on_snooze(device)
            last_snooze = snooze

            time.sleep(0.001)
    finally:
        GPIO.cleanup()


def main():
    if not VOICE_CMD:
        print("Tip: sudo apt install -y espeak-ng")

    device = init_display()
    report(device, "Vlad device", "Ready", "Ready")
    print("Turn knob / push knob / press snooze. Ctrl+C to quit.")

    try:
        watch_inputs(device)
    except KeyboardInterrupt:
        print("\nStopped.")
        report(device, "Goodbye", "", "Goodbye")


if __name__ == "__main__":
    main()
