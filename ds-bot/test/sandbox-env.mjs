// Tests that run from inside DS Bot (or another host) inherit the host's DS_BOT_* variables,
// such as DS_BOT_WORKSPACE and DS_BOT_USER_DSH_HOME. Left in place they point the plugin at
// the real app's workspace and DSH home, so the same tests pass or fail depending on the
// machine they run on. Clear the DS_BOT_* family once, before any test file loads; a test that
// needs one still sets it itself and restores it afterwards.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('DS_BOT_')) delete process.env[key]
}
