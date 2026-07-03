import { useEffect } from 'react'
import {
  fetchDeviceState,
  pushAlarms,
  pushPomodoroSettings,
  pushTimerDuration,
} from '@/lib/deviceApi'
import { useAppStore } from '@/store/useAppStore'
import type { PomodoroSettings } from '@/types'

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
    const pending = { alarms: false, pomodoro: false, timer: false }

    const flushPush = async () => {
      pushTimeout = null
      const state = useAppStore.getState()
      const jobs: Promise<unknown>[] = []
      if (pending.alarms) {
        pending.alarms = false
        jobs.push(pushAlarms(state.alarms))
      }
      if (pending.pomodoro) {
        pending.pomodoro = false
        jobs.push(pushPomodoroSettings(state.pomodoro))
      }
      if (pending.timer) {
        pending.timer = false
        if (state.timer.durationSec > 0) {
          jobs.push(pushTimerDuration(state.timer.durationSec))
        }
      }
      if (jobs.length === 0) return
      const results = await Promise.all(jobs)
      if (!disposed && results.some((r) => r === null)) {
        useAppStore.getState().setDeviceStatus(false, null)
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
        if (Date.now() - lastLocalEditAt > LOCAL_EDIT_GRACE_MS) {
          const patch: Record<string, unknown> = {}
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
          if (Object.keys(patch).length > 0) {
            useAppStore.setState(patch)
          }
        }
        store.setDeviceStatus(true, remote)
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
