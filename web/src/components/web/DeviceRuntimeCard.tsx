import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { sendDeviceAction, type DeviceAction } from '@/lib/deviceApi'
import { formatDuration } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

interface DeviceRuntimeCardProps {
  mode: 'pomodoro' | 'timer'
}

const PHASE_LABELS: Record<string, string> = {
  work: 'Focus',
  break: 'Break',
  long_break: 'Long break',
}

/** Live view + controls for what is running on the physical device. */
export function DeviceRuntimeCard({ mode }: DeviceRuntimeCardProps) {
  const online = useAppStore((s) => s.deviceOnline)
  const remote = useAppStore((s) => s.remote)
  const pomodoro = useAppStore((s) => s.pomodoro)
  const timerDuration = useAppStore((s) => s.timer.durationSec)
  const setDeviceStatus = useAppStore((s) => s.setDeviceStatus)

  if (!online || !remote) return null

  const act = async (action: DeviceAction, body?: unknown) => {
    const result = await sendDeviceAction(action, body)
    if (result) setDeviceStatus(true, result)
    else {
      setDeviceStatus(false, null)
      toast.error('Device did not respond')
    }
  }

  let body: React.ReactNode
  if (mode === 'pomodoro') {
    const rt = remote.pomodoroRuntime
    if (rt.status === 'idle') {
      body = (
        <Button
          className="min-h-11 w-full"
          variant="outline"
          onClick={() => act('pomodoro/start', pomodoro)}
        >
          Start on device
        </Button>
      )
    } else {
      body = (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tabular-nums">
              {formatDuration(rt.remainingSec)}
            </p>
            <p className="text-xs text-muted-foreground">
              {PHASE_LABELS[rt.phase] ?? rt.phase}
              {rt.status === 'paused' ? ' · paused' : ''} · round {rt.currentRound}
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => act('pomodoro/pause')}
          >
            {rt.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            onClick={() => act('pomodoro/stop')}
          >
            Stop
          </Button>
        </div>
      )
    }
  } else {
    const timer = remote.timer
    if (timer.status === 'running' || timer.status === 'paused') {
      body = (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tabular-nums">
              {formatDuration(timer.remainingSec)}
            </p>
            <p className="text-xs text-muted-foreground">
              {timer.status === 'paused' ? 'paused' : 'running'}
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => act('timer/pause')}
          >
            {timer.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            onClick={() => act('timer/reset')}
          >
            Reset
          </Button>
        </div>
      )
    } else if (timer.status === 'done') {
      body = (
        <div className="flex items-center gap-3">
          <p className="flex-1 font-semibold">Done!</p>
          <Button
            variant="destructive"
            className="min-h-11"
            onClick={() => act('timer/reset')}
          >
            Turn off
          </Button>
        </div>
      )
    } else {
      body = (
        <Button
          className="min-h-11 w-full"
          variant="outline"
          disabled={timerDuration <= 0}
          onClick={() => act('timer/start', { durationSec: timerDuration })}
        >
          Start on device ({formatDuration(timerDuration)})
        </Button>
      )
    }
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">On device</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
