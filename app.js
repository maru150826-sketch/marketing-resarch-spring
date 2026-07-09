const STORAGE_KEY = 'kaumae-app-v2';

const categories = [
  { id: 'snack', label: 'お菓子', kcal: 320, hint: 'チョコ・ポテチなど' },
  { id: 'ice', label: 'アイス', kcal: 230, hint: 'カップ・バーなど' },
  { id: 'bread', label: '総菜パン', kcal: 430, hint: 'カレーパンなど' },
  { id: 'junk', label: 'ジャンクフード', kcal: 680, hint: 'バーガー・揚げ物' },
  { id: 'drink', label: 'ジュース', kcal: 160, hint: '甘い飲み物' },
  { id: 'deli', label: '総菜', kcal: 380, hint: '弁当横の一品' }
];

const defaultState = {
  currentView: 'plan',
  planText: '豚ロース、レタス、ブルーベリー',
  candidate: { name: 'クジラベーコン', categoryId: 'deli', calories: 380 },
  pendingPurchase: null,
  reviewDraft: {
    status: 'ふつう',
    reasons: []
  },
  history: [
    {
      id: makeId(),
      name: 'クジラベーコン',
      categoryId: 'deli',
      calories: 380,
      status: '後悔した',
      reasons: ['脂質が高かった', '味が期待ほどではなかった', 'その時の気分で買ってしまった'],
      note: 'おもしろそうで買ったが、家ではそこまで食べたくならなかった。',
      date: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  avoided: []
};

let state = loadState();

const screenRoot = document.getElementById('screenRoot');
const stepNav = document.getElementById('stepNav');
const navButtons = [...stepNav.querySelectorAll('button')];
const resetDemo = document.getElementById('resetDemo');
const toastNode = document.getElementById('toast');

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function freshDefaultState() {
  return {
    ...defaultState,
    candidate: { ...defaultState.candidate },
    pendingPurchase: null,
    reviewDraft: { status: 'ふつう', reasons: [] },
    history: defaultState.history.map(item => ({ ...item, id: makeId(), reasons: [...item.reasons] })),
    avoided: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshDefaultState();
    const parsed = JSON.parse(raw);
    return {
      ...freshDefaultState(),
      ...parsed,
      candidate: { ...freshDefaultState().candidate, ...(parsed.candidate || {}) },
      reviewDraft: { status: 'ふつう', reasons: [], ...(parsed.reviewDraft || {}) }
    };
  } catch {
    return freshDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setView(view) {
  state.currentView = view;
  saveState();
  render();
}

function render() {
  navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === state.currentView));
  const screens = {
    plan: renderPlanScreen,
    store: renderStoreScreen,
    review: renderReviewScreen,
    praise: renderPraiseScreen,
    history: renderHistoryScreen
  };
  screenRoot.innerHTML = screens[state.currentView]?.() || renderPlanScreen();
  bindEvents();
}

function getCategory(categoryId) {
  return categories.find(category => category.id === categoryId) || categories[0];
}

function estimateCalories(name, categoryId) {
  if (!categoryId) return null;
  const category = getCategory(categoryId);
  let calories = category.kcal;
  const text = normalize(name);

  if (text.includes('大盛') || text.includes('メガ')) calories += 180;
  if (text.includes('ラーメン')) calories += 260;
  if (text.includes('チーズ')) calories += 90;
  if (text.includes('揚げ') || text.includes('カツ') || text.includes('唐揚')) calories += 120;
  if (text.includes('ゼロ') || text.includes('無糖')) calories = Math.max(0, calories - 130);

  return Math.max(0, Math.round(calories / 10) * 10);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function plannedWords() {
  return state.planText
    .split(/[、,\n\s]+/)
    .map(word => normalize(word))
    .filter(Boolean);
}

function isPlannedItem(name) {
  const target = normalize(name);
  if (!target) return false;
  return plannedWords().some(word => target.includes(word) || word.includes(target));
}

function findRegret(name, categoryId) {
  const target = normalize(name);
  const regrets = state.history.filter(item => item.status === '後悔した');
  return regrets.find(item => normalize(item.name) === target)
    || regrets.find(item => target && (normalize(item.name).includes(target) || target.includes(normalize(item.name))))
    || regrets.find(item => item.categoryId === categoryId && item.reasons?.some(reason => reason.includes('その時の気分')));
}

function renderPlanScreen() {
  const previewItems = plannedWords().slice(0, 5);
  return `
    <section class="screen-grid">
      <div>
        <p class="kicker">STEP 1 / 買い物前</p>
        <h2 class="screen-title">買う前に、今日の方向だけ決める</h2>
        <p class="screen-lead">細かい買い物リストを作り込む必要はありません。先に「今日買う予定」をざっくり決めておくと、店内で予定外商品に気づきやすくなります。</p>

        <div class="panel">
          <label class="label" for="planText">今日買う予定のもの</label>
          <textarea id="planText" placeholder="例：豚ロース、レタス、ブルーベリー">${escapeHTML(state.planText)}</textarea>
          <div class="button-row">
            <button class="primary-button" data-action="start-shopping" type="button">買い物を決定して店内へ</button>
          </div>
        </div>
      </div>

      <aside class="panel soft">
        <h3 class="panel-title">この画面の役割</h3>
        <p class="screen-lead" style="font-size:18px;margin-bottom:14px;">予定を完全に管理するのではなく、「予定外かどうか」を判断する基準を作ります。</p>
        <div class="mini-list">
          ${previewItems.length ? previewItems.map(item => `<div><span class="checkmark">✓</span>${escapeHTML(item)}</div>`).join('') : '<div><span class="checkmark">✓</span>必要なものをざっくり入力</div>'}
        </div>
      </aside>
    </section>
  `;
}

function renderStoreScreen() {
  const candidate = state.candidate || { name: '', categoryId: '', calories: null };
  const category = candidate.categoryId ? getCategory(candidate.categoryId) : null;
  const calories = estimateCalories(candidate.name, candidate.categoryId);
  const planned = isPlannedItem(candidate.name);
  const regret = findRegret(candidate.name, candidate.categoryId);
  const hasEstimate = candidate.name.trim() && category;

  return `
    <section class="screen-grid">
      <div>
        <p class="kicker">STEP 2 / 店内</p>
        <h2 class="screen-title">気になる商品を入れる</h2>
        <p class="screen-lead">商品名と種類を入れると、推定カロリーと過去の後悔メモを表示します。</p>

        <div class="panel">
          <label class="label" for="candidateName">気になる商品名</label>
          <input class="large-input" id="candidateName" value="${escapeHTML(candidate.name)}" placeholder="例：クジラベーコン" autocomplete="off" />

          <p class="label" style="margin-top:18px;">商品の種類</p>
          <div class="category-grid" id="categoryGrid">
            ${categories.map(item => `
              <button class="category-button ${candidate.categoryId === item.id ? 'selected' : ''}" data-action="select-category" data-category="${item.id}" type="button">
                <strong>${escapeHTML(item.label)}</strong>
                <small>目安 ${item.kcal}kcal / ${escapeHTML(item.hint)}</small>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <aside class="estimate-card" id="estimatePanel">
        ${hasEstimate ? renderEstimatePanel({ candidate, category, calories, planned, regret }) : renderEmptyEstimatePanel()}
      </aside>
    </section>
  `;
}

function renderEmptyEstimatePanel() {
  return `
    <div class="empty-card">
      商品名を入れて、種類を選ぶとここに推定カロリーが出ます。<br>
      まずは「カロリーをチェックする」だけでよい設計です。
    </div>
    <div class="panel orange">
      <h3 class="panel-title">確認する文言</h3>
      <div class="question-list">
        <div><span class="q-icon">今</span><span>今の気分でほしいだけ？</span></div>
        <div><span class="q-icon">後</span><span>後悔はない？</span></div>
        <div><span class="q-icon">kcal</span><span>カロリーをまずはチェック</span></div>
      </div>
    </div>
  `;
}

function renderEstimatePanel({ candidate, category, calories, planned, regret }) {
  return `
    <div class="kcal-box">
      <p class="kcal-label">${planned ? '買う予定に近い商品です' : '予定外商品のカロリーチェック'}</p>
      <p class="kcal-value">${calories}<span> kcal</span></p>
      <p class="product-meta">${escapeHTML(category.label)}として推定。実際の商品表示とは異なる場合があります。</p>
    </div>

    ${regret ? `
      <div class="regret-alert">
        <strong>前にも似た買い物で後悔しています</strong>
        ${escapeHTML(regret.name)}を買ったとき、${(regret.reasons || []).slice(0, 2).map(reason => `「${escapeHTML(reason)}」`).join(' ')} と記録しています。
      </div>
    ` : ''}

    <div class="panel orange">
      <h3 class="panel-title">これ、本当に今必要？</h3>
      <div class="question-list">
        <div><span class="q-icon">今</span><span>今の気分でほしいだけ？</span></div>
        <div><span class="q-icon">後</span><span>後悔はない？</span></div>
        <div><span class="q-icon">kcal</span><span>カロリーをまずはチェック</span></div>
      </div>
      <div class="button-row">
        <button class="orange-button" data-action="buy-item" type="button">買ったので振り返る</button>
        <button class="secondary-button" data-action="avoid-item" type="button">今回はやめる</button>
      </div>
    </div>
  `;
}

function renderReviewScreen() {
  const item = state.pendingPurchase;
  const reasons = ['カロリーが高かった', '脂質が高かった', '味が期待ほどではなかった', 'その時の気分で買ってしまった', 'お金がもったいなかった', '量が多すぎた', 'また買いたい'];

  if (!item) {
    return `
      <section class="screen-grid single">
        <div>
          <p class="kicker">STEP 3 / 購入後</p>
          <h2 class="screen-title">買った商品を振り返る</h2>
          <div class="empty-card">まだ振り返る商品がありません。店内画面で「買ったので振り返る」を押すと、この画面に進みます。</div>
          <div class="button-row"><button class="primary-button" data-action="go-store" type="button">店内画面へ</button></div>
        </div>
      </section>
    `;
  }

  const selectedReasons = new Set(state.reviewDraft.reasons || []);
  return `
    <section class="screen-grid">
      <div>
        <p class="kicker">STEP 3 / 購入後</p>
        <h2 class="screen-title">買ってどうだった？</h2>
        <p class="screen-lead">ここで集めた記録が、次回の買い物中の注意喚起になります。</p>

        <div class="product-summary">
          <div>
            <p class="product-name">${escapeHTML(item.name)}</p>
            <p class="product-meta">${escapeHTML(getCategory(item.categoryId).label)} / 推定 ${item.calories}kcal</p>
          </div>
          <div class="badge">${item.calories}kcal</div>
        </div>

        <div class="segmented" role="group" aria-label="評価">
          ${['買ってよかった', 'ふつう', '後悔した'].map(status => `
            <button class="${state.reviewDraft.status === status ? 'selected' : ''}" data-action="set-status" data-status="${status}" type="button">${status}</button>
          `).join('')}
        </div>

        <p class="label">理由を選ぶ</p>
        <div class="reason-grid">
          ${reasons.map(reason => `
            <button class="reason-chip ${selectedReasons.has(reason) ? 'selected' : ''}" data-action="toggle-reason" data-reason="${reason}" type="button">${selectedReasons.has(reason) ? '✓ ' : ''}${reason}</button>
          `).join('')}
        </div>

        <label class="label" for="reviewNote">メモ</label>
        <textarea id="reviewNote" placeholder="例：その場の勢いで買った。思ったより重かった。"></textarea>
        <div class="button-row"><button class="primary-button" data-action="save-review" type="button">振り返りを保存</button></div>
      </div>

      <aside class="panel soft">
        <h3 class="panel-title">集めたい情報</h3>
        <div class="mini-list">
          <div><span class="checkmark">✓</span>買ってよかったか</div>
          <div><span class="checkmark">✓</span>後悔した理由</div>
          <div><span class="checkmark">✓</span>次回止めるべき商品か</div>
        </div>
      </aside>
    </section>
  `;
}

function renderPraiseScreen() {
  const avoided = state.avoided[0];
  const calories = avoided?.calories || estimateCalories(state.candidate.name, state.candidate.categoryId) || 0;
  const name = avoided?.name || state.candidate.name || '予定外商品';

  return `
    <section class="praise-box">
      <div class="praise-icon">✓</div>
      <h2>今回は立ち止まれました</h2>
      <p>${escapeHTML(name)}を買う前に見直せました。これは我慢というより、後悔しそうな買い物を自分で選び直せた記録です。</p>
      <div class="stats-grid" style="max-width:760px;margin:24px auto;">
        <div class="stat-card"><p>見直した推定カロリー</p><strong>${calories}kcal</strong></div>
        <div class="stat-card"><p>やめられた回数</p><strong>${state.avoided.length}回</strong></div>
        <div class="stat-card"><p>今回の判断</p><strong>保留</strong></div>
      </div>
      <div class="button-row" style="justify-content:center;">
        <button class="primary-button" data-action="go-store" type="button">店内に戻る</button>
        <button class="secondary-button" data-action="go-history" type="button">記録を見る</button>
      </div>
    </section>
  `;
}

function renderHistoryScreen() {
  const regrets = state.history.filter(item => item.status === '後悔した').length;
  const totalAvoidedCalories = state.avoided.reduce((sum, item) => sum + (item.calories || 0), 0);

  return `
    <section class="screen-grid single">
      <div>
        <p class="kicker">STEP 4 / 記録</p>
        <h2 class="screen-title">後悔しそうな買い物だけ、次回に思い出す</h2>
        <p class="screen-lead">購入後の振り返りと、買うのをやめられた記録を残します。次に似た商品を店内で入れたとき、自動的に注意喚起できます。</p>

        <div class="stats-grid">
          <div class="stat-card"><p>購入後メモ</p><strong>${state.history.length}件</strong></div>
          <div class="stat-card"><p>後悔メモ</p><strong>${regrets}件</strong></div>
          <div class="stat-card"><p>見直したカロリー</p><strong>${totalAvoidedCalories}kcal</strong></div>
        </div>

        <div class="screen-grid" style="align-items:start;">
          <div class="panel">
            <h3 class="panel-title">購入後の記録</h3>
            <div class="history-list">
              ${state.history.length ? state.history.map(renderHistoryItem).join('') : '<div class="empty-card">まだ購入後メモはありません。</div>'}
            </div>
          </div>
          <div class="panel soft">
            <h3 class="panel-title">やめられた記録</h3>
            <div class="history-list">
              ${state.avoided.length ? state.avoided.map(renderAvoidedItem).join('') : '<div class="empty-card">「今回はやめる」を押すと、ここに記録されます。</div>'}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderHistoryItem(item) {
  const statusClass = item.status === '後悔した' ? 'regret' : 'good';
  return `
    <article class="history-item">
      <div class="history-top"><strong>${escapeHTML(item.name)}</strong><span>${formatDate(item.date)}</span></div>
      <div class="tag-line">
        <span class="tag ${statusClass}">${escapeHTML(item.status)}</span>
        <span class="tag">${escapeHTML(getCategory(item.categoryId).label)}</span>
        <span class="tag">${item.calories}kcal</span>
        ${(item.reasons || []).map(reason => `<span class="tag">${escapeHTML(reason)}</span>`).join('')}
      </div>
      ${item.note ? `<p class="product-meta">${escapeHTML(item.note)}</p>` : ''}
    </article>
  `;
}

function renderAvoidedItem(item) {
  return `
    <article class="history-item">
      <div class="history-top"><strong>${escapeHTML(item.name)}</strong><span>${formatDate(item.date)}</span></div>
      <div class="tag-line">
        <span class="tag good">今回はやめた</span>
        <span class="tag">${escapeHTML(getCategory(item.categoryId).label)}</span>
        <span class="tag">${item.calories}kcal見直し</span>
      </div>
    </article>
  `;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function bindEvents() {
  screenRoot.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', handleAction));

  const planText = document.getElementById('planText');
  if (planText) {
    planText.addEventListener('input', event => {
      state.planText = event.target.value;
      saveState();
    });
  }

  const candidateName = document.getElementById('candidateName');
  if (candidateName) {
    candidateName.addEventListener('input', event => {
      state.candidate.name = event.target.value;
      state.candidate.calories = estimateCalories(state.candidate.name, state.candidate.categoryId);
      saveState();
      updateEstimatePanelOnly();
    });
  }
}

function handleAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;

  if (action === 'start-shopping') {
    const planText = document.getElementById('planText');
    state.planText = planText?.value || state.planText;
    saveState();
    setView('store');
    toast('買い物を開始しました');
  }

  if (action === 'select-category') {
    state.candidate.categoryId = target.dataset.category;
    state.candidate.calories = estimateCalories(state.candidate.name, state.candidate.categoryId);
    saveState();
    render();
  }

  if (action === 'buy-item') {
    const name = state.candidate.name.trim();
    if (!name || !state.candidate.categoryId) return toast('商品名と種類を入れてください');
    const calories = estimateCalories(name, state.candidate.categoryId);
    state.pendingPurchase = {
      id: makeId(),
      name,
      categoryId: state.candidate.categoryId,
      calories,
      date: new Date().toISOString()
    };
    state.reviewDraft = { status: 'ふつう', reasons: [] };
    saveState();
    setView('review');
    toast('購入後の振り返りへ進みます');
  }

  if (action === 'avoid-item') {
    const name = state.candidate.name.trim();
    if (!name || !state.candidate.categoryId) return toast('商品名と種類を入れてください');
    state.avoided.unshift({
      id: makeId(),
      name,
      categoryId: state.candidate.categoryId,
      calories: estimateCalories(name, state.candidate.categoryId),
      date: new Date().toISOString()
    });
    saveState();
    setView('praise');
  }

  if (action === 'set-status') {
    state.reviewDraft.status = target.dataset.status;
    saveState();
    render();
  }

  if (action === 'toggle-reason') {
    const reason = target.dataset.reason;
    const reasons = new Set(state.reviewDraft.reasons || []);
    if (reasons.has(reason)) reasons.delete(reason);
    else reasons.add(reason);
    state.reviewDraft.reasons = [...reasons];
    saveState();
    render();
  }

  if (action === 'save-review') {
    if (!state.pendingPurchase) return toast('保存する商品がありません');
    const note = document.getElementById('reviewNote')?.value || '';
    state.history.unshift({
      ...state.pendingPurchase,
      status: state.reviewDraft.status,
      reasons: state.reviewDraft.reasons || [],
      note
    });
    state.pendingPurchase = null;
    state.reviewDraft = { status: 'ふつう', reasons: [] };
    saveState();
    setView('history');
    toast('振り返りを保存しました');
  }

  if (action === 'go-store') setView('store');
  if (action === 'go-history') setView('history');
}

function updateEstimatePanelOnly() {
  const panel = document.getElementById('estimatePanel');
  if (!panel) return;

  const candidate = state.candidate;
  const category = candidate.categoryId ? getCategory(candidate.categoryId) : null;
  const calories = estimateCalories(candidate.name, candidate.categoryId);
  const planned = isPlannedItem(candidate.name);
  const regret = findRegret(candidate.name, candidate.categoryId);
  const hasEstimate = candidate.name.trim() && category;

  panel.innerHTML = hasEstimate ? renderEstimatePanel({ candidate, category, calories, planned, regret }) : renderEmptyEstimatePanel();
  panel.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', handleAction));
}

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('show');
  clearTimeout(toastNode.timer);
  toastNode.timer = setTimeout(() => toastNode.classList.remove('show'), 1800);
}

navButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

resetDemo.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = freshDefaultState();
  render();
  toast('デモ状態に戻しました');
});

render();
