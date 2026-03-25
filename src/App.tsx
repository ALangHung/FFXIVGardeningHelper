import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SeedDetailPage } from './SeedDetailPage'
import { SeedListPage } from './SeedListPage'

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<SeedListPage />} />
        <Route path="/seed/:seedId" element={<SeedDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
