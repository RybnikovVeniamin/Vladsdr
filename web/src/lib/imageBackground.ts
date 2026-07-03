const MAX_WIDTH = 1200
const MAX_HEIGHT = 2000
const JPEG_QUALITY = 0.82

export function readImageAsBackgroundDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unavailable'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('could not load image'))
    }

    img.src = objectUrl
  })
}
