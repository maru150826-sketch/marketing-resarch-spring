const STORAGE_KEY = 'kaumae-prototype-v1';

const initialState = {
  plannedItems: [
    { id: cryptoId(), name: 'アーモンドフィッシュ', done: true },
    { id: cryptoId(), name: 'ブルーベリー', done: true },
    { id: cryptoId(), name: '豚ロース', done: true },
    { id: cryptoId(), name: 'レタス', done: true },
    { id: cryptoId(), name: 'キャベツ', done: false },
    { id: cryptoId(), name: 'すいか', done: false }
  ],
  impulseItems: [
    {
      id: cryptoId(),
      name: 'クジラベーコン',
      status: '後悔した',
      reasons: ['脂質が高かった', '味が期待ほどではなかった', 'その時の気分で買ってしまった'],
      note: 'デモ用の記録です。'
    }
  ],
  lastCheckItem: 'クジラベーコン',
  currentView: 'list',
  reviewTargetId: null,
  reminderTarget: 'クジラベーコン'
};

let state = loadState();
let selectedReviewStatus = '後悔した';
let selectedReasons = new Set(['脂質が高かった', '味が期待ほどではなかった', 'その時の気分で買ってしまった']);

const screenRoot = document.getElementById('screenRoot');
const navButtons = [...document.querySelectorAll('.bottom-nav button')];
const appStage = document.getElementById('appStage');
const presentationGrid = document.getElementById('presentationGrid');
const togglePresentation = document.getElementById('togglePresentation');
const resetDemo = document.getElementById('resetDemo');
const backButton = document.getElementById('backButton');
const cartButton = document.getElementById('cartButton');

function cryptoId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneInitialState() {
  return {
    plannedItems: initialState.plannedItems.map(item => ({ ...item, id: cryptoId() })),
    impulseItems: initialState.impulseItems.map(item => ({ ...item, id: cryptoId() })),
    lastCheckItem: 'クジラベーコン',
    currentView: 'list',
    reviewTargetId: null,
    reminderTarget: 'クジラベーコン'
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneInitialState();
    const parsed = JSON.parse(raw);
    return { ...cloneInitialState(), ...parsed };
  } catch (error) {
    return cloneInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setView(view) {
  state.currentView = view;
  saveState();
  render();
}

function render() {
  navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === state.currentView));
  const viewMap = {
    list: renderListScreen,
    check: renderCheckScreen,
    review: renderReviewScreen,
    reminder: renderReminderScreen
  };
  screenRoot.innerHTML = viewMap[state.currentView]();
  bindScreenEvents();
  renderPresentationScreens();
}

