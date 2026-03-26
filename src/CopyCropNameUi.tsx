import { type AnimationEvent } from 'react'
import { copyTextToClipboard } from './copyTextToClipboard'
import './CopyCropNameUi.css'

export function CopyCropNameButton({
  name,
  onCopied,
  className,
}: {
  name: string
  onCopied: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={['copy-crop-name-btn', className].filter(Boolean).join(' ')}
      aria-label={`複製作物名稱：${name}`}
      title="複製作物名稱"
      onClick={() => {
        void (async () => {
          const ok = await copyTextToClipboard(name)
          if (ok) onCopied()
        })()
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="copy-crop-name-icon"
        aria-hidden
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  )
}

export function CopyCropNameToast({
  toastKey,
  onDismiss,
}: {
  toastKey: number | null
  onDismiss: () => void
}) {
  if (toastKey == null) return null
  return (
    <div
      key={toastKey}
      className="copy-crop-name-toast"
      role="status"
      aria-live="polite"
      onAnimationEnd={(e: AnimationEvent<HTMLDivElement>) => {
        if (e.animationName !== 'copy-crop-name-toast-fade') return
        onDismiss()
      }}
    >
      已複製作物名稱
    </div>
  )
}
