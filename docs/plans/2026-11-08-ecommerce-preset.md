# 电商运营预设（可选）

- 日期：2026-11-08
- 相关：Issue #2（本 fork 的「电商版」目标）

## 为什么

本 fork 想在原版 DS Bot 之外提供一组面向电商运营的 Bot 团队模板。它必须是**可选**的：默认体验、非电商用户的一切行为都不变；只有用户明确要电商团队时才初始化。

电商运营有几条硬性工作边界：后台只读、合规红线、每批 SKU 不超过 15 个、禁止 1688 拍单直发顾客。把这些写进预设的默认提示词和一个共享技能里，比每次口头交代更可靠。

## 已定的行为

- **默认关闭。** 预设只在用户于 Main Bot 对话里明确要求（Main Bot 调用 `apply_team_preset`），或直接请求 `POST /api/bot` 的 `apply-preset` 时才开启。没有开启时，团队与开关前完全一致。
- **一键初始化团队。** 开启 `ecommerce` 预设后：
  - 第一个 Main Bot 成为调度者：`role` 设为 `Dispatcher`，并在其 `instructions` 末尾追加一段带 `[ecommerce-preset]` 标记的电商调度规则（原有 instructions 保留，不覆盖）。
  - 用既有的 Bot 创建 API（`rt.createBot`）创建三个专职 Bot：`Research`（规则/文档研究）、`Sourcing`（货源巡检）、`Store Ops`（店铺运营）。
  - 团队默认提示词遵循：后台只读、合规红线、每批 SKU ≤15、禁 1688 拍单直发顾客。
- **共享技能 `ecommerce-thinking`。** 技能正文来自 `ds-bot/src/host/skills/ecommerce-thinking/SKILL.md`，保存为团队能力库里的一条 `skill`，并附加到上述四个 Bot（Main 与三个专职）。技能只在预设开启时附加。
- **知识库骨架。** 在团队工作区下创建 `电商知识库/`，其中包含 `选品/`、`定价/`、`合规/`、`任务板/`、`证据/`、`日志/` 六个目录。已存在的目录不重建、不覆盖。
- **关闭。** 关闭 `ecommerce`（`disable_team_preset` 或 `disable-preset`）只把技能从预设建立的 Bot 上解绑，并把预设标记为关闭；Bot、它们的文件、知识库目录和共享技能都保留。再次开启会重新附加技能，但不会重复创建 Bot。
- **幂等。** 再次开启时按名字复用已存在的 Bot，不重复创建；主 Bot 的 `instructions` 用 `[ecommerce-preset]` 标记判断，已追加过就不再追加。
- **持久化。** `state.json` 的 `presets.ecommerce` 记录 `{ active, appliedAt, botIds, knowledgeRoot }`；团队视图（`state`）返回 `presets` 字段，说明每个预设是否开启。

## 不做什么

- 不自动为任何用户开启预设，不改动非电商团队的默认行为。
- 关闭预设不删除 Bot、不删除文件、不清理知识库。
- 不 patch DSH：只用 ds-bot 既有的 Bot 创建 API、能力（技能）机制和插件的工具/接口。
- 本期不做专门的设置页图形 UI；选择入口是 Main Bot 的 `list_team_presets` / `apply_team_preset` / `disable_team_preset` 工具，以及 `POST /api/bot` 的 `apply-preset` / `disable-preset`。

## 已知限制

- 如果团队里已有同名 Bot，预设会复用它、附加技能，但不会覆盖它的 instructions。
- 主 Bot 已有的自定义 instructions 会被追加电商调度段落，而非替换。
- 关闭后共享技能 `ecommerce-thinking` 仍留在能力库，便于以后再次开启或手动使用。
- 目前只有 `ecommerce` 一个预设；新增预设需要在 `src/host/presets.js` 的注册表里加一项。

## 变更

- 2026-11-08：初版，Issue #2。
