import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { CrossCalculatorPage } from './CrossCalculatorPage'
import { FieldManagementPage } from './FieldManagementPage'
import { HomePage } from './HomePage'
import { SeedDetailPage } from './SeedDetailPage'
import { SeedListPage } from './SeedListPage'
import {
  clearSeedListLastDetailFromList,
  crossTabTarget,
  fieldsTabTarget,
  getSeedDetailActiveSection,
  isCrossSectionPath,
  isFieldsSectionPath,
  isListSectionSeedDetailPath,
  seedListTabTarget,
  setSeedDetailActiveSection,
} from './sessionUiState'

function AppTopNav() {
  const location = useLocation()
  const path = location.pathname
  const seedListTarget = seedListTabTarget(path)
  const crossTarget = crossTabTarget(path)
  const fieldsTarget = fieldsTabTarget(path)
  const detailSection = getSeedDetailActiveSection()
  const seedListTabActive =
    path === '/seeds' ||
    (isListSectionSeedDetailPath(path) && detailSection === 'list')
  const crossTabActive =
    isCrossSectionPath(path) ||
    (isListSectionSeedDetailPath(path) && detailSection === 'cross')
  const fieldsTabActive =
    isFieldsSectionPath(path) ||
    (isListSectionSeedDetailPath(path) && detailSection === 'fields')

  return (
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
            to={seedListTarget}
            onClick={() => {
              if (
                isListSectionSeedDetailPath(path) &&
                detailSection === 'list'
              ) {
                clearSeedListLastDetailFromList()
              }
              if (seedListTarget.startsWith('/seed/')) {
                setSeedDetailActiveSection('list')
              }
            }}
            className={() =>
              `app-top-nav-tab${seedListTabActive ? ' app-top-nav-tab--active' : ''}`
            }
          >
            種子列表
          </NavLink>
          <NavLink
            to={crossTarget}
            onClick={() => {
              if (crossTarget.startsWith('/seed/')) {
                setSeedDetailActiveSection('cross')
              }
            }}
            className={() =>
              `app-top-nav-tab${crossTabActive ? ' app-top-nav-tab--active' : ''}`
            }
          >
            雜交計算器
          </NavLink>
          <NavLink
            to={fieldsTarget}
            onClick={() => {
              if (fieldsTarget.startsWith('/seed/')) {
                setSeedDetailActiveSection('fields')
              }
            }}
            className={() =>
              `app-top-nav-tab${fieldsTabActive ? ' app-top-nav-tab--active' : ''}`
            }
          >
            田地管理
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export function App() {
  return (
    <div className="app">
      <AppTopNav />
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
