import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveSettings } from '../index.js'

const tempRoot = mkdtempSync(join(tmpdir(), 'easel-root-'))
const target = join(tempRoot, 'data', 'workspace')
const alias = join(tempRoot, 'Easel')
mkdirSync(join(target, 'skills', 'openclaw'), { recursive: true })
// The desktop layout migration leaves a junction at the old data path; the
// host must resolve it so its project-root prefix checks match dsh's canonical
// `workspaceFiles.stat` absolute paths.
symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir')

test('projectRoot resolves a junction to the real directory', () => {
  const settings = resolveSettings({ projectRoot: alias })
  assert.equal(settings.projectRoot, realpathSync(target))
  assert.equal(settings.skillsDir, join(realpathSync(target), 'skills', 'openclaw'))
})

test('a configured skillsDir is kept verbatim', () => {
  const skills = join(tempRoot, 'custom-skills')
  assert.equal(resolveSettings({ projectRoot: alias, skillsDir: skills }).skillsDir, skills)
})

test('a missing projectRoot keeps its configured spelling', () => {
  const missing = join(tempRoot, 'not-created')
  assert.equal(resolveSettings({ projectRoot: missing }).projectRoot, missing)
})

after(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})
