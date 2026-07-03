import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { playbackUrlForSong } from '@/lib/songPlayback'
import { songAudioUrl } from '@/lib/deviceApi'
import { useAppStore } from '@/store/useAppStore'

type PreviewSong = {
  id: string
  blobUrl?: string
  name: string
}

export function useSongPreview() {
  const deviceOnline = useAppStore((s) => s.deviceOnline)
  const volume = useAppStore((s) => s.volume)
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
      const src = playbackUrlForSong(song, deviceOnline)
      if (!src) {
        toast.info(`"${song.name}" is on the device only — connect to preview it here`)
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

      const audio = new Audio(src)
      audio.volume = volume / 100
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
          const fallback =
            deviceOnline && src === song.blobUrl ? songAudioUrl(song.id) : null
          if (fallback) {
            const retry = new Audio(fallback)
            retry.volume = volume / 100
            audioRef.current = retry
            retry.addEventListener('ended', onEnded)
            retry
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => {
                onEnded()
                toast.error('Could not play audio')
              })
            return
          }
          onEnded()
          toast.error('Could not play audio')
        })
    },
    [playingId, isPlaying, pause, resume, deviceOnline, volume],
  )

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  useEffect(() => () => stop(), [stop])

  return { playingId, isPlaying, togglePlay, stop, pause }
}
