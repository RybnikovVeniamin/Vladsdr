import { songAudioUrl } from '@/lib/deviceApi'
import type { Song } from '@/types'

export function playbackUrlForSong(
  song: Pick<Song, 'id' | 'blobUrl'>,
  deviceOnline: boolean,
): string | null {
  if (song.blobUrl) return song.blobUrl
  if (deviceOnline) return songAudioUrl(song.id)
  return null
}
