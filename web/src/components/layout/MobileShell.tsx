import { cn, glassPanel, glassBorder } from '@/lib/utils'
import type { Tab } from '@/types'
import { DevicePreviewLink } from '@/components/device/DevicePreviewLink'
import { BottomNav } from '@/components/layout/BottomNav'

const PAGE_TITLE = 'Влад вставай у тебя будильник хуярит'

interface MobileShellProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  children: React.ReactNode
  hideBottomNav?: boolean
}

export function MobileShell({
  activeTab,
  onTabChange,
  children,
  hideBottomNav,
}: MobileShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header
        className={cn(
          'sticky top-0 z-40 border-b px-4 py-3',
          glassPanel,
          glassBorder,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">{PAGE_TITLE}</h1>
          <DevicePreviewLink compact />
        </div>
      </header>

      <main
        className={cn(
          'flex-1 overflow-y-auto px-4 py-4',
          !hideBottomNav && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
        )}
      >
        {children}
      </main>

      {!hideBottomNav && (
        <BottomNav active={activeTab} onChange={onTabChange} />
      )}
    </div>
  )
}
