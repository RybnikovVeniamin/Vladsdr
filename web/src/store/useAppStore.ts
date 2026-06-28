import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seedSongs } from '@/data/seedSongs'
import { ALL_DAYS, isAlarmDayToday, normalizeRepeatDays } from '@/lib/alarmRepeat'
import { todayKey } from '@/lib/format'
import type {
  AlarmSettings,
  DeviceScreen,
  DeviceState,
  PomodoroRuntime,
  PomodoroSettings,
  RunStatus,
  Song,
  SongCategory,
  Tab,
  TimerState,
} from '@/types'

const MENU_ITEMS = ['Alarm', 'Pomo', 'Timer'] as const
const SNOOZE_SEC = 5 * 60

interface AppStore {
  activeTab: Tab
  alarm: AlarmSettings
  songs: Song[]
  pomodoro: PomodoroSettings
  pomodoroRuntime: PomodoroRuntime
  timer: TimerState
  device: DeviceState

  setActiveTab: (tab: Tab) => void
  setAlarmEnabled: (enabled: boolean) => void
  setAlarmTime: (hour: number, minute: number) => void
  setAlarmRepeatDays: (repeatDays: boolean[]) => void
  setAlarmSong: (songId: string) => void
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void
  setTimerDuration: (durationSec: number) => void

  addSong: (name: string, category: SongCategory, blobUrl: string) => void
  deleteSong: (id: string) => void

  startPomodoro: () => void
  pausePomodoro: () => void
  stopPomodoro: () => void
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void

  deviceKnobTurn: (direction: 1 | -1) => void
  deviceKnobClick: () => void
  deviceButtonShort: () => void
  deviceButtonLong: () => void
  triggerAlarmNow: () => void
  tick: () => void
}

const defaultPomodoroRuntime: PomodoroRuntime = {
  phase: 'idle',
  remainingSec: 0,
  status: 'idle',
  currentRound: 0,
}

