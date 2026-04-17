import { compareDateKey, recentDateKeys, todayDateKey } from '@/lib/date';

export type TaskKind = 'once' | 'daily';
export type PlanOrigin = 'manual' | 'daily' | 'quick';
export type ThemeMode = 'sage' | 'paper' | 'midnight';
export type ArtworkSource = 'artab';

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export interface SubtaskTemplate {
  id: string;
  title: string;
}

export interface TaskTemplate {
  id: string;
  groupId: string;
  title: string;
  kind: TaskKind;
  createdOn: string;
  deletedOn: string | null;
  autoAddToPlan: boolean;
  subtasks: SubtaskTemplate[];
}

export interface PlanSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface DailyTaskItem {
  id: string;
  templateId: string;
  groupId: string;
  groupName: string;
  title: string;
  kind: TaskKind;
  origin: PlanOrigin;
  completed: boolean;
  subtasks: PlanSubtask[];
}

export interface DailyPlan {
  date: string;
  items: DailyTaskItem[];
  removedTemplateIds: string[];
}

export interface UiState {
  theme: ThemeMode;
  artworkSource: ArtworkSource;
  artworkIndex: number;
}

export interface AppState {
  version: number;
  groups: Group[];
  tasks: TaskTemplate[];
  dailyPlans: Record<string, DailyPlan>;
  ui: UiState;
}

const DEFAULT_GROUPS = ['工作', '健康', '收件箱'];

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createDefaultGroups(createdAt: string): Group[] {
  return DEFAULT_GROUPS.map((name) => ({
    id: createId('group'),
    name,
    createdAt,
  }));
}

function createSnapshot(task: TaskTemplate, groupName: string, origin: PlanOrigin): DailyTaskItem {
  return {
    id: `${task.id}:${origin}`,
    templateId: task.id,
    groupId: task.groupId,
    groupName,
    title: task.title,
    kind: task.kind,
    origin,
    completed: false,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completed: false,
    })),
  };
}

function sortPlanItems(items: DailyTaskItem[]): DailyTaskItem[] {
  return [...items].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    const groupOrder = left.groupName.localeCompare(right.groupName, 'zh-CN');
    if (groupOrder !== 0) {
      return groupOrder;
    }

    return left.title.localeCompare(right.title, 'zh-CN');
  });
}

export function createInitialState(): AppState {
  const todayKey = todayDateKey();

  return {
    version: 2,
    groups: createDefaultGroups(todayKey),
    tasks: [],
    dailyPlans: {},
    ui: {
      theme: 'sage',
      artworkSource: 'artab',
      artworkIndex: 0,
    },
  };
}

function normalizeTheme(value: unknown): ThemeMode {
  if (value === 'paper') {
    return 'paper';
  }

  if (value === 'midnight' || value === 'dark') {
    return 'midnight';
  }

  return 'sage';
}

export function isTaskActiveOnDate(task: TaskTemplate, dateKey: string): boolean {
  if (compareDateKey(task.createdOn, dateKey) > 0) {
    return false;
  }

  if (task.deletedOn && compareDateKey(dateKey, task.deletedOn) >= 0) {
    return false;
  }

  return true;
}

export function getActiveTasks(state: AppState, onDate = todayDateKey()): TaskTemplate[] {
  return state.tasks.filter((task) => isTaskActiveOnDate(task, onDate));
}

export function getTasksByGroup(state: AppState, onDate = todayDateKey()): Map<string, TaskTemplate[]> {
  const groups = new Map<string, TaskTemplate[]>();

  for (const task of getActiveTasks(state, onDate)) {
    const tasks = groups.get(task.groupId) ?? [];
    tasks.push(task);
    groups.set(task.groupId, tasks);
  }

  for (const tasks of groups.values()) {
    tasks.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
  }

  return groups;
}

