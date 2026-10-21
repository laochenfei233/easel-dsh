// Compatibility surface for the ported Easel components.
//
// The component files were copied verbatim and import `PageProps` from here;
// the live feature registry now lives in `src/features/*` (one plugin per
// view). Keeping these re-exports avoids touching every ported file.
export type { PageProps } from './lib/shell'
export { pageKey } from './lib/shell'
export { FEATURES as PAGES } from './features'
