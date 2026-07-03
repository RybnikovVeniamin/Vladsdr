import { useAppStore } from '@/store/useAppStore'

export function AppBackground() {
  const backgroundImage = useAppStore((s) => s.backgroundImage)

  if (!backgroundImage) return null

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-background/25"
      />
    </>
  )
}
