import { Link } from 'react-router-dom'
import './HomePage.css'

function IconLeaf(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 2 8.8a7 7 0 0 1-10 9.2z" />
      <path d="M12 20v-7" />
    </svg>
  )
}

function IconBook(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function IconCode(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function IconSparkles(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  )
}

export function HomePage() {
  return (
    <div className="home-page">
      <header className="home-page-header">
        <h1 className="home-page-title">FFXIV 園藝小幫手</h1>
        <p className="home-page-lead">園藝資料查詢與雜交規劃</p>
      </header>

      <section className="home-section" aria-labelledby="home-intro-heading">
        <h2 id="home-intro-heading" className="home-section-title">
          使用簡介
        </h2>
        <div className="home-section-body home-intro">
          <p className="home-intro-lead">
            《FFXIV 園藝小幫手》是《最終幻想 XIV》園藝用的工具網頁，此專案為玩家社群工具，遊戲內名稱、圖示與數值之版權歸 Square Enix 與相關權利人所有。
          </p>
          <p className="home-intro-lead">
            所有搜尋種子的地方都支援繁體中文、簡體中文、日文、英文的輸入！
          </p>
          <p className="home-intro-lead">
            所有遊戲道具名稱旁皆帶有複製按鈕可以快速複製道具名稱！
          </p>
          <p className="home-intro-lead">
            上方導覽列可切換各頁面：
          </p>
          <ul className="home-intro-list">
            <li>
              <Link to="/seeds" className="seed-name-link">
                種子列表
              </Link>
              ：瀏覽全部種子，依名稱、生長時間、採集地點篩選與排序、點選列可開啟詳情。
            </li>
            <li>
              <strong>種子詳情</strong>
              ：檢視單一種子的說明、已確認雜交表、作物／種子產量，以及盆栽染色等相關資訊。
            </li>
            <li>
              <Link to="/cross" className="seed-name-link">
                雜交計算器
              </Link>
              ：輸入兩個親代推算雜交結果，或由其中一個親代跟目標子代反查可能的另一親代。
            </li>
            <li>
              <Link to="/fields" className="seed-name-link">
                田地管理
              </Link>
              ：在格狀田地上配置種子、模擬雜交結果、收成時間預估；田地資料儲存在本機，關閉分頁或瀏覽器後仍會保留。
            </li>
            <li>
              <Link to="/tutorial" className="seed-name-link">
                入門教學
              </Link>
              ：包含種田基礎概念、基礎雜交與 3+5 雜交兩種常見種法的圖文教學。
            </li>
            <li>
              <Link to="/known-issues" className="seed-name-link">
                已知問題
              </Link>
              ：將FFXIV Gardening的雜交結果為三種以上，有疑慮的資料從使用的資料中排除，先記錄在這裡，之後養老的時候在嘗試驗證看看。
            </li>
          </ul>
          <p className="home-intro-note">
            首頁下方「致謝」可連至本專案參考的社群資料網站；實際遊戲內容仍以版本與 Square Enix 官方為準。
          </p>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-author-heading">
        <h2 id="home-author-heading" className="home-section-title">
          作者介紹
        </h2>
        <div className="home-section-body home-author">
          <p className="home-author-text">
            我是繁中服鳳凰伺服器的阿狼，希望這個練習使用AI開發的專案對你有所幫助。
          </p>
          <p className="home-author-donate-line">
            如果非常喜歡的話可以按這個按鈕
            <a
              href="https://ko-fi.com/alanoao"
              className="home-author-donate-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              斗內
            </a>
          </p>
        </div>
      </section>

      <section
        className="home-section home-thanks-section"
        aria-labelledby="home-thanks-heading"
      >
        <header className="home-thanks-header">
          <h2 id="home-thanks-heading" className="home-thanks-title">
            致謝
          </h2>
          <p className="home-thanks-lead">
            感謝以下優秀的網站提供的公開資料與服務，才得以完成此專案。
          </p>
        </header>

        <div className="home-thanks-grid">
          <a
            className="home-thanks-card"
            href="https://www.ffxivgardening.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="home-thanks-card-icon home-thanks-card-icon--garden">
              <IconLeaf className="home-thanks-card-icon-svg" />
            </div>
            <div className="home-thanks-card-body">
              <div className="home-thanks-card-name">FFXIV Gardening</div>
              <p className="home-thanks-card-desc">
                種子、雜交配方與園藝資訊主要來源
              </p>
            </div>
          </a>

          <a
            className="home-thanks-card"
            href="https://ff14.huijiwiki.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="home-thanks-card-icon home-thanks-card-icon--wiki">
              <IconBook className="home-thanks-card-icon-svg" />
            </div>
            <div className="home-thanks-card-body">
              <div className="home-thanks-card-name">灰機 Wiki</div>
              <p className="home-thanks-card-desc">
                中文名稱與詞彙對照參考
              </p>
            </div>
          </a>

          <a
            className="home-thanks-card"
            href="https://github.com/ffxiv-teamcraft/ffxiv-teamcraft"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="home-thanks-card-icon home-thanks-card-icon--code">
              <IconCode className="home-thanks-card-icon-svg" />
            </div>
            <div className="home-thanks-card-body">
              <div className="home-thanks-card-name">FFXIV Teamcraft</div>
              <p className="home-thanks-card-desc">
                道具多語言資料來源
              </p>
            </div>
          </a>

          <a
            className="home-thanks-card"
            href="https://beherw.github.io/FFXIV_Market/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="home-thanks-card-icon home-thanks-card-icon--style">
              <IconSparkles className="home-thanks-card-icon-svg" />
            </div>
            <div className="home-thanks-card-body">
              <div className="home-thanks-card-name">
                繁中 XIV 市場｜貝爾的市場小屋
              </div>
              <p className="home-thanks-card-desc">網站美術風格參考</p>
            </div>
          </a>
        </div>
      </section>
    </div>
  )
}
