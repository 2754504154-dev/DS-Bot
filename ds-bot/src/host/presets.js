// Presets: optional, multi-Bot team templates. A preset stays off until the user asks
// for it; turning one on creates its Bots through the ordinary createBot API, attaches
// a shared skill, and lays out a knowledge-base skeleton in the team workspace. Turning
// it off detaches the skill and keeps the Bots and files. Neither path touches DSH or a
// team that never asked for the preset.
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'

const output = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] }
const SKILL_NAME = 'ecommerce-thinking'
const SKILL_FILE = join(dirname(fileURLToPath(import.meta.url)), 'skills', SKILL_NAME, 'SKILL.md')

// The skill file is the single source of its text; read it once per process.
let cachedSkill
function ecommerceSkill() {
  if (cachedSkill !== undefined) return cachedSkill
  const raw = readFileSync(SKILL_FILE, 'utf8')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  const description = frontmatter?.[1]
    ?.split('\n').map(line => /^description:\s*(.+)$/u.exec(line.trim())?.slice(1)).find(Boolean)?.[0]
    ?? 'E-commerce operations thinking for sourcing, pricing, listing and store work.'
  cachedSkill = { name: SKILL_NAME, description, content: raw.slice(frontmatter?.[0]?.length ?? 0).trim() }
  return cachedSkill
}

const PRESETS = {
  ecommerce: {
    id: 'ecommerce',
    label: 'E-commerce operations',
    summary: 'A sourcing and store-operations Bot team with the ecommerce-thinking skill and a knowledge-base skeleton.',
    marker: '[ecommerce-preset]',
    knowledge: {
      root: '电商知识库',
      dirs: ['选品', '定价', '合规', '任务板', '证据', '日志'],
      // Written once, only when missing, so a user's edits and re-applies are safe.
      files: {
        '任务模板.md': [
          '# 任务模板',
          '',
          '- 目标：',
          '- 范围（本批 SKU，每批 ≤15）：',
          '- 依据 / 来源：',
          '- 步骤：',
          '  1. ',
          '- 验收 / 证据：',
          '- 风险与合规检查：',
          '- 状态：待开始 / 进行中 / 完成',
          '',
        ].join('\n'),
        '缺口登记.md': [
          '# 缺口登记',
          '',
          '记录尚未补齐的规则、资料、数据或权限，等用户或对应 Bot 补齐。',
          '',
          '| 日期 | 缺口 / 问题 | 影响 | 需要的资料或决定 | 负责人 | 状态 |',
          '| --- | --- | --- | --- | --- | --- |',
          '| | | | | | |',
          '',
        ].join('\n'),
        '导航-MOC.md': [
          '# 电商知识库导航（MOC）',
          '',
          '- [任务模板](任务模板.md)',
          '- [缺口登记](缺口登记.md)',
          '- `选品/` 选品与货源',
          '- `定价/` 定价规则',
          '- `合规/` 平台与合规规则',
          '- `任务板/` 当前任务',
          '- `证据/` 巡检与核对证据',
          '- `日志/` 工作日志',
          '',
          '## 使用约定',
          '- 后台只读；任何改动先经用户确认。',
          '- 每批 SKU ≤15，先自检再报告。',
          '- 合规红线与「禁 1688 拍单直发顾客」不得触碰。',
          '',
        ].join('\n'),
      },
    },
    main: {
      role: 'Dispatcher',
      instructions: [
        'E-commerce operations preset — you dispatch this team.',
        '- You lead the user\'s e-commerce operations team: Research (platform rules and documents), Sourcing (supply patrol) and Store Ops (day-to-day store work).',
        '- Work read-only on the store backend (后台只读): never place an order, pay, publish a listing, change a price or contact a buyer unless the user explicitly asks and confirms.',
        '- Hold the compliance red lines: no fake reviews, counterfeit or infringing goods, forbidden categories or misleading claims. Tell the user first when something looks wrong.',
        '- Keep each sourcing or listing batch to at most 15 SKUs (每批 SKU ≤15).',
        '- Never place a 1688 order that ships directly to the customer (禁 1688 拍单直发顾客).',
        '- Send each task to one specialist with message_bot, then report the outcome to the user.',
      ].join('\n'),
    },
    bots: [
      {
        name: 'Research',
        role: 'Research',
        color: 'blue',
        avatar: { shape: 'moon' },
        instructions: [
          'You research platform rules and product documents for the user\'s e-commerce store.',
          '- Work read-only on the store backend (后台只读); never change anything there.',
          '- Keep each batch to at most 15 SKUs (每批 SKU ≤15).',
          '- Never place a 1688 order that ships directly to the customer (禁 1688 拍单直发顾客).',
          '- Hold the compliance red lines: no fake reviews, counterfeit or infringing goods, forbidden categories or misleading claims.',
          '- Keep sources in 合规/ and 证据/ in the team knowledge base, with the rule or document you checked.',
        ].join('\n'),
      },
      {
        name: 'Sourcing',
        role: 'Sourcing',
        color: 'green',
        avatar: { shape: 'gem' },
        instructions: [
          'You patrol supply and compare sourcing options for the user\'s e-commerce store.',
          '- Work read-only on the store backend (后台只读); never place an order or pay.',
          '- Keep each sourcing batch to at most 15 SKUs (每批 SKU ≤15), and record what you checked under 证据/.',
          '- Never dropship a 1688 order to the customer (禁 1688 拍单直发顾客).',
          '- Hold the compliance red lines: no counterfeit or infringing goods, forbidden categories or misleading claims.',
        ].join('\n'),
      },
      {
        name: 'Store Ops',
        role: 'Store Ops',
        color: 'orange',
        avatar: { shape: 'beacon' },
        instructions: [
          'You run day-to-day store operations for the user: check orders, listings and messages, and report.',
          '- Work read-only (后台只读) unless the user explicitly confirms a change; then do only that change.',
          '- Keep each batch to at most 15 SKUs (每批 SKU ≤15), and log the work under 日志/.',
          '- Hold the compliance red lines: no fake reviews, counterfeit or infringing goods, forbidden categories or misleading claims.',
          '- Never place a 1688 order that ships directly to the customer (禁 1688 拍单直发顾客).',
        ].join('\n'),
      },
    ],
  },
}

