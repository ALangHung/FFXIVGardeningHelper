import './SearchClearButton.css'

type Props = {
  /** 避免點擊時輸入框先 blur（例如 combobox） */
  preventMousedownBlur?: boolean
  onClear: () => void
  ariaLabel?: string
}

export function SearchClearButton({
  preventMousedownBlur,
  onClear,
  ariaLabel = '清除',
}: Props) {
  return (
    <button
      type="button"
      className="app-search-clear"
      aria-label={ariaLabel}
      onMouseDown={
        preventMousedownBlur
          ? (e) => {
              e.preventDefault()
            }
          : undefined
      }
      onClick={() => onClear()}
    >
      <span className="app-search-clear-glyph" aria-hidden>
        ×
      </span>
    </button>
  )
}
