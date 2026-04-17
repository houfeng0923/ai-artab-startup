# Chenye

An art-first, local-first Chrome new tab built with `WXT`.

The page does two jobs:

1. Show an immersive artwork in the center
2. Keep a compact planning panel on the right

This project currently follows the public artwork feed approach used by `Artab: New Tab, New Art`, while keeping task data entirely local.

中文说明见：[README.zh-CN.md](./README.zh-CN.md)

## Features

- grouped task templates
- one-time and daily tasks
- subtasks with independent checkbox state
- today plan plus recent 5-day history
- quick add for "today only" notes
- remove a template task from a single day without deleting the template
- local-first storage with JSON export
- immersive artwork wall with a random artwork on each fresh tab open

## Stack

- `WXT`
- `TypeScript`
- `browser.storage.local`

## Run

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

The production output is generated at:

```text
output/chrome-mv3
```

Then load it in Chrome:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `output/chrome-mv3`

## Data Model

### Tasks

Tasks are split into two layers:

- `TaskTemplate`: long-lived template data
- `DailyPlan`: per-day task instances and completion state

This avoids the classic bug where changing a template corrupts historical records.

### Artwork

Artwork is currently loaded from:

- `https://www.gstatic.com/culturalinstitute/tabext/imax_2_2.json`
- image hosts under `lh3.ggpht.com`

If the remote source fails, the extension falls back to bundled artwork items.

## Scripts

- `pnpm dev`: run the extension dev server
- `pnpm build`: build the production extension
- `pnpm compile`: type-check only
- `pnpm zip`: package the extension as a zip

## Current Notes

- task data is local only
- no cloud sync
- no reminder/notification workflow yet
- no import flow yet, only JSON export
- the new tab artwork changes randomly on each fresh page open

## Attribution

This project references the display direction and public data-entry approach of `Artab`, but does not copy its project code.
