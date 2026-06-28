import { useRef, useState } from 'react'
import { Music, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlarmRepeatPicker } from '@/components/web/AlarmRepeatPicker'
import { PersonCard } from '@/components/web/PersonCard'
import { SongList } from '@/components/web/SongList'
import { formatClock, songsForCategory } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

type AlarmView = 'main' | 'pick-person' | 'song-list'

export function AlarmPage() {
  const alarm = useAppStore((s) => s.alarm)
  const songs = useAppStore((s) => s.songs)
  const setAlarmEnabled = useAppStore((s) => s.setAlarmEnabled)
  const setAlarmTime = useAppStore((s) => s.setAlarmTime)
  const setAlarmRepeatDays = useAppStore((s) => s.setAlarmRepeatDays)
  const setAlarmSong = useAppStore((s) => s.setAlarmSong)

  const [view, setView] = useState<AlarmView>('main')
  const [category, setCategory] = useState<'vlad' | 'karina'>('vlad')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const selectedSong = songs.find((s) => s.id === alarm.songId)
  const timeValue = `${formatClock(alarm.hour, alarm.minute)}`

  const playSong = (song: { blobUrl?: string; name: string }) => {
    if (!song.blobUrl) {
      toast.info(`"${song.name}" is a sample — upload a real file to play it`)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(song.blobUrl)
    audioRef.current = audio
    audio.play().catch(() => toast.error('Could not play audio'))
  }

  const handleTimeChange = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    if (Number.isFinite(h) && Number.isFinite(m)) {
      setAlarmTime(h, m)
      toast.success('Alarm time saved')
    }
  }

  const handleSelectSong = (songId: string) => {
    setAlarmSong(songId)
    toast.success('Wake-up song set')
    setView('main')
  }

  if (view === 'pick-person') {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => setView('main')}
        >
          Back
        </Button>
        <p className="text-sm text-muted-foreground">
          Tap a name to browse songs
        </p>
        <PersonCard
          name="Vlad"
          onClick={() => {
            setCategory('vlad')
            setView('song-list')
          }}
        />
        <PersonCard
          name="Karina"
          onClick={() => {
            setCategory('karina')
            setView('song-list')
          }}
        />
      </div>
    )
  }

  if (view === 'song-list') {
    const list = songsForCategory(songs, category)
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => setView('pick-person')}
        >
          Back
        </Button>
        <h2 className="text-base font-semibold capitalize">{category}&apos;s songs</h2>
        <SongList
          songs={list}
          selectedId={alarm.songId}
          onPlay={playSong}
          onSelect={(song) => handleSelectSong(song.id)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alarm time</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="alarm-enabled" className="text-base">
              Alarm on
            </Label>
            <Switch
              id="alarm-enabled"
              checked={alarm.enabled}
              onCheckedChange={setAlarmEnabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="alarm-time">Time</Label>
            <input
              id="alarm-time"
              type="time"
              value={timeValue}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-lg"
            />
          </div>
          <AlarmRepeatPicker
            repeatDays={alarm.repeatDays}
            onChange={(days) => {
              setAlarmRepeatDays(days)
              toast.success('Repeat days saved')
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wake-up song</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selectedSong ? (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Music className="size-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selectedSong.name}</p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {selectedSong.category}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                onClick={() => playSong(selectedSong)}
              >
                <Play className="size-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No song selected</p>
          )}
          <Button
            className="min-h-12 w-full"
            variant="outline"
            onClick={() => setView('pick-person')}
          >
            Choose song
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
