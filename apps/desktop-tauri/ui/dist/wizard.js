// First-run wizard: pick the default agent preset, then apply it through the
// shell command (set_preset) and land on the main UI.

const PRESETS = [
  { id: 'standard', name: '标准', desc: '通用编码智能体：文件、终端、网络与子代理能力均衡（默认）' },
  { id: 'code', name: '代码', desc: '面向软件开发：更强的代码编辑与工程能力' },
  { id: 'minimal', name: '极简', desc: '最小工具集，会话干净、权限面小' },
  { id: 'cordis', name: 'Cordis', desc: '面向编写/调试 Cordis 组合的专用预设' },
];

const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);

let selectedPreset = 'standard';

function renderPresets() {
  const list = document.getElementById('preset-list');
  list.innerHTML = '';
  for (const p of PRESETS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'preset-card' + (p.id === selectedPreset ? ' selected' : '');
    el.innerHTML = `<strong>${p.name}</strong><span>${p.desc}</span>`;
    el.addEventListener('click', () => {
      selectedPreset = p.id;
      renderPresets();
    });
    list.appendChild(el);
  }
}

const progress = document.getElementById('progress');
const fill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

function showProgress(text, frac) {
  progress.classList.remove('hidden');
  fill.style.width = `${Math.round((frac ?? 0) * 100)}%`;
  progressText.textContent = text;
}

document.getElementById('btn-finish').addEventListener('click', async () => {
  const btn = document.getElementById('btn-finish');
  btn.disabled = true;
  try {
    showProgress('写入预设配置…', 0.5);
    await invoke('set_preset', { preset: selectedPreset });
    showProgress('完成', 1);
    // The preset patch applies when the dsh service restarts; the shell
    // reconnects and lands on the main UI.
    await invoke('restart_dsh').catch(() => {});
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 400);
  } catch (err) {
    progressText.textContent = `设置失败：${String(err)}`;
    btn.disabled = false;
  }
});

renderPresets();
