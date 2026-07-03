import { useEffect, useRef } from 'react'
import { formatClock, formatDurationShort } from '@/lib/format'
import { DAY_NAMES, nextAlarmOccurrence } from '@/lib/alarmRepeat'
import { useAppStore } from '@/store/useAppStore'

const W = 128
const H = 64
const SCALE = 4

interface OledScreenProps {
  className?: string
}

export function OledScreen({ className }: OledScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const alarms = useAppStore((s) => s.alarms)
  const songs = useAppStore((s) => s.songs)
  const device = useAppStore((s) => s.device)
  const pomodoroRuntime = useAppStore((s) => s.pomodoroRuntime)
  const timer = useAppStore((s) => s.timer)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'top'

    const now = new Date()
    const ringingAlarm = alarms.find((a) => a.id === device.ringingAlarmId)
    const song = songs.find((s) => s.id === ringingAlarm?.songId)

    const drawCentered = (text: string, y: number, size = 12) => {
      ctx.font = `${size}px monospace`
      const tw = ctx.measureText(text).width
      ctx.fillText(text, (W - tw) / 2, y)
    }

    const drawLine = (text: string, x: number, y: number, size = 10) => {
      ctx.font = `${size}px monospace`
      ctx.fillText(text.slice(0, 16), x, y)
    }

    switch (device.screen) {
      case 'clock': {
        drawCentered(formatClock(now.getHours(), now.getMinutes()), 8, 22)
        const upcoming = nextAlarmOccurrence(alarms, device.dismissed, now)
        if (upcoming) {
          const sameDay = upcoming.fire.toDateString() === now.toDateString()
          const day = sameDay ? '' : `${DAY_NAMES[upcoming.fire.getDay()]} `
          drawCentered(
            `ALM ${day}${formatClock(upcoming.alarm.hour, upcoming.alarm.minute)}`,
            40,
            10,
          )
        } else {
          drawCentered('NO ALARM', 40, 10)
        }
        break
      }
      case 'menu': {
        drawLine('MODE', 4, 4, 10)
        ;['Alarm', 'Pomo', 'Timer'].forEach((label, i) => {
          const prefix = i === device.menuIndex ? '>' : ' '
          drawLine(`${prefix} ${label}`, 4, 22 + i * 14, 11)
        })
        break
      }
      case 'alarm_ringing': {
        drawCentered('WAKE UP!', 6, 14)
        drawCentered(
          song?.name ??
            (ringingAlarm
              ? formatClock(ringingAlarm.hour, ringingAlarm.minute)
              : 'Alarm'),
          28,
          10,
        )
        drawCentered('red=off knob=snooze', 48, 9)
        break
      }
      case 'snoozing': {
        const left = device.snoozeUntil
          ? Math.max(0, Math.ceil((device.snoozeUntil - Date.now()) / 1000))
          : 0
        drawCentered('SNOOZE', 4, 14)
        drawCentered(formatDurationShort(left), 24, 18)
        drawCentered('red=off', 50, 9)
        break
      }
      case 'pomodoro': {
        const label =
          pomodoroRuntime.phase === 'work'
            ? 'WORK'
            : pomodoroRuntime.phase === 'long_break'
              ? 'LONG'
              : 'BREAK'
        drawCentered(label, 6, 12)
        drawCentered(formatDurationShort(pomodoroRuntime.remainingSec), 24, 20)
        const status =
          pomodoroRuntime.status === 'paused' ? 'PAUSED' : `R${pomodoroRuntime.currentRound}`
        drawCentered(status, 50, 9)
        break
      }
      case 'timer': {
        drawCentered(formatDurationShort(timer.remainingSec), 12, 22)
        drawCentered(
          timer.status === 'paused' ? 'PAUSED' : timer.status === 'done' ? 'DONE!' : 'TIMER',
          44,
          10,
        )
        break
      }
    }
  }, [alarms, device, pomodoroRuntime, songs, timer])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className={className}
      style={{
        width: W * SCALE,
        height: H * SCALE,
        imageRendering: 'pixelated',
        background: '#000',
        borderRadius: 8,
        border: '2px solid hsl(var(--border))',
      }}
    />
  )
}
