import type { LoadedImage } from '../types/audit'

/** Decodes an image from any URL (blob:, data:, http:) and reads its natural size. */
export async function loadImageFromUrl(url: string, name: string): Promise<LoadedImage> {
  const element = new Image()
  element.decoding = 'sync'
  element.src = url
  try {
    await element.decode()
  } catch {
    throw new Error(`"${name}" could not be decoded as an image`)
  }
  if (element.naturalWidth === 0 || element.naturalHeight === 0) {
    throw new Error(`"${name}" has no pixel data`)
  }
  return {
    name,
    url,
    element,
    width: element.naturalWidth,
    height: element.naturalHeight,
  }
}

export async function loadImageFromBlob(blob: Blob, name: string): Promise<LoadedImage> {
  if (!blob.type.startsWith('image/')) {
    throw new Error(`"${name}" is not an image (${blob.type || 'unknown type'})`)
  }
  const url = URL.createObjectURL(blob)
  try {
    return await loadImageFromUrl(url, name)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/** Frees the object URL of an image that is being replaced. */
export function disposeImage(image: LoadedImage | null): void {
  if (image && image.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
}

export function firstImageFile(files: FileList | File[] | null | undefined): File | null {
  if (!files) return null
  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return firstImageFile(data.files)
}