function productThumbHTML() {
  return `<div class="product-thumb" aria-hidden="true"><div class="whale">くじら</div><div class="meat-lines"></div></div>`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderListScreen() {
  const rows = state.plannedItems.map(item => `
    <div class="list-row ${item.done ? 'done' : ''}" data-id="${item.id}">
      <button class="checkbox" data-action="toggle-item" aria-label="${escapeHTML(item.name)}をチェック">${item.done ? '✓' : ''}</button>
      <div class="item-name">${escapeHTML(item.name)}</div>
      <button class="delete-row" data-action="delete-item" aria-label="削除">×</button>
      <div class="drag" aria-hidden="true">≡</div>
    </div>`).join('');

  return `
    <h2 class="screen-title">買うものリスト</h2>
    <p class="screen-subtitle">先に買う予定を決めておく</p>
    <div class="checklist-card">${rows}</div>
    <form class="inline-form" id="addPlanForm">
      <input class="text-input" id="planInput" type="text" placeholder="例：牛乳" autocomplete="off" />
      <button class="primary-button" type="submit">＋追加</button>
    </form>
    <div class="quick-actions" aria-label="デモ操作">
      <button class="chip-button" data-action="go-check" data-product="クジラベーコン" type="button">店内で予定外商品を試す</button>
    </div>
  `;
}

function renderCheckScreen() {
  const product = state.lastCheckItem || 'クジラベーコン';
  const planned = isPlanned(product);
  return `
    <h2 class="screen-title">これ、本当に今必要？</h2>
    <p class="screen-subtitle">予定外購入だけ、やさしく確認する</p>
    <form class="inline-form" id="checkProductForm">
      <input class="text-input" id="checkProductInput" type="text" value="${escapeHTML(product)}" placeholder="店内で欲しくなった商品名" autocomplete="off" />
      <button class="orange-button" type="submit">確認</button>
    </form>
    <div class="white-card product-card" style="margin-top:12px;">
      ${productThumbHTML()}
      <div>
        <p class="product-name">${escapeHTML(product)}</p>
        <p class="product-note ${planned ? 'green' : ''}">${planned ? '買う予定に入っています' : '予定外の商品です'}</p>
      </div>
    </div>
    ${planned ? `
      <div class="helper-card" style="margin-top:12px;">買う予定リストにあるため、強い確認は出しません。予定通りの買い物として扱います。</div>
    ` : `
      <div class="question-card">
        <div class="question-row"><span class="q-icon">♡</span><span>今の気分で欲しいだけ？</span></div>
        <div class="question-row"><span class="q-icon">?</span><span>前に似た買い物で後悔していない？</span></div>
        <div class="question-row"><span class="q-icon">明</span><span>明日の自分も欲しいと思う？</span></div>
      </div>
      <div class="button-stack">
        <button class="orange-button full" data-action="add-impulse" type="button">それでも追加する</button>
        <button class="outline-button full" data-action="stop-impulse" type="button">今回はやめる</button>
      </div>
    `}
  `;
}

function getReviewTarget() {
  const explicit = state.impulseItems.find(item => item.id === state.reviewTargetId);
  return explicit || state.impulseItems[state.impulseItems.length - 1] || { id: null, name: state.lastCheckItem || 'クジラベーコン', status: '', reasons: [] };
}

function renderReviewScreen() {
  const item = getReviewTarget();
  selectedReviewStatus = item.status || selectedReviewStatus || '後悔した';
  selectedReasons = new Set((item.reasons && item.reasons.length) ? item.reasons : [...selectedReasons]);
  const reasons = ['脂質が高かった', '味が期待ほどではなかった', 'その時の気分で買ってしまった', '量が多すぎた', 'あまり使わなかった', 'その他'];

  if (!state.impulseItems.length) {
    return `
      <h2 class="screen-title">買ってどうだった？</h2>
      <p class="screen-subtitle">次の買い物前に思い出せるように記録する</p>
      <div class="empty-state"><strong>振り返る予定外商品がありません</strong>店内画面で予定外商品を追加すると、ここで記録できます。</div>
      <button class="primary-button full" data-action="go-check" type="button">予定外商品を確認する</button>
    `;
  }

  return `
    <h2 class="screen-title">買ってどうだった？</h2>
    <div class="white-card product-card">
      ${productThumbHTML()}
      <div>
        <p class="product-name">${escapeHTML(item.name)}</p>
        <p class="product-note green">次の買い物前に思い出せるように記録する</p>
      </div>
    </div>
    <div class="segmented" role="group" aria-label="評価選択">
      ${['買ってよかった', 'ふつう', '後悔した'].map(label => `<button class="${selectedReviewStatus === label ? 'selected' : ''}" data-action="set-status" data-status="${label}" type="button">${label}</button>`).join('')}
    </div>
    <p class="section-label">理由を選んでください（複数選択可）</p>
    <div class="reason-grid">
      ${reasons.map(reason => `<button class="reason-chip ${selectedReasons.has(reason) ? 'selected' : ''}" data-action="toggle-reason" data-reason="${reason}" type="button">${selectedReasons.has(reason) ? '✓ ' : ''}${reason}</button>`).join('')}
    </div>
    <p class="section-label">メモ</p>
    <textarea id="reviewNote" placeholder="例：その場の気分で買ったが、家ではあまり食べたくならなかった。">${escapeHTML(item.note || '')}</textarea>
    <div class="button-stack">
      <button class="primary-button full" data-action="save-review" data-id="${item.id}" type="button">保存</button>
    </div>
  `;
}

function getReminderMatch(productName) {
  const normalized = normalize(productName);
  const regretted = state.impulseItems.filter(item => item.status === '後悔した');
  return regretted.find(item => normalize(item.name) === normalized) || regretted.find(item => normalized.includes(normalize(item.name)) || normalize(item.name).includes(normalized));
}

function renderReminderScreen() {
  const target = state.reminderTarget || 'クジラベーコン';
  const match = getReminderMatch(target);
  return `
    <h2 class="screen-title">前にも似た買い物で後悔しています</h2>
    <form class="inline-form" id="reminderForm">
      <input class="text-input" id="reminderInput" type="text" value="${escapeHTML(target)}" placeholder="もう一度買おうとしている商品" autocomplete="off" />
      <button class="primary-button" type="submit">確認</button>
    </form>
    ${match ? `
      <div class="white-card product-card" style="margin-top:12px;">
        ${productThumbHTML()}
        <div><p class="product-name">${escapeHTML(match.name)}</p><p class="product-note">前回の後悔メモがあります</p></div>
      </div>
      <div class="reminder-message">
        前回この商品を買ったとき、<br>
        ${match.reasons.slice(0, 2).map(reason => `「${escapeHTML(reason)}」`).join(' ')}<br>
        と記録しています。
      </div>
      <div class="reminder-buttons">
        <button class="secondary-button" data-action="buy-again" type="button">もう一度買う</button>
        <button class="primary-button" data-action="stop-again" type="button">今回はやめる</button>
      </div>
      <div class="small-note"><span class="bulb">💡</span><span>全部の予定外購入を止めるのではなく、後悔しそうな買い物だけ見直す</span></div>
    ` : `
      <div class="empty-state"><strong>強い注意メモはありません</strong>過去に「後悔した」と記録した商品だけ、ここで思い出せます。</div>
      <div class="small-note"><span class="bulb">💡</span><span>予定外購入を全部止めるのではなく、後悔しそうな買い物だけ見直します。</span></div>
    `}
  `;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function isPlanned(productName) {
  return state.plannedItems.some(item => normalize(item.name) === normalize(productName));
}

function addImpulseItem(name) {
  const item = { id: cryptoId(), name, status: '', reasons: [], note: '' };
  state.impulseItems.push(item);
  state.reviewTargetId = item.id;
  state.lastCheckItem = name;
  saveState();
  return item;
}

function bindScreenEvents() {
  screenRoot.querySelectorAll('[data-action]').forEach(element => {
    element.addEventListener('click', handleAction);
  });

  const addPlanForm = document.getElementById('addPlanForm');
  if (addPlanForm) {
    addPlanForm.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('planInput');
      const name = input.value.trim();
      if (!name) return toast('商品名を入力してください');
      state.plannedItems.push({ id: cryptoId(), name, done: false });
      saveState();
      render();
      toast('買うものリストに追加しました');
    });
  }

  const checkProductForm = document.getElementById('checkProductForm');
  if (checkProductForm) {
    checkProductForm.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('checkProductInput');
      const name = input.value.trim();
      if (!name) return toast('商品名を入力してください');
      state.lastCheckItem = name;
      saveState();
      render();
      toast(isPlanned(name) ? '予定リストにあります' : '予定外商品として確認します');
    });
  }

  const reminderForm = document.getElementById('reminderForm');
  if (reminderForm) {
    reminderForm.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('reminderInput');
      const name = input.value.trim();
      if (!name) return toast('商品名を入力してください');
      state.reminderTarget = name;
      saveState();
      render();
    });
  }
}

function handleAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;
  const row = target.closest('.list-row');

  if (action === 'toggle-item') {
    const item = state.plannedItems.find(i => i.id === row.dataset.id);
    if (item) item.done = !item.done;
    saveState();
    render();
  }

  if (action === 'delete-item') {
    state.plannedItems = state.plannedItems.filter(i => i.id !== row.dataset.id);
    saveState();
    render();
  }

  if (action === 'go-check') {
    if (target.dataset.product) state.lastCheckItem = target.dataset.product;
    setView('check');
  }

  if (action === 'add-impulse') {
    const name = state.lastCheckItem || 'クジラベーコン';
    addImpulseItem(name);
    setView('review');
    toast('予定外商品として追加しました');
  }

  if (action === 'stop-impulse') {
    toast('今回はやめる選択を記録しました');
    setView('list');
  }

  if (action === 'set-status') {
    selectedReviewStatus = target.dataset.status;
    renderReviewScreenOnly();
  }

  if (action === 'toggle-reason') {
    const reason = target.dataset.reason;
    if (selectedReasons.has(reason)) selectedReasons.delete(reason);
    else selectedReasons.add(reason);
    renderReviewScreenOnly();
  }

  if (action === 'save-review') {
    const item = state.impulseItems.find(i => i.id === target.dataset.id);
    const note = document.getElementById('reviewNote')?.value || '';
    if (item) {
      item.status = selectedReviewStatus;
      item.reasons = [...selectedReasons];
      item.note = note;
      state.reminderTarget = item.name;
      saveState();
      toast('振り返りを保存しました');
      setView('reminder');
    }
  }

  if (action === 'buy-again') {
    toast('もう一度買う選択をしました');
  }

  if (action === 'stop-again') {
    toast('今回はやめる選択をしました');
    setView('list');
  }
}

function renderReviewScreenOnly() {
  state.currentView = 'review';
  screenRoot.innerHTML = renderReviewScreen();
  bindScreenEvents();
}

function renderPresentationScreens() {
  document.getElementById('miniList').innerHTML = renderListScreen();
  document.getElementById('miniCheck').innerHTML = renderCheckScreen();
  document.getElementById('miniReview').innerHTML = renderReviewScreen();
  document.getElementById('miniReminder').innerHTML = renderReminderScreen();
}

function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(node.timer);
  node.timer = setTimeout(() => node.classList.remove('show'), 1700);
}

navButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
backButton.addEventListener('click', () => {
  const order = ['list', 'check', 'review', 'reminder'];
  const index = Math.max(0, order.indexOf(state.currentView) - 1);
  setView(order[index]);
});
cartButton.addEventListener('click', () => setView('list'));

togglePresentation.addEventListener('click', () => {
  const showPresentation = presentationGrid.classList.contains('hidden');
  appStage.classList.toggle('hidden', showPresentation);
  presentationGrid.classList.toggle('hidden', !showPresentation);
  togglePresentation.textContent = showPresentation ? 'アプリ操作画面' : '4画面表示';
  renderPresentationScreens();
});

resetDemo.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = cloneInitialState();
  selectedReviewStatus = '後悔した';
  selectedReasons = new Set(['脂質が高かった', '味が期待ほどではなかった', 'その時の気分で買ってしまった']);
  render();
  toast('デモ状態に戻しました');
});

render();
