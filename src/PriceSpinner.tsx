import './PriceSpinner.css'

export function PriceSpinner() {
  return (
    <span
      className="seed-price-spinner"
      role="status"
      aria-label="載入市場價格中"
    >
      <span className="seed-price-spinner-ring" aria-hidden />
    </span>
  )
}
