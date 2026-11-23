// Persona color resolution (spec easel-persona-color §S2.2): explicit color
// wins, otherwise a name hash picks from a fixed palette so the same persona
// always renders the same color. Plain JS (context-menu-model.js precedent)
// so node --test can import it.

/** 10 色板：中饱和度、互相可区分；与日历状态色（灰/紫/琥珀/薄荷/天蓝）无精确同值，
 * 但紫/绿/蓝/黄与状态色同色相族——深浅饱和不同，仍可区分。 */
export const PERSONA_PALETTE = [
  '#c2643a', '#8a63c9', '#2f9e8f', '#c9a227', '#d16ba5',
  '#5a8fd9', '#b0763f', '#6aa84f', '#a0522d', '#4fb3bf',
]

/**
 * 解析画像显示色。显式色（_profile_config.json 的 colors[name]）优先；
 * 否则按画像名哈希从色板取——同名恒同色，无颜色也总能落到一个色。
 * @param {string} name 画像目录名。
 * @param {Record<string, string>} [colors] 服务端下发的显式色表。
 * @returns {string} #RRGGBB。
 */
export function personaColor(name, colors = {}) {
  const explicit = colors[name]
  if (typeof explicit === 'string' && /^#[0-9a-fA-F]{6}$/.test(explicit)) return explicit
  let hash = 0
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return PERSONA_PALETTE[hash % PERSONA_PALETTE.length]
}
