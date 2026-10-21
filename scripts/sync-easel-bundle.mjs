// Sync the Easel staging content into dsh/easel/ so CI bundles are
// self-contained (nothing at build time reads the Easel checkout).
// Run from the Easel dev layout after changing skills / the plugin /
// profiles template; bump dsh-plugin-easel's package version per the
// VERSION-stamp resync discipline.
// Usage: node scripts/sync-easel-bundle.mjs [easel-repo-root]  (default: EASEL_REPO env, else the checkout's parent)
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DSH_ROOT = resolve(here, '..')
const arg = process.argv[2]
const easel = resolve(arg ?? process.env.EASEL_REPO ?? join(DSH_ROOT, '..'))
// The default resolves the Easel layout (dsh worktree nested in the Easel
// repo); with a standalone dsh checkout, pass the path or set EASEL_REPO.
if (!existsSync(join(easel, 'dsh-plugin-easel', 'package.json'))) {
  console.error(`no easel repo at ${easel} (pass the path or set EASEL_REPO)`)
  process.exit(2)
}
const destination = join(DSH_ROOT, 'easel')
const noJunk = (src) => {
  const base = src.split(/[\\/]/).pop() ?? ''
  return !/(^|[\\/])(node_modules|__pycache__|\.git)([\\/]|$)/.test(src)
    && !src.endsWith('.pyc') && !src.endsWith('.log')
    && !(base.startsWith('.env') && !base.endsWith('.example'))
}

for (const name of ['skills', 'profiles/_template', 'dsh-plugin-easel', 'README.md', 'LICENSE']) {
  if (!existsSync(join(easel, name))) {
    console.error(`missing ${join(easel, name)}`)
    process.exit(2)
  }
}

rmSync(destination, { recursive: true, force: true })
// Same whitelist stageEasel deploys; the tree mirrors the Easel layout so the
// plugin's own resolution (dsh root walk, plugin-local styles) keeps working.
cpSync(join(easel, 'skills'), join(destination, 'skills'), { recursive: true, filter: noJunk })
cpSync(join(easel, 'profiles', '_template'), join(destination, 'profiles', '_template'), { recursive: true })
cpSync(join(easel, 'dsh-plugin-easel'), join(destination, 'dsh-plugin-easel'), { recursive: true, filter: noJunk })
cpSync(join(easel, 'README.md'), join(destination, 'README.md'))
cpSync(join(easel, 'LICENSE'), join(destination, 'LICENSE'))

const version = JSON.parse(readFileSync(join(destination, 'dsh-plugin-easel', 'package.json'), 'utf8')).version
console.log(`synced easel ${version} into dsh/easel`)
