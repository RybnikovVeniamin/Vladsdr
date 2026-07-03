import { toast } from 'sonner'
import { AlarmClock, Clock, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { sendDeviceAction, type DeviceAction } from '@/lib/deviceApi'
import { formatDuration } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

const PHASE_LABELS: Record<string, string> = {
  work: 'Focus',
  break: 'Break',
  long_break: 'Long break',
}

/**
 * Global strip shown on every tab: anything currently ringing or running on
 * the physical device can be turned off from here. The tab that owns a mode
 * already renders its detailed card, so that mode is skipped there.
 */
export function DeviceActiveBanner() {
  const online = useAppStore((s) => s.deviceOnline)
  const remote = useAppStore((s) => s.remote)
  const activeTab = useAppStore((s) => s.activeTab)
  const setDeviceStatus = useAppStore((s) => s.setDeviceStatus)

  if (!online || !remote) return null

  const act = async (action: DeviceAction) => {
    const result = await sendDeviceAction(action)
    if (result) setDeviceStatus(true, result)
    else {
      setDeviceStatus(false, null)
      toast.error('Device did not respond')
    }
  }

  const rows: React.ReactNode[] = []
  const screen = remote.device.screen
  const ringing = screen === 'alarm_ringing'
  const snoozing = screen === 'snoozing'

  if ((ringing || snoozing) && activeTab !== 'alarm') {
    rows.push(
      <div key="alarm" className="flex items-center gap-3">
        <AlarmClock className="size-5 shrink-0 animate-pulse text-red-500" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {ringing ? 'Alarm ringing!' : 'Alarm snoozing'}
        </p>
        {ringing && (
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => act('alarm/snooze')}
          >
            Snooze
          </Button>
        )}
        <Button
          variant="destructive"
          className="min-h-11"
          onClick={() => act('alarm/dismiss')}
        >
          Turn off
        </Button>
      </div>,
    )
  }

  const timer = remote.timer
  if (activeTab !== 'timer' && timer.status !== 'idle') {
    rows.push(
      <div key="timer" className="flex items-center gap-3">
        <Clock
          className={
            timer.status === 'done'
              ? 'size-5 shrink-0 animate-pulse text-red-500'
              : 'size-5 shrink-0 text-muted-foreground'
          }
        />
        <p className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">
          {timer.status === 'done'
            ? 'Timer done!'
            : `Timer ${formatDuration(timer.remainingSec)}${
                timer.status === 'paused' ? ' · paused' : ''
              }`}
        </p>
        <Button
          variant="destructive"
          className="min-h-11"
          onClick={() => act('timer/reset')}
        >
          Turn off
        </Button>
      </div>,
    )
  }

  const rt = remote.pomodoroRuntime
  if (activeTab !== 'pomodoro' && rt.status !== 'idle') {
    rows.push(
      <div key="pomodoro" className="flex items-center gap-3">
        <Timer className="size-5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">
          {`Pomodoro ${formatDuration(rt.remainingSec)} · ${
            PHASE_LABELS[rt.phase] ?? rt.phase
          }${rt.status === 'paused' ? ' · paused' : ''}`}
        </p>
        <Button
          variant="destructive"
          className="min-h-11"
          onClick={() => act('pomodoro/stop')}
        >
          Turn off
        </Button>
      </div>,
    )
  }

  if (rows.length === 0) return null

  return (
    <Card
      className={
        ringing || snoozing || timer.status === 'done'
          ? 'mx-auto mb-4 flex max-w-lg flex-col gap-3 border-red-500/40 p-4'
          : 'mx-auto mb-4 flex max-w-lg flex-col gap-3 border-emerald-500/30 p-4'
      }
    >
      {rows}
    </Card>
  )
}
