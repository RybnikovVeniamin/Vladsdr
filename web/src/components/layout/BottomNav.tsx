import { AlarmClock, Clock, Timer, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tab } from '@/types'

const tabs: { id: Tab; label: string; icon: typeof AlarmClock }[] = [
  { id: 'alarm', label: 'Alarm', icon: AlarmClock },
  { id: 'pomodoro', label: 'Pomo', icon: Timer },
  { id: 'timer', label: 'Timer', icon: Clock },
  { id: 'upload', label: 'Upload', icon: Upload },
]

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
  className?: string
}

export function BottomNav({ active, onChange, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('size-5', isActive && 'stroke-[2.5]')} />
              <span className="font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
