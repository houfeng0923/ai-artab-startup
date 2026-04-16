import { AppState, hydrateState } from '@/lib/state';

const STORAGE_KEY = 'startup-tab-state';

export async function loadState(): Promise<AppState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return hydrateState(result[STORAGE_KEY]);
}

export async function saveState(state: AppState): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEY]: state,
  });
}
