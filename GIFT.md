# Vlad_brodyaga — gift guide

A short guide for the person who receives the desk alarm device. No programming
needed for everyday use.

---

## What you got

A small always-on gadget on your desk:

- **Alarm clock** — multiple alarms (weekdays, weekends, etc.)
- **Pomodoro timer** — focus sessions with breaks
- **Countdown timer** — cooking, breaks, anything
- **Tiny OLED screen** + **knob** + **red button**
- **Optional:** change settings from your **phone** on the same Wi‑Fi

The device works **by itself**. The phone app is a convenient remote — not required
to wake up or run a timer.

---

## Every day (normal use)

1. Keep the Pi **plugged in** and on your home Wi‑Fi.
2. The screen shows the **clock**. Alarms you saved are already on the device.
3. **Knob click** → menu (Alarm / Pomo / Timer).
4. **Knob turn** → move or change values. **Knob click** → select.
5. **Red button** → back / pause. **Long press red** → stop or go home.
6. **Alarm ringing:** **knob click** = snooze 5 min · **red button** = turn off.

### Phone settings (optional)

On your phone, on the **same Wi‑Fi** as the device, open:

**http://vlad-brodyaga.local:8787**

Add that to your home screen — it works like a small app.

On the **Alarm** tab you should see a green dot: **Vlad_brodyaga connected**.

Device preview (OLED simulator): **http://vlad-brodyaga.local:8787/device.html**

> **Tip:** Use `vlad-brodyaga.local`, not a number like `192.168.x.x`. The
> number changes if you move or get a new router; the name usually still works.

---

## Controls cheat sheet

| Situation | Knob turn | Knob click | Red short | Red long |
|-----------|-----------|------------|-----------|----------|
| Clock | — | Open menu | — | — |
| Menus | Move | Select | Back | Home (clock) |
| Alarm ringing | — | **Snooze 5 min** | **Turn off** | **Turn off** |
| Timer / Pomo running | — | Pause / resume | Back (keeps running) | Stop |

---

## Moving to a new apartment

You do **not** need to set everything up from scratch. Alarms and software live
on the memory card inside the Pi.

You only need to connect the Pi to the **new Wi‑Fi** once.

### Step 1 — Plug in

Power on the device. The clock may show even before Wi‑Fi is set up; alarms on
the device still work from the knob.

### Step 2 — Connect to new Wi‑Fi (one time per home)

Temporarily plug in a **USB keyboard** and **HDMI monitor or TV**:

1. Log in as **`vladsdr`** (password from the gift giver).
2. Run:

   ```bash
   sudo raspi-config
   ```

3. **1 System Options** → **S1 Wireless LAN**
4. Choose your Wi‑Fi network and enter the password.
5. **Finish**. Unplug keyboard and monitor when done.

**Alternative:** ask the person who built the device to re-flash the SD card with
[Raspberry Pi Imager](https://www.raspberrypi.com/software/) and set the new
Wi‑Fi during imaging.

### Step 3 — Open the app on your phone

Same Wi‑Fi as the device:

**http://vlad-brodyaga.local:8787**

Check the green **connected** dot on the Alarm tab.

### If the link does not open

1. On the Pi (keyboard + monitor), run: `hostname -I`
2. Use the first number shown, e.g. `http://192.168.1.42:8787`
3. On the Alarm tab, tap the **pencil** icon and save that address if needed.

---

## What you never need for daily use

| Not needed | Only for builders / fixes |
|------------|---------------------------|
| A Mac or PC every morning | SSH and Terminal |
| `localhost` or dev tools | Copying code to the Pi again |
| Internet (alarms work offline) | Rewiring the OLED or buttons |

If **autostart** was enabled on the Pi, the app starts by itself after power-on —
no Terminal session required.

---

## Limits (good to know)

- **Home Wi‑Fi only** — the phone app talks to the device on your local network,
  not over the public internet. No account or cloud in v1.
- **Same network** — phone and Pi must be on the same Wi‑Fi (normal at home).
- **Custom alarm songs** uploaded in the web app are stored in the phone browser
  for now; the device uses a voice placeholder until real speaker files are added.
- **Guest / café Wi‑Fi** — remote phone control usually will not work there; the
  physical device still works.

---

## Something wrong?

| Problem | Try this |
|---------|----------|
| Screen blank | Check power and OLED cable (gift giver / `assets/` wiring photos in repo) |
| Phone says offline | Same Wi‑Fi as Pi; try `http://vlad-brodyaga.local:8787` or IP from `hostname -I` |
| Alarms at wrong time | `sudo raspi-config` → **5 Localisation Options** → **L2 Timezone** |
| App not running after reboot | See `pi/README.md` section **Autostart on boot** (one-time setup) |

More technical detail: **`pi/README.md`** and **`CLAUDE.md`** in this repository.

---

## Links in this repo

| File | What it is |
|------|------------|
| `GIFT.md` | This file — for the person using the device |
| `FEATURES.md` | Full product feature list |
| `pi/README.md` | Deploy, API, autostart (for helpers) |
| `assets/` | Wiring photos |

**GitHub:** [github.com/RybnikovVeniamin/Vladsdr](https://github.com/RybnikovVeniamin/Vladsdr)
