import { useEffect, useState } from 'react'
import { ChevronLeft, Music, Pause, Play, Plus, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlarmRepeatPicker } from '@/components/web/AlarmRepeatPicker'
import { DeviceSyncCard } from '@/components/web/DeviceSyncCard'
import { PersonCard } from '@/components/web/PersonCard'
import { SongList } from '@/components/web/SongList'
import { formatRepeatSummary, normalizeRepeatDays } from '@/lib/alarmRepeat'
import { formatClock, songsForCategory } from '@/lib/format'
import { useSongPreview } from '@/hooks/useSongPreview'
import { useAppStore } from '@/store/useAppStore'

type AlarmView = 'list' | 'edit' | 'pick-person' | 'song-list'

export function AlarmPage() {
  const alarms = useAppStore((s) => s.alarms)
  const songs = useAppStore((s) => s.songs)
  const avatars = useAppStore((s) => s.avatars)
  const addAlarm = useAppStore((s) => s.addAlarm)
  const updateAlarm = useAppStore((s) => s.updateAlarm)
  const deleteAlarm = useAppStore((s) => s.deleteAlarm)

  const [view, setView] = useState<AlarmView>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [category, setCategory] = useState<'vlad' | 'karina'>('vlad')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { playingId, isPlaying, togglePlay, stop } = useSongPreview()

  const editing = alarms.find((a) => a.id === editingId) ?? null
  const effectiveView: AlarmView = view !== 'list' && !editing ? 'list' : view

  useEffect(() => {
    stop()
  }, [view, stop])

  const openEditor = (id: string) => {
    setEditingId(id)
    setView('edit')
  }

  const handleAdd = () => {
    openEditor(addAlarm())
    toast.success('Alarm added')
  }

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteAlarm(deleteTarget)
      toast.success('Alarm deleted')
      setDeleteTarget(null)
      setView('list')
    }
  }

  if (effectiveView === 'pick-person' && editing) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        <Button variant="ghost" className="min-h-11" onClick={() => setView('edit')}>
          <ChevronLeft className="size-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Tap a name to browse songs</p>
        <PersonCard
          name="Vlad"
          avatarUrl={avatars.vlad}
          onClick={() => {
            setCategory('vlad')
            setView('song-list')
          }}
        />
        <PersonCard
          name="Karina"
          avatarUrl={avatars.karina}
          onClick={() => {
            setCategory('karina')
            setView('song-list')
          }}
        />
      </div>
    )
  }

  if (effectiveView === 'song-list' && editing) {
    const list = songsForCategory(songs, category)
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => setView('pick-person')}
        >
          <ChevronLeft className="size-4" /> Back
        </Button>
        <h2 className="text-base font-semibold capitalize">{category}&apos;s songs</h2>
        <SongList
          songs={list}
          selectedId={editing.songId}
          playingId={playingId}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onStop={stop}
          onSelect={(song) => {
            updateAlarm(editing.id, { songId: song.id })
            toast.success('Wake-up song set')
            setView('edit')
          }}
        />
      </div>
    )
  }

  if (effectiveView === 'edit' && editing) {
    const selectedSong = songs.find((s) => s.id === editing.songId)
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Button
          variant="ghost"
          className="min-h-11 self-start"
          onClick={() => setView('list')}
        >
          <ChevronLeft className="size-4" /> All alarms
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time &amp; repeat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="alarm-enabled" className="text-base">
                Alarm on
              </Label>
              <Switch
                id="alarm-enabled"
                checked={editing.enabled}
                onCheckedChange={(enabled) => updateAlarm(editing.id, { enabled })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="alarm-time">Time</Label>
              <input
                id="alarm-time"
                type="time"
                value={formatClock(editing.hour, editing.minute)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number)
                  if (Number.isFinite(h) && Number.isFinite(m)) {
                    updateAlarm(editing.id, { hour: h, minute: m })
                    toast.success('Alarm time saved')
                  }
                }}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-lg"
              />
            </div>
            <AlarmRepeatPicker
              repeatDays={editing.repeatDays}
              onChange={(days) => {
                updateAlarm(editing.id, { repeatDays: days })
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

        <Button
          variant="ghost"
          className="min-h-11 text-destructive"
          onClick={() => setDeleteTarget(editing.id)}
        >
          <Trash2 className="size-4" /> Delete this alarm
        </Button>

        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete alarm?</DialogTitle>
              <DialogDescription>This cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <DeviceSyncCard />

      {alarms.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No alarms yet. Add one for weekdays, one for the weekend — or one per
          day.
        </Card>
      )}

      {alarms.map((alarm) => {
        const song = songs.find((s) => s.id === alarm.songId)
        return (
          <Card
            key={alarm.id}
            role="button"
            tabIndex={0}
            onClick={() => openEditor(alarm.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openEditor(alarm.id)
              }
            }}
            className="cursor-pointer p-4 transition-colors hover:bg-accent/30"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className={
                    alarm.enabled
                      ? 'text-3xl font-bold tabular-nums'
                      : 'text-3xl font-bold tabular-nums text-muted-foreground'
                  }
                >
                  {formatClock(alarm.hour, alarm.minute)}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {formatRepeatSummary(normalizeRepeatDays(alarm.repeatDays))}
                  {song ? ` · ${song.name}` : ''}
                </p>
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Switch
                  checked={alarm.enabled}
                  aria-label={`Alarm ${formatClock(alarm.hour, alarm.minute)} on/off`}
                  onCheckedChange={(enabled) => updateAlarm(alarm.id, { enabled })}
                />
              </div>
            </div>
          </Card>
        )
      })}

      <Button className="min-h-12 w-full" variant="outline" onClick={handleAdd}>
        <Plus className="size-4" /> Add alarm
      </Button>
    </div>
  )
}
