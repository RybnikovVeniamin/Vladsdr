import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DevicePreview } from '@/components/device/DevicePreview'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="min-h-dvh bg-muted/20">
      <DevicePreview />
    </div>
  </StrictMode>,
)
