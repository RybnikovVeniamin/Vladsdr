import { useRef, useState } from 'react'
import { ImageIcon, Trash2, Upload as UploadIcon } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PersonAvatar } from '@/components/web/PersonAvatar'
import {
  deleteAvatarOnDevice,
  deleteBackgroundOnDevice,
  deleteSongOnDevice,
  uploadAvatarToDevice,
  uploadBackgroundToDevice,
  uploadSongToDevice,
} from '@/lib/deviceApi'
import { resolveAvatarUrl, resolveBackgroundUrl } from '@/lib/appearanceUrls'
import { readImageAsAvatarDataUrl } from '@/lib/imageAvatar'
import { readImageAsBackgroundDataUrl } from '@/lib/imageBackground'
import { cn, glassSurfaceSubtle } from '@/lib/utils'
import type { PersonId, SongCategory } from '@/types'
import { useAppStore } from '@/store/useAppStore'

const PROFILE_PEOPLE: { id: PersonId; name: string }[] = [
  { id: 'vlad', name: 'Vlad' },
  { id: 'karina', name: 'Karina' },
]

const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

function audioExtension(filename: string): string | null {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return ALLOWED_AUDIO_EXTENSIONS.includes(ext) ? ext : null
}

export function UploadPage() {
  const songs = useAppStore((s) => s.songs)
  const avatars = useAppStore((s) => s.avatars)
  const backgroundImage = useAppStore((s) => s.backgroundImage)
  const addSong = useAppStore((s) => s.addSong)
  const deleteSong = useAppStore((s) => s.deleteSong)
  const setAvatar = useAppStore((s) => s.setAvatar)
  const setBackgroundImage = useAppStore((s) => s.setBackgroundImage)
  const setAppearanceVersions = useAppStore((s) => s.setAppearanceVersions)

  const fileRef = useRef<HTMLInputElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const backgroundFileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SongCategory>('both')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [avatarTarget, setAvatarTarget] = useState<PersonId | null>(null)

  const deviceOnline = useAppStore((s) => s.deviceOnline)
  const remoteAppearance = useAppStore((s) => s.remote?.appearance)

  const onFile = (file: File | undefined) => {
    if (!file) return
    const ext = audioExtension(file.name)
    if (!ext) {
      toast.error(`Use one of: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}`)
      return
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error('File is too large (max 20 MB)')
      return
    }
    setPendingFile(file)
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    if (!pendingFile || !name.trim()) {
      toast.error('Pick a file and enter a name')
      return
    }
    const trimmed = name.trim()
    const blobUrl = URL.createObjectURL(pendingFile)
    const id = addSong(trimmed, category, blobUrl)

    if (deviceOnline) {
      const sent = await uploadSongToDevice(id, trimmed, category, pendingFile, pendingFile.name)
      if (sent) toast.success('Song saved on device')
      else toast.error('Saved here, but could not reach the device')
    } else {
      toast.success('Song saved — will copy to device when it is online')
    }

    setName('')
    setPendingFile(null)
    setCategory('both')
    if (fileRef.current) fileRef.current.value = ''
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    if (deviceOnline) {
      const ok = await deleteSongOnDevice(deleteId)
      if (!ok) {
        toast.error('Could not delete on device')
        return
      }
    }
    deleteSong(deleteId)
    toast.success('Song deleted')
    setDeleteId(null)
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
      if (deviceOnline) {
        const sent = await uploadAvatarToDevice(avatarTarget, dataUrl)
        if (sent) {
          setAppearanceVersions({
            avatars: { vlad: sent.avatars.vlad, karina: sent.avatars.karina },
            background: sent.background,
          })
          toast.success(`${avatarTarget === 'vlad' ? 'Vlad' : 'Karina'}'s photo saved on device`)
        } else {
          toast.error('Saved here, but could not reach the device')
        }
      } else {
        toast.success(`${avatarTarget === 'vlad' ? 'Vlad' : 'Karina'}'s photo updated`)
      }
    } catch {
      toast.error('Please pick a photo (JPG, PNG, etc.)')
    } finally {
      setAvatarTarget(null)
      if (avatarFileRef.current) avatarFileRef.current.value = ''
    }
  }

  const onBackgroundFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readImageAsBackgroundDataUrl(file)
      setBackgroundImage(dataUrl)
      if (deviceOnline) {
        const sent = await uploadBackgroundToDevice(dataUrl)
        if (sent) {
          setAppearanceVersions({
            avatars: { vlad: sent.avatars.vlad, karina: sent.avatars.karina },
            background: sent.background,
          })
          toast.success('Background photo saved on device')
        } else {
          toast.error('Saved here, but could not reach the device')
        }
      } else {
        toast.success('Background photo updated')
      }
    } catch {
      toast.error('Please pick a photo (JPG, PNG, etc.)')
    } finally {
      if (backgroundFileRef.current) backgroundFileRef.current.value = ''
    }
  }

  const uploaded = songs
  const backgroundPreview = resolveBackgroundUrl(
    backgroundImage,
    deviceOnline,
    remoteAppearance,
  )

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">App background</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Pick a photo that shows behind every screen in the app.
          </p>
          <button
            type="button"
            onClick={() => backgroundFileRef.current?.click()}
            className={cn(
              'relative flex min-h-36 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground transition-colors hover:bg-white/60',
              glassSurfaceSubtle,
            )}
          >
            {backgroundPreview ? (
              <>
                <img
                  src={backgroundPreview}
                  alt="Current app background"
                  className="absolute inset-0 size-full object-cover opacity-60"
                />
                <span className="relative z-10 rounded-md bg-background/80 px-3 py-1.5 font-medium text-foreground">
                  Tap to change photo
                </span>
              </>
            ) : (
              <>
                <ImageIcon className="size-8" />
                Tap to choose a background photo
              </>
            )}
          </button>
          <input
            ref={backgroundFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onBackgroundFile(e.target.files?.[0])}
          />
          {backgroundPreview && (
            <Button
              variant="ghost"
              className="min-h-10 text-destructive"
              onClick={async () => {
                if (deviceOnline) {
                  const sent = await deleteBackgroundOnDevice()
                  if (!sent) {
                    toast.error('Could not delete on device')
                    return
                  }
                  setAppearanceVersions({
                    avatars: { vlad: sent.avatars.vlad, karina: sent.avatars.karina },
                    background: sent.background,
                  })
                }
                setBackgroundImage(null)
                toast.success('Background photo removed')
              }}
            >
              <Trash2 className="size-4" />
              Remove background
            </Button>
          )}
        </CardContent>
      </Card>

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
              className={cn('flex items-center gap-3 rounded-lg border p-3', glassSurfaceSubtle)}
            >
              <PersonAvatar
                name={person.name}
                avatarUrl={resolveAvatarUrl(
                  person.id,
                  avatars[person.id],
                  deviceOnline,
                  remoteAppearance,
                )}
              />
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
                    onClick={async () => {
                      if (deviceOnline) {
                        const sent = await deleteAvatarOnDevice(person.id)
                        if (!sent) {
                          toast.error('Could not delete on device')
                          return
                        }
                        setAppearanceVersions({
                          avatars: { vlad: sent.avatars.vlad, karina: sent.avatars.karina },
                          background: sent.background,
                        })
                      }
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
          <p className="text-sm text-muted-foreground">
            MP3, WAV, M4A, OGG, FLAC, or AAC — up to 20 MB each.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex min-h-28 w-full min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground transition-colors hover:bg-white/60',
              glassSurfaceSubtle,
            )}
          >
            <UploadIcon className="size-8 shrink-0" />
            {pendingFile ? (
              <span className="w-full truncate text-center" title={pendingFile.name}>
                {pendingFile.name}
              </span>
            ) : (
              'Tap to choose audio file'
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,audio/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="song-name">Song name</Label>
            <Input
              id="song-name"
              className="min-h-12 truncate"
              value={name}
              title={name}
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
              No uploads yet. Add a song above, then pick it in Alarm.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {uploaded.map((song) => (
                <div
                  key={song.id}
                  className={cn('flex items-center gap-3 rounded-lg border p-3', glassSurfaceSubtle)}
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
