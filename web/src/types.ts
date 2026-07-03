export type Tab = 'alarm' | 'pomodoro' | 'timer' | 'upload'

export type SongCategory = 'vlad' | 'karina' | 'both'

export type PersonId = 'vlad' | 'karina'

export interface PersonAvatars {
  vlad: string | null
  karina: string | null
}

/** Device-side timestamps — used to know when to re-download synced photos. */
export interface AppearanceVersions {
  avatars: Record<PersonId, number | null>
  background: number | null
}

export type DeviceScreen =
  | 'clock'
  | 'menu'
  | 'alarm_ringing'
  | 'snoozing'
  | 'pomodoro'
  | 'timer'

export type RunStatus = 'idle' | 'running' | 'paused' | 'done'

export type PomodoroPhase = 'idle' | 'work' | 'break' | 'long_break'

export interface Song {
  id: string
  name: string
  category: SongCategory
  blobUrl?: string
}

export interface Alarm {
  id: string
  enabled: boolean
  hour: number
  minute: number
  /** Index 0 = Sunday … 6 = Saturday */
  repeatDays: boolean[]
  songId: string | null
}

export interface PomodoroSettings {
  workMin: number
  breakMin: number
  longBreakMin: number
  rounds: number
  /** Custom sound played on phase changes / completion; null = spoken cue. */
  songId?: string | null
}

export interface PomodoroPreset extends PomodoroSettings {
  id: string
  label: string
}

export interface PomodoroRuntime {
  phase: PomodoroPhase
  remainingSec: number
  status: RunStatus
  currentRound: number
}

export interface TimerState {
  durationSec: number
  remainingSec: number
  status: RunStatus
  /** Custom sound played when the timer finishes; null = default beep/voice. */
  songId?: string | null
}

export interface DeviceState {
  screen: DeviceScreen
  menuIndex: number
  snoozeUntil: number | null
  ringingAlarmId: string | null
  /** alarmId -> YYYY-MM-DD of the day it was turned off */
  dismissed: Record<string, string>
}
