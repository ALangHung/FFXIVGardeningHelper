import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CrossCalculatorPage } from './CrossCalculatorPage'
import { FieldManagementPage } from './FieldManagementPage'
import { HomePage } from './HomePage'
import { SeedDetailPage } from './SeedDetailPage'
import { SeedListPage } from './SeedListPage'

export function App() {
  return (
    <div className="app">
      <header className="app-top-nav">
        <div className="app-top-nav-inner">
          <nav className="app-top-nav-tabs" aria-label="主要功能">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `app-top-nav-tab${isActive ? ' app-top-nav-tab--active' : ''}`
              }
            >
              首頁
            </NavLink>
            <NavLink
              to="/seeds"
              className={({ isActive }) =>
                `app-top-nav-tab${isActive ? ' app-top-nav-tab--active' : ''}`
              }
            >
              種子列表
            </NavLink>
            <NavLink
              to="/cross"
              className={({ isActive }) =>
                `app-top-nav-tab${isActive ? ' app-top-nav-tab--active' : ''}`
              }
            >
              雜交計算器
            </NavLink>
            <NavLink
              to="/fields"
              className={({ isActive }) =>
                `app-top-nav-tab${isActive ? ' app-top-nav-tab--active' : ''}`
              }
            >
              田地管理
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="app-main" className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/seeds" element={<SeedListPage />} />
          <Route path="/cross" element={<CrossCalculatorPage />} />
          <Route path="/fields" element={<FieldManagementPage />} />
          <Route path="/seed/:seedId" element={<SeedDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
