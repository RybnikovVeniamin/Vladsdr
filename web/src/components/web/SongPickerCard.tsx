import { useState } from 'react'
import { ChevronLeft, Music, Pause, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PersonCard } from '@/components/web/PersonCard'
import { SongList } from '@/components/web/SongList'
import { resolveAvatarUrl } from '@/lib/appearanceUrls'
import { songsForCategory } from '@/lib/format'
import { cn, glassSurfaceSubtle } from '@/lib/utils'
import { useSongPreview } from '@/hooks/useSongPreview'
import { useAppStore } from '@/store/useAppStore'

interface SongPickerCardProps {
  title: string
  /** Text shown when no custom sound is selected. */
  emptyLabel: string
  selectedId: string | null
  onSelect: (songId: string | null) => void
}

type PickerStage = 'pick-person' | 'song-list'

export function SongPickerCard({
  title,
  emptyLabel,
  selectedId,
  onSelect,
}: SongPickerCardProps) {
  const songs = useAppStore((s) => s.songs)
  const avatars = useAppStore((s) => s.avatars)
  const deviceOnline = useAppStore((s) => s.deviceOnline)
  const remoteAppearance = useAppStore((s) => s.remote?.appearance)
  const { playingId, isPlaying, togglePlay, stop } = useSongPreview()

  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<PickerStage>('pick-person')
  const [category, setCategory] = useState<'vlad' | 'karina'>('vlad')

  const selectedSong = songs.find((s) => s.id === selectedId) ?? null

  const openPicker = () => {
    setStage('pick-person')
    setOpen(true)
  }

  const closePicker = () => {
    stop()
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {selectedSong ? (
          <div className={cn('flex items-center gap-3 rounded-lg border p-3', glassSurfaceSubtle)}>
            <Music className="size-5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{selectedSong.name}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {selectedSong.category}
              </Badge>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label={
                  playingId === selectedSong.id && isPlaying
                    ? `Pause ${selectedSong.name}`
                    : `Play ${selectedSong.name}`
                }
                onClick={() => togglePlay(selectedSong)}
              >
                {playingId === selectedSong.id && isPlaying ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>
              {playingId === selectedSong.id && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label={`Stop ${selectedSong.name}`}
                  onClick={stop}
                >
                  <Square className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
        <div className="flex gap-2">
          <Button className="min-h-12 flex-1" variant="outline" onClick={openPicker}>
            Choose sound
          </Button>
          {selectedSong && (
            <Button
              className="min-h-12"
              variant="ghost"
              onClick={() => {
                onSelect(null)
                toast.success('Default sound restored')
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closePicker())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {stage === 'pick-person' ? 'Choose a sound' : `${category}'s songs`}
            </DialogTitle>
          </DialogHeader>

          {stage === 'pick-person' ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">Tap a name to browse songs</p>
              <PersonCard
                name="Vlad"
                avatarUrl={resolveAvatarUrl('vlad', avatars.vlad, deviceOnline, remoteAppearance)}
                onClick={() => {
                  setCategory('vlad')
                  setStage('song-list')
                }}
              />
              <PersonCard
                name="Karina"
                avatarUrl={resolveAvatarUrl('karina', avatars.karina, deviceOnline, remoteAppearance)}
                onClick={() => {
                  setCategory('karina')
                  setStage('song-list')
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Button
                variant="ghost"
                className="min-h-11 self-start"
                onClick={() => {
                  stop()
                  setStage('pick-person')
                }}
              >
                <ChevronLeft className="size-4" /> Back
              </Button>
              <SongList
                songs={songsForCategory(songs, category)}
                selectedId={selectedId}
                playingId={playingId}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onStop={stop}
                selectLabel="Use sound"
                onSelect={(song) => {
                  onSelect(song.id)
                  toast.success('Custom sound set')
                  closePicker()
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
