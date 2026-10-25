/** Formatting helpers shared by the archive service and its settings card. */

/**
 * Fill `{name}` style placeholders in one dictionary entry.
 * @param {string} template - dictionary string.
 * @param {Record<string, string|number>} values - replacement values.
 * @returns {string} the rendered string.
 */
export function fillArchiveText(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

/**
 * Human-readable byte size for progress details.
 * @param {number} bytes - byte count.
 * @returns {string} a compact size string.
 */
export function formatArchiveBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${Math.round(bytes)} B`
}

/**
 * Normalize an absolute path for membership checks. The host returns
 * canonical paths from both the project list and the workspace registry;
 * separators and Windows case are the only differences that matter here.
 * @param {string} path - absolute path.
 * @returns {string} a comparison key.
 */
export function archivePathKey(path) {
  const normalized = String(path).replace(/\\/g, '/').replace(/\/+$/, '')
  // Fold case only for Windows-style paths; POSIX names are case-sensitive.
  return /^[A-Za-z]:\//.test(normalized) || /^\/\/[^/]/.test(normalized)
    ? normalized.toLowerCase()
    : normalized
}

/**
 * Whether a workspace path is a direct child of <projectRoot>/projects. This
 * is the same lexical rule the host enforces before starting an export.
 * @param {string} projectRoot - resolved Easel project root.
 * @param {string} candidate - absolute workspace path.
 * @returns {boolean} true for a direct project child.
 */
export function isProjectDirectory(projectRoot, candidate) {
  if (typeof projectRoot !== 'string' || projectRoot === '') return false
  const path = archivePathKey(candidate)
  const projects = archivePathKey(`${projectRoot}/projects`)
  const slash = path.lastIndexOf('/')
  return slash > 0 && path.slice(0, slash) === projects
}
