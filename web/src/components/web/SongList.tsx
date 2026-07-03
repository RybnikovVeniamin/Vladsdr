import { Pause, Play, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Song } from '@/types'

interface SongListProps {
  songs: Song[]
  selectedId?: string | null
  playingId?: string | null
  isPlaying?: boolean
  onTogglePlay: (song: Song) => void
  onStop?: () => void
  onSelect: (song: Song) => void
  selectLabel?: string
}

export function SongList({
  songs,
  selectedId,
  playingId,
  isPlaying = false,
  onTogglePlay,
  onStop,
  onSelect,
  selectLabel = 'Set as alarm',
}: SongListProps) {
  if (songs.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No songs here yet. Upload one first.
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {songs.map((song) => (
        <Card key={song.id} className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{song.name}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {song.category}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={
              playingId === song.id && isPlaying
                ? `Pause ${song.name}`
                : `Play ${song.name}`
            }
            onClick={() => onTogglePlay(song)}
          >
            {playingId === song.id && isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          {playingId === song.id && onStop && (
            <Button
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label={`Stop ${song.name}`}
              onClick={onStop}
            >
              <Square className="size-4" />
            </Button>
          )}
          <Button
            className="min-h-11 shrink-0"
            variant={selectedId === song.id ? 'secondary' : 'default'}
            onClick={() => onSelect(song)}
          >
            {selectedId === song.id ? 'Selected' : selectLabel}
          </Button>
        </Card>
      ))}
    </div>
  )
}
