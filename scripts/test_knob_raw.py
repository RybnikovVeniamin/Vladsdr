#!/usr/bin/env python3
"""
Raw KY-040 diagnostic — watches GPIO 17 (CLK) and 27 (DT) directly.
If turning the knob prints lines here, wiring is OK and we fix software next.
If nothing prints, the problem is power or wires on the module.
"""

import time

from gpiozero import DigitalInputDevice

CLK_PIN = 17
DT_PIN = 27

clk = DigitalInputDevice(CLK_PIN, pull_up=True)
dt = DigitalInputDevice(DT_PIN, pull_up=True)

print("=== KY-040 raw pin test ===")
print(f"CLK = GPIO {CLK_PIN},  DT = GPIO {DT_PIN}")
print()
print(f"At rest:  CLK={clk.value}  DT={dt.value}  (both should be 1)")
print()
print("Turn the knob SLOWLY, one click at a time.")
print("You should see CLK/DT values change below.")
print("Ctrl+C to quit.")
print("-" * 40)

last_clk = clk.value
last_dt = dt.value
changes = 0

while True:
    c = clk.value
    d = dt.value
    if c != last_clk or d != last_dt:
        changes += 1
        print(f"  change #{changes}:  CLK={c}  DT={d}")
        last_clk = c
        last_dt = d
    time.sleep(0.002)
