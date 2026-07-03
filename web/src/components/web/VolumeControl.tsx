import { Volume2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn, glassSurfaceSubtle } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

interface VolumeControlProps {
  /** Shorter card title when nested on a busy page */
  compact?: boolean
}

export function VolumeControl({ compact }: VolumeControlProps) {
  const volume = useAppStore((s) => s.volume)
  const setVolume = useAppStore((s) => s.setVolume)
  const deviceOnline = useAppStore((s) => s.deviceOnline)
  const remoteVolume = useAppStore((s) => s.remote?.volume)
  const deviceNeedsUpdate = deviceOnline && typeof remoteVolume !== 'number'

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="size-4" />
          Volume
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="volume-slider" className="sr-only">
            Volume
          </Label>
          <span className="text-2xl font-bold tabular-nums">{volume}%</span>
        </div>
        <input
          id="volume-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full',
            glassSurfaceSubtle,
            '[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
            '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary',
          )}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
        />
        <p className="text-xs text-muted-foreground">
          Controls alarm, timer, and pomodoro sounds on the device and in previews.
        </p>
        {deviceNeedsUpdate && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            The device software is out of date — volume changes only affect previews
            until you update the Pi app (see pi/README.md).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