export function ensurePlanForDate(state: AppState, dateKey: string): AppState {
  const plan = state.dailyPlans[dateKey] ?? { date: dateKey, items: [], removedTemplateIds: [] };
  const groupsById = new Map(state.groups.map((group) => [group.id, group]));
  const nextItems = [...plan.items];
  let changed = !(dateKey in state.dailyPlans);

  for (const task of state.tasks) {
    if (
      task.kind !== 'daily' ||
      !task.autoAddToPlan ||
      !isTaskActiveOnDate(task, dateKey) ||
      plan.removedTemplateIds.includes(task.id)
    ) {
      continue;
    }

    if (nextItems.some((item) => item.templateId === task.id)) {
      continue;
    }

    const groupName = groupsById.get(task.groupId)?.name ?? '未分组';
    nextItems.push(createSnapshot(task, groupName, 'daily'));
    changed = true;
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    dailyPlans: {
      ...state.dailyPlans,
      [dateKey]: {
        date: dateKey,
        items: sortPlanItems(nextItems),
        removedTemplateIds: plan.removedTemplateIds,
      },
    },
  };
}

export function ensureRecentPlans(state: AppState, anchorDate = todayDateKey()): AppState {
  return recentDateKeys(anchorDate).reduce((nextState, dateKey) => ensurePlanForDate(nextState, dateKey), state);
}

export function hydrateState(value: unknown): AppState {
  if (!value || typeof value !== 'object') {
    return ensureRecentPlans(createInitialState());
  }

  const candidate = value as Partial<AppState>;
  if (!Array.isArray(candidate.groups) || !Array.isArray(candidate.tasks) || !candidate.dailyPlans) {
    return ensureRecentPlans(createInitialState());
  }

  const tasks = candidate.tasks.map((task) => ({
    ...task,
    autoAddToPlan: task.kind === 'daily' ? Boolean(task.autoAddToPlan) : false,
  }));

  const state: AppState = {
    version: typeof candidate.version === 'number' ? candidate.version : 2,
    groups: candidate.groups,
    tasks,
    dailyPlans: Object.fromEntries(
      Object.entries(candidate.dailyPlans).map(([dateKey, plan]) => [
        dateKey,
        {
          ...plan,
          removedTemplateIds: Array.isArray(plan.removedTemplateIds) ? plan.removedTemplateIds : [],
        },
      ]),
    ),
    ui: {
      theme: normalizeTheme(candidate.ui?.theme),
      artworkSource: 'artab',
      artworkIndex: typeof candidate.ui?.artworkIndex === 'number' ? candidate.ui.artworkIndex : 0,
    },
  };

  return ensureRecentPlans(state);
}

export function addGroup(state: AppState, name: string): AppState {
  const trimmed = name.trim();
  if (!trimmed) {
    return state;
  }

  return {
    ...state,
    groups: [
      ...state.groups,
      {
        id: createId('group'),
        name: trimmed,
        createdAt: todayDateKey(),
      },
    ],
  };
}

export function addTask(
  state: AppState,
  groupId: string,
  title: string,
  kind: TaskKind,
  autoAddToPlan = false,
): AppState {
  const trimmed = title.trim();
  if (!trimmed) {
    return state;
  }

  const nextState: AppState = {
    ...state,
    tasks: [
      ...state.tasks,
      {
        id: createId('task'),
        groupId,
        title: trimmed,
        kind,
        createdOn: todayDateKey(),
        deletedOn: null,
        autoAddToPlan: kind === 'daily' ? autoAddToPlan : false,
        subtasks: [],
      },
    ],
  };

  return ensureRecentPlans(nextState);
}

export function addSubtask(state: AppState, taskId: string, title: string): AppState {
  const trimmed = title.trim();
  if (!trimmed) {
    return state;
  }

  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            subtasks: [
              ...task.subtasks,
              {
                id: createId('subtask'),
                title: trimmed,
              },
            ],
          }
        : task,
    ),
  };
}

export function deleteSubtask(state: AppState, taskId: string, subtaskId: string): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
          }
        : task,
    ),
  };
}

export function deleteTask(state: AppState, taskId: string, deletedOn = todayDateKey()): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            deletedOn,
          }
        : task,
    ),
  };
}

export function toggleTaskAutoAdd(state: AppState, taskId: string): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && task.kind === 'daily'
        ? {
            ...task,
            autoAddToPlan: !task.autoAddToPlan,
          }
        : task,
    ),
  };
}

