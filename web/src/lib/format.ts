import type { Song } from '@/types'

export function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

export function formatClock(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`
}

export function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${pad2(m)}:${pad2(s)}`
}

export function formatDurationShort(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}:${pad2(rm)}:${pad2(s)}`
  }
  return `${m}:${pad2(s)}`
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function songsForCategory(songs: Song[], category: 'vlad' | 'karina') {
  return songs.filter(
    (s) => s.category === category || s.category === 'both',
  )
}
