import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CrossCalculatorPage } from './CrossCalculatorPage'
import { FieldManagementPage } from './FieldManagementPage'
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
          <div className="app-top-nav-source">
            <span className="app-top-nav-source-label">資料來源:</span>
            <div className="app-top-nav-source-links">
              <a
                href="https://www.ffxivgardening.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ffxivgardening.com
              </a>
              <a
                href="https://ff14.huijiwiki.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://ff14.huijiwiki.com
              </a>
            </div>
          </div>
        </div>
      </header>
      <main id="app-main" className="app-main">
        <Routes>
          <Route path="/" element={<SeedListPage />} />
          <Route path="/cross" element={<CrossCalculatorPage />} />
          <Route path="/fields" element={<FieldManagementPage />} />
          <Route path="/seed/:seedId" element={<SeedDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
