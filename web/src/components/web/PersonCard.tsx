import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PersonCardProps {
  name: string
  onClick: () => void
  className?: string
}

export function PersonCard({ name, onClick, className }: PersonCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center gap-1 p-6 text-center transition-colors active:bg-accent/50 hover:bg-accent/30',
        className,
      )}
    >
      <p className="text-lg font-semibold">{name}</p>
      <p className="text-sm text-muted-foreground">Choose a wake-up song</p>
    </Card>
  )
}
