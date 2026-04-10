import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { publicUrl } from './publicUrl'
import multiOutcomeReportRaw from '../reports/multi-outcome-cross-pairs.txt?raw'
import './KnownIssuesPage.css'

type ReportOutcomeRow = {
  outcomeSeedId: number
  outcomeName: string
  kind: 'primary' | 'alternate'
}

type ReportPairBlock = {
  parentA: number
  parentB: number
  parentNameA: string
  parentNameB: string
  outcomeCount: number
  outcomes: ReportOutcomeRow[]
}

type ParsedMultiOutcomeReport = {
  pairs: ReportPairBlock[]
}

/**
 * 解析 scripts/list-multi-outcome-cross-pairs.mjs 產生之
 * reports/multi-outcome-cross-pairs.txt
 */
function parseMultiOutcomeReport(text: string): ParsedMultiOutcomeReport {
  const lines = text.split(/\r?\n/)

  const headerRe =
    /^【(\d+)\s*種結果】親代\s+(\d+)（([^）]*)）\s*×\s*(\d+)（([^）]*)）/
  const bulletRe = /^\s*·\s*(\d+)\t(.+)\t\[(primary|alternate)\]\s*$/

  const pairs: ReportPairBlock[] = []
  let current: ReportPairBlock | null = null

  for (const line of lines) {
    const hm = line.match(headerRe)
    if (hm) {
      current = {
        parentA: Number(hm[2]),
        parentB: Number(hm[4]),
        parentNameA: hm[3].trim(),
        parentNameB: hm[5].trim(),
        outcomeCount: Number(hm[1]),
        outcomes: [],
      }
      pairs.push(current)
      continue
    }
    const bm = line.match(bulletRe)
    if (bm && current) {
      current.outcomes.push({
        outcomeSeedId: Number(bm[1]),
        outcomeName: bm[2].trim(),
        kind: bm[3] as 'primary' | 'alternate',
      })
    }
  }

  return { pairs }
}

export function KnownIssuesPage() {
  const parsed = useMemo(
    () => parseMultiOutcomeReport(multiOutcomeReportRaw),
    [],
  )

  return (
    <div className="known-issues-page">
      <header className="known-issues-header">
        <h1 className="known-issues-title">已知問題</h1>
        <p className="known-issues-lead">
          雜交資料從 FFXIV Gardening 獲取，絕大部分雜交結果最多兩種可能，以下雜交結果為三種以上的雜交結果，已將有疑慮的資料從使用的資料中排除。之後養老的時候在嘗試驗證看看。
        </p>
      </header>

      {parsed.pairs.length === 0 ? (
        <p className="known-issues-muted">目前沒有符合條件的組合。</p>
      ) : (
        <ul className="known-issues-list">
          {parsed.pairs.map((row) => (
            <li
              key={`${row.parentA}-${row.parentB}`}
              className="known-issues-card"
            >
              <h2 className="known-issues-card-title">
                <span className="known-issues-pair">
                  <span className="seed-name-cell">
                    <img
                      src={publicUrl(`images/seed-icon/${row.parentA}.png`)}
                      alt=""
                      width={28}
                      height={28}
                      className="seed-row-icon"
                      loading="lazy"
                    />
                    <Link
                      to={`/seed/${row.parentA}`}
                      className="seed-name-link"
                    >
                      {row.parentNameA || '（無名稱）'}
                    </Link>
                  </span>
                  <span className="known-issues-cross" aria-hidden>
                    ×
                  </span>
                  <span className="seed-name-cell">
                    <img
                      src={publicUrl(`images/seed-icon/${row.parentB}.png`)}
                      alt=""
                      width={28}
                      height={28}
                      className="seed-row-icon"
                      loading="lazy"
                    />
                    <Link
                      to={`/seed/${row.parentB}`}
                      className="seed-name-link"
                    >
                      {row.parentNameB || '（無名稱）'}
                    </Link>
                  </span>
                </span>
                <span className="known-issues-badge">
                  {row.outcomeCount} 種可能結果
                </span>
              </h2>
              <p className="known-issues-outcomes-label">可能結果</p>
              <ul className="known-issues-outcomes">
                {row.outcomes.map((o) => (
                  <li key={`${o.outcomeSeedId}-${o.kind}`}>
                    <span className="seed-name-cell">
                      <img
                        src={publicUrl(
                          `images/seed-icon/${o.outcomeSeedId}.png`,
                        )}
                        alt=""
                        width={28}
                        height={28}
                        className="seed-row-icon"
                        loading="lazy"
                      />
                      <Link
                        to={`/seed/${o.outcomeSeedId}`}
                        className={
                          o.kind === 'alternate'
                            ? 'seed-name-link known-issues-outcome--alternate'
                            : 'seed-name-link'
                        }
                      >
                        {o.outcomeName}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
