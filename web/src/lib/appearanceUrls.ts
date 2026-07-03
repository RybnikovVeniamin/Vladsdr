import type { PersonId } from '@/types'
import { getDeviceBaseUrl } from '@/lib/deviceApi'

export interface AppearanceState {
  avatars: Record<PersonId, number | null>
  background: number | null
}

export function avatarDeviceUrl(person: PersonId, version?: number | null): string {
  const base = `${getDeviceBaseUrl()}/api/avatars/${person}`
  return version ? `${base}?v=${version}` : base
}

export function backgroundDeviceUrl(version?: number | null): string {
  const base = `${getDeviceBaseUrl()}/api/background`
  return version ? `${base}?v=${version}` : base
}

export function resolveAvatarUrl(
  person: PersonId,
  localDataUrl: string | null,
  deviceOnline: boolean,
  remote: AppearanceState | null | undefined,
): string | null {
  const version = remote?.avatars?.[person]
  if (deviceOnline && version) return avatarDeviceUrl(person, version)
  return localDataUrl
}

export function resolveBackgroundUrl(
  localDataUrl: string | null,
  deviceOnline: boolean,
  remote: AppearanceState | null | undefined,
): string | null {
  const version = remote?.background
  if (deviceOnline && version) return backgroundDeviceUrl(version)
  return localDataUrl
}
