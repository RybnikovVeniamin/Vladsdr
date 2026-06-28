import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'

export function VirtualControls() {
  const knobTurn = useAppStore((s) => s.deviceKnobTurn)
  const knobClick = useAppStore((s) => s.deviceKnobClick)
  const buttonShort = useAppStore((s) => s.deviceButtonShort)
  const buttonLong = useAppStore((s) => s.deviceButtonLong)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longFiredRef = useRef(false)

  const onRedDown = () => {
    longFiredRef.current = false
    longPressRef.current = setTimeout(() => {
      longFiredRef.current = true
      buttonLong()
    }, 800)
  }

  const onRedUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current)
    if (!longFiredRef.current) buttonShort()
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Knob left"
          onClick={() => knobTurn(-1)}
        >
          <ChevronLeft />
        </Button>

        <div className="flex flex-col items-center gap-2">
          <div className="relative flex size-20 items-center justify-center rounded-full border-4 border-muted-foreground/30 bg-muted">
            <Button
              variant="secondary"
              size="icon"
              className="size-10 rounded-full"
              aria-label="Knob click"
              onClick={knobClick}
            >
              <Circle className="size-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Knob click</span>
        </div>

        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Knob right"
          onClick={() => knobTurn(1)}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Red button"
          className="size-16 rounded-full bg-red-600 shadow-lg ring-4 ring-red-600/30 transition active:scale-95 active:bg-red-700"
          onPointerDown={onRedDown}
          onPointerUp={onRedUp}
          onPointerLeave={() => {
            if (longPressRef.current) clearTimeout(longPressRef.current)
          }}
        />
        <span className="text-xs text-muted-foreground">
          Red button · short / long press
        </span>
      </div>
    </div>
  )
}
