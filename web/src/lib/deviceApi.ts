import type { Alarm, PersonId, PomodoroRuntime, PomodoroSettings, Song, SongCategory, TimerState } from '@/types'
import type { AppearanceState } from '@/lib/appearanceUrls'

/** Mirrors GET /api/state from pi/vlad_device/server.py */
export interface DeviceApiState {
  now: string
  nowMs: number
  appearance?: AppearanceState
  songs: Song[]
  alarms: Alarm[]
  pomodoro: PomodoroSettings
  pomodoroRuntime: PomodoroRuntime
  timer: TimerState
  volume?: number
  edit?: {
    kind?: string
    value?: number
    field?: string
    hour?: number
    minute?: number
    repeatLabel?: string
    enabled?: boolean
    work?: number
    break?: number
    long?: number
    rounds?: number
    min?: number
    sec?: number
  } | null
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

async function requestForm<T>(path: string, form: FormData): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${getDeviceBaseUrl()}${path}`, {
      method: 'POST',
      signal: controller.signal,
      body: form,
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

export function songAudioUrl(songId: string): string {
  return `${getDeviceBaseUrl()}/api/songs/${encodeURIComponent(songId)}/audio`
}

export function uploadSongToDevice(
  id: string,
  name: string,
  category: SongCategory,
  file: Blob,
  filename = 'song.mp3',
): Promise<Song[] | null> {
  const form = new FormData()
  form.append('id', id)
  form.append('name', name)
  form.append('category', category)
  form.append('file', file, filename)
  return requestForm<Song[]>('/api/songs', form)
}

export function deleteSongOnDevice(id: string): Promise<Song[] | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(`${getDeviceBaseUrl()}/api/songs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal: controller.signal,
  })
    .then((response) => (response.ok ? (response.json() as Promise<Song[]>) : null))
    .catch(() => null)
    .finally(() => clearTimeout(timeout))
}

export async function syncLocalSongsToDevice(songs: Song[]): Promise<void> {
  for (const song of songs) {
    if (!song.blobUrl) continue
    try {
      const blob = await fetch(song.blobUrl).then((r) => r.blob())
      const ext = extensionForAudioBlob(blob)
      await uploadSongToDevice(song.id, song.name, song.category, blob, `${song.id}${ext}`)
    } catch {
      // skip failed uploads; next poll will retry
    }
  }
}

function extensionForAudioBlob(blob: Blob): string {
  const type = blob.type.toLowerCase()
  if (type.includes('wav')) return '.wav'
  if (type.includes('mpeg') || type.includes('mp3')) return '.mp3'
  if (type.includes('mp4') || type.includes('m4a')) return '.m4a'
  if (type.includes('ogg')) return '.ogg'
  if (type.includes('flac')) return '.flac'
  if (type.includes('aac')) return '.aac'
  return '.mp3'
}

export function pushPomodoroSettings(
  settings: PomodoroSettings,
): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/pomodoro', 'PUT', settings)
}

export function pushTimerDuration(durationSec: number): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/timer', 'PUT', { durationSec })
}

export function pushVolume(volume: number): Promise<DeviceApiState | null> {
  return request<DeviceApiState>('/api/volume', 'PUT', { volume })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function extensionForImageBlob(blob: Blob): string {
  const type = blob.type.toLowerCase()
  if (type.includes('png')) return '.png'
  if (type.includes('webp')) return '.webp'
  if (type.includes('gif')) return '.gif'
  return '.jpg'
}

export function uploadAvatarToDevice(
  person: PersonId,
  dataUrl: string,
): Promise<AppearanceState | null> {
  const blob = dataUrlToBlob(dataUrl)
  const form = new FormData()
  form.append('file', blob, `${person}${extensionForImageBlob(blob)}`)
  return requestForm<AppearanceState>(`/api/avatars/${person}`, form)
}

export function deleteAvatarOnDevice(person: PersonId): Promise<AppearanceState | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(`${getDeviceBaseUrl()}/api/avatars/${person}`, {
    method: 'DELETE',
    signal: controller.signal,
  })
    .then((response) => (response.ok ? (response.json() as Promise<AppearanceState>) : null))
    .catch(() => null)
    .finally(() => clearTimeout(timeout))
}

export function uploadBackgroundToDevice(dataUrl: string): Promise<AppearanceState | null> {
  const blob = dataUrlToBlob(dataUrl)
  const form = new FormData()
  form.append('file', blob, `background${extensionForImageBlob(blob)}`)
  return requestForm<AppearanceState>('/api/background', form)
}

export function deleteBackgroundOnDevice(): Promise<AppearanceState | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(`${getDeviceBaseUrl()}/api/background`, {
    method: 'DELETE',
    signal: controller.signal,
  })
    .then((response) => (response.ok ? (response.json() as Promise<AppearanceState>) : null))
    .catch(() => null)
    .finally(() => clearTimeout(timeout))
}

export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function syncLocalAppearanceToDevice(
  avatars: Record<PersonId, string | null>,
  backgroundImage: string | null,
  remote: AppearanceState | null | undefined,
): Promise<void> {
  const remoteAvatars = remote?.avatars ?? { vlad: null, karina: null }
  const persons: PersonId[] = ['vlad', 'karina']
  for (const person of persons) {
    const local = avatars[person]
    if (local && !remoteAvatars[person]) {
      await uploadAvatarToDevice(person, local)
    }
  }
  if (backgroundImage && !remote?.background) {
    await uploadBackgroundToDevice(backgroundImage)
  }
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
