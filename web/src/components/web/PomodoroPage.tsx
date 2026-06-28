import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Stepper } from '@/components/web/Stepper'
import { formatDuration } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

export function PomodoroPage() {
  const pomodoro = useAppStore((s) => s.pomodoro)
  const runtime = useAppStore((s) => s.pomodoroRuntime)
  const updateSettings = useAppStore((s) => s.updatePomodoroSettings)
  const startPomodoro = useAppStore((s) => s.startPomodoro)
  const pausePomodoro = useAppStore((s) => s.pausePomodoro)
  const stopPomodoro = useAppStore((s) => s.stopPomodoro)

  const isActive = runtime.status !== 'idle'

  const save = () => toast.success('Pomodoro settings saved')

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      {isActive && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-2 py-8">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {runtime.phase === 'work'
                ? 'Focus'
                : runtime.phase === 'long_break'
                  ? 'Long break'
                  : 'Break'}
              {runtime.status === 'paused' ? ' · paused' : ''}
            </p>
            <p className="text-5xl font-bold tabular-nums">
              {formatDuration(runtime.remainingSec)}
            </p>
            <p className="text-sm text-muted-foreground">
              Round {runtime.currentRound} of {pomodoro.rounds}
            </p>
            <div className="mt-2 flex w-full gap-2">
              <Button
                className="min-h-12 flex-1"
                variant="outline"
                onClick={pausePomodoro}
              >
                {runtime.status === 'paused' ? 'Resume' : 'Pause'}
              </Button>
              <Button
                className="min-h-12 flex-1"
                variant="destructive"
                onClick={stopPomodoro}
              >
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Stepper
            label="Work"
            value={pomodoro.workMin}
            min={1}
            max={120}
            onChange={(workMin) => updateSettings({ workMin })}
          />
          <Stepper
            label="Break"
            value={pomodoro.breakMin}
            min={1}
            max={60}
            onChange={(breakMin) => updateSettings({ breakMin })}
          />
          <Stepper
            label="Long break"
            value={pomodoro.longBreakMin}
            min={1}
            max={60}
            onChange={(longBreakMin) => updateSettings({ longBreakMin })}
          />
          <Stepper
            label="Rounds"
            value={pomodoro.rounds}
            min={1}
            max={12}
            onChange={(rounds) => updateSettings({ rounds })}
          />
          <Button className="min-h-12 w-full" variant="secondary" onClick={save}>
            Save settings
          </Button>
          {!isActive && (
            <Button className="min-h-12 w-full" onClick={startPomodoro}>
              Start session
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
