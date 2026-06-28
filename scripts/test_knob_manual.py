#!/usr/bin/env python3
"""
Manual knob rotation test — does not use gpiozero RotaryEncoder.
Works when the high-level encoder class fails on newer Pi OS.
"""

import time

import RPi.GPIO as GPIO

CLK_PIN = 17
DT_PIN = 27

GPIO.setmode(GPIO.BCM)
GPIO.setup(CLK_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(DT_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

print("=== Manual rotation test ===")
print(f"CLK=GPIO{CLK_PIN}, DT=GPIO{DT_PIN}")
print("Turn the knob. Ctrl+C to quit.")
print("-" * 40)

last_clk = GPIO.input(CLK_PIN)

try:
    while True:
        clk = GPIO.input(CLK_PIN)
        if clk != last_clk and clk == 0:
            if GPIO.input(DT_PIN) != clk:
                print(">>> RIGHT")
            else:
                print("<<< LEFT")
        last_clk = clk
        time.sleep(0.001)
finally:
    GPIO.cleanup()
