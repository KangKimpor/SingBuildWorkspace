import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMotionReduced, useSheetDrag } from '@/motion/hooks'
import { DURATION, EASE, REDUCED, exitDuration } from '@/motion/tokens'

/** Drawers and side sheets: iOS sheet curve, a full-panel move that stays inside the 200–500 ms drawer budget. */
const SHEET_ENTER = DURATION.slow
const SHEET_EXIT = exitDuration(DURATION.slow)

interface SideSheetProps {
  side: 'left' | 'right'
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  className: 'drawer' | 'rsheet'
  trigger?: ReactNode
  children: ReactNode
}

/** Overlay drawer (left) or right sheet on the Regular material over a dimmed scrim (§5, §11). */
export function SideSheet({
  side,
  open,
  onOpenChange,
  title,
  className,
  trigger,
  children,
}: SideSheetProps) {
  const reduced = useMotionReduced()
  const from = side === 'left' ? '-110%' : '110%'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              {/* The scrim moves with the panel: same start, same duration, same curve. */}
              <motion.div
                className="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: SHEET_EXIT, ease: EASE.drawer },
                }}
                transition={{ duration: SHEET_ENTER, ease: EASE.drawer }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className={`glass ${className}`}
                data-material="regular"
                initial={reduced ? { opacity: 0 } : { x: from }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        x: from,
                        transition: { duration: SHEET_EXIT, ease: EASE.drawer },
                      }
                }
                transition={reduced ? REDUCED : { duration: SHEET_ENTER, ease: EASE.drawer }}
              >
                <Dialog.Title className="sr-only">{title}</Dialog.Title>
                <div className="drawer-dismiss">
                  <Dialog.Close
                    className="ibtn"
                    aria-label={`Close ${title.toLowerCase()}`}
                  >
                    <X size={20} />
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}

interface BottomSheetProps {
  initial?: 'medium' | 'large'
  trigger?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

/** Touch bottom sheet: drag handle, medium (50%) and large (92%) detents, velocity dismissal (§11, §12). */
export function BottomSheet({
  initial = 'medium',
  trigger,
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      {open ? (
        <SheetBody title={title} initial={initial} onClose={() => onOpenChange(false)}>
          {children}
        </SheetBody>
      ) : null}
    </Dialog.Root>
  )
}

function SheetBody({
  initial,
  title,
  onClose,
  children,
}: {
  initial: 'medium' | 'large'
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const sheet = useSheetDrag({ onDismiss: onClose, initial })
  const { open, close } = sheet
  useEffect(() => {
    open(initial)
  }, [open, initial])

  return (
    <Dialog.Portal>
      <Dialog.Overlay asChild><motion.div className="scrim" style={{opacity:sheet.opacity}} onClick={close}/></Dialog.Overlay>
      <Dialog.Content
        asChild
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          close()
        }}
      >
        <motion.div
          className="glass bsheet"
          data-material="thick"
          {...sheet.sheetProps}
        >
          <div className="grabber" role="presentation" {...sheet.handleProps} />
          <Dialog.Title
            className="t-h3"
            style={{ marginBottom: 'var(--space-12)' }}
          >
            {title}
          </Dialog.Title>
          {initial === 'large' && <button className="ibtn" aria-label={`Close ${title.toLowerCase()}`} onClick={close} style={{ position: 'absolute', top: 'var(--space-16)', right: 'var(--space-16)' }}><X size={18} /></button>}
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
