import { Card } from '@/components/ui/card'
import { PersonAvatar } from '@/components/web/PersonAvatar'
import { cn } from '@/lib/utils'

interface PersonCardProps {
  name: string
  avatarUrl?: string | null
  onClick: () => void
  className?: string
}

export function PersonCard({ name, avatarUrl, onClick, className }: PersonCardProps) {
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
        'flex w-full cursor-pointer items-center gap-4 p-4 text-left transition-colors active:bg-accent/50 hover:bg-accent/30',
        className,
      )}
    >
      <PersonAvatar name={name} avatarUrl={avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{name}</p>
        <p className="text-sm text-muted-foreground">Choose a wake-up song</p>
      </div>
    </Card>
  )
}
