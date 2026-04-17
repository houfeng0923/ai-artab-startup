import './style.css';
import { Artwork, loadArtworkCollection } from '@/lib/art';
import {
  addGroup,
  addQuickTaskToPlan,
  addSubtask,
  addTask,
  addTaskToPlan,
  AppState,
  deleteSubtask,
  deleteTask,
  ensurePlanForDate,
  ensureRecentPlans,
  getTasksByGroup,
  isTaskActiveOnDate,
  removePlanItem,
  setArtworkIndex,
  TaskKind,
  togglePlanItem,
  togglePlanSubtask,
  toggleTaskAutoAdd,
} from '@/lib/state';
import { formatDateChip, formatDisplayDate, recentDateKeys, todayDateKey } from '@/lib/date';
import { loadState, saveState } from '@/lib/storage';

type RouteName = 'board' | 'edit';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found.');
}

const app = appRoot;
const todayKey = todayDateKey();
let selectedDateKey = todayKey;
let state = ensureRecentPlans(await loadState(), todayKey);
let boardGroupId = state.groups[0]?.id ?? '';
let artworks: Artwork[] = [];
let artworkLoading = true;
let artworkError: string | null = null;
let artworkImageReady = false;
let artworkLoadToken = 0;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getRoute(): RouteName {
  return location.hash === '#/edit' ? 'edit' : 'board';
}

function navigate(route: RouteName): void {
  const nextHash = route === 'edit' ? '#/edit' : '#/';
  if (location.hash !== nextHash) {
    location.hash = nextHash;
    return;
  }

  render();
}

function syncBoardGroup(currentState: AppState): string {
  if (currentState.groups.some((group) => group.id === boardGroupId)) {
    return boardGroupId;
  }

  boardGroupId = currentState.groups[0]?.id ?? '';
  return boardGroupId;
}

function currentArtwork(): Artwork | null {
  if (!artworks.length) {
    return null;
  }

  const index = ((state.ui.artworkIndex % artworks.length) + artworks.length) % artworks.length;
  return artworks[index];
}

function focusQuickTaskInput(): void {
  const input = app.querySelector<HTMLInputElement>('form[data-form="quick-task"] input[name="title"]');
  input?.focus();
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
    image.src = url;
  });
}

async function showArtworkAtIndex(index: number, persist = true): Promise<void> {
  if (!artworks.length) {
    return;
  }

  const nextIndex = ((index % artworks.length) + artworks.length) % artworks.length;
  const artwork = artworks[nextIndex];
  const loadToken = ++artworkLoadToken;

  state = setArtworkIndex(state, nextIndex);
  artworkLoading = true;
  artworkImageReady = false;
  artworkError = null;
  render();

  try {
    await preloadImage(artwork.image);
    if (loadToken !== artworkLoadToken) {
      return;
    }

    artworkImageReady = true;
    artworkLoading = false;
    console.log('Current artwork URL:', artwork.image);
    render();

    if (persist) {
      await saveState(state);
    }
  } catch (error) {
    if (loadToken !== artworkLoadToken) {
      return;
    }

    console.error(error);
    artworkLoading = false;
    artworkImageReady = false;
    artworkError = '艺术图片加载失败';
    render();
  }
}

async function persistAndRender(nextState: AppState): Promise<void> {
  state = ensureRecentPlans(nextState, todayKey);
  render();
  await saveState(state);
}

async function loadArtworksIntoView(): Promise<void> {
  artworkLoading = true;
  artworkImageReady = false;
  artworkError = null;
  render();

  try {
    artworks = await loadArtworkCollection();
    if (artworks.length) {
      const nextIndex = Math.floor(Math.random() * artworks.length);
      await showArtworkAtIndex(nextIndex);
      return;
    }
  } catch (error) {
    console.error(error);
    artworkError = '艺术数据加载失败';
  } finally {
    if (!artworks.length || artworkError) {
      artworkLoading = false;
      render();
    }
  }
}

function planStats(currentState: AppState, dateKey: string): { total: number; completed: number } {
  const plan = currentState.dailyPlans[dateKey];
  if (!plan) {
    return { total: 0, completed: 0 };
  }

  return {
    total: plan.items.length,
    completed: plan.items.filter((item) => item.completed).length,
  };
}

