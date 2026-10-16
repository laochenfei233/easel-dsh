// EASEL-DIVERGENCE: Easel-dsh workspace presentation mode. The mode rides on a
// globalThis key because the vite alias and the relative-path importers yield
// duplicate module instances — a module-local variable would fork the state
// across packages. spec docs/compose/specs/easel-single-workspace.md.

/** Sidebar presentation: 'single' keeps one 主项目 workspace, 'full' restores the dsh workspace browser. */
export type WorkspaceUIMode = 'single' | 'full'

const MODE_KEY = '__easelWorkspaceUIMode'

/** Read the current presentation mode. Anything unset or unrecognized is 'single'. */
export function getWorkspaceUIMode(): WorkspaceUIMode {
  const value = (globalThis as Record<string, unknown>)[MODE_KEY]
  return value === 'full' ? 'full' : 'single'
}

/** Publish the presentation mode to every package instance reading the key. */
export function setWorkspaceUIMode(mode: WorkspaceUIMode): void {
  ;(globalThis as Record<string, unknown>)[MODE_KEY] = mode
}
