const MARKET_ACCESS_KEY = 'why_do_you_know_this'
const MARKET_ACCESS_SHA256 =
  '8240f063424566e0177ac582ac9527998c997e4418b3a76c5faff4ac4812b770'

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export async function hasMarketAccess(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false
    }
    const raw = localStorage.getItem(MARKET_ACCESS_KEY)
    if (raw == null || raw === '') return false
    if (!window.crypto?.subtle) return false
    const data = new TextEncoder().encode(raw)
    const digest = await window.crypto.subtle.digest('SHA-256', data)
    const hex = bytesToHex(new Uint8Array(digest))
    return hex === MARKET_ACCESS_SHA256
  } catch {
    return false
  }
}
