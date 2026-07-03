import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getDeviceBaseUrl,
  sendDeviceAction,
  setDeviceBaseUrl,
} from '@/lib/deviceApi'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

export function DeviceSyncCard() {
  const online = useAppStore((s) => s.deviceOnline)
  const remote = useAppStore((s) => s.remote)
  const setDeviceStatus = useAppStore((s) => s.setDeviceStatus)

  const ringing = online && remote?.device.screen === 'alarm_ringing'
  const snoozing = online && remote?.device.screen === 'snoozing'
  const address = getDeviceBaseUrl() || 'this device'

  const act = async (action: 'alarm/snooze' | 'alarm/dismiss') => {
    const result = await sendDeviceAction(action)
    if (result) setDeviceStatus(true, result)
    else {
      setDeviceStatus(false, null)
      toast.error('Device did not respond')
    }
  }

  const editAddress = () => {
    const next = window.prompt(
      'Device address (empty = default)',
      getDeviceBaseUrl(),
    )
    if (next === null) return
    setDeviceBaseUrl(next)
    window.location.reload()
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'size-2.5 shrink-0 rounded-full',
            ringing || snoozing
              ? 'animate-pulse bg-red-500'
              : online
                ? 'bg-emerald-500'
                : 'bg-muted-foreground/40',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Vlad_brodyaga{' '}
            {ringing
              ? '· ringing!'
              : snoozing
                ? '· snoozing'
                : online
                  ? 'connected'
                  : 'offline'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{address}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Change device address"
          onClick={editAddress}
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      {(ringing || snoozing) && (
        <div className="flex gap-2">
          {ringing && (
            <Button
              className="min-h-11 flex-1"
              variant="outline"
              onClick={() => act('alarm/snooze')}
            >
              Snooze 5 min
            </Button>
          )}
          <Button
            className="min-h-11 flex-1"
            variant="destructive"
            onClick={() => act('alarm/dismiss')}
          >
            Turn off
          </Button>
        </div>
      )}
    </Card>
  )
}
