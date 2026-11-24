import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ImagePlus, X } from 'lucide-react'
import {
  codeOf,
  colPatchValue,
  effectiveCol,
  effectiveImages,
  imagesPatchValue,
  MAX_LONG_TEXT,
  MAX_SHORT_TEXT,
  parseTextInput,
} from './formulas'
import { deleteMatImages, isStorageRef, MAX_IMAGES_PER_SET, uploadMatImage, useMatImageSrc } from './images'
import type { OnFields } from './MatCells'
import { SOURCE_COLS } from './types'
import type { FieldKey, FieldValue, ImageSet, MatItem } from './types'

export interface MatPicture { ref: string; alt: string; itemId?: string }

export interface MatSourcePanelProps {
  item: MatItem | null
  picOptions: string[]
  pictureOpen?: boolean
  onClose: () => void
  onFields: OnFields
  onPicture: (picture: MatPicture) => void
}

type SourceCol = (typeof SOURCE_COLS)[number]
type DraftCols = Record<SourceCol, string>

function PanelImg({ srcRef, alt }: { srcRef: string; alt: string }) {
  const src = useMatImageSrc(srcRef)
  if (!src) return <span className="mat-img-loading" aria-hidden="true"/>
  return <img src={src} alt={alt}/>
}

function initialCols(item: MatItem): DraftCols {
  const out = {} as DraftCols
  for (const col of SOURCE_COLS) {
    const val = effectiveCol(item, col)
    out[col] = val === null || val === undefined ? '' : String(val)
  }
  return out
}

