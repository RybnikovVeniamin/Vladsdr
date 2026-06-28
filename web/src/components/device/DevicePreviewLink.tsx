import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DevicePreviewLinkProps {
  compact?: boolean
  className?: string
}

export function DevicePreviewLink({ compact, className }: DevicePreviewLinkProps) {
  return (
    <Button
      variant="outline"
      size={compact ? 'sm' : 'sm'}
      className={cn('gap-2', compact ? 'px-2.5' : 'w-full', className)}
      asChild
    >
      <a href="/device.html" target="_blank" rel="noreferrer">
        <ExternalLink className="size-4" />
        {compact ? 'Preview' : 'Open device preview'}
      </a>
    </Button>
  )
}
