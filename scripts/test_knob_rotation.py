#!/usr/bin/env python3
"""Test KY-040 rotary encoder rotation only (CLK=GPIO17, DT=GPIO27)."""

from gpiozero import RotaryEncoder
from signal import pause

CLK_PIN = 17
DT_PIN = 27

encoder = RotaryEncoder(a=CLK_PIN, b=DT_PIN, max_steps=0)


def on_rotate():
    if encoder.steps > 0:
        print(">>> RIGHT")
    else:
        print("<<< LEFT")
    encoder.steps = 0


encoder.when_rotated = on_rotate

print(f"Knob rotation test (CLK=GPIO{CLK_PIN}, DT=GPIO{DT_PIN})")
print("Turn the knob. Ctrl+C to quit.")
pause()
