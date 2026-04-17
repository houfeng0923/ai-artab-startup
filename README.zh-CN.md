# 晨页

一个基于 `WXT` 的艺术化 Chrome 新标签页扩展。

它做两件事：

1. 中间展示沉浸式艺术图
2. 右侧提供紧凑的今日计划面板

当前项目沿用 `Artab: New Tab, New Art` 的公开艺术数据入口思路，而任务数据完全保存在本地。

English README: [README.md](./README.md)

## 功能

- 支持任务模板分组
- 支持单次任务与每日任务
- 支持可独立勾选的子任务
- 支持今日计划与最近 5 日历史
- 支持“仅属于今天”的速记任务
- 支持从某一天移除模板任务，而不删除模板本身
- 数据本地优先保存，并支持 JSON 导出
- 每次新开标签页随机展示一幅艺术图

## 技术栈

- `WXT`
- `TypeScript`
- `browser.storage.local`

## 运行

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

产物输出目录：

```text
output/chrome-mv3
```

在 Chrome 中加载方式：

1. 打开 `chrome://extensions`
2. 开启 `Developer mode`
3. 点击 `Load unpacked`
4. 选择 `output/chrome-mv3`

## 数据模型

### 任务

任务分成两层：

- `TaskTemplate`：长期模板
- `DailyPlan`：某一天的任务实例与完成状态

这样做是为了避免“修改模板污染历史记录”这种常见烂问题。

### 艺术图

当前艺术图默认从以下远程源读取：

- `https://www.gstatic.com/culturalinstitute/tabext/imax_2_2.json`
- `lh3.ggpht.com` 下的图片资源

若远程源失败，会退回内置兜底画作。

## 脚本

- `pnpm dev`：启动扩展开发模式
- `pnpm build`：构建生产版本
- `pnpm compile`：仅做类型检查
- `pnpm zip`：打包扩展 zip

## 当前状态

- 任务数据仅保存在本地
- 暂无云同步
- 暂无提醒 / 通知系统
- 暂无导入流程，仅支持 JSON 导出
- 新标签页每次打开会随机切换艺术图

## 说明

本项目参考了 `Artab` 的展示方向与公开数据入口思路，但不直接拷贝其项目代码。