function initialTimer(): TimerState {
  return { durationSec: 5 * 60, remainingSec: 5 * 60, status: 'idle' }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      activeTab: 'alarm',
      alarm: {
        enabled: true,
        hour: 7,
        minute: 30,
        repeatDays: [...ALL_DAYS],
        songId: seedSongs[0]?.id ?? null,
      },
      songs: seedSongs,
      pomodoro: { workMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4 },
      pomodoroRuntime: { ...defaultPomodoroRuntime },
      timer: initialTimer(),
      device: {
        screen: 'clock',
        menuIndex: 0,
        snoozeUntil: null,
        dismissedDate: null,
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      setAlarmEnabled: (enabled) =>
        set((s) => ({ alarm: { ...s.alarm, enabled } })),

      setAlarmTime: (hour, minute) =>
        set((s) => ({
          alarm: { ...s.alarm, hour, minute },
          device: { ...s.device, dismissedDate: null },
        })),

      setAlarmRepeatDays: (repeatDays) =>
        set((s) => ({
          alarm: { ...s.alarm, repeatDays: normalizeRepeatDays(repeatDays) },
          device: { ...s.device, dismissedDate: null },
        })),

      setAlarmSong: (songId) =>
        set((s) => ({ alarm: { ...s.alarm, songId } })),

      updatePomodoroSettings: (settings) =>
        set((s) => ({ pomodoro: { ...s.pomodoro, ...settings } })),

      setTimerDuration: (durationSec) =>
        set((s) => ({
          timer: {
            ...s.timer,
            durationSec,
            remainingSec: durationSec,
            status: 'idle',
          },
        })),

      addSong: (name, category, blobUrl) =>
        set((s) => ({
          songs: [
            ...s.songs,
            {
              id: `song-${Date.now()}`,
              name,
              category,
              blobUrl,
            },
          ],
        })),

      deleteSong: (id) =>
        set((s) => ({
          songs: s.songs.filter((song) => song.id !== id),
          alarm: {
            ...s.alarm,
            songId: s.alarm.songId === id ? null : s.alarm.songId,
          },
        })),

      startPomodoro: () => {
        const { pomodoro } = get()
        set({
          pomodoroRuntime: {
            phase: 'work',
            remainingSec: pomodoro.workMin * 60,
            status: 'running',
            currentRound: 1,
          },
          device: { ...get().device, screen: 'pomodoro' },
        })
      },

      pausePomodoro: () =>
        set((s) => ({
          pomodoroRuntime: {
            ...s.pomodoroRuntime,
            status:
              s.pomodoroRuntime.status === 'running' ? 'paused' : 'running',
          },
        })),

      stopPomodoro: () =>
        set((s) => ({
          pomodoroRuntime: { ...defaultPomodoroRuntime },
          device: {
            ...s.device,
            screen: s.device.screen === 'pomodoro' ? 'clock' : s.device.screen,
          },
        })),

      startTimer: () => {
        const { timer } = get()
        set({
          timer: {
            ...timer,
            remainingSec: timer.durationSec,
            status: 'running',
          },
          device: { ...get().device, screen: 'timer' },
        })
      },

      pauseTimer: () =>
        set((s) => ({
          timer: {
            ...s.timer,
            status: s.timer.status === 'running' ? 'paused' : 'running',
          },
        })),

      resetTimer: () =>
        set((s) => ({
          timer: {
            ...s.timer,
            remainingSec: s.timer.durationSec,
            status: 'idle',
          },
          device: {
            ...s.device,
            screen: s.device.screen === 'timer' ? 'clock' : s.device.screen,
          },
        })),

      triggerAlarmNow: () =>
        set((s) => ({
          device: {
            ...s.device,
            screen: 'alarm_ringing',
            snoozeUntil: null,
          },
        })),

      deviceKnobTurn: (direction) => {
        const { device } = get()
        if (device.screen !== 'menu') return
        const next =
          (device.menuIndex + direction + MENU_ITEMS.length) % MENU_ITEMS.length
        set({ device: { ...device, menuIndex: next } })
      },

      deviceKnobClick: () => {
        const state = get()
        const { device, pomodoroRuntime, timer } = state

        if (device.screen === 'clock') {
          set({ device: { ...device, screen: 'menu', menuIndex: 0 } })
          return
        }

        if (device.screen === 'menu') {
          const item = MENU_ITEMS[device.menuIndex]
          if (item === 'Pomo' && pomodoroRuntime.status === 'idle') {
            get().startPomodoro()
          } else if (item === 'Timer' && timer.status === 'idle') {
            get().startTimer()
          } else if (item === 'Alarm') {
            set({ device: { ...device, screen: 'clock' } })
          }
          return
        }
      },

      deviceButtonShort: () => {
        const state = get()
        const { device } = state

        if (device.screen === 'alarm_ringing') {
          set({
            device: {
              ...device,
              screen: 'snoozing',
              snoozeUntil: Date.now() + SNOOZE_SEC * 1000,
            },
          })
          return
        }

        if (device.screen === 'pomodoro') {
          get().pausePomodoro()
          return
        }

        if (device.screen === 'timer') {
          get().pauseTimer()
          return
        }

        if (device.screen === 'menu') {
          const item = MENU_ITEMS[device.menuIndex]
          if (item === 'Pomo') get().startPomodoro()
          if (item === 'Timer') get().startTimer()
        }
      },

      deviceButtonLong: () => {
        const state = get()
        const { device } = state

        if (device.screen === 'alarm_ringing' || device.screen === 'snoozing') {
          set({
            device: {
              ...device,
              screen: 'clock',
              snoozeUntil: null,
              dismissedDate: todayKey(),
            },
          })
          return
        }

        if (device.screen === 'pomodoro') {
          get().stopPomodoro()
          return
        }

        if (device.screen === 'timer') {
          get().resetTimer()
          return
        }

        if (device.screen === 'menu') {
          set({ device: { ...device, screen: 'clock' } })
        }
      },

      tick: () => {
        const state = get()
        const now = new Date()
        const nowMs = Date.now()
        const { alarm, device, pomodoro, pomodoroRuntime, timer } = state

        // Snooze expiry
        if (
          device.screen === 'snoozing' &&
          device.snoozeUntil &&
          nowMs >= device.snoozeUntil
        ) {
          set({
            device: {
              ...device,
              screen: 'alarm_ringing',
              snoozeUntil: null,
            },
          })
          return
        }

        // Alarm fire check
        if (
          alarm.enabled &&
          isAlarmDayToday(alarm.repeatDays, now) &&
          device.screen === 'clock' &&
          device.dismissedDate !== todayKey() &&
          now.getHours() === alarm.hour &&
          now.getMinutes() === alarm.minute &&
          now.getSeconds() === 0
        ) {
          set({
            device: {
              ...device,
              screen: 'alarm_ringing',
              snoozeUntil: null,
            },
          })
        }

        // Pomodoro countdown
        if (
          pomodoroRuntime.status === 'running' &&
          pomodoroRuntime.remainingSec > 0
        ) {
          const remaining = pomodoroRuntime.remainingSec - 1
          if (remaining <= 0) {
            advancePomodoroPhase(set, get, pomodoro, pomodoroRuntime)
          } else {
            set({
              pomodoroRuntime: {
                ...pomodoroRuntime,
                remainingSec: remaining,
              },
            })
          }
        }

        // Timer countdown
        if (timer.status === 'running' && timer.remainingSec > 0) {
          const remaining = timer.remainingSec - 1
          if (remaining <= 0) {
            set({
              timer: { ...timer, remainingSec: 0, status: 'done' },
              device: {
                ...device,
                screen: device.screen === 'timer' ? 'clock' : device.screen,
              },
            })
          } else {
            set({ timer: { ...timer, remainingSec: remaining } })
          }
        }
      },
    }),
    {
      name: 'vlad-brodyaga-store',
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppStore>
        return {
          ...current,
          ...saved,
          alarm: {
            ...current.alarm,
            ...saved.alarm,
            repeatDays: normalizeRepeatDays(saved.alarm?.repeatDays),
          },
        }
      },
      partialize: (s) => ({
        alarm: s.alarm,
        songs: s.songs,
        pomodoro: s.pomodoro,
        timer: {
          durationSec: s.timer.durationSec,
          remainingSec: s.timer.durationSec,
          status: 'idle' as RunStatus,
        },
        pomodoroRuntime: defaultPomodoroRuntime,
        device: {
          screen: 'clock' as DeviceScreen,
          menuIndex: 0,
          snoozeUntil: null,
          dismissedDate: null,
        },
      }),
    },
  ),
)

function advancePomodoroPhase(
  set: (partial: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void,
  get: () => AppStore,
  pomodoro: PomodoroSettings,
  runtime: PomodoroRuntime,
) {
  const device = get().device

  if (runtime.phase === 'work') {
    const isLongBreak = runtime.currentRound >= pomodoro.rounds
    set({
      pomodoroRuntime: {
        phase: isLongBreak ? 'long_break' : 'break',
        remainingSec: (isLongBreak ? pomodoro.longBreakMin : pomodoro.breakMin) * 60,
        status: 'running',
        currentRound: runtime.currentRound,
      },
    })
    return
  }

  if (runtime.phase === 'break' || runtime.phase === 'long_break') {
    if (runtime.phase === 'long_break') {
      set({
        pomodoroRuntime: { ...defaultPomodoroRuntime },
        device: { ...device, screen: 'clock' },
      })
      return
    }
    set({
      pomodoroRuntime: {
        phase: 'work',
        remainingSec: pomodoro.workMin * 60,
        status: 'running',
        currentRound: runtime.currentRound + 1,
      },
    })
  }
}
