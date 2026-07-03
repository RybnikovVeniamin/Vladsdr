import type { PomodoroPreset } from '@/types'

// Keep in sync with pi/vlad_device/state.py
export const POMODORO_PRESETS: PomodoroPreset[] = [
  { id: 'classic', label: 'Classic', workMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4 },
  { id: 'deep', label: 'Deep', workMin: 50, breakMin: 10, longBreakMin: 20, rounds: 3 },
  { id: 'quick', label: 'Quick', workMin: 15, breakMin: 3, longBreakMin: 10, rounds: 4 },
]

export const TIMER_PRESET_MINUTES = [1, 3, 5, 10, 15, 30]
