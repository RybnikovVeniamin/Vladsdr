const AVATAR_SIZE = 50

export function readImageAsAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unavailable'))
        return
      }

      const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (AVATAR_SIZE - w) / 2, (AVATAR_SIZE - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('could not load image'))
    }

    img.src = objectUrl
  })
}
