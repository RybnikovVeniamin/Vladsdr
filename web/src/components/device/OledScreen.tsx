import { useEffect, useRef } from 'react'
import { formatClock, formatDurationShort } from '@/lib/format'
import { DAY_NAMES, nextAlarmOccurrence } from '@/lib/alarmRepeat'
import { useAppStore } from '@/store/useAppStore'

const W = 128
const H = 64
const SCALE = 4
const LIST_ROWS = 4

interface OledScreenProps {
  className?: string
}

export function OledScreen({ className }: OledScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const alarms = useAppStore((s) => s.alarms)
  const songs = useAppStore((s) => s.songs)
  const volume = useAppStore((s) => s.volume)
  const localDevice = useAppStore((s) => s.device)
  const deviceOnline = useAppStore((s) => s.deviceOnline)
  const remote = useAppStore((s) => s.remote)
  const pomodoroRuntime = useAppStore((s) => s.pomodoroRuntime)
  const timer = useAppStore((s) => s.timer)

  const live = deviceOnline && remote
  const screen = live ? remote.device.screen : localDevice.screen
  const cursor = live ? remote.device.cursor : localDevice.menuIndex
  const items = live ? remote.device.items : []
  const ringingAlarmId = live
    ? remote.device.ringingAlarmId
    : localDevice.ringingAlarmId
  const snoozeUntil = live ? remote.device.snoozeUntil : localDevice.snoozeUntil
  const dismissed = live ? remote.device.dismissed : localDevice.dismissed
  const flash = live ? remote.device.flash : null
  const nextAlarm = live ? remote.device.nextAlarm : null
  const edit = live ? remote.edit : null
  const displayVolume = live && typeof remote.volume === 'number' ? remote.volume : volume

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
    const ringingAlarm = alarms.find((a) => a.id === ringingAlarmId)
    const song = songs.find((s) => s.id === ringingAlarm?.songId)

    const drawCentered = (text: string, y: number, size = 12) => {
      ctx.font = `${size}px monospace`
      const tw = ctx.measureText(text).width
      ctx.fillText(text, (W - tw) / 2, y)
    }

    const drawLine = (text: string, x: number, y: number, size = 10) => {
      ctx.font = `${size}px monospace`
      ctx.fillText(text.slice(0, 21), x, y)
    }

    const drawList = (header: string, listItems: string[], listCursor: number) => {
      drawLine(header, 2, 4, 9)
      if (listItems.length === 0) return
      const safeCursor = listCursor % listItems.length
      const start = Math.min(
        Math.max(0, safeCursor - LIST_ROWS + 1),
        Math.max(0, listItems.length - LIST_ROWS),
      )
      for (let row = 0; row < LIST_ROWS; row += 1) {
        const index = start + row
        if (index >= listItems.length) break
        const prefix = index === safeCursor ? '>' : ' '
        drawLine(`${prefix} ${listItems[index]}`, 2, 13 + row * 13, 11)
      }
    }

    switch (screen) {
      case 'clock': {
        drawCentered(formatClock(now.getHours(), now.getMinutes()), 8, 22)
        if (flash) {
          drawCentered(flash, 44, 12)
          break
        }
        if (nextAlarm) {
          const day = nextAlarm.isToday ? '' : `${nextAlarm.dayLabel} `
          drawCentered(
            `ALM ${day}${formatClock(nextAlarm.hour, nextAlarm.minute)}`,
            40,
            10,
          )
        } else {
          const upcoming = nextAlarmOccurrence(alarms, dismissed, now)
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
        }
        break
      }
      case 'menu': {
        const menuItems = live ? items : ['Alarm', 'Pomo', 'Timer']
        drawList('MODE', menuItems, cursor)
        break
      }
      case 'alarm_list':
        drawList('ALARMS', items, cursor)
        break
      case 'pomo_menu':
        drawList('POMODORO', items, cursor)
        break
      case 'timer_menu':
        drawList('TIMER', items, cursor)
        break
      case 'volume_edit': {
        drawLine('VOLUME', 2, 4, 9)
        const value = edit?.value ?? displayVolume
        drawCentered(`${value}%`, 18, 22)
        drawCentered('click = save', 50, 9)
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
        const left = snoozeUntil
          ? Math.max(0, Math.ceil((snoozeUntil - Date.now()) / 1000))
          : 0
        drawCentered('SNOOZE', 4, 14)
        drawCentered(formatDurationShort(left), 24, 18)
        drawCentered('red=off', 50, 9)
        break
      }
      case 'pomodoro': {
        const rt = live ? remote.pomodoroRuntime : pomodoroRuntime
        const label =
          rt.phase === 'work' ? 'WORK' : rt.phase === 'long_break' ? 'LONG' : 'BREAK'
        drawCentered(label, 6, 12)
        drawCentered(formatDurationShort(rt.remainingSec), 24, 20)
        const status =
          rt.status === 'paused' ? 'PAUSED' : `R${rt.currentRound}`
        drawCentered(status, 50, 9)
        break
      }
      case 'timer':
      case 'timer_done': {
        const t = live ? remote.timer : timer
        if (screen === 'timer_done' || t.status === 'done') {
          drawCentered('DONE!', 8, 22)
          drawCentered('press button', 44, 10)
        } else {
          drawCentered(formatDurationShort(t.remainingSec), 12, 22)
          drawCentered(t.status === 'paused' ? 'PAUSED' : 'TIMER', 44, 10)
        }
        break
      }
      default:
        drawCentered(screen, 26, 12)
        break
    }
  }, [
    alarms,
    cursor,
    dismissed,
    displayVolume,
    edit,
    flash,
    items,
    nextAlarm,
    pomodoroRuntime,
    remote,
    ringingAlarmId,
    screen,
    snoozeUntil,
    songs,
    timer,
    volume,
  ])

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