function exportJson(): void {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          ...state,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `startup-tab-${todayKey}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderEditHeader(): string {
  return `
    <header class="edit-topbar">
      <div class="edit-topbar__brand">
        <span class="panel__eyebrow">Template Editor</span>
        <strong>模板维护</strong>
      </div>
      <div class="edit-topbar__actions">
        <button class="tool-button" data-action="export-json">导出 JSON</button>
        <button class="tool-button tool-button--strong" data-action="open-board">返回展墙</button>
      </div>
    </header>
  `;
}

function renderPlan(currentState: AppState): string {
  const plan = currentState.dailyPlans[selectedDateKey];
  if (!plan || plan.items.length === 0) {
    return `
      <div class="plan-empty">
        <p>此日尚无计划。</p>
        <p>从下方模板入口摘几件正事，或直接记一条今日任务。</p>
      </div>
    `;
  }

  return `
    <ul class="plan-list">
      ${plan.items
        .map(
          (item) => `
            <li class="plan-item ${item.completed ? 'is-complete' : ''}">
              <label class="check-row">
                <input
                  type="checkbox"
                  data-action="toggle-plan-item"
                  data-item-id="${item.id}"
                  ${item.completed ? 'checked' : ''}
                />
                <span class="plan-item__title">${escapeHtml(item.title)}</span>
              </label>
              <div class="plan-item__meta">
                <span>${escapeHtml(item.groupName)}</span>
                <span>${item.kind === 'daily' ? '每日' : '单次'}</span>
                <span>
                  ${
                    item.origin === 'daily'
                      ? '自动入列'
                      : item.origin === 'quick'
                        ? '今日速记'
                        : '手动摘取'
                  }
                </span>
                <button class="text-button text-button--danger" data-action="remove-plan-item" data-item-id="${item.id}">
                  删除
                </button>
              </div>
              ${
                item.subtasks.length
                  ? `
                    <ul class="subtask-checks">
                      ${item.subtasks
                        .map(
                          (subtask) => `
                            <li>
                              <label class="check-row check-row--sub">
                                <input
                                  type="checkbox"
                                  data-action="toggle-plan-subtask"
                                  data-item-id="${item.id}"
                                  data-subtask-id="${subtask.id}"
                                  ${subtask.completed ? 'checked' : ''}
                                />
                                <span>${escapeHtml(subtask.title)}</span>
                              </label>
                            </li>
                          `,
                        )
                        .join('')}
                    </ul>
                  `
                  : ''
              }
            </li>
          `,
        )
        .join('')}
    </ul>
  `;
}

function renderTemplateQuickPanel(currentState: AppState): string {
  const groupId = syncBoardGroup(currentState);
  const tasksByGroup = getTasksByGroup(currentState, selectedDateKey);
  const currentPlan = currentState.dailyPlans[selectedDateKey];
  const tasks = tasksByGroup.get(groupId) ?? [];

  return `
    <section class="rail-section">
      <div class="rail-section__header">
        <p class="panel__eyebrow">Templates</p>
        <strong class="panel__title">添加模板</strong>
      </div>
      <div class="group-switcher">
        ${currentState.groups
          .map(
            (group) => `
              <button
                class="chip-button ${group.id === groupId ? 'chip-button--active' : ''}"
                data-action="select-board-group"
                data-group-id="${group.id}"
              >
                ${escapeHtml(group.name)}
              </button>
            `,
          )
          .join('')}
      </div>
      ${
        tasks.length
          ? `
            <ul class="template-pick-list">
              ${tasks
                .map((task) => {
                  const inPlan = currentPlan?.items.some((item) => item.templateId === task.id) ?? false;
                  const isSelectable = isTaskActiveOnDate(task, selectedDateKey);

                  return `
                    <li>
                      <div class="template-pick__info">
                        <strong>${escapeHtml(task.title)}</strong>
                        <span>${task.kind === 'daily' ? '每日' : '单次'} · ${task.subtasks.length} 子项</span>
                      </div>
                      <button
                        class="chip-button"
                        data-action="add-to-plan"
                        data-task-id="${task.id}"
                        ${inPlan || !isSelectable ? 'disabled' : ''}
                      >
                        ${inPlan ? '已在计划' : '添加'}
                      </button>
                    </li>
                  `;
                })
                .join('')}
            </ul>
          `
          : '<p class="muted-text">此组暂无可用模板。</p>'
      }
    </section>
  `;
}

function renderArtworkStage(): string {
  const artwork = currentArtwork();

  if (artworkLoading || !artworkImageReady) {
    return `
      <section class="gallery-stage">
        <div class="gallery-wall">
          <div class="art-loading">载入画作中…</div>
        </div>
      </section>
    `;
  }

  if (artworkError || !artwork) {
    return `
      <section class="gallery-stage">
        <div class="gallery-wall">
          <div class="art-loading">${artworkError ?? '暂无画作'}</div>
        </div>
      </section>
    `;
  }

  return `
    <section class="gallery-stage">
      <div class="gallery-wall">
        <div class="gallery-hotspot gallery-hotspot--left" aria-hidden="true">
          <button class="gallery-nav gallery-nav--left" data-action="previous-art" aria-label="上一幅">
            <span class="gallery-nav__glyph">‹</span>
          </button>
        </div>
        <div class="art-stage">
          <div class="frame-wrapper">
            <div class="frame-shell">
              <div class="frame-media">
                <img class="frame-image" src="${escapeHtml(artwork.image)}" alt="${escapeHtml(artwork.title)}" />
              </div>
            </div>
          </div>
        </div>
        <div class="gallery-hotspot gallery-hotspot--right" aria-hidden="true">
          <button class="gallery-nav gallery-nav--right" data-action="next-art" aria-label="下一幅">
            <span class="gallery-nav__glyph">›</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderBoard(currentState: AppState): string {
  const stats = planStats(currentState, selectedDateKey);
  const dates = recentDateKeys(todayKey);

  return `
    <div class="screen screen--board immersive-board">
      <div class="board-chrome">
        <span>晨页</span>
        <span>${formatDisplayDate(selectedDateKey)}</span>
      </div>
      <div class="gallery-layout gallery-layout--immersive">
        ${renderArtworkStage()}

        <aside class="task-rail task-rail--immersive">
          <div class="rail-toolbar">
            <button class="tool-button tool-button--ghost" data-action="export-json">导出</button>
            <button class="tool-button tool-button--ghost" data-action="open-edit">模板</button>
          </div>

          <section class="rail-section rail-section--hero rail-section--flat">
            <p class="panel__eyebrow">Plan</p>
            <h1>${formatDisplayDate(selectedDateKey)}</h1>
            <div class="hero-stat">
              <span>完成</span>
              <strong>${stats.completed} / ${stats.total}</strong>
            </div>
          </section>

          <nav class="date-strip" aria-label="最近日期">
            ${dates
              .map(
                (dateKey) => `
                  <button
                    class="date-chip ${dateKey === selectedDateKey ? 'is-active' : ''}"
                    data-action="select-date"
                    data-date-key="${dateKey}"
                  >
                    ${formatDateChip(dateKey, todayKey)}
                  </button>
                `,
              )
              .join('')}
          </nav>

          ${
            selectedDateKey === todayKey
              ? `
                <form class="form-card form-card--quick form-card--ghost" data-form="quick-task">
                  <label class="field field--wide">
                    <span>今日速记</span>
                    <input name="title" maxlength="60" placeholder="只进今日" required />
                  </label>
                  <button type="submit">添加</button>
                </form>
              `
              : ''
          }

          <section class="rail-section rail-section--plan rail-section--flat">
            <div class="rail-section__header">
              <p class="panel__eyebrow">Tasks</p>
              <strong class="panel__title">${stats.total} 项</strong>
            </div>
            ${renderPlan(currentState)}
          </section>

          ${renderTemplateQuickPanel(currentState)}
        </aside>
      </div>
    </div>
  `;
}

function renderTaskCard(taskId: string, selectedPlanDate: string, currentState: AppState): string {
  const task = currentState.tasks.find((item) => item.id === taskId);
  if (!task) {
    return '';
  }

  const currentPlan = currentState.dailyPlans[selectedPlanDate];
  const isSelectable = isTaskActiveOnDate(task, selectedPlanDate);
  const inPlan = currentPlan?.items.some((item) => item.templateId === task.id) ?? false;
  const canAutoAdd = task.kind === 'daily';
  const addLabel = !isSelectable ? '此日尚无此任务' : selectedPlanDate === todayKey ? '加入今日' : '加入此日';

  return `
    <li class="task-card">
      <div class="task-card__head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <div class="task-card__meta">
            <span>${task.kind === 'daily' ? '每日' : '单次'}</span>
            <span>${task.subtasks.length} 子项</span>
            ${canAutoAdd ? `<span>${task.autoAddToPlan ? '自动入列' : '手动编排'}</span>` : ''}
          </div>
        </div>
        <div class="task-card__actions">
          <button
            class="chip-button"
            data-action="add-to-plan"
            data-task-id="${task.id}"
            ${inPlan || !isSelectable ? 'disabled' : ''}
          >
            ${inPlan ? '已在计划' : addLabel}
          </button>
          ${
            canAutoAdd
              ? `
                <button class="chip-button" data-action="toggle-auto-add" data-task-id="${task.id}">
                  ${task.autoAddToPlan ? '取消自动' : '设为自动'}
                </button>
              `
              : ''
          }
          <button class="chip-button chip-button--danger" data-action="delete-task" data-task-id="${task.id}">
            删除
          </button>
        </div>
      </div>

      ${
        task.subtasks.length
          ? `
            <ul class="subtask-list">
              ${task.subtasks
                .map(
                  (subtask) => `
                    <li>
                      <span>${escapeHtml(subtask.title)}</span>
                      <button
                        class="text-button text-button--danger"
                        data-action="delete-subtask"
                        data-task-id="${task.id}"
                        data-subtask-id="${subtask.id}"
                      >
                        删除
                      </button>
                    </li>
                  `,
                )
                .join('')}
            </ul>
          `
          : '<p class="muted-text">尚无子任务。若此事常有固定步骤，拆开便清楚。</p>'
      }

      <form class="inline-form" data-form="subtask" data-task-id="${task.id}">
        <input name="title" maxlength="40" placeholder="添加子任务" required />
        <button type="submit">添加</button>
      </form>
    </li>
  `;
}

function renderEdit(currentState: AppState): string {
  const tasksByGroup = getTasksByGroup(currentState, todayKey);

  return `
    <div class="screen screen--edit">
      ${renderEditHeader()}
      <section class="edit-shell">
        <aside class="edit-sidebar">
          <div class="panel panel--dense">
            <p class="panel__eyebrow">Plan Target</p>
            <strong class="panel__title">${formatDisplayDate(selectedDateKey)}</strong>
            <p class="muted-text">模板在此维护，计划仍按日独立存。</p>
          </div>

          <form class="form-card" data-form="group">
            <label class="field">
              <span>新增分组</span>
              <input name="name" maxlength="24" placeholder="如：学习 / 财务" required />
            </label>
            <button type="submit">新建分组</button>
          </form>
        </aside>

        <section class="edit-content">
          ${currentState.groups
            .map((group) => {
              const tasks = tasksByGroup.get(group.id) ?? [];

              return `
                <section class="group-panel">
                  <header class="group-panel__header">
                    <div>
                      <p class="panel__eyebrow">${escapeHtml(group.name)}</p>
                      <strong class="panel__title">${tasks.length} 条模板</strong>
                    </div>
                  </header>

                  <form class="form-card form-card--task" data-form="task" data-group-id="${group.id}">
                    <label class="field field--wide">
                      <span>任务标题</span>
                      <input name="title" maxlength="60" placeholder="写清楚，不要抽象口号" required />
                    </label>
                    <label class="field">
                      <span>任务类型</span>
                      <select name="kind" aria-label="任务类型">
                        <option value="once">单次任务</option>
                        <option value="daily">每日任务</option>
                      </select>
                    </label>
                    <label class="toggle-field">
                      <input type="checkbox" name="autoAddToPlan" />
                      <span>每日任务默认自动入列</span>
                    </label>
                    <button type="submit">添加任务</button>
                  </form>

                  ${
                    tasks.length
                      ? `<ul class="task-list">${tasks.map((task) => renderTaskCard(task.id, selectedDateKey, currentState)).join('')}</ul>`
                      : '<div class="panel panel--empty"><p>此组尚空。</p></div>'
                  }
                </section>
              `;
            })
            .join('')}
        </section>
      </section>
    </div>
  `;
}

function render(): void {
  state = ensurePlanForDate(state, selectedDateKey);
  const route = getRoute();
  app.innerHTML = route === 'edit' ? renderEdit(state) : renderBoard(state);
}

app.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const formType = form.dataset.form;
  const formData = new FormData(form);

  if (formType === 'group') {
    await persistAndRender(addGroup(state, String(formData.get('name') ?? '')));
    form.reset();
    return;
  }

  if (formType === 'task') {
    const groupId = form.dataset.groupId;
    if (!groupId) {
      return;
    }

    const kind = String(formData.get('kind') ?? 'once') as TaskKind;
    const autoAddToPlan = kind === 'daily' && formData.get('autoAddToPlan') === 'on';
    await persistAndRender(addTask(state, groupId, String(formData.get('title') ?? ''), kind, autoAddToPlan));
    form.reset();
    return;
  }

  if (formType === 'quick-task') {
    await persistAndRender(addQuickTaskToPlan(state, todayKey, String(formData.get('title') ?? '')));
    focusQuickTaskInput();
    return;
  }

  if (formType === 'subtask') {
    const taskId = form.dataset.taskId;
    if (!taskId) {
      return;
    }

    await persistAndRender(addSubtask(state, taskId, String(formData.get('title') ?? '')));
    form.reset();
  }
});

