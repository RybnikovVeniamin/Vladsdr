import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ALL_DAYS, isAlarmDayToday, normalizeRepeatDays } from '@/lib/alarmRepeat'
import { todayKey } from '@/lib/format'
import type { DeviceApiState } from '@/lib/deviceApi'
import type {
  Alarm,
  DeviceState,
  PersonAvatars,
  PersonId,
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
  alarms: Alarm[]
  songs: Song[]
  avatars: PersonAvatars
  backgroundImage: string | null
  pomodoro: PomodoroSettings
  pomodoroRuntime: PomodoroRuntime
  timer: TimerState
  volume: number
  device: DeviceState
  deviceOnline: boolean
  remote: DeviceApiState | null

  setActiveTab: (tab: Tab) => void
  addAlarm: () => string
  updateAlarm: (id: string, patch: Partial<Omit<Alarm, 'id'>>) => void
  deleteAlarm: (id: string) => void
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void
  setTimerDuration: (durationSec: number) => void
  setVolume: (volume: number) => void

  addSong: (name: string, category: SongCategory, blobUrl: string) => string
  deleteSong: (id: string) => void
  setAvatar: (person: PersonId, dataUrl: string | null) => void
  setBackgroundImage: (dataUrl: string | null) => void

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

  setDeviceStatus: (online: boolean, remote: DeviceApiState | null) => void
}

interface PersistedStore {
  alarms: Alarm[]
  songs: Song[]
  avatars: PersonAvatars
  backgroundImage: string | null
  pomodoro: PomodoroSettings
  timer: TimerState
  volume: number
}

function defaultAvatars(): PersonAvatars {
  return { vlad: null, karina: null }
}

const defaultPomodoroRuntime: PomodoroRuntime = {
  phase: 'idle',
  remainingSec: 0,
  status: 'idle',
  currentRound: 0,
}

function initialDevice(): DeviceState {
  return {
    screen: 'clock',
    menuIndex: 0,
    snoozeUntil: null,
    ringingAlarmId: null,
    dismissed: {},
  }
}

function initialTimer(): TimerState {
  return { durationSec: 5 * 60, remainingSec: 5 * 60, status: 'idle' }
}

