# 晨页

一个基于 `WXT` 的 Chrome New Tab 扩展。

它做两件事：

1. 中间用沉浸式艺术图做展墙
2. 右侧用本地优先的任务栏管理今日计划

当前艺术数据沿用 `Artab: New Tab, New Art` 路线，读取 Google Arts 的公开集合，并在本地缓存；任务数据存于浏览器本地存储。

## Features

- grouped task templates
- one-time and daily tasks
- subtasks with independent checkbox state
- today plan plus recent 5-day history
- quick add for "today only" notes
- remove template task from a single day without deleting the template
- local-first storage with JSON export
- immersive new tab art wall with random artwork on each open

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

产物输出到：

```text
output/chrome-mv3
```

然后在 Chrome 里：

1. 打开 `chrome://extensions`
2. 开启 `Developer mode`
3. 选择 `Load unpacked`
4. 指向 `output/chrome-mv3`

## Data

### Tasks

任务分成两层：

- `TaskTemplate`: 长期模板
- `DailyPlan`: 某一天的任务实例与完成状态

这能避免“改模板污染历史”这种烂事。

### Artwork

默认从下列远程源读取：

- `https://www.gstatic.com/culturalinstitute/tabext/imax_2_2.json`
- image hosts under `lh3.ggpht.com`

若远程取数失败，会退回内置兜底画作。

## Scripts

- `pnpm dev`: run extension dev server
- `pnpm build`: build production extension
- `pnpm compile`: type-check only
- `pnpm zip`: package extension zip

## Current Notes

- task data is local only
- no cloud sync
- no reminder/notification workflow yet
- no import flow yet, only JSON export
- new tab artwork changes randomly on each fresh page open

## License / Attribution

本项目当前只“参考” `Artab` 的展示方向与公开数据入口，不直接拷贝其项目代码。