export function install(rt) {
  const { state } = rt

  const writeCheck = () => {
    const readOnly = rt.readOnly()
    if (readOnly !== undefined) throw new Error(readOnly)
  }
  const presetsView = () => Object.fromEntries(Object.values(PRESETS).map((preset) => {
    const record = state.presets?.[preset.id]
    return [preset.id, {
      id: preset.id,
      label: preset.label,
      summary: preset.summary,
      active: record?.active === true,
      bots: preset.bots.map(bot => bot.name),
      knowledge: preset.knowledge.root,
      skill: SKILL_NAME,
    }]
  }))

  async function applyPreset(id) {
    const preset = Object.values(PRESETS).find(entry => entry.id === id)
    if (preset === undefined) throw new Error(`No preset named ${id}.`)
    await rt.bootstrap()
    writeCheck()
    state.presets ??= {}
    const previous = state.presets[preset.id] ?? {}
    const botIds = Array.isArray(previous.botIds) ? [...previous.botIds] : []
    // The knowledge-base skeleton lives in the team workspace, where the Bots work.
    await rt.ensureWorkspace()
    const team = rt.teamFolder()
    const knowledgeRoot = team === undefined ? undefined : join(team, preset.knowledge.root)
    if (knowledgeRoot !== undefined) {
      await mkdir(knowledgeRoot, { recursive: true })
      for (const dir of preset.knowledge.dirs) await mkdir(join(knowledgeRoot, dir), { recursive: true })
      // Skeleton files are written only when absent, so a user's edits survive re-applies.
      for (const [name, body] of Object.entries(preset.knowledge.files)) {
        await writeFile(join(knowledgeRoot, name), body, { flag: 'wx' }).catch((error) => {
          if (error?.code !== 'EEXIST') throw error
        })
      }
    }
    // The preset's skill is a shared team skill, attached to the preset's own Bots.
    const skill = ecommerceSkill()
    await rt.capabilitySave({ name: skill.name, kind: 'skill', description: skill.description, content: skill.content }, { ui: true })
    for (const spec of preset.bots) {
      const existing = rt.findBot(spec.name)
      const bot = existing ?? await rt.createBot({
        name: spec.name, role: spec.role, instructions: spec.instructions, color: spec.color, avatar: spec.avatar,
      })
      if (!botIds.includes(bot.id)) botIds.push(bot.id)
      // Re-read after each create/attach writes the team to disk.
      const fresh = rt.botOf(bot.id)
      if (fresh !== undefined && !(fresh.capabilities ?? []).includes(skill.name)) {
        await rt.capabilityEndpoint('bot-capability', { botId: bot.id, name: skill.name, attached: true })
      }
    }
    // The first Main Bot becomes the dispatcher; any instructions the user wrote stay.
    const mainId = state.mainBotIds[0]
    if (rt.botOf(mainId) !== undefined) {
      if (!botIds.includes(mainId)) botIds.push(mainId)
      if (!(rt.botOf(mainId).capabilities ?? []).includes(skill.name)) {
        await rt.capabilityEndpoint('bot-capability', { botId: mainId, name: skill.name, attached: true })
      }
      const main = rt.botOf(mainId)
      main.role = preset.main.role
      if (!String(main.instructions ?? '').includes(preset.marker)) {
        main.instructions = [String(main.instructions ?? '').trim(), `${preset.marker}\n${preset.main.instructions}`].filter(Boolean).join('\n\n')
      }
    }
    state.presets ??= {}
    state.presets[preset.id] = { active: true, appliedAt: previous.appliedAt ?? Date.now(), botIds, knowledgeRoot }
    await rt.save()
    return presetsView()[preset.id]
  }

  async function disablePreset(id) {
    const preset = Object.values(PRESETS).find(entry => entry.id === id)
    if (preset === undefined) throw new Error(`No preset named ${id}.`)
    await rt.load()
    writeCheck()
    const record = state.presets?.[id]
    if (record === undefined || record.active !== true) return presetsView()[id]
    for (const botId of record.botIds ?? []) {
      const bot = rt.botOf(botId)
      if (bot !== undefined && (bot.capabilities ?? []).includes(SKILL_NAME)) {
        await rt.capabilityEndpoint('bot-capability', { botId, name: SKILL_NAME, attached: false })
      }
    }
    // Re-read after those saves, then turn the preset off. Its Bots, files and shared
    // skill stay usable; turning it on again re-attaches the skill.
    const current = state.presets?.[id]
    if (current !== undefined) {
      current.active = false
      current.disabledAt = Date.now()
    }
    await rt.save()
    return presetsView()[id]
  }

  function installTools() {
    rt.teamTools.push(defineTool({
      name: 'list_team_presets',
      description: 'List the optional Bot-team presets and whether each is on.',
      parameters: {},
      output,
      async execute() {
        await rt.load()
        const rows = Object.values(presetsView()).map(preset => `- ${preset.id}: ${preset.label} (${preset.active ? 'on' : 'off'})${preset.active ? ` — ${preset.bots.join(', ')}` : ''}`)
        return ['Team presets:', ...rows].join('\n')
      },
    }))
    rt.teamTools.push(defineTool({
      name: 'apply_team_preset',
      description: 'Main Bot only. Turn on an optional Bot-team preset: create its Bots, its shared skill and its knowledge-base skeleton. Does nothing to a team that did not ask for it.',
      parameters: { id: { type: 'string', required: true, description: 'Preset id from list_team_presets, e.g. "ecommerce"' } },
      output,
      async execute(args, exec) {
        await rt.load()
        const self = rt.selfOf(exec.agent?.id)
        if (!rt.isMain(self)) return 'Only the Main Bot can turn on a team preset. Ask the Main Bot.'
        try {
          const result = await applyPreset(String(args.id ?? ''))
          return `Turned on ${result.label}: ${result.bots.join(', ')}, with the ${result.skill} skill and the ${result.knowledge}/ knowledge base.`
        } catch (error) {
          return `Could not turn on the preset: ${error.message}`
        }
      },
    }))
    rt.teamTools.push(defineTool({
      name: 'disable_team_preset',
      description: 'Main Bot only. Turn off an optional Bot-team preset: detach its skill from the Bots it set up. The Bots, their files and the shared skill stay.',
      parameters: { id: { type: 'string', required: true, description: 'Preset id from list_team_presets' } },
      output,
      async execute(args, exec) {
        await rt.load()
        const self = rt.selfOf(exec.agent?.id)
        if (!rt.isMain(self)) return 'Only the Main Bot can turn off a team preset. Ask the Main Bot.'
        try {
          const result = await disablePreset(String(args.id ?? ''))
          return `Turned off ${result.label}. Its Bots and files stay; its skill is detached.`
        } catch (error) {
          return `Could not turn off the preset: ${error.message}`
        }
      },
    }))
  }

  installTools()
  Object.assign(rt, { applyPreset, disablePreset, presetsView })
}
