import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface StepperProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  /** Compact: no outer border, for nesting inside a mixed control */
  compact?: boolean
  hideLabel?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function Stepper({
  label,
  value,
  min = 1,
  max = 999,
  step = 1,
  onChange,
  compact,
  hideLabel,
}: StepperProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      setDraft(String(value))
      return
    }
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) {
      setDraft(String(value))
      return
    }
    const next = clamp(n, min, max)
    onChange(next)
    setDraft(String(next))
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4',
        compact ? 'gap-2' : 'rounded-lg border p-4',
      )}
    >
      {!hideLabel && (
        <Label className={cn('text-base', compact && 'text-sm text-muted-foreground')}>
          {label}
        </Label>
      )}

      <div className={cn('flex items-center', compact ? 'gap-1.5' : 'gap-2')}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={compact ? 'size-10' : 'size-11'}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step, min, max))}
        >
          <Minus className="size-4" />
        </Button>

        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(draft)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className={cn(
            'h-11 text-center text-lg font-semibold tabular-nums',
            compact ? 'w-12 px-1' : 'w-16 px-2',
          )}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={compact ? 'size-10' : 'size-11'}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step, min, max))}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}