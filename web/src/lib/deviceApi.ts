import type { Alarm, PomodoroRuntime, PomodoroSettings, TimerState } from '@/types'

/** Mirrors GET /api/state from pi/vlad_device/server.py */
export interface DeviceApiState {
  now: string
  nowMs: number
  alarms: Alarm[]
  pomodoro: PomodoroSettings
  pomodoroRuntime: PomodoroRuntime
  timer: TimerState
  device: {
    screen: string
    cursor: number
    items: string[]
    snoozeUntil: number | null
    ringingAlarmId: string | null
    dismissed: Record<string, string>
    flash: string | null
    nextAlarm: {
      alarmId: string
      hour: number
      minute: number
      isToday: boolean
      dayLabel: string
    } | null
  }
}

export const DEFAULT_DEVICE_URL = 'http://vlad-brodyaga.local:8787'
const STORAGE_KEY = 'vlad-device-url'
const TIMEOUT_MS = 2500

const fromQuery = new URLSearchParams(window.location.search).get('device')
if (fromQuery !== null) {
  if (fromQuery === '') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, fromQuery)
}

export function getDeviceBaseUrl(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return stored.replace(/\/+$/, '')
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return DEFAULT_DEVICE_URL
  // Served from the Pi itself: talk to the same origin.
  return ''
}

export function setDeviceBaseUrl(url: string | null): void {
  if (url && url.trim()) localStorage.setItem(STORAGE_KEY, url.trim())
  else localStorage.removeItem(STORAGE_KEY)
}

async function request<T>(
  path: string,
  method: 'GET' | 'PUT' | 'POST' = 'GET',
  body?: unknown,
): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${getDeviceBaseUrl()}${path}`, {
      method,
      signal: controller.signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function fetchDeviceState(): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/state')
}

export function pushAlarms(alarms: Alarm[]): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/alarms', 'PUT', alarms)
}

export function pushPomodoroSettings(
  settings: PomodoroSettings,
): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/pomodoro', 'PUT', settings)
}

export function pushTimerDuration(durationSec: number): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/timer', 'PUT', { durationSec })
}

export type DeviceAction =
  | 'pomodoro/start'
  | 'pomodoro/pause'
  | 'pomodoro/stop'
  | 'timer/start'
  | 'timer/pause'
  | 'timer/reset'
  | 'alarm/trigger'
  | 'alarm/snooze'
  | 'alarm/dismiss'

export function sendDeviceAction(
  action: DeviceAction,
  body?: unknown,
): Promise<DeviceApiState | null> {
  return request<DeviceApiState>(`/api/${action}`, 'POST', body)
}
