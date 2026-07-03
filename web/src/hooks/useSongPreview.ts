import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type PreviewSong = {
  id: string
  blobUrl?: string
  name: string
}

export function useSongPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayingId(null)
    setIsPlaying(false)
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => toast.error('Could not play audio'))
  }, [])

  const togglePlay = useCallback(
    (song: PreviewSong) => {
      if (!song.blobUrl) {
        toast.info(`"${song.name}" is a sample — upload a real file to play it`)
        return
      }

      if (playingId === song.id) {
        if (isPlaying) pause()
        else resume()
        return
      }

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const audio = new Audio(song.blobUrl)
      audioRef.current = audio
      setPlayingId(song.id)

      const onEnded = () => {
        setPlayingId(null)
        setIsPlaying(false)
        audioRef.current = null
      }
      audio.addEventListener('ended', onEnded)

      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          onEnded()
          toast.error('Could not play audio')
        })
    },
    [playingId, isPlaying, pause, resume],
  )

  useEffect(() => () => stop(), [stop])

  return { playingId, isPlaying, togglePlay, stop, pause }
}
