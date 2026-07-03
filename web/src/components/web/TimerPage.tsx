import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeviceRuntimeCard } from '@/components/web/DeviceRuntimeCard'
import { Stepper } from '@/components/web/Stepper'
import { VolumeControl } from '@/components/web/VolumeControl'
import { TIMER_PRESET_MINUTES } from '@/data/presets'
import { formatDuration } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

export function TimerPage() {
  const timer = useAppStore((s) => s.timer)
  const setTimerDuration = useAppStore((s) => s.setTimerDuration)
  const startTimer = useAppStore((s) => s.startTimer)
  const pauseTimer = useAppStore((s) => s.pauseTimer)
  const resetTimer = useAppStore((s) => s.resetTimer)

  const minutes = Math.floor(timer.durationSec / 60)
  const seconds = timer.durationSec % 60
  const isActive = timer.status !== 'idle'

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <DeviceRuntimeCard mode="timer" />
      <VolumeControl compact />

      {isActive && (
        <Card className="border-primary/30 bg-primary/15">
          <CardContent className="flex flex-col items-center gap-2 py-8">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Timer{timer.status === 'paused' ? ' · paused' : ''}
              {timer.status === 'done' ? ' · done!' : ''}
            </p>
            <p className="text-5xl font-bold tabular-nums">
              {formatDuration(timer.remainingSec)}
            </p>
            <div className="mt-2 flex w-full gap-2">
              {timer.status !== 'done' && (
                <Button
                  className="min-h-12 flex-1"
                  variant="outline"
                  onClick={pauseTimer}
                >
                  {timer.status === 'paused' ? 'Resume' : 'Pause'}
                </Button>
              )}
              <Button
                className="min-h-12 flex-1"
                variant="destructive"
                onClick={resetTimer}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presets</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {TIMER_PRESET_MINUTES.map((m) => (
            <Button
              key={m}
              type="button"
              variant={timer.durationSec === m * 60 ? 'default' : 'outline'}
              className="min-h-11"
              onClick={() => setTimerDuration(m * 60)}
            >
              {m} min
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom duration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Stepper
            label="Minutes"
            value={minutes}
            min={0}
            max={180}
            onChange={(m) => setTimerDuration(m * 60 + seconds)}
          />
          <Stepper
            label="Seconds"
            value={seconds}
            min={0}
            max={55}
            step={5}
            onChange={(s) => setTimerDuration(minutes * 60 + s)}
          />
          {!isActive && (
            <Button
              className="min-h-12 w-full"
              disabled={timer.durationSec <= 0}
              onClick={startTimer}
            >
              Start timer
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
