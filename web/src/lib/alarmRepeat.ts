import { todayKey } from '@/lib/format'
import type { Alarm } from '@/types'

/** Index 0 = Sunday … 6 = Saturday (matches JavaScript Date.getDay()) */
export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const ALL_DAYS: boolean[] = [true, true, true, true, true, true, true]
export const WEEKDAYS: boolean[] = [false, true, true, true, true, true, false]
export const WEEKENDS: boolean[] = [true, false, false, false, false, false, true]

export type RepeatPreset = 'everyday' | 'weekdays' | 'weekends' | 'custom'

export function normalizeRepeatDays(days?: boolean[]): boolean[] {
  if (!days || days.length !== 7) return [...ALL_DAYS]
  return days.map(Boolean)
}

export function repeatPresetFromDays(days: boolean[]): RepeatPreset {
  const normalized = normalizeRepeatDays(days)
  if (normalized.every(Boolean)) return 'everyday'
  if (normalized.every((on, i) => on === WEEKDAYS[i])) return 'weekdays'
  if (normalized.every((on, i) => on === WEEKENDS[i])) return 'weekends'
  return 'custom'
}

export function formatRepeatSummary(days: boolean[]): string {
  const normalized = normalizeRepeatDays(days)
  const preset = repeatPresetFromDays(normalized)
  if (preset === 'everyday') return 'Every day'
  if (preset === 'weekdays') return 'Weekdays'
  if (preset === 'weekends') return 'Weekends'

  const selected = normalized
    .map((on, i) => (on ? DAY_NAMES[i] : null))
    .filter(Boolean)

  if (selected.length === 0) return 'No days selected'
  return selected.join(', ')
}

export function isAlarmDayToday(days: boolean[], date = new Date()): boolean {
  return normalizeRepeatDays(days)[date.getDay()]
}

export interface NextAlarmOccurrence {
  fire: Date
  alarm: Alarm
}

export function nextAlarmOccurrence(
  alarms: Alarm[],
  dismissed: Record<string, string>,
  now = new Date(),
): NextAlarmOccurrence | null {
  let best: NextAlarmOccurrence | null = null
  const today = todayKey()
  for (const alarm of alarms) {
    if (!alarm.enabled) continue
    const days = normalizeRepeatDays(alarm.repeatDays)
    for (let offset = 0; offset <= 7; offset++) {
      const fire = new Date(now)
      fire.setDate(now.getDate() + offset)
      fire.setHours(alarm.hour, alarm.minute, 0, 0)
      if (!days[fire.getDay()]) continue
      if (offset === 0 && (fire <= now || dismissed[alarm.id] === today)) continue
      if (!best || fire < best.fire) best = { fire, alarm }
      break
    }
  }
  return best
}
