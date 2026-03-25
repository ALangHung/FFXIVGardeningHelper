/** 對應 Vite `base`（例如 GitHub Pages 子路徑）的公開資源 URL */
export function publicUrl(path: string): string {
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${p}`
}
