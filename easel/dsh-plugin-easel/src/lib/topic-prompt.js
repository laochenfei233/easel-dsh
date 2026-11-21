// Easel's topic prompt and the persona preselect, as plain JS
// (context-menu-model.js precedent) so node --test can import them.

/**
 * Easel's topic prompt, verbatim from the App component this port replaces.
 * `persona`（easel-topic-persona-switch S2.2）：非空时在末尾追加画像行，让
 * agent 以该人设动笔；空则保持原三段（无画像 / 做内容未选画像）。
 * `bodyPath`（easel-hotspot-radar D6）：选题卡带正文时，prompt 指向内容库
 * 里的正文文件（调用方解析好的绝对路径；解析失败时不传，保持无感）。
 * @param {string} title 选题标题
 * @param {string} [projectDir] 已立项选题的项目目录；缺省 = 未立项措辞
 * @param {boolean} [inProject] 会话 cwd 已是项目目录（create({workspaceId})），路径用目录内语义
 * @param {string} [bodyPath] 内容库正文路径（outputs 相对）
 * @param {string} [persona] 本次创作使用的画像目录名；空 = 不注入
 * @returns {string} 发给会话的完整提示词
 */
export function topicPrompt(title, projectDir, inProject = false, bodyPath, persona = '') {
  const base = `围绕当前热点「${title}」：先判断它适不适合我的账号赛道；若合适，给 2-3 个差异化的二创角度，并把你最推荐的那条写成可直接发布的文案初稿。`
  const body = bodyPath
    ? `\n\n这条热点的正文已抓取到内容库：${bodyPath}。先读它再动笔，不要凭标题臆测内容。`
    : ''
  // 画像行放最后：已立项时项目资料里的画像快照是立项时的带入，本次点名的画像覆盖它。
  const personaLine = persona
    ? `\n\n本次创作结合我的画像「${persona}」（画像资料在 profiles/${persona}/，动笔前先读取）。`
    : ''
  // EASEL-DIVERGENCE(easel-project-materials/easel-deconstruct-title-attach): 已立项
  // 选题注入项目目录落点。inProject = 会话 cwd 已是项目目录（create({workspaceId})），
  // 路径用目录内语义；否则 cwd=项目根，带前缀。
  if (!projectDir) return `${base}${body}${personaLine}`
  const project = inProject
    ? `\n\n本项目已立项：先读 项目资料.md（就在当前目录，选题卡、拆解素材、画像快照都在里面，按需参考），本次创作的脚本/文案/成片等产物一律写入当前目录（项目工作区）。`
    : `\n\n本项目已立项：先读 ${projectDir}/项目资料.md（选题卡、拆解素材、画像快照都在里面，按需参考），本次创作的脚本/文案/成片等产物一律写入 ${projectDir}/ 目录。`
  return `${base}${body}${project}${personaLine}`
}

/**
 * 立项弹窗的画像预选（自 IdeasPage 迁入，spec easel-breakdown-persona-push §S2.1）：
 * 拆解选题带 persona 且画像仍存在则预选；否则唯一画像自动选；再否则不选。
 * @param {Array<{ name: string }>} personas 现存画像列表
 * @param {string} [ideaPersona] 选题卡记录的画像
 * @returns {string} 预选画像名；'' = 不预选
 */
export function pickGreenlightPersona(personas, ideaPersona) {
  if (ideaPersona && personas.some((p) => p.name === ideaPersona)) return ideaPersona
  return personas.length === 1 ? personas[0].name : ''
}
