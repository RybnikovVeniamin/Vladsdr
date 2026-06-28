import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { OledScreen } from '@/components/device/OledScreen'
import { VirtualControls } from '@/components/device/VirtualControls'
import { useAppStore } from '@/store/useAppStore'

interface DevicePreviewProps {
  embedded?: boolean
}

export function DevicePreview({ embedded }: DevicePreviewProps) {
  const tick = useAppStore((s) => s.tick)
  const triggerAlarmNow = useAppStore((s) => s.triggerAlarmNow)

  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick])

  return (
    <div
      className={
        embedded
          ? 'flex h-full flex-col items-center justify-center gap-6 p-6'
          : 'flex flex-col items-center gap-6 px-4 py-6'
      }
    >
      <div className="text-center">
        <h2 className="text-lg font-semibold">Device preview</h2>
        <p className="text-sm text-muted-foreground">128×64 OLED simulator</p>
      </div>

      <OledScreen />

      <VirtualControls />

      <Button variant="outline" size="sm" onClick={triggerAlarmNow}>
        Trigger alarm now
      </Button>
    </div>
  )
}
