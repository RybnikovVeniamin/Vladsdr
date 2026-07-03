import { useEffect } from 'react'
import {
  avatarDeviceUrl,
  backgroundDeviceUrl,
  type AppearanceState,
} from '@/lib/appearanceUrls'
import {
  deleteAvatarOnDevice,
  deleteBackgroundOnDevice,
  fetchDeviceState,
  fetchImageAsDataUrl,
  pushAlarms,
  pushPomodoroSettings,
  pushTimer,
  pushVolume,
  syncLocalAppearanceToDevice,
  syncLocalSongsToDevice,
  uploadAvatarToDevice,
  uploadBackgroundToDevice,
} from '@/lib/deviceApi'
import { useAppStore } from '@/store/useAppStore'
import type { AppearanceVersions, PersonId, PomodoroSettings, Song } from '@/types'

const POLL_MS = 3000
const LOCAL_EDIT_GRACE_MS = 3000
const PUSH_DEBOUNCE_MS = 400
const PERSONS: PersonId[] = ['vlad', 'karina']

function samePomodoro(a: PomodoroSettings, b: PomodoroSettings) {
  return (
    a.workMin === b.workMin &&
    a.breakMin === b.breakMin &&
    a.longBreakMin === b.longBreakMin &&
    a.rounds === b.rounds &&
    (a.songId ?? null) === (b.songId ?? null)
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

function normalizeAppearance(remote: unknown): AppearanceState {
  const raw = (remote ?? {}) as Partial<AppearanceState>
  const avatars = (raw.avatars ?? {}) as Partial<Record<PersonId, number | null>>
  return {
    avatars: {
      vlad: typeof avatars.vlad === 'number' ? avatars.vlad : null,
      karina: typeof avatars.karina === 'number' ? avatars.karina : null,
    },
    background: typeof raw.background === 'number' ? raw.background : null,
  }
}

function appearanceVersionsFromRemote(remote: AppearanceState): AppearanceVersions {
  return {
    avatars: { ...remote.avatars },
    background: remote.background,
  }
}

async function pullAppearanceFromDevice(
  remote: AppearanceState,
  localVersions: AppearanceVersions,
  localAvatars: Record<PersonId, string | null>,
  localBackground: string | null,
): Promise<{
  avatars?: Record<PersonId, string | null>
  backgroundImage?: string | null
  appearanceVersions?: AppearanceVersions
}> {
  const patch: {
    avatars?: Record<PersonId, string | null>
    backgroundImage?: string | null
    appearanceVersions?: AppearanceVersions
  } = {}
  const nextAvatars = { ...localAvatars }
  let avatarsChanged = false

  for (const person of PERSONS) {
    const remoteTs = remote.avatars[person]
    const localTs = localVersions.avatars[person]
    if (remoteTs && remoteTs !== localTs) {
      const dataUrl = await fetchImageAsDataUrl(avatarDeviceUrl(person, remoteTs))
      if (dataUrl) {
        nextAvatars[person] = dataUrl
        avatarsChanged = true
      }
    } else if (!remoteTs && (localAvatars[person] || localTs)) {
      nextAvatars[person] = null
      avatarsChanged = true
    }
  }

  if (avatarsChanged) patch.avatars = nextAvatars

  const remoteBg = remote.background
  const localBgTs = localVersions.background
  if (remoteBg && remoteBg !== localBgTs) {
    const dataUrl = await fetchImageAsDataUrl(backgroundDeviceUrl(remoteBg))
    if (dataUrl) patch.backgroundImage = dataUrl
  } else if (!remoteBg && (localBackground || localBgTs)) {
    patch.backgroundImage = null
  }

  const nextVersions = appearanceVersionsFromRemote(remote)
  if (
    nextVersions.avatars.vlad !== localVersions.avatars.vlad ||
    nextVersions.avatars.karina !== localVersions.avatars.karina ||
    nextVersions.background !== localVersions.background
  ) {
    patch.appearanceVersions = nextVersions
  }

  return patch
}

async function pushAppearanceToDevice(
  avatars: Record<PersonId, string | null>,
  backgroundImage: string | null,
  remote: AppearanceState,
): Promise<AppearanceVersions | null> {
  let latest = { ...remote }

  for (const person of PERSONS) {
    const local = avatars[person]
    const onDevice = latest.avatars[person]
    if (local && !onDevice) {
      const sent = await uploadAvatarToDevice(person, local)
      if (sent) latest = sent
    } else if (!local && onDevice) {
      const sent = await deleteAvatarOnDevice(person)
      if (sent) latest = sent
    } else if (local && onDevice) {
      const sent = await uploadAvatarToDevice(person, local)
      if (sent) latest = sent
    }
  }

  if (backgroundImage && !latest.background) {
    const sent = await uploadBackgroundToDevice(backgroundImage)
    if (sent) latest = sent
  } else if (!backgroundImage && latest.background) {
    const sent = await deleteBackgroundOnDevice()
    if (sent) latest = sent
  } else if (backgroundImage && latest.background) {
    const sent = await uploadBackgroundToDevice(backgroundImage)
    if (sent) latest = sent
  }

  return appearanceVersionsFromRemote(latest)
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
    const pending = {
      alarms: false,
      pomodoro: false,
      timer: false,
      volume: false,
      appearance: false,
    }

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
          run: () => pushTimer(state.timer.durationSec, state.timer.songId ?? null),
        })
      }
      if (pending.volume) {
        jobs.push({ key: 'volume', run: () => pushVolume(state.volume) })
      }
      if (pending.appearance) {
        jobs.push({
          key: 'appearance',
          run: async () => {
            const remote = normalizeAppearance(state.remote?.appearance)
            const versions = await pushAppearanceToDevice(
              state.avatars,
              state.backgroundImage,
              remote,
            )
            if (versions) state.setAppearanceVersions(versions)
          },
        })
      }
      if (jobs.length === 0) return

      for (const job of jobs) pending[job.key] = false

      const results = await Promise.all(jobs.map((job) => job.run()))
      if (disposed) return

      let alarmsFailed = false
      results.forEach((result, index) => {
        const key = jobs[index].key
        if (key === 'appearance') return
        if (result !== null) return
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
      if (
        state.timer.durationSec !== prev.timer.durationSec ||
        (state.timer.songId ?? null) !== (prev.timer.songId ?? null)
      ) {
        pending.timer = true
        touched = true
      }
      if (state.volume !== prev.volume) {
        pending.volume = true
        touched = true
      }
      if (state.avatars !== prev.avatars || state.backgroundImage !== prev.backgroundImage) {
        pending.appearance = true
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
        const remoteAppearance = normalizeAppearance(remote.appearance)
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
            (remote.timer.durationSec !== store.timer.durationSec ||
              (remote.timer.songId ?? null) !== (store.timer.songId ?? null))
          ) {
            patch.timer = {
              durationSec: remote.timer.durationSec,
              remainingSec: remote.timer.durationSec,
              status: 'idle',
              songId: remote.timer.songId ?? null,
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

          const appearancePatch = await pullAppearanceFromDevice(
            remoteAppearance,
            store.appearanceVersions,
            store.avatars,
            store.backgroundImage,
          )
          Object.assign(patch, appearancePatch)

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

        void syncLocalAppearanceToDevice(
          latest.avatars,
          latest.backgroundImage,
          remoteAppearance,
        )
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
