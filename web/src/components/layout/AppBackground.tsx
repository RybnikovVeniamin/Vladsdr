import { useAppStore } from '@/store/useAppStore'
import { resolveBackgroundUrl } from '@/lib/appearanceUrls'

export function AppBackground() {
  const backgroundImage = useAppStore((s) => s.backgroundImage)
  const deviceOnline = useAppStore((s) => s.deviceOnline)
  const remoteAppearance = useAppStore((s) => s.remote?.appearance)
  const src = resolveBackgroundUrl(backgroundImage, deviceOnline, remoteAppearance)

  if (!src) return null

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${src})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-background/25"
      />
    </>
  )
}
