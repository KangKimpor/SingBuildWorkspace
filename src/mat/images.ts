import { useEffect, useState } from 'react'
import { initializeSupabase } from '@/lib/supabase'
import type { ImageSet } from './types'

export const MAX_IMAGES_PER_SET = 10
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_RESIZED_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const MAX_LONG_SIDE = 960
const SIGNED_TTL_MS = 45 * 60_000
const BUCKET = 'kw-mat-images'

const urlCache = new Map<string, { url: string; expiresAt: number }>()
const inflight = new Map<string, Promise<string>>()

export const isStorageRef = (ref: string) => ref.startsWith('storage:')

function extFor(mime: string): string {
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/png') return 'png'
  return 'jpg'
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, quality))
}

/** Validates image MIME/size and shrinks to max 960 px WebP (with JPEG/raw fallback). */
async function resizeImage(file: File): Promise<{ blob: Blob; contentType: string; ext: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Use an image up to 10 MB.')

  if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(file)
      const longSide = Math.max(bitmap.width, bitmap.height)
      const scale = longSide > MAX_LONG_SIDE ? MAX_LONG_SIDE / longSide : 1
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height)
        let blob = await canvasToBlob(canvas, 'image/webp', 0.82)
        if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.85)
        if (blob && blob.size <= MAX_RESIZED_BYTES) {
          return { blob, contentType: blob.type, ext: extFor(blob.type) }
        }
      }
    } catch {
      // Fall back to the original file if decoding/canvas fails (e.g. headless DOM environments).
    } finally {
      bitmap?.close?.()
    }
  }

  if (file.size > MAX_RESIZED_BYTES) throw new Error('Image must be 5 MB or smaller after compression.')
  return { blob: file, contentType: file.type, ext: extFor(file.type) }
}

/** Uploads one photo to the private `kw-mat-images` bucket and primes the local URL cache. */
export async function uploadMatImage(itemId: string, set: ImageSet, file: File): Promise<string> {
  const client = await initializeSupabase()
  if (!client) throw new Error('Sign in to continue.')
  const { blob, contentType, ext } = await resizeImage(file)
  const path = `${itemId}/${set}/${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType })
  if (error) throw new Error(error.message)
  const ref = `storage:${path}`
  if (typeof URL.createObjectURL === 'function') {
    urlCache.set(ref, { url: URL.createObjectURL(blob), expiresAt: Date.now() + SIGNED_TTL_MS })
  }
  return ref
}

/** Best-effort removal of orphaned `storage:` photos from `kw-mat-images`. */
export async function deleteMatImages(refs: string[]): Promise<void> {
  const paths = refs.filter(isStorageRef).map((r) => r.slice(8))
  if (paths.length === 0) return
  for (const ref of refs) if (isStorageRef(ref)) urlCache.delete(ref)
  try {
    const client = await initializeSupabase()
    if (client) await client.storage.from(BUCKET).remove(paths)
  } catch {
    // Cleanup is best-effort; database references are already removed.
  }
}

/** Resolves either a `/mat/` static hash or a private `storage:` ref into a displayable URL. */
async function resolveMatImage(ref: string): Promise<string> {
  if (!isStorageRef(ref)) return `/mat/${ref}`
  const cached = urlCache.get(ref)
  if (cached && cached.expiresAt > Date.now()) return cached.url
  const pending = inflight.get(ref)
  if (pending) return pending
  const run = (async () => {
    const client = await initializeSupabase()
    if (!client) throw new Error('Sign in to continue.')
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(ref.slice(8), 3600)
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not load image.')
    urlCache.set(ref, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_TTL_MS })
    return data.signedUrl
  })().finally(() => {
    inflight.delete(ref)
  })
  inflight.set(ref, run)
  return run
}

/** Synchronous URL for `/mat/` hashes and cached uploads; signs `storage:` refs on demand. */
export function useMatImageSrc(ref: string): string | null {
  const syncUrl = !isStorageRef(ref)
    ? `/mat/${ref}`
    : (() => {
        const cached = urlCache.get(ref)
        return cached && cached.expiresAt > Date.now() ? cached.url : null
      })()
  const [resolved, setResolved] = useState<{ ref: string; url: string | null } | null>(null)
  useEffect(() => {
    if (syncUrl !== null) return
    let live = true
    void resolveMatImage(ref).then(
      (url) => { if (live) setResolved({ ref, url }) },
      () => { if (live) setResolved({ ref, url: null }) },
    )
    return () => { live = false }
  }, [ref, syncUrl])
  if (syncUrl !== null) return syncUrl
  return resolved?.ref === ref ? resolved.url : null
}
