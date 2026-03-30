import { type AnimationEvent } from 'react'
import { copyTextToClipboard } from './copyTextToClipboard'
import './CopyCropNameUi.css'

export function CopyCropNameButton({
  name,
  onCopied,
  className,
  ariaLabel,
  title,
}: {
  name: string
  /** 成功時傳入已寫入剪貼簿的文字（與 name 相同） */
  onCopied: (copiedText: string) => void
  className?: string
  /** 未傳則為複製作物名稱 */
  ariaLabel?: string
  title?: string
}) {
  const label = ariaLabel ?? `複製作物名稱：${name}`
  const tip = title ?? '複製作物名稱'
  return (
    <button
      type="button"
      className={['copy-crop-name-btn', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={tip}
      onClick={() => {
        void (async () => {
          const ok = await copyTextToClipboard(name)
          if (ok) onCopied(name)
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
  message = '已複製',
  onDismiss,
}: {
  toastKey: number | null
  message?: string
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
      {message}
    </div>
  )
}
