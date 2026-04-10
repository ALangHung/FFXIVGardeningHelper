import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { publicUrl } from './publicUrl'
import { getTutorialLastTopic, setTutorialLastTopic } from './sessionUiState'
import './TutorialPage.css'

const TUTORIAL_TOPICS = [
  { id: 'basics', label: '基礎教學' },
  { id: 'basic-cross', label: '基礎雜交' },
  { id: '3-5-cross', label: '3+5雜交' },
] as const

type TopicId = (typeof TUTORIAL_TOPICS)[number]['id']

function topicFromHash(hash: string): TopicId | null {
  const id = hash.replace(/^#/, '')
  if (id === 'basics' || id === 'basic-cross' || id === '3-5-cross') {
    return id
  }
  return null
}

type TutorialBasicsProps = {
  selectTopic: (id: TopicId) => void
}

function TutorialBasicsContent({ selectTopic }: TutorialBasicsProps) {
  return (
    <div className="tutorial-prose">
      <section className="tutorial-section" aria-labelledby="tutorial-basics-seed">
        <h3 id="tutorial-basics-seed" className="tutorial-h3">
          種子
        </h3>

        <h4 className="tutorial-h4">獲得方式</h4>
        <p>
          主要獲得來源為透過園藝採集、跟 NPC 購入、雜交。
        </p>

        <h4 className="tutorial-h4">生長時間</h4>
        <p>種子種下後，在沒有施肥的情況下多久可以收成。</p>

        <h4 className="tutorial-h4">枯萎時間</h4>
        <p>
          種子種下後，經過多久時間沒有「護理」作物會枯萎，每次「護理」（澆水）後會重新計算枯萎時間。每種作物的枯萎時間不同，建議每天澆水一次作物就不會死掉了。枯萎時間兩天的作物，如果超過一天沒有澆水作物就會冒紫煙，要趕快澆水，不然再過一天就要死了。以下是鄰居開始有作物死掉的圖片。
        </p>
        <figure className="tutorial-figure">
          <img
            src={publicUrl('images/tutorial/almost_die.jpg')}
            alt="作物瀕死狀態示意"
            loading="lazy"
            decoding="async"
          />
        </figure>

        <h4 className="tutorial-h4">收成</h4>
        <p>
          作物變成「收成」狀態時，作物上會有亮亮的特效。可收成作物就算不澆水也不會枯萎，觀賞作物種好之後可以一直放著不用管他。
        </p>
        <p>
          收成的時候，如果雜交成功才會拿到種子，{' '}
          <span className="tutorial-text-warn">
            不是種高麗菜就可以拿到高麗菜的種子
          </span>
          。
        </p>
      </section>

      <section className="tutorial-section" aria-labelledby="tutorial-basics-soil">
        <h3 id="tutorial-basics-soil" className="tutorial-h3">
          土壤
        </h3>

        <h4 className="tutorial-h4">園藝土壤</h4>
        <p>沒有任何額外的好處，佔位的時候可以使用。</p>

        <h4 className="tutorial-h4">納薩蘭土壤</h4>
        <p>
          提高雜交成功率，雜交時唯一推薦使用 3 級納薩蘭土壤。以下為雜交成功率：
        </p>
        <ul className="tutorial-list">
          <li>未使用：約 5%–8%</li>
          <li>1 級：50%</li>
          <li>2 級：70%</li>
          <li>3 級：90%</li>
        </ul>

        <h4 className="tutorial-h4">黑森林土壤</h4>
        <p>
          增加作物跟種子的收穫數量，部分作物使用黑森林土壤收穫數量還是 1，像是{' '}
          <Link to="/seed/49" className="seed-name-link">
            釉質堅果
          </Link>
          ，細節請參考各種作物的詳情頁。
        </p>
        <p>
          使用黑森林土壤進行雜交的話，雖然可以提高部分作物的種子收成數量，但是雜交成功率過低，請謹慎選擇。
        </p>

        <h4 className="tutorial-h4">拉諾西亞土壤</h4>
        <p>
          提高獲得 HQ 作物的機率。
          <br />
          目前不需要 HQ 作物，還沒使用過，有興趣的玩家可以嘗試看看 XD
        </p>
      </section>

      <section className="tutorial-section" aria-labelledby="tutorial-basics-fertilizer">
        <h3 id="tutorial-basics-fertilizer" className="tutorial-h3">
          施肥
        </h3>
        <p>每次施肥後，需要等待現實一小時後才可以施肥。</p>

        <h4 className="tutorial-h4">魚粉</h4>
        <p>
          每次使用魚粉施肥後，可以減少 1% 的剩餘生長時間。種下種子後可以立刻施肥，可以減少最多的收成時間。
        </p>

        <h4 className="tutorial-h4">染色肥料</h4>
        <p>
          緋紅色油粕、青藍色油粕、金黃色油粕，花卉透過適當的混色可以培養出特定顏色。未使用染色肥料則會長出作物原本的顏色。
        </p>
        <ul className="tutorial-list">
          <li>緋紅色油粕：紅色</li>
          <li>青藍色油粕：藍色</li>
          <li>金黃色油粕：黃色</li>
          <li>青藍色油粕 + 金黃色油粕：綠色</li>
          <li>緋紅色油粕 + 金黃色油粕：橙色</li>
          <li>緋紅色油粕 + 青藍色油粕：紫色</li>
          <li>
            緋紅色油粕 + 青藍色油粕 + 金黃色油粕：白色、黑色、混色
          </li>
        </ul>
      </section>

      <section className="tutorial-section" aria-labelledby="tutorial-basics-cross">
        <h3 id="tutorial-basics-cross" className="tutorial-h3">
          雜交
        </h3>
        <p>兩種不同作物種在同一塊田的相鄰兩格時，有機會雜交獲得種子。</p>
        <p><span className="tutorial-text-warn">親代A + 親代B = 子代</span></p>
        <p>
          子代最多有兩種可能，有些組合會歪出不想要的種子。
        </p>
        <p>
          同一個子代有多種不同的組合，詳細的資料請到
          <Link to="/seeds" className="seed-name-link">種子列表</Link>
          中查看。
        </p>
        <p>
          例如：
          <Link to="/seed/17" className="seed-name-link">中原甘藍種子</Link>
          ，可以透過
          <Link to="/seed/3" className="seed-name-link">紅彩椒種子</Link>
          加
          <Link to="/seed/16" className="seed-name-link">巫茄種子</Link>
          雜交獲得；也可以使用
          <Link to="/seed/20" className="seed-name-link">風茄種子</Link>
          加
          <Link to="/seed/15" className="seed-name-link">多實玉米種子</Link>
          獲得，但是
          <Link to="/seed/20" className="seed-name-link">風茄種子</Link>
          加
          <Link to="/seed/15" className="seed-name-link">多實玉米種子</Link>
          有機會出現
          <Link to="/seed/22" className="seed-name-link">扁桃種子</Link>
          。
        </p>
        <p>設計種植方案的時候盡量找沒有其他可能獲得的子代的組合。</p>
        <p>
          <span className="tutorial-text-warn">種子種下的時候判斷雜交出什麼種子</span>
          ，相鄰兩格都有作物時，依照右 → 下 → 上 → 左判斷可能雜交出什麼種子。
        </p>
        <p>
          親代A旁邊種親代B，親代A跟親代B收成的時候都可能獲得子代X，親代A收成改種親代C之後，親代B跟親代C可以雜交出子代Y，但是親代B種下去的時候已經決定結果了，不會因為旁邊變成親代C就親代B收成的時候可以獲得子代Y。
        </p>
        <p>
          實際雜交種法可以參考
          <button
            type="button"
            className="tutorial-tab-jump"
            onClick={() => selectTopic('basic-cross')}
          >
            基礎雜交
          </button>
          、
          <button
            type="button"
            className="tutorial-tab-jump"
            onClick={() => selectTopic('3-5-cross')}
          >
            3+5雜交
          </button>
          ，其他花式雜交種法請自行研究 XD
        </p>
      </section>

      <section className="tutorial-section" aria-labelledby="tutorial-basics-plot">
        <h3 id="tutorial-basics-plot" className="tutorial-h3">
          園圃／盆栽
        </h3>

        <h4 className="tutorial-h4">庭院</h4>
        <p>
          庭院可以放置園圃，可用於雜交，只推薦使用高級園圃，因為有八個地壟（格子）可以使用。
        </p>
        <p>
          庭院可以放置園圃的數量根據房子大小決定，S 房 1 個、M 房 2 個、L 房 3 個。
        </p>

        <h4 className="tutorial-h4">盆栽</h4>
        <p>
          室內可以放置盆栽，可以用於種植成品或是種花卉裝飾，花卉只可以種在盆栽中。
        </p>
        <p>盆栽本身只有一格，所以沒辦法雜交。</p>
        <p>
          室內可以放置盆栽的數量根據房子大小決定，S 房／公寓個人房／公會個人房 2 個、M 房 3 個、L 房 4 個。
        </p>
      </section>
    </div>
  )
}

function TutorialBasicCrossContent() {
  return (
    <div className="tutorial-prose">
      <p>
        <span className="tutorial-text-warn">種子種下的時候判斷雜交出什麼種子</span>
      </p>
      <p>
        <span className="tutorial-text-warn">優先級為右 → 下 → 上 → 左</span>
      </p>

      <section className="tutorial-section">
        <p>
          基本雜交為 4 個親代A搭配 4 個親代B的作法，以下親代A
          <Link to="/seed/20" className="seed-name-link tutorial-text-yellow">虛無界風茄種子</Link>
          搭配親代B
          <Link to="/seed/41" className="seed-name-link tutorial-text-blue">庫爾札斯茶樹種子</Link>
          ，種出子代
          <Link to="/seed/22" className="seed-name-link">扁桃種子</Link>
          作為解釋。
        </p>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/basic-cross_1.jpg')}
              alt="基礎雜交步驟 1"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>地壟1使用園藝土壤種<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>。</p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/basic-cross_2.jpg')}
              alt="基礎雜交步驟 2"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            地壟2使用 3 級納薩蘭土壤種<span className="tutorial-text-yellow">無界風茄種子</span>，這時候會發現<span className="tutorial-text-yellow">無界風茄</span>跟地壟1的<span className="tutorial-text-blue">庫爾札斯茶樹</span>雜交，地壟2有機會雜交出扁桃種子。
          </p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/basic-cross_3.jpg')}
              alt="基礎雜交步驟 3"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            地壟3使用 3 級納薩蘭土壤種<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>，地壟3的<span className="tutorial-text-blue">庫爾札斯茶樹</span>跟地壟2的<span className="tutorial-text-yellow">無界風茄</span>雜交，地壟3有機會雜交出扁桃種子。
          </p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/basic-cross_4.jpg')}
              alt="基礎雜交步驟 4"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            接著繼續在地壟4-8交替使用 3 級納薩蘭土壤種<span className="tutorial-text-yellow">無界風茄種子</span>跟<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>，這時會發現只有地壟1因為一開始種的時候旁邊什麼都沒有，導致不可能收成到雜交的種子。
          </p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/basic-cross_5.jpg')}
              alt="基礎雜交步驟 5"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            最後把地壟1挖掉（處理），重新使用 3 級納薩蘭土壤種<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>，這樣地壟1就可以收成到雜交的種子了。
          </p>
        </div>
      </section>

      <section className="tutorial-section">
        <p>
          收成的時候不需要全部重頭開始種導致地壟1需要多花一顆種子，只要先收成其中一種，重新使用 3 級納薩蘭土壤種下一樣的種子，再收成另外一種作物重新種下，就可以永續種植了。
        </p>
      </section>
    </div>
  )
}

function Tutorial35CrossContent() {
  return (
    <div className="tutorial-prose">
      <p>
        <span className="tutorial-text-warn">種子種下的時候判斷雜交出什麼種子</span>
      </p>
      <p>
        <span className="tutorial-text-warn">優先級為右 → 下 → 上 → 左</span>
      </p>

      <section className="tutorial-section">
        <p>
          基本雜交為 3 個親代A搭配 5 個親代B的作法，以下親代A
          <Link to="/seed/20" className="seed-name-link tutorial-text-yellow">虛無界風茄種子</Link>
          搭配親代B
          <Link to="/seed/41" className="seed-name-link tutorial-text-blue">庫爾札斯茶樹種子</Link>
          ，種出子代
          <Link to="/seed/22" className="seed-name-link">扁桃種子</Link>
          作為解釋。
        </p>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/3-5-cross_1.jpg')}
              alt="3+5雜交步驟 1"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>地壟1跟6使用園藝土壤種<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>。</p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/3-5-cross_2.jpg')}
              alt="3+5雜交步驟 2"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            地壟2、5、7使用 3 級納薩蘭土壤種<span className="tutorial-text-yellow">無界風茄種子</span>，這時候會發現地壟2、5、7的<span className="tutorial-text-yellow">無界風茄</span>跟地壟1、6的<span className="tutorial-text-blue">庫爾札斯茶樹</span>雜交，有機會雜交出扁桃種子。
          </p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/3-5-cross_3.jpg')}
              alt="3+5雜交步驟 3"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>把地壟1、6挖掉（處理）。</p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/3-5-cross_4.jpg')}
              alt="3+5雜交步驟 4"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            地壟1、3使用 3 級納薩蘭土壤種<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>。地壟1、3跟地壟2雜交。
          </p>
        </div>

        <div className="tutorial-step-row">
          <figure className="tutorial-figure">
            <img
              src={publicUrl('images/tutorial/3-5-cross_5.jpg')}
              alt="3+5雜交步驟 5"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            地壟4、6、8使用 3 級納薩蘭土壤種<span className="tutorial-text-blue">庫爾札斯茶樹種子</span>。地壟4、6跟地壟5雜交，地壟8跟地壟7雜交。
          </p>
        </div>

        <p>這樣你就得到一塊 3+5 雜交園圃了～（灑花</p>
      </section>

      <section className="tutorial-section">
        <p>
          收成親代A<span className="tutorial-text-yellow">虛無界風茄</span>時，只要把地壟2、5、7收成重種就可以。
        </p>
        <p>
          收成親代B<span className="tutorial-text-blue">庫爾札斯茶樹</span>時，先把地壟1、3、4、6、8收成，接著先種地壟1、3、6，再種地壟4、8。一定要先種地壟1、3，再種地壟4、8，不然可能會跟預期雜交結果不同。
        </p>
      </section>
    </div>
  )
}

export function TutorialPage() {
  const location = useLocation()

  const [activeTopic, setActiveTopic] = useState<TopicId>(() => {
    if (typeof window === 'undefined') return 'basics'
    const fromHash = topicFromHash(window.location.hash)
    if (fromHash) return fromHash
    const saved = getTutorialLastTopic()
    if (saved) {
      const parsed = topicFromHash(`#${saved}`)
      if (parsed) {
        const path = `${window.location.pathname}${window.location.search}#${parsed}`
        window.history.replaceState(null, '', path)
        return parsed
      }
    }
    return 'basics'
  })

  const selectTopic = useCallback((id: TopicId) => {
    setActiveTopic(id)
    setTutorialLastTopic(id)
    const path = `${window.location.pathname}${window.location.search}#${id}`
    window.history.replaceState(null, '', path)
  }, [])

  useEffect(() => {
    const hash = location.hash
    if (!hash) {
      const saved = getTutorialLastTopic()
      const parsed = saved ? topicFromHash(`#${saved}`) : null
      if (parsed) {
        setActiveTopic(parsed)
        const path = `${window.location.pathname}${window.location.search}#${parsed}`
        window.history.replaceState(null, '', path)
      } else {
        setActiveTopic('basics')
      }
    } else {
      const next = topicFromHash(hash)
      if (next) {
        setActiveTopic(next)
        setTutorialLastTopic(next)
      }
    }
  }, [location])

  return (
    <div className="tutorial-page">
      <header className="tutorial-header">
        <h1 className="tutorial-title">入門教學</h1>
        <p className="tutorial-lead">
          以下分主題說明園藝與雜交概念。
        </p>
      </header>

      <div
        className="tutorial-topic-bar"
        role="tablist"
        aria-label="教學主題"
      >
        {TUTORIAL_TOPICS.map((topic) => {
          const selected = activeTopic === topic.id
          return (
            <button
              key={topic.id}
              type="button"
              role="tab"
              id={`tutorial-tab-${topic.id}`}
              aria-selected={selected}
              aria-controls={`tutorial-panel-${topic.id}`}
              className={`tutorial-topic-btn${selected ? ' tutorial-topic-btn--active' : ''}`}
              onClick={() => selectTopic(topic.id)}
            >
              {topic.label}
            </button>
          )
        })}
      </div>

      <section
        className="tutorial-panel"
        role="tabpanel"
        id={`tutorial-panel-${activeTopic}`}
        aria-labelledby={`tutorial-tab-${activeTopic}`}
      >
        <div className="tutorial-panel-inner">
          <h2 className="tutorial-panel-heading">
            {TUTORIAL_TOPICS.find((t) => t.id === activeTopic)?.label}
          </h2>
          {activeTopic === 'basics' ? (
            <TutorialBasicsContent selectTopic={selectTopic} />
          ) : activeTopic === 'basic-cross' ? (
            <TutorialBasicCrossContent />
          ) : (
            <Tutorial35CrossContent />
          )}
        </div>
      </section>
    </div>
  )
}
