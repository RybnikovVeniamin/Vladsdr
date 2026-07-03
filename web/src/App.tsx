import { useAppStore } from '@/store/useAppStore'
import { useDeviceSync } from '@/hooks/useDeviceSync'
import { AppBackground } from '@/components/layout/AppBackground'
import { MobileShell } from '@/components/layout/MobileShell'
import { AlarmPage } from '@/components/web/AlarmPage'
import { PomodoroPage } from '@/components/web/PomodoroPage'
import { TimerPage } from '@/components/web/TimerPage'
import { UploadPage } from '@/components/web/UploadPage'

function MainContent() {
  const activeTab = useAppStore((s) => s.activeTab)

  switch (activeTab) {
    case 'alarm':
      return <AlarmPage />
    case 'pomodoro':
      return <PomodoroPage />
    case 'timer':
      return <TimerPage />
    case 'upload':
      return <UploadPage />
    default:
      return <AlarmPage />
  }
}

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  useDeviceSync()

  return (
    <>
      <AppBackground />
      <MobileShell activeTab={activeTab} onTabChange={setActiveTab}>
        <MainContent />
      </MobileShell>
    </>
  )
}
