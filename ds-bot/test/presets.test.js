import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../index.js'
import { fakeContext } from './fake-ctx.js'

// Enough of the dsh services for a team to make Sessions and answer the channel.
function start({ models = [], team } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-presets-'))
  if (team !== undefined) writeFileSync(join(home, 'state.json'), JSON.stringify(team))
  const services = {}
  const ctx = fakeContext({ services })
  const workspaces = new Map()
  const sent = []
  let sessions = 0
  Object.assign(ctx, {
    llm: {
      listProviders: () => (models.length > 0 ? [{ id: 'deepseek', name: 'DeepSeek' }] : []),
      listModels: async () => models.map(id => ({ id })),
      resolveModelInfo: async () => ({}),
    },
    workspaceRegistry: {
      get: id => workspaces.get(id),
      resolveByPath: async path => [...workspaces.values()].find(workspace => workspace.path === path),
      create: async (path) => {
        const workspace = { id: `w${workspaces.size + 1}`, path }
        workspaces.set(workspace.id, workspace)
        return workspace
      },
      archiveSession: async () => {},
    },
    sessionController: {
      create: async () => ({ sessionId: `s${++sessions}` }),
      resolveAgent: async sessionId => ({ agent: { session: { id: sessionId }, followup: message => sent.push({ sessionId, message }) } }),
      selectModel: async () => {},
    },
    sessionTitle: { rename: async () => {} },
    sessions: { flush: async () => {} },
  })
  let route
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = (options) => {
    route = options
    return register(options)
  }
  createRuntime(ctx, { home, workspace: join(home, 'workspace') })
  const call = async (endpoint, payload) => {
    const response = await route.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))
    return response.json()
  }
  const stop = async () => {
    await ctx.dispose()
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
  }
  return { call, stop, home, sent }
}

const skillsOf = view => view.capabilities.filter(item => item.kind === 'skill')

test('turning on the ecommerce preset creates its team, skill and knowledge base', async (t) => {
  const { call, stop, home } = start({ models: ['deepseek-v4-flash'] })
  t.after(stop)
  await call('state', {})

  const result = await call('apply-preset', { id: 'ecommerce' })
  assert.equal(result.ok, true, JSON.stringify(result))
  const view = (await call('state', {})).value

  assert.equal(view.presets.ecommerce.active, true)
  // The first Main Bot becomes the dispatcher; the three specialists exist once each.
  const main = view.bots.find(bot => bot.id === view.mainBotId)
  assert.equal(main.role, 'Dispatcher')
  assert.match(main.instructions, /\[ecommerce-preset\]/)
  for (const name of ['Research', 'Sourcing', 'Store Ops']) {
    assert.equal(view.bots.filter(bot => bot.name === name).length, 1, name)
  }
  // The shared skill is saved and attached to all four Bots.
  const skill = skillsOf(view).find(item => item.name === 'ecommerce-thinking')
  assert.ok(skill, 'ecommerce-thinking skill saved')
  for (const bot of view.bots) assert.ok(bot.capabilities.includes('ecommerce-thinking'), bot.name)
  // The knowledge-base skeleton is in the team workspace.
  for (const dir of ['选品', '定价', '合规', '任务板', '证据', '日志']) {
    assert.ok(existsSync(join(home, 'workspace', '电商知识库', dir)), dir)
  }
})

test('turning the preset on twice does not duplicate its Bots or its marker', async (t) => {
  const { call, stop } = start({ models: ['deepseek-v4-flash'] })
  t.after(stop)
  await call('state', {})
  await call('apply-preset', { id: 'ecommerce' })
  await call('apply-preset', { id: 'ecommerce' })
  const view = (await call('state', {})).value
  assert.equal(view.bots.length, 4)
  for (const name of ['Research', 'Sourcing', 'Store Ops']) {
    assert.equal(view.bots.filter(bot => bot.name === name).length, 1, name)
  }
  const main = view.bots.find(bot => bot.id === view.mainBotId)
  assert.equal((main.instructions.match(/\[ecommerce-preset\]/g) ?? []).length, 1)
})

test('turning the preset off detaches the skill but keeps the Bots, files and skill', async (t) => {
  const { call, stop, home } = start({ models: ['deepseek-v4-flash'] })
  t.after(stop)
  await call('state', {})
  await call('apply-preset', { id: 'ecommerce' })
  const off = await call('disable-preset', { id: 'ecommerce' })
  assert.equal(off.ok, true, JSON.stringify(off))
  const view = (await call('state', {})).value
  assert.equal(view.presets.ecommerce.active, false)
  assert.equal(view.bots.length, 4)
  for (const bot of view.bots) assert.ok(!bot.capabilities.includes('ecommerce-thinking'), bot.name)
  assert.ok(skillsOf(view).some(item => item.name === 'ecommerce-thinking'), 'shared skill stays saved')
  assert.ok(existsSync(join(home, 'workspace', '电商知识库', '选品')))
})

test('an unknown preset is refused', async (t) => {
  const { call, stop } = start({ models: ['deepseek-v4-flash'] })
  t.after(stop)
  await call('state', {})
  const result = await call('apply-preset', { id: 'nope' })
  assert.equal(result.ok, false)
  assert.match(result.error.message, /No preset named nope/)
})
