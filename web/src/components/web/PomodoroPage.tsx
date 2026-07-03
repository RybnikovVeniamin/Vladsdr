import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeviceRuntimeCard } from '@/components/web/DeviceRuntimeCard'
import { SongPickerCard } from '@/components/web/SongPickerCard'
import { Stepper } from '@/components/web/Stepper'
import { VolumeControl } from '@/components/web/VolumeControl'
import { POMODORO_PRESETS } from '@/data/presets'
import { formatDuration } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'
import type { PomodoroPreset, PomodoroSettings } from '@/types'

function matchesPreset(settings: PomodoroSettings, preset: PomodoroPreset) {
  return (
    settings.workMin === preset.workMin &&
    settings.breakMin === preset.breakMin &&
    settings.longBreakMin === preset.longBreakMin &&
    settings.rounds === preset.rounds
  )
}

export function PomodoroPage() {
  const pomodoro = useAppStore((s) => s.pomodoro)
  const runtime = useAppStore((s) => s.pomodoroRuntime)
  const updateSettings = useAppStore((s) => s.updatePomodoroSettings)
  const setPomodoroSong = useAppStore((s) => s.setPomodoroSong)
  const startPomodoro = useAppStore((s) => s.startPomodoro)
  const pausePomodoro = useAppStore((s) => s.pausePomodoro)
  const stopPomodoro = useAppStore((s) => s.stopPomodoro)

  const isActive = runtime.status !== 'idle'

  const save = () => toast.success('Pomodoro settings saved')

  const applyPreset = (preset: PomodoroPreset) => {
    updateSettings({
      workMin: preset.workMin,
      breakMin: preset.breakMin,
      longBreakMin: preset.longBreakMin,
      rounds: preset.rounds,
    })
    toast.success(`${preset.label} preset applied`)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <DeviceRuntimeCard mode="pomodoro" />
      <VolumeControl compact />
      {isActive && (
        <Card className="border-primary/30 bg-primary/15">
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
          <CardTitle className="text-base">Presets</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {POMODORO_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant={matchesPreset(pomodoro, preset) ? 'default' : 'outline'}
              className="h-auto flex-col gap-0.5 py-2.5"
              onClick={() => applyPreset(preset)}
            >
              <span className="font-semibold">{preset.label}</span>
              <span className="text-xs opacity-70">
                {preset.workMin}/{preset.breakMin} ×{preset.rounds}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom settings</CardTitle>
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

      <SongPickerCard
        title="Session sound"
        emptyLabel="Default cue (spoken)"
        selectedId={pomodoro.songId ?? null}
        onSelect={(songId) => setPomodoroSong(songId)}
      />
    </div>
  )
}