export function MatSourcePanel({ item, picOptions, pictureOpen = false, onClose, onFields, onPicture }: MatSourcePanelProps) {
  // Keep the last item on screen while the panel slides out, so it does not leave empty.
  const [lastItem, setLastItem] = useState(item)
  if (item && item !== lastItem) setLastItem(item)
  const shown = item ?? lastItem
  return <Dialog.Root open={!!item} modal={!pictureOpen} onOpenChange={(open) => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="mat-scrim"/>
      <Dialog.Content className="mat-source-panel" aria-describedby={undefined}
        onPointerDownOutside={(e) => { if (pictureOpen) e.preventDefault() }}
        onInteractOutside={(e) => { if (pictureOpen) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (pictureOpen) e.preventDefault() }}>
        {shown && <SourceForm key={shown.id} item={shown} picOptions={picOptions}
          onClose={onClose} onFields={onFields} onPicture={onPicture}/>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

interface SourceFormProps {
  item: MatItem
  picOptions: string[]
  onClose: () => void
  onFields: OnFields
  onPicture: (picture: MatPicture) => void
}

function SourceForm({ item, picOptions, onClose, onFields, onPicture }: SourceFormProps) {
  const code = codeOf(item)
  // MEP rows keep no Person In Charge: the sheet hides the column and the tracker leaves it out.
  const cols = item.sheet === 'mep' ? SOURCE_COLS.filter((c) => c !== 'pic') : SOURCE_COLS
  const [initial] = useState<DraftCols>(() => initialCols(item))
  const [initialImages] = useState<{ image: string[]; sample: string[] }>(() => ({
    image: effectiveImages(item, 'image'),
    sample: effectiveImages(item, 'sample'),
  }))
  const [draft, setDraft] = useState<DraftCols>(() => ({ ...initial }))
  const [images, setImages] = useState<{ image: string[]; sample: string[] }>(() => ({
    image: [...initialImages.image],
    sample: [...initialImages.sample],
  }))
  const [uploading, setUploading] = useState<ImageSet | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const uploadedInSession = useRef<string[]>([])
  const savedCleanly = useRef(false)
  const picListId = useId()
  const formId = useId()

  useEffect(() => () => {
    if (!savedCleanly.current && uploadedInSession.current.length > 0) {
      void deleteMatImages(uploadedInSession.current)
      uploadedInSession.current = []
    }
  }, [])

  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])
  const hasChanges = cols.some((c) => draft[c].trim() !== initial[c])
    || !sameList(images.image, initialImages.image)
    || !sameList(images.sample, initialImages.sample)

  function setCol(col: SourceCol, value: string) {
    setDraft((old) => ({ ...old, [col]: value }))
    setSaveError(null)
  }

  function removePhoto(set: ImageSet, index: number) {
    setImages((old) => ({ ...old, [set]: old[set].filter((_, i) => i !== index) }))
    setSaveError(null)
  }

  async function handleUpload(set: ImageSet, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploadError(null)
    setUploading(set)
    try {
      let count = images[set].length
      for (const file of files) {
        if (count >= MAX_IMAGES_PER_SET) {
          setUploadError(`You can attach at most ${MAX_IMAGES_PER_SET} photos per column.`)
          break
        }
        const ref = await uploadMatImage(item.id, set, file)
        uploadedInSession.current.push(ref)
        count += 1
        setImages((old) => ({ ...old, [set]: [...old[set], ref] }))
      }
    } catch (err) {
      setUploadError(err instanceof Error && err.message ? err.message : 'Could not upload photo.')
    } finally {
      setUploading(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!hasChanges || saving || uploading) return
    const patch: Partial<Record<FieldKey, FieldValue>> = {}
    try {
      for (const col of cols) {
        const limit = col === 'description' || col === 'spec' ? MAX_LONG_TEXT : MAX_SHORT_TEXT
        const next = parseTextInput(draft[col], limit)
        if (next !== initial[col]) {
          patch[col] = colPatchValue(item, col, next)
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Invalid field value.')
      return
    }
    if (!sameList(images.image, initialImages.image)) {
      patch.image = imagesPatchValue(item, 'image', images.image)
    }
    if (!sameList(images.sample, initialImages.sample)) {
      patch.sample = imagesPatchValue(item, 'sample', images.sample)
    }
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const kept = new Set([...images.image, ...images.sample])
      const candidates = new Set([
        ...initialImages.image,
        ...initialImages.sample,
        ...uploadedInSession.current,
      ])
      const orphans = [...candidates].filter((ref) => isStorageRef(ref) && !kept.has(ref))
      await onFields(item.id, patch)
      savedCleanly.current = true
      uploadedInSession.current = []
      void deleteMatImages(orphans)
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <div className="mat-source-head">
      <div>
        <Dialog.Title className="mat-source-title">Material Source</Dialog.Title>
        <p className="mat-source-sub">{code}</p>
      </div>
      <Dialog.Close className="mat-source-close" aria-label="Close material source">
        <X size={16} aria-hidden="true"/>
      </Dialog.Close>
    </div>
    <form id={formId} className="mat-source-body" onSubmit={(e) => void handleSubmit(e)}>
      <div className="mat-source-grid">
        <label className="mat-field">
          <span>No</span>
          <input value={draft.no} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('no', e.target.value)}/>
        </label>
        <label className="mat-field">
          <span>Code</span>
          <input className="mat-source-mono" value={draft.code} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('code', e.target.value)}/>
        </label>
      </div>
      <label className="mat-field">
        <span>Description</span>
        <textarea rows={3} value={draft.description} maxLength={MAX_LONG_TEXT} onChange={(e) => setCol('description', e.target.value)}/>
      </label>
      <div className="mat-source-grid">
        {item.sheet !== 'mep' && <>
          <label className="mat-field">
            <span>Person In Charge</span>
            <input list={picListId} value={draft.pic} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('pic', e.target.value)}/>
          </label>
          <datalist id={picListId}>{picOptions.map((p) => <option key={p} value={p}>{p}</option>)}</datalist>
        </>}
        <label className="mat-field">
          <span>BP02 Mat Approval</span>
          <input value={draft.bp02} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('bp02', e.target.value)}/>
        </label>
      </div>
      <label className="mat-field">
        <span>Location</span>
        <input value={draft.location} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('location', e.target.value)}/>
      </label>
      {([
        ['image', 'Image'],
        ['sample', 'Approved Sample'],
      ] as const).map(([set, label]) => {
        const list = images[set]
        const disabled = !!uploading || list.length >= MAX_IMAGES_PER_SET
        return <fieldset key={set} className="mat-source-photos">
          <legend>{label} <span className="muted">({list.length}/{MAX_IMAGES_PER_SET})</span></legend>
          <div className="mat-source-thumbs">
            {list.map((ref, i) => <div key={`${ref}-${i}`} className="mat-source-thumb">
              <button type="button" className="mat-source-thumb-img" aria-label={`Preview ${label} ${i + 1}`}
                onClick={() => onPicture({ ref, alt: `${code} ${label} ${i + 1}` })}>
                <PanelImg srcRef={ref} alt={`${code} ${label} ${i + 1}`}/>
              </button>
              <button type="button" className="mat-source-thumb-remove" aria-label={`Remove ${label} ${i + 1}`}
                onClick={() => removePhoto(set, i)}>
                <X size={12} aria-hidden="true"/>
              </button>
            </div>)}
            <label className="btn-secondary mat-upload-btn" aria-disabled={disabled || undefined}>
              <ImagePlus size={14} aria-hidden="true"/>
              <span>{uploading === set ? 'Uploading…' : 'Add photo'}</span>
              <input type="file" hidden accept="image/jpeg,image/png,image/webp" multiple
                aria-label={`Add ${label} photo`} disabled={disabled}
                onChange={(e) => void handleUpload(set, e)}/>
            </label>
          </div>
        </fieldset>
      })}
      {uploadError && <p className="mat-source-error" role="alert">{uploadError}</p>}
      <label className="mat-field">
        <span>Specification</span>
        <textarea rows={4} value={draft.spec} maxLength={MAX_LONG_TEXT} onChange={(e) => setCol('spec', e.target.value)}/>
      </label>
      <div className="mat-source-grid">
        <label className="mat-field">
          <span>Brand</span>
          <input value={draft.brand} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('brand', e.target.value)}/>
        </label>
        <label className="mat-field">
          <span>Source Location</span>
          <input value={draft.source} maxLength={MAX_SHORT_TEXT} onChange={(e) => setCol('source', e.target.value)}/>
        </label>
      </div>
    </form>
    <div className="mat-source-foot">
      {saveError && <p className="mat-source-error" role="alert">{saveError}</p>}
      <div className="mat-source-actions">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" form={formId} className="btn-accent" disabled={!hasChanges || saving || !!uploading}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  </>
}
