import { useEffect } from 'react'
import {
  fetchDeviceState,
  pushAlarms,
  pushPomodoroSettings,
  pushTimerDuration,
  pushVolume,
  syncLocalSongsToDevice,
} from '@/lib/deviceApi'
import { useAppStore } from '@/store/useAppStore'
import type { PomodoroSettings, Song } from '@/types'

const POLL_MS = 3000
const LOCAL_EDIT_GRACE_MS = 3000
const PUSH_DEBOUNCE_MS = 400

function samePomodoro(a: PomodoroSettings, b: PomodoroSettings) {
  return (
    a.workMin === b.workMin &&
    a.breakMin === b.breakMin &&
    a.longBreakMin === b.longBreakMin &&
    a.rounds === b.rounds
  )
}

function songsMatch(a: Song[], b: Song[]) {
  if (a.length !== b.length) return false
  return a.every(
    (song, index) =>
      song.id === b[index]?.id &&
      song.name === b[index]?.name &&
      song.category === b[index]?.category,
  )
}

function mergeSongsFromDevice(local: Song[], remote: Song[]): Song[] {
  const localById = new Map(local.map((song) => [song.id, song]))
  return remote.map((song) => ({
    ...song,
    blobUrl: localById.get(song.id)?.blobUrl,
  }))
}

function clampVolume(value: unknown): number {
  const n = typeof value === 'number' ? Math.trunc(value) : Number.NaN
  if (Number.isNaN(n)) return 80
  return Math.min(100, Math.max(0, n))
}

/**
 * Keeps settings in sync with the Pi when it is reachable on the LAN.
 * Local edits are pushed (debounced); the device is the source of truth
 * on (re)connect, so remote changes flow back into the store.
 */
export function useDeviceSync() {
  useEffect(() => {
    let disposed = false
    let applyingRemote = false
    let lastLocalEditAt = 0
    let pushTimeout: number | null = null
    const pending = { alarms: false, pomodoro: false, timer: false, volume: false }

    const flushPush = async () => {
      pushTimeout = null
      const state = useAppStore.getState()
      const jobs: Array<{ key: keyof typeof pending; run: () => Promise<unknown> }> = []

      if (pending.alarms) {
        jobs.push({ key: 'alarms', run: () => pushAlarms(state.alarms) })
      }
      if (pending.pomodoro) {
        jobs.push({ key: 'pomodoro', run: () => pushPomodoroSettings(state.pomodoro) })
      }
      if (pending.timer && state.timer.durationSec > 0) {
        jobs.push({
          key: 'timer',
          run: () => pushTimerDuration(state.timer.durationSec),
        })
      }
      if (pending.volume) {
        jobs.push({ key: 'volume', run: () => pushVolume(state.volume) })
      }
      if (jobs.length === 0) return

      for (const job of jobs) pending[job.key] = false

      const results = await Promise.all(jobs.map((job) => job.run()))
      if (disposed) return

      let alarmsFailed = false
      results.forEach((result, index) => {
        if (result !== null) return
        const key = jobs[index].key
        pending[key] = true
        if (key === 'alarms') alarmsFailed = true
      })

      // Only a full settings push failure means the device is unreachable.
      if (alarmsFailed) {
        useAppStore.getState().setDeviceStatus(false, null)
      } else if (pending.volume && useAppStore.getState().deviceOnline) {
        pushTimeout = window.setTimeout(flushPush, PUSH_DEBOUNCE_MS)
      }
    }

    const schedulePush = () => {
      if (pushTimeout !== null) window.clearTimeout(pushTimeout)
      pushTimeout = window.setTimeout(flushPush, PUSH_DEBOUNCE_MS)
    }

    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (applyingRemote) return
      let touched = false
      if (state.alarms !== prev.alarms) {
        pending.alarms = true
        touched = true
      }
      if (state.pomodoro !== prev.pomodoro) {
        pending.pomodoro = true
        touched = true
      }
      if (state.timer.durationSec !== prev.timer.durationSec) {
        pending.timer = true
        touched = true
      }
      if (state.volume !== prev.volume) {
        pending.volume = true
        touched = true
      }
      if (touched) {
        lastLocalEditAt = Date.now()
        if (state.deviceOnline) schedulePush()
      }
    })

    const poll = async () => {
      const remote = await fetchDeviceState()
      if (disposed) return
      const store = useAppStore.getState()
      if (!remote) {
        if (store.deviceOnline || store.remote) store.setDeviceStatus(false, null)
        return
      }

      applyingRemote = true
      try {
        const remoteSongs = Array.isArray(remote.songs) ? remote.songs : []
        if (Date.now() - lastLocalEditAt > LOCAL_EDIT_GRACE_MS) {
          const patch: Record<string, unknown> = {}
          if (!songsMatch(remoteSongs, store.songs)) {
            patch.songs = mergeSongsFromDevice(store.songs, remoteSongs)
          }
          if (JSON.stringify(remote.alarms) !== JSON.stringify(store.alarms)) {
            patch.alarms = remote.alarms
          }
          if (!samePomodoro(remote.pomodoro, store.pomodoro)) {
            patch.pomodoro = { ...remote.pomodoro }
          }
          if (
            store.timer.status === 'idle' &&
            remote.timer.durationSec !== store.timer.durationSec
          ) {
            patch.timer = {
              durationSec: remote.timer.durationSec,
              remainingSec: remote.timer.durationSec,
              status: 'idle',
            }
          }
          const remoteVolume = remote.volume
          if (
            typeof remoteVolume === 'number' &&
            clampVolume(remoteVolume) !== store.volume &&
            !pending.volume
          ) {
            patch.volume = clampVolume(remoteVolume)
          }
          if (Object.keys(patch).length > 0) {
            useAppStore.setState(patch)
          }
        }
        store.setDeviceStatus(true, remote)

        if (pending.volume && !pushTimeout) {
          schedulePush()
        }

        const latest = useAppStore.getState()
        const remoteIds = new Set(remoteSongs.map((song) => song.id))
        const missingOnDevice = latest.songs.filter(
          (song) => song.blobUrl && !remoteIds.has(song.id),
        )
        if (missingOnDevice.length > 0) {
          void syncLocalSongsToDevice(missingOnDevice)
        }
      } finally {
        applyingRemote = false
      }
    }

    void poll()
    const interval = window.setInterval(poll, POLL_MS)
    return () => {
      disposed = true
      unsubscribe()
      window.clearInterval(interval)
      if (pushTimeout !== null) window.clearTimeout(pushTimeout)
    }
  }, [])
}
