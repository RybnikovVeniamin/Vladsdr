import { useRef, useState } from 'react'
import { Trash2, Upload as UploadIcon } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PersonAvatar } from '@/components/web/PersonAvatar'
import { readImageAsAvatarDataUrl } from '@/lib/imageAvatar'
import type { PersonId, SongCategory } from '@/types'
import { useAppStore } from '@/store/useAppStore'

const PROFILE_PEOPLE: { id: PersonId; name: string }[] = [
  { id: 'vlad', name: 'Vlad' },
  { id: 'karina', name: 'Karina' },
]

export function UploadPage() {
  const songs = useAppStore((s) => s.songs)
  const avatars = useAppStore((s) => s.avatars)
  const addSong = useAppStore((s) => s.addSong)
  const deleteSong = useAppStore((s) => s.deleteSong)
  const setAvatar = useAppStore((s) => s.setAvatar)

  const fileRef = useRef<HTMLInputElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SongCategory>('both')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [avatarTarget, setAvatarTarget] = useState<PersonId | null>(null)

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Please pick an audio file')
      return
    }
    setPendingFile(file)
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
  }

  const submit = () => {
    if (!pendingFile || !name.trim()) {
      toast.error('Pick a file and enter a name')
      return
    }
    const blobUrl = URL.createObjectURL(pendingFile)
    addSong(name.trim(), category, blobUrl)
    toast.success('Song uploaded')
    setName('')
    setPendingFile(null)
    setCategory('both')
    if (fileRef.current) fileRef.current.value = ''
  }

  const confirmDelete = () => {
    if (deleteId) {
      deleteSong(deleteId)
      toast.success('Song deleted')
      setDeleteId(null)
    }
  }

  const openAvatarPicker = (person: PersonId) => {
    setAvatarTarget(person)
    avatarFileRef.current?.click()
  }

  const onAvatarFile = async (file: File | undefined) => {
    if (!file || !avatarTarget) return
    try {
      const dataUrl = await readImageAsAvatarDataUrl(file)
      setAvatar(avatarTarget, dataUrl)
      toast.success(`${avatarTarget === 'vlad' ? 'Vlad' : 'Karina'}'s photo updated`)
    } catch {
      toast.error('Please pick a photo (JPG, PNG, etc.)')
    } finally {
      setAvatarTarget(null)
      if (avatarFileRef.current) avatarFileRef.current.value = ''
    }
  }

  const uploaded = songs.filter((s) => !s.id.startsWith('seed-'))

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile photos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            These small photos show on the Alarm song picker for Vlad and Karina.
          </p>
          {PROFILE_PEOPLE.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <PersonAvatar name={person.name} avatarUrl={avatars[person.id]} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{person.name}</p>
                <p className="text-sm text-muted-foreground">
                  {avatars[person.id] ? 'Custom photo' : 'Default initial'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  variant="outline"
                  className="min-h-10"
                  onClick={() => openAvatarPicker(person.id)}
                >
                  Change
                </Button>
                {avatars[person.id] && (
                  <Button
                    variant="ghost"
                    className="min-h-10 text-destructive"
                    onClick={() => {
                      setAvatar(person.id, null)
                      toast.success(`${person.name}'s photo removed`)
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatarFile(e.target.files?.[0])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload sound</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <UploadIcon className="size-8" />
            {pendingFile ? pendingFile.name : 'Tap to choose audio file'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="song-name">Song name</Label>
            <Input
              id="song-name"
              className="min-h-12"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My alarm song"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Show under</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as SongCategory)}
            >
              <SelectTrigger className="min-h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vlad">Vlad</SelectItem>
                <SelectItem value="karina">Karina</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="min-h-12 w-full" onClick={submit}>
            Upload
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your uploads</CardTitle>
        </CardHeader>
        <CardContent>
          {uploaded.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No uploads yet. Sample songs are already available in Alarm.
            </p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="flex flex-col gap-2 pr-2">
                {uploaded.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{song.name}</p>
                      <Badge variant="secondary" className="mt-1 capitalize">
                        {song.category}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 text-destructive"
                      onClick={() => setDeleteId(song.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete song?</DialogTitle>
            <DialogDescription>
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
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
