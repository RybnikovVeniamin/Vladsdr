export type Tab = 'alarm' | 'pomodoro' | 'timer' | 'upload'

export type SongCategory = 'vlad' | 'karina' | 'both'

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

export interface AlarmSettings {
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
}

export interface DeviceState {
  screen: DeviceScreen
  menuIndex: number
  snoozeUntil: number | null
  dismissedDate: string | null
}
