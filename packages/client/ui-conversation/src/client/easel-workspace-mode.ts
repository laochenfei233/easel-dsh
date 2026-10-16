// EASEL-DIVERGENCE: local mirror of ui-workspace's easel-mode. This package
// reads the same globalThis key instead of importing across the package source
// boundary (rootDir typecheck), so the workspace chip gate follows the mode
// the host (or the Easel plugin) published. spec docs/compose/specs/easel-single-workspace.md.

/** Read the workspace presentation mode; unset or unrecognized reads as 'single'. */
export function getWorkspaceUIMode(): 'single' | 'full' {
  const value = (globalThis as Record<string, unknown>)['__easelWorkspaceUIMode']
  return value === 'full' ? 'full' : 'single'
}