export function setTheme(state: AppState, theme: ThemeMode): AppState {
  if (state.ui.theme === theme) {
    return state;
  }

  return {
    ...state,
    ui: {
      ...state.ui,
      theme,
    },
  };
}

export function setArtworkIndex(state: AppState, artworkIndex: number): AppState {
  if (state.ui.artworkIndex === artworkIndex) {
    return state;
  }

  return {
    ...state,
    ui: {
      ...state.ui,
      artworkIndex,
    },
  };
}

export function addTaskToPlan(state: AppState, taskId: string, dateKey: string): AppState {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !isTaskActiveOnDate(task, dateKey)) {
    return state;
  }

  const ensured = ensurePlanForDate(state, dateKey);
  const plan = ensured.dailyPlans[dateKey];
  if (plan.items.some((item) => item.templateId === taskId)) {
    return ensured;
  }

  const groupName = ensured.groups.find((group) => group.id === task.groupId)?.name ?? '未分组';

  return {
    ...ensured,
    dailyPlans: {
      ...ensured.dailyPlans,
      [dateKey]: {
        date: dateKey,
        items: sortPlanItems([...plan.items, createSnapshot(task, groupName, 'manual')]),
        removedTemplateIds: plan.removedTemplateIds.filter((id) => id !== taskId),
      },
    },
  };
}

export function addQuickTaskToPlan(state: AppState, dateKey: string, title: string): AppState {
  const trimmed = title.trim();
  if (!trimmed) {
    return state;
  }

  const ensured = ensurePlanForDate(state, dateKey);
  const quickId = createId('quick');

  return {
    ...ensured,
    dailyPlans: {
      ...ensured.dailyPlans,
      [dateKey]: {
        date: dateKey,
        items: sortPlanItems([
          ...ensured.dailyPlans[dateKey].items,
          {
            id: quickId,
            templateId: quickId,
            groupId: 'quick',
            groupName: '今日速记',
            title: trimmed,
            kind: 'once',
            origin: 'quick',
            completed: false,
            subtasks: [],
          },
        ]),
        removedTemplateIds: ensured.dailyPlans[dateKey].removedTemplateIds,
      },
    },
  };
}

export function removePlanItem(state: AppState, dateKey: string, itemId: string): AppState {
  const plan = state.dailyPlans[dateKey];
  if (!plan) {
    return state;
  }

  const item = plan.items.find((entry) => entry.id === itemId);
  if (!item) {
    return state;
  }

  const sourceTask = state.tasks.find((task) => task.id === item.templateId);
  const shouldRememberRemoval = item.origin === 'daily' || Boolean(sourceTask?.autoAddToPlan);
  const removedTemplateIds = shouldRememberRemoval
    ? Array.from(new Set([...plan.removedTemplateIds, item.templateId]))
    : plan.removedTemplateIds;

  return {
    ...state,
    dailyPlans: {
      ...state.dailyPlans,
      [dateKey]: {
        ...plan,
        items: plan.items.filter((entry) => entry.id !== itemId),
        removedTemplateIds,
      },
    },
  };
}

export function togglePlanItem(state: AppState, dateKey: string, itemId: string, completed: boolean): AppState {
  const plan = state.dailyPlans[dateKey];
  if (!plan) {
    return state;
  }

  return {
    ...state,
    dailyPlans: {
      ...state.dailyPlans,
      [dateKey]: {
        ...plan,
        items: sortPlanItems(
          plan.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  completed,
                }
              : item,
          ),
        ),
      },
    },
  };
}

export function togglePlanSubtask(
  state: AppState,
  dateKey: string,
  itemId: string,
  subtaskId: string,
  completed: boolean,
): AppState {
  const plan = state.dailyPlans[dateKey];
  if (!plan) {
    return state;
  }

  return {
    ...state,
    dailyPlans: {
      ...state.dailyPlans,
      [dateKey]: {
        ...plan,
        items: plan.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                subtasks: item.subtasks.map((subtask) =>
                  subtask.id === subtaskId
                    ? {
                        ...subtask,
                        completed,
                      }
                    : subtask,
                ),
              }
            : item,
        ),
      },
    },
  };
}
