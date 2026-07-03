import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Frosted glass panel — Apple-style translucent blur */
export const glassPanel =
  'bg-white/75 supports-[backdrop-filter]:bg-white/55 backdrop-blur-2xl backdrop-saturate-150 dark:bg-white/20 dark:supports-[backdrop-filter]:bg-white/10'

export const glassBorder = 'border-white/60 dark:border-white/15'

export const glassSurface = cn(
  glassPanel,
  glassBorder,
  'shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]',
)

export const glassSurfaceSubtle = cn(
  'bg-white/65 supports-[backdrop-filter]:bg-white/40 backdrop-blur-xl backdrop-saturate-150 dark:bg-white/15 dark:supports-[backdrop-filter]:bg-white/8',
  glassBorder,
)
