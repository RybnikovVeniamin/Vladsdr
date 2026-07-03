import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppBackground } from '@/components/layout/AppBackground'
import { DevicePreview } from '@/components/device/DevicePreview'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBackground />
    <div className="min-h-dvh bg-muted/20">
      <DevicePreview />
    </div>
  </StrictMode>,
)