app.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionNode = target.closest<HTMLElement>('[data-action]');
  if (!actionNode) {
    return;
  }

  const action = actionNode.dataset.action;

  if (action === 'open-edit') {
    navigate('edit');
    return;
  }

  if (action === 'open-board') {
    navigate('board');
    return;
  }

  if (action === 'previous-art' || action === 'next-art') {
    if (!artworks.length) {
      return;
    }

    const offset = action === 'next-art' ? 1 : -1;
    const nextIndex = ((state.ui.artworkIndex + offset) % artworks.length + artworks.length) % artworks.length;
    await showArtworkAtIndex(nextIndex);
    return;
  }

  if (action === 'select-board-group') {
    boardGroupId = actionNode.dataset.groupId ?? boardGroupId;
    render();
    return;
  }

  if (action === 'select-date') {
    selectedDateKey = actionNode.dataset.dateKey ?? todayKey;
    state = ensurePlanForDate(state, selectedDateKey);
    render();
    return;
  }

  if (action === 'add-to-plan') {
    const taskId = actionNode.dataset.taskId;
    if (taskId) {
      await persistAndRender(addTaskToPlan(state, taskId, selectedDateKey));
    }
    return;
  }

  if (action === 'toggle-auto-add') {
    const taskId = actionNode.dataset.taskId;
    if (taskId) {
      await persistAndRender(toggleTaskAutoAdd(state, taskId));
    }
    return;
  }

  if (action === 'delete-task') {
    const taskId = actionNode.dataset.taskId;
    if (taskId) {
      await persistAndRender(deleteTask(state, taskId));
    }
    return;
  }

  if (action === 'remove-plan-item') {
    const itemId = actionNode.dataset.itemId;
    if (itemId) {
      await persistAndRender(removePlanItem(state, selectedDateKey, itemId));
    }
    return;
  }

  if (action === 'delete-subtask') {
    const taskId = actionNode.dataset.taskId;
    const subtaskId = actionNode.dataset.subtaskId;
    if (taskId && subtaskId) {
      await persistAndRender(deleteSubtask(state, taskId, subtaskId));
    }
    return;
  }

  if (action === 'export-json') {
    exportJson();
  }
});

app.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const action = target.dataset.action;
  if (action === 'toggle-plan-item') {
    const itemId = target.dataset.itemId;
    if (itemId) {
      await persistAndRender(togglePlanItem(state, selectedDateKey, itemId, target.checked));
    }
    return;
  }

  if (action === 'toggle-plan-subtask') {
    const itemId = target.dataset.itemId;
    const subtaskId = target.dataset.subtaskId;
    if (itemId && subtaskId) {
      await persistAndRender(togglePlanSubtask(state, selectedDateKey, itemId, subtaskId, target.checked));
    }
  }
});

window.addEventListener('hashchange', render);

render();
await saveState(state);
void loadArtworksIntoView();
