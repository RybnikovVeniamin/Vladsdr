import { cn } from '@/lib/utils'

interface PersonAvatarProps {
  name: string
  avatarUrl?: string | null
  className?: string
}

export function PersonAvatar({ name, avatarUrl, className }: PersonAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={50}
        height={50}
        className={cn('size-[50px] shrink-0 rounded-full object-cover', className)}
      />
    )
  }

  return (
    <div
      aria-hidden
      className={cn(
        'flex size-[50px] shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground',
        className,
      )}
    >
      {initial}
    </div>
  )
}
