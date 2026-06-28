import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ALL_DAYS,
  DAY_LABELS,
  WEEKDAYS,
  WEEKENDS,
  formatRepeatSummary,
  normalizeRepeatDays,
  repeatPresetFromDays,
} from '@/lib/alarmRepeat'
import { cn } from '@/lib/utils'

interface AlarmRepeatPickerProps {
  repeatDays: boolean[]
  onChange: (days: boolean[]) => void
}

const PRESETS = [
  { id: 'everyday' as const, label: 'Every day', days: ALL_DAYS },
  { id: 'weekdays' as const, label: 'Weekdays', days: WEEKDAYS },
  { id: 'weekends' as const, label: 'Weekends', days: WEEKENDS },
]

export function AlarmRepeatPicker({ repeatDays, onChange }: AlarmRepeatPickerProps) {
  const days = normalizeRepeatDays(repeatDays)
  const activePreset = repeatPresetFromDays(days)

  const toggleDay = (index: number) => {
    const next = [...days]
    next[index] = !next[index]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label>Repeat</Label>
        <p className="text-sm text-muted-foreground">{formatRepeatSummary(days)}</p>
      </div>

      <div className="flex justify-between gap-1">
        {DAY_LABELS.map((label, index) => {
          const selected = days[index]
          return (
            <button
              key={`${label}-${index}`}
              type="button"
              aria-label={`${label}, ${selected ? 'on' : 'off'}`}
              aria-pressed={selected}
              onClick={() => toggleDay(index)}
              className={cn(
                'flex size-10 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant={activePreset === preset.id ? 'default' : 'outline'}
            size="sm"
            className="min-h-9"
            onClick={() => onChange([...preset.days])}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
