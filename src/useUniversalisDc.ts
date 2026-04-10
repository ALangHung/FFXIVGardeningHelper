import { useCallback, useSyncExternalStore } from 'react'
import {
  getUniversalisDc,
  setUniversalisDc,
  UNIVERSALIS_DC_EVENT,
} from './seedDataApi'

function subscribe(onStoreChange: () => void): () => void {
  const handleCustom = () => onStoreChange()
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'universalis_dc') onStoreChange()
  }
  window.addEventListener(UNIVERSALIS_DC_EVENT, handleCustom)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(UNIVERSALIS_DC_EVENT, handleCustom)
    window.removeEventListener('storage', handleStorage)
  }
}

export function useUniversalisDc(): [string, (dc: string) => void] {
  const dc = useSyncExternalStore(subscribe, getUniversalisDc, getUniversalisDc)
  const set = useCallback((v: string) => setUniversalisDc(v), [])
  return [dc, set]
}