function defaultAlarms(): Alarm[] {
  return [
    {
      id: 'alarm-1',
      enabled: true,
      hour: 7,
      minute: 30,
      repeatDays: [...ALL_DAYS],
      songId: null,
    },
  ]
}

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.trunc(value) : Number.NaN
  if (Number.isNaN(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}

function normalizeAlarm(raw: unknown, index: number): Alarm {
  const a = (raw ?? {}) as Partial<Alarm>
  return {
    id: typeof a.id === 'string' && a.id ? a.id : `alarm-${index + 1}`,
    enabled: a.enabled !== false,
    hour: clampInt(a.hour, 0, 23, 7),
    minute: clampInt(a.minute, 0, 59, 0),
    repeatDays: normalizeRepeatDays(a.repeatDays),
    songId: typeof a.songId === 'string' ? a.songId : null,
  }
}

function withoutKey(map: Record<string, string>, key: string): Record<string, string> {
  if (!(key in map)) return map
  const next = { ...map }
  delete next[key]
  return next
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      activeTab: 'alarm',
      alarms: defaultAlarms(),
      songs: [],
      avatars: defaultAvatars(),
      backgroundImage: null,
      pomodoro: { workMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4 },
      pomodoroRuntime: { ...defaultPomodoroRuntime },
      timer: initialTimer(),
      volume: 80,
      device: initialDevice(),
      deviceOnline: false,
      remote: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      addAlarm: () => {
        const id = `alarm-${Date.now()}`
        set((s) => ({
          alarms: [
            ...s.alarms,
            {
              id,
              enabled: true,
              hour: 7,
              minute: 0,
              repeatDays: [...ALL_DAYS],
              songId: null,
            },
          ],
        }))
        return id
      },

      updateAlarm: (id, patch) =>
        set((s) => ({
          alarms: s.alarms.map((alarm) =>
            alarm.id === id
              ? {
                  ...alarm,
                  ...patch,
                  repeatDays: normalizeRepeatDays(patch.repeatDays ?? alarm.repeatDays),
                }
              : alarm,
          ),
          device: { ...s.device, dismissed: withoutKey(s.device.dismissed, id) },
        })),

      deleteAlarm: (id) =>
        set((s) => ({
          alarms: s.alarms.filter((alarm) => alarm.id !== id),
          device: {
            ...s.device,
            dismissed: withoutKey(s.device.dismissed, id),
            ...(s.device.ringingAlarmId === id
              ? { screen: 'clock' as const, ringingAlarmId: null, snoozeUntil: null }
              : {}),
          },
        })),

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

      setVolume: (volume) =>
        set({ volume: clampInt(volume, 0, 100, 80) }),

      addSong: (name, category, blobUrl) => {
        const id = `song-${Date.now()}`
        set((s) => ({
          songs: [
            ...s.songs,
            {
              id,
              name,
              category,
              blobUrl,
            },
          ],
        }))
        return id
      },

      deleteSong: (id) =>
        set((s) => ({
          songs: s.songs.filter((song) => song.id !== id),
          alarms: s.alarms.map((alarm) =>
            alarm.songId === id ? { ...alarm, songId: null } : alarm,
          ),
        })),

      setAvatar: (person, dataUrl) =>
        set((s) => ({
          avatars: { ...s.avatars, [person]: dataUrl },
        })),

      setBackgroundImage: (dataUrl) => set({ backgroundImage: dataUrl }),

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
            ringingAlarmId:
              s.alarms.find((a) => a.enabled)?.id ?? s.alarms[0]?.id ?? null,
          },
        })),

      deviceKnobTurn: (direction) => {
        const { device } = get()
        if (device.screen !== 'menu') return
        const next =
          (device.menuIndex + direction + MENU_ITEMS.length) % MENU_ITEMS.length
        set({ device: { ...device, menuIndex: next } })
      },

      // Knob click while ringing = snooze (rotating button snoozes).
      deviceKnobClick: () => {
        const state = get()
        const { device, pomodoroRuntime, timer } = state

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

      // Red button while ringing/snoozing = turn the alarm off.
      deviceButtonShort: () => {
        const state = get()
        const { device } = state

        if (device.screen === 'alarm_ringing' || device.screen === 'snoozing') {
          dismissRinging(set, device)
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
          dismissRinging(set, device)
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
        const { alarms, device, pomodoro, pomodoroRuntime, timer } = state

        // Snooze expiry -> ring again
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

        // Alarm fire check (per alarm, per-day dismissal)
        if (device.screen === 'clock') {
          const today = todayKey()
          const firing = alarms.find(
            (alarm) =>
              alarm.enabled &&
              isAlarmDayToday(alarm.repeatDays, now) &&
              alarm.hour === now.getHours() &&
              alarm.minute === now.getMinutes() &&
              device.dismissed[alarm.id] !== today,
          )
          if (firing) {
            set({
              device: {
                ...device,
                screen: 'alarm_ringing',
                snoozeUntil: null,
                ringingAlarmId: firing.id,
              },
            })
          }
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
                ...get().device,
                screen:
                  get().device.screen === 'timer' ? 'clock' : get().device.screen,
              },
            })
          } else {
            set({ timer: { ...timer, remainingSec: remaining } })
          }
        }
      },

      setDeviceStatus: (online, remote) =>
        set({ deviceOnline: online, remote }),
    }),
    {
      name: 'vlad-brodyaga-store',
      version: 5,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        if (!Array.isArray(p.alarms) && p.alarm && typeof p.alarm === 'object') {
          p.alarms = [{ id: 'alarm-1', songId: null, ...(p.alarm as object) }]
        }
        delete p.alarm
        delete p.device
        delete p.pomodoroRuntime
        if (version < 2 && !p.avatars) {
          p.avatars = defaultAvatars()
        }
        if (version < 3 && p.backgroundImage === undefined) {
          p.backgroundImage = null
        }
        if (version < 4) {
          if (Array.isArray(p.songs)) {
            p.songs = (p.songs as Song[]).filter((song) => !song.id.startsWith('seed-'))
          }
          if (Array.isArray(p.alarms)) {
            p.alarms = (p.alarms as Alarm[]).map((alarm) =>
              alarm.songId?.startsWith('seed-') ? { ...alarm, songId: null } : alarm,
            )
          }
        }
        if (version < 5 && p.volume === undefined) {
          p.volume = 80
        }
        return p as unknown as PersistedStore
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedStore>
        const alarms = Array.isArray(saved.alarms)
          ? saved.alarms.map(normalizeAlarm)
          : current.alarms
        const durationSec = clampInt(
          saved.timer?.durationSec,
          1,
          180 * 60 + 59,
          current.timer.durationSec,
        )
        return {
          ...current,
          alarms,
          songs: Array.isArray(saved.songs) ? saved.songs : current.songs,
          avatars: saved.avatars ?? current.avatars,
          backgroundImage:
            saved.backgroundImage !== undefined
              ? saved.backgroundImage
              : current.backgroundImage,
          pomodoro: { ...current.pomodoro, ...saved.pomodoro },
          volume: clampInt(saved.volume, 0, 100, current.volume),
          timer: { durationSec, remainingSec: durationSec, status: 'idle' },
        }
      },
      partialize: (s): PersistedStore => ({
        alarms: s.alarms,
        songs: s.songs,
        avatars: s.avatars,
        backgroundImage: s.backgroundImage,
        pomodoro: s.pomodoro,
        volume: s.volume,
        timer: {
          durationSec: s.timer.durationSec,
          remainingSec: s.timer.durationSec,
          status: 'idle' as RunStatus,
        },
      }),
    },
  ),
)

function dismissRinging(
  set: (partial: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void,
  device: DeviceState,
) {
  set((s) => ({
    device: {
      ...s.device,
      screen: 'clock',
      snoozeUntil: null,
      ringingAlarmId: null,
      dismissed: device.ringingAlarmId
        ? { ...s.device.dismissed, [device.ringingAlarmId]: todayKey() }
        : s.device.dismissed,
    },
  }))
}

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
