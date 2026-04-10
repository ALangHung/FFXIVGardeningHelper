import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { CrossCalculatorPage } from './CrossCalculatorPage'
import { FieldManagementPage } from './FieldManagementPage'
import { HomePage } from './HomePage'
import { KnownIssuesPage } from './KnownIssuesPage'
import { TutorialPage } from './TutorialPage'
import { SeedDetailPage } from './SeedDetailPage'
import { SeedListPage } from './SeedListPage'
import { hasMarketAccess } from './marketAccess'
import { useUniversalisDc } from './useUniversalisDc'
import {
  clearCrossLastSeedDetailFromCross,
  clearFieldsLastSeedDetailFromFields,
  clearSeedListLastDetailFromList,
  crossTabTarget,
  fieldsTabTarget,
  getSeedDetailActiveSection,
  clearTutorialLastTopic,
  getTutorialLastTopic,
  isCrossSectionPath,
  isFieldsSectionPath,
  isListSectionSeedDetailPath,
  seedListTabTarget,
  setSeedDetailActiveSection,
} from './sessionUiState'

const UNIVERSALIS_DC_OPTIONS = [
  '陸行鳥',
  '巴哈姆特',
  '伊弗利特',
  '利維坦',
  '迦樓羅',
  '泰坦',
  '澳丁',
  '鳳凰',
]

function AppTopNav() {
  const location = useLocation()
  const path = location.pathname
  const seedListTarget = seedListTabTarget(path)
  const crossTarget = crossTabTarget(path)
  const fieldsTarget = fieldsTabTarget(path)
  const detailSection = getSeedDetailActiveSection()
  const [marketEnabled, setMarketEnabled] = useState(false)
  const [dcName, setDcName] = useUniversalisDc()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const enabled = await hasMarketAccess()
      if (!cancelled) setMarketEnabled(enabled)
    })()
    return () => {
      cancelled = true
    }
  }, [])
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
              if (detailSection === 'cross' && crossTarget === '/cross') {
                clearCrossLastSeedDetailFromCross()
              }
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
              if (detailSection === 'fields' && fieldsTarget === '/fields') {
                clearFieldsLastSeedDetailFromFields()
              }
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
        <div className="app-top-nav-actions">
          {marketEnabled && (
            <select
              className="app-top-nav-dc-select"
              value={dcName}
              onChange={(e) => setDcName(e.target.value)}
              aria-label="選擇伺服器"
            >
              {UNIVERSALIS_DC_OPTIONS.map((dc) => (
                <option key={dc} value={dc}>
                  {dc}
                </option>
              ))}
            </select>
          )}
          <NavLink
            to={path === '/tutorial' ? '/tutorial' : `/tutorial${(() => { const t = getTutorialLastTopic(); return t ? `#${t}` : '' })()}`}
            onClick={() => {
              if (path === '/tutorial') clearTutorialLastTopic()
            }}
            className={({ isActive }) =>
              `app-top-nav-tab${isActive ? ' app-top-nav-tab--active' : ''}`
            }
          >
            入門教學
          </NavLink>
          <NavLink
            to="/known-issues"
            className={({ isActive }) =>
              `app-top-nav-tab${isActive ? ' app-top-nav-tab--active' : ''}`
            }
          >
            已知問題
          </NavLink>
          <a
            href="https://forum.gamer.com.tw/C.php?bsn=17608&snA=29949"
            target="_blank"
            rel="noopener noreferrer"
            className="app-top-nav-tab app-top-nav-tab--report"
          >
            回報
          </a>
        </div>
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
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/known-issues" element={<KnownIssuesPage />} />
          <Route path="/seed/:seedId" element={<SeedDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
