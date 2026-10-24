window.__ModuleLoader__.load({
  id: 'dsh-plugin-easel',
  factory(require) {
    const module = { exports: {} };
    const exports = module.exports;

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  default: () => client_default
});
module.exports = __toCommonJS(client_exports);

// src/generated/easel-css.js
var EASEL_CSS = `.easel-scope { color-scheme: light; }body[data-ds-dark-theme] .easel-scope {
  color-scheme: dark;
  --bg: #14171e;
  --bg-elev: #1b2029;
  --surface: #1e242e;
  --surface-2: #252c37;
  --surface-hover: #2d3643;
  --border: #333d4b;
  --border-strong: #4a586a;
  --text: #edf0f5;
  --text-secondary: #b1bbc9;
  --text-tertiary: #95a1b3;
  --accent-start: #63c9cf;
  --accent-end: #a1b4fa;
  --accent-soft: rgba(115, 151, 222, 0.17);
  --accent-gradient: linear-gradient(135deg, #167d89, #485eb4);
  --accent-gradient-soft: linear-gradient(135deg, #25364b, #37303a);
  --green: #6bd499;
  --green-soft: rgba(70, 190, 128, 0.15);
  --amber: #f1bd69;
  --amber-soft: rgba(228, 163, 65, 0.15);
  --red: #f58f98;
  --red-soft: rgba(233, 102, 115, 0.15);
  --trend-up: #83caa3;
  --trend-down: #df969c;
  --code-bg: #171c24;
  --layer-discover: #64c6f2;
  --layer-plan: #b69afa;
  --layer-produce: #f38dbd;
  --layer-publish: #64d3b0;
  --layer-attribute: #f1bd69;
  --layer-general: #a2b3c9;
  --bg-elevated: var(--bg-elev);
  --bg-subtle: var(--surface-2);
  --text-strong: var(--text);
  --danger: var(--red);
  --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.16);
  --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.24);
  --shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.36);
  --glow: 0 0 0 1px rgba(99, 201, 207, 0.25), 0 10px 30px rgba(0, 0, 0, 0.2);
}.easel-scope .theme-toggle {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 34px; height: 34px; margin-left: auto; padding: 7px;
  border: none; border-radius: var(--radius); background: transparent;
  color: var(--text-secondary); cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}.easel-scope .theme-toggle:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .theme-toggle:focus-visible { outline: 2px solid var(--accent-start); outline-offset: 2px; }/* Legacy light surfaces that do not yet use the shared palette. */body[data-ds-dark-theme] .easel-scope .sidebar { background: linear-gradient(180deg, #191e27, #1c222c); }body[data-ds-dark-theme] .easel-scope :is(.main-content, .page-host, .chat-page) {
  background:
    radial-gradient(circle at 23% 8%, rgba(55, 87, 133, 0.17), transparent 36%),
    radial-gradient(circle at 78% 12%, rgba(117, 76, 67, 0.12), transparent 38%),
    var(--bg);
}body[data-ds-dark-theme] .easel-scope .composer { background: var(--bg-elev); border-color: var(--border); }body[data-ds-dark-theme] .easel-scope .composer:focus-within { border-color: var(--accent-start); }body[data-ds-dark-theme] .easel-scope .suggestion-card { background: var(--surface); }body[data-ds-dark-theme] .easel-scope :is(.btn-primary, .send-btn, .brush-tab.on) { color: var(--bg); }body[data-ds-dark-theme] .easel-scope :is(.brush-chip-pipe, .brush-item-pipe) { background: var(--accent-gradient-soft); border-color: var(--border-strong); }body[data-ds-dark-theme] .easel-scope .message-bubble.user { color: var(--text); border-color: var(--border); }body[data-ds-dark-theme] .easel-scope .thinking-block { background: var(--accent-soft); }body[data-ds-dark-theme] .easel-scope .question-card__option--selected { background: var(--accent-soft); }body[data-ds-dark-theme] .easel-scope .question-card__multi { background: var(--accent-soft); border-color: var(--border-strong); }body[data-ds-dark-theme] .easel-scope .question-card__custom input { background: var(--bg-elev); color: var(--text); }body[data-ds-dark-theme] .easel-scope :is(.question-card__chip, .question-card__custom button, .question-card__submit, .media-check) { color: var(--bg); }body[data-ds-dark-theme] .easel-scope .question-card__error { color: var(--red); }body[data-ds-dark-theme] .easel-scope .ana-plats .chip { background: var(--surface); border-color: var(--border); color: var(--text-secondary); }body[data-ds-dark-theme] .easel-scope .ana-plats .chip:hover { background: var(--surface-hover); border-color: var(--border-strong); }body[data-ds-dark-theme] .easel-scope .ana-plats .chip.active { background: var(--accent-soft); border-color: var(--border-strong); color: var(--accent-end); }body[data-ds-dark-theme] .easel-scope :is(.overlay, .drawer-overlay, .settings-overlay) { background: rgba(0, 0, 0, 0.6); }body[data-ds-dark-theme] .easel-scope .settings-overlay :is(.pill.ok, .save-note) { color: var(--green); }body[data-ds-dark-theme] .easel-scope .settings-overlay :is(.pill.warn, .card[data-state='busy'] .tile) { color: var(--amber); }body[data-ds-dark-theme] .easel-scope .settings-overlay :is(.pill.fail, .env-error, .save-note.err, .card[data-state='fail'] .tile) { color: var(--red); }body[data-ds-dark-theme] .easel-scope .settings-overlay .tag.main { color: var(--accent-end); }body[data-ds-dark-theme] .easel-scope .settings-overlay :is(.prog .bar, .env-meter) { background: var(--surface-hover); }body[data-ds-dark-theme] .easel-scope .settings-overlay .btn-fill { color: var(--bg); }body[data-ds-dark-theme] .easel-scope .settings-overlay .btn-fill:hover:not(:disabled) { background: #b7c6ff; border-color: #b7c6ff; }body[data-ds-dark-theme] .easel-scope .settings-overlay .btn-primary { color: #fff; }@media (prefers-reduced-motion: reduce) {.easel-scope .theme-toggle { transition: none; }}
.easel-scope {
  /* ---- Palette (reuse the main landing page's paper, mist, blue and peach) ---- */
  --bg: #ffffff;
  --bg-elev: #ffffff;
  --surface: #ffffff;
  --surface-2: #fafafb;
  --surface-hover: #f2f2f3;
  --border: #e7e7e8;
  --border-strong: #d6d7d9;
  --text: #17191c;
  --text-secondary: #777b86;
  --text-tertiary: #979799;
  --accent-start: #158f9a;
  --accent-end: #3f56a8;
  --accent-soft: rgba(220, 234, 251, 0.72);
  --accent-gradient: linear-gradient(135deg, var(--accent-start), var(--accent-end));
  --accent-gradient-soft: linear-gradient(135deg, #eaf3fd, #fbede4);
  --green: #16a34a;
  --trend-up: #70a98a;
  --trend-down: #c98585;
  --green-soft: rgba(22, 163, 74, 0.12);
  --amber: #d97706;
  --amber-soft: rgba(217, 119, 6, 0.14);
  --red: #dc2626;
  --red-soft: rgba(220, 38, 38, 0.10);
  --code-bg: #f4f4f5;

  /* ---- Layer accent colors (SKILL \u5206\u533A\uFF0C\u6D45\u5E95\u52A0\u6DF1\u4FDD\u8BC1\u53EF\u8BFB) ---- */
  --layer-discover: #0ea5e9;
  --layer-plan: #7c3aed;
  --layer-produce: #db2777;
  --layer-publish: #059669;
  --layer-attribute: #d97706;
  --layer-general: #64748b;

  /* ---- Shape & motion ---- */
  --sidebar-width: 264px;
  --radius-sm: 6px;
  --radius: 9px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --shadow-sm: 0 1px 3px rgba(23, 25, 28, 0.05);
  --shadow-md: 0 10px 30px rgba(23, 25, 28, 0.08);
  --shadow-lg: 0 20px 50px rgba(23, 25, 28, 0.14);
  --glow: 0 0 0 1px rgba(63,86,168,0.18), 0 10px 30px rgba(51,66,148,0.1);
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --t-fast: 0.14s var(--ease);
  --t: 0.22s var(--ease);
}.easel-scope, .easel-scope *, .easel-scope *::before, .easel-scope *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}.easel-scope {
  height: 100%;
  width: 100%;
  overflow: hidden;
}.easel-scope {
  font-family: 'Manrope', 'Avenir Next', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  background: var(--bg);
}.easel-scope::-webkit-scrollbar { width: 8px; height: 8px; }.easel-scope::-webkit-scrollbar-track { background: transparent; }.easel-scope::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }.easel-scope::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }@keyframes spin { to { transform: rotate(360deg); } }@keyframes blink { 50% { opacity: 0; } }@keyframes slideInRight { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }@keyframes popIn { from { transform: scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }/* ============ Layout ============ */.easel-scope .app-layout { display: flex; height: 100%; width: 100%; }.easel-scope .sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100%;
  background: linear-gradient(180deg, #f1f1f3, #f7f7f8 72%, #fafafb);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}.easel-scope .sidebar-header { padding: 18px 16px 14px; border-bottom: 1px solid var(--border); }.easel-scope .sidebar-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }.easel-scope .sidebar-logo h1 {
  color: var(--text);
  font-family: 'Bodoni Moda', 'Didot', 'Baskerville', serif;
  font-size: 24px;
  font-style: italic;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -1px;
}.easel-scope .sidebar-logo-icon {
  width: 30px; height: 30px;
  border-radius: 9px;
  display: block;
  object-fit: cover;
  box-shadow: 0 5px 14px rgba(51, 66, 148, 0.1);
}.easel-scope .persona-select {
  width: 100%;
  padding: 9px 12px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  outline: none;
  appearance: none;
  transition: border-color var(--t-fast);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0aa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}.easel-scope .persona-select:focus { border-color: var(--accent-start); }.easel-scope .sidebar-nav { padding: 10px 8px; display: flex; flex-direction: column; gap: 2px; }.easel-scope .nav-item {
  display: flex; align-items: center; gap: 11px;
  padding: 9px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all var(--t-fast);
  border: none; background: none; width: 100%; text-align: left;
  position: relative;
}.easel-scope .nav-item:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .nav-item.active { background: var(--accent-soft); color: var(--text); }.easel-scope .nav-item.active::before {
  content: ''; position: absolute; left: 0;
  width: 3px; height: 18px;
  background: var(--accent-gradient);
  border-radius: 0 3px 3px 0;
}.easel-scope .nav-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; color: currentColor; opacity: 0.9; }.easel-scope .sidebar-section { padding: 4px 8px; flex: 1; overflow-y: auto; }.easel-scope .sidebar-section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px 6px;
}.easel-scope .sidebar-section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--text-tertiary); font-weight: 700;
}.easel-scope .new-chat-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: 1px solid var(--border);
  color: var(--text-secondary); cursor: pointer;
  padding: 4px 10px; border-radius: 7px; font-size: 12px;
  transition: all var(--t-fast);
}.easel-scope .new-chat-btn:hover { border-color: var(--accent-start); color: var(--text); background: var(--accent-soft); }.easel-scope .session-item {
  display: flex; align-items: center;
  padding: 8px 10px 8px 12px; border-radius: var(--radius);
  cursor: pointer; font-size: 13px; color: var(--text-secondary);
  transition: all var(--t-fast);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}.easel-scope .session-item:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .session-item.active { background: var(--accent-soft); color: var(--text); }.easel-scope .session-item-icon { margin-right: 9px; font-size: 13px; flex-shrink: 0; opacity: 0.8; }.easel-scope .session-item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }.easel-scope .session-delete-btn {
  display: none; background: none; border: none;
  color: var(--text-secondary); font-size: 15px; cursor: pointer;
  padding: 0 2px; line-height: 1; flex-shrink: 0; border-radius: 4px;
}.easel-scope .session-delete-btn:hover { color: var(--red); background: var(--red-soft); }.easel-scope .session-item:hover .session-delete-btn { display: block; }.easel-scope .sidebar-status {
  padding: 12px 16px; border-top: 1px solid var(--border);
  font-size: 12px; color: var(--text-secondary);
  display: flex; align-items: center; gap: 8px;
}.easel-scope .status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--green); flex-shrink: 0;
  box-shadow: 0 0 8px var(--green);
}.easel-scope .status-dot.offline { background: var(--red); box-shadow: 0 0 8px var(--red); }.easel-scope .main-content { flex: 1; height: 100%; overflow: hidden; display: flex; flex-direction: column; }/* Keep every workbench page on the landing page's warm paper backdrop. */.easel-scope .main-content, .easel-scope .page-host {
  background:
    radial-gradient(circle at 23% 8%, rgba(220,234,251,0.56), transparent 32%),
    radial-gradient(circle at 78% 12%, rgba(251,225,209,0.5), transparent 34%),
    radial-gradient(circle at 52% 92%, rgba(244,238,224,0.38), transparent 38%),
    #fff;
}/* ============ Reusable components ============ */.easel-scope .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--surface-2);
  color: var(--text); font-size: 14px; font-family: inherit; font-weight: 500;
  cursor: pointer; transition: all var(--t-fast); white-space: nowrap;
}.easel-scope .btn:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-hover); }.easel-scope .btn:disabled { opacity: 0.45; cursor: not-allowed; }.easel-scope .btn-primary {
  border: none; background: var(--text); color: #fff;
  box-shadow: 0 4px 14px rgba(23,25,28,0.16);
}.easel-scope .btn-primary:hover:not(:disabled) { filter: brightness(1.15); box-shadow: 0 6px 20px rgba(23,25,28,0.2); }.easel-scope .btn-ghost { background: transparent; }.easel-scope .btn-sm { padding: 6px 11px; font-size: 13px; }.easel-scope .btn-block { width: 100%; }.easel-scope .btn-danger { border-color: var(--red-soft); color: var(--red); }.easel-scope .btn-danger:hover:not(:disabled) { background: var(--red-soft); border-color: var(--red); }.easel-scope .badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 999px;
  background: var(--surface-hover); color: var(--text-secondary);
  border: 1px solid var(--border);
}.easel-scope .badge-accent { background: var(--accent-soft); color: var(--accent-end); border-color: transparent; }.easel-scope .badge-warn { background: var(--amber-soft); color: var(--amber); border-color: transparent; }.easel-scope .badge-ok { background: var(--green-soft); color: var(--green); border-color: transparent; }.easel-scope .chip {
  padding: 6px 13px; border-radius: 999px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--border); background: var(--bg-elev); color: var(--text);
  transition: all var(--t-fast);
}.easel-scope .chip:hover { border-color: var(--border-strong); }.easel-scope .chip.active { background: var(--accent-gradient); color: #fff; border-color: transparent; }.easel-scope .field {
  width: 100%; padding: 10px 13px;
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text);
  font-size: 14px; font-family: inherit; line-height: 1.5;
  outline: none; transition: border-color var(--t-fast), box-shadow var(--t-fast);
}.easel-scope .field:focus { border-color: var(--accent-start); box-shadow: 0 0 0 3px var(--accent-soft); }.easel-scope .field::placeholder { color: var(--text-tertiary); }.easel-scope textarea.field { resize: vertical; min-height: 90px; }.easel-scope .card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
  transition: transform var(--t), border-color var(--t), box-shadow var(--t);
}.easel-scope .card-hover { cursor: pointer; }.easel-scope .card-hover:hover { transform: translateY(-3px); border-color: var(--border-strong); box-shadow: var(--shadow-md); }.easel-scope .section-title {
  display: flex; align-items: center; gap: 9px;
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-secondary);
  margin: 26px 0 12px;
}.easel-scope .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }.easel-scope .section-title .dot { width: 8px; height: 8px; border-radius: 3px; }.easel-scope .page-title { display: flex; align-items: center; gap: 9px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }.easel-scope .page-title svg { color: var(--accent-start); }.easel-scope .page-subtitle { color: var(--text-secondary); font-size: 13.5px; margin-top: 6px; line-height: 1.6; }.easel-scope .empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 14px; color: var(--text-secondary); text-align: center; padding: 40px;
}.easel-scope .empty-state .empty-icon { font-size: 46px; opacity: 0.35; }.easel-scope .empty-state h3 { color: var(--text); font-size: 18px; font-weight: 600; }.easel-scope .empty-state p { font-size: 14px; max-width: 360px; line-height: 1.6; }/* Modal / drawer */.easel-scope .overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(24,24,48,0.42); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  animation: fadeIn 0.18s var(--ease);
}.easel-scope .modal {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
  padding: 28px; animation: popIn 0.2s var(--ease);
}.easel-scope .drawer-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(24,24,48,0.40); backdrop-filter: blur(3px);
  display: flex; justify-content: flex-end;
  animation: fadeIn 0.18s var(--ease);
}.easel-scope .drawer {
  width: 560px; max-width: 92vw; height: 100%;
  background: var(--surface); border-left: 1px solid var(--border);
  box-shadow: var(--shadow-lg); overflow-y: auto;
  animation: slideInRight 0.24s var(--ease);
}.easel-scope .drawer-header {
  position: sticky; top: 0; z-index: 2;
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 20px 24px;
}.easel-scope .drawer-body { padding: 22px 24px 40px; }.easel-scope .icon-btn {
  background: none; border: none; color: var(--text-secondary);
  font-size: 22px; cursor: pointer; line-height: 1; padding: 2px 6px; border-radius: 6px;
  transition: all var(--t-fast);
}.easel-scope .icon-btn:hover { color: var(--text); background: var(--surface-hover); }.easel-scope .toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 2000; padding: 11px 20px; border-radius: var(--radius);
  background: var(--surface); border: 1px solid var(--border);
  box-shadow: var(--shadow-md); font-size: 14px; color: var(--text);
  animation: popIn 0.2s var(--ease);
}.easel-scope .toast.ok { border-color: var(--green-soft); }.easel-scope .toast .toast-icon { color: var(--green); margin-right: 7px; }/* ============ Chat page ============ */.easel-scope .chat-page {
  display: flex; flex-direction: column; height: 100%;
  background:
    radial-gradient(circle at 23% 28%, rgba(220,234,251,0.62), transparent 31%),
    radial-gradient(circle at 76% 30%, rgba(251,225,209,0.58), transparent 33%),
    radial-gradient(circle at 52% 84%, rgba(244,238,224,0.42), transparent 35%),
    #fff;
}.easel-scope .chat-messages { flex: 1; overflow-y: auto; padding: 28px 24px 8px; }.easel-scope .chat-thread { max-width: 860px; margin: 0 auto; }/* \u7A7A\u6001\u6B22\u8FCE\u9875\uFF08\u5C45\u4E2D\uFF0C\u53C2\u8003 Stepfun/ChatGPT\uFF09 */.easel-scope .chat-hero {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 100%; max-width: 720px; margin: 0 auto; padding: 24px 20px 60px; gap: 18px;
  animation: fadeIn 0.3s var(--ease);
}.easel-scope .chat-hero-brand {
  display: flex; align-items: center; gap: 10px;
  color: var(--text);
  font-family: 'Bodoni Moda', 'Didot', 'Baskerville', serif;
  font-size: 27px; font-style: italic; font-weight: 600;
  line-height: 1; letter-spacing: -1.2px;
}.easel-scope .chat-hero-brand img {
  width: 38px; height: 38px; display: block; object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(51,66,148,.12));
}.easel-scope .chat-hero-title {
  color: var(--text); font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 34px; font-weight: 400; letter-spacing: -1.2px; text-align: center;
}.easel-scope .chat-hero-sub { color: var(--text-secondary); font-size: 14.5px; text-align: center; margin-top: -6px; }/* Composer \u8F93\u5165\u6846\uFF08\u7A7A\u6001\u653E\u5927\u5C45\u4E2D\uFF0C\u5BF9\u8BDD\u6001\u7F6E\u5E95\uFF09 */.easel-scope .composer {
  width: 100%;
  background: rgba(255,255,255,.88); border: 1px solid rgba(23,25,28,.09);
  border-radius: var(--radius-xl); padding: 12px 14px 8px;
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow-sm); transition: border-color var(--t-fast), box-shadow var(--t-fast);
}.easel-scope .composer:focus-within { border-color: var(--accent-start); box-shadow: var(--glow); }.easel-scope .composer-hero { margin-top: 8px; box-shadow: var(--shadow-md); }.easel-scope .composer-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }.easel-scope .composer-hint { font-size: 11.5px; color: var(--text-tertiary); }.easel-scope .composer-top { display: flex; gap: 6px; align-items: flex-start; }.easel-scope .composer-top .chat-input { flex: 1; width: auto; min-width: 0; }.easel-scope .brush-entry { position: relative; flex: none; }.easel-scope .brush-btn { position: relative; width: 46px; height: 46px; border: none; background: none; cursor: pointer;
  padding: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; transition: transform .2s cubic-bezier(.4,0,.2,1); }.easel-scope .brush-btn:active { transform: translateY(1px); }.easel-scope .brush-btn svg { width: 39px; height: 39px; display: block; overflow: visible;
  transition: transform .22s cubic-bezier(.4,0,.2,1), filter .22s cubic-bezier(.4,0,.2,1);
  filter: drop-shadow(0 3px 5px rgba(31,52,110,.3)); animation: brush-float 5.6s ease-in-out infinite; }@keyframes brush-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }.easel-scope .brush-btn:hover svg { animation: none; transform: rotate(-7deg) translateY(-1px); filter: drop-shadow(0 5px 9px rgba(31,52,110,.36)); }.easel-scope .brush-mark { position: absolute; left: 8px; bottom: 3px; width: 24px; height: 3px; border-radius: 2px 8px 3px 9px;
  background: linear-gradient(90deg, var(--accent-start), var(--accent-end)); opacity: 0; transform: scaleX(.35);
  transform-origin: 8% 50%; transition: all .28s cubic-bezier(.4,0,.2,1); pointer-events: none; }.easel-scope .brush-btn:hover .brush-mark, .easel-scope .brush-entry.open .brush-mark { opacity: .82; transform: scaleX(1.15); }.easel-scope .brush-entry.open .brush-btn svg { animation: none; transform: rotate(-2deg); }.easel-scope .brush-tip { position: absolute; left: 50%; top: calc(100% + 6px); transform: translateX(-50%); white-space: nowrap;
  background: #17191c; color: #fff; font-size: 11px; padding: 4px 9px; border-radius: 6px; opacity: 0; pointer-events: none;
  transition: opacity .15s; z-index: 9; }.easel-scope .brush-btn:hover .brush-tip { opacity: .92; }.easel-scope .brush-btn:focus-visible { outline: none; }.easel-scope .brush-btn:focus-visible svg { filter: drop-shadow(0 0 0 3px rgba(21,143,154,.4)) drop-shadow(0 3px 5px rgba(31,52,110,.3)); }@media (prefers-reduced-motion: reduce) {.easel-scope .brush-btn svg { animation: none; }}.easel-scope .brush-panel { position: absolute; left: 0; bottom: calc(100% + 12px); z-index: 60;
  width: 540px; max-width: min(86vw, 540px); max-height: min(420px, 40vh);
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden;
  animation: brush-pop .18s cubic-bezier(.4,0,.2,1); }@keyframes brush-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }.easel-scope .brush-panel-head { display: flex; align-items: center; gap: 10px; padding: 13px 15px 10px; border-bottom: 1px solid var(--border); }.easel-scope .brush-panel-headline { flex: 1; min-width: 0; }.easel-scope .brush-panel-title { font-size: 14px; font-weight: 650; }.easel-scope .brush-panel-sub { font-size: 11.5px; color: var(--text-tertiary); margin-top: 1px; }.easel-scope .brush-search { width: 150px; flex: none; padding: 7px 11px; border: 1px solid var(--border); border-radius: var(--radius);
  font-size: 12.5px; font-family: inherit; outline: none; background: var(--bg); color: var(--text); }.easel-scope .brush-search:focus { border-color: var(--accent-start); box-shadow: var(--glow); }.easel-scope .brush-close { background: none; border: none; font-size: 17px; color: var(--text-tertiary); cursor: pointer; line-height: 1; padding: 4px 6px; border-radius: 6px; }.easel-scope .brush-close:hover { background: var(--surface-hover, #f2f2f3); color: var(--text); }.easel-scope .brush-tabs { display: flex; gap: 6px; padding: 10px 15px 0; }.easel-scope .brush-tab { padding: 5px 13px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg);
  font-size: 12.5px; color: var(--text-secondary); cursor: pointer; font-family: inherit; }.easel-scope .brush-tab.on { background: var(--text); color: #fff; border-color: var(--text); }.easel-scope .brush-body { overflow-y: auto; padding: 6px 10px 12px; }.easel-scope .brush-grp { margin: 8px 6px 2px; }.easel-scope .brush-grp-name { font-size: 12px; color: var(--text-secondary); font-weight: 650; letter-spacing: .4px; margin: 8px 6px 4px; }.easel-scope .brush-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 8px; border: none; background: none; border-radius: var(--radius); cursor: pointer;
  font-family: inherit; transition: background .1s; }.easel-scope .brush-item:hover { background: var(--surface-2); }.easel-scope .brush-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }.easel-scope .brush-dot.s-done { background: #7be0a2; }.easel-scope .brush-dot.s-ready { background: #c3c8d4; }.easel-scope .brush-dot.s-need { background: #ffc773; }.easel-scope .brush-dot.s-incoming { background: #8f7ae0; }.easel-scope .brush-il { font-size: 13.5px; font-weight: 600; flex: none; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }.easel-scope .brush-idesc { font-size: 11.5px; color: var(--text-tertiary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .brush-iadd { font-size: 15px; color: #b9bec9; flex: none; width: 22px; text-align: center; }.easel-scope .brush-item:hover .brush-iadd { color: var(--accent-end); }.easel-scope .brush-chip-pipe { font-size: 10px; font-weight: 650; padding: 2px 7px; border-radius: 999px; flex: none;
  background: linear-gradient(135deg, #eaf3fd, #fbede4); color: var(--accent-end); border: 1px solid rgba(63,86,168,.25); }.easel-scope .brush-item-pipe { background: linear-gradient(135deg, rgba(234,243,253,.65), rgba(251,237,228,.65)); border: 1px solid rgba(63,86,168,.18); }.easel-scope .chat-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; color: var(--text-secondary); gap: 14px;
}.easel-scope .chat-empty-icon { font-size: 52px; opacity: 0.3; }.easel-scope .chat-empty h2 { font-size: 21px; font-weight: 700; color: var(--text); }.easel-scope .chat-empty p { font-size: 14px; }/* \u63A8\u8350\u5361\u7247 */.easel-scope .suggestions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; margin-top: 6px;
}.easel-scope .suggestion-card {
  display: flex; align-items: flex-start; gap: 11px; text-align: left;
  padding: 14px 16px; background: rgba(255,255,255,.76); cursor: pointer;
  backdrop-filter: blur(14px);
}.easel-scope .suggestion-icon { font-size: 18px; line-height: 1.4; flex-shrink: 0; }.easel-scope .suggestion-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.easel-scope .suggestion-title { font-size: 13.5px; font-weight: 650; color: var(--text); }.easel-scope .suggestion-text {
  font-size: 12px; color: var(--text-secondary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}@media (max-width: 640px) {.easel-scope .suggestions { grid-template-columns: 1fr; }}.easel-scope .message-row { display: flex; margin-bottom: 18px; animation: fadeIn 0.24s var(--ease); }.easel-scope .message-row.user { justify-content: flex-end; }.easel-scope .message-row.assistant { justify-content: flex-start; }/* ---- ask_user \u95EE\u7B54\u9898\u5361\u7247\uFF08OpenClaw question RPC \u6865\u63A5\uFF09 ---- */.easel-scope .question-card {
  background: var(--bg-elevated, #fff); border: 1px solid var(--border, rgba(0,0,0,.08));
  border-radius: var(--radius-lg, 14px); padding: 14px 16px;
  box-shadow: 0 3px 14px rgba(23,25,28,.06);
  display: grid; gap: 10px; width: 100%;
  animation: fadeIn 0.24s var(--ease);
}.easel-scope .question-card__chip {
  justify-self: start; padding: 3px 9px; border-radius: var(--radius-full, 999px);
  background: var(--accent-start, #4361ee); color: #fff;
  font-size: 11px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase;
}.easel-scope .question-card__title { color: var(--text-strong, #20242c); font-size: 15px; font-weight: 650; line-height: 1.4; }.easel-scope .question-card__options { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }.easel-scope .question-card__option {
  display: grid; gap: 3px; text-align: left; padding: 11px 12px; cursor: pointer;
  border: 1px solid var(--border, rgba(0,0,0,.12)); border-radius: var(--radius-lg, 12px);
  background: var(--bg, #fff); font: inherit; transition: border-color .16s var(--ease), box-shadow .16s var(--ease);
}.easel-scope .question-card__option:hover:not(:disabled) { border-color: var(--accent-start, #4361ee); box-shadow: 0 2px 8px rgba(67,97,238,.14); }.easel-scope .question-card__option--selected { border-color: var(--accent-start, #4361ee); background: color-mix(in srgb, var(--accent-start, #4361ee) 10%, #fff); }.easel-scope .question-card__option:disabled { opacity: .55; cursor: default; }.easel-scope .question-card__option strong { color: var(--text-strong, #20242c); font-size: 14px; }.easel-scope .question-card__option span { color: var(--text-secondary, #666); font-size: 12px; line-height: 1.45; }.easel-scope .question-card__other {
  justify-self: start; background: none; border: 0; padding: 4px 2px; cursor: pointer;
  color: var(--accent-start, #4361ee); font-size: 12px; text-decoration: underline;
}.easel-scope .question-card__other:disabled { opacity: .55; cursor: default; }.easel-scope .question-card__custom { display: flex; gap: 8px; }.easel-scope .question-card__custom input {
  flex: 1; padding: 9px 12px; border-radius: var(--radius, 10px);
  border: 1px solid var(--border, rgba(0,0,0,.12)); font: inherit; font-size: 13px;
}.easel-scope .question-card__custom input:focus { outline: 2px solid var(--accent-start, #4361ee); outline-offset: 1px; }.easel-scope .question-card__custom button {
  padding: 9px 16px; border-radius: var(--radius, 10px); border: 0; cursor: pointer;
  background: var(--accent-start, #4361ee); color: #fff; font-weight: 600;
}.easel-scope .question-card__custom button:disabled { opacity: .5; cursor: default; }.easel-scope .question-card__hint { color: var(--text-secondary, #666); font-size: 12px; }.easel-scope .question-card__error { color: #c0392b; }.easel-scope .question-card__item { display: grid; gap: 8px; }.easel-scope .question-card__divider { height: 1px; background: var(--border, rgba(0,0,0,.08)); margin: 10px 0; }.easel-scope .question-card__actions { display: flex; justify-content: flex-end; }.easel-scope .question-card__submit {
  padding: 9px 20px; border-radius: var(--radius, 10px); border: 0; cursor: pointer;
  background: var(--accent-start, #4361ee); color: #fff; font-weight: 600;
}.easel-scope .question-card__submit:disabled { opacity: .5; cursor: default; }.easel-scope .question-card__multi {
  margin-left: 8px; padding: 1px 8px; border-radius: 999px; vertical-align: 1px;
  font-size: 11px; font-weight: 650; letter-spacing: .02em;
  color: var(--accent-end, #3f56a8);
  background: color-mix(in srgb, var(--accent-start, #4361ee) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--accent-start, #4361ee) 30%, #fff);
}.easel-scope .question-card__option--selected strong::before { content: '\u2713 '; color: var(--accent-start, #4361ee); font-weight: 700; }.easel-scope .message-bubble {
  max-width: 74%; padding: 12px 16px;
  border-radius: var(--radius-lg); font-size: 14px; line-height: 1.65;
  word-wrap: break-word; overflow-wrap: break-word;
}.easel-scope .message-bubble.user {
  background: var(--accent-gradient-soft); color: #303238;
  border: 1px solid rgba(51,66,148,.08);
  border-bottom-right-radius: 4px; box-shadow: 0 3px 12px rgba(23,25,28,.055);
}.easel-scope .message-bubble.assistant {
  background: transparent; border: none; padding: 0;
  border-radius: 0; max-width: 100%; box-shadow: none;
}.easel-scope .message-bubble.assistant p { margin: 0 0 8px; }.easel-scope .message-bubble.assistant p:last-child { margin-bottom: 0; }.easel-scope .message-bubble.assistant h1, .easel-scope .message-bubble.assistant h2, .easel-scope .message-bubble.assistant h3, .easel-scope .message-bubble.assistant h4 { margin: 16px 0 8px; font-weight: 600; }.easel-scope .message-bubble.assistant h1 { font-size: 1.4em; }.easel-scope .message-bubble.assistant h2 { font-size: 1.2em; }.easel-scope .message-bubble.assistant h3 { font-size: 1.1em; }.easel-scope .message-bubble.assistant ul, .easel-scope .message-bubble.assistant ol { margin: 8px 0; padding-left: 20px; }.easel-scope .message-bubble.assistant li { margin-bottom: 4px; }.easel-scope .message-bubble.assistant blockquote {
  border-left: 3px solid var(--accent-start); padding-left: 12px; margin: 8px 0; color: var(--text-secondary);
}.easel-scope .message-bubble.assistant a { color: var(--accent-start); text-decoration: none; }.easel-scope .message-bubble.assistant a:hover { text-decoration: underline; }.easel-scope .message-bubble.assistant code {
  background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.9em;
}.easel-scope .message-bubble.assistant pre {
  background: var(--code-bg); border-radius: var(--radius); padding: 14px 16px;
  margin: 10px 0; overflow-x: auto; font-size: 13px; line-height: 1.5;
}.easel-scope .message-bubble.assistant pre code { background: none; padding: 0; font-size: inherit; }.easel-scope .message-bubble.assistant table { border-collapse: collapse; margin: 8px 0; width: 100%; }.easel-scope .message-bubble.assistant th, .easel-scope .message-bubble.assistant td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }.easel-scope .message-bubble.assistant th { background: var(--code-bg); font-weight: 600; }.easel-scope .streaming-cursor {
  display: inline-block; width: 6px; height: 16px; background: var(--accent-start);
  margin-left: 2px; animation: blink 1s step-end infinite; vertical-align: text-bottom;
}/* \u601D\u8003\u8FC7\u7A0B\uFF08\u6D41\u5F0F\uFF09\uFF1A\u9ED8\u8BA4\u6298\u53E0\uFF0C\u6B63\u6587\u51FA\u73B0\u540E\u53EF\u5C55\u5F00\u67E5\u770B */.easel-scope .live-panel { margin-bottom: 10px; }.easel-scope .live-activity {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;
}.easel-scope .live-pulse {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  background: var(--accent-end); box-shadow: 0 0 0 0 rgba(63,86,168,0.4);
  animation: pulse 1.4s ease-out infinite;
}/* \u9632\u5446\u300C\u672A\u5361\u4F4F\u300D\u63D0\u793A\uFF1A\u9644\u7740\u5728\u771F\u5B9E\u6D3B\u52A8\u72B6\u6001\u540E\uFF0C\u5F31\u5316\u663E\u793A\uFF0C\u4E0D\u55A7\u5BBE\u593A\u4E3B */.easel-scope .live-still { color: var(--text-tertiary, var(--text-secondary)); opacity: 0.75; font-size: 12px; }@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(63,86,168,0.34); }
  70% { box-shadow: 0 0 0 7px rgba(63,86,168,0); }
  100% { box-shadow: 0 0 0 0 rgba(63,86,168,0); }
}.easel-scope .thinking-block {
  border-left: 2px solid var(--accent-soft);
  background: rgba(220,234,251,0.38); border-radius: 0 var(--radius) var(--radius) 0;
  padding: 6px 10px;
}.easel-scope .thinking-block summary {
  cursor: pointer; font-size: 12.5px; color: var(--text-secondary);
  list-style: none; user-select: none;
}.easel-scope .thinking-block summary::-webkit-details-marker { display: none; }.easel-scope .thinking-text {
  margin-top: 6px; font-size: 12.5px; line-height: 1.6;
  color: var(--text-tertiary); white-space: pre-wrap; max-height: 180px; overflow-y: auto;
}.easel-scope .chat-input-area { padding: 10px 24px 18px; background: linear-gradient(180deg, transparent, var(--bg) 40%); }.easel-scope .chat-input-inner { max-width: 860px; margin: 0 auto; }.easel-scope .chat-input {
  width: 100%; background: none; border: none; color: var(--text);
  font-size: 14.5px; font-family: inherit; line-height: 1.55; resize: none; outline: none;
  max-height: 180px; min-height: 24px; display: block;
}.easel-scope .chat-input::placeholder { color: var(--text-tertiary); }.easel-scope .send-btn {
  width: 34px; height: 34px; border-radius: 10px; border: none;
  background: var(--text); color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
  flex-shrink: 0; transition: all var(--t-fast); box-shadow: 0 2px 10px rgba(23,25,28,0.18);
}.easel-scope .send-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }.easel-scope .send-btn:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-1px); }/* ============ Skills gallery ============ */.easel-scope .skills-page { height: 100%; overflow-y: auto; padding: 30px 32px 60px; }.easel-scope .skills-page-head { max-width: 1100px; margin: 0 auto 8px; }.easel-scope .skill-search {
  max-width: 1100px; margin: 18px auto 0;
  display: flex; gap: 10px; align-items: center;
}.easel-scope .skill-search { position: relative; }.easel-scope .skill-search .field { max-width: 440px; padding-left: 38px; }.easel-scope .skill-search-ic { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none; display: inline-flex; }.easel-scope .skills-body { max-width: 1100px; margin: 0 auto; }.easel-scope .section-ic { display: inline-flex; align-items: center; }.easel-scope .skill-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px;
}.easel-scope .skill-card {
  position: relative; padding: 17px 16px 15px; overflow: hidden;
  display: flex; flex-direction: column; gap: 9px; min-height: 124px;
}.easel-scope .skill-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--layer-color, var(--accent-start));
  opacity: 0.85;
}.easel-scope .skill-card-icon {
  width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, currentColor 13%, transparent);
}.easel-scope .skill-card-name { font-size: 15px; font-weight: 650; letter-spacing: -0.2px; word-break: break-word; }.easel-scope .skill-card-desc {
  font-size: 12.5px; color: var(--text-secondary); line-height: 1.55; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}.easel-scope .skill-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }.easel-scope .skill-card-alert {
  position: absolute; top: 12px; right: 12px;
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  background: var(--amber); color: #1a1a1a; box-shadow: 0 0 0 3px var(--amber-soft);
}/* Skill drawer detail */.easel-scope .skill-detail-title { font-size: 20px; font-weight: 750; letter-spacing: -0.3px; }.easel-scope .skill-detail-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }.easel-scope .skill-body-md { font-size: 13.5px; line-height: 1.7; color: var(--text); }.easel-scope .skill-body-md h1, .easel-scope .skill-body-md h2, .easel-scope .skill-body-md h3 { margin: 18px 0 8px; font-weight: 650; }.easel-scope .skill-body-md h1 { font-size: 1.35em; }.easel-scope .skill-body-md h2 { font-size: 1.18em; }.easel-scope .skill-body-md h3 { font-size: 1.05em; }.easel-scope .skill-body-md p { margin: 0 0 9px; }.easel-scope .skill-body-md ul, .easel-scope .skill-body-md ol { margin: 8px 0; padding-left: 20px; }.easel-scope .skill-body-md li { margin-bottom: 4px; }.easel-scope .skill-body-md code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono','Consolas',monospace; font-size: 0.88em; }.easel-scope .skill-body-md pre { background: var(--code-bg); border-radius: var(--radius); padding: 13px 15px; margin: 10px 0; overflow-x: auto; font-size: 12.5px; }.easel-scope .skill-body-md pre code { background: none; padding: 0; }.easel-scope .skill-body-md table { border-collapse: collapse; margin: 8px 0; width: 100%; font-size: 0.95em; }.easel-scope .skill-body-md th, .easel-scope .skill-body-md td { border: 1px solid var(--border); padding: 5px 9px; text-align: left; }.easel-scope .skill-body-md th { background: var(--code-bg); }.easel-scope .skill-body-md blockquote { border-left: 3px solid var(--accent-start); padding-left: 12px; margin: 8px 0; color: var(--text-secondary); }.easel-scope .panel {
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px 18px; margin-bottom: 16px;
}.easel-scope .panel-title { font-size: 13px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }.easel-scope .field-label { display: block; font-size: 12.5px; color: var(--text-secondary); margin: 12px 0 5px; }.easel-scope .field-label:first-child { margin-top: 0; }.easel-scope .provider-block { padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px; background: var(--bg-elev); }.easel-scope .provider-block.configured { border-color: var(--green-soft); }.easel-scope .provider-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }.easel-scope .skill-result {
  margin-top: 14px; padding: 16px 18px;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--radius-lg); font-size: 14px; line-height: 1.65;
}.easel-scope .skill-result p { margin: 0 0 8px; }.easel-scope .skill-result p:last-child { margin-bottom: 0; }.easel-scope .skill-result pre { background: var(--code-bg); border-radius: var(--radius); padding: 14px 16px; margin: 10px 0; overflow-x: auto; font-size: 13px; }.easel-scope .skill-result code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono','Consolas',monospace; font-size: 0.9em; }.easel-scope .skill-result pre code { background: none; padding: 0; }.easel-scope .skill-result ul, .easel-scope .skill-result ol { margin: 8px 0; padding-left: 20px; }/* ============ Outputs page ============ */.easel-scope .outputs-page { display: flex; height: 100%; }.easel-scope .outputs-tree { width: 288px; min-width: 288px; border-right: 1px solid var(--border); overflow-y: auto; padding: 18px 0; }.easel-scope .outputs-tree-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-secondary); padding: 0 16px 12px;
}.easel-scope .tree-folder { cursor: pointer; user-select: none; }.easel-scope .tree-folder-name { display: flex; align-items: center; gap: 7px; padding: 8px 16px; font-size: 13px; font-weight: 550; color: var(--text); transition: background var(--t-fast); border-radius: 8px; margin: 0 6px; }.easel-scope .tree-folder-name:hover { background: var(--surface-hover); }.easel-scope .tree-folder-icon { display: inline-flex; align-items: center; transition: transform var(--t-fast); color: var(--text-tertiary); }.easel-scope .tree-folder-icon.open { transform: rotate(90deg); }.easel-scope .tree-folder-ic { display: inline-flex; align-items: center; color: var(--accent-start); flex-shrink: 0; }.easel-scope .tree-folder-label, .easel-scope .tree-file-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .tree-file { display: flex; align-items: center; gap: 8px; padding: 6px 16px 6px 40px; margin: 0 6px; font-size: 13px; color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast); border-radius: 8px; }.easel-scope .tree-file:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .tree-file.active { background: var(--accent-soft); color: var(--text); }.easel-scope .tree-file-ic { display: inline-flex; align-items: center; color: var(--text-tertiary); flex-shrink: 0; }.easel-scope .tree-file.active .tree-file-ic { color: var(--accent-start); }.easel-scope .outputs-viewer { flex: 1; overflow-y: auto; padding: 26px 32px; }.easel-scope .outputs-viewer-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 14px; }.easel-scope .outputs-viewer-path {
  font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;
  font-family: 'SF Mono','Consolas',monospace; padding: 6px 11px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); display: inline-block;
}.easel-scope .outputs-viewer-content { font-size: 14px; line-height: 1.65; }.easel-scope .outputs-viewer-content p { margin: 0 0 8px; }.easel-scope .outputs-viewer-content pre { background: var(--code-bg); border-radius: var(--radius); padding: 14px 16px; margin: 10px 0; overflow-x: auto; font-size: 13px; }.easel-scope .outputs-viewer-content code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono','Consolas',monospace; font-size: 0.9em; }.easel-scope .outputs-viewer-content pre code { background: none; padding: 0; }/* ============ Profile page ============ */.easel-scope .profile-page { padding: 30px 32px 60px; max-width: 820px; margin: 0 auto; height: 100%; overflow-y: auto; }.easel-scope .profile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }.easel-scope .profile-dim { margin-top: 16px; }.easel-scope .profile-dim-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }.easel-scope .profile-dim-title { font-size: 15px; font-weight: 650; display: flex; align-items: center; gap: 8px; }.easel-scope .profile-content { font-size: 14px; line-height: 1.7; }.easel-scope .profile-content h1, .easel-scope .profile-content h2, .easel-scope .profile-content h3 { margin: 18px 0 9px; font-weight: 600; }.easel-scope .profile-content h1 { font-size: 1.4em; }.easel-scope .profile-content h2 { font-size: 1.2em; }.easel-scope .profile-content h3 { font-size: 1.08em; }.easel-scope .profile-content p { margin: 0 0 9px; }.easel-scope .profile-content ul, .easel-scope .profile-content ol { margin: 8px 0; padding-left: 20px; }.easel-scope .profile-content li { margin-bottom: 4px; }.easel-scope .profile-content code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono','Consolas',monospace; font-size: 0.9em; }.easel-scope .profile-content blockquote { border-left: 3px solid var(--accent-start); padding-left: 12px; margin: 8px 0; color: var(--text-secondary); }.easel-scope .profile-content table { border-collapse: collapse; margin: 8px 0; width: 100%; }.easel-scope .profile-content th, .easel-scope .profile-content td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }.easel-scope .profile-content th { background: var(--code-bg); }/* ============ Loading / typing ============ */.easel-scope .loading { display: flex; align-items: center; justify-content: center; padding: 32px; color: var(--text-secondary); }.easel-scope .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent-start); border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 10px; }.easel-scope .typing-indicator { display: flex; gap: 5px; padding: 4px 0; align-items: center; }.easel-scope .typing-dot { width: 7px; height: 7px; background: var(--text-secondary); border-radius: 50%; animation: typingBounce 1s ease-in-out infinite; }.easel-scope .typing-dot:nth-child(2) { animation-delay: 0.15s; }.easel-scope .typing-dot:nth-child(3) { animation-delay: 0.3s; }@keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }/* ============ Accounts page ============ */.easel-scope .accounts-page { padding: 30px 32px 60px; overflow-y: auto; height: 100%; }.easel-scope .accounts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; margin-top: 18px; }.easel-scope .account-card { padding: 18px; display: flex; flex-direction: column; gap: 10px; }.easel-scope .account-card-head { display: flex; align-items: center; justify-content: space-between; }.easel-scope .account-card-name { font-size: 15px; font-weight: 650; }.easel-scope .account-card-note { color: var(--text-secondary); font-size: 12px; line-height: 1.5; min-height: 30px; }.easel-scope .account-identity { display: flex; align-items: center; gap: 10px; min-height: 44px; }.easel-scope .account-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--bg-subtle, #eee); }.easel-scope .account-avatar-fallback { display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 650; color: #fff; background: linear-gradient(135deg, #a78bfa, #7c6bd6); }.easel-scope .account-nick { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .qr-img { width: 240px; height: 240px; object-fit: contain; background: #fff; border-radius: var(--radius); }/* ============ \u6D88\u606F\u64CD\u4F5C\u6761\uFF08\u590D\u5236/\u7F16\u8F91/\u91CD\u8BD5\uFF0C\u60AC\u505C\u663E\u793A\uFF09============ */.easel-scope .msg-col { display: flex; flex-direction: column; gap: 3px; }.easel-scope .msg-col.user { max-width: min(640px, 86%); align-items: flex-end; }.easel-scope .msg-col.assistant { max-width: 100%; width: 100%; }.easel-scope .msg-col .message-bubble { max-width: 100%; }.easel-scope .msg-actions {
  display: flex; gap: 2px; padding: 1px 2px;
  opacity: 0; transition: opacity 0.14s var(--ease);
}.easel-scope .message-row:hover .msg-actions { opacity: 1; }.easel-scope .msg-action {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: none; color: var(--text-tertiary);
  font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 7px;
  transition: all var(--t-fast); white-space: nowrap;
}.easel-scope .msg-action:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .msg-action svg { flex-shrink: 0; }/* \u7528\u6237\u6D88\u606F\u5185\u8054\u7F16\u8F91 */.easel-scope .msg-edit { width: 74%; display: flex; flex-direction: column; gap: 8px; }.easel-scope .msg-edit textarea { min-height: 72px; }.easel-scope .msg-edit-btns { display: flex; gap: 8px; justify-content: flex-end; }/* ============ \u4FA7\u680F\u4F1A\u8BDD\u64CD\u4F5C\uFF08\u91CD\u547D\u540D/\u5F52\u6863/\u5220\u9664\uFF09============ */.easel-scope .session-actions { display: none; align-items: center; gap: 1px; flex-shrink: 0; margin-left: 4px; }.easel-scope .session-item:hover .session-actions { display: flex; }.easel-scope .session-act {
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-tertiary);
  cursor: pointer; padding: 3px; line-height: 1; border-radius: 5px;
  transition: all var(--t-fast);
}.easel-scope .session-act:hover { color: var(--text); background: var(--surface-hover); }.easel-scope .session-act.danger:hover { color: var(--red); background: var(--red-soft); }.easel-scope .session-rename-input {
  width: 100%; background: var(--bg-elev); border: 1px solid var(--accent-start);
  border-radius: 6px; color: var(--text); font-size: 13px; padding: 4px 8px; outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}.easel-scope .archived-header {
  display: flex; align-items: center; gap: 6px; padding: 10px 12px 5px;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-tertiary); font-weight: 700; cursor: pointer; user-select: none;
}.easel-scope .archived-header:hover { color: var(--text-secondary); }.easel-scope .archived-chevron { display: inline-flex; align-items: center; transition: transform var(--t-fast); color: var(--text-tertiary); }.easel-scope .archived-chevron.open { transform: rotate(90deg); }/* ============ \u901A\u7528\u9875\u5BB9\u5668 ============ */.easel-scope .page-scroll { height: 100%; overflow-y: auto; padding: 28px 32px 60px; }.easel-scope .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; max-width: 1100px; margin: 0 auto 4px; }.easel-scope .notice-error { max-width: 1100px; margin: 14px auto 0; color: var(--red); background: var(--red-soft); border: 1px solid transparent; border-radius: var(--radius); padding: 10px 14px; font-size: 13px; }/* ============ \u70ED\u70B9\u96F7\u8FBE ============ */.easel-scope .trend-platforms { display: flex; gap: 8px; flex-wrap: wrap; max-width: 1100px; margin: 14px auto 0; }.easel-scope .trend-grid { max-width: 1100px; margin: 16px auto 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }.easel-scope .trend-col { padding: 14px 6px 10px; }.easel-scope .trend-col-head { font-weight: 650; font-size: 14px; padding: 0 12px 8px; display: flex; align-items: center; gap: 8px; }.easel-scope .trend-count { color: var(--text-tertiary); font-size: 12px; font-weight: 500; }.easel-scope .trend-item { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 8px; transition: background var(--t-fast); }.easel-scope .trend-item:hover { background: var(--surface-hover); }.easel-scope .trend-rank { width: 20px; text-align: center; font-size: 13px; font-weight: 700; color: var(--text-tertiary); flex-shrink: 0; }.easel-scope .trend-rank.top { color: var(--accent-end); }.easel-scope .trend-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }.easel-scope .trend-title { font-size: 13px; color: var(--text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .trend-title:hover { color: var(--accent-start); }.easel-scope .trend-hot { font-size: 11px; color: var(--text-tertiary); }.easel-scope .trend-meta { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }.easel-scope .trend-badge { font-size: 10.5px; line-height: 1; padding: 2.5px 6px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }.easel-scope .trend-badge-new { color: var(--accent-end); background: var(--accent-soft); font-weight: 650; }.easel-scope .trend-badge-up { color: var(--trend-up); background: color-mix(in srgb, var(--trend-up) 13%, transparent); }.easel-scope .trend-badge-down { color: var(--trend-down); background: color-mix(in srgb, var(--trend-down) 13%, transparent); }.easel-scope .trend-badge-watch { color: var(--amber, #b45309); background: color-mix(in srgb, var(--amber, #b45309) 13%, transparent); }.easel-scope .trend-age { font-size: 10.5px; color: var(--text-tertiary); white-space: nowrap; }.easel-scope .trend-plat { font-size: 10.5px; color: var(--text-secondary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 64px; }.easel-scope .trend-stale { font-size: 11px; color: var(--amber, #b45309); font-weight: 500; }.easel-scope .trend-more { font-size: 11.5px; color: var(--text-tertiary); padding: 2px 12px 6px; }.easel-scope .trend-viewsep { width: 1px; align-self: stretch; background: var(--border); margin: 2px 4px; }.easel-scope .trend-watch-card { padding: 12px 6px 6px; max-width: 1100px; margin: 14px auto 0; }.easel-scope .trend-watch-group { display: flex; align-items: center; gap: 8px; padding: 0 8px; }.easel-scope .trend-watch-group + .trend-watch-group { border-top: 1px dashed var(--border); }.easel-scope .trend-watch-items { flex: 1; min-width: 0; }.easel-scope .trend-watch-group .trend-item { padding-top: 5px; padding-bottom: 5px; }.easel-scope .trend-watch-group .trend-item .trend-use, .easel-scope .trend-watch-group .trend-item .trend-save { opacity: 1; }.easel-scope .trend-watch-key { font-size: 12px; font-weight: 650; color: var(--accent-end); background: var(--accent-soft); border-radius: 999px; padding: 3px 10px; white-space: nowrap; flex-shrink: 0; }.easel-scope .trend-cluster { padding: 12px 6px 8px; }.easel-scope .trend-cluster-head { display: flex; align-items: center; gap: 8px; padding: 0 12px 6px; }.easel-scope .trend-cluster-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }.easel-scope .trend-cluster-actions .trend-save, .easel-scope .trend-cluster-actions .trend-use { opacity: 1; }.easel-scope .trend-cluster-platforms { display: flex; align-items: center; gap: 6px; padding: 0 12px 6px; flex-wrap: wrap; }.easel-scope .trend-chip { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--surface-hover); color: var(--text-secondary); }.easel-scope .trend-use { opacity: 0; transition: all var(--t-fast); flex-shrink: 0; font-size: 12px; padding: 4px 9px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg-elev); cursor: pointer; white-space: nowrap; color: var(--accent-end); }.easel-scope .trend-item:hover .trend-use { opacity: 1; }.easel-scope .trend-use:hover { background: var(--accent-soft); border-color: transparent; }.easel-scope .trend-empty { color: var(--text-tertiary); font-size: 13px; padding: 10px 12px; }/* ============ \u5185\u5BB9\u65E5\u5386 ============ */.easel-scope .cal-nav { display: flex; align-items: center; gap: 8px; }.easel-scope .cal-month { font-weight: 650; font-size: 14px; min-width: 120px; text-align: center; }.easel-scope .cal-grid-head { max-width: 1100px; margin: 18px auto 6px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }.easel-scope .cal-wd { text-align: center; font-size: 12px; color: var(--text-tertiary); font-weight: 600; }.easel-scope .cal-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }.easel-scope .cal-cell { height: 132px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 6px 7px; cursor: pointer; transition: all var(--t-fast); display: flex; flex-direction: column; gap: 4px; overflow: hidden; }.easel-scope .cal-cell:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }.easel-scope .cal-cell.dim { opacity: 0.4; }.easel-scope .cal-cell.today { border-color: var(--accent-start); box-shadow: 0 0 0 2px var(--accent-soft); }.easel-scope .cal-daynum { font-size: 12px; color: var(--text-secondary); font-weight: 600; }.easel-scope .cal-cell.today .cal-daynum { color: var(--accent-end); }/* \u8282\u5047\u65E5\u5E95\u56FE\uFF08T2\uFF09\uFF1A\u4F11/\u73ED\u89D2\u6807 + \u8282\u65E5\u540D */.easel-scope .calendar-page { --cal-rest: #e5484d; --cal-festival: #b7791f; }.easel-scope .cal-daynum-row { display: flex; align-items: center; gap: 4px; }.easel-scope .cal-festival { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 4px; font-size: 10px; font-weight: 700; flex-shrink: 0; }.easel-scope .cal-festival.rest { color: #fff; background: var(--cal-rest); }.easel-scope .cal-festival.work { color: var(--text-tertiary); background: color-mix(in srgb, var(--text-tertiary) 15%, transparent); }.easel-scope .cal-festnames { font-size: 11px; color: var(--cal-festival); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; }.easel-scope .cal-fest-day { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }.easel-scope .cal-festival-tag { font-size: 12px; padding: 2px 9px; border-radius: 999px; }.easel-scope .cal-festival-tag.is-statutory-rest { color: #fff; background: var(--cal-rest); font-weight: 600; }.easel-scope .cal-festival-tag.is-statutory-work { color: var(--text-tertiary); background: color-mix(in srgb, var(--text-tertiary) 14%, transparent); }.easel-scope .cal-festival-tag.is-lunar { color: #fff; background: var(--cal-festival); }.easel-scope .cal-festival-tag.is-fixed { color: var(--cal-festival); background: color-mix(in srgb, var(--cal-festival) 14%, transparent); }/* \u53F3\u952E\u83DC\u5355\uFF08T3\uFF09\uFF1A\u900F\u660E\u906E\u7F69\u4E0A\u7684\u6D6E\u5C42\u83DC\u5355 */.easel-scope .overlay.is-menu { background: transparent; }.easel-scope .cal-menu { position: fixed; z-index: 80; min-width: 176px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; display: flex; flex-direction: column; }.easel-scope .cal-menu > button { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 10px; font-size: 13px; color: var(--text); background: none; border: 0; border-radius: 7px; cursor: pointer; text-align: left; }.easel-scope .cal-menu > button:hover { background: var(--accent-soft); }.easel-scope .cal-menu-sep { height: 1px; background: var(--border); margin: 3px 4px; }.easel-scope .cal-menu > .cal-menu-del { color: var(--text-tertiary); }.easel-scope .cal-menu > .cal-menu-del:hover { color: var(--cal-rest); }.easel-scope .cal-repeat { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 12.5px; color: var(--text-secondary); cursor: pointer; }/* CalDAV \u8BA2\u9605\uFF08T6\uFF09\uFF1A\u53EA\u8BFB chip\uFF08\u7A7A\u5FC3\u70B9\uFF09\u4E0E\u8D26\u53F7\u7BA1\u7406\u5F39\u7A97 */.easel-scope .cal-event.is-caldav { background: color-mix(in srgb, var(--ev) 7%, transparent); border: 1px dashed color-mix(in srgb, var(--ev) 40%, transparent); cursor: default; }.easel-scope .cal-event.is-caldav .cal-event-dot { background: transparent; border: 2px solid var(--ev); }.easel-scope .cal-sub-hint { font-size: 12.5px; color: var(--text-tertiary); margin: 0 0 12px; line-height: 1.5; }.easel-scope .cal-sub-row { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; }.easel-scope .cal-sub-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ev); flex-shrink: 0; }.easel-scope .cal-sub-main { flex: 1; min-width: 0; }.easel-scope .cal-sub-url { font-size: 12px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .cal-sub-form { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; }.easel-scope .cal-sub-error { margin-top: 10px; font-size: 12.5px; color: var(--cal-rest); }.easel-scope .cal-events { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }.easel-scope .cal-event { display: flex; align-items: center; gap: 5px; font-size: 11.5px; padding: 2px 6px; border-radius: 5px; background: color-mix(in srgb, var(--ev) 13%, transparent); cursor: pointer; }.easel-scope .cal-event-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ev); flex-shrink: 0; }.easel-scope .cal-event-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }/* ============ \u5DE5\u4F5C\u53F0 ============ */.easel-scope .dash-hero { max-width: 1100px; margin: 0 auto 8px; }.easel-scope .dash-quick { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 16px; }.easel-scope .dash-quick-btn {
  display: flex; align-items: center; gap: 7px; padding: 9px 15px;
  font-size: 13.5px; font-weight: 550; cursor: pointer; color: var(--text);
  background: var(--surface); border: 1px solid var(--border); border-radius: 999px;
  transition: all var(--t-fast);
}.easel-scope .dash-quick-btn:hover { border-color: var(--accent-start); background: var(--accent-soft); }.easel-scope .dash-quick-btn svg { color: var(--accent-start); }.easel-scope .dash-stats { max-width: 1100px; margin: 18px auto 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }.easel-scope .dash-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 15px 17px; cursor: pointer; text-align: left; }.easel-scope .dash-stat-ic { display: inline-flex; width: 34px; height: 34px; border-radius: 10px; align-items: center; justify-content: center; background: var(--accent-soft); color: var(--accent-end); margin-bottom: 8px; }.easel-scope .dash-stat-val { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; }.easel-scope .dash-stat-label { font-size: 12.5px; color: var(--text-secondary); }.easel-scope .dash-idea { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 13px; }.easel-scope .dash-idea:last-child { border-bottom: none; }.easel-scope .dash-idea-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .dash-idea:hover .dash-idea-title { color: var(--accent-start); }@media (max-width: 760px) {.easel-scope .dash-stats { grid-template-columns: repeat(2, 1fr); }}.easel-scope .dash-grid { max-width: 1100px; margin: 18px auto 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }/* \u53EA\u8BA9\u300C\u6700\u8FD1\u4EA7\u7269\u300D\u4E0D\u88AB\u540C\u884C\u7684\u9AD8\u5361\uFF08\u521B\u4F5C\u6570\u636E\uFF09\u62C9\u4F38\u7559\u767D\uFF0C\u5176\u4F59\u5361\u7247\u4ECD\u7B49\u9AD8 */.easel-scope .dash-card-top { align-self: start; }.easel-scope .dash-card { padding: 16px 18px; }.easel-scope .dash-card-head { display: flex; align-items: center; justify-content: space-between; font-weight: 650; font-size: 14px; margin-bottom: 12px; }.easel-scope .dash-card-head > span { display: flex; align-items: center; gap: 7px; }.easel-scope .dash-card-head svg { color: var(--accent-start); }.easel-scope .dash-more { background: none; border: none; color: var(--text-tertiary); font-size: 12px; cursor: pointer; }.easel-scope .dash-more:hover { color: var(--accent-end); }.easel-scope .dash-empty { color: var(--text-tertiary); font-size: 13px; padding: 8px 0; }.easel-scope .dash-trend-group { margin-bottom: 10px; }.easel-scope .dash-trend-plat { font-size: 12px; color: var(--text-tertiary); font-weight: 600; margin-bottom: 4px; }.easel-scope .dash-trend-item { padding: 3px 0; }.easel-scope .dash-trend-title { font-size: 13px; color: var(--text); cursor: pointer; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .dash-trend-title:hover { color: var(--accent-start); }.easel-scope .dash-sched, .easel-scope .dash-output { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 13px; }.easel-scope .dash-sched:last-child, .easel-scope .dash-output:last-child { border-bottom: none; }.easel-scope .dash-sched:hover .dash-sched-title, .easel-scope .dash-output:hover .dash-output-name { color: var(--accent-start); }.easel-scope .dash-sched-date { font-size: 12px; color: var(--text-tertiary); flex-shrink: 0; width: 44px; }.easel-scope .dash-sched-title, .easel-scope .dash-output-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .dash-accounts-sum { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }.easel-scope .dash-accounts { display: flex; flex-wrap: wrap; gap: 6px; }.easel-scope .dash-acc { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-tertiary); }.easel-scope .dash-acc.on { color: var(--green); border-color: transparent; background: var(--green-soft); }/* ============ \u521B\u4F5C\u6570\u636E\uFF08\u5F52\u56E0\uFF09\u5BBD\u5361 ============ */.easel-scope .dash-card-wide { grid-column: span 2; }@media (max-width: 720px) {.easel-scope .dash-card-wide { grid-column: span 1; }}.easel-scope .ana-plats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }.easel-scope .ana-plats .chip {
  background: rgba(255,255,255,.72);
  border-color: rgba(51,66,148,.12);
  color: #777b86;
}.easel-scope .ana-plats .chip:hover { border-color: rgba(51,66,148,.24); background: rgba(220,234,251,.48); }.easel-scope .ana-plats .chip.active {
  background: rgba(220,234,251,.78);
  border-color: rgba(63,86,168,.18);
  color: #4d5f99;
}.easel-scope .ana-body { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; align-items: start; }.easel-scope .ana-col { min-width: 0; }.easel-scope .ana-id { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .ana-overview { display: flex; gap: 8px; }.easel-scope .ana-stat { flex: 1; text-align: center; padding: 10px 4px; background: var(--surface-2); border-radius: 12px; }.easel-scope .ana-stat-val { font-size: 24px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }.easel-scope .ana-stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }.easel-scope .ana-stat-delta { font-size: 11px; font-weight: 600; margin-top: 5px; font-variant-numeric: tabular-nums; }.easel-scope .ana-muted { color: var(--text-tertiary) !important; font-weight: 400; }.easel-scope .ana-wins { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 14px; }.easel-scope .ana-win { font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast); }.easel-scope .ana-win:hover { border-color: var(--border-strong); color: var(--text); }.easel-scope .ana-win.on { background: var(--accent-soft); border-color: transparent; color: var(--accent-end); font-weight: 600; }.easel-scope .ana-wins-note { font-size: 11px; color: var(--text-tertiary); margin-top: 8px; line-height: 1.5; }.easel-scope .ana-sub { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 10px; }.easel-scope .ana-metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }.easel-scope .ana-metric { text-align: center; padding: 8px 4px; background: var(--surface-2); border-radius: 10px; }.easel-scope .ana-metric-val { font-size: 16px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }.easel-scope .ana-metric-label { font-size: 11px; color: var(--text-secondary); margin-top: 3px; }.easel-scope .ana-metric-vs { font-size: 10px; font-weight: 600; margin-top: 3px; }.easel-scope .ana-notes { display: flex; flex-direction: column; gap: 6px; }.easel-scope .ana-note { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 9px;
  background: var(--surface-2); font-size: 12.5px; color: var(--text); text-decoration: none; transition: all var(--t-fast); }.easel-scope .ana-note:hover { background: var(--accent-soft); color: var(--accent-end); }.easel-scope .ana-note-cover { width: 34px; height: 34px; border-radius: 7px; object-fit: cover; flex-shrink: 0; background: var(--surface); }.easel-scope .ana-note-cover-ph { display: flex; align-items: center; justify-content: center; font-size: 15px; }.easel-scope .ana-note-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }.easel-scope .ana-note-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .ana-note-stat { font-size: 11px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .ana-note:hover .ana-note-stat { color: var(--accent-end); }.easel-scope .ana-note-go { flex-shrink: 0; color: var(--text-tertiary); }.easel-scope .ana-note:hover .ana-note-go { color: var(--accent-end); }/* ============ \u5185\u5BB9\u5E93\u753B\u5ECA ============ */.easel-scope .gallery-page { height: 100%; overflow-y: auto; padding: 28px 32px 60px; }.easel-scope .gallery-head { max-width: 1160px; margin: 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.easel-scope .gallery-filters { display: flex; gap: 8px; flex-wrap: wrap; max-width: 1160px; margin: 14px auto 0; }.easel-scope .gallery-grid { max-width: 1160px; margin: 16px auto 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }.easel-scope .gcard { padding: 0; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; }.easel-scope .gcard-thumb { aspect-ratio: 4/3; background: var(--surface-2); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }.easel-scope .gcard-thumb img { width: 100%; height: 100%; object-fit: cover; }.easel-scope .gcard-thumb video { width: 100%; height: 100%; object-fit: cover; }.easel-scope .gcard-ph { color: var(--text-tertiary); display: flex; flex-direction: column; align-items: center; gap: 6px; }.easel-scope .gcard-kind { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: rgba(24,24,48,0.55); color: #fff; }.easel-scope .gcard-meta { padding: 10px 12px; }.easel-scope .gcard-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .gcard-sub { font-size: 11.5px; color: var(--text-tertiary); margin-top: 2px; }/* \u5185\u5BB9\u5E93\u9762\u5305\u5C51 */.easel-scope .crumb { cursor: pointer; color: var(--text-secondary); }.easel-scope .crumb:hover { color: var(--accent-start); }.easel-scope .crumb-sep { color: var(--text-tertiary); margin: 0 2px; font-weight: 400; }/* ============ \u9009\u9898\u5E93\u770B\u677F ============ */.easel-scope .kanban { max-width: 1160px; margin: 16px auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }.easel-scope .kanban-col { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px; min-height: 200px; }.easel-scope .kanban-col-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-secondary); padding: 2px 4px 10px; }.easel-scope .kanban-dot { width: 9px; height: 9px; border-radius: 3px; }.easel-scope .kanban-count { color: var(--text-tertiary); font-weight: 500; }.easel-scope .kanban-list { display: flex; flex-direction: column; gap: 10px; }.easel-scope .kanban-empty { color: var(--text-tertiary); font-size: 12.5px; padding: 12px 4px; }.easel-scope .idea-card { position: relative; padding: 13px 14px; }.easel-scope .idea-card-actions { position: absolute; top: 8px; right: 8px; display: none; gap: 2px; }.easel-scope .idea-card:hover .idea-card-actions { display: flex; }.easel-scope .idea-title { font-size: 14px; font-weight: 600; line-height: 1.45; padding-right: 40px; }.easel-scope .idea-note { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin-top: 7px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }.easel-scope .idea-foot { display: flex; align-items: center; gap: 4px; margin-top: 11px; flex-wrap: wrap; }.easel-scope .idea-links { display: flex; align-items: center; gap: 4px; margin-top: 7px; }.easel-scope .idea-link { font-size: 11.5px; color: var(--accent-end); background: none; border: none; padding: 2px 4px; cursor: pointer; text-decoration: none; }.easel-scope .idea-link:hover { text-decoration: underline; }.easel-scope .idea-body-preview { max-height: 64vh; overflow: auto; padding: 6px 2px; font-size: 13px; line-height: 1.7; }.easel-scope .idea-act { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 4px 8px; border-radius: 7px;
  border: 1px solid var(--border); background: var(--bg-elev); color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast); }.easel-scope .idea-act:hover { color: var(--text); border-color: var(--border-strong); }.easel-scope .idea-act.next { margin-left: auto; color: var(--accent-end); }.easel-scope .idea-act.next:hover { background: var(--accent-soft); border-color: transparent; }/* \u70ED\u70B9\u6536\u85CF\u6309\u94AE */.easel-scope .trend-save { opacity: 0; transition: all var(--t-fast); flex-shrink: 0; display: inline-flex; align-items: center;
  padding: 5px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg-elev); color: var(--text-tertiary); cursor: pointer; }.easel-scope .trend-item:hover .trend-save { opacity: 1; }.easel-scope .trend-save:hover { color: var(--accent-end); background: var(--accent-soft); border-color: transparent; }/* ============ \u53D1\u5E03\u4E2D\u5FC3 ============ */.easel-scope .publish-page { display: flex; height: 100%; overflow: hidden; }.easel-scope .publish-editor { width: 46%; min-width: 400px; max-width: 620px; overflow-y: auto; padding: 28px 28px 60px; border-right: 1px solid var(--border); }.easel-scope .publish-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }.easel-scope .publish-previews { flex: 1; overflow-y: auto; padding: 28px 28px 60px; display: flex; flex-direction: column; gap: 14px; background: var(--surface-2); }.easel-scope .pv-card { padding: 0; overflow: hidden; }.easel-scope .pv-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); }.easel-scope .pv-plat { font-size: 13px; font-weight: 700; }.easel-scope .pv-count { font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }.easel-scope .pv-count.over { color: var(--red); font-weight: 700; }.easel-scope .pv-body { padding: 14px; }.easel-scope .pv-title { font-size: 15px; font-weight: 650; margin-bottom: 8px; }.easel-scope .pv-title.over { color: var(--red); }.easel-scope .pv-text { font-size: 13.5px; line-height: 1.7; white-space: pre-wrap; color: var(--text); word-break: break-word; }.easel-scope .pv-ph { color: var(--text-tertiary); }.easel-scope .pv-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 14px; border-top: 1px solid var(--border); background: var(--bg-elev); }.easel-scope .pv-hint { font-size: 11.5px; color: var(--text-tertiary); }.easel-scope .pv-copy { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 4px 9px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast); flex-shrink: 0; }.easel-scope .pv-copy:hover { color: var(--text); border-color: var(--border-strong); }/* \u5E73\u53F0\u98CE\u683C\u5FAE\u8C03 */.easel-scope .pv-xiaohongshu .pv-title { color: #ff2e4d; }.easel-scope .pv-douyin { }.easel-scope .pv-weibo .pv-text { }@media (max-width: 900px) {.easel-scope .publish-page { flex-direction: column; }.easel-scope .publish-editor { width: 100%; max-width: none; border-right: none; border-bottom: 1px solid var(--border); }}/* \u53D1\u5E03\u4E2D\u5FC3 AI\u7248\u5FBD\u6807 + \u7206\u6B3E\u62C6\u89E3 */.easel-scope .pv-badge { margin-left: 8px; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-end); }.easel-scope .pv-badge-ok { background: color-mix(in srgb, var(--green) 18%, transparent); color: var(--green); }.easel-scope .pv-pubstate { margin: 8px 0 2px; font-size: 12px; padding: 6px 10px; border-radius: 8px; display: flex; align-items: center; gap: 6px; white-space: pre-wrap; word-break: break-word; }.easel-scope .pv-pubstate.publishing { background: var(--accent-soft); color: var(--accent-end); }.easel-scope .pv-pubstate.ok { background: color-mix(in srgb, var(--green) 15%, transparent); color: var(--green); }.easel-scope .pv-pubstate.fail { background: color-mix(in srgb, var(--red) 12%, transparent); color: var(--red); max-height: 120px; overflow: auto; }/* \u5A92\u4F53\u9644\u4EF6\u9009\u62E9 */.easel-scope .media-chip { position: relative; width: 46px; height: 46px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid var(--accent-end); flex-shrink: 0; }.easel-scope .media-chip img { width: 100%; height: 100%; object-fit: cover; }.easel-scope .media-chip .media-vid { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 20px; background: var(--bg-subtle, #eee); }.easel-scope .media-chip .media-x { position: absolute; top: 0; right: 2px; color: #fff; font-weight: 800; text-shadow: 0 0 3px #000; }.easel-scope .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; margin-top: 10px; max-height: 260px; overflow: auto; padding: 4px; border: 1px solid var(--border); border-radius: 10px; }.easel-scope .media-cell { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; background: var(--bg-subtle, #f0f0f0); }.easel-scope .media-cell.sel { border-color: var(--accent-end); }.easel-scope .media-cell img { width: 100%; height: 100%; object-fit: cover; }.easel-scope .media-cell .media-vid { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 22px; text-align: center; font-size: 11px; }.easel-scope .media-cell .media-check { position: absolute; top: 3px; right: 4px; background: var(--accent-end); color: #fff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; }.easel-scope .breakdown-body { max-width: 900px; margin: 16px auto 0; }/* \u53D1\u5E03\u4E2D\u5FC3\uFF1A\u9002\u914D\u8FDB\u5EA6\u63D0\u793A + \u9884\u89C8\u5B8C\u6574\u663E\u793A */.easel-scope .adapt-hint { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12.5px; color: var(--text-secondary); }.easel-scope .pv-card { overflow: visible; }.easel-scope .pv-text { max-height: none; }.easel-scope .publish-saved-note { margin-top: 10px; font-size: 11.5px; color: var(--text-tertiary); }/* ============ \u5B50\u5DE5\u5177\u9876\u90E8\u5C0F\u5BFC\u822A ============ */.easel-scope .page-host { flex: 1; min-height: 0; display: flex; flex-direction: column; }.easel-scope .page-host > * { flex: 1; min-height: 0; }.easel-scope .subnav {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: 8px 16px; border-bottom: 1px solid var(--border);
  background: var(--surface); overflow-x: auto;
}.easel-scope .subnav-back {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
  padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 550;
  border: 1px solid var(--border); background: var(--bg-elev); color: var(--text);
  cursor: pointer; transition: all var(--t-fast);
}.easel-scope .subnav-back:hover { border-color: var(--accent-start); background: var(--accent-soft); }.easel-scope .subnav-back svg { color: var(--accent-start); }.easel-scope .subnav-div { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }.easel-scope .subnav-tabs { display: flex; gap: 4px; }.easel-scope .subnav-tab {
  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
  padding: 6px 12px; border-radius: 8px; font-size: 13px;
  border: none; background: none; color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast);
}.easel-scope .subnav-tab:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .subnav-tab.active { background: var(--accent-soft); color: var(--accent-end); font-weight: 600; }/* \u5185\u5BB9\u65E5\u5386\uFF1A\u5E73\u53F0\u6D3B\u52A8 / \u56FE\u4F8B / \u6765\u6E90 / \u89C4\u5212\u5EFA\u8BAE */.easel-scope .cal-event.is-event { background: color-mix(in srgb, var(--ev) 18%, transparent); font-weight: 600; }.easel-scope .cal-event.is-event .cal-event-dot { border-radius: 2px; width: 7px; height: 7px; }.easel-scope .cal-legend { max-width: 1100px; margin: 0 auto 4px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 12px; color: var(--text-tertiary); }.easel-scope .cal-legend-item { display: inline-flex; align-items: center; gap: 5px; }.easel-scope .cal-legend-swatch { width: 9px; height: 9px; border-radius: 50%; background: var(--sw); flex-shrink: 0; }.easel-scope .cal-legend-swatch.sq { border-radius: 2px; }.easel-scope .cal-legend-filter { margin-left: auto; display: inline-flex; gap: 6px; }.easel-scope .cal-src { font-size: 10px; color: var(--text-tertiary); margin-left: 3px; }.easel-scope .cal-suggest { max-width: 1100px; margin: 0 auto 12px; background: color-mix(in srgb, var(--layer-attribute) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--layer-attribute) 25%, var(--border)); border-radius: 10px; padding: 10px 14px; font-size: 13px; }.easel-scope .cal-suggest-head { display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: var(--text); }.easel-scope .cal-suggest ul { margin: 6px 0 0; padding-left: 18px; }.easel-scope .cal-suggest li { margin: 2px 0; color: var(--text-secondary); }/* \u5185\u5BB9\u65E5\u5386\uFF1A\u6298\u53E0\u300C+N \u66F4\u591A\u300D+ \u5F53\u5929\u8BE6\u60C5\u5217\u8868 */.easel-scope .cal-more { align-self: flex-start; margin-top: 1px; padding: 1px 7px; font-size: 11px; font-weight: 600;
  color: var(--text-secondary); background: var(--surface-hover); border: 1px solid var(--border);
  border-radius: 5px; cursor: pointer; transition: all var(--t-fast); }.easel-scope .cal-more:hover { color: var(--text); border-color: var(--border-strong); background: var(--accent-soft); }.easel-scope .cal-dayview-list { display: flex; flex-direction: column; gap: 6px; max-height: 56vh; overflow-y: auto; }.easel-scope .cal-dayview-list .cal-event { font-size: 13.5px; padding: 7px 10px; }/* \u5BF9\u8BDD\u9875\u7D20\u6750\u4E0A\u4F20\uFF1A\u62D6\u62FD\u9AD8\u4EAE + \u9644\u4EF6\u82AF\u7247 + \u7D20\u6750\u6309\u94AE */.easel-scope .composer-drag { border-color: var(--accent-start); box-shadow: var(--glow); background: var(--accent-soft); }.easel-scope .composer-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }.easel-scope .attach-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 220px; padding: 3px 6px 3px 8px;
  font-size: 12px; color: var(--text-secondary); background: var(--surface-hover);
  border: 1px solid var(--border); border-radius: 7px; }.easel-scope .attach-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .attach-x { border: none; background: none; color: var(--text-tertiary); cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }.easel-scope .attach-x:hover { color: var(--red); }.easel-scope .composer-attach-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; font-size: 12px;
  color: var(--text-secondary); background: none; border: 1px solid var(--border); border-radius: 7px; cursor: pointer;
  transition: all var(--t-fast); }.easel-scope .composer-attach-btn:hover:not(:disabled) { border-color: var(--accent-start); color: var(--text); background: var(--accent-soft); }.easel-scope .composer-attach-btn:disabled { opacity: 0.5; cursor: default; }/* \u5185\u5BB9\u5E93\u5361\u7247\u5220\u9664\u6309\u94AE\uFF08hover \u663E\u73B0\uFF09 */.easel-scope .gcard-thumb { position: relative; }.easel-scope .gcard-del { position: absolute; top: 6px; right: 6px; z-index: 2; width: 26px; height: 26px;
  display: none; align-items: center; justify-content: center; border-radius: 7px; border: none;
  background: rgba(0,0,0,0.55); color: #fff; cursor: pointer; transition: background var(--t-fast); }.easel-scope .gcard:hover .gcard-del { display: inline-flex; }.easel-scope .gcard-del:hover { background: var(--red); }/* \u6280\u80FD\u5E93\u4E2D\u6587\u5C55\u793A\u540D\uFF08\u4E2D\u6587\u5927\u5B57 + \u539F\u540D\u5C0F\u5B57\uFF09 */.easel-scope .skill-card-rawname { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 11px; color: var(--text-tertiary); margin-top: -3px; letter-spacing: 0; }.easel-scope .skill-detail-rawname { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 12px; color: var(--text-tertiary); margin-top: 3px; letter-spacing: 0; }/* \u2550\u2550\u2550 \u8BBE\u7F6E\u9762\u677F\uFF08\u60AC\u6D6E\u7EDF\u4E00\u5165\u53E3\uFF09 \u2550\u2550\u2550 */.easel-scope .settings-gear {
  margin-left: auto; display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 8px; border: 1px solid var(--border-strong);
  background: var(--bg-elev); font-size: 12px; font-weight: 600; color: var(--accent-end);
  cursor: pointer; transition: all var(--t-fast);
}.easel-scope .settings-gear:hover { border-color: var(--accent-start); background: var(--accent-soft); }.easel-scope .settings-overlay { position: fixed; inset: 0; background: rgba(23, 25, 28, 0.38); display: flex; align-items: center; justify-content: center; z-index: 60; }.easel-scope .settings-panel { width: 1180px; max-width: 94%; height: 680px; max-height: 92%; background: var(--bg); border-radius: var(--radius-xl, 20px); box-shadow: 0 24px 50px -16px rgba(23,25,28,.28), 0 2px 8px rgba(23,25,28,.05); display: flex; flex-direction: column; overflow: hidden; animation: st-pop .16s cubic-bezier(.22,1,.36,1); }@keyframes st-pop { from { opacity: 0; transform: scale(.985) translateY(4px); } to { opacity: 1; transform: none; } }.easel-scope .settings-head { display: flex; align-items: center; gap: 16px; padding: 16px 22px 12px; }.easel-scope .settings-title { font-size: 17px; font-weight: 700; margin: 0; }.easel-scope .settings-sub { color: var(--text-tertiary); font-size: 12.5px; margin-top: 2px; }.easel-scope .settings-actions { margin-left: auto; display: flex; gap: 9px; align-items: center; }.easel-scope .settings-close { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary); font-size: 14px; cursor: pointer; line-height: 1; }.easel-scope .settings-close:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .settings-body { display: flex; flex: 1; overflow: hidden; }.easel-scope .settings-nav { width: 188px; flex: none; border-right: 1px solid var(--border); background: var(--surface-2); padding: 14px 10px; display: flex; flex-direction: column; gap: 3px; }.easel-scope .settings-main { flex: 1; overflow: auto; padding: 16px 22px 8px; min-width: 0; }.easel-scope .settings-foot { padding: 10px 22px; border-top: 1px solid var(--border); color: var(--text-tertiary); font-size: 12.5px; background: var(--surface-2); }.easel-scope .settings-overlay .snav { display: flex; align-items: center; gap: 9px; padding: 9px 11px; border-radius: 9px; border: 0; background: none; font: inherit; font-size: 13.5px; color: var(--text-secondary); cursor: pointer; text-align: left; white-space: nowrap; transition: background .15s cubic-bezier(.22,1,.36,1), color .15s cubic-bezier(.22,1,.36,1); }.easel-scope .settings-overlay .snav:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .settings-overlay .snav.active { background: var(--accent-soft); color: var(--accent-end); font-weight: 650; }.easel-scope .settings-overlay .snav svg { width: 16px; height: 16px; flex: none; }.easel-scope .settings-overlay .snav small { margin-left: auto; font-size: 11px; color: var(--text-tertiary); font-weight: 500; white-space: nowrap; }.easel-scope .settings-overlay .snav.active small { color: var(--accent-end); }.easel-scope .settings-overlay .tabbar { display: flex; gap: 2px; align-items: flex-end; padding: 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }.easel-scope .settings-overlay .tab { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 8px 12px 10px; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; border-radius: 8px 8px 0 0; background: none; color: var(--text-secondary); cursor: pointer; font: inherit; font-size: 13.5px; }.easel-scope .settings-overlay .tab:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .settings-overlay .tab.active { color: var(--accent-end); font-weight: 650; border-bottom-color: var(--accent-end); }.easel-scope .settings-overlay .tab .cdot { width: 7px; height: 7px; border-radius: 50%; background: #c3c4c8; }.easel-scope .settings-overlay .tab.active .cdot { background: var(--accent-end); }.easel-scope .settings-overlay .st-sec, .easel-scope .settings-overlay .st-panel { animation: st-fade .16s ease; }@keyframes st-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }.easel-scope .settings-overlay .panel-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }.easel-scope .settings-overlay .desc { color: var(--text-tertiary); font-size: 12.5px; }.easel-scope .settings-overlay .spacer { flex: 1; }.easel-scope .settings-overlay .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2.5px 10px; border-radius: 99px; font-weight: 500; white-space: nowrap; flex: none; }.easel-scope .settings-overlay .pill .dot { width: 8px; height: 8px; border-radius: 50%; }.easel-scope .settings-overlay .pill.ok { background: var(--green-soft); color: #15803d; }.easel-scope .settings-overlay .pill.ok .dot { background: var(--green); }.easel-scope .settings-overlay .pill.warn { background: var(--amber-soft); color: #b45309; }.easel-scope .settings-overlay .pill.warn .dot { background: var(--amber); }.easel-scope .settings-overlay .pill.off { background: var(--surface-hover); color: var(--text-secondary); }.easel-scope .settings-overlay .pill.off .dot { background: #c3c4c8; }.easel-scope .settings-overlay .pill.fail { background: var(--red-soft); color: #b91c1c; }.easel-scope .settings-overlay .pill.fail .dot { background: var(--red); }.easel-scope .settings-overlay .pill.sum { background: var(--accent-soft); color: var(--accent-end); font-weight: 650; }.easel-scope .settings-overlay .board { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: 0 1px 3px rgba(23,25,28,.05); overflow: hidden; }.easel-scope .settings-overlay .prow { display: grid; grid-template-columns: 50px .92fr .58fr 1.5fr 1.4fr .92fr 54px 80px 30px; gap: 11px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--border); }.easel-scope .settings-overlay .prow.head { padding: 8px 16px; color: var(--text-tertiary); font-size: 12px; }.easel-scope .settings-overlay .prow:last-child { border-bottom: none; }.easel-scope .settings-overlay .step { width: 24px; height: 24px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-end); font-weight: 700; font-size: 12.5px; display: inline-flex; align-items: center; justify-content: center; }.easel-scope .settings-overlay .step.ghost { background: var(--surface-hover); color: var(--text-secondary); }.easel-scope .settings-overlay .pname { font-weight: 600; display: flex; flex-direction: column; gap: 2px; }.easel-scope .settings-overlay .pname small { font-weight: 400; color: var(--text-tertiary); font-size: 11.5px; }.easel-scope .settings-overlay .cell-text { font-size: 12.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .settings-overlay .key-mask { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 11.5px; }.easel-scope .settings-overlay .tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 650; justify-self: start; }.easel-scope .settings-overlay .tag.main { background: var(--accent-soft); color: #2c4a8f; }.easel-scope .settings-overlay .tag.backup { background: var(--surface-hover); color: var(--text-secondary); }.easel-scope .settings-overlay .stt { font-size: 12.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .settings-overlay .stt.good { color: var(--green); }.easel-scope .settings-overlay .stt.bad { color: var(--red); }.easel-scope .settings-overlay .stt.warn-text { color: var(--amber); }.easel-scope .settings-overlay .empty { padding: 16px; color: var(--text-secondary); display: flex; align-items: center; gap: 10px; font-size: 13.5px; }.easel-scope .settings-overlay .hint { color: var(--text-tertiary); font-size: 12.5px; }.easel-scope .settings-overlay .foot-note { margin-top: 12px; color: var(--text-tertiary); font-size: 12.5px; }.easel-scope .settings-overlay .stub-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 13.5px; }.easel-scope .settings-overlay .stub-row:last-child { border-bottom: none; }.easel-scope .settings-overlay .stub-row .tag2 { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--surface-hover); color: var(--text-secondary); font-weight: 600; }.easel-scope .settings-overlay .stub-row .future { margin-left: auto; color: var(--text-tertiary); font-size: 12px; }.easel-scope .settings-overlay .env-error { margin: 0 0 12px; padding: 9px 12px; border: 1px solid var(--red-soft); background: var(--red-soft); color: #b91c1c; border-radius: 9px; font-size: 12.5px; }/* \u73AF\u5883\u5B89\u88C5\u9875 */.easel-scope .settings-overlay .st-env .grp { margin-bottom: 22px; }.easel-scope .settings-overlay .grp-hd { display: flex; align-items: center; gap: 9px; margin: 0 0 8px; }.easel-scope .settings-overlay .grp-hd h3 { font-size: 13px; margin: 0; font-weight: 700; }.easel-scope .settings-overlay .grp-hd .en { color: var(--text-tertiary); font-size: 11px; font-weight: 500; margin-top: 1px; }.easel-scope .settings-overlay .grp-stat { color: var(--text-tertiary); font-size: 11.5px; }.easel-scope .settings-overlay .grp-hd .btn { margin-left: auto; padding: 3px 10px; font-size: 11.5px; border-radius: 7px; }.easel-scope .settings-overlay .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }.easel-scope .settings-overlay .st-env .card { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 12px 13px 11px; display: flex; flex-direction: column; gap: 7px; transition: border-color .18s cubic-bezier(.22,1,.36,1), box-shadow .18s cubic-bezier(.22,1,.36,1); }.easel-scope .settings-overlay .st-env .card:hover { border-color: var(--border-strong); box-shadow: 0 6px 16px -8px rgba(23,25,28,.14); }.easel-scope .settings-overlay .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }.easel-scope .settings-overlay .card .tile { width: 32px; height: 32px; border-radius: 9px; background: var(--accent-soft); color: var(--accent-end); display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 0; border: 0; }.easel-scope .settings-overlay .card .tile svg { flex: none; }.easel-scope .settings-overlay .card[data-state=missing] .tile, .easel-scope .settings-overlay .card[data-state=nodir] .tile { background: var(--surface-hover); color: #9a9da6; }.easel-scope .settings-overlay .card[data-state=busy] .tile { background: var(--amber-soft); color: #b45309; }.easel-scope .settings-overlay .card[data-state=fail] .tile { background: var(--red-soft); color: #c02626; }.easel-scope .settings-overlay .badge.pill { font-size: 11.5px; padding: 2.5px 9px; border-radius: 99px; border: none; white-space: nowrap; flex: none; }.easel-scope .settings-overlay .badge.pill .dot { width: 7px; height: 7px; border-radius: 50%; }.easel-scope .settings-overlay .card-name { font-size: 13px; font-weight: 650; letter-spacing: .1px; line-height: 1.3; }.easel-scope .settings-overlay .card-desc { font-size: 12px; color: var(--text-tertiary); line-height: 1.5; min-height: 36px; }.easel-scope .settings-overlay .card-foot { display: flex; align-items: center; gap: 7px; margin-top: auto; min-height: 26px; }.easel-scope .settings-overlay .foot-status { font-size: 12px; color: var(--text-secondary); margin-right: auto; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }.easel-scope .settings-overlay .card[data-state=missing] .foot-status, .easel-scope .settings-overlay .card[data-state=nodir] .foot-status { color: var(--text-tertiary); }.easel-scope .settings-overlay .card[data-state=fail] .foot-status { color: var(--red); }.easel-scope .settings-overlay .card-foot .btn { padding: 4px 12px; font-size: 12.5px; border-radius: 7px; }.easel-scope .settings-overlay .card[data-state=busy] .card-foot .btn { background: var(--surface-hover); border-color: var(--border); color: var(--text-secondary); cursor: default; }.easel-scope .settings-overlay .btn-fill { background: var(--accent-end); border-color: var(--accent-end); color: #fff; }.easel-scope .settings-overlay .btn-fill:hover:not(:disabled) { background: #35498f; border-color: #35498f; }.easel-scope .settings-overlay .btn-primary { background: var(--accent-gradient); border: none; color: #fff; box-shadow: none; }.easel-scope .settings-overlay .btn-primary:hover:not(:disabled) { background: var(--accent-gradient); filter: brightness(1.12); box-shadow: 0 6px 20px rgba(23,25,28,.2); }.easel-scope .settings-overlay .prog { display: flex; flex: 1; align-items: center; gap: 7px; min-width: 0; }.easel-scope .settings-overlay .prog .bar { flex: 1; height: 5px; border-radius: 99px; background: #e9eaec; overflow: hidden; min-width: 40px; }.easel-scope .settings-overlay .prog .bar i { display: block; height: 100%; width: 40%; background: var(--accent-gradient); border-radius: 99px; animation: st-slide 1.1s cubic-bezier(.22,1,.36,1) infinite; }@keyframes st-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }.easel-scope .settings-overlay .spin { width: 11px; height: 11px; flex: none; border: 2px solid rgba(63,86,168,.45); border-top-color: var(--accent-end); border-radius: 50%; animation: st-spin .8s linear infinite; }@keyframes st-spin { to { transform: rotate(360deg); } }.easel-scope .settings-overlay .env-meter { height: 6px; border-radius: 99px; background: #e9eaec; overflow: hidden; margin: -2px 0 14px; }.easel-scope .settings-overlay .env-meter i { display: block; height: 100%; width: 100%; background: var(--accent-gradient); border-radius: 99px; transform: scaleX(0); transform-origin: left; transition: transform .5s cubic-bezier(.22,1,.36,1); }@media (prefers-reduced-motion: reduce) {.easel-scope .settings-overlay *, .easel-scope .settings-overlay *::before, .easel-scope .settings-overlay *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }}/* \u8BBE\u7F6E\u9762\u677F \xB7 v2\uFF1A\u5361\u7247\u4E25\u683C\u7B49\u5BBD\uFF08minmax(0,1fr) \u9632\u957F\u6587\u672C\u9876\u7834\u5217\u5BBD\uFF09+ \u53EF\u7F16\u8F91\u8F93\u5165 */.easel-scope .settings-overlay .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 1fr; }.easel-scope .settings-overlay .st-env .card { min-width: 0; }.easel-scope .settings-overlay input.mock { border: 1px solid var(--border); border-radius: 7px; padding: 6px 9px; font: inherit; font-size: 12.5px; background: var(--bg); color: var(--text); width: 100%; min-width: 0; }.easel-scope .settings-overlay input.mock:focus { outline: none; border-color: #9db3d8; box-shadow: 0 0 0 3px rgba(63, 86, 168, 0.10); }.easel-scope .settings-overlay input.mock[disabled] { background: var(--surface-2); color: var(--text-tertiary); }.easel-scope .settings-overlay .save-note { margin: 0 0 10px; padding: 7px 11px; border-radius: 8px; font-size: 12.5px; background: var(--green-soft); color: #15803d; }.easel-scope .settings-overlay .save-note.err { background: var(--red-soft); color: #b91c1c; }.easel-scope .settings-overlay button.tag { border: 0; cursor: pointer; font: inherit; font-size: 11px; font-weight: 650; }.easel-scope .settings-overlay button.tag:hover { filter: brightness(0.96); }.easel-scope .settings-overlay .add-row { display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: var(--accent-end); font-weight: 600; cursor: pointer; font-size: 13.5px; border: 1.5px dashed var(--border-strong); border-radius: 10px; background: var(--surface); margin-top: 8px; transition: all 0.15s ease; }.easel-scope .settings-overlay .add-row:hover { border-color: var(--accent-start); background: var(--accent-soft); }.easel-scope .settings-overlay .row-del { border: 0; background: none; color: var(--text-tertiary); cursor: pointer; font-size: 13px; padding: 4px; border-radius: 6px; line-height: 1; }.easel-scope .settings-overlay .row-del:hover { color: var(--red); background: var(--red-soft); }.easel-scope .settings-overlay .pname input.mock { font-size: 12px; padding: 5px 8px; }.easel-scope .settings-overlay .key-stack { display: flex; flex-direction: column; gap: 4px; min-width: 0; }.easel-scope .settings-overlay .cell-text.dim { opacity: .5; font-style: italic; }.easel-scope .settings-overlay .adv-btn {
  appearance: none; border: 1px solid var(--border); background: transparent;
  color: var(--text-tertiary); font-size: 11px; border-radius: 999px;
  padding: 1px 8px; cursor: pointer; white-space: nowrap;
}.easel-scope .settings-overlay .adv-btn:hover { color: var(--text); border-color: var(--text); }/* \u672C\u673A Agent \u533A\u5757\uFF08\u8BBE\u7F6E \u2192 \u5BF9\u8BDD\u4E0E\u811A\u672C\uFF09\uFF1A\u8D34\u5728\u672C\u673A\u88C5\u4E86 CLI agent \u7684\u63D0\u793A\u4E0E\u4E00\u952E\u63A5\u5165\u3002
   grid \u5BF9\u9F50\u4E0A\u9762\u7684 prow\uFF0C\u4F46\u5217\u6570\u66F4\u5C11\uFF08\u540D\u79F0/\u72B6\u6001/\u64CD\u4F5C/\u8BF4\u660E\uFF09\u3002 */.easel-scope .settings-overlay .local-agents { margin: 12px 0 0; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: 0 1px 3px rgba(23,25,28,.05); overflow: hidden; }.easel-scope .settings-overlay .la-head { display: flex; align-items: baseline; gap: 10px; font-size: 12.5px; font-weight: 600; padding: 9px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); }.easel-scope .settings-overlay .la-head .desc { font-weight: 400; color: var(--text-tertiary); }.easel-scope .settings-overlay .la-row { display: flex; gap: 12px; align-items: center; padding: 9px 16px; border-bottom: 1px solid var(--border); }.easel-scope .settings-overlay .la-name { flex: 0 0 180px; }.easel-scope .settings-overlay .la-state { flex: 0 0 auto; }.easel-scope .settings-overlay .la-act { display: flex; align-items: center; gap: 8px; flex: 0 0 300px; }.easel-scope .settings-overlay .la-hint { flex: 1 1 auto; }.easel-scope .settings-overlay .la-row:last-of-type { border-bottom: none; }.easel-scope .settings-overlay .la-row:hover { background: var(--surface-hover, var(--surface-2)); }.easel-scope .settings-overlay .la-name { display: flex; flex-direction: column; min-width: 0; font-size: 12.5px; }.easel-scope .settings-overlay .la-name small { color: var(--text-tertiary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.easel-scope .settings-overlay .la-state { font-size: 11px; text-align: center; border-radius: 999px; padding: 2px 8px; border: 1px solid var(--border); justify-self: start; }.easel-scope .settings-overlay .la-state.ok { color: var(--green); border-color: var(--green); background: color-mix(in srgb, var(--green) 8%, transparent); }.easel-scope .settings-overlay .la-model {
  width: 100%; max-width: 200px; font: inherit; font-size: 12px; padding: 4px 8px;
  border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg);
  color: inherit; cursor: pointer; transition: border-color .12s ease;
}.easel-scope .settings-overlay .la-model:hover { border-color: var(--text-tertiary); }.easel-scope .settings-overlay .la-model:focus { outline: none; border-color: var(--accent-end); }.easel-scope .settings-overlay .la-hint { font-size: 11px; color: var(--text-tertiary); min-width: 0; }/* \u6A21\u578B\u5217\uFF1A\u8F93\u5165\u6846 + \u300C\u62C9\u53D6\u300D\u6309\u94AE\u3002\u62C9\u53D6\u6210\u529F\u540E\u8F93\u5165\u6846\u4E0B\u65B9\u6D6E\u51FA\u81EA\u5B9A\u4E49\u4E0B\u62C9\u9762\u677F
   \uFF08\u539F\u751F datalist \u6837\u5F0F\u4E0D\u53EF\u63A7\u4E14\u9009\u4E2D\u540E\u65E0\u660E\u663E\u53CD\u9988\uFF09\uFF0C\u70B9\u9009\u9879\u586B\u5165\uFF0C\u9762\u677F\u5916\u70B9\u51FB\u5173\u95ED\u3002 */.easel-scope .settings-overlay .model-cell { display: flex; align-items: center; gap: 6px; min-width: 0; position: relative; }.easel-scope .settings-overlay .model-cell input.mock { min-width: 0; flex: 1 1 auto; }.easel-scope .settings-overlay .custom-model-cell { flex-wrap: wrap; }.easel-scope .settings-overlay .thinking-controls { flex: 1 0 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); }.easel-scope .settings-overlay .thinking-controls label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }.easel-scope .settings-overlay .thinking-controls input { accent-color: var(--accent-end); margin: 0; }.easel-scope .settings-overlay .thinking-controls select { min-width: 0; max-width: 100%; font-size: 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); }.easel-scope .settings-overlay .fetch-btn {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 3px 9px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary);
  cursor: pointer; white-space: nowrap; transition: color .12s ease, border-color .12s ease, background .12s ease;
}.easel-scope .settings-overlay .fetch-btn:hover:not(:disabled) { color: var(--accent-end); border-color: var(--accent-end); background: color-mix(in srgb, var(--accent-end) 6%, var(--surface)); }.easel-scope .settings-overlay .fetch-btn:disabled { opacity: .55; cursor: default; }.easel-scope .settings-overlay .fetch-btn.ok { color: var(--green); border-color: var(--green); padding: 3px 7px; }.easel-scope .settings-overlay .fetch-btn .spin { width: 10px; height: 10px; border-width: 1.5px; }.easel-scope .model-dd {
  z-index: 100; min-width: 240px; max-width: 380px;
  max-height: 240px; overflow: auto; padding: 4px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: 0 10px 28px -8px rgba(23,25,28,.25);
}.easel-scope .model-dd .dd-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 9px; border-radius: var(--radius-sm); font-size: 12px; cursor: pointer; color: var(--text);
}.easel-scope .model-dd .dd-item:hover, .easel-scope .model-dd .dd-item.active { background: var(--accent-soft); }.easel-scope .model-dd .dd-item small { color: var(--text-tertiary); font-size: 11px; }.easel-scope .model-dd .dd-empty { padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-tertiary); font-size: 12px; }.easel-scope .model-dd .dd-pull {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 4px 12px;
  border: 1px solid var(--accent-end); border-radius: var(--radius-sm); background: var(--accent-soft);
  color: var(--accent-end); cursor: pointer; font-weight: 500;
}.easel-scope .model-dd .dd-pull:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-end) 16%, var(--surface)); }.easel-scope .model-dd .dd-pull:disabled { opacity: .6; cursor: default; }.easel-scope .settings-overlay .model-cell .fetch-err { color: var(--red, #dc2626); font-size: 12px; flex: 0 0 auto; cursor: help; }/* \u81EA\u5B9A\u4E49\u4F9B\u5E94\u5546\u884C\u7684\u534F\u8BAE\u9009\u62E9\uFF1A\u4E0E\u884C\u5185 mock \u8F93\u5165\u540C\u98CE\u683C\uFF0C\u5BBD\u5EA6\u6536\u655B *//* \u534F\u8BAE\u89E6\u53D1\u5668\uFF1A\u4E0E\u884C\u5185 mock \u8F93\u5165\u540C\u6B3E\u5916\u6846\uFF0C\u70B9\u5F00\u6D6E\u5C42\u9009\u62E9\uFF08\u6D6E\u5C42\u590D\u7528 .model-dd \u89C6\u89C9\uFF09 */.easel-scope .proto-trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 6px;
  min-width: 0; width: 100%; padding: 6px 9px; font-size: 12.5px; cursor: pointer;
  border: 1px solid var(--border); border-radius: 7px; background: var(--bg);
  color: var(--text); position: relative; user-select: none;
}.easel-scope .proto-trigger:hover { border-color: #9db3d8; }.easel-scope .proto-trigger .proto-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/*
 * Apple design layer for the ported Easel pages.
 *
 * Authored in Easel's own stylesheet idiom \u2014 build.mjs runs this file through
 * the same scope-css transform as Easel's sheets and appends it AFTER them,
 * so every selector here wins by order at equal specificity.
 *
 * Design language: Apple's grouped-card system (macOS System Settings).
 * A quiet gray canvas, white cards with layered soft shadows, large tight
 * headlines, capsule controls, hairlines only inside cards, and exactly one
 * accent \u2014 the system blue. Easel's CSS variables are retokened first so the
 * ported components re-skin globally; the structural rules after that retouch
 * the noisy leftovers.
 *//* ---------- Light tokens (retoken Easel's palette) ---------- */.easel-scope {
  --bg: #f5f5f7;
  --bg-elev: #ffffff;
  --surface: #ffffff;
  --surface-2: #f5f5f7;
  --surface-hover: #ececed;
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.16);
  --text: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-tertiary: #86868b;
  --accent-start: #0071e3;
  --accent-end: #0071e3;
  --accent-soft: rgba(0, 113, 227, 0.1);
  --accent-gradient: linear-gradient(135deg, var(--accent-start), var(--accent-end));
  --accent-gradient-soft: #f5f5f7;
  --layer-discover: #0ea5e9;
  --layer-plan: #7c3aed;
  --layer-produce: #db2777;
  --layer-publish: #059669;
  --layer-attribute: #d97706;
  --layer-general: #64748b;
  --green: #248a3d;
  --trend-up: #248a3d;
  --trend-down: #d70015;
  --green-soft: rgba(52, 199, 89, 0.12);
  --amber: #b25000;
  --amber-soft: rgba(255, 149, 0, 0.12);
  --red: #d70015;
  --red-soft: rgba(255, 59, 48, 0.1);
  --code-bg: rgba(0, 0, 0, 0.05);
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --shadow-sm: 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 0 0 0.5px rgba(0, 0, 0, 0.05), 0 12px 40px rgba(0, 0, 0, 0.12);
  --glow: 0 0 0 3px rgba(0, 113, 227, 0.22);
  --ease: cubic-bezier(0.25, 0.1, 0.25, 1);
  --t-fast: 0.12s var(--ease);
  --t: 0.2s var(--ease);
}/* ---------- Dark tokens (host attribute drives the switch) ---------- */body[data-ds-dark-theme] .easel-scope {
  --bg: #000000;
  --bg-elev: #1c1c1e;
  --surface: #1c1c1e;
  --surface-2: #2c2c2e;
  --surface-hover: #323234;
  --border: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.24);
  --text: #f5f5f7;
  --text-secondary: #a1a1a6;
  --text-tertiary: #7c7c80;
  --accent-start: #0a84ff;
  --accent-end: #0a84ff;
  --accent-soft: rgba(10, 132, 255, 0.16);
  --accent-gradient: linear-gradient(135deg, var(--accent-start), var(--accent-end));
  --accent-gradient-soft: #2c2c2e;
  --layer-discover: #64c6f2;
  --layer-plan: #b69afa;
  --layer-produce: #f38dbd;
  --layer-publish: #64d3b0;
  --layer-attribute: #f1bd69;
  --layer-general: #a2b3c9;
  --green: #30d158;
  --trend-up: #30d158;
  --trend-down: #ff453a;
  --green-soft: rgba(48, 209, 88, 0.16);
  --amber: #ff9f0a;
  --amber-soft: rgba(255, 159, 10, 0.16);
  --red: #ff453a;
  --red-soft: rgba(255, 69, 58, 0.14);
  --code-bg: rgba(255, 255, 255, 0.07);
  --shadow-sm: 0 0 0 0.5px rgba(255, 255, 255, 0.06);
  --shadow-md: 0 0 0 0.5px rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 0 0 0.5px rgba(255, 255, 255, 0.08), 0 16px 48px rgba(0, 0, 0, 0.6);
  --glow: 0 0 0 3px rgba(10, 132, 255, 0.3);
}/* ---------- Base & typography ---------- */.easel-scope {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC",
    "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}.easel-scope::selection { background: rgba(0, 113, 227, 0.22); }.easel-scope::-webkit-scrollbar { width: 8px; height: 8px; }.easel-scope::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.35); border-radius: 4px; }.easel-scope::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.55); }/* Large headline: tight leading and negative tracking, per size */.easel-scope .page-title {
  font-size: 26px;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text);
}.easel-scope .page-subtitle {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
  letter-spacing: 0;
}.easel-scope .page-head { margin-bottom: 20px; }/* The canvas breathes: one rhythm of padding, content reads in a column */.easel-scope .page-scroll {
  padding: 28px 32px 48px;
  height: 100%;
  overflow-y: auto;
}/* ---------- Surfaces: the grouped card ---------- */.easel-scope .card, .easel-scope .dash-card, .easel-scope .pv-card, .easel-scope .idea-card, .easel-scope .gcard, .easel-scope .account-card, .easel-scope .cal-suggest {
  background: var(--surface);
  border: none;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--t), transform var(--t-fast);
}.easel-scope .card-hover:hover, .easel-scope .dash-stat.card-hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}.easel-scope .card-hover:active, .easel-scope .dash-quick-btn:active {
  transform: scale(0.98);
}/* Hairlines live only INSIDE cards, separating list rows */.easel-scope .trend-item + .trend-item, .easel-scope .dash-idea + .dash-idea, .easel-scope .dash-sched + .dash-sched, .easel-scope .dash-trend-group + .dash-trend-group {
  border-top: 0.5px solid var(--border);
}/* ---------- Buttons: capsule, filled or quiet ---------- */.easel-scope .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 16px;
  border: none;
  border-radius: 980px;
  background: var(--surface);
  box-shadow: inset 0 0 0 0.5px var(--border);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  cursor: pointer;
  transition: background var(--t-fast), transform var(--t-fast), opacity var(--t-fast);
}.easel-scope .btn:hover { background: var(--surface-2); }.easel-scope .btn:active { transform: scale(0.97); background: var(--border); }.easel-scope .btn:disabled { opacity: 0.4; cursor: default; transform: none; }.easel-scope .btn:focus-visible { outline: none; box-shadow: var(--glow); }.easel-scope .btn-primary {
  background: var(--accent-start);
  color: #ffffff;
}.easel-scope .btn-primary:hover { background: var(--accent-start); filter: brightness(1.08); }.easel-scope .btn-primary:active { filter: brightness(0.92); }.easel-scope .btn-ghost {
  background: transparent;
  color: var(--accent-start);
}.easel-scope .btn-ghost:hover { background: var(--accent-soft); }.easel-scope .btn-sm { padding: 5px 12px; font-size: 12.5px; }.easel-scope .btn-danger { color: var(--red); }/* ---------- Chips: capsules that select ---------- */.easel-scope .chip {
  padding: 5px 14px;
  border: none;
  border-radius: 980px;
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), transform var(--t-fast);
}.easel-scope .chip:hover { background: var(--surface-hover); color: var(--text); }.easel-scope .chip:active { transform: scale(0.96); }.easel-scope .chip.active {
  background: var(--accent-soft);
  color: var(--accent-start);
  font-weight: 600;
}/* ---------- Fields ---------- */.easel-scope .field, .easel-scope input[class], .easel-scope textarea[class], .easel-scope .persona-select {
  border-radius: var(--radius);
}.easel-scope .field, .easel-scope textarea.field {
  border: 0.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: 10px 12px;
  font-size: 13.5px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}.easel-scope .field:focus {
  outline: none;
  border-color: var(--accent-start);
  box-shadow: var(--glow);
}/* Native select popup: Chromium leaves the option list white while the closed
   control inherits --text (near-white in dark theme) \u2014 white on white. Re-state
   both sides on the list entries. */.easel-scope select.field option, .easel-scope select.field optgroup, .easel-scope select.field optgroup[label] {
  background: var(--surface);
  color: var(--text);
}/* ---------- Overlays: material, not just opacity ---------- */.easel-scope .overlay, .easel-scope .drawer-overlay, .easel-scope .settings-overlay {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}.easel-scope .modal, .easel-scope .drawer {
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  animation: popIn 0.18s var(--ease);
}/* ---------- Toast: capsule confirmation ---------- */.easel-scope .toast {
  border-radius: 980px;
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}/* ---------- Badges: quiet pills ---------- */.easel-scope .badge, .easel-scope .pv-badge {
  border-radius: 980px;
  border: none;
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
}.easel-scope .badge-ok, .easel-scope .pv-badge-ok {
  background: var(--green-soft);
  color: var(--green);
}/* ---------- Numbers: metrics align on tabular figures ---------- */.easel-scope .dash-stat-val, .easel-scope .ana-stat-val, .easel-scope .ana-metric-val {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}/* ---------- Dashboard specifics ---------- */.easel-scope .dash-quick-btn {
  border: none;
  border-radius: 980px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--text);
  transition: box-shadow var(--t), transform var(--t-fast), background var(--t-fast);
}.easel-scope .dash-quick-btn:hover { box-shadow: var(--shadow-md); }.easel-scope .dash-stat { cursor: pointer; }.easel-scope .dash-more {
  color: var(--accent-start);
  font-size: 12.5px;
  font-weight: 500;
}.easel-scope .dash-trend-item, .easel-scope .dash-idea {
  border-radius: 8px;
  transition: background var(--t-fast);
}.easel-scope .dash-trend-item:hover, .easel-scope .dash-idea:hover { background: var(--surface-2); }/* ---------- Trend radar ---------- */.easel-scope .trend-rank {
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
  font-weight: 600;
}.easel-scope .trend-rank.top { color: var(--accent-start); }.easel-scope .trend-title { color: var(--text); }.easel-scope .trend-save, .easel-scope .trend-use {
  border-radius: 980px;
  transition: background var(--t-fast), transform var(--t-fast);
}.easel-scope .trend-use {
  background: var(--accent-soft);
  color: var(--accent-start);
  font-size: 12px;
  font-weight: 500;
}.easel-scope .trend-use:hover { background: rgba(0, 113, 227, 0.18); }.easel-scope .trend-use:active { transform: scale(0.94); }/* Trend radar v2: badges, offline hint, watch card, cluster cards */.easel-scope .trend-badge { border-radius: 980px; font-weight: 600; letter-spacing: 0.1px; }.easel-scope .trend-badge-new { color: var(--accent-start); background: var(--accent-soft); }.easel-scope .trend-badge-up { color: var(--trend-up); background: color-mix(in srgb, var(--trend-up) 14%, transparent); }.easel-scope .trend-badge-down { color: var(--trend-down); background: color-mix(in srgb, var(--trend-down) 14%, transparent); }.easel-scope .trend-badge-watch, .easel-scope .trend-stale { color: var(--amber, #b45309); }.easel-scope .trend-age, .easel-scope .trend-more { font-size: 10.5px; color: var(--text-tertiary); }.easel-scope .trend-viewsep { background: var(--border-soft, var(--border)); }.easel-scope .trend-watch-card, .easel-scope .trend-cluster {
  padding: 14px 8px 10px;
  border-radius: var(--radius-lg, 18px);
}.easel-scope .trend-watch-key {
  border-radius: 980px;
  color: var(--accent-start);
  background: var(--accent-soft);
  font-weight: 650;
}.easel-scope .trend-watch-group + .trend-watch-group { border-top: 1px solid var(--border-soft, var(--border)); }.easel-scope .trend-chip { border-radius: 980px; background: var(--surface-2, var(--surface-hover)); color: var(--text-secondary); }.easel-scope .trend-cluster-head .trend-title { font-size: 13.5px; }.easel-scope .trend-plat { font-size: 10.5px; font-weight: 600; color: var(--text-secondary); }.easel-scope .idea-link { color: var(--accent-start); border-radius: 6px; }.easel-scope .idea-body-preview { line-height: 1.65; }/* ---------- Notices ---------- */.easel-scope .notice-error {
  border: none;
  border-radius: var(--radius);
  background: var(--red-soft);
  color: var(--red);
}/* ---------- Profile: rendered markdown reads like Apple docs ---------- */.easel-scope .profile-content { font-size: 14px; line-height: 1.65; }.easel-scope .profile-content h1, .easel-scope .profile-content h2 { letter-spacing: -0.015em; font-weight: 650; }.easel-scope .profile-content h2 {
  padding-bottom: 6px;
  border-bottom: 0.5px solid var(--border);
}/* ---------- Persona browser: inset grouped list + detail column ---------- */.easel-scope .persona-browser {
  display: flex;
  gap: 20px;
  height: 100%;
  padding: 28px 32px;
  overflow: hidden;
}.easel-scope .persona-list {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
}.easel-scope .persona-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 4px;
}.easel-scope .persona-list-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-secondary);
}.easel-scope .persona-groups {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}.easel-scope .persona-row {
  display: block;
  width: 100%;
  padding: 11px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast);
}.easel-scope .persona-row + .persona-row { border-top: 0.5px solid var(--border); }.easel-scope .persona-row:hover { background: var(--surface-2); }.easel-scope .persona-row:active { background: var(--surface-hover); }.easel-scope .persona-row.active { background: var(--accent-soft); }.easel-scope .persona-row.active .persona-row-name { color: var(--accent-start); }.easel-scope .persona-row-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}.easel-scope .persona-row-desc {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}.easel-scope .persona-row-static { cursor: default; }.easel-scope .persona-row-static:hover { background: none; }.easel-scope .persona-detail {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
}.easel-scope .persona-detail .profile-page { padding: 0; }/* ---------- Motion & accessibility floors ---------- */@media (prefers-reduced-motion: reduce) {.easel-scope, .easel-scope * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }.easel-scope .card-hover:hover { transform: none; }}@media (prefers-reduced-transparency: reduce) {.easel-scope .overlay, .easel-scope .drawer-overlay, .easel-scope .settings-overlay {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }.easel-scope .toast { backdrop-filter: none; -webkit-backdrop-filter: none; }}@media (prefers-contrast: more) {.easel-scope .card, .easel-scope .dash-card, .easel-scope .pv-card, .easel-scope .idea-card, .easel-scope .gcard, .easel-scope .account-card {
    box-shadow: inset 0 0 0 1px var(--border-strong);
  }}`;

// src/lib/shell.tsx
var import_react = require("react");

// src/lib/task.ts
var getServices = null;
var cwdResolver = null;
function configureTasks(cfg) {
  getServices = cfg.getServices;
  cwdResolver = cfg.cwd;
}
async function pushTask(prompt, opts = {}) {
  if (getServices === null || cwdResolver === null) throw new Error("task channel not configured");
  const services = getServices();
  if (services === null) throw new Error("session services absent");
  const { sessions, uiWorkspace } = services;
  const cwd = await cwdResolver();
  const home = cwd ? findWorkspaceByPath(cwd) : null;
  const id = home ? await sessions.create({ workspaceId: home.workspaceId }) : await sessions.create(cwd ? { cwd } : void 0);
  if (opts.open !== false) uiWorkspace.openSession(id);
  const selectModel = sessions.selectModel;
  if (opts.model !== void 0 && typeof selectModel === "function") {
    await selectModel.call(sessions, {
      sessionId: id,
      provider: opts.model.provider,
      model: opts.model.model
    }).catch(() => {
    });
  }
  const reference = sessions.retain(id, { source: "easelTask" });
  await reference.ready;
  const conversation = sessions.scope(id)?.get("conversation");
  if (conversation === void 0) {
    reference.release();
    throw new Error("conversation face unavailable in the session scope");
  }
  let conclude = () => {
  };
  const settled = new Promise((resolve) => {
    let closed = false;
    let unsubscribe = () => {
    };
    const onAbort = () => conclude("aborted");
    conclude = (verdict) => {
      if (closed) return;
      closed = true;
      unsubscribe();
      opts.signal?.removeEventListener("abort", onAbort);
      reference.release();
      resolve(verdict);
    };
    const session = reference.binding.session;
    let sawRunning = session.getSnapshot().running === true;
    unsubscribe = session.subscribe(() => {
      const snap = session.getSnapshot() ?? {};
      if (snap.running === true) {
        sawRunning = true;
        return;
      }
      if (sawRunning) return conclude("done");
      if (snap.promptError != null || snap.lastAgentError != null) return conclude("error");
    });
    opts.signal?.addEventListener("abort", onAbort, { once: true });
  });
  try {
    await conversation.send(prompt);
  } catch (error) {
    conclude("error");
    throw error;
  }
  return {
    sessionId: id,
    settled,
    abort() {
      try {
        const cancelling = conversation.cancel();
        if (cancelling && typeof cancelling.catch === "function") cancelling.catch(() => {
        });
      } catch {
      }
    }
  };
}
function getWorkspaceService() {
  return getServices?.()?.workspaces ?? null;
}
function projectRoot() {
  return cwdResolver ? cwdResolver() : Promise.resolve("");
}
function findWorkspaceByPath(pathOrRel) {
  const items = getWorkspaceService()?.list?.getSnapshot().items ?? [];
  if (items.length === 0) return null;
  const want = pathOrRel.replace(/\/+$/, "").replaceAll("\\", "/").toLowerCase();
  const match = items.find((view11) => {
    const p = view11.path.replaceAll("\\", "/").toLowerCase();
    return p === want || p.endsWith(`/${want}`);
  });
  return match ?? null;
}
async function resolveHomeWorkspaceId(projectDir) {
  if (projectDir) {
    const project = findWorkspaceByPath(projectDir);
    if (project) return project.workspaceId;
  }
  const root = await projectRoot();
  return root ? findWorkspaceByPath(root)?.workspaceId ?? null : null;
}

// src/lib/shell.tsx
function pageKey(view11) {
  return `easel.${view11}`;
}
function topicPrompt(title, projectDir, inProject = false, bodyPath) {
  const base = `\u56F4\u7ED5\u5F53\u524D\u70ED\u70B9\u300C${title}\u300D\uFF1A\u5148\u5224\u65AD\u5B83\u9002\u4E0D\u9002\u5408\u6211\u7684\u8D26\u53F7\u8D5B\u9053\uFF1B\u82E5\u5408\u9002\uFF0C\u7ED9 2-3 \u4E2A\u5DEE\u5F02\u5316\u7684\u4E8C\u521B\u89D2\u5EA6\uFF0C\u5E76\u628A\u4F60\u6700\u63A8\u8350\u7684\u90A3\u6761\u5199\u6210\u53EF\u76F4\u63A5\u53D1\u5E03\u7684\u6587\u6848\u521D\u7A3F\u3002`;
  const body = bodyPath ? `

\u8FD9\u6761\u70ED\u70B9\u7684\u6B63\u6587\u5DF2\u6293\u53D6\u5230\u5185\u5BB9\u5E93\uFF1A${bodyPath}\u3002\u5148\u8BFB\u5B83\u518D\u52A8\u7B14\uFF0C\u4E0D\u8981\u51ED\u6807\u9898\u81C6\u6D4B\u5185\u5BB9\u3002` : "";
  if (!projectDir) return `${base}${body}`;
  const project = inProject ? `

\u672C\u9879\u76EE\u5DF2\u7ACB\u9879\uFF1A\u5148\u8BFB \u9879\u76EE\u8D44\u6599.md\uFF08\u5C31\u5728\u5F53\u524D\u76EE\u5F55\uFF0C\u9009\u9898\u5361\u3001\u62C6\u89E3\u7D20\u6750\u3001\u753B\u50CF\u5FEB\u7167\u90FD\u5728\u91CC\u9762\uFF0C\u6309\u9700\u53C2\u8003\uFF09\uFF0C\u672C\u6B21\u521B\u4F5C\u7684\u811A\u672C/\u6587\u6848/\u6210\u7247\u7B49\u4EA7\u7269\u4E00\u5F8B\u5199\u5165\u5F53\u524D\u76EE\u5F55\uFF08\u9879\u76EE\u5DE5\u4F5C\u533A\uFF09\u3002` : `

\u672C\u9879\u76EE\u5DF2\u7ACB\u9879\uFF1A\u5148\u8BFB ${projectDir}/\u9879\u76EE\u8D44\u6599.md\uFF08\u9009\u9898\u5361\u3001\u62C6\u89E3\u7D20\u6750\u3001\u753B\u50CF\u5FEB\u7167\u90FD\u5728\u91CC\u9762\uFF0C\u6309\u9700\u53C2\u8003\uFF09\uFF0C\u672C\u6B21\u521B\u4F5C\u7684\u811A\u672C/\u6587\u6848/\u6210\u7247\u7B49\u4EA7\u7269\u4E00\u5F8B\u5199\u5165 ${projectDir}/ \u76EE\u5F55\u3002`;
  return `${base}${body}${project}`;
}
function createShell() {
  let state = { persona: "", personas: [], gatewayStatus: "connecting", apiDirect: false };
  const readers = /* @__PURE__ */ new Set();
  const notify = () => readers.forEach((r) => r());
  const refresh = () => {
    fetch("/easel/api/status", { headers: { accept: "application/json" } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))).then((data) => {
      const personas = data.personas ?? [];
      const persona = personas.some((p) => p.name === state.persona) ? state.persona : personas[0]?.name ?? "";
      state = {
        persona,
        personas,
        gatewayStatus: data.gateway ? "connected" : "disconnected",
        apiDirect: data.transport === "api"
      };
      notify();
    }).catch(() => {
      state = { ...state, gatewayStatus: "disconnected" };
      notify();
    });
  };
  return {
    refresh,
    setPersona: (persona) => {
      state = { ...state, persona };
      notify();
    },
    subscribe: (notifyFn) => {
      readers.add(notifyFn);
      return () => {
        readers.delete(notifyFn);
      };
    },
    snapshot: () => state
  };
}
function createShellBridge(ctx, t) {
  const shell = createShell();
  shell.refresh();
  const navigate = (page) => {
    const layout = ctx.get("layout");
    if (layout === void 0) throw new Error("dsh-plugin-easel: the layout service is absent; cannot navigate");
    layout.selectPanel(page === "chat" ? "conversation" : pageKey(page));
  };
  const useTopic = (title, projectDir, bodyPath) => {
    const fallbackPrompt = topicPrompt(title, projectDir);
    const clipboardFallback = () => {
      void navigator.clipboard?.writeText(fallbackPrompt).catch(() => {
      });
      navigate("chat");
    };
    try {
      const sessions = ctx.get("sessions");
      const uiWorkspace = ctx.get("uiWorkspace");
      if (sessions === void 0 || uiWorkspace === void 0) throw new Error("session services absent");
      void (async () => {
        const project = projectDir ? findWorkspaceByPath(projectDir) : null;
        const homeId = project?.workspaceId ?? await resolveHomeWorkspaceId();
        const bodyPrompt = await bodyPromptLine(bodyPath);
        const prompt = topicPrompt(title, projectDir, project !== null, bodyPrompt);
        const id = homeId ? await sessions.create({ workspaceId: homeId }) : await sessions.create();
        uiWorkspace.openSession(id);
        await sessions.using(id, { source: "easelTopic" }, async () => {
          const scoped = sessions.scope(id);
          const conversation = scoped?.get("conversation");
          if (conversation === void 0) throw new Error("conversation face unavailable in the session scope");
          await conversation.send(prompt);
        });
      })().catch(clipboardFallback);
    } catch {
      clipboardFallback();
    }
  };
  const bodyPromptLine = async (bodyPath) => {
    if (!bodyPath) return void 0;
    const root = await projectRoot();
    if (!root) return void 0;
    return `${root.replace(/[\\/]+$/, "")}/${bodyPath}`;
  };
  const storedMode = localStorage.getItem("easel.workspace.mode");
  globalThis.__easelWorkspaceUIMode = storedMode === "full" ? "full" : "single";
  configureTasks({
    getServices: () => {
      const sessions = ctx.get("sessions");
      const uiWorkspace = ctx.get("uiWorkspace");
      const workspaces = ctx.get("workspaces");
      return sessions !== void 0 && uiWorkspace !== void 0 ? { sessions, uiWorkspace, workspaces: workspaces ?? void 0 } : null;
    },
    cwd: () => fetch("/easel/api/status", { headers: { accept: "application/json" } }).then((r) => r.ok ? r.json() : null).then((data) => data?.projectRoot ?? "").catch(() => "")
  });
  const ensureHomeWorkspace = async () => {
    const root = await projectRoot();
    if (!root) return false;
    if (findWorkspaceByPath(root)) return true;
    await getWorkspaceService()?.create({ path: root }).catch(() => {
    });
    return true;
  };
  const ensureHomeAttempt = (attempt) => {
    void ensureHomeWorkspace().then((resolved) => {
      if (!resolved && attempt < 2) setTimeout(() => ensureHomeAttempt(attempt + 1), 8e3);
    });
  };
  setTimeout(() => ensureHomeAttempt(0), 2e3);
  const useShellProps = () => {
    const snap = (0, import_react.useSyncExternalStore)(shell.subscribe, shell.snapshot);
    return {
      persona: snap.persona,
      personas: snap.personas,
      onPersonaChange: shell.setPersona,
      gatewayStatus: snap.gatewayStatus,
      apiDirect: snap.apiDirect,
      onNavigate: navigate,
      onUseTopic: useTopic,
      jumpPath: "",
      onJumpHandled: () => {
      },
      onDeleted: () => shell.refresh(),
      onRefresh: shell.refresh,
      remote: ctx.remote
    };
  };
  return { useShellProps, navigate, useTopic, t, refresh: shell.refresh, setPersona: shell.setPersona };
}

// src/features/dashboard.tsx
var dashboard_exports = {};
__export(dashboard_exports, {
  Component: () => Component,
  Icon: () => Icon,
  labels: () => labels,
  order: () => order,
  plugin: () => plugin,
  view: () => view
});

// src/components/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var svg = (size = 18, sw = 1.8) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round"
});
var IconChat = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) });
var IconSkills = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m12 3-1.6 4.9a2 2 0 0 1-1.3 1.3L4.2 10.8l4.9 1.6a2 2 0 0 1 1.3 1.3L12 18.6l1.6-4.9a2 2 0 0 1 1.3-1.3l4.9-1.6-4.9-1.6a2 2 0 0 1-1.3-1.3z" }) });
var IconOutputs = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" }) });
var IconAccounts = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7.5", cy: "15.5", r: "4.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10.7 12.3 9.3-9.3" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m17 5 3 3" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m15 7 3 3" })
] });
var IconProfile = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "7", r: "4" })
] });
var IconStop = ({ size, className }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size), className, fill: "currentColor", stroke: "none", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2.5" }) });
var IconCopy = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
] });
var IconCheck = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6 9 17l-5-5" }) });
var IconEdit = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 20h9" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" })
] });
var IconRetry = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 3v5h-5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 16H3v5" })
] });
var IconTrash = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 6h18" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
] });
var IconChevron = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m9 18 6-6-6-6" }) });
var IconVideo = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2", y: "4", width: "20", height: "16", rx: "2.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 9h20M7 4v5M17 4v5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10.5 12.5 3.5 2-3.5 2z", fill: "currentColor", stroke: "none" })
] });
var IconImage = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "9", cy: "9", r: "1.8" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20" })
] });
var IconMusic = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 18V5l12-2v13" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "18", cy: "16", r: "3" })
] });
var IconMic = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9", y: "2", width: "6", height: "12", rx: "3" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 19v3" })
] });
var IconText = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 7V5h16v2" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 20h6" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 5v15" })
] });
var IconChart = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 3v18h18" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 17V9" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 17V5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 17v-3" })
] });
var IconSend = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m22 2-7 20-4-9-9-4Z" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M22 2 11 13" })
] });
var IconSearch = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "11", cy: "11", r: "8" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m21 21-4.3-4.3" })
] });
var IconCompass = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m16.2 7.8-2.1 6.4-6.4 2.1 2.1-6.4z" })
] });
var IconLayout = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 9h18M9 21V9" })
] });
var IconLayers = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m12 2 9 5-9 5-9-5z" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m3 12 9 5 9-5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m3 17 9 5 9-5" })
] });
var IconFile = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 2v5h5" })
] });
var IconRefresh = IconRetry;
var IconFolder = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" }) });
var IconDashboard = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "7", height: "9", rx: "1.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "14", y: "3", width: "7", height: "5", rx: "1.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "14", y: "12", width: "7", height: "9", rx: "1.5" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "16", width: "7", height: "5", rx: "1.5" })
] });
var IconFire = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" }) });
var IconCalendar = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 10h18M8 2v4M16 2v4" })
] });
var IconIdea = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 18h6" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 22h4" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" })
] });
var IconBookmark = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...svg(size, strokeWidth), className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" }) });
var IconPublish = ({ size, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...svg(size, strokeWidth), className, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m3 11 18-5v12L3 14v-3z" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M11.6 16.8a3 3 0 1 1-5.8-1.6" })
] });

// src/components/DashboardPage.tsx
var import_react2 = require("react");

// src/lib/api.ts
var BASE = "/easel";
async function request(url, options) {
  const res = await fetch(`${BASE}${url}`, { cache: "no-store", ...options });
  if (!res.ok) {
    let detail = "";
    try {
      const j2 = await res.json();
      detail = j2 && (j2.detail || j2.message) || "";
    } catch {
    }
    throw new Error(detail || `\u8BF7\u6C42\u5931\u8D25\uFF08${res.status} ${res.statusText}\uFF09`);
  }
  return res.json();
}
function fetchPersonaFiles(name) {
  return request(`/api/persona/${encodeURIComponent(name)}/files`);
}
function savePersonaFile(name, filename, content) {
  return request(`/api/persona/${encodeURIComponent(name)}/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content })
  });
}
function deletePersona(name) {
  return request(`/api/persona/${encodeURIComponent(name)}`, { method: "DELETE" });
}
function fetchTrends(platforms, limit = 12, options = {}) {
  const params = new URLSearchParams({ platforms, limit: String(limit) });
  if (options.view) params.set("view", options.view);
  if (options.force) params.set("force", "1");
  return request(`/api/trends?${params}`);
}
function captureTrendArticle(input) {
  return request("/api/radar/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
function fetchHandoffPaired() {
  return request("/api/handoff/status");
}
function pushFileToPeer(peerId, path) {
  return request("/api/handoff/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peerId, path })
  });
}
function fetchSchedule() {
  return request("/api/schedule");
}
function fetchScheduleContext(days = 14) {
  return request(`/api/schedule/context?days=${days}`);
}
function createSchedule(item) {
  return request("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });
}
function updateSchedule(id, item) {
  return request(`/api/schedule/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });
}
function deleteSchedule(id) {
  return request(`/api/schedule/${encodeURIComponent(id)}`, { method: "DELETE" });
}
function fetchCaldavAccounts() {
  return request("/api/caldav/accounts");
}
function putCaldavAccounts(accounts) {
  return request("/api/caldav/accounts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accounts })
  });
}
function discoverCaldav(id, creds) {
  return request(`/api/caldav/accounts/${encodeURIComponent(id)}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds)
  });
}
function syncCaldav(id) {
  return request(`/api/caldav/accounts/${encodeURIComponent(id)}/sync`, { method: "POST" });
}
function fetchCaldavEvents() {
  return request("/api/caldav/events");
}
function fetchIdeas() {
  return request("/api/ideas");
}
function createIdea(item) {
  return request("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
}
function updateIdea(id, item) {
  return request(`/api/ideas/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
}
function deleteIdea(id) {
  return request(`/api/ideas/${encodeURIComponent(id)}`, { method: "DELETE" });
}
function fetchSkills() {
  return request("/api/skills");
}
function fetchSkillDetail(name) {
  return request(`/api/skill/${encodeURIComponent(name)}`);
}
function saveEnv(updates) {
  return request("/api/env", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates })
  });
}
function buildProfile(name, form) {
  return request("/api/profile/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, form })
  });
}
function fetchOutputs() {
  return request("/api/outputs");
}
function fetchOutputContent(path) {
  return request(`/api/output/${path.split("/").map(encodeURIComponent).join("/")}`);
}
function mediaUrl(path) {
  return `${BASE}/api/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
function deleteOutput(path) {
  return request(`/api/output/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
}
function getCredentials(platform) {
  return request(`/api/accounts/${encodeURIComponent(platform)}/credentials`);
}
function saveCredentials(platform, payload) {
  return request(`/api/accounts/${encodeURIComponent(platform)}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
function startMpLogin(platform) {
  return request(`/api/accounts/${encodeURIComponent(platform)}/mp-login`, { method: "POST" });
}
function mpLoginStatus(platform) {
  return request(`/api/accounts/${encodeURIComponent(platform)}/mp-login/status`);
}
function fetchAccounts() {
  return request("/api/accounts");
}
function accountWhoami(platform) {
  return request(`/api/accounts/${encodeURIComponent(platform)}/whoami`);
}
function logoutAccount(platform) {
  return request(`/api/logout/${encodeURIComponent(platform)}`, { method: "POST" });
}
function publishNow(platform, payload) {
  return request(`/api/publish/${encodeURIComponent(platform)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
function publishStatus(platform) {
  return request(`/api/publish/${encodeURIComponent(platform)}/status`);
}
function submitPublishSms(platform, code2) {
  return request(`/api/publish/${encodeURIComponent(platform)}/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code2 })
  });
}
function startLogin(platform, mode = "qr") {
  return request(`/api/login/${encodeURIComponent(platform)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode })
  });
}
function fetchRadarConfig() {
  return request("/api/radar/config");
}
function saveRadarConfig(cfg) {
  return request("/api/radar/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cfg)
  });
}
function loginStatus(platform) {
  return request(`/api/login/${encodeURIComponent(platform)}/status`);
}
function fetchAnalyticsPlatforms() {
  return request("/api/analytics/platforms");
}
function fetchAccountAnalytics(platform) {
  return request(`/api/analytics/${encodeURIComponent(platform)}`);
}
function submitLoginSms(platform, code2) {
  return request(`/api/login/${encodeURIComponent(platform)}/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code2 })
  });
}
async function fetchStatus() {
  return request("/api/status").catch(() => null);
}
function projectizeTopic(body) {
  return request("/api/projectize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// src/lib/whoami.ts
var KEY = "easel_whoami";
var WHOAMI_TTL_MS = 6e5;
function getWhoamiCache() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function setWhoamiCache(platform, r) {
  try {
    const c = getWhoamiCache();
    if (r) c[platform] = { ...r, ts: Date.now() };
    else delete c[platform];
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
  }
}
function isFresh(e, ttlMs) {
  return !!e && typeof e.ts === "number" && Date.now() - e.ts < ttlMs;
}
var WHOAMI_CONCURRENCY = 2;
function verifyStale(platforms, opts = {}) {
  const ttlMs = opts.ttlMs ?? WHOAMI_TTL_MS;
  const cache = getWhoamiCache();
  const todo = opts.force ? platforms : platforms.filter((p) => !isFresh(cache[p], ttlMs));
  if (!todo.length) return;
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      if (opts.alive && !opts.alive()) return;
      const p = todo[next++];
      try {
        const r = await accountWhoami(p);
        setWhoamiCache(p, r);
        if (!opts.alive || opts.alive()) opts.onUpdate?.(p, r);
      } catch {
      }
    }
  };
  void Promise.all(
    Array.from({ length: Math.min(WHOAMI_CONCURRENCY, todo.length) }, () => worker())
  );
}

// src/components/DashboardPage.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function fmtNum(n) {
  if (n == null) return "\u2014";
  const a = Math.abs(n);
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e5 ? 0 : 1) + "\u4E07";
  return String(n);
}
function growthInfo(n) {
  if (n == null || n === 0) return null;
  return n > 0 ? { text: `\u25B2+${fmtNum(n)}`, color: "var(--trend-up)" } : { text: `\u25BC${fmtNum(Math.abs(n))}`, color: "var(--trend-down)" };
}
var STATUS_LABEL = { idea: "\u9009\u9898", draft: "\u8349\u7A3F", scheduled: "\u5F85\u53D1", published: "\u5DF2\u53D1" };
function DashboardPage({ persona, gatewayStatus, apiDirect, onNavigate, onUseTopic }) {
  const [trends, setTrends] = (0, import_react2.useState)([]);
  const [schedule, setSchedule] = (0, import_react2.useState)([]);
  const [outputs, setOutputs] = (0, import_react2.useState)([]);
  const [accounts, setAccounts] = (0, import_react2.useState)([]);
  const [ideas, setIdeas] = (0, import_react2.useState)([]);
  const [anaPlats, setAnaPlats] = (0, import_react2.useState)([]);
  const [anaSel, setAnaSel] = (0, import_react2.useState)("");
  const [anaData, setAnaData] = (0, import_react2.useState)(() => {
    try {
      return JSON.parse(localStorage.getItem("easel_analytics") || "{}");
    } catch {
      return {};
    }
  });
  const [anaWin, setAnaWin] = (0, import_react2.useState)("week");
  const [whoamiMap, setWhoamiMap] = (0, import_react2.useState)(() => getWhoamiCache());
  (0, import_react2.useEffect)(() => {
    fetchTrends("weibo,douyin", 6).then((d2) => setTrends(d2.trends)).catch(() => {
    });
    fetchSchedule().then(setSchedule).catch(() => {
    });
    fetchOutputs().then(setOutputs).catch(() => {
    });
    fetchAccounts().then(setAccounts).catch(() => {
    });
    fetchIdeas().then(setIdeas).catch(() => {
    });
    fetchAnalyticsPlatforms().then((ps) => {
      setAnaPlats(ps);
      const cache = getWhoamiCache();
      const isLog = (p) => p.loggedIn || !!cache[p.platform]?.loggedIn;
      const first = ps.find(isLog);
      if (first) setAnaSel((s) => s || first.platform);
      const API_BASED = /* @__PURE__ */ new Set(["bilibili", "wechat-oa"]);
      verifyStale(ps.filter((p) => !API_BASED.has(p.platform)).map((p) => p.platform), {
        onUpdate: (platform, r) => {
          setWhoamiMap((m2) => ({ ...m2, [platform]: r }));
          if (r.loggedIn) setAnaSel((s) => s || platform);
        }
      });
    }).catch(() => {
    });
  }, []);
  const runAna = (platform) => {
    setAnaSel(platform);
    setAnaData((d2) => ({ ...d2, [platform]: "loading" }));
    fetchAccountAnalytics(platform).then((r) => setAnaData((d2) => {
      const next = { ...d2, [platform]: r };
      try {
        localStorage.setItem("easel_analytics", JSON.stringify(next));
      } catch {
      }
      return next;
    })).catch(() => setAnaData((d2) => ({ ...d2, [platform]: "error" })));
  };
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const greet = hour < 6 ? "\u591C\u6DF1\u4E86" : hour < 12 ? "\u4E0A\u5348\u597D" : hour < 14 ? "\u4E2D\u5348\u597D" : hour < 18 ? "\u4E0B\u5348\u597D" : "\u665A\u4E0A\u597D";
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const upcoming = [...schedule].filter((s) => s.date >= todayStr && s.status !== "published").sort((a, b2) => (a.date + a.time).localeCompare(b2.date + b2.time)).slice(0, 5);
  const recent = outputs.slice(0, 5);
  const pendingIdeas = ideas.filter((i) => i.status === "pending");
  const loggedIn = accounts.filter((a) => a.loggedIn).length;
  const quick = [
    { label: "\u5F00\u59CB\u5BF9\u8BDD", page: "chat", Icon: IconChat },
    { label: "\u770B\u70ED\u70B9", page: "trends", Icon: IconFire },
    { label: "\u62C6\u7206\u6B3E", page: "breakdown", Icon: IconSkills },
    { label: "\u8BB0\u9009\u9898", page: "ideas", Icon: IconIdea },
    { label: "\u6392\u65E5\u5386", page: "calendar", Icon: IconCalendar },
    { label: "\u53BB\u53D1\u5E03", page: "publish", Icon: IconPublish }
  ];
  const stats = [
    { label: "\u5F85\u505A\u9009\u9898", value: String(pendingIdeas.length), page: "ideas", Icon: IconIdea },
    { label: "\u5F85\u53D1\u6392\u671F", value: String(upcoming.length), page: "calendar", Icon: IconCalendar },
    { label: "\u5185\u5BB9\u9879\u76EE", value: String(outputs.length), page: "outputs", Icon: IconOutputs },
    { label: "\u5DF2\u767B\u5F55\u8D26\u53F7", value: `${loggedIn}/${accounts.length}`, page: "accounts", Icon: IconAccounts }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "page-scroll dash-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-hero", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h1", { className: "page-title", style: { fontSize: 26, margin: 0 }, children: [
          greet,
          " \u{1F44B}"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "select",
          {
            className: "field",
            style: { width: "auto", padding: "4px 8px", fontSize: 12.5 },
            title: "\u804A\u5929\u65B9\u5F0F\uFF1A\u5355\u5DE5\u4F5C\u533A\uFF08\u4E3B\u9879\u76EE+\u7ACB\u9879\uFF09\u6216 dsh \u539F\u751F\u591A\u5DE5\u4F5C\u533A",
            value: localStorage.getItem("easel.workspace.mode") ?? "single",
            onChange: (e) => {
              localStorage.setItem("easel.workspace.mode", e.target.value);
              globalThis.__easelWorkspaceUIMode = e.target.value;
              location.reload();
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "single", children: "\u804A\u5929\u65B9\u5F0F\uFF1A\u5355\u5DE5\u4F5C\u533A\uFF08\u4E3B\u9879\u76EE+\u7ACB\u9879\uFF09" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "full", children: "\u804A\u5929\u65B9\u5F0F\uFF1A\u5B8C\u6574\u591A\u5DE5\u4F5C\u533A" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "page-subtitle", children: [
        apiDirect ? gatewayStatus === "connected" ? "API \u76F4\u8FDE\u5DF2\u914D\u7F6E\uFF0C\u53EF\u5F00\u59CB\u5BF9\u8BDD\u3002" : "\u8BF7\u5148\u914D\u7F6E API \u76F4\u8FDE\u901A\u9053\u3002" : gatewayStatus === "connected" ? "\u4E00\u5207\u5C31\u7EEA\u3002" : "\u26A0 \u7F51\u5173\u672A\u8FDE\u63A5\u3002",
        persona ? ` \u5F53\u524D\u753B\u50CF\u300C${persona}\u300D\u3002` : " \u901A\u7528\u6A21\u5F0F\u2014\u2014\u6307\u5B9A\u753B\u50CF\u6548\u679C\u66F4\u597D\u3002",
        "\u4ECE\u70ED\u70B9\u5230\u53D1\u5E03\uFF0C\u4E00\u7AD9\u5F0F\u641E\u5B9A\u4ECA\u5929\u7684\u5185\u5BB9\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-quick", children: quick.map((q2) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { className: "dash-quick-btn", onClick: () => onNavigate(q2.page), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(q2.Icon, { size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: q2.label })
      ] }, q2.page)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-stats", children: stats.map((s) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { className: "card card-hover dash-stat", onClick: () => onNavigate(s.page), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-stat-ic", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(s.Icon, { size: 18 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-stat-val", children: s.value }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-stat-label", children: s.label })
    ] }, s.label)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "card dash-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconFire, { size: 16 }),
            " \u4ECA\u65E5\u70ED\u70B9"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dash-more", onClick: () => onNavigate("trends"), children: "\u70ED\u70B9\u96F7\u8FBE \u2192" })
        ] }),
        trends.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u70ED\u70B9\u52A0\u8F7D\u4E2D / \u9700\u914D\u7F6E\u4EE3\u7406" }),
        trends.map((g) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-trend-group", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-trend-plat", children: g.label }),
          g.items.slice(0, 3).map((it, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-trend-item", title: `${it.title}\uFF08\u70B9\u51FB\u505A\u6210\u5185\u5BB9\uFF09`, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-trend-title", onClick: () => onUseTopic(it.title), children: it.title }) }, i))
        ] }, g.platform))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "card dash-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconIdea, { size: 16 }),
            " \u9009\u9898\u5E93 \xB7 \u5F85\u505A"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dash-more", onClick: () => onNavigate("ideas"), children: "\u5168\u90E8 \u2192" })
        ] }),
        pendingIdeas.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u8FD8\u6CA1\u6512\u9009\u9898\uFF0C\u53BB\u70ED\u70B9\u96F7\u8FBE\u6536\u85CF\u51E0\u4E2A\u5427" }),
        pendingIdeas.slice(0, 5).map((it) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-idea", onClick: () => onUseTopic(it.title), title: "\u70B9\u51FB\u505A\u6210\u5185\u5BB9", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-idea-title", children: it.title }),
          it.source && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "badge", children: it.source })
        ] }, it.id))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "card dash-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconCalendar, { size: 16 }),
            " \u8FD1\u671F\u6392\u671F"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dash-more", onClick: () => onNavigate("calendar"), children: "\u65E5\u5386 \u2192" })
        ] }),
        upcoming.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u6682\u65E0\u6392\u671F\uFF0C\u53BB\u65E5\u5386\u5B89\u6392\u4E00\u6761\u5427" }),
        upcoming.map((s) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-sched", onClick: () => onNavigate("calendar"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-sched-date", children: s.date.slice(5) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dash-sched-title", children: [
            s.platform ? `[${s.platform}] ` : "",
            s.title
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "badge", children: STATUS_LABEL[s.status] || s.status })
        ] }, s.id))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "card dash-card dash-card-top", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconOutputs, { size: 16 }),
            " \u6700\u8FD1\u4EA7\u7269"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dash-more", onClick: () => onNavigate("outputs"), children: "\u5185\u5BB9\u5E93 \u2192" })
        ] }),
        recent.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u8FD8\u6CA1\u6709\u4EA7\u7269\uFF0C\u53BB\u5BF9\u8BDD\u751F\u6210\u7B2C\u4E00\u6761\u5427" }),
        recent.map((g) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-output", onClick: () => onNavigate("outputs"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dash-output-name", children: g.meta?.title || g.name }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "badge", children: g.meta?.platform || (g.type === "dir" ? `${g.fileCount ?? 0} \u6587\u4EF6` : "\u5355\u6587\u4EF6") })
        ] }, g.name))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "card dash-card dash-card-wide", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dash-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconAccounts, { size: 16 }),
            " \u521B\u4F5C\u6570\u636E"
          ] }),
          anaSel && anaData[anaSel] && anaData[anaSel] !== "loading" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dash-more", onClick: () => runAna(anaSel), children: "\u5237\u65B0 \u2192" })
        ] }),
        (() => {
          const logged = anaPlats.filter((p) => p.loggedIn || whoamiMap[p.platform]?.loggedIn);
          if (anaPlats.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u52A0\u8F7D\u4E2D / \u9700\u914D\u7F6E\u4EE3\u7406" });
          if (logged.length === 0) {
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", onClick: () => onNavigate("accounts"), style: { cursor: "pointer" }, children: "\u53BB\u8D26\u53F7\u9875\u767B\u5F55\u540E\uFF0C\u8FD9\u91CC\u770B\u5404\u5E73\u53F0\u7C89\u4E1D / \u83B7\u8D5E / \u5173\u6CE8\u3001\u589E\u957F\u8D8B\u52BF\u4E0E\u6700\u65B0\u7B14\u8BB0 \u2192" });
          }
          const d2 = anaSel ? anaData[anaSel] : void 0;
          const WIN = [
            ["last", "\u8F83\u4E0A\u6B21"],
            ["day", "\u8F83\u6628\u65E5"],
            ["week", "\u8F83\u4E0A\u5468"],
            ["month", "\u8F83\u4E0A\u6708"],
            ["year", "\u8F83\u53BB\u5E74"]
          ];
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-plats", children: logged.map((p) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                className: `chip ${anaSel === p.platform ? "active" : ""}`,
                onClick: () => runAna(p.platform),
                children: p.name
              },
              p.platform
            )) }),
            !d2 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u70B9\u4E0A\u65B9\u5E73\u53F0\u67E5\u770B\u8BE5\u8D26\u53F7\u6570\u636E" }),
            d2 === "loading" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "loading", style: { padding: "28px 0" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "spinner" }),
              "\u6293\u53D6\u4E2D\u2026\uFF08\u8D77\u6D4F\u89C8\u5668\uFF0C\u7EA6\u6570\u79D2\uFF09"
            ] }),
            d2 === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", style: { color: "var(--red)" }, children: "\u6293\u53D6\u5931\u8D25\uFF08\u672A\u767B\u5F55 / \u9700\u771F\u673A\u6821\u51C6\uFF09\uFF0C\u70B9\u5E73\u53F0\u91CD\u8BD5" }),
            d2 && d2 !== "loading" && d2 !== "error" && (!d2.loggedIn ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", onClick: () => onNavigate("accounts"), style: { cursor: "pointer" }, children: "\u8BE5\u5E73\u53F0\u767B\u5F55\u6001\u5DF2\u5931\u6548\uFF0C\u53BB\u8D26\u53F7\u9875\u91CD\u767B \u2192" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-body", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-col ana-col-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-id", children: d2.nickname ? `@${d2.nickname}` : d2.name }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-overview", children: [["\u7C89\u4E1D", "followers"], ["\u83B7\u8D5E", "likes"], ["\u5173\u6CE8", "following"]].map(([label2, key]) => {
                  const w2 = d2.growth?.[anaWin] ?? null;
                  const g = w2 ? growthInfo(w2[key]) : null;
                  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-stat", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-stat-val", children: fmtNum(d2[key]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-stat-label", children: label2 }),
                    g ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-stat-delta", style: { color: g.color }, children: g.text }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-stat-delta ana-muted", children: "\u2014" })
                  ] }, key);
                }) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-wins", children: WIN.map(([k2, lab]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    className: `ana-win ${anaWin === k2 ? "on" : ""}`,
                    onClick: () => setAnaWin(k2),
                    children: lab
                  },
                  k2
                )) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-wins-note", children: d2.growth?.[anaWin]?.since_days != null ? `\u5BF9\u6BD4 ${d2.growth[anaWin].since_days} \u5929\u524D\u7684\u5FEB\u7167` : "\u6682\u65E0\u8BE5\u65F6\u6BB5\u5386\u53F2\u5FEB\u7167\uFF0C\u591A\u5237\u65B0\u51E0\u6B21\u5373\u53EF\u79EF\u7D2F\u5BF9\u6BD4" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-col ana-col-metrics", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-sub", children: "\u8FD1 7 \u65E5 \xB7 \u73AF\u6BD4" }),
                (d2.metrics ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u8BE5\u5E73\u53F0\u672A\u63D0\u4F9B\u8FD1 7 \u65E5\u6307\u6807" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-metrics", children: (d2.metrics ?? []).map((m2) => {
                  const vs = m2.vs ?? "";
                  const up = vs.startsWith("+");
                  const has = vs && vs !== "-";
                  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-metric", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-metric-val", children: m2.value }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-metric-label", children: m2.label }),
                    has && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-metric-vs", style: { color: up ? "var(--trend-up)" : "var(--trend-down)" }, children: [
                      "\u73AF\u6BD4",
                      vs
                    ] })
                  ] }, m2.label);
                }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ana-col ana-col-notes", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-sub", children: "\u6700\u65B0\u7B14\u8BB0" }),
                (d2.notes ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dash-empty", children: "\u8BE5\u8D26\u53F7\u6682\u65E0\u53EF\u8BFB\u53D6\u7684\u5DF2\u53D1\u5E03\u7B14\u8BB0" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ana-notes", children: (d2.notes ?? []).slice(0, 6).map((n, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("a", { className: "ana-note", href: n.url, target: "_blank", rel: "noreferrer", title: n.title, children: [
                  n.cover ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { className: "ana-note-cover", src: n.cover, alt: "", referrerPolicy: "no-referrer" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ana-note-cover ana-note-cover-ph", children: "\u{1F4DD}" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ana-note-main", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ana-note-title", children: n.title || "(\u65E0\u6807\u9898)" }),
                    n.stat && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ana-note-stat", children: n.stat })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ana-note-go", children: "\u2197" })
                ] }, i)) })
              ] })
            ] }))
          ] });
        })()
      ] })
    ] })
  ] });
}

// src/features/dashboard.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var view = "dashboard";
var order = 30;
var labels = { zh: "\u5DE5\u4F5C\u53F0", en: "Dashboard" };
var Icon = IconDashboard;
var Component = DashboardPage;
var plugin = {
  name: "easel-view-dashboard",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Component, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view),
      order,
      locale: "easel.panel",
      label: () => t(view)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { size });
    }));
  }
};

// src/features/trends.tsx
var trends_exports = {};
__export(trends_exports, {
  Component: () => Component2,
  Icon: () => Icon2,
  labels: () => labels2,
  order: () => order2,
  plugin: () => plugin2,
  view: () => view2
});

// src/components/TrendsPage.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ALL_PLATFORMS = [
  { key: "weibo", label: "\u5FAE\u535A" },
  { key: "douyin", label: "\u6296\u97F3" },
  { key: "zhihu", label: "\u77E5\u4E4E" },
  { key: "bilibili", label: "B\u7AD9" },
  { key: "baidu", label: "\u767E\u5EA6" },
  { key: "toutiao", label: "\u5934\u6761" }
];
function sourceOf(label2) {
  return `${label2}\u70ED\u641C`;
}
var fmtClock = (seconds) => seconds === void 0 ? "" : new Date(seconds * 1e3).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
function sortItems(items, rising) {
  if (!rising) return items;
  return [...items].sort((a, b2) => Number(b2.isNew === true) - Number(a.isNew === true) || (b2.delta ?? 0) - (a.delta ?? 0) || (a.rank ?? 0) - (b2.rank ?? 0));
}
var fmtAge = (ageMin) => ageMin >= 1440 ? `${Math.floor(ageMin / 1440)}\u5929` : `${Math.floor(ageMin / 60)}h`;
function TrendBadges({ item }) {
  const delta = typeof item.delta === "number" && item.delta !== 0 ? item.delta : null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    item.isNew && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-badge trend-badge-new", children: "\u65B0" }),
    delta === null ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `trend-badge trend-badge-${delta > 0 ? "up" : "down"}`, children: delta > 0 ? `\u2191${delta}` : `\u2193${-delta}` }),
    (item.watch ?? []).slice(0, 2).map((w2) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-badge trend-badge-watch", children: w2 }, w2)),
    typeof item.ageMin === "number" && item.ageMin >= 60 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "trend-age", children: [
      "\u9996\u73B0 ",
      fmtAge(item.ageMin)
    ] })
  ] });
}
function TrendRow({ row: row2, showPlatform, saved, onSave, onUse }) {
  const payload = JSON.stringify({
    title: row2.title,
    url: row2.url,
    source: row2.source,
    platform: row2.platform,
    rank: row2.rank,
    hot: row2.hot
  });
  const rank = row2.rank ?? 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-item", "data-easel-trend": payload, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `trend-rank ${rank > 0 && rank <= 3 ? "top" : ""}`, children: rank || "\xB7" }),
    showPlatform && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-plat", children: row2.label }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-main", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "a",
        {
          className: "trend-title",
          href: row2.url || void 0,
          target: "_blank",
          rel: "noreferrer",
          title: row2.title,
          children: row2.title
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-meta", children: [
        row2.hot && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-hot", children: row2.hot }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TrendBadges, { item: row2 })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        className: "trend-save",
        title: saved ? "\u5DF2\u6536\u85CF\u5230\u9009\u9898\u5E93" : "\u6536\u85CF\u5230\u9009\u9898\u5E93",
        onClick: onSave,
        children: saved ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconCheck, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconBookmark, { size: 14 })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "trend-use", title: "\u505A\u6210\u5185\u5BB9", onClick: onUse, children: "\u505A\u5185\u5BB9" })
  ] });
}
function TrendColumn({ group, rising, loading, isSaved, onSave, onUse }) {
  const items = (0, import_react3.useMemo)(() => sortItems(group.items, rising), [group.items, rising]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card trend-col", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-col-head", children: [
      group.label,
      group.stale && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "trend-stale", title: "\u5185\u5BB9\u6765\u81EA\u6700\u8FD1\u4E00\u6B21\u6210\u529F\u5FEB\u7167", children: [
        "\u79BB\u7EBF",
        group.at ? ` \xB7 \u4E0A\u6B21 ${fmtClock(group.at)}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-count", children: group.items.length })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-list", children: [
      items.length === 0 && !loading && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "trend-empty", children: group.ok === false ? "\u8BE5\u5E73\u53F0\u6682\u65F6\u53D6\u4E0D\u5230\uFF08\u6570\u636E\u6E90\u4E0D\u53EF\u7528\uFF09" : "\u6682\u65E0\u6570\u636E" }),
      items.map((it, i) => {
        const row2 = { ...it, platform: group.platform, label: group.label, source: group.source };
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          TrendRow,
          {
            row: row2,
            saved: isSaved(it.title),
            onSave: () => onSave(row2),
            onUse: () => onUse(it.title)
          },
          it.url || `${it.title}-${i}`
        );
      })
    ] })
  ] });
}
function WatchCard({ watch, isSaved, onSave, onUse }) {
  const total = watch.reduce((sum, g) => sum + g.items.length, 0);
  const newCount = watch.reduce((sum, g) => sum + g.items.filter((it) => it.isNew).length, 0);
  const shown = watch.slice(0, 5);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card trend-watch-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-col-head", children: [
      "\u6211\u7684\u5173\u6CE8",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "trend-count", children: [
        "\u547D\u4E2D ",
        total,
        " \u6761",
        newCount > 0 ? ` \xB7 \u65B0 ${newCount}` : ""
      ] })
    ] }),
    shown.map((g) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-watch-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-watch-key", children: g.keyword }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "trend-watch-items", children: g.items.slice(0, 3).map((it, i) => {
        const row2 = { ...it, source: sourceOf(it.label) };
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          TrendRow,
          {
            row: row2,
            showPlatform: true,
            saved: isSaved(it.title),
            onSave: () => onSave(row2),
            onUse: () => onUse(it.title)
          },
          it.platform + (it.url || it.title) + i
        );
      }) }),
      g.items.length > 3 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "trend-more", children: [
        "\u8FD8\u6709 ",
        g.items.length - 3,
        " \u6761 \xB7 "
      ] })
    ] }, g.keyword)),
    watch.length > 5 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-more", children: [
      "\u8FD8\u6709 ",
      watch.length - 5,
      " \u4E2A\u8BCD\u547D\u4E2D"
    ] })
  ] });
}
function ClusterCard({ cluster, isSaved, onSave, onUse }) {
  const rep = cluster.items[0];
  const shownLabels = cluster.labels.slice(0, 4);
  const extra = cluster.labels.length - shownLabels.length;
  const source = `\u8DE8\u5E73\u53F0\u70ED\u641C\uFF08${cluster.labels.join("/")}\uFF09`;
  const payload = JSON.stringify({
    title: cluster.title,
    url: rep?.url ?? "",
    source,
    platform: cluster.platforms.join(","),
    rank: cluster.bestRank
  });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card trend-cluster", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-cluster-head", "data-easel-trend": payload, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-main", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "a",
          {
            className: "trend-title",
            href: rep?.url || void 0,
            target: "_blank",
            rel: "noreferrer",
            title: cluster.title,
            children: cluster.title
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "trend-hot", children: [
            cluster.platforms.length,
            " \u5E73\u53F0\u5728\u699C \xB7 \u6700\u9AD8\u7B2C ",
            cluster.bestRank
          ] }),
          cluster.isNew && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-badge trend-badge-new", children: "\u65B0" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-cluster-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            className: "trend-save",
            title: isSaved(cluster.title) ? "\u5DF2\u6536\u85CF\u5230\u9009\u9898\u5E93" : "\u6536\u85CF\u5230\u9009\u9898\u5E93",
            onClick: () => onSave({
              title: cluster.title,
              url: rep?.url ?? "",
              hot: "",
              platform: cluster.platforms.join(","),
              label: "\u805A\u5408",
              source
            }),
            children: isSaved(cluster.title) ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconCheck, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconBookmark, { size: 14 })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "trend-use", title: "\u505A\u6210\u5185\u5BB9", onClick: () => onUse(cluster.title), children: "\u505A\u5185\u5BB9" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-cluster-platforms", children: [
      shownLabels.map((label2) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-chip", children: label2 }, label2)),
      extra > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "trend-more", children: [
        "+",
        extra
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "trend-list", children: cluster.items.map((it, i) => {
      const row2 = { ...it, source: sourceOf(it.label) };
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        TrendRow,
        {
          row: row2,
          showPlatform: true,
          saved: isSaved(it.title),
          onSave: () => onSave(row2),
          onUse: () => onUse(it.title)
        },
        it.platform + (it.url || it.title) + i
      );
    }) })
  ] });
}
function RadarSettings({ cfg, onSaved, onClose }) {
  const [draft, setDraft] = (0, import_react3.useState)(() => ({
    ...cfg,
    sources: cfg.sources.map((s) => ({ ...s })),
    keywords: [...cfg.keywords ?? []]
  }));
  const [keywordText, setKeywordText] = (0, import_react3.useState)((cfg.keywords ?? []).join(" "));
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [msg, setMsg] = (0, import_react3.useState)("");
  const [err, setErr] = (0, import_react3.useState)("");
  const updSource = (i, patch) => {
    setDraft((d2) => ({ ...d2, sources: d2.sources.map((s, j2) => j2 === i ? { ...s, ...patch } : s) }));
  };
  const addSource = () => {
    setDraft((d2) => ({
      ...d2,
      sources: [...d2.sources, { name: "", url: "", kind: "rss", category: "\u81EA\u5B9A\u4E49", enabled: true }]
    }));
  };
  const save = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const cleaned = {
        ...draft,
        proxyUrl: draft.proxyUrl.trim(),
        cdpEndpoint: draft.cdpEndpoint.trim(),
        keywords: keywordText.split(/[\s,，、;；]+/).map((s) => s.trim()).filter(Boolean),
        sources: draft.sources.filter((s) => s.name.trim() && s.url.trim()).map((s) => ({ ...s, name: s.name.trim(), url: s.url.trim(), category: s.category.trim() || "\u81EA\u5B9A\u4E49" }))
      };
      await saveRadarConfig(cleaned);
      setMsg("\u5DF2\u4FDD\u5B58");
      onSaved();
      setTimeout(onClose, 500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "\u4FDD\u5B58\u5931\u8D25");
    } finally {
      setBusy(false);
    }
  };
  const field = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    border: "0.5px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "modal", style: { width: 620, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { style: { margin: "0 0 12px" }, children: "\u70ED\u70B9\u96F7\u8FBE \xB7 \u6E90\u4E0E\u4EE3\u7406" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card", style: { padding: 14, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 8 }, children: "\u5173\u6CE8\u8BCD" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          style: field,
          placeholder: "\u7528\u9017\u53F7\u6216\u7A7A\u683C\u5206\u9694\uFF0C\u4F8B\u5982\uFF1AAI \u8003\u7814 \u65B0\u80FD\u6E90\u6C7D\u8F66",
          value: keywordText,
          onChange: (e) => setKeywordText(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6 }, children: "\u547D\u4E2D\u7684\u70ED\u70B9\u4F1A\u5728\u9875\u9762\u9876\u90E8\u300C\u6211\u7684\u5173\u6CE8\u300D\u7F6E\u9876\uFF08\u6700\u591A 20 \u4E2A\uFF0C\u6BCF\u4E2A 1\u201324 \u5B57\uFF09\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card", style: { padding: 14, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 8 }, children: "\u4EE3\u7406" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            style: { ...field, flex: 1 },
            placeholder: "socks5://127.0.0.1:1080 \u6216 http://\u2026 \uFF08\u7559\u7A7A=\u76F4\u8FDE\uFF09",
            value: draft.proxyUrl,
            onChange: (e) => setDraft((d2) => ({ ...d2, proxyUrl: e.target.value }))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              type: "checkbox",
              checked: draft.proxyEnabled,
              onChange: (e) => setDraft((d2) => ({ ...d2, proxyEnabled: e.target.checked }))
            }
          ),
          "\u542F\u7528"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6 }, children: [
        "\u5E94\u7528\u4E8E\u70ED\u70B9\u6293\u53D6\u3001\u6B63\u6587\u6293\u53D6\u4E0E\u8D26\u53F7\u767B\u5F55\u3002\u73AF\u5883\u53D8\u91CF EASEL_PROXY=",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: cfg.proxyEnv || "\uFF08\u672A\u8BBE\uFF09" }),
        " \u4F1A\u88AB\u8FD9\u91CC\u7684\u914D\u7F6E\u8986\u76D6\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card", style: { padding: 14, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 8 }, children: "CDP \u63A5\u7BA1\u7AEF\u70B9\uFF08\u8D26\u53F7\u9875\u300C\u63A5\u7BA1 Chrome\u300D\u7528\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          style: field,
          placeholder: "http://127.0.0.1:9222",
          value: draft.cdpEndpoint,
          onChange: (e) => setDraft((d2) => ({ ...d2, cdpEndpoint: e.target.value }))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6 }, children: [
        "Chrome \u9700\u4EE5 ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: "chrome --remote-debugging-port=9222" }),
        " \u542F\u52A8\u540E\uFF0C\u767B\u5F55\u6309\u94AE\u9009\u300C\u63A5\u7BA1 Chrome\u300D\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "card", style: { padding: 14, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontWeight: 600, fontSize: 13 }, children: "\u81EA\u5B9A\u4E49\u6E90\uFF08\u652F\u6301 RSS / RSSHub / JSON\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "btn btn-sm", onClick: addSource, children: "+ \u6DFB\u52A0\u6E90" })
      ] }),
      draft.sources.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 12.5, color: "var(--text-tertiary)" }, children: [
        "\u8FD8\u6CA1\u6709\u81EA\u5B9A\u4E49\u6E90\u3002\u4F8B\uFF1ARSSHub \u8DEF\u7531 ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: "http://\u4F60\u7684\u5B9E\u4F8B:1200/36kr/newsflashes" }),
        "\uFF0C \u5206\u7C7B\u586B\u300C\u79D1\u6280\u300D\u5373\u53EF\u5728\u70ED\u70B9\u9875\u6309\u7C7B\u578B\u7B5B\u9009\u3002"
      ] }),
      draft.sources.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr 74px 90px auto", gap: 6, marginBottom: 6, alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            style: field,
            placeholder: "\u540D\u79F0",
            value: s.name,
            onChange: (e) => updSource(i, { name: e.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            style: field,
            placeholder: "http://\u2026\uFF08RSSHub \u8DEF\u7531\u6216 JSON \u70ED\u70B9\u63A5\u53E3\uFF09",
            value: s.url,
            onChange: (e) => updSource(i, { url: e.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("select", { style: field, value: s.kind, onChange: (e) => updSource(i, { kind: e.target.value }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "rss", children: "RSS" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "json", children: "JSON" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            style: field,
            placeholder: "\u5206\u7C7B",
            value: s.category,
            onChange: (e) => updSource(i, { category: e.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "btn btn-sm", title: "\u5220\u9664", onClick: () => setDraft((d2) => ({ ...d2, sources: d2.sources.filter((_2, j2) => j2 !== i) })), children: "\u2715" })
      ] }, i)),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }, children: "\u5206\u7C7B = \u70ED\u70B9\u9875\u7684\u7C7B\u578B\u7B5B\u9009\u6807\u7B7E\uFF1B\u4E00\u6761\u6E90\u53EA\u5F52\u4E00\u7C7B\uFF08\u53C2\u8003 news-radar-pusher \u7684\u6E90\u2192\u7EC4\u6620\u5C04\uFF09\u3002" })
    ] }),
    err && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { color: "var(--red)", fontSize: 12.5, marginBottom: 8 }, children: err }),
    msg && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { color: "var(--green)", fontSize: 12.5, marginBottom: 8 }, children: msg }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "btn", onClick: onClose, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "btn btn-primary", disabled: busy, onClick: save, children: busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58" })
    ] })
  ] }) });
}
function TrendsPage({ onUseTopic }) {
  const [selected, setSelected] = (0, import_react3.useState)(["weibo", "douyin", "zhihu"]);
  const [groups, setGroups] = (0, import_react3.useState)([]);
  const [clusters, setClusters] = (0, import_react3.useState)(null);
  const [watch, setWatch] = (0, import_react3.useState)([]);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)("");
  const [updated, setUpdated] = (0, import_react3.useState)(0);
  const [saved, setSaved] = (0, import_react3.useState)(/* @__PURE__ */ new Set());
  const [settingsOpen, setSettingsOpen] = (0, import_react3.useState)(false);
  const [radarCfg, setRadarCfg] = (0, import_react3.useState)(null);
  const [viewMode, setViewMode] = (0, import_react3.useState)("list");
  const [rising, setRising] = (0, import_react3.useState)(false);
  const [categoryFilter, setCategoryFilter] = (0, import_react3.useState)("");
  const loadRadar = (0, import_react3.useCallback)(() => {
    fetchRadarConfig().then(setRadarCfg).catch(() => {
    });
  }, []);
  const save = async (title, source) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source, status: "pending" });
      setSaved((prev) => new Set(prev).add(title));
    } catch {
    }
  };
  const load = (0, import_react3.useCallback)((pfs, options = {}) => {
    setLoading(true);
    setError("");
    fetchTrends(pfs.join(","), 15, options).then((d2) => {
      setGroups(d2.trends);
      setWatch(d2.watch ?? []);
      setUpdated(d2.updated);
      if (d2.clusters !== void 0) setClusters(d2.clusters);
    }).catch(() => setError("\u70ED\u70B9\u62C9\u53D6\u5931\u8D25\u2014\u2014\u8BF7\u786E\u8BA4\u5DF2\u914D\u7F6E\u5916\u7F51\u4EE3\u7406\uFF08EASEL_PROXY \u6216\u70ED\u70B9\u9875\u8BBE\u7F6E\uFF09\u3002")).finally(() => setLoading(false));
  }, []);
  (0, import_react3.useEffect)(() => {
    load(selected);
    loadRadar();
  }, []);
  (0, import_react3.useEffect)(() => {
    const onSaved = (event) => {
      const title = event.detail?.title;
      if (title) setSaved((prev) => new Set(prev).add(title));
    };
    window.addEventListener("easel:trend-saved", onSaved);
    return () => window.removeEventListener("easel:trend-saved", onSaved);
  }, []);
  const refreshAll = (0, import_react3.useCallback)(() => {
    load(selected, viewMode === "cluster" ? { view: "cluster", force: true } : { force: true });
    loadRadar();
  }, [load, selected, viewMode, loadRadar]);
  const toggle = (k2) => {
    const next = selected.includes(k2) ? selected.filter((x2) => x2 !== k2) : [...selected, k2];
    setSelected(next);
    load(next, viewMode === "cluster" ? { view: "cluster" } : {});
  };
  const toggleView = () => {
    const next = viewMode === "list" ? "cluster" : "list";
    setViewMode(next);
    if (next === "cluster" && clusters === null) load(selected, { view: "cluster" });
  };
  const handlers = (0, import_react3.useMemo)(() => ({
    isSaved: (title) => saved.has(title),
    onSave: (row2) => {
      void save(row2.title, row2.source);
    },
    onUse: (title) => {
      onUseTopic(title);
    }
  }), [saved, onUseTopic]);
  const customGroups = groups.filter((g) => g.platform.startsWith("custom:"));
  const categories = Array.from(new Set(customGroups.map((g) => g.category || "\u81EA\u5B9A\u4E49")));
  const visibleCustom = categoryFilter === "" ? customGroups : customGroups.filter((g) => g.category === categoryFilter);
  const columns = [
    ...builtinColumns(groups),
    ...visibleCustom.map((g) => ({ ...g, source: sourceOf(g.label) }))
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "page-scroll trends-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("h1", { className: "page-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconFire, { size: 22 }),
          " \u70ED\u70B9\u96F7\u8FBE"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "page-subtitle", children: [
          "\u591A\u5E73\u53F0\u5B9E\u65F6\u70ED\u641C\uFF1A\u770B\u5347\u8DCC\u3001\u8DE8\u5E73\u53F0\u540C\u9898\u3001\u76EF\u7740\u4F60\u7684\u5173\u6CE8\u8BCD\uFF0C\u53F3\u952E\u628A\u6B63\u6587\u6293\u8FDB\u5185\u5BB9\u5E93\u4E0E\u9009\u9898\u5E93\u3002",
          updated > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { color: "var(--text-tertiary)" }, children: [
            " \xB7 ",
            new Date(updated * 1e3).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            " \u6570\u636E"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "btn btn-sm", onClick: () => setSettingsOpen(true), title: "\u5173\u6CE8\u8BCD / \u81EA\u5B9A\u4E49\u6E90 / \u4EE3\u7406 / CDP \u7AEF\u70B9", children: "\u2699 \u6E90\u4E0E\u4EE3\u7406" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { className: "btn btn-sm", onClick: refreshAll, disabled: loading, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 14 }),
          " ",
          loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-platforms", children: [
      ALL_PLATFORMS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          className: `chip ${selected.includes(p.key) ? "active" : ""}`,
          onClick: () => toggle(p.key),
          children: p.label
        },
        p.key
      )),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "trend-viewsep" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: `chip ${viewMode === "list" ? "active" : ""}`, onClick: toggleView, children: "\u5206\u5E73\u53F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: `chip ${viewMode === "cluster" ? "active" : ""}`, onClick: toggleView, children: "\u805A\u5408" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          className: `chip ${rising ? "active" : ""}`,
          onClick: () => setRising(!rising),
          title: rising ? "\u6062\u590D\u699C\u5355\u539F\u5E8F" : "\u6309\u5347\u5E45\u91CD\u6392\uFF08\u4E0D\u91CD\u65B0\u8BF7\u6C42\uFF09",
          children: rising ? "\u5347\u6E29 \u2713" : "\u5347\u6E29"
        }
      )
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "notice-error", children: error }),
    watch.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(WatchCard, { watch, ...handlers }),
    viewMode === "list" && categories.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-platforms", style: { marginTop: -4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          className: `chip ${categoryFilter === "" ? "active" : ""}`,
          onClick: () => setCategoryFilter(""),
          children: "\u5168\u90E8\u7C7B\u578B"
        }
      ),
      categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          className: `chip ${categoryFilter === c ? "active" : ""}`,
          onClick: () => setCategoryFilter(categoryFilter === c ? "" : c),
          children: c
        },
        c
      ))
    ] }),
    viewMode === "list" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "trend-grid", children: columns.map((g) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TrendColumn, { group: g, rising, loading, ...handlers }, g.platform)) }),
    viewMode === "cluster" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "trend-grid", children: [
      (clusters ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ClusterCard, { cluster: c, ...handlers }, c.id)),
      !loading && clusters !== null && clusters.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "trend-empty", children: "\u5F53\u524D\u6E90\u4E4B\u95F4\u6CA1\u6709\u540C\u9898\u805A\u7C7B\u3002" })
    ] }),
    settingsOpen && radarCfg && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      RadarSettings,
      {
        cfg: radarCfg,
        onSaved: () => {
          loadRadar();
          load(selected, viewMode === "cluster" ? { view: "cluster" } : {});
        },
        onClose: () => setSettingsOpen(false)
      }
    ),
    settingsOpen && !radarCfg && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "overlay", onClick: () => setSettingsOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "modal", style: { padding: 30 }, onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "loading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "spinner" }),
      "\u52A0\u8F7D\u914D\u7F6E\u2026"
    ] }) }) })
  ] });
}
function builtinColumns(groups) {
  return groups.filter((g) => !g.platform.startsWith("custom:")).map((g) => ({ ...g, source: sourceOf(g.label) }));
}

// src/features/trends.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var view2 = "trends";
var order2 = 31;
var labels2 = { zh: "\u70ED\u70B9\u96F7\u8FBE", en: "Trends" };
var Icon2 = IconFire;
var Component2 = TrendsPage;
var plugin2 = {
  name: "easel-view-trends",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view2),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Component2, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view2),
      order: order2,
      locale: "easel.panel",
      label: () => t(view2)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon2, { size });
    }));
  }
};

// src/features/ideas.tsx
var ideas_exports = {};
__export(ideas_exports, {
  Component: () => Component3,
  Icon: () => Icon3,
  labels: () => labels3,
  order: () => order3,
  plugin: () => plugin3,
  view: () => view3
});

// src/components/IdeasPage.tsx
var import_react4 = require("react");

// ../../../easel-handoff-payload/node_modules/.pnpm/marked@16.4.2/node_modules/marked/lib/marked.esm.js
function L() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T = L();
function G(l3) {
  T = l3;
}
var E = { exec: () => null };
function d(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (r, i) => {
    let s = typeof i == "string" ? i : i.source;
    return s = s.replace(m.caret, "$1"), t = t.replace(r, s), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var be = (() => {
  try {
    return !!new RegExp("(?<=1)(?<!1)");
  } catch {
    return false;
  }
})();
var m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceTabs: /^\t+/, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] /, listReplaceTask: /^\[[ xX]\] +/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), hrRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), fencesBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}(?:\`\`\`|~~~)`), headingBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}#`), htmlBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}<(?:[a-z].*>|!--)`, "i") };
var Re = /^(?:[ \t]*(?:\n|$))+/;
var Te = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var Oe = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var I = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var we = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var F = /(?:[*+-]|\d{1,9}[.)])/;
var ie = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var oe = d(ie).replace(/bull/g, F).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var ye = d(ie).replace(/bull/g, F).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var j = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var Pe = /^[^\n]+/;
var Q = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var Se = d(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", Q).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var $e = d(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, F).getRegex();
var v = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var U = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var _e = d("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", U).replace("tag", v).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var ae = d(j).replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var Le = d(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", ae).getRegex();
var K = { blockquote: Le, code: Te, def: Se, fences: Oe, heading: we, hr: I, html: _e, lheading: oe, list: $e, newline: Re, paragraph: ae, table: E, text: Pe };
var re = d("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var Me = { ...K, lheading: ye, table: re, paragraph: d(j).replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", re).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex() };
var ze = { ...K, html: d(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", U).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: E, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d(j).replace("hr", I).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", oe).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Ae = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var Ee = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var le = /^( {2,}|\\)\n(?!\s*$)/;
var Ie = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var D = /[\p{P}\p{S}]/u;
var W = /[\s\p{P}\p{S}]/u;
var ue = /[^\s\p{P}\p{S}]/u;
var Ce = d(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, W).getRegex();
var pe = /(?!~)[\p{P}\p{S}]/u;
var Be = /(?!~)[\s\p{P}\p{S}]/u;
var qe = /(?:[^\s\p{P}\p{S}]|~)/u;
var ve = d(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", be ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ce = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var De = d(ce, "u").replace(/punct/g, D).getRegex();
var He = d(ce, "u").replace(/punct/g, pe).getRegex();
var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var Ze = d(he, "gu").replace(/notPunctSpace/g, ue).replace(/punctSpace/g, W).replace(/punct/g, D).getRegex();
var Ge = d(he, "gu").replace(/notPunctSpace/g, qe).replace(/punctSpace/g, Be).replace(/punct/g, pe).getRegex();
var Ne = d("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, ue).replace(/punctSpace/g, W).replace(/punct/g, D).getRegex();
var Fe = d(/\\(punct)/, "gu").replace(/punct/g, D).getRegex();
var je = d(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Qe = d(U).replace("(?:-->|$)", "-->").getRegex();
var Ue = d("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Qe).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var q = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/;
var Ke = d(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", q).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var de = d(/^!?\[(label)\]\[(ref)\]/).replace("label", q).replace("ref", Q).getRegex();
var ke = d(/^!?\[(ref)\](?:\[\])?/).replace("ref", Q).getRegex();
var We = d("reflink|nolink(?!\\()", "g").replace("reflink", de).replace("nolink", ke).getRegex();
var se = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var X = { _backpedal: E, anyPunctuation: Fe, autolink: je, blockSkip: ve, br: le, code: Ee, del: E, emStrongLDelim: De, emStrongRDelimAst: Ze, emStrongRDelimUnd: Ne, escape: Ae, link: Ke, nolink: ke, punctuation: Ce, reflink: de, reflinkSearch: We, tag: Ue, text: Ie, url: E };
var Xe = { ...X, link: d(/^!?\[(label)\]\((.*?)\)/).replace("label", q).getRegex(), reflink: d(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", q).getRegex() };
var N = { ...X, emStrongRDelimAst: Ge, emStrongLDelim: He, url: d(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", se).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", se).getRegex() };
var Je = { ...N, br: d(le).replace("{2,}", "*").getRegex(), text: d(N.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var C = { normal: K, gfm: Me, pedantic: ze };
var M = { normal: X, gfm: N, breaks: Je, pedantic: Xe };
var Ve = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ge = (l3) => Ve[l3];
function w(l3, e) {
  if (e) {
    if (m.escapeTest.test(l3)) return l3.replace(m.escapeReplace, ge);
  } else if (m.escapeTestNoEncode.test(l3)) return l3.replace(m.escapeReplaceNoEncode, ge);
  return l3;
}
function J(l3) {
  try {
    l3 = encodeURI(l3).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function V(l3, e) {
  let t = l3.replace(m.findPipe, (i, s, a) => {
    let o = false, p = s;
    for (; --p >= 0 && a[p] === "\\"; ) o = !o;
    return o ? "|" : " |";
  }), n = t.split(m.splitPipe), r = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; r < n.length; r++) n[r] = n[r].trim().replace(m.slashPipe, "|");
  return n;
}
function z(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let r = 0;
  for (; r < n; ) {
    let i = l3.charAt(n - r - 1);
    if (i === e && !t) r++;
    else if (i !== e && t) r++;
    else break;
  }
  return l3.slice(0, n - r);
}
function fe(l3, e) {
  if (l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function me(l3, e, t, n, r) {
  let i = e.href, s = e.title || null, a = l3[1].replace(r.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let o = { type: l3[0].charAt(0) === "!" ? "image" : "link", raw: t, href: i, title: s, text: a, tokens: n.inlineTokens(a) };
  return n.state.inLink = false, o;
}
function Ye(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let r = n[1];
  return e.split(`
`).map((i) => {
    let s = i.match(t.other.beginningSpace);
    if (s === null) return i;
    let [a] = s;
    return a.length >= r.length ? i.slice(r.length) : i;
  }).join(`
`);
}
var y = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = t[0].replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: t[0], codeBlockStyle: "indented", text: this.options.pedantic ? n : z(n, `
`) };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], r = Ye(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: r };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let r = z(n, "#");
        (this.options.pedantic || !r || this.rules.other.endingSpaceChar.test(r)) && (n = r.trim());
      }
      return { type: "heading", raw: t[0], depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: z(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = z(t[0], `
`).split(`
`), r = "", i = "", s = [];
      for (; n.length > 0; ) {
        let a = false, o = [], p;
        for (p = 0; p < n.length; p++) if (this.rules.other.blockquoteStart.test(n[p])) o.push(n[p]), a = true;
        else if (!a) o.push(n[p]);
        else break;
        n = n.slice(p);
        let u = o.join(`
`), c = u.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        r = r ? `${r}
${u}` : u, i = i ? `${i}
${c}` : c;
        let g = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, s, true), this.lexer.state.top = g, n.length === 0) break;
        let h = s.at(-1);
        if (h?.type === "code") break;
        if (h?.type === "blockquote") {
          let R = h, f = R.raw + `
` + n.join(`
`), O = this.blockquote(f);
          s[s.length - 1] = O, r = r.substring(0, r.length - R.raw.length) + O.raw, i = i.substring(0, i.length - R.text.length) + O.text;
          break;
        } else if (h?.type === "list") {
          let R = h, f = R.raw + `
` + n.join(`
`), O = this.list(f);
          s[s.length - 1] = O, r = r.substring(0, r.length - h.raw.length) + O.raw, i = i.substring(0, i.length - R.raw.length) + O.raw, n = f.substring(s.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: r, tokens: s, text: i };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), r = n.length > 1, i = { type: "list", raw: "", ordered: r, start: r ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = r ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = r ? n : "[*+-]");
      let s = this.rules.other.listItemRegex(n), a = false;
      for (; e; ) {
        let p = false, u = "", c = "";
        if (!(t = s.exec(e)) || this.rules.block.hr.test(e)) break;
        u = t[0], e = e.substring(u.length);
        let g = t[2].split(`
`, 1)[0].replace(this.rules.other.listReplaceTabs, (H) => " ".repeat(3 * H.length)), h = e.split(`
`, 1)[0], R = !g.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, c = g.trimStart()) : R ? f = t[1].length + 1 : (f = t[2].search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, c = g.slice(f), f += t[1].length), R && this.rules.other.blankLine.test(h) && (u += h + `
`, e = e.substring(h.length + 1), p = true), !p) {
          let H = this.rules.other.nextBulletRegex(f), ee = this.rules.other.hrRegex(f), te = this.rules.other.fencesBeginRegex(f), ne = this.rules.other.headingBeginRegex(f), xe = this.rules.other.htmlBeginRegex(f);
          for (; e; ) {
            let Z = e.split(`
`, 1)[0], A;
            if (h = Z, this.options.pedantic ? (h = h.replace(this.rules.other.listReplaceNesting, "  "), A = h) : A = h.replace(this.rules.other.tabCharGlobal, "    "), te.test(h) || ne.test(h) || xe.test(h) || H.test(h) || ee.test(h)) break;
            if (A.search(this.rules.other.nonSpaceChar) >= f || !h.trim()) c += `
` + A.slice(f);
            else {
              if (R || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || te.test(g) || ne.test(g) || ee.test(g)) break;
              c += `
` + h;
            }
            !R && !h.trim() && (R = true), u += Z + `
`, e = e.substring(Z.length + 1), g = A.slice(f);
          }
        }
        i.loose || (a ? i.loose = true : this.rules.other.doubleBlankLine.test(u) && (a = true));
        let O = null, Y;
        this.options.gfm && (O = this.rules.other.listIsTask.exec(c), O && (Y = O[0] !== "[ ] ", c = c.replace(this.rules.other.listReplaceTask, ""))), i.items.push({ type: "list_item", raw: u, task: !!O, checked: Y, loose: false, text: c, tokens: [] }), i.raw += u;
      }
      let o = i.items.at(-1);
      if (o) o.raw = o.raw.trimEnd(), o.text = o.text.trimEnd();
      else return;
      i.raw = i.raw.trimEnd();
      for (let p = 0; p < i.items.length; p++) if (this.lexer.state.top = false, i.items[p].tokens = this.lexer.blockTokens(i.items[p].text, []), !i.loose) {
        let u = i.items[p].tokens.filter((g) => g.type === "space"), c = u.length > 0 && u.some((g) => this.rules.other.anyLine.test(g.raw));
        i.loose = c;
      }
      if (i.loose) for (let p = 0; p < i.items.length; p++) i.items[p].loose = true;
      return i;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) return { type: "html", block: true, raw: t[0], pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: t[0] };
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), r = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", i = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: t[0], href: r, title: i };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = V(t[1]), r = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), i = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], s = { type: "table", raw: t[0], header: [], align: [], rows: [] };
    if (n.length === r.length) {
      for (let a of r) this.rules.other.tableAlignRight.test(a) ? s.align.push("right") : this.rules.other.tableAlignCenter.test(a) ? s.align.push("center") : this.rules.other.tableAlignLeft.test(a) ? s.align.push("left") : s.align.push(null);
      for (let a = 0; a < n.length; a++) s.header.push({ text: n[a], tokens: this.lexer.inline(n[a]), header: true, align: s.align[a] });
      for (let a of i) s.rows.push(V(a, s.header.length).map((o, p) => ({ text: o, tokens: this.lexer.inline(o), header: false, align: s.align[p] })));
      return s;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) return { type: "heading", raw: t[0], depth: t[2].charAt(0) === "=" ? 1 : 2, text: t[1], tokens: this.lexer.inline(t[1]) };
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n)) return;
        let s = z(n.slice(0, -1), "\\");
        if ((n.length - s.length) % 2 === 0) return;
      } else {
        let s = fe(t[2], "()");
        if (s === -2) return;
        if (s > -1) {
          let o = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + s;
          t[2] = t[2].substring(0, s), t[0] = t[0].substring(0, o).trim(), t[3] = "";
        }
      }
      let r = t[2], i = "";
      if (this.options.pedantic) {
        let s = this.rules.other.pedanticHrefTitle.exec(r);
        s && (r = s[1], i = s[3]);
      } else i = t[3] ? t[3].slice(1, -1) : "";
      return r = r.trim(), this.rules.other.startAngleBracket.test(r) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? r = r.slice(1) : r = r.slice(1, -1)), me(t, { href: r && r.replace(this.rules.inline.anyPunctuation, "$1"), title: i && i.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let r = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), i = t[r.toLowerCase()];
      if (!i) {
        let s = n[0].charAt(0);
        return { type: "text", raw: s, text: s };
      }
      return me(n, i, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let r = this.rules.inline.emStrongLDelim.exec(e);
    if (!r || r[3] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(r[1] || r[2] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let s = [...r[0]].length - 1, a, o, p = s, u = 0, c = r[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (c.lastIndex = 0, t = t.slice(-1 * e.length + s); (r = c.exec(t)) != null; ) {
        if (a = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !a) continue;
        if (o = [...a].length, r[3] || r[4]) {
          p += o;
          continue;
        } else if ((r[5] || r[6]) && s % 3 && !((s + o) % 3)) {
          u += o;
          continue;
        }
        if (p -= o, p > 0) continue;
        o = Math.min(o, o + p + u);
        let g = [...r[0]][0].length, h = e.slice(0, s + r.index + g + o);
        if (Math.min(s, o) % 2) {
          let f = h.slice(1, -1);
          return { type: "em", raw: h, text: f, tokens: this.lexer.inlineTokens(f) };
        }
        let R = h.slice(2, -2);
        return { type: "strong", raw: h, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), r = this.rules.other.nonSpaceChar.test(n), i = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return r && i && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e) {
    let t = this.rules.inline.del.exec(e);
    if (t) return { type: "del", raw: t[0], text: t[2], tokens: this.lexer.inlineTokens(t[2]) };
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, r;
      return t[2] === "@" ? (n = t[1], r = "mailto:" + n) : (n = t[1], r = n), { type: "link", raw: t[0], text: n, href: r, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, r;
      if (t[2] === "@") n = t[0], r = "mailto:" + n;
      else {
        let i;
        do
          i = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (i !== t[0]);
        n = t[0], t[1] === "www." ? r = "http://" + t[0] : r = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: r, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class l {
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(e) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || T, this.options.tokenizer = this.options.tokenizer || new y(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: C.normal, inline: M.normal };
    this.options.pedantic ? (t.block = C.pedantic, t.inline = M.pedantic) : this.options.gfm && (t.block = C.gfm, this.options.breaks ? t.inline = M.breaks : t.inline = M.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: C, inline: M };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    for (this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, "")); e; ) {
      let r;
      if (this.options.extensions?.block?.some((s) => (r = s.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        r.raw.length === 1 && s !== void 0 ? s.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.raw, this.inlineQueue.at(-1).src = s.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let s = 1 / 0, a = e.slice(1), o;
        this.options.extensions.startBlock.forEach((p) => {
          o = p.call({ lexer: this }, a), typeof o == "number" && o >= 0 && (s = Math.min(s, o));
        }), s < 1 / 0 && s >= 0 && (i = e.substring(0, s + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let s = t.at(-1);
        n && s?.type === "paragraph" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (e) {
        let s = "Infinite loop on byte: " + e.charCodeAt(0);
        if (this.options.silent) {
          console.error(s);
          break;
        } else throw new Error(s);
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    let n = e, r = null;
    if (this.tokens.links) {
      let o = Object.keys(this.tokens.links);
      if (o.length > 0) for (; (r = this.tokenizer.rules.inline.reflinkSearch.exec(n)) != null; ) o.includes(r[0].slice(r[0].lastIndexOf("[") + 1, -1)) && (n = n.slice(0, r.index) + "[" + "a".repeat(r[0].length - 2) + "]" + n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; (r = this.tokenizer.rules.inline.anyPunctuation.exec(n)) != null; ) n = n.slice(0, r.index) + "++" + n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let i;
    for (; (r = this.tokenizer.rules.inline.blockSkip.exec(n)) != null; ) i = r[2] ? r[2].length : 0, n = n.slice(0, r.index + i) + "[" + "a".repeat(r[0].length - i - 2) + "]" + n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let s = false, a = "";
    for (; e; ) {
      s || (a = ""), s = false;
      let o;
      if (this.options.extensions?.inline?.some((u) => (o = u.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), true) : false)) continue;
      if (o = this.tokenizer.escape(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.link(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(o.raw.length);
        let u = t.at(-1);
        o.type === "text" && u?.type === "text" ? (u.raw += o.raw, u.text += o.text) : t.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(e, n, a)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.br(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.del(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(e))) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      let p = e;
      if (this.options.extensions?.startInline) {
        let u = 1 / 0, c = e.slice(1), g;
        this.options.extensions.startInline.forEach((h) => {
          g = h.call({ lexer: this }, c), typeof g == "number" && g >= 0 && (u = Math.min(u, g));
        }), u < 1 / 0 && u >= 0 && (p = e.substring(0, u + 1));
      }
      if (o = this.tokenizer.inlineText(p)) {
        e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (a = o.raw.slice(-1)), s = true;
        let u = t.at(-1);
        u?.type === "text" ? (u.raw += o.raw, u.text += o.text) : t.push(o);
        continue;
      }
      if (e) {
        let u = "Infinite loop on byte: " + e.charCodeAt(0);
        if (this.options.silent) {
          console.error(u);
          break;
        } else throw new Error(u);
      }
    }
    return t;
  }
};
var P = class {
  options;
  parser;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let r = (t || "").match(m.notSpaceStart)?.[0], i = e.replace(m.endingNewline, "") + `
`;
    return r ? '<pre><code class="language-' + w(r) + '">' + (n ? i : w(i, true)) + `</code></pre>
` : "<pre><code>" + (n ? i : w(i, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, r = "";
    for (let a = 0; a < e.items.length; a++) {
      let o = e.items[a];
      r += this.listitem(o);
    }
    let i = t ? "ol" : "ul", s = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + i + s + `>
` + r + "</" + i + `>
`;
  }
  listitem(e) {
    let t = "";
    if (e.task) {
      let n = this.checkbox({ checked: !!e.checked });
      e.loose ? e.tokens[0]?.type === "paragraph" ? (e.tokens[0].text = n + " " + e.tokens[0].text, e.tokens[0].tokens && e.tokens[0].tokens.length > 0 && e.tokens[0].tokens[0].type === "text" && (e.tokens[0].tokens[0].text = n + " " + w(e.tokens[0].tokens[0].text), e.tokens[0].tokens[0].escaped = true)) : e.tokens.unshift({ type: "text", raw: n + " ", text: n + " ", escaped: true }) : t += n + " ";
    }
    return t += this.parser.parse(e.tokens, !!e.loose), `<li>${t}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let i = 0; i < e.header.length; i++) n += this.tablecell(e.header[i]);
    t += this.tablerow({ text: n });
    let r = "";
    for (let i = 0; i < e.rows.length; i++) {
      let s = e.rows[i];
      n = "";
      for (let a = 0; a < s.length; a++) n += this.tablecell(s[a]);
      r += this.tablerow({ text: n });
    }
    return r && (r = `<tbody>${r}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + r + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${w(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let r = this.parser.parseInline(n), i = J(e);
    if (i === null) return r;
    e = i;
    let s = '<a href="' + e + '"';
    return t && (s += ' title="' + w(t) + '"'), s += ">" + r + "</a>", s;
  }
  image({ href: e, title: t, text: n, tokens: r }) {
    r && (n = this.parser.parseInline(r, this.parser.textRenderer));
    let i = J(e);
    if (i === null) return w(n);
    e = i;
    let s = `<img src="${e}" alt="${n}"`;
    return t && (s += ` title="${w(t)}"`), s += ">", s;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : w(e.text);
  }
};
var $ = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
};
var b = class l2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || T, this.options.renderer = this.options.renderer || new P(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new $();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e, t = true) {
    let n = "";
    for (let r = 0; r < e.length; r++) {
      let i = e[r];
      if (this.options.extensions?.renderers?.[i.type]) {
        let a = i, o = this.options.extensions.renderers[a.type].call({ parser: this }, a);
        if (o !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(a.type)) {
          n += o || "";
          continue;
        }
      }
      let s = i;
      switch (s.type) {
        case "space": {
          n += this.renderer.space(s);
          continue;
        }
        case "hr": {
          n += this.renderer.hr(s);
          continue;
        }
        case "heading": {
          n += this.renderer.heading(s);
          continue;
        }
        case "code": {
          n += this.renderer.code(s);
          continue;
        }
        case "table": {
          n += this.renderer.table(s);
          continue;
        }
        case "blockquote": {
          n += this.renderer.blockquote(s);
          continue;
        }
        case "list": {
          n += this.renderer.list(s);
          continue;
        }
        case "html": {
          n += this.renderer.html(s);
          continue;
        }
        case "def": {
          n += this.renderer.def(s);
          continue;
        }
        case "paragraph": {
          n += this.renderer.paragraph(s);
          continue;
        }
        case "text": {
          let a = s, o = this.renderer.text(a);
          for (; r + 1 < e.length && e[r + 1].type === "text"; ) a = e[++r], o += `
` + this.renderer.text(a);
          t ? n += this.renderer.paragraph({ type: "paragraph", raw: o, text: o, tokens: [{ type: "text", raw: o, text: o, escaped: true }] }) : n += o;
          continue;
        }
        default: {
          let a = 'Token with "' + s.type + '" type was not found.';
          if (this.options.silent) return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return n;
  }
  parseInline(e, t = this.renderer) {
    let n = "";
    for (let r = 0; r < e.length; r++) {
      let i = e[r];
      if (this.options.extensions?.renderers?.[i.type]) {
        let a = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (a !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(i.type)) {
          n += a || "";
          continue;
        }
      }
      let s = i;
      switch (s.type) {
        case "escape": {
          n += t.text(s);
          break;
        }
        case "html": {
          n += t.html(s);
          break;
        }
        case "link": {
          n += t.link(s);
          break;
        }
        case "image": {
          n += t.image(s);
          break;
        }
        case "strong": {
          n += t.strong(s);
          break;
        }
        case "em": {
          n += t.em(s);
          break;
        }
        case "codespan": {
          n += t.codespan(s);
          break;
        }
        case "br": {
          n += t.br(s);
          break;
        }
        case "del": {
          n += t.del(s);
          break;
        }
        case "text": {
          n += t.text(s);
          break;
        }
        default: {
          let a = 'Token with "' + s.type + '" type was not found.';
          if (this.options.silent) return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return n;
  }
};
var S = class {
  options;
  block;
  constructor(e) {
    this.options = e || T;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer() {
    return this.block ? x.lex : x.lexInline;
  }
  provideParser() {
    return this.block ? b.parse : b.parseInline;
  }
};
var B = class {
  defaults = L();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = b;
  Renderer = P;
  TextRenderer = $;
  Lexer = x;
  Tokenizer = y;
  Hooks = S;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let r of e) switch (n = n.concat(t.call(this, r)), r.type) {
      case "table": {
        let i = r;
        for (let s of i.header) n = n.concat(this.walkTokens(s.tokens, t));
        for (let s of i.rows) for (let a of s) n = n.concat(this.walkTokens(a.tokens, t));
        break;
      }
      case "list": {
        let i = r;
        n = n.concat(this.walkTokens(i.items, t));
        break;
      }
      default: {
        let i = r;
        this.defaults.extensions?.childTokens?.[i.type] ? this.defaults.extensions.childTokens[i.type].forEach((s) => {
          let a = i[s].flat(1 / 0);
          n = n.concat(this.walkTokens(a, t));
        }) : i.tokens && (n = n.concat(this.walkTokens(i.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let r = { ...n };
      if (r.async = this.defaults.async || r.async || false, n.extensions && (n.extensions.forEach((i) => {
        if (!i.name) throw new Error("extension name required");
        if ("renderer" in i) {
          let s = t.renderers[i.name];
          s ? t.renderers[i.name] = function(...a) {
            let o = i.renderer.apply(this, a);
            return o === false && (o = s.apply(this, a)), o;
          } : t.renderers[i.name] = i.renderer;
        }
        if ("tokenizer" in i) {
          if (!i.level || i.level !== "block" && i.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let s = t[i.level];
          s ? s.unshift(i.tokenizer) : t[i.level] = [i.tokenizer], i.start && (i.level === "block" ? t.startBlock ? t.startBlock.push(i.start) : t.startBlock = [i.start] : i.level === "inline" && (t.startInline ? t.startInline.push(i.start) : t.startInline = [i.start]));
        }
        "childTokens" in i && i.childTokens && (t.childTokens[i.name] = i.childTokens);
      }), r.extensions = t), n.renderer) {
        let i = this.defaults.renderer || new P(this.defaults);
        for (let s in n.renderer) {
          if (!(s in i)) throw new Error(`renderer '${s}' does not exist`);
          if (["options", "parser"].includes(s)) continue;
          let a = s, o = n.renderer[a], p = i[a];
          i[a] = (...u) => {
            let c = o.apply(i, u);
            return c === false && (c = p.apply(i, u)), c || "";
          };
        }
        r.renderer = i;
      }
      if (n.tokenizer) {
        let i = this.defaults.tokenizer || new y(this.defaults);
        for (let s in n.tokenizer) {
          if (!(s in i)) throw new Error(`tokenizer '${s}' does not exist`);
          if (["options", "rules", "lexer"].includes(s)) continue;
          let a = s, o = n.tokenizer[a], p = i[a];
          i[a] = (...u) => {
            let c = o.apply(i, u);
            return c === false && (c = p.apply(i, u)), c;
          };
        }
        r.tokenizer = i;
      }
      if (n.hooks) {
        let i = this.defaults.hooks || new S();
        for (let s in n.hooks) {
          if (!(s in i)) throw new Error(`hook '${s}' does not exist`);
          if (["options", "block"].includes(s)) continue;
          let a = s, o = n.hooks[a], p = i[a];
          S.passThroughHooks.has(s) ? i[a] = (u) => {
            if (this.defaults.async && S.passThroughHooksRespectAsync.has(s)) return (async () => {
              let g = await o.call(i, u);
              return p.call(i, g);
            })();
            let c = o.call(i, u);
            return p.call(i, c);
          } : i[a] = (...u) => {
            if (this.defaults.async) return (async () => {
              let g = await o.apply(i, u);
              return g === false && (g = await p.apply(i, u)), g;
            })();
            let c = o.apply(i, u);
            return c === false && (c = p.apply(i, u)), c;
          };
        }
        r.hooks = i;
      }
      if (n.walkTokens) {
        let i = this.defaults.walkTokens, s = n.walkTokens;
        r.walkTokens = function(a) {
          let o = [];
          return o.push(s.call(this, a)), i && (o = o.concat(i.call(this, a))), o;
        };
      }
      this.defaults = { ...this.defaults, ...r };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, r) => {
      let i = { ...r }, s = { ...this.defaults, ...i }, a = this.onError(!!s.silent, !!s.async);
      if (this.defaults.async === true && i.async === false) return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return a(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return a(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (s.hooks && (s.hooks.options = s, s.hooks.block = e), s.async) return (async () => {
        let o = s.hooks ? await s.hooks.preprocess(n) : n, u = await (s.hooks ? await s.hooks.provideLexer() : e ? x.lex : x.lexInline)(o, s), c = s.hooks ? await s.hooks.processAllTokens(u) : u;
        s.walkTokens && await Promise.all(this.walkTokens(c, s.walkTokens));
        let h = await (s.hooks ? await s.hooks.provideParser() : e ? b.parse : b.parseInline)(c, s);
        return s.hooks ? await s.hooks.postprocess(h) : h;
      })().catch(a);
      try {
        s.hooks && (n = s.hooks.preprocess(n));
        let p = (s.hooks ? s.hooks.provideLexer() : e ? x.lex : x.lexInline)(n, s);
        s.hooks && (p = s.hooks.processAllTokens(p)), s.walkTokens && this.walkTokens(p, s.walkTokens);
        let c = (s.hooks ? s.hooks.provideParser() : e ? b.parse : b.parseInline)(p, s);
        return s.hooks && (c = s.hooks.postprocess(c)), c;
      } catch (o) {
        return a(o);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let r = "<p>An error occurred:</p><pre>" + w(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(r) : r;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var _ = new B();
function k(l3, e) {
  return _.parse(l3, e);
}
k.options = k.setOptions = function(l3) {
  return _.setOptions(l3), k.defaults = _.defaults, G(k.defaults), k;
};
k.getDefaults = L;
k.defaults = T;
k.use = function(...l3) {
  return _.use(...l3), k.defaults = _.defaults, G(k.defaults), k;
};
k.walkTokens = function(l3, e) {
  return _.walkTokens(l3, e);
};
k.parseInline = _.parseInline;
k.Parser = b;
k.parser = b.parse;
k.Renderer = P;
k.TextRenderer = $;
k.Lexer = x;
k.lexer = x.lex;
k.Tokenizer = y;
k.Hooks = S;
k.parse = k;
var Zt = k.options;
var Gt = k.setOptions;
var Nt = k.use;
var Ft = k.walkTokens;
var jt = k.parseInline;
var Ut = b.parse;
var Kt = x.lex;

// ../../../easel-handoff-payload/node_modules/.pnpm/dompurify@3.4.16/node_modules/dompurify/dist/purify.es.mjs
function _OverloadYield(e, d2) {
  this.v = e, this.k = d2;
}
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l3) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l3) {
        if (Object(t) !== t) return;
        f = false;
      } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l3); f = true) ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}
function AsyncGenerator(e) {
  var t, n;
  function resume(t2, n2) {
    try {
      var r = e[t2](n2), o = r.value, u = o instanceof _OverloadYield;
      Promise.resolve(u ? o.v : o).then(function(n3) {
        if (u) {
          var i = "return" === t2 && o.k ? t2 : "next";
          if (!o.k || n3.done) return resume(i, n3);
          n3 = e[i](n3).value;
        }
        settle(!!r.done, n3);
      }, function(e2) {
        resume("throw", e2);
      });
    } catch (e2) {
      settle(2, e2);
    }
  }
  function settle(e2, r) {
    2 === e2 ? t.reject(r) : t.resolve({
      value: r,
      done: e2
    }), (t = t.next) ? resume(t.key, t.arg) : n = null;
  }
  this._invoke = function(e2, r) {
    return new Promise(function(o, u) {
      var i = {
        key: e2,
        arg: r,
        resolve: o,
        reject: u,
        next: null
      };
      n ? n = n.next = i : (t = n = i, resume(e2, r));
    });
  }, "function" != typeof e.return && (this.return = void 0);
}
AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
  return this;
}, AsyncGenerator.prototype.next = function(e) {
  return this._invoke("next", e);
}, AsyncGenerator.prototype.throw = function(e) {
  return this._invoke("throw", e);
}, AsyncGenerator.prototype.return = function(e) {
  return this._invoke("return", e);
};
var entries = Object.entries;
var setPrototypeOf = Object.setPrototypeOf;
var isFrozen = Object.isFrozen;
var getPrototypeOf = Object.getPrototypeOf;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var freeze = Object.freeze;
var seal = Object.seal;
var create = Object.create;
var _ref = typeof Reflect !== "undefined" && Reflect;
var apply = _ref.apply;
var construct = _ref.construct;
if (!freeze) freeze = function freeze2(x2) {
  return x2;
};
if (!seal) seal = function seal2(x2) {
  return x2;
};
if (!apply) apply = function apply2(func, thisArg) {
  for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
  return func.apply(thisArg, args);
};
if (!construct) construct = function construct2(Func) {
  for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
  return new Func(...args);
};
var arrayForEach = unapply(Array.prototype.forEach);
Array.prototype.indexOf;
var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
Array.prototype.slice;
var arraySplice = unapply(Array.prototype.splice);
var arrayIsArray = Array.isArray;
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringToString = unapply(String.prototype.toString);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var numberToString = unapply(Number.prototype.toString);
var booleanToString = unapply(Boolean.prototype.toString);
var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
var objectToString = unapply(Object.prototype.toString);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) setPrototypeOf(set, null);
  if (!arrayIsArray(array)) return set;
  let l3 = array.length;
  while (l3--) {
    let element = array[l3];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) array[l3] = lcElement;
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    if (objectHasOwnProperty(object, property)) {
      if (arrayIsArray(value)) newObject[property] = cleanArray(value);
      else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
      else newObject[property] = value;
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return numberToString(value);
    case "boolean":
      return booleanToString(value);
    case "bigint":
      return bigintToString ? bigintToString(value) : "0";
    case "symbol":
      return symbolToString ? symbolToString(value) : "Symbol()";
    case "undefined":
      return objectToString(value);
    case "function":
    case "object": {
      if (value === null) return objectToString(value);
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default:
      return objectToString(value);
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) return unapply(desc.get);
      if (typeof desc.value === "function") return unapply(desc.value);
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
var html$1 = freeze([
  "a",
  "abbr",
  "acronym",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "bdi",
  "bdo",
  "big",
  "blink",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "content",
  "data",
  "datalist",
  "dd",
  "decorator",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "element",
  "em",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meter",
  "nav",
  "nobr",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "search",
  "section",
  "select",
  "shadow",
  "slot",
  "small",
  "source",
  "spacer",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
]);
var svg$1 = freeze([
  "svg",
  "a",
  "altglyph",
  "altglyphdef",
  "altglyphitem",
  "animatecolor",
  "animatemotion",
  "animatetransform",
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "enterkeyhint",
  "exportparts",
  "filter",
  "font",
  "g",
  "glyph",
  "glyphref",
  "hkern",
  "image",
  "inputmode",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "part",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "stop",
  "style",
  "switch",
  "symbol",
  "text",
  "textpath",
  "title",
  "tref",
  "tspan",
  "view",
  "vkern"
]);
var svgFilters = freeze([
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence"
]);
var svgDisallowed = freeze([
  "animate",
  "color-profile",
  "cursor",
  "discard",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "foreignobject",
  "hatch",
  "hatchpath",
  "mesh",
  "meshgradient",
  "meshpatch",
  "meshrow",
  "missing-glyph",
  "script",
  "set",
  "solidcolor",
  "unknown",
  "use"
]);
var mathMl$1 = freeze([
  "math",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msup",
  "msubsup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "mprescripts"
]);
var mathMlDisallowed = freeze([
  "maction",
  "maligngroup",
  "malignmark",
  "mlongdiv",
  "mscarries",
  "mscarry",
  "msgroup",
  "mstack",
  "msline",
  "msrow",
  "semantics",
  "annotation",
  "annotation-xml",
  "mprescripts",
  "none"
]);
var text = freeze(["#text"]);
var html = freeze([
  "accept",
  "action",
  "align",
  "alt",
  "autocapitalize",
  "autocomplete",
  "autopictureinpicture",
  "autoplay",
  "background",
  "bgcolor",
  "border",
  "capture",
  "cellpadding",
  "cellspacing",
  "checked",
  "cite",
  "class",
  "clear",
  "color",
  "cols",
  "colspan",
  "command",
  "commandfor",
  "controls",
  "controlslist",
  "coords",
  "crossorigin",
  "datetime",
  "decoding",
  "default",
  "dir",
  "disabled",
  "disablepictureinpicture",
  "disableremoteplayback",
  "download",
  "draggable",
  "enctype",
  "enterkeyhint",
  "exportparts",
  "face",
  "for",
  "headers",
  "height",
  "hidden",
  "high",
  "href",
  "hreflang",
  "id",
  "inert",
  "inputmode",
  "integrity",
  "ismap",
  "kind",
  "label",
  "lang",
  "list",
  "loading",
  "loop",
  "low",
  "max",
  "maxlength",
  "media",
  "method",
  "min",
  "minlength",
  "multiple",
  "muted",
  "name",
  "nonce",
  "noshade",
  "novalidate",
  "nowrap",
  "open",
  "optimum",
  "part",
  "pattern",
  "placeholder",
  "playsinline",
  "popover",
  "popovertarget",
  "popovertargetaction",
  "poster",
  "preload",
  "pubdate",
  "radiogroup",
  "readonly",
  "rel",
  "required",
  "rev",
  "reversed",
  "role",
  "rows",
  "rowspan",
  "spellcheck",
  "scope",
  "selected",
  "shape",
  "size",
  "sizes",
  "slot",
  "span",
  "srclang",
  "start",
  "src",
  "srcset",
  "step",
  "style",
  "summary",
  "tabindex",
  "title",
  "translate",
  "type",
  "usemap",
  "valign",
  "value",
  "width",
  "wrap",
  "xmlns"
]);
var svg2 = freeze([
  "accent-height",
  "accumulate",
  "additive",
  "alignment-baseline",
  "amplitude",
  "ascent",
  "attributename",
  "attributetype",
  "azimuth",
  "basefrequency",
  "baseline-shift",
  "begin",
  "bias",
  "by",
  "class",
  "clip",
  "clippathunits",
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-profile",
  "color-rendering",
  "cx",
  "cy",
  "d",
  "dx",
  "dy",
  "diffuseconstant",
  "direction",
  "display",
  "divisor",
  "dominant-baseline",
  "dur",
  "edgemode",
  "elevation",
  "end",
  "exponent",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "filterunits",
  "flood-color",
  "flood-opacity",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "fx",
  "fy",
  "g1",
  "g2",
  "glyph-name",
  "glyphref",
  "gradientunits",
  "gradienttransform",
  "height",
  "href",
  "id",
  "image-rendering",
  "in",
  "in2",
  "intercept",
  "k",
  "k1",
  "k2",
  "k3",
  "k4",
  "kerning",
  "keypoints",
  "keysplines",
  "keytimes",
  "lang",
  "lengthadjust",
  "letter-spacing",
  "kernelmatrix",
  "kernelunitlength",
  "lighting-color",
  "local",
  "marker-end",
  "marker-mid",
  "marker-start",
  "markerheight",
  "markerunits",
  "markerwidth",
  "maskcontentunits",
  "maskunits",
  "max",
  "mask",
  "mask-type",
  "media",
  "method",
  "mode",
  "min",
  "name",
  "numoctaves",
  "offset",
  "operator",
  "opacity",
  "order",
  "orient",
  "orientation",
  "origin",
  "overflow",
  "paint-order",
  "path",
  "pathlength",
  "patterncontentunits",
  "patterntransform",
  "patternunits",
  "pointer-events",
  "points",
  "preservealpha",
  "preserveaspectratio",
  "primitiveunits",
  "r",
  "rx",
  "ry",
  "radius",
  "refx",
  "refy",
  "repeatcount",
  "repeatdur",
  "restart",
  "result",
  "rotate",
  "scale",
  "seed",
  "shape-rendering",
  "slope",
  "specularconstant",
  "specularexponent",
  "spreadmethod",
  "startoffset",
  "stddeviation",
  "stitchtiles",
  "stop-color",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke",
  "stroke-width",
  "style",
  "surfacescale",
  "systemlanguage",
  "tabindex",
  "tablevalues",
  "targetx",
  "targety",
  "transform",
  "transform-origin",
  "text-anchor",
  "text-decoration",
  "text-orientation",
  "text-rendering",
  "textlength",
  "type",
  "u1",
  "u2",
  "unicode",
  "values",
  "vector-effect",
  "viewbox",
  "visibility",
  "version",
  "vert-adv-y",
  "vert-origin-x",
  "vert-origin-y",
  "width",
  "word-spacing",
  "wrap",
  "writing-mode",
  "xchannelselector",
  "ychannelselector",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
  "z",
  "zoomandpan"
]);
var mathMl = freeze([
  "accent",
  "accentunder",
  "align",
  "bevelled",
  "close",
  "columnalign",
  "columnlines",
  "columnspacing",
  "columnspan",
  "denomalign",
  "depth",
  "dir",
  "display",
  "displaystyle",
  "encoding",
  "fence",
  "frame",
  "height",
  "href",
  "id",
  "largeop",
  "length",
  "linethickness",
  "lquote",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "maxsize",
  "minsize",
  "movablelimits",
  "notation",
  "numalign",
  "open",
  "rowalign",
  "rowlines",
  "rowspacing",
  "rowspan",
  "rspace",
  "rquote",
  "scriptlevel",
  "scriptminsize",
  "scriptsizemultiplier",
  "selection",
  "separator",
  "separators",
  "stretchy",
  "subscriptshift",
  "supscriptshift",
  "symmetric",
  "voffset",
  "width",
  "xmlns"
]);
var xml = freeze([
  "xlink:href",
  "xml:id",
  "xlink:title",
  "xml:space",
  "xmlns:xlink"
]);
var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
var DOCTYPE_NAME = seal(/^html$/i);
var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
var SELF_CLOSING_TAG = seal(/\/>/i);
var NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  entityNode: 6,
  processingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
};
var LITERAL_TEXT_ELEMENT_NAMES = [
  "style",
  "script",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "noscript"
];
var LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, LITERAL_TEXT_ELEMENT_NAMES));
var LITERAL_TEXT_CLOSE = function() {
  const map = {};
  arrayForEach(LITERAL_TEXT_ELEMENT_NAMES, (name) => {
    map[name] = seal(new RegExp("</" + name + "(?=[\\t\\n\\f\\r />])", "i"));
  });
  return freeze(map);
}();
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_2) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
var _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
var _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
};
var _resolveObjectOption = function _resolveObjectOption2(cfg, key, makeFallback) {
  const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
  return value && typeof value === "object" ? clone(value) : makeFallback();
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.16";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const HTMLTemplateElement = window2.HTMLTemplateElement, Node2 = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter;
  window2.NamedNodeMap === void 0 && (window2.NamedNodeMap || window2.MozNamedAttrMap);
  window2.HTMLFormElement;
  const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
  const ElementPrototype = Element.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "nodeType") : null;
  const getNodeName = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "nodeName") : null;
  const getOwnerDocument = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "ownerDocument") : null;
  const _readNodeType = function _readNodeType2(node) {
    return getNodeType ? getNodeType(node) : node.nodeType;
  };
  const _readNodeName = function _readNodeName2(node) {
    return getNodeName ? getNodeName(node) : node.nodeName;
  };
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) document2 = template.content.ownerDocument;
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
    if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
  };
  const _createTrustedHTML = function _createTrustedHTML2(html2) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html2);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [
    ...html$1,
    ...svg$1,
    ...svgFilters,
    ...mathMl$1,
    ...text
  ]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [
    ...html,
    ...svg2,
    ...mathMl,
    ...xml
  ]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, [
    "audio",
    "video",
    "img",
    "source",
    "image",
    "track"
  ]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
    "alt",
    "class",
    "for",
    "id",
    "label",
    "name",
    "pattern",
    "placeholder",
    "role",
    "summary",
    "title",
    "value",
    "style",
    "xmlns"
  ]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
    MATHML_NAMESPACE,
    SVG_NAMESPACE,
    HTML_NAMESPACE
  ], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext"
  ]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
    "title",
    "style",
    "font",
    "a",
    "script"
  ]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction2(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig2() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) return;
    if (!cfg || typeof cfg !== "object") cfg = {};
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
    HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
    const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
    if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg2);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg2);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
    if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
      "html",
      "head",
      "body"
    ]);
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = void 0;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
    }
    if (freeze) freeze(cfg);
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [
    ...svg$1,
    ...svgFilters,
    ...svgDisallowed
  ]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
    if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
    if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace2(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) parent = {
      namespaceURI: NAMESPACE,
      tagName: "template"
    };
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) return false;
    if (element.namespaceURI === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
    if (element.namespaceURI === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
    if (element.namespaceURI === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) return true;
    return false;
  };
  const _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, { element: node });
    try {
      getParentNode(node).removeChild(node);
    } catch (_2) {
      remove(node);
      if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
    }
  };
  const _stripAttributeNode = function _stripAttributeNode2(element, attribute, name) {
    try {
      removeAttributeNode(element, attribute);
    } catch (_2) {
      try {
        element.removeAttribute(name);
      } catch (_3) {
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot2(root) {
    _neutralizeSubtree(root);
    const childNodes = getChildNodes(root);
    if (childNodes) {
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      arrayForEach(snapshot, (child) => {
        try {
          remove(child);
        } catch (_2) {
        }
      });
    }
    const attributes = getAttributes(root);
    if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name === "string") _stripAttributeNode(root, attribute, name);
    }
  };
  const _removeAttribute = function _removeAttribute2(name, element, attr) {
    if (!attr) try {
      attr = element.getAttributeNode(name);
    } catch (_2) {
      attr = null;
    }
    arrayPush(DOMPurify.removed, {
      attribute: attr || null,
      from: element
    });
    try {
      if (attr) removeAttributeNode(element, attr);
      else element.removeAttribute(name);
    } catch (_2) {
      try {
        element.removeAttribute(name);
      } catch (_3) {
      }
    }
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
        _forceRemove(element);
      } catch (_2) {
      }
      else try {
        element.setAttribute(name, "");
      } catch (_2) {
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
    const attributes = getAttributes(element);
    if (!attributes) return;
    for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
      _stripAttributeNode(element, attribute, name);
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree2(root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
    }
  };
  const _isPatchLinkageAttribute = function _isPatchLinkageAttribute2(lcName, lcTag) {
    if (!SAFE_FOR_XML) return false;
    if (lcName === "patchsrc") return true;
    return lcName === "for" && lcTag !== "label" && lcTag !== "output";
  };
  const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
    if (!SAFE_FOR_XML) return;
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = _readNodeType(node);
      if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
        try {
          remove(node);
        } catch (_2) {
        }
        continue;
      }
      if (nodeType === NODE_TYPE.element) {
        const element = node;
        const lcTag = transformCaseFunc(_readNodeName(node));
        try {
          if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
          if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
        } catch (_2) {
        }
      }
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
    }
  };
  const _initDocument = function _initDocument2(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
    else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) try {
      doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
    } catch (_2) {
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_2) {
      }
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator2(root) {
    const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
    return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    node.normalize();
    const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
    const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
    if (templates) arrayForEach(templates, (tmpl) => {
      if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
    });
  };
  const _isClobbered = function _isClobbered2(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") return false;
    if (transformCaseFunc(realTagName) !== "form") return false;
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.removeAttributeNode !== "function" || typeof element.getAttributeNode !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) return false;
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_2) {
      return false;
    }
  };
  const _isNode = function _isNode2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) return false;
    try {
      return typeof getNodeType(value) === "number";
    } catch (_2) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) return;
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
    if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && LITERAL_TEXT_ELEMENTS[tagName] && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(LITERAL_TEXT_CLOSE[tagName], currentNode.textContent))) return true;
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
    return false;
  };
  const _matchesNameCheck = function _matchesNameCheck2(check, name) {
    if (check instanceof RegExp) return regExpTest(check, name);
    if (check instanceof Function) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
      return Boolean(check(name, ...args));
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName, root) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1; i >= 0; --i) {
          const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _forkSharedAllowlist = function _forkSharedAllowlist2(hookList, set, defaultSet, setConfigSet) {
    if (hookList.length === 0) return set;
    return set === defaultSet || set === setConfigSet ? clone(set) : set;
  };
  const _handleHookDetachedNode = function _handleHookDetachedNode2(currentNode, root) {
    if (currentNode === root || getParentNode(currentNode) !== null) return false;
    if (IN_PLACE) _neutralizeSubtree(currentNode);
    return true;
  };
  const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) return true;
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(_readNodeName(currentNode));
    ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (_handleHookDetachedNode(currentNode, root)) return true;
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
      const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
      if (removed === false) {
        _executeHooks(hooks.afterSanitizeElements, currentNode, null);
        if (_handleHookDetachedNode(currentNode, root)) return true;
      }
      return removed;
    }
    if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return _handleHookDetachedNode(currentNode, root);
  };
  const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) return false;
    if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) return false;
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
    if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
    if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
    if (URI_SAFE_ATTRIBUTES[lcName]) return true;
    if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
    if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
    if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
    return !value;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
    "annotation-xml",
    "color-profile",
    "font-face",
    "font-face-format",
    "font-face-name",
    "font-face-src",
    "font-face-uri",
    "missing-glyph"
  ]);
  const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
      case "TrustedHTML":
        return _createTrustedHTML(value);
      case "TrustedScriptURL":
        return _createTrustedScriptURL(value);
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue2(currentNode, name, namespaceURI, value) {
    try {
      if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
      else currentNode.setAttribute(name, value);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return false;
      }
      return true;
    } catch (_2) {
      _removeAttribute(name, currentNode);
      return false;
    }
  };
  const _sanitizeAttributes = function _sanitizeAttributes2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) return;
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) return;
    ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: void 0
    };
    let l3 = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l3--) {
      const attr = attributes[l3];
      const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      let recreatedNamedProp = false;
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name, currentNode, attr);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
        recreatedNamedProp = true;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (hookEvent.forceKeepAttr) continue;
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    _handleHookDetachedNode(currentNode, root);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode, fragment);
      _sanitizeAttributes(shadowNode, fragment);
      if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
      if (_readNodeType(shadowNode) === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const isElement = _readNodeType(node) === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
        node: childNodes[i],
        shadow: null
      });
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) stack.push({
            node: content,
            shadow: null
          });
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) stack.push({
          node: null,
          shadow: sr
        }, {
          node: sr,
          shadow: null
        });
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) dirty = "<!-->";
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
    }
    if (!DOMPurify.isSupported) return dirty;
    if (SET_CONFIG) {
      ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else _parseConfig(cfg);
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
    if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    if (inPlace) {
      _neutralizePatchLinkage(dirty);
      const nn = _readNodeName(dirty);
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        _neutralizeRoot(dirty);
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      try {
        _sanitizeAttachedShadowRoots(dirty);
      } catch (error) {
        _neutralizeRoot(dirty);
        throw error;
      }
    } else if (_isNode(dirty)) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
      else if (importedNode.nodeName === "HTML") body = importedNode;
      else body.appendChild(importedNode);
      _sanitizeAttachedShadowRoots(body);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      body = _initDocument(dirty);
      if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
    }
    if (body && FORCE_BODY) _forceRemove(body.firstChild);
    const walkRoot = inPlace ? dirty : body;
    try {
      const nodeIterator = _createNodeIterator(walkRoot);
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode, walkRoot);
        _sanitizeAttributes(currentNode, walkRoot);
        if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
      }
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) _neutralizeSubtree(entry.element);
        });
      }
      throw error;
    }
    if (inPlace) {
      let rootWasRemoved = false;
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          if (entry.element === dirty) rootWasRemoved = true;
          _neutralizeSubtree(entry.element);
        }
      });
      if (rootWasRemoved) throw typeErrorCreate("a node selected for removal could not be safely returned; refusing to sanitize in place");
      if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) returnNode.appendChild(body.firstChild);
      } else returnNode = body;
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
    if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) _parseConfig({});
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") return;
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    if (hookFunction !== void 0) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify_default = createDOMPurify();

// src/lib/sanitize.ts
k.setOptions({ breaks: true, gfm: true });
function renderMarkdown(md) {
  if (!md) return "";
  const raw = k.parse(md);
  return purify_default.sanitize(raw);
}

// src/components/IdeasPage.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var COLUMNS = [
  { key: "pending", label: "\u5F85\u505A", color: "var(--text-tertiary)" },
  { key: "doing", label: "\u8FDB\u884C\u4E2D", color: "var(--layer-attribute)" },
  { key: "project", label: "\u5DF2\u7ACB\u9879", color: "var(--accent, #7c5cff)" },
  { key: "done", label: "\u5DF2\u5B8C\u6210", color: "var(--layer-publish)" }
];
var NEXT = { pending: "doing", doing: "done", done: "pending" };
var EMPTY = { title: "", note: "", source: "", status: "pending" };
function IdeasPage({ onUseTopic }) {
  const [ideas, setIdeas] = (0, import_react4.useState)([]);
  const [form, setForm] = (0, import_react4.useState)(null);
  const [editId, setEditId] = (0, import_react4.useState)(null);
  const [toast, setToast] = (0, import_react4.useState)("");
  const [greenlight, setGreenlight] = (0, import_react4.useState)(null);
  const [personas, setPersonas] = (0, import_react4.useState)([]);
  const [personaPick, setPersonaPick] = (0, import_react4.useState)("");
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const load = (0, import_react4.useCallback)(() => {
    fetchIdeas().then(setIdeas).catch(() => {
    });
  }, []);
  (0, import_react4.useEffect)(() => {
    load();
  }, [load]);
  const showToast = (m2) => {
    setToast(m2);
    setTimeout(() => setToast(""), 2200);
  };
  const [bodyPreview, setBodyPreview] = (0, import_react4.useState)(null);
  const openBody = async (it) => {
    setBodyPreview({ idea: it, content: "", error: "" });
    try {
      const file = await fetchOutputContent(it.bodyPath);
      const error = file.isBinary ? "\u8BE5\u6587\u4EF6\u4E0D\u662F\u6587\u672C" : "";
      setBodyPreview({ idea: it, content: error === "" ? file.content : "", error });
    } catch (e) {
      setBodyPreview({ idea: it, content: "", error: e instanceof Error ? e.message : "\u6B63\u6587\u8BFB\u53D6\u5931\u8D25\uFF08\u6587\u4EF6\u53EF\u80FD\u5DF2\u5220\u9664\uFF09" });
    }
  };
  const byStatus = (0, import_react4.useMemo)(() => {
    const g = { pending: [], doing: [], project: [], done: [] };
    for (const it of ideas) (g[it.status] || g.pending).push(it);
    return g;
  }, [ideas]);
  const openNew = () => {
    setEditId(null);
    setForm({ ...EMPTY });
  };
  const openEdit = (it) => {
    setEditId(it.id);
    setForm({ title: it.title, note: it.note, source: it.source, status: it.status });
  };
  const save = async () => {
    if (!form || !form.title.trim()) return;
    if (editId) await updateIdea(editId, form);
    else await createIdea(form);
    setForm(null);
    setEditId(null);
    load();
  };
  const openGreenlight = async (it) => {
    setGreenlight(it);
    setPersonaPick("");
    const status = await fetchStatus();
    const list = status?.personas ?? [];
    setPersonas(list);
    if (list.length === 1) setPersonaPick(list[0].name);
  };
  const confirmGreenlight = async () => {
    const it = greenlight;
    if (!it || busy) return;
    setBusy(true);
    try {
      const status = await fetchStatus();
      const root = status?.projectRoot ?? "";
      if (!root) throw new Error("\u62FF\u4E0D\u5230\u9879\u76EE\u6839");
      const { safe } = await projectizeTopic({
        ideaId: it.id,
        title: it.title,
        note: it.note,
        source: it.source,
        fallback: it.id,
        deconstruct: it.deconstruct,
        persona: personaPick
      });
      const ws = getWorkspaceService();
      if (!ws) throw new Error("\u5DE5\u4F5C\u533A\u670D\u52A1\u4E0D\u53EF\u8FBE");
      try {
        await ws.create({ path: `${root.replace(/[\/]+$/, "")}/projects/${safe}/` });
      } catch {
      }
      setGreenlight(null);
      showToast("\u5DF2\u7ACB\u9879\uFF1A\u8D44\u6599\u5DF2\u88C5\u5165\u9879\u76EE\u5DE5\u4F5C\u533A");
      load();
    } catch (error) {
      showToast(`\u7ACB\u9879\u5931\u8D25\uFF1A${error.message ?? error}`);
    } finally {
      setBusy(false);
    }
  };
  const advance = async (it) => {
    await updateIdea(it.id, { ...it, status: NEXT[it.status] });
    load();
  };
  const remove = async (it) => {
    await deleteIdea(it.id);
    load();
  };
  const schedule = async (it) => {
    const d2 = /* @__PURE__ */ new Date();
    await createSchedule({ title: it.title, date: d2.toISOString().slice(0, 10), platform: "", time: "", status: "idea", note: it.note });
    showToast("\u5DF2\u52A0\u5165\u65E5\u5386\uFF08\u4ECA\u5929\uFF09");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "page-scroll ideas-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h1", { className: "page-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconIdea, { size: 21 }),
          " \u9009\u9898\u5E93"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "page-subtitle", children: "\u6512\u4F4F\u6BCF\u4E00\u4E2A\u7075\u611F\u2014\u2014\u4ECE\u70ED\u70B9\u6536\u85CF\u6216\u624B\u52A8\u65B0\u589E\uFF0C\u63A8\u8FDB\u5230\u300C\u505A\u5185\u5BB9\u300D\u518D\u8FDB\u65E5\u5386\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "btn btn-sm btn-primary", onClick: openNew, children: "+ \u65B0\u5EFA\u9009\u9898" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "kanban", children: COLUMNS.map((col) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "kanban-col", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "kanban-col-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "kanban-dot", style: { background: col.color } }),
        col.label,
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "kanban-count", children: byStatus[col.key].length })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "kanban-list", children: [
        byStatus[col.key].length === 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "kanban-empty", children: "\u62D6\u70B9\u9009\u9898\u8FDB\u6765\u5427" }),
        byStatus[col.key].map((it) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "card idea-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "idea-card-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "session-act", title: "\u7F16\u8F91", onClick: () => openEdit(it), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconEdit, { size: 13 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "session-act danger", title: "\u5220\u9664", onClick: () => remove(it), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconTrash, { size: 13 }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "idea-title", children: it.title }),
          it.source && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "badge", style: { marginTop: 6 }, children: it.source }),
          it.note && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "idea-note", children: it.note }),
          (it.bodyPath || it.url) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "idea-links", children: [
            it.bodyPath && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "idea-link", onClick: () => openBody(it), children: "\u6B63\u6587" }),
            it.url && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("a", { className: "idea-link", href: it.url, target: "_blank", rel: "noreferrer", children: "\u539F\u6587" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "idea-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "idea-act", onClick: () => onUseTopic(it.title, it.projectDir, it.bodyPath), children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconChat, { size: 13 }),
              " \u505A\u5185\u5BB9"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "idea-act", onClick: () => schedule(it), children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconCalendar, { size: 13 }),
              " \u6392\u671F"
            ] }),
            it.status !== "project" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "idea-act", title: "\u786E\u8BA4\u7ACB\u9879\uFF1A\u5EFA\u540C\u540D\u5DE5\u4F5C\u533A\u5E76\u88C5\u914D\u8D44\u6599", onClick: () => openGreenlight(it), children: "\u{1F6A9} \u7ACB\u9879" }),
            it.status !== "project" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "idea-act next", onClick: () => advance(it), title: "\u63A8\u8FDB\u72B6\u6001", children: [
              COLUMNS.find((c) => c.key === NEXT[it.status])?.label,
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconChevron, { size: 12 })
            ] })
          ] })
        ] }, it.id))
      ] })
    ] }, col.key)) }),
    form && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "overlay", onClick: () => setForm(null), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "modal", style: { width: 440, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { style: { margin: 0 }, children: editId ? "\u7F16\u8F91\u9009\u9898" : "\u65B0\u5EFA\u9009\u9898" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "icon-btn", onClick: () => setForm(null), children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "field-label", children: "\u9009\u9898 *" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "input",
        {
          className: "field",
          value: form.title,
          autoFocus: true,
          placeholder: "\u60F3\u505A\u7684\u5185\u5BB9 / \u89D2\u5EA6",
          onChange: (e) => setForm({ ...form, title: e.target.value })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "field-label", children: "\u5907\u6CE8 / \u89D2\u5EA6" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          className: "field",
          style: { minHeight: 70 },
          value: form.note,
          onChange: (e) => setForm({ ...form, note: e.target.value })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "field-label", children: "\u6765\u6E90" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "input",
        {
          className: "field",
          value: form.source,
          placeholder: "\u5982\uFF1A\u5FAE\u535A\u70ED\u641C / \u7075\u611F",
          onChange: (e) => setForm({ ...form, source: e.target.value })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "field-label", children: "\u72B6\u6001" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", gap: 7 }, children: COLUMNS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          className: `chip ${form.status === c.key ? "active" : ""}`,
          onClick: () => setForm({ ...form, status: c.key }),
          children: c.label
        },
        c.key
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "btn btn-sm", onClick: () => setForm(null), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "btn btn-sm btn-primary", onClick: save, disabled: !form.title.trim(), children: "\u4FDD\u5B58" })
      ] })
    ] }) }),
    bodyPreview && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "overlay", onClick: () => setBodyPreview(null), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "modal", style: { width: 760, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { style: { margin: 0, fontSize: 15 }, children: bodyPreview.idea.title }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "icon-btn", onClick: () => setBodyPreview(null), children: "\xD7" })
      ] }),
      bodyPreview.error !== "" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: "var(--red)", fontSize: 12.5, padding: "12px 0" }, children: bodyPreview.error }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          className: "idea-body-preview outputs-viewer-content",
          dangerouslySetInnerHTML: { __html: renderMarkdown(bodyPreview.content) }
        }
      )
    ] }) }),
    greenlight && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "overlay", onClick: () => setGreenlight(null), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "modal", style: { width: 420, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h3", { style: { margin: 0 }, children: [
          "\u7ACB\u9879\uFF1A",
          greenlight.title.slice(0, 20),
          greenlight.title.length > 20 ? "\u2026" : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "icon-btn", onClick: () => setGreenlight(null), children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: { margin: "6px 0 12px", fontSize: 12.5, color: "var(--text-secondary)" }, children: [
        "\u5C06\u5EFA\u540C\u540D\u9879\u76EE\u5DE5\u4F5C\u533A\u5E76\u88C5\u914D\u8D44\u6599",
        greenlight.deconstruct ? "\uFF08\u62C6\u89E3\u62A5\u544A\u3001\u5B57\u5E55\u3001\u89C6\u9891\u4E0E\u5173\u952E\u5E27\uFF09" : "",
        "\uFF0C \u8D26\u6237\u753B\u50CF\u6309\u4E0B\u9009\u62E9\u5E26\u5165\u5FEB\u7167\u3002\u4FA7\u680F\u51FA\u73B0\u540C\u540D\u5DE5\u4F5C\u533A\u5206\u7EC4\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: "field-label", children: "\u8D26\u6237\u753B\u50CF" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { className: "field", value: personaPick, onChange: (e) => setPersonaPick(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "", children: "\u4E0D\u5E26\u5165" }),
        personas.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("option", { value: p.name, children: [
          p.name,
          p.description ? ` \u2014 ${p.description}` : ""
        ] }, p.name))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "btn btn-sm", onClick: () => setGreenlight(null), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "btn btn-sm btn-primary", onClick: confirmGreenlight, disabled: busy, children: "\u{1F6A9} \u786E\u8BA4\u7ACB\u9879" })
      ] })
    ] }) }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "toast ok", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "toast-icon", children: "\u2713" }),
      toast
    ] })
  ] });
}

// src/features/ideas.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var view3 = "ideas";
var order3 = 32;
var labels3 = { zh: "\u9009\u9898\u5E93", en: "Ideas" };
var Icon3 = IconIdea;
var Component3 = IdeasPage;
var plugin3 = {
  name: "easel-view-ideas",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view3),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Component3, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view3),
      order: order3,
      locale: "easel.panel",
      label: () => t(view3)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon3, { size });
    }));
  }
};

// src/features/calendar.tsx
var calendar_exports = {};
__export(calendar_exports, {
  Component: () => Component4,
  Icon: () => Icon4,
  labels: () => labels4,
  order: () => order4,
  plugin: () => plugin4,
  view: () => view4
});

// src/components/CalendarPage.tsx
var import_react5 = require("react");

// src/data/holidays-cn.js
var HOLIDAYS_CN = {
  2025: {
    "2025-01-01": ["\u5143\u65E6", 1],
    "2025-01-26": ["\u6625\u8282", 0],
    "2025-01-28": ["\u6625\u8282", 1],
    "2025-01-29": ["\u6625\u8282", 1],
    "2025-01-30": ["\u6625\u8282", 1],
    "2025-01-31": ["\u6625\u8282", 1],
    "2025-02-01": ["\u6625\u8282", 1],
    "2025-02-02": ["\u6625\u8282", 1],
    "2025-02-03": ["\u6625\u8282", 1],
    "2025-02-04": ["\u6625\u8282", 1],
    "2025-02-08": ["\u6625\u8282", 0],
    "2025-04-04": ["\u6E05\u660E\u8282", 1],
    "2025-04-05": ["\u6E05\u660E\u8282", 1],
    "2025-04-06": ["\u6E05\u660E\u8282", 1],
    "2025-04-27": ["\u52B3\u52A8\u8282", 0],
    "2025-05-01": ["\u52B3\u52A8\u8282", 1],
    "2025-05-02": ["\u52B3\u52A8\u8282", 1],
    "2025-05-03": ["\u52B3\u52A8\u8282", 1],
    "2025-05-04": ["\u52B3\u52A8\u8282", 1],
    "2025-05-05": ["\u52B3\u52A8\u8282", 1],
    "2025-05-31": ["\u7AEF\u5348\u8282", 1],
    "2025-06-01": ["\u7AEF\u5348\u8282", 1],
    "2025-06-02": ["\u7AEF\u5348\u8282", 1],
    "2025-09-28": ["\u56FD\u5E86\u8282", 0],
    "2025-10-01": ["\u56FD\u5E86\u8282", 1],
    "2025-10-02": ["\u56FD\u5E86\u8282", 1],
    "2025-10-03": ["\u56FD\u5E86\u8282", 1],
    "2025-10-04": ["\u56FD\u5E86\u8282", 1],
    "2025-10-05": ["\u56FD\u5E86\u8282", 1],
    "2025-10-06": ["\u4E2D\u79CB\u8282", 1],
    "2025-10-07": ["\u56FD\u5E86\u8282", 1],
    "2025-10-08": ["\u56FD\u5E86\u8282", 1],
    "2025-10-11": ["\u56FD\u5E86\u8282", 0]
  },
  2026: {
    "2026-01-01": ["\u5143\u65E6", 1],
    "2026-01-02": ["\u5143\u65E6", 1],
    "2026-01-03": ["\u5143\u65E6", 1],
    "2026-01-04": ["\u5143\u65E6", 0],
    "2026-02-14": ["\u6625\u8282", 0],
    "2026-02-15": ["\u6625\u8282", 1],
    "2026-02-16": ["\u6625\u8282", 1],
    "2026-02-17": ["\u6625\u8282", 1],
    "2026-02-18": ["\u6625\u8282", 1],
    "2026-02-19": ["\u6625\u8282", 1],
    "2026-02-20": ["\u6625\u8282", 1],
    "2026-02-21": ["\u6625\u8282", 1],
    "2026-02-22": ["\u6625\u8282", 1],
    "2026-02-23": ["\u6625\u8282", 1],
    "2026-02-28": ["\u6625\u8282", 0],
    "2026-04-04": ["\u6E05\u660E\u8282", 1],
    "2026-04-05": ["\u6E05\u660E\u8282", 1],
    "2026-04-06": ["\u6E05\u660E\u8282", 1],
    "2026-05-01": ["\u52B3\u52A8\u8282", 1],
    "2026-05-02": ["\u52B3\u52A8\u8282", 1],
    "2026-05-03": ["\u52B3\u52A8\u8282", 1],
    "2026-05-04": ["\u52B3\u52A8\u8282", 1],
    "2026-05-05": ["\u52B3\u52A8\u8282", 1],
    "2026-05-09": ["\u52B3\u52A8\u8282", 0],
    "2026-06-19": ["\u7AEF\u5348\u8282", 1],
    "2026-06-20": ["\u7AEF\u5348\u8282", 1],
    "2026-06-21": ["\u7AEF\u5348\u8282", 1],
    "2026-09-20": ["\u56FD\u5E86\u8282", 0],
    "2026-09-25": ["\u4E2D\u79CB\u8282", 1],
    "2026-09-26": ["\u4E2D\u79CB\u8282", 1],
    "2026-09-27": ["\u4E2D\u79CB\u8282", 1],
    "2026-10-01": ["\u56FD\u5E86\u8282", 1],
    "2026-10-02": ["\u56FD\u5E86\u8282", 1],
    "2026-10-03": ["\u56FD\u5E86\u8282", 1],
    "2026-10-04": ["\u56FD\u5E86\u8282", 1],
    "2026-10-05": ["\u56FD\u5E86\u8282", 1],
    "2026-10-06": ["\u56FD\u5E86\u8282", 1],
    "2026-10-07": ["\u56FD\u5E86\u8282", 1],
    "2026-10-10": ["\u56FD\u5E86\u8282", 0]
  }
};

// src/lib/lunar.js
var LUNAR_INFO = [
  19416,
  19168,
  42352,
  21717,
  53856,
  55632,
  91476,
  22176,
  39632,
  21970,
  // 1900-1909
  19168,
  42422,
  42192,
  53840,
  119381,
  46400,
  54944,
  44450,
  38320,
  84343,
  // 1910-1919
  18800,
  42160,
  46261,
  27216,
  27968,
  109396,
  11104,
  38256,
  21234,
  18800,
  // 1920-1929
  25958,
  54432,
  59984,
  28309,
  23248,
  11104,
  100067,
  37600,
  116951,
  51536,
  // 1930-1939
  54432,
  120998,
  46416,
  22176,
  107956,
  9680,
  37584,
  53938,
  43344,
  46423,
  // 1940-1949
  27808,
  46416,
  86869,
  19872,
  42416,
  83315,
  21168,
  43432,
  59728,
  27296,
  // 1950-1959
  44710,
  43856,
  19296,
  43748,
  42352,
  21088,
  62051,
  55632,
  23383,
  22176,
  // 1960-1969
  38608,
  19925,
  19152,
  42192,
  54484,
  53840,
  54616,
  46400,
  46752,
  103846,
  // 1970-1979
  38320,
  18864,
  43380,
  42160,
  45690,
  27216,
  27968,
  44870,
  43872,
  38256,
  // 1980-1989
  19189,
  18800,
  25776,
  29859,
  59984,
  27480,
  23232,
  43872,
  38613,
  37600,
  // 1990-1999
  51552,
  55636,
  54432,
  55888,
  30034,
  22176,
  43959,
  9680,
  37584,
  51893,
  // 2000-2009
  43344,
  46240,
  47780,
  44368,
  21977,
  19360,
  42416,
  86390,
  21168,
  43312,
  // 2010-2019
  31060,
  27296,
  44368,
  23378,
  19296,
  42726,
  42208,
  53856,
  60005,
  54576,
  // 2020-2029
  23200,
  30371,
  38608,
  19195,
  19152,
  42192,
  118966,
  53840,
  54560,
  56645,
  // 2030-2039
  46496,
  22224,
  21938,
  18864,
  42359,
  42160,
  43600,
  111189,
  27936,
  44448,
  // 2040-2049
  84835,
  37744,
  18936,
  18800,
  25776,
  92326,
  59984,
  27424,
  108228,
  43744,
  // 2050-2059
  41696,
  53987,
  51552,
  54615,
  54432,
  55888,
  23893,
  22176,
  42704,
  21972,
  // 2060-2069
  21200,
  43448,
  43344,
  46240,
  46758,
  44368,
  21920,
  43940,
  42416,
  21168,
  // 2070-2079
  45683,
  26928,
  29495,
  27296,
  44368,
  84821,
  19296,
  42352,
  21732,
  53600,
  // 2080-2089
  59752,
  54560,
  55968,
  92838,
  22224,
  19168,
  43476,
  41680,
  53584,
  62034,
  // 2090-2099
  54560
  // 2100
];
var BASE_UTC = Date.UTC(1900, 0, 31);
function lunarLeapMonth(year) {
  return LUNAR_INFO[year - 1900] & 15;
}
function lunarLeapDays(year) {
  if (lunarLeapMonth(year) === 0) return 0;
  return LUNAR_INFO[year - 1900] & 65536 ? 30 : 29;
}
function lunarMonthDays(year, month) {
  return LUNAR_INFO[year - 1900] & 65536 >> month ? 30 : 29;
}
function lunarYearDays(year) {
  let sum = 348;
  for (let mask = 32768; mask > 8; mask >>= 1) sum += LUNAR_INFO[year - 1900] & mask ? 1 : 0;
  return sum + lunarLeapDays(year);
}
function solarToLunar(year, month, day) {
  if (year < 1900 || year > 2100) return null;
  let offset = Math.round((Date.UTC(year, month - 1, day) - BASE_UTC) / 864e5);
  if (offset < 0) return null;
  let i = 1900;
  let temp = 0;
  for (; i < 2101 && offset > 0; i++) {
    temp = lunarYearDays(i);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }
  if (i > 2100) return null;
  const lunarYear = i;
  const leap = lunarLeapMonth(lunarYear);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      --i;
      isLeap = true;
      temp = lunarLeapDays(lunarYear);
    } else {
      temp = lunarMonthDays(lunarYear, i);
    }
    if (isLeap && i === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) isLeap = false;
    else {
      isLeap = true;
      --i;
    }
  }
  if (offset < 0) {
    offset += temp;
    --i;
  }
  return { year: lunarYear, month: i, day: offset + 1, isLeap };
}
function qingmingDay(year) {
  const y2 = year % 100;
  return Math.floor(y2 * 0.2422 + 4.81) - Math.floor(y2 / 4);
}
var LUNAR_FESTIVALS = /* @__PURE__ */ new Map([
  ["1-1", "\u6625\u8282"],
  ["1-15", "\u5143\u5BB5\u8282"],
  ["2-2", "\u9F99\u62AC\u5934"],
  ["5-5", "\u7AEF\u5348\u8282"],
  ["7-7", "\u4E03\u5915\u8282"],
  ["7-15", "\u4E2D\u5143\u8282"],
  ["8-15", "\u4E2D\u79CB\u8282"],
  ["9-9", "\u91CD\u9633\u8282"],
  ["12-8", "\u814A\u516B\u8282"]
]);
function ymdOf(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function lunarFestivalsFor(year, month) {
  const result = /* @__PURE__ */ new Map();
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1);
  for (let t = first; t < last; t += 864e5) {
    const d2 = new Date(t);
    const ymd2 = ymdOf(d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate());
    const lunar = solarToLunar(d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate());
    if (lunar === null) continue;
    const name = LUNAR_FESTIVALS.get(`${lunar.month}-${lunar.day}`);
    if (name !== void 0 && !lunar.isLeap) result.set(ymd2, name);
    const next = new Date(t + 864e5);
    const nextLunar = solarToLunar(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
    if (nextLunar !== null && nextLunar.month === 1 && nextLunar.day === 1) result.set(ymd2, "\u9664\u5915");
  }
  return result;
}

// src/lib/festivals.js
var FIXED_FESTIVALS = [
  ["01-01", "\u5143\u65E6"],
  ["02-14", "\u60C5\u4EBA\u8282"],
  ["03-08", "\u5987\u5973\u8282"],
  ["03-12", "\u690D\u6811\u8282"],
  ["04-01", "\u611A\u4EBA\u8282"],
  ["05-01", "\u52B3\u52A8\u8282"],
  ["05-04", "\u9752\u5E74\u8282"],
  ["05-12", "\u62A4\u58EB\u8282"],
  ["06-01", "\u513F\u7AE5\u8282"],
  ["06-18", "618"],
  ["07-01", "\u5EFA\u515A\u8282"],
  ["08-01", "\u5EFA\u519B\u8282"],
  ["09-10", "\u6559\u5E08\u8282"],
  ["10-01", "\u56FD\u5E86\u8282"],
  ["10-31", "\u4E07\u5723\u591C"],
  ["11-11", "\u53CC11"],
  ["12-12", "\u53CC12"],
  ["12-24", "\u5E73\u5B89\u591C"],
  ["12-25", "\u5723\u8BDE\u8282"]
];
var FLOATING_FESTIVALS = [
  [5, 2, 0, "\u6BCD\u4EB2\u8282"],
  [6, 3, 0, "\u7236\u4EB2\u8282"],
  [11, 4, 4, "\u611F\u6069\u8282"]
];
function ymdOf2(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function floatingDate(year, month, nth, weekday) {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}
var computedYearCache = /* @__PURE__ */ new Map();
function computedFestivalsForYear(year) {
  const cached = computedYearCache.get(year);
  if (cached) return cached;
  const map = /* @__PURE__ */ new Map();
  const push = (ymd2, name, kind) => {
    const list = map.get(ymd2) || [];
    if (!list.some((f) => f.name === name)) list.push({ name, kind });
    map.set(ymd2, list);
  };
  for (const [mmdd, name] of FIXED_FESTIVALS) {
    push(`${year}-${mmdd}`, name, "fixed");
  }
  for (const [month, nth, weekday, name] of FLOATING_FESTIVALS) {
    push(ymdOf2(year, month, floatingDate(year, month, nth, weekday)), name, "fixed");
  }
  const qm = ymdOf2(year, 4, qingmingDay(year));
  if (!(year in HOLIDAYS_CN) || !(qm in HOLIDAYS_CN[year])) push(qm, "\u6E05\u660E\u8282", "lunar");
  for (let month = 1; month <= 12; month++) {
    for (const [ymd2, name] of lunarFestivalsFor(year, month)) push(ymd2, name, "lunar");
  }
  computedYearCache.set(year, map);
  return map;
}
function festivalsFor(year, month) {
  const result = /* @__PURE__ */ new Map();
  const days = new Date(year, month, 0).getDate();
  const computed = computedFestivalsForYear(year);
  const statutory = HOLIDAYS_CN[year] || {};
  for (let day = 1; day <= days; day++) {
    const ymd2 = ymdOf2(year, month, day);
    const list = [];
    const entry = statutory[ymd2];
    if (entry) list.push({ name: entry[0], kind: entry[1] === 1 ? "statutory-rest" : "statutory-work" });
    for (const f of computed.get(ymd2) || []) {
      if (!list.some((x2) => x2.name === f.name)) list.push(f);
    }
    if (list.length > 0) result.set(ymd2, list);
  }
  return result;
}

// src/components/CalendarPage.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var STATUS_META = {
  idea: { label: "\u9009\u9898", color: "var(--text-tertiary)" },
  draft: { label: "\u8349\u7A3F", color: "var(--layer-plan)" },
  scheduled: { label: "\u5F85\u53D1", color: "var(--layer-attribute)" },
  published: { label: "\u5DF2\u53D1", color: "var(--layer-publish)" }
};
var EVENT_COLOR = "var(--layer-discover)";
var EVENT_TYPES = ["\u8282\u65E5", "\u7535\u5546", "\u5E73\u53F0\u6D3B\u52A8", "\u884C\u4E1A"];
var SOURCE_LABEL = {
  chat: "\u5BF9\u8BDD\u9875",
  "publish-page": "\u53D1\u5E03\u9875",
  manual: "\u624B\u52A8",
  scheduler: "\u6392\u671F"
};
var PLATFORMS = ["\u5C0F\u7EA2\u4E66", "\u6296\u97F3", "B\u7AD9", "\u5FAE\u4FE1\u89C6\u9891\u53F7", "\u5FEB\u624B", "\u516C\u4F17\u53F7", "\u5FAE\u535A", "\u77E5\u4E4E"];
var WEEKDAYS = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
function ymd(d2) {
  return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
}
var kindOf = (it) => it.kind === "event" ? "event" : "content";
var MAX_VISIBLE = 3;
var EMPTY2 = {
  title: "",
  date: "",
  platform: "",
  time: "",
  status: "idea",
  note: "",
  kind: "content",
  url: "",
  source: "manual",
  event_type: "",
  end_date: "",
  repeat: ""
};
function eventDates(ev) {
  const [startDate, startTime] = ev.start.split(" ");
  const [endDate, endTime] = (ev.end || ev.start).split(" ");
  const cursor = /* @__PURE__ */ new Date(`${startDate}T00:00`);
  const last = /* @__PURE__ */ new Date(`${endDate}T00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return [startDate];
  const endInclusive = startTime && endTime ? last : new Date(last.getTime() - 864e5);
  const dates = [];
  for (let d2 = new Date(cursor); d2.getTime() <= endInclusive.getTime() && dates.length < 62; d2.setDate(d2.getDate() + 1)) {
    dates.push(ymd(d2));
  }
  return dates.length > 0 ? dates : [startDate];
}
function syncAgo(ts) {
  if (!ts) return "\u672A\u540C\u6B65";
  const s = Math.floor(Date.now() / 1e3) - ts;
  if (s < 60) return "\u521A\u521A\u540C\u6B65";
  if (s < 3600) return `${Math.floor(s / 60)} \u5206\u949F\u524D\u540C\u6B65`;
  if (s < 86400) return `${Math.floor(s / 3600)} \u5C0F\u65F6\u524D\u540C\u6B65`;
  return `${Math.floor(s / 86400)} \u5929\u524D\u540C\u6B65`;
}
function CalendarPage() {
  const today = (0, import_react5.useMemo)(() => /* @__PURE__ */ new Date(), []);
  const [cursor, setCursor] = (0, import_react5.useState)(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [items, setItems] = (0, import_react5.useState)([]);
  const [editing, setEditing] = (0, import_react5.useState)(null);
  const [form, setForm] = (0, import_react5.useState)(null);
  const [saving, setSaving] = (0, import_react5.useState)(false);
  const [filter, setFilter] = (0, import_react5.useState)("all");
  const [ctx, setCtx] = (0, import_react5.useState)(null);
  const [showSuggest, setShowSuggest] = (0, import_react5.useState)(true);
  const [dayView, setDayView] = (0, import_react5.useState)(null);
  const [caldav, setCaldav] = (0, import_react5.useState)([]);
  const [caldavByAccount, setCaldavByAccount] = (0, import_react5.useState)({});
  const [subOpen, setSubOpen] = (0, import_react5.useState)(false);
  const [subDraft, setSubDraft] = (0, import_react5.useState)(null);
  const [subCals, setSubCals] = (0, import_react5.useState)(null);
  const [subBusy, setSubBusy] = (0, import_react5.useState)("");
  const [subError, setSubError] = (0, import_react5.useState)("");
  const loadCaldav = (0, import_react5.useCallback)(() => {
    fetchCaldavAccounts().then((r) => setCaldav(r.accounts)).catch(() => {
    });
    fetchCaldavEvents().then((r) => setCaldavByAccount(r.byAccount || {})).catch(() => {
    });
  }, []);
  const load = (0, import_react5.useCallback)(() => {
    fetchSchedule().then(setItems).catch(() => {
    });
    fetchScheduleContext(14).then(setCtx).catch(() => {
    });
    loadCaldav();
  }, [loadCaldav]);
  (0, import_react5.useEffect)(() => {
    load();
  }, [load]);
  (0, import_react5.useEffect)(() => {
    let cancelled = false;
    fetchCaldavAccounts().then(async (r) => {
      const stale = r.accounts.filter((a) => a.enabled && (!a.syncedAt || Date.now() / 1e3 - a.syncedAt > 86400));
      if (cancelled || stale.length === 0) return;
      await Promise.allSettled(stale.map((a) => syncCaldav(a.id)));
      if (!cancelled) fetchCaldavEvents().then((res) => setCaldavByAccount(res.byAccount || {})).catch(() => {
      });
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const visible = (0, import_react5.useMemo)(
    () => filter === "all" ? items : items.filter((it) => kindOf(it) === filter),
    [items, filter]
  );
  const cells = (0, import_react5.useMemo)(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_2, i) => {
      const d2 = new Date(start);
      d2.setDate(start.getDate() + i);
      return d2;
    });
  }, [cursor]);
  const festivalMap = (0, import_react5.useMemo)(() => {
    const merged = /* @__PURE__ */ new Map();
    for (const offset of [-1, 0, 1]) {
      const anchor = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
      for (const [ymd2, list] of festivalsFor(anchor.getFullYear(), anchor.getMonth() + 1)) {
        if (!merged.has(ymd2)) merged.set(ymd2, list);
      }
    }
    return merged;
  }, [cursor]);
  const byDate = (0, import_react5.useMemo)(() => {
    const m2 = {};
    const push = (date, it) => {
      const bucket = m2[date] ||= { events: [], content: [] };
      (kindOf(it) === "event" ? bucket.events : bucket.content).push(it);
    };
    for (const it of visible) {
      if (it.repeat === "yearly" && /^\d{4}-\d{2}-\d{2}$/.test(it.date)) {
        const [, mo, dd] = it.date.split("-").map(Number);
        for (const d2 of cells) {
          if (d2.getMonth() + 1 === mo && d2.getDate() === dd) push(ymd(d2), it);
        }
        continue;
      }
      push(it.date, it);
    }
    return m2;
  }, [visible, cells]);
  const caldavByDate = (0, import_react5.useMemo)(() => {
    const m2 = {};
    for (const [aid, bucket] of Object.entries(caldavByAccount)) {
      const acc = caldav.find((a) => a.id === aid);
      if (!acc || !acc.enabled) continue;
      for (const ev of bucket.events) {
        for (const ds of eventDates(ev)) (m2[ds] ||= []).push({ ev, acc });
      }
    }
    return m2;
  }, [caldavByAccount, caldav]);
  const [menu, setMenu] = (0, import_react5.useState)(null);
  (0, import_react5.useEffect)(() => {
    if (!menu) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  const openNew = (date) => {
    setDayView(null);
    setEditing(null);
    setForm({ ...EMPTY2, date, kind: filter === "event" ? "event" : "content" });
  };
  const openEdit = (it) => {
    setDayView(null);
    setEditing(it);
    setForm({ ...EMPTY2, ...it });
  };
  const close = () => {
    setForm(null);
    setEditing(null);
  };
  const renderChip = (it) => {
    if (kindOf(it) === "event") {
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          className: "cal-event is-event",
          title: it.event_type ? `${it.event_type}\xB7${it.title}` : it.title,
          style: { ["--ev"]: EVENT_COLOR },
          onClick: (e) => {
            e.stopPropagation();
            openEdit(it);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-event-dot" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-event-title", children: it.title })
          ]
        },
        it.id
      );
    }
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "div",
      {
        className: "cal-event",
        title: it.title,
        style: { ["--ev"]: STATUS_META[it.status]?.color || "var(--text-tertiary)" },
        onClick: (e) => {
          e.stopPropagation();
          openEdit(it);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-event-dot" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-event-title", children: [
            it.platform ? `[${it.platform}] ` : "",
            it.title
          ] }),
          it.status === "published" && it.source && SOURCE_LABEL[it.source] && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-src", children: SOURCE_LABEL[it.source] })
        ]
      },
      it.id
    );
  };
  const renderCaldavChip = (ev, acc, ds) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      className: "cal-event is-caldav",
      title: `${acc.name} \xB7 ${ev.title}`,
      style: { ["--ev"]: acc.color || "var(--text-tertiary)" },
      onClick: (e) => {
        e.stopPropagation();
        setDayView(ds);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-event-dot" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-event-title", children: ev.title })
      ]
    },
    `cd-${ev.uid}-${ev.start}`
  );
  const save = async () => {
    if (!form || !form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      if (editing) await updateSchedule(editing.id, form);
      else await createSchedule(form);
      close();
      load();
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await deleteSchedule(editing.id);
      close();
      load();
    } finally {
      setSaving(false);
    }
  };
  const monthLabel = `${cursor.getFullYear()} \u5E74 ${cursor.getMonth() + 1} \u6708`;
  const shift = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const todayStr = ymd(today);
  const isEvent = form?.kind === "event";
  const suggestions = ctx?.suggestions || [];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "page-scroll calendar-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("h1", { className: "page-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconCalendar, { size: 21 }),
          " \u5185\u5BB9\u65E5\u5386"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "page-subtitle", children: "\u6BCF\u5929\u5404\u5E73\u53F0\u53D1\u4EC0\u4E48\u4E00\u76EE\u4E86\u7136\u2014\u2014\u53D1\u5E03\u81EA\u52A8\u843D\u5E93\uFF0C\u53EF\u8BB0\u5F55\u6392\u671F\u4E0E\u5E73\u53F0\u6D3B\u52A8\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-nav", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => shift(-1), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { transform: "rotate(180deg)", display: "inline-flex" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconChevron, { size: 14 }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1)), children: "\u672C\u6708" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-month", children: monthLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => shift(1), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconChevron, { size: 14 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => {
          setSubOpen(true);
          setSubError("");
        }, children: "\u{1F4C5} \u8BA2\u9605" })
      ] })
    ] }),
    showSuggest && suggestions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-suggest", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-suggest-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
          "\u{1F4C5} \u65E5\u5386\u5EFA\u8BAE\uFF08\u8FD1 ",
          ctx?.window_days ?? 14,
          " \u5929\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "icon-btn", onClick: () => setShowSuggest(false), children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ul", { children: suggestions.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("li", { children: s }, i)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-legend", children: [
      Object.entries(STATUS_META).map(([k2, m2]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-legend-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-legend-swatch", style: { ["--sw"]: m2.color } }),
        m2.label
      ] }, k2)),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-legend-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-legend-swatch sq", style: { ["--sw"]: EVENT_COLOR } }),
        "\u5E73\u53F0\u6D3B\u52A8"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-legend-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-festival rest", children: "\u4F11" }),
        "\u6CD5\u5B9A\u8282\u5047\u65E5"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-legend-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-festival work", children: "\u73ED" }),
        "\u8C03\u4F11\u4E0A\u73ED"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-legend-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-legend-swatch sq", style: { ["--sw"]: "var(--cal-festival)" } }),
        "\u8282\u65E5"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-legend-filter", children: ["all", "content", "event"].map((f) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: `chip ${filter === f ? "active" : ""}`, onClick: () => setFilter(f), children: f === "all" ? "\u5168\u90E8" : f === "content" ? "\u5185\u5BB9" : "\u6D3B\u52A8" }, f)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-grid-head", children: WEEKDAYS.map((w2) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-wd", children: [
      "\u5468",
      w2
    ] }, w2)) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-grid", children: cells.map((d2, i) => {
      const ds = ymd(d2);
      const inMonth = d2.getMonth() === cursor.getMonth();
      const bucket = byDate[ds] || { events: [], content: [] };
      const dayChips = [
        ...bucket.events.map((it) => ({ kind: "item", it })),
        ...(caldavByDate[ds] || []).map(({ ev, acc }) => ({ kind: "caldav", ev, acc })),
        ...bucket.content.map((it) => ({ kind: "item", it }))
      ];
      const shown = dayChips.slice(0, MAX_VISIBLE);
      const hidden = dayChips.length - shown.length;
      const fests = festivalMap.get(ds) || [];
      const rest = fests.find((f) => f.kind === "statutory-rest");
      const work = fests.find((f) => f.kind === "statutory-work");
      const allFestNames = fests.filter((f) => f.kind !== "statutory-rest" && f.kind !== "statutory-work").map((f) => f.name);
      const festNames = allFestNames.slice(0, 2);
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          className: `cal-cell ${inMonth ? "" : "dim"} ${ds === todayStr ? "today" : ""}`,
          onClick: () => dayChips.length ? setDayView(ds) : openNew(ds),
          onContextMenu: (e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY, ds });
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-daynum-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-daynum", children: d2.getDate() }),
              rest && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-festival rest", title: rest.name, children: "\u4F11" }),
              work && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-festival work", title: work.name, children: "\u73ED" })
            ] }),
            festNames.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-festnames", title: allFestNames.join(" \xB7 "), children: festNames.join(" \xB7 ") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-events", children: [
              shown.map((chip) => chip.kind === "item" ? renderChip(chip.it) : renderCaldavChip(chip.ev, chip.acc, ds)),
              hidden > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { className: "cal-more", onClick: (e) => {
                e.stopPropagation();
                setDayView(ds);
              }, children: [
                "+",
                hidden,
                " \u66F4\u591A"
              ] })
            ] })
          ]
        },
        i
      );
    }) }),
    menu && (() => {
      const customFests = (byDate[menu.ds]?.events || []).filter((it) => it.event_type === "\u8282\u65E5" && it.source === "manual");
      const openWith = (preset) => {
        setMenu(null);
        setDayView(null);
        setEditing(null);
        setForm({ ...EMPTY2, date: menu.ds, ...preset });
      };
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "div",
        {
          className: "overlay is-menu",
          onClick: () => setMenu(null),
          onContextMenu: (e) => {
            e.preventDefault();
            setMenu(null);
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "div",
            {
              className: "cal-menu",
              style: { left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 170) },
              onClick: (e) => e.stopPropagation(),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { onClick: () => openWith({ kind: "event", event_type: "\u8282\u65E5", status: "idea" }), children: "\u{1F389} \u6DFB\u52A0\u8282\u65E5\u2026" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { onClick: () => openWith({ kind: "event", status: "idea" }), children: "\u{1F4E3} \u6DFB\u52A0\u5E73\u53F0\u6D3B\u52A8\u2026" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { onClick: () => openWith({ kind: "content" }), children: "\u{1F4DD} \u6DFB\u52A0\u6392\u671F\u2026" }),
                customFests.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-menu-sep" }),
                customFests.map((it) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                  "button",
                  {
                    className: "cal-menu-del",
                    title: it.repeat === "yearly" ? "\u6BCF\u5E74\u91CD\u590D" : void 0,
                    onClick: async () => {
                      setMenu(null);
                      await deleteSchedule(it.id);
                      load();
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
                        "\u5220\u9664\u300C",
                        it.title,
                        "\u300D"
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconTrash, { size: 13 })
                    ]
                  },
                  it.id
                ))
              ]
            }
          )
        }
      );
    })(),
    dayView && (() => {
      const b2 = byDate[dayView] || { events: [], content: [] };
      const list = [...b2.events, ...b2.content];
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "overlay", onClick: () => setDayView(null), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "modal", style: { width: 420, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("h3", { style: { margin: 0 }, children: [
            dayView,
            "\uFF08",
            list.length,
            " \u9879\uFF09"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "icon-btn", onClick: () => setDayView(null), children: "\xD7" })
        ] }),
        (festivalMap.get(dayView) || []).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-fest-day", children: (festivalMap.get(dayView) || []).map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `cal-festival-tag is-${f.kind}`, children: f.name }, i)) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-dayview-list", children: [
          list.map(renderChip),
          (caldavByDate[dayView] || []).map(({ ev, acc }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "div",
            {
              className: "cal-event is-caldav",
              title: ev.location ? `${acc.name} \xB7 ${ev.location}` : acc.name,
              style: { ["--ev"]: acc.color || "var(--text-tertiary)" },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-event-dot" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "cal-event-title", children: [
                  ev.allDay ? "\u5168\u5929" : ev.start.slice(11, 16),
                  " \xB7 ",
                  ev.title,
                  ev.location ? ` @${ev.location}` : ""
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-src", children: acc.name })
              ]
            },
            `cd-${ev.uid}-${ev.start}`
          ))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 16 }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm btn-primary", onClick: () => openNew(dayView), children: "+ \u65B0\u589E" }) })
      ] }) });
    })(),
    subOpen && (() => {
      const newDraft = () => ({
        id: Math.random().toString(16).slice(2, 14),
        name: "",
        url: "",
        username: "",
        password: "",
        enabled: true,
        calendars: []
      });
      const startEdit = (acc) => {
        setSubDraft(acc ? { ...acc, password: "" } : newDraft());
        setSubCals(null);
        setSubError("");
      };
      const persist = async (accounts) => {
        setSubBusy("save");
        setSubError("");
        try {
          await putCaldavAccounts(accounts);
          loadCaldav();
        } catch (e) {
          setSubError(e.message || String(e));
        } finally {
          setSubBusy("");
        }
      };
      const syncOne = async (acc) => {
        setSubBusy(acc.id);
        setSubError("");
        try {
          await syncCaldav(acc.id);
          loadCaldav();
        } catch (e) {
          setSubError(e.message || String(e));
        } finally {
          setSubBusy("");
        }
      };
      const saveDraft = async () => {
        if (!subDraft) return;
        await persist(caldav.some((a) => a.id === subDraft.id) ? caldav.map((a) => a.id === subDraft.id ? subDraft : a) : [...caldav, subDraft]);
        setSubDraft(null);
        setSubCals(null);
      };
      const probe = async () => {
        if (!subDraft) return;
        setSubBusy("probe");
        setSubError("");
        try {
          await putCaldavAccounts(caldav.some((a) => a.id === subDraft.id) ? caldav.map((a) => a.id === subDraft.id ? subDraft : a) : [...caldav, subDraft]);
          const res = await discoverCaldav(subDraft.id, {
            url: subDraft.url,
            username: subDraft.username,
            password: subDraft.password || void 0
          });
          setSubCals(res.calendars);
          loadCaldav();
        } catch (e) {
          setSubError(e.message || String(e));
        } finally {
          setSubBusy("");
        }
      };
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "overlay", onClick: () => {
        setSubOpen(false);
        setSubDraft(null);
        setSubCals(null);
      }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "modal", style: { width: 540, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { style: { margin: 0 }, children: "\u{1F4C5} \u8BA2\u9605\u65E5\u5386\uFF08CalDAV\uFF09" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "icon-btn", onClick: () => {
            setSubOpen(false);
            setSubDraft(null);
            setSubCals(null);
          }, children: "\xD7" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "cal-sub-hint", children: "\u53EA\u8BFB\u5BFC\u5165 iCloud / Fastmail / Nextcloud \u7B49\u6807\u51C6 CalDAV \u65E5\u5386\u3002\u586B\u670D\u52A1\u5668\u5730\u5740\u53EF\u81EA\u52A8\u53D1\u73B0\uFF0C\u4E5F\u53EF\u76F4\u63A5\u7C98\u8D34\u65E5\u5386 URL\uFF1B \u5BC6\u7801\u7528\u5404\u670D\u52A1\u7684\u300C\u5E94\u7528\u4E13\u7528\u5BC6\u7801\u300D\u3002Google \u65E5\u5386\u9700 OAuth\uFF0C\u6682\u4E0D\u652F\u6301\u3002" }),
        caldav.map((acc) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-sub-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-sub-dot", style: { ["--ev"]: acc.color || "var(--text-tertiary)" } }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-sub-main", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { fontWeight: 600 }, children: [
              acc.name,
              !acc.enabled && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "cal-src", children: "\uFF08\u5DF2\u505C\u7528\uFF09" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-sub-url", children: [
              acc.url,
              acc.username ? ` \xB7 ${acc.username}` : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-src", children: [
              syncAgo(acc.syncedAt),
              caldavByAccount[acc.id] ? ` \xB7 ${caldavByAccount[acc.id].events.length} \u6761\u4E8B\u4EF6` : "",
              acc.calendars.length > 0 ? ` \xB7 ${acc.calendars.length} \u4E2A\u65E5\u5386` : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "cal-repeat", style: { margin: 0 }, title: "\u542F\u7528/\u505C\u7528", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              type: "checkbox",
              checked: acc.enabled,
              onChange: (e) => persist(caldav.map((a) => a.id === acc.id ? { ...a, enabled: e.target.checked } : a))
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", disabled: subBusy !== "", onClick: () => syncOne(acc), children: subBusy === acc.id ? "\u540C\u6B65\u4E2D\u2026" : "\u540C\u6B65" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => startEdit(acc), children: "\u7F16\u8F91" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm btn-danger", onClick: () => persist(caldav.filter((a) => a.id !== acc.id)), children: "\u5220\u9664" })
        ] }, acc.id)),
        !subDraft && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => startEdit(null), children: "+ \u6DFB\u52A0\u8D26\u53F7" }),
        subDraft && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "cal-sub-form", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u540D\u79F0" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              className: "field",
              value: subDraft.name,
              placeholder: "iCloud / \u516C\u53F8\u65E5\u5386\u2026",
              onChange: (e) => setSubDraft({ ...subDraft, name: e.target.value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u670D\u52A1\u5668\u6216\u65E5\u5386 URL *" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              className: "field",
              value: subDraft.url,
              autoFocus: true,
              placeholder: "https://caldav.icloud.com/ \u6216\u5B8C\u6574\u65E5\u5386 URL",
              onChange: (e) => setSubDraft({ ...subDraft, url: e.target.value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 10 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { flex: 1 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u7528\u6237\u540D" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "input",
                {
                  className: "field",
                  value: subDraft.username,
                  onChange: (e) => setSubDraft({ ...subDraft, username: e.target.value })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { flex: 1 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u5E94\u7528\u4E13\u7528\u5BC6\u7801" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "input",
                {
                  className: "field",
                  type: "password",
                  value: subDraft.password,
                  placeholder: caldav.some((a) => a.id === subDraft.id) ? "\u5DF2\u4FDD\u5B58\uFF08\u7559\u7A7A\u4E0D\u6539\uFF09" : "",
                  onChange: (e) => setSubDraft({ ...subDraft, password: e.target.value })
                }
              )
            ] })
          ] }),
          subCals !== null && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "field-label", children: [
              "\u9009\u62E9\u8981\u8BA2\u9605\u7684\u65E5\u5386\uFF08",
              subCals.length,
              " \u4E2A\uFF1B\u4E0D\u9009\u5219\u8BA2\u9605\u586B\u5199\u7684 URL\uFF09"
            ] }),
            subCals.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-src", children: "\u672A\u53D1\u73B0\u65E5\u5386" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 }, children: subCals.map((cal) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "button",
              {
                className: `chip ${subDraft.calendars.includes(cal.href) ? "active" : ""}`,
                title: cal.href,
                onClick: () => setSubDraft({
                  ...subDraft,
                  calendars: subDraft.calendars.includes(cal.href) ? subDraft.calendars.filter((h) => h !== cal.href) : [...subDraft.calendars, cal.href]
                }),
                children: cal.displayname
              },
              cal.href
            )) })
          ] }),
          subError && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "cal-sub-error", children: subError }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: () => {
              setSubDraft(null);
              setSubCals(null);
            }, children: "\u53D6\u6D88" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", disabled: subBusy !== "" || !/^https?:\/\//i.test(subDraft.url), onClick: probe, children: subBusy === "probe" ? "\u63A2\u6D4B\u4E2D\u2026" : "\u63A2\u6D4B\u65E5\u5386" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm btn-primary", disabled: subBusy !== "" || !subDraft.url.trim(), onClick: saveDraft, children: subBusy === "save" ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58" })
          ] })
        ] })
      ] }) });
    })(),
    form && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "overlay", onClick: close, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "modal", style: { width: 440, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("h3", { style: { margin: 0 }, children: [
          editing ? "\u7F16\u8F91" : "\u65B0\u589E",
          isEvent ? "\u5E73\u53F0\u6D3B\u52A8" : "\u6392\u671F"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "icon-btn", onClick: close, children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u7C7B\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 7 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            className: `chip ${!isEvent ? "active" : ""}`,
            onClick: () => setForm({ ...form, kind: "content" }),
            children: "\u5185\u5BB9 / \u53D1\u5E03"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            className: `chip ${isEvent ? "active" : ""}`,
            onClick: () => setForm({ ...form, kind: "event", status: "idea" }),
            children: "\u5E73\u53F0\u6D3B\u52A8"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u6807\u9898 *" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "input",
        {
          className: "field",
          value: form.title,
          autoFocus: true,
          placeholder: isEvent ? "\u6D3B\u52A8/\u8282\u70B9\u540D\u79F0" : "\u8981\u53D1\u4EC0\u4E48\u5185\u5BB9",
          onChange: (e) => setForm({ ...form, title: e.target.value })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: isEvent ? "\u5F00\u59CB\u65E5\u671F *" : "\u65E5\u671F *" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              className: "field",
              type: "date",
              value: form.date,
              onChange: (e) => setForm({ ...form, date: e.target.value })
            }
          )
        ] }),
        isEvent ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u7ED3\u675F\u65E5\u671F" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              className: "field",
              type: "date",
              value: form.end_date || "",
              onChange: (e) => setForm({ ...form, end_date: e.target.value })
            }
          )
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { width: 120 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u65F6\u95F4" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              className: "field",
              type: "time",
              value: form.time,
              onChange: (e) => setForm({ ...form, time: e.target.value })
            }
          )
        ] })
      ] }),
      isEvent ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u6D3B\u52A8\u7C7B\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 }, children: EVENT_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            className: `chip ${form.event_type === t ? "active" : ""}`,
            onClick: () => setForm({ ...form, event_type: form.event_type === t ? "" : t }),
            children: t
          },
          t
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u5173\u8054\u5E73\u53F0\uFF08\u53EF\u9009\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 }, children: PLATFORMS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            className: `chip ${form.platform === p ? "active" : ""}`,
            onClick: () => setForm({ ...form, platform: form.platform === p ? "" : p }),
            children: p
          },
          p
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "cal-repeat", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              type: "checkbox",
              checked: form.repeat === "yearly",
              onChange: (e) => setForm({ ...form, repeat: e.target.checked ? "yearly" : "" })
            }
          ),
          "\u6BCF\u5E74\u91CD\u590D\uFF08\u540C\u6708\u540C\u65E5\u81EA\u52A8\u51FA\u73B0\u5728\u6BCF\u4E00\u5E74\uFF09"
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u5E73\u53F0" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 }, children: PLATFORMS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            className: `chip ${form.platform === p ? "active" : ""}`,
            onClick: () => setForm({ ...form, platform: form.platform === p ? "" : p }),
            children: p
          },
          p
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u72B6\u6001" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", gap: 7 }, children: Object.entries(STATUS_META).map(([k2, m2]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            className: `chip ${form.status === k2 ? "active" : ""}`,
            onClick: () => setForm({ ...form, status: k2 }),
            children: m2.label
          },
          k2
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("label", { className: "field-label", children: "\u5907\u6CE8" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "textarea",
        {
          className: "field",
          style: { minHeight: 60 },
          value: form.note,
          onChange: (e) => setForm({ ...form, note: e.target.value })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 18 }, children: [
        editing ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { className: "btn btn-sm btn-danger", onClick: remove, disabled: saving, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconTrash, { size: 13 }),
          " \u5220\u9664"
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", {}),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm", onClick: close, children: "\u53D6\u6D88" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "btn btn-sm btn-primary", onClick: save, disabled: saving || !form.title.trim() || !form.date, children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58" })
        ] })
      ] })
    ] }) })
  ] });
}

// src/features/calendar.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var view4 = "calendar";
var order4 = 33;
var labels4 = { zh: "\u5185\u5BB9\u65E5\u5386", en: "Calendar" };
var Icon4 = IconCalendar;
var Component4 = CalendarPage;
var plugin4 = {
  name: "easel-view-calendar",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view4),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Component4, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view4),
      order: order4,
      locale: "easel.panel",
      label: () => t(view4)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon4, { size });
    }));
  }
};

// src/features/skills.tsx
var skills_exports = {};
__export(skills_exports, {
  Component: () => Component5,
  Icon: () => Icon5,
  labels: () => labels5,
  order: () => order5,
  plugin: () => plugin5,
  view: () => view5
});

// src/components/SkillPage.tsx
var import_react7 = require("react");

// src/components/SkillDrawer.tsx
var import_react6 = require("react");

// src/lib/skillDisplayNames.ts
var SKILL_DISPLAY_NAMES = {
  "ai-image-gen": "AI \u751F\u56FE",
  "ai-music": "BGM / \u97F3\u4E50\u751F\u6210",
  "ai-video-gen": "AI \u89C6\u9891\u751F\u6210",
  "asset-manager": "\u4EA7\u7269\u7BA1\u7406",
  "audio-denoise": "\u964D\u566A",
  "audio-editing": "\u97F3\u9891\u526A\u8F91",
  "audio-mix": "\u6DF7\u97F3\uFF08BGM\u95EA\u907F\uFF09",
  "audio-visualizer": "\u97F3\u9891\u53EF\u89C6\u5316",
  "auto-short-video": "\u4E00\u53E5\u8BDD\u51FA\u7247",
  "auto-subtitle": "\u81EA\u52A8\u5B57\u5E55",
  "batch-process": "\u6279\u91CF\u5904\u7406",
  "beat-sync-video": "\u5361\u70B9\u89C6\u9891",
  "card-design": "\u5361\u7247\u89C6\u89C9\u7CFB\u7EDF",
  "card-quote": "\u91D1\u53E5\u5361 / \u6570\u636E\u5361",
  "card-xiaohongshu": "\u5C0F\u7EA2\u4E66\u5361\u7EC4",
  "chart-visualization": "\u56FE\u8868\uFF0825+\u7C7B\uFF09",
  "clipify": "\u957F\u7247\u5207\u7247",
  "comparison-card": "\u5BF9\u6BD4\u56FE / \u4E00\u56FE\u6D41",
  "copywriting": "\u8425\u9500 / \u5E26\u8D27\u6587\u6848",
  "data-report": "\u6570\u636E\u62A5\u544A\u9875",
  "doc-convert": "\u6587\u7A3F\u8F6C PDF / \u957F\u56FE",
  "ecom-details-image": "\u7535\u5546\u8BE6\u60C5\u56FE",
  "green-screen": "\u7EFF\u5E55\u5408\u6210",
  "gzh-design": "\u516C\u4F17\u53F7\u6392\u7248",
  "image-editing": "\u56FE\u50CF\u5904\u7406",
  "image-enhance": "\u56FE\u50CF\u589E\u5F3A",
  "infographic": "\u4FE1\u606F\u56FE\uFF08\u542BGIF\uFF09",
  "meme-generator": "\u8868\u60C5\u5305",
  "mindmap": "\u601D\u7EF4\u5BFC\u56FE",
  "multi-voice-dubbing": "\u591A\u89D2\u8272\u914D\u97F3",
  "novel-writer": "\u5C0F\u8BF4\u8FDE\u8F7D",
  "paper-explainer": "\u8BBA\u6587\u89E3\u8BFB",
  "post-formatter": "\u793E\u5A92\u5E16\u5B50\u6210\u7A3F",
  "poster-hero": "\u7AD6\u7248\u6D77\u62A5",
  "remove-bg": "\u62A0\u56FE\u6362\u80CC\u666F",
  "roi-calculator": "ROI \u8BA1\u7B97",
  "short-drama": "AI \u5FAE\u77ED\u5267",
  "skill-account-diagnosis": "\u8D26\u53F7\u8BCA\u65AD",
  "skill-algorithm-updates": "\u7B97\u6CD5\u89C4\u5219\u8FFD\u8E2A",
  "skill-article-outline": "\u957F\u6587\u5927\u7EB2",
  "skill-audience-profiler": "\u53D7\u4F17\u753B\u50CF",
  "skill-bilibili-upload": "B\u7AD9",
  "skill-brand-onboarding": "\u54C1\u724C\u5165\u9A7B\u8BBF\u8C08",
  "skill-campaign-planner": "\u6D3B\u52A8\u7B56\u5212",
  "skill-carousel-planner": "\u8F6E\u64AD\u89C4\u5212",
  "skill-channels-upload": "\u5FAE\u4FE1\u89C6\u9891\u53F7",
  "skill-collab-proposal": "\u54C1\u724C\u5408\u4F5C",
  "skill-comment-insights": "\u8BC4\u8BBA\u6D1E\u5BDF",
  "skill-community-ops": "\u8BC4\u8BBA\u8FD0\u8425",
  "skill-competitor-analysis": "\u7ADE\u54C1\u5206\u6790",
  "skill-content-calendar": "\u6708\u5EA6\u6392\u671F",
  "skill-content-calendar-log": "\u5185\u5BB9\u65E5\u5386\u5E95\u5EA7",
  "skill-content-gap-analysis": "\u5185\u5BB9\u7A7A\u767D\u5206\u6790",
  "skill-content-matrix": "\u9009\u9898\u77E9\u9635",
  "skill-content-postmortem": "\u7206\u6B3E\u590D\u76D8",
  "skill-content-repurposing": "\u591A\u5E73\u53F0\u6539\u7F16",
  "skill-content-strategy": "\u5185\u5BB9\u7B56\u7565",
  "skill-cross-platform-diff": "\u8DE8\u5E73\u53F0\u5DEE\u5F02",
  "skill-cross-platform-publish": "\u8DE8\u5E73\u53F0\u4E00\u952E",
  "skill-data-tracker": "\u6570\u636E\u8FFD\u8E2A",
  "skill-douyin-upload": "\u6296\u97F3",
  "skill-event-calendar": "\u8282\u65E5 / \u8282\u70B9",
  "skill-hook-generator": "\u5F00\u5934\u94A9\u5B50",
  "skill-kuaishou-upload": "\u5FEB\u624B",
  "skill-livestream": "\u76F4\u64AD\u65B9\u6848",
  "skill-my-account": "\u8D26\u53F7\u67E5\u8BE2",
  "skill-news-intelligence": "\u884C\u4E1A\u60C5\u62A5",
  "skill-persona-check": "\u4EBA\u8BBE\u4E00\u81F4\u6027",
  "skill-positioning-analysis": "\u5DEE\u5F02\u5316\u5B9A\u4F4D",
  "skill-post-scorer": "\u4E92\u52A8\u6F5C\u529B\u8BC4\u5206",
  "skill-profile-builder": "\u753B\u50CF\u6784\u5EFA",
  "skill-profile-manager": "\u753B\u50CF\u7BA1\u7406",
  "skill-publish-analytics": "\u53D1\u5E03\u5F52\u56E0",
  "skill-publish-checklist": "\u53D1\u5E03\u524D\u68C0\u67E5",
  "skill-publish-log": "\u53D1\u5E03\u8BB0\u5F55",
  "skill-publish-notify": "\u53D1\u5E03\u901A\u77E5",
  "skill-publish-scheduler": "\u6279\u91CF\u6392\u671F",
  "skill-quality-gate": "\u8D28\u91CF\u5173",
  "skill-risk-scanner": "\u7248\u6743 / \u539F\u521B\u98CE\u9669",
  "skill-rss-aggregator": "RSS \u8BA2\u9605",
  "skill-seo-quality": "\u641C\u7D22\u6D41\u91CF\u4F18\u5316",
  "skill-short-link": "\u77ED\u94FE / UTM",
  "skill-social-performance-review": "\u6708\u5EA6\u590D\u76D8",
  "skill-strategy-advisor": "\u7B56\u7565\u8FED\u4EE3",
  "skill-topic-evaluator": "\u9009\u9898\u8BC4\u4F30",
  "skill-trend-rider": "\u8E6D\u70ED\u70B9\u65B9\u6848",
  "skill-trending-topics": "\u70ED\u699C\u9009\u9898",
  "skill-ugc-discovery": "\u7C89\u4E1D UGC",
  "skill-voice-builder": "\u58F0\u97F3\u753B\u50CF",
  "skill-wechat-publisher": "\u516C\u4F17\u53F7",
  "skill-xhs-analyzer": "\u5C0F\u7EA2\u4E66\u5206\u6790",
  "skill-xhs-comment-reply": "\u5C0F\u7EA2\u4E66\u8BC4\u8BBA",
  "skill-xhs-publisher": "\u5C0F\u7EA2\u4E66",
  "skill-zhihu-answer": "\u77E5\u4E4E\u56DE\u7B54",
  "skill-zhihu-publisher": "\u77E5\u4E4E\u4E13\u680F",
  "slideshow-video": "\u76F8\u518C\u89C6\u9891",
  "social-content": "\u901A\u7528\u793E\u5A92\u6587\u6848",
  "style-transfer": "\u6587\u6848\u98CE\u683C\u8FC1\u79FB",
  "subtitle-translate": "\u5B57\u5E55\u7FFB\u8BD1",
  "template-library": "\u6A21\u677F\u5E93",
  "text-condenser": "\u6458\u8981 / \u91D1\u53E5\u63D0\u53D6",
  "text-polisher": "\u6DA6\u8272 / \u53BBAI\u5473",
  "tts-voiceover": "\u914D\u97F3\uFF08\u5E26\u5B57\u5E55\uFF09",
  "video-chapters": "\u7AE0\u8282 / \u65F6\u95F4\u6233",
  "video-editing": "\u81EA\u7136\u8BED\u8A00\u526A\u8F91",
  "video-highlights": "\u9AD8\u5149\u5207\u7247",
  "video-intro-outro": "\u7247\u5934 / \u7247\u5C3E",
  "video-reframe": "\u753B\u5E45\u8F6C\u6362",
  "video-script": "\u89C6\u9891\u811A\u672C",
  "video-strategy": "\u89C6\u9891\u7B56\u7565\u9009\u578B",
  "video-to-article": "\u89C6\u9891\u8F6C\u56FE\u6587",
  "voice-clone": "\u58F0\u97F3\u514B\u9686",
  "xhs-note-creator": "\u5C0F\u7EA2\u4E66\u56FE\u6587\u603B\u5165\u53E3"
};
function displayName(raw) {
  return SKILL_DISPLAY_NAMES[raw] || raw;
}

// src/components/SkillDrawer.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
function SkillDrawer({ skillName, persona, onClose, onConfigured, onNavigate }) {
  const [detail, setDetail] = (0, import_react6.useState)(null);
  const [loadErr, setLoadErr] = (0, import_react6.useState)("");
  const [envInputs, setEnvInputs] = (0, import_react6.useState)({});
  const [saving, setSaving] = (0, import_react6.useState)(false);
  const [savedMsg, setSavedMsg] = (0, import_react6.useState)("");
  const [input, setInput] = (0, import_react6.useState)("");
  const [result, setResult] = (0, import_react6.useState)("");
  const [running, setRunning] = (0, import_react6.useState)(false);
  const [runErr, setRunErr] = (0, import_react6.useState)("");
  const runCtl = (0, import_react6.useRef)(null);
  const loadDetail = () => {
    let ignore = false;
    fetchSkillDetail(skillName).then((d2) => {
      if (!ignore) {
        setDetail(d2);
        setLoadErr("");
      }
    }).catch(() => {
      if (!ignore) setLoadErr("\u52A0\u8F7D SKILL \u8BE6\u60C5\u5931\u8D25");
    });
    return () => {
      ignore = true;
    };
  };
  (0, import_react6.useEffect)(loadDetail, [skillName]);
  const bodyHtml = (0, import_react6.useMemo)(() => renderMarkdown(detail?.body || ""), [detail?.body]);
  const resultHtml = (0, import_react6.useMemo)(() => renderMarkdown(result), [result]);
  const handleSaveEnv = async () => {
    const updates = Object.fromEntries(
      Object.entries(envInputs).filter(([, v2]) => v2.trim() !== "")
    );
    if (Object.keys(updates).length === 0) {
      setSavedMsg("\u6CA1\u6709\u586B\u5199\u65B0\u503C");
      return;
    }
    setSaving(true);
    setSavedMsg("");
    try {
      await saveEnv(updates);
      setEnvInputs({});
      setDetail(await fetchSkillDetail(skillName));
      setSavedMsg("\u5DF2\u4FDD\u5B58 \u2713");
      onConfigured();
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : "\u4FDD\u5B58\u5931\u8D25");
    } finally {
      setSaving(false);
    }
  };
  const handleRun = async () => {
    if (!input.trim() || running) return;
    setRunning(true);
    setRunErr("");
    setResult("");
    const batch = `skill-${Date.now().toString(36)}.md`;
    const prompt = `\u8BF7\u4E25\u683C\u6267\u884C\u6280\u80FD\u300C${skillName}\u300D\uFF1A\u8BFB\u53D6 skills/openclaw/${skillName}/SKILL.md\uFF0C\u6309\u5B83\u7684\u6D41\u7A0B\u3001\u6570\u636E\u6E90\u4E0E\u5DE5\u5177\u6267\u884C\u3002
` + (persona ? `\u6267\u884C\u65F6\u4F7F\u7528\u6211\u7684\u753B\u50CF\u300C${persona}\u300D\uFF08profiles/${persona}/ \u4E0B\u7684\u516D\u7EF4\u6587\u4EF6\uFF09\u3002
` : "") + `\u4EFB\u52A1\u8F93\u5165\uFF1A
${input.trim()}

\u3010\u4EA4\u4ED8\u65B9\u5F0F\u3011\u5B8C\u6210\u540E\uFF0C\u628A\u6700\u7EC8\u4EA7\u51FA\u5168\u6587\u5199\u5165 outputs/_adapt/${batch}\uFF08Markdown\uFF0C\u5185\u5BB9\u53EA\u6709\u4EA7\u51FA\u672C\u8EAB\uFF09\u3002\u9664\u8BE5\u6587\u4EF6\u5916\u4E0D\u8981\u5199\u5176\u5B83\u6587\u4EF6\u3002`;
    try {
      const handle = await pushTask(prompt, { open: false });
      runCtl.current = handle.abort;
      const verdict = await handle.settled;
      if (verdict === "aborted") {
        setRunning(false);
        return;
      }
      const file = await fetchOutputContent(`_adapt/${batch}`);
      if (file.isBinary || !file.content.trim()) throw new Error("\u7ED3\u679C\u672A\u843D\u76D8");
      setResult(file.content);
    } catch (e) {
      setRunErr(`${e instanceof Error ? e.message : "\u6267\u884C\u5931\u8D25"}\uFF08\u4EA7\u51FA\u4E5F\u53EF\u80FD\u53EA\u5728\u5BF9\u8BDD\u91CC\uFF0C\u53EF\u6253\u5F00\u5BF9\u8BDD\u67E5\u770B\uFF09`);
    } finally {
      setRunning(false);
    }
  };
  const blocked = detail?.needsApi && !detail.apiConfigured;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "drawer-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "drawer", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "drawer-header", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "skill-detail-title", children: displayName(skillName) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "skill-detail-rawname", children: skillName }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "skill-detail-meta", children: [
          detail?.layer && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "badge badge-accent", children: { discover: "\u53D1\u73B0", plan: "\u7B56\u5212", produce: "\u5236\u4F5C", publish: "\u53D1\u5E03", attribute: "\u5F52\u56E0", general: "\u901A\u7528" }[detail.layer] || detail.layer }),
          detail?.needsApi && (detail.apiConfigured ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "badge badge-ok", children: "\u2713 \u5DF2\u914D\u7F6E" }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "badge badge-warn", children: "\u2757 \u9700\u914D\u7F6E API" }))
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "icon-btn", onClick: onClose, title: "\u5173\u95ED", children: "\xD7" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "drawer-body", children: [
      loadErr && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { color: "var(--red)", fontSize: 14 }, children: loadErr }),
      detail?.needsApi && detail.apiSpec && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "panel-title", children: [
          "\u{1F511} ",
          detail.apiSpec.label,
          " \xB7 API \u914D\u7F6E",
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { fontWeight: 400, color: "var(--text-secondary)", fontSize: 12 }, children: "\uFF08\u4EFB\u9009\u4E00\u4E2A\u670D\u52A1\u5546\u586B\u9F50\u5373\u53EF\u7528\uFF09" })
        ] }),
        detail.apiSpec.settings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "provider-block", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "provider-head", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("strong", { style: { fontSize: 13 }, children: "\u9ED8\u8BA4\u9009\u62E9\u4E0E\u80FD\u529B" }) }),
          detail.apiSpec.settings.map((k2) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("label", { className: "field-label", children: [
              k2.label,
              " \xB7 \u53EF\u9009",
              k2.configured && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { color: "var(--green)", marginLeft: 6 }, children: [
                "\u5DF2\u914D\u7F6E",
                k2.masked ? `\uFF1A${k2.masked}` : ""
              ] })
            ] }),
            k2.choices.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
              "select",
              {
                className: "field",
                value: envInputs[k2.env] ?? "",
                onChange: (e) => setEnvInputs((p) => ({ ...p, [k2.env]: e.target.value })),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: "", children: k2.configured ? `\u5F53\u524D\uFF1A${k2.masked}` : `\u8BF7\u9009\u62E9 ${k2.env}` }),
                  k2.choices.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: choice, children: choice }, choice))
                ]
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "input",
              {
                className: "field",
                type: k2.secret ? "password" : "text",
                placeholder: k2.configured ? "\u7559\u7A7A\u5219\u4FDD\u6301\u4E0D\u53D8\uFF0C\u8F93\u5165\u4EE5\u8986\u76D6" : `\u8BF7\u8F93\u5165 ${k2.env}`,
                value: envInputs[k2.env] || "",
                onChange: (e) => setEnvInputs((p) => ({ ...p, [k2.env]: e.target.value }))
              }
            )
          ] }, k2.env))
        ] }),
        detail.apiSpec.providers.map((prov) => {
          const provOk = prov.keys.filter((k2) => k2.required).every((k2) => k2.configured);
          return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: `provider-block ${provOk ? "configured" : ""}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "provider-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("strong", { style: { fontSize: 13 }, children: prov.name }),
              provOk ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "badge badge-ok", children: "\u2713 \u5C31\u7EEA" }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "badge", children: "\u672A\u914D\u7F6E" })
            ] }),
            prov.keys.map((k2) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("label", { className: "field-label", children: [
                k2.label,
                k2.required ? "" : " \xB7 \u53EF\u9009",
                k2.configured && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { color: "var(--green)", marginLeft: 6 }, children: [
                  "\u5DF2\u914D\u7F6E",
                  k2.secret && k2.masked ? `\uFF08${k2.masked}\uFF09` : k2.masked ? `\uFF1A${k2.masked}` : ""
                ] })
              ] }),
              k2.choices.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                "select",
                {
                  className: "field",
                  value: envInputs[k2.env] ?? "",
                  onChange: (e) => setEnvInputs((p) => ({ ...p, [k2.env]: e.target.value })),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: "", children: k2.configured ? `\u5F53\u524D\uFF1A${k2.masked}` : `\u8BF7\u9009\u62E9 ${k2.env}` }),
                    k2.choices.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: choice, children: choice }, choice))
                  ]
                }
              ) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "input",
                {
                  className: "field",
                  type: k2.secret ? "password" : "text",
                  placeholder: k2.configured ? "\u7559\u7A7A\u5219\u4FDD\u6301\u4E0D\u53D8\uFF0C\u8F93\u5165\u4EE5\u8986\u76D6" : `\u8BF7\u8F93\u5165 ${k2.env}`,
                  value: envInputs[k2.env] || "",
                  onChange: (e) => setEnvInputs((p) => ({ ...p, [k2.env]: e.target.value }))
                }
              )
            ] }, k2.env))
          ] }, prov.id);
        }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "btn btn-primary btn-sm", onClick: handleSaveEnv, disabled: saving, children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5230 .env" }),
          savedMsg && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { fontSize: 13, color: savedMsg.includes("\u2713") ? "var(--green)" : "var(--text-secondary)" }, children: savedMsg })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "panel-title", children: "\u25B6 \u8FD0\u884C" }),
        blocked && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 13, color: "var(--amber)", marginBottom: 10 }, children: "\u8BE5 SKILL \u9700\u8981\u5148\u914D\u7F6E\u4E0A\u9762\u7684 API \u624D\u80FD\u8FD0\u884C\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "textarea",
          {
            className: "field",
            placeholder: "\u8F93\u5165\u5185\u5BB9\uFF0C\u4F8B\u5982\u4E3B\u9898 / \u7D20\u6750 / \u8981\u6C42\u2026",
            value: input,
            onChange: (e) => setInput(e.target.value),
            style: { minHeight: 100 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { marginTop: 10, display: "flex", gap: 8, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "btn btn-primary", onClick: handleRun, disabled: running || !input.trim() || blocked, children: running ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "spinner", style: { width: 14, height: 14, margin: 0 } }),
            "\u6267\u884C\u4E2D\u2026"
          ] }) : "\u6267\u884C" }),
          running && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "btn btn-sm", onClick: () => runCtl.current?.(), children: "\u505C\u6B62" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "btn btn-sm btn-ghost", onClick: () => onNavigate?.("chat"), children: "\u6253\u5F00\u5BF9\u8BDD" })
          ] })
        ] }),
        running && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }, children: "\u4EFB\u52A1\u5728 dsh \u5BF9\u8BDD\u91CC\u540E\u53F0\u6267\u884C\uFF1B\u9047\u5230\u5DE5\u5177\u786E\u8BA4/\u63D0\u95EE\u8BF7\u5230\u5BF9\u8BDD\u91CC\u5904\u7406\u3002" }),
        runErr && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { color: "var(--red)", fontSize: 13, marginTop: 10 }, children: runErr }),
        resultHtml && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "skill-result", dangerouslySetInnerHTML: { __html: resultHtml } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "panel-title", children: "\u{1F4D6} \u8BF4\u660E" }),
        detail ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "skill-body-md", dangerouslySetInnerHTML: { __html: bodyHtml } }) : !loadErr && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "loading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "spinner" }),
          "\u52A0\u8F7D\u4E2D\u2026"
        ] })
      ] })
    ] })
  ] }) });
}

// src/components/SkillPage.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var LAYERS = [
  { key: "discover", label: "\u53D1\u73B0", Icon: IconSearch, color: "var(--layer-discover)" },
  { key: "plan", label: "\u7B56\u5212", Icon: IconCompass, color: "var(--layer-plan)" },
  { key: "produce", label: "\u5236\u4F5C", Icon: IconSkills, color: "var(--layer-produce)" },
  { key: "publish", label: "\u53D1\u5E03", Icon: IconSend, color: "var(--layer-publish)" },
  { key: "attribute", label: "\u5F52\u56E0", Icon: IconChart, color: "var(--layer-attribute)" },
  { key: "general", label: "\u901A\u7528", Icon: IconLayers, color: "var(--layer-general)" }
];
var LAYER_META = Object.fromEntries(LAYERS.map((l3) => [l3.key, l3]));
var OTHER = { key: "other", label: "\u5176\u4ED6", Icon: IconLayers, color: "var(--layer-general)" };
function iconFor(name, LayerIcon) {
  const n = name.toLowerCase();
  const map = [
    [/video|clip|reframe|highlight|beat|slideshow|intro|chapter/, IconVideo],
    [/image|img|photo|poster|infographic|comparison|meme|remove-bg|green-screen|enhance/, IconImage],
    [/music|audio|bgm|mix|denoise/, IconMusic],
    [/voice|tts|clone|subtitle/, IconMic],
    [/card|xhs|xiaohongshu|note/, IconLayout],
    [/copy|writ|text|polish|condens|style|format|content/, IconText],
    [/chart|data|report|roi|analy|insight|scor/, IconChart],
    [/publish|upload|wechat|zhihu|bilibili|douyin|kuaishou|channel/, IconSend],
    [/rss|trend|news|discover|ugc|competitor|hot/, IconSearch],
    [/profile|persona|brand|position|audience/, IconProfile],
    [/schedul|calendar|plan|strategy|campaign|matrix/, IconCompass],
    [/asset|template|batch|doc|mindmap|link/, IconOutputs]
  ];
  for (const [re2, C2] of map) if (re2.test(n)) return C2;
  return LayerIcon;
}
var LAYER_DESC = {
  discover: "\u53D1\u73B0\u5C42\u6280\u80FD",
  plan: "\u7B56\u5212\u5C42\u6280\u80FD",
  produce: "\u5236\u4F5C\u5C42\u6280\u80FD",
  publish: "\u53D1\u5E03\u5C42\u6280\u80FD",
  attribute: "\u5F52\u56E0\u5C42\u6280\u80FD",
  general: "\u901A\u7528\u6280\u80FD",
  other: "\u6280\u80FD"
};
function SkillPage({ persona, onNavigate }) {
  const [skills, setSkills] = (0, import_react7.useState)([]);
  const [error, setError] = (0, import_react7.useState)("");
  const [query, setQuery] = (0, import_react7.useState)("");
  const [selected, setSelected] = (0, import_react7.useState)(null);
  const load = () => {
    fetchSkills().then(setSkills).catch(() => setError("\u52A0\u8F7D SKILL \u5217\u8868\u5931\u8D25"));
  };
  (0, import_react7.useEffect)(load, []);
  const filtered = (0, import_react7.useMemo)(() => {
    const q2 = query.trim().toLowerCase();
    if (!q2) return skills;
    return skills.filter((s) => s.name.toLowerCase().includes(q2) || (s.description || "").toLowerCase().includes(q2) || displayName(s.name).toLowerCase().includes(q2));
  }, [skills, query]);
  const grouped = (0, import_react7.useMemo)(() => {
    const g = {};
    for (const s of filtered) {
      const key = LAYER_META[s.layer] ? s.layer : "other";
      (g[key] ||= []).push(s);
    }
    return g;
  }, [filtered]);
  const orderedLayers = [...LAYERS, OTHER].filter((l3) => grouped[l3.key]?.length);
  const needApiCount = skills.filter((s) => s.needsApi && !s.apiConfigured).length;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "skills-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "skills-page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h1", { className: "page-title", children: "\u6280\u80FD\u5E93" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "page-subtitle", children: [
        "\u5171 ",
        skills.length,
        " \u4E2A\u6280\u80FD\uFF0C\u6309\u6D41\u6C34\u7EBF\u5C42\u5206\u533A\u6D4F\u89C8\u3002\u70B9\u5361\u7247\u67E5\u770B\u8BF4\u660E\u3001\u5C31\u5730\u8FD0\u884C\uFF1B \u6807 ",
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "badge badge-warn", style: { padding: "1px 7px" }, children: "\u9700 API" }),
        " \u7684\u9700\u5148\u914D\u7F6E\u5BC6\u94A5",
        needApiCount > 0 && `\uFF08\u5F53\u524D ${needApiCount} \u4E2A\u5F85\u914D\u7F6E\uFF09`,
        "\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "skill-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "skill-search-ic", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconSearch, { size: 16 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "input",
          {
            className: "field",
            placeholder: "\u641C\u7D22\u6280\u80FD\u540D\u6216\u63CF\u8FF0\u2026",
            value: query,
            onChange: (e) => setQuery(e.target.value)
          }
        ),
        query && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { className: "btn btn-ghost btn-sm", onClick: () => setQuery(""), children: "\u6E05\u9664" })
      ] })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { color: "var(--red)", maxWidth: 1100, margin: "16px auto" }, children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "skills-body", children: [
      orderedLayers.length === 0 && !error && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "empty-state", style: { height: 240 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "empty-icon", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconSearch, { size: 40 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
          "\u6CA1\u6709\u5339\u914D\u300C",
          query,
          "\u300D\u7684\u6280\u80FD"
        ] })
      ] }),
      orderedLayers.map((layer) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "section-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "section-ic", style: { color: layer.color }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(layer.Icon, { size: 15 }) }),
          layer.label,
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { style: { color: "var(--text-tertiary)", fontWeight: 500 }, children: [
            "\xB7 ",
            grouped[layer.key].length
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-grid", children: grouped[layer.key].map((s) => {
          const meta = LAYER_META[s.layer] || OTHER;
          const Icon11 = iconFor(s.name, meta.Icon);
          const alert2 = s.needsApi && !s.apiConfigured;
          return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
            "div",
            {
              className: "card card-hover skill-card",
              style: { ["--layer-color"]: meta.color },
              onClick: () => setSelected(s.name),
              children: [
                alert2 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-card-alert", title: "\u9700\u8981\u914D\u7F6E API key", children: "!" }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-card-icon", style: { color: meta.color }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Icon11, { size: 19 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-card-name", children: displayName(s.name) }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-card-rawname", children: s.name }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-card-desc", children: s.description?.trim() || LAYER_DESC[layer.key] }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "skill-card-foot", children: s.needsApi && (s.apiConfigured ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "badge badge-ok", children: "\u5DF2\u914D\u7F6E" }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "badge badge-warn", children: "\u9700 API" })) })
              ]
            },
            s.name
          );
        }) })
      ] }, layer.key))
    ] }),
    selected && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      SkillDrawer,
      {
        skillName: selected,
        persona,
        onClose: () => setSelected(null),
        onConfigured: load,
        onNavigate
      }
    )
  ] });
}

// src/features/skills.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var view5 = "skills";
var order5 = 34;
var labels5 = { zh: "\u6280\u80FD\u5E93", en: "Skills" };
var Icon5 = IconSkills;
var Component5 = SkillPage;
var plugin5 = {
  name: "easel-view-skills",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view5),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Component5, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view5),
      order: order5,
      locale: "easel.panel",
      label: () => t(view5)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Icon5, { size });
    }));
  }
};

// src/features/outputs.tsx
var outputs_exports = {};
__export(outputs_exports, {
  Component: () => Component6,
  Icon: () => Icon6,
  labels: () => labels6,
  order: () => order6,
  plugin: () => plugin6,
  view: () => view6
});

// src/components/OutputsPage.tsx
var import_react8 = require("react");
var import_jsx_runtime13 = require("react/jsx-runtime");
var FILTERS = [
  { key: "all", label: "\u5168\u90E8" },
  { key: "image", label: "\u56FE\u7247" },
  { key: "video", label: "\u89C6\u9891" },
  { key: "audio", label: "\u97F3\u9891" },
  { key: "text", label: "\u6587\u6863" }
];
var KIND_LABEL = {
  article: "\u6587\u7AE0",
  "xhs-note": "\u5C0F\u7EA2\u4E66",
  video: "\u89C6\u9891",
  cards: "\u5361\u7247",
  poster: "\u6D77\u62A5",
  audio: "\u97F3\u9891",
  other: "\u5176\u4ED6"
};
var STATUS_LABEL2 = { draft: "\u8349\u7A3F", ready: "\u5F85\u53D1", published: "\u5DF2\u53D1" };
var STATUS_COLOR = { draft: "var(--text-tertiary)", ready: "var(--amber)", published: "var(--green)" };
var badge = {
  fontSize: 11,
  padding: "1px 7px",
  borderRadius: 999,
  background: "var(--surface-hover)",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap"
};
var statusBadge = (s) => ({
  ...badge,
  background: `color-mix(in srgb, ${STATUS_COLOR[s] || "var(--text-tertiary)"} 13%, transparent)`,
  color: STATUS_COLOR[s] || "var(--text-secondary)"
});
function kindIcon(kind, size = 30) {
  if (kind === "video") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconVideo, { size });
  if (kind === "audio") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconMusic, { size });
  if (kind === "image") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconImage, { size });
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconFile, { size });
}
var isHtml = (name) => /\.html?$/i.test(name);
var kindLabel = (f) => f.kind === "text" ? isHtml(f.name) ? "\u5361\u7247" : "\u6587\u6863" : f.kind === "image" ? "\u56FE\u7247" : f.kind === "video" ? "\u89C6\u9891" : f.kind === "audio" ? "\u97F3\u9891" : "\u6587\u4EF6";
function firstMedia(node) {
  if (node.type === "file") return node.kind === "image" || node.kind === "video" ? node : null;
  for (const c of node.children || []) {
    const m2 = firstMedia(c);
    if (m2) return m2;
  }
  return null;
}
function coverNode(m2) {
  if (!m2?.cover) return null;
  const kind = /\.(mp4|mov|webm|mkv)$/i.test(m2.cover) ? "video" : "image";
  return { name: "cover", type: "file", path: m2.cover, kind };
}
function resolvePath(roots, names) {
  let nodes = roots;
  for (const nm of names) {
    const found = nodes.find((n) => n.type === "dir" && n.name === nm);
    if (!found) return nodes;
    nodes = found.children || [];
  }
  return nodes;
}
function Thumb({ f, big }) {
  if (f && f.kind === "image") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("img", { src: mediaUrl(f.path), alt: "", loading: "lazy" });
  if (f && f.kind === "video") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("video", { src: mediaUrl(f.path), preload: "metadata", muted: true });
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "gcard-ph", children: kindIcon(f?.kind, big ? 34 : 30) });
}
function OutputsPage({ jumpPath, onJumpHandled }) {
  const [roots, setRoots] = (0, import_react8.useState)([]);
  const [treeError, setTreeError] = (0, import_react8.useState)("");
  const [stack, setStack] = (0, import_react8.useState)([]);
  const [filter, setFilter] = (0, import_react8.useState)("all");
  const [selected, setSelected] = (0, import_react8.useState)(null);
  const [content, setContent] = (0, import_react8.useState)("");
  const [loading, setLoading] = (0, import_react8.useState)(false);
  const reqSeq = (0, import_react8.useRef)(0);
  const load = (0, import_react8.useCallback)(() => {
    setTreeError("");
    fetchOutputs().then(setRoots).catch(() => setTreeError("\u52A0\u8F7D\u4EA7\u7269\u5217\u8868\u5931\u8D25"));
  }, []);
  (0, import_react8.useEffect)(() => {
    load();
  }, [load]);
  const currentNodes = (0, import_react8.useMemo)(() => resolvePath(roots, stack), [roots, stack]);
  const dirs = (0, import_react8.useMemo)(
    () => currentNodes.filter((n) => n.type === "dir").sort((a, b2) => (b2.mtime || 0) - (a.mtime || 0)),
    [currentNodes]
  );
  const files = (0, import_react8.useMemo)(() => {
    const fs = currentNodes.filter((n) => n.type === "file").sort((a, b2) => (b2.mtime || 0) - (a.mtime || 0));
    return filter === "all" ? fs : fs.filter((f) => f.kind === filter);
  }, [currentNodes, filter]);
  const atTop = stack.length === 0;
  const atProjectRoot = stack.length === 1;
  const projectMeta = (0, import_react8.useMemo)(
    () => stack.length >= 1 ? roots.find((r) => r.name === stack[0])?.meta : void 0,
    [roots, stack]
  );
  const deliverableSet = (0, import_react8.useMemo)(
    () => new Set(atProjectRoot ? projectMeta?.deliverablePaths || [] : []),
    [projectMeta, atProjectRoot]
  );
  const hasSplit = atProjectRoot && deliverableSet.size > 0;
  const deliverableFiles = (0, import_react8.useMemo)(
    () => hasSplit ? files.filter((f) => deliverableSet.has(f.path)) : [],
    [files, deliverableSet, hasSplit]
  );
  const restFiles = (0, import_react8.useMemo)(
    () => hasSplit ? files.filter((f) => !deliverableSet.has(f.path)) : files,
    [files, deliverableSet, hasSplit]
  );
  const enterDir = (0, import_react8.useCallback)((name) => {
    setStack((s) => [...s, name]);
    setFilter("all");
  }, []);
  const goTo = (0, import_react8.useCallback)((depth) => {
    setStack((s) => s.slice(0, depth));
    setFilter("all");
  }, []);
  const remove = (0, import_react8.useCallback)(async (node, e) => {
    e.stopPropagation();
    const isDir = node.type === "dir";
    const label2 = isDir ? `\u9879\u76EE/\u6587\u4EF6\u5939\u300C${node.meta?.title || node.name}\u300D\u53CA\u5176\u5168\u90E8\u5185\u5BB9` : `\u6587\u4EF6\u300C${node.name}\u300D`;
    if (!window.confirm(`\u786E\u5B9A\u5220\u9664${label2}\uFF1F
\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002`)) return;
    try {
      await deleteOutput(node.path);
      setSelected((cur) => cur?.path === node.path ? null : cur);
      load();
    } catch (err) {
      alert(err.message || "\u5220\u9664\u5931\u8D25");
    }
  }, [load]);
  const open = (0, import_react8.useCallback)(async (f) => {
    const seq = ++reqSeq.current;
    setSelected(f);
    setContent("");
    if (f.kind === "text" && !isHtml(f.name)) {
      setLoading(true);
      try {
        const res = await fetchOutputContent(f.path);
        if (seq === reqSeq.current) setContent(res.isBinary ? "" : res.content);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    }
  }, []);
  (0, import_react8.useEffect)(() => {
    if (!jumpPath || roots.length === 0) return;
    const parts = jumpPath.split("/").filter(Boolean);
    const parent = [];
    let nodes = roots;
    let node;
    for (const part of parts) {
      node = nodes.find((candidate) => candidate.name === part);
      if (!node || node.type !== "dir") break;
      parent.push(part);
      nodes = node.children || [];
    }
    if (node?.path !== parts.join("/")) node = void 0;
    setStack(parent);
    setFilter("all");
    if (node?.type === "file") void open(node);
    else setSelected(null);
    onJumpHandled?.();
  }, [jumpPath, roots, open, onJumpHandled]);
  const preview = () => {
    if (!selected) return null;
    const url = mediaUrl(selected.path);
    if (selected.kind === "image") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("img", { src: url, alt: selected.name, style: { maxWidth: "100%", borderRadius: "var(--radius)" } });
    if (selected.kind === "video") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("video", { src: url, controls: true, style: { maxWidth: "100%", borderRadius: "var(--radius)" } });
    if (selected.kind === "audio") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("audio", { src: url, controls: true, style: { width: "100%" } });
    if (selected.kind === "text" && isHtml(selected.name)) return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        "iframe",
        {
          src: `${url}?v=${selected.mtime ?? 0}`,
          title: selected.name,
          sandbox: "allow-scripts",
          allow: "clipboard-write",
          style: { width: "100%", height: "68vh", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "#fff" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("a", { href: url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent-start)", fontSize: 13 }, children: "\u5728\u65B0\u6807\u7B7E\u6253\u5F00 \u2197" }) })
    ] });
    if (selected.kind === "text") {
      if (loading) return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "loading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "spinner" }),
        "\u52A0\u8F7D\u4E2D\u2026"
      ] });
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "outputs-viewer-content", dangerouslySetInnerHTML: { __html: renderMarkdown(content) } });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { color: "var(--text-secondary)", fontSize: 14 }, children: [
      "\u65E0\u6CD5\u9884\u89C8\u3002",
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("a", { href: url, download: true, style: { color: "var(--accent-start)" }, children: [
        "\u4E0B\u8F7D ",
        selected.name
      ] })
    ] });
  };
  const renderDir = (d2) => {
    const m2 = d2.meta;
    const cover = coverNode(m2) || firstMedia(d2);
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "card card-hover gcard", onClick: () => enterDir(d2.name), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gcard-thumb", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "gcard-kind", children: m2?.kind ? KIND_LABEL[m2.kind] || m2.kind : "\u6587\u4EF6\u5939" }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "gcard-del", title: "\u5220\u9664", onClick: (e) => remove(d2, e), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconTrash, { size: 14 }) }),
        cover ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Thumb, { f: cover, big: true }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "gcard-ph", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconFolder, { size: 38 }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gcard-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gcard-name", title: m2?.title || d2.name, children: [
          !m2 && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconFolder, { size: 13 }),
          " ",
          m2?.title || d2.name
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gcard-sub", style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }, children: [
          m2?.platform && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { style: badge, children: m2.platform }),
          m2?.status && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { style: statusBadge(m2.status), children: STATUS_LABEL2[m2.status] || m2.status }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { children: [
            d2.fileCount ?? 0,
            " \u4E2A\u6587\u4EF6"
          ] })
        ] })
      ] })
    ] }, d2.path);
  };
  const renderFile = (f) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "card card-hover gcard", onClick: () => open(f), children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gcard-thumb", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "gcard-kind", children: kindLabel(f) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "gcard-del", title: "\u5220\u9664", onClick: (e) => remove(f, e), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconTrash, { size: 14 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Thumb, { f })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "gcard-meta", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "gcard-name", title: f.name, children: f.name }) })
  ] }, f.path);
  const empty = dirs.length === 0 && files.length === 0;
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gallery-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gallery-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("h1", { className: "page-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconOutputs, { size: 21 }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "crumb", onClick: () => goTo(0), children: "\u5185\u5BB9\u5E93" }),
          stack.map((name, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "crumb-sep", children: "/" }),
            i === stack.length - 1 ? projectMeta?.title && i === 0 ? projectMeta.title : name : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "crumb", onClick: () => goTo(i + 1), children: name })
          ] }, i))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "page-subtitle", children: atTop ? `\u6309\u9879\u76EE\u5F52\u6863\uFF0C\u5171 ${roots.length} \u4E2A\u9879\u76EE\u3002\u70B9\u9879\u76EE\u8FDB\u53BB\u770B\u6210\u54C1\u4E0E\u7D20\u6750\u3002` : `${dirs.length} \u4E2A\u6587\u4EF6\u5939 \xB7 ${files.length} \u4E2A\u6587\u4EF6\uFF08\u53EF\u7EE7\u7EED\u70B9\u5F00\u5B50\u6587\u4EF6\u5939\uFF09` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("button", { className: "btn btn-sm", onClick: load, children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconRefresh, { size: 14 }),
        " \u5237\u65B0"
      ] })
    ] }),
    treeError && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "notice-error", children: treeError }),
    atProjectRoot && projectMeta?.tags && projectMeta.tags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "gallery-filters", style: { marginBottom: 4 }, children: projectMeta.tags.map((t) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { style: badge, children: [
      "#",
      t
    ] }, t)) }),
    stack.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gallery-filters", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("button", { className: "btn btn-sm", onClick: () => goTo(stack.length - 1), children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { style: { transform: "rotate(180deg)", display: "inline-flex" }, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconChevron, { size: 13 }) }),
        " \u8FD4\u56DE\u4E0A\u7EA7"
      ] }),
      files.length > 0 && FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: `chip ${filter === f.key ? "active" : ""}`, onClick: () => setFilter(f.key), children: f.label }, f.key))
    ] }),
    empty && !treeError ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "empty-state", style: { height: 300 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "empty-icon", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconOutputs, { size: 44 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: atTop ? "\u8FD8\u6CA1\u6709\u4EA7\u7269\u2014\u2014\u53BB\u5BF9\u8BDD\u6216\u6280\u80FD\u5E93\u751F\u6210\u7B2C\u4E00\u6761\u5185\u5BB9\u5427" : "\u8FD9\u4E2A\u6587\u4EF6\u5939\u662F\u7A7A\u7684" })
    ] }) : hasSplit ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
      deliverableFiles.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "section-label", style: { margin: "6px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }, children: [
          "\u6210\u54C1 \xB7 ",
          deliverableFiles.length
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "gallery-grid", children: deliverableFiles.map(renderFile) })
      ] }),
      (dirs.length > 0 || restFiles.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "section-label", style: { margin: "18px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)" }, children: "\u7D20\u6750 / \u8FC7\u7A0B\u6587\u4EF6" }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gallery-grid", children: [
          dirs.map(renderDir),
          restFiles.map(renderFile)
        ] })
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "gallery-grid", children: [
      dirs.map(renderDir),
      files.map(renderFile)
    ] }),
    selected && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "drawer-overlay", onClick: () => setSelected(null), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "drawer", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "drawer-header", style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "skill-detail-title", style: { fontSize: 16 }, children: selected.name }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "'SF Mono','Consolas',monospace" }, children: selected.path })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "icon-btn", onClick: () => setSelected(null), children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "drawer-body", children: preview() }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("button", { className: "btn btn-sm btn-danger", onClick: (e) => remove(selected, e), children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconTrash, { size: 13 }),
        " \u5220\u9664\u6B64\u6587\u4EF6"
      ] }) })
    ] }) })
  ] });
}

// src/features/outputs.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
var view6 = "outputs";
var order6 = 35;
var labels6 = { zh: "\u5185\u5BB9\u5E93", en: "Outputs" };
var Icon6 = IconOutputs;
var Component6 = OutputsPage;
var plugin6 = {
  name: "easel-view-outputs",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view6),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Component6, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view6),
      order: order6,
      locale: "easel.panel",
      label: () => t(view6)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Icon6, { size });
    }));
  }
};

// src/features/publish.tsx
var publish_exports = {};
__export(publish_exports, {
  Component: () => Component7,
  Icon: () => Icon7,
  labels: () => labels7,
  order: () => order7,
  plugin: () => plugin7,
  view: () => view7
});

// src/components/PublishPage.tsx
var import_react9 = require("react");

// src/lib/store.ts
var PUBLISH_KEY = "easel_publish_draft";
var PREVIOUS_BRAND = ["post", "craft"].join("");
function readMigratedLocalValue(key, suffix) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const previousKey = `${PREVIOUS_BRAND}_${suffix}`;
  const previous = localStorage.getItem(previousKey);
  if (previous !== null) {
    localStorage.setItem(key, previous);
    localStorage.removeItem(previousKey);
  }
  return previous;
}
var PUBLISH_DEFAULT = {
  title: "",
  body: "",
  platforms: ["xiaohongshu", "douyin"],
  overrides: {},
  tags: ""
};
function loadPublishDraft() {
  try {
    const raw = readMigratedLocalValue(PUBLISH_KEY, "publish_draft");
    if (!raw) return { ...PUBLISH_DEFAULT };
    return { ...PUBLISH_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...PUBLISH_DEFAULT };
  }
}
function savePublishDraft(d2) {
  try {
    localStorage.setItem(PUBLISH_KEY, JSON.stringify(d2));
  } catch {
  }
}

// src/components/PublishPage.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var PLATFORMS2 = [
  { key: "xiaohongshu", label: "\u5C0F\u7EA2\u4E66", titleLimit: 20, bodyLimit: 1e3, hint: "\u6807\u9898\u226420\uFF0C\u6B63\u6587\u22641000\uFF0C\u91CD\u60C5\u7EEA+\u8BDD\u9898\u6807\u7B7E" },
  { key: "douyin", label: "\u6296\u97F3", titleLimit: 55, bodyLimit: 55, hint: "\u6587\u6848\u226455\uFF0C\u524D\u51E0\u5B57\u662F\u94A9\u5B50" },
  { key: "kuaishou", label: "\u5FEB\u624B", titleLimit: 30, bodyLimit: 1e3, hint: "\u89C6\u9891\u6216\u56FE\u7247(\u56FE\u6587)\uFF0C\u6807\u9898\u226430\uFF0C\u9700\u9644\u5A92\u4F53" },
  { key: "weixin-channels", label: "\u89C6\u9891\u53F7", bodyLimit: 1e3, hint: "\u9700\u9644\u89C6\u9891\uFF0C\u77ED\u63CF\u8FF0+\u8BDD\u9898\u6807\u7B7E\uFF0C\u5FAE\u4FE1\u626B\u7801\u767B\u5F55" },
  { key: "zhihu", label: "\u77E5\u4E4E", bodyLimit: 5e3, hint: "\u957F\u6587/\u56DE\u7B54\uFF0C\u8BB2\u6E05\u903B\u8F91" },
  { key: "bilibili", label: "B\u7AD9", titleLimit: 80, bodyLimit: 2e3, hint: "\u9700\u9644\u89C6\u9891\uFF0C\u6807\u9898\u226480\u3001\u7B80\u4ECB\u22642000\uFF0C\u9ED8\u8BA4\u6295\u300C\u77E5\u8BC6\u300D\u5206\u533A" },
  { key: "wechat-oa", label: "\u516C\u4F17\u53F7", titleLimit: 64, bodyLimit: 2e4, hint: "\u56FE\u6587\u6587\u7AE0\uFF0C\u6B63\u6587\u7528 Markdown\uFF0C\u9996\u56FE\u4F5C\u5C01\u9762\uFF0C\u53D1\u5230\u8349\u7A3F\u7BB1\uFF1B\u9700\u5148\u5728\u8D26\u53F7\u9875\u300C\u767B\u5F55\u516C\u4F17\u53F7\u540E\u53F0\u300D\u626B\u7801" }
];
var PUBLISHABLE = /* @__PURE__ */ new Set(["xiaohongshu", "douyin", "kuaishou", "weixin-channels", "zhihu", "bilibili", "wechat-oa"]);
var MEDIA_REQUIRED = /* @__PURE__ */ new Set(["xiaohongshu", "douyin", "kuaishou", "weixin-channels", "bilibili", "wechat-oa"]);
var VIDEO_ONLY = /* @__PURE__ */ new Set(["douyin", "weixin-channels", "bilibili"]);
var VIDEO_RE = /\.(mp4|mov|webm|mkv|avi|m4v|flv|ts)$/i;
function PublishPage({ persona }) {
  const draft0 = loadPublishDraft();
  const [title, setTitle] = (0, import_react9.useState)(draft0.title);
  const [body, setBody] = (0, import_react9.useState)(draft0.body);
  const [platforms, setPlatforms] = (0, import_react9.useState)(draft0.platforms);
  const [overrides, setOverrides] = (0, import_react9.useState)(draft0.overrides);
  const [tags, setTags] = (0, import_react9.useState)(draft0.tags || "");
  const [editing, setEditing] = (0, import_react9.useState)(null);
  const [copied, setCopied] = (0, import_react9.useState)("");
  const [toast, setToast] = (0, import_react9.useState)("");
  const [adapting, setAdapting] = (0, import_react9.useState)(false);
  const [checking, setChecking] = (0, import_react9.useState)(false);
  const [checkResult, setCheckResult] = (0, import_react9.useState)("");
  const adaptCtl = (0, import_react9.useRef)(null);
  const checkCtl = (0, import_react9.useRef)(null);
  const [accounts, setAccounts] = (0, import_react9.useState)([]);
  const [mediaFiles, setMediaFiles] = (0, import_react9.useState)([]);
  const [selectedMedia, setSelectedMedia] = (0, import_react9.useState)([]);
  const [showPicker, setShowPicker] = (0, import_react9.useState)(false);
  const [pub, setPub] = (0, import_react9.useState)({});
  const [publishing, setPublishing] = (0, import_react9.useState)(false);
  const [pubSms, setPubSms] = (0, import_react9.useState)(null);
  const [pubSmsCode, setPubSmsCode] = (0, import_react9.useState)("");
  const [pubSmsBusy, setPubSmsBusy] = (0, import_react9.useState)(false);
  (0, import_react9.useEffect)(() => {
    savePublishDraft({ title, body, platforms, overrides, tags });
  }, [title, body, platforms, overrides, tags]);
  (0, import_react9.useEffect)(() => {
    fetchAccounts().then(setAccounts).catch(() => {
    });
    fetchOutputs().then((roots) => {
      const files = [];
      const walk = (n) => {
        if (n.type === "file") {
          if (n.kind === "image" || n.kind === "video") files.push(n);
          return;
        }
        for (const c of n.children || []) walk(c);
      };
      roots.forEach(walk);
      files.sort((a, b2) => (b2.mtime || 0) - (a.mtime || 0));
      setMediaFiles(files);
    }).catch(() => {
    });
  }, []);
  const loginOf = (key) => accounts.find((a) => a.platform === key)?.loggedIn ?? false;
  const toggle = (k2) => setPlatforms((prev) => prev.includes(k2) ? prev.filter((x2) => x2 !== k2) : [...prev, k2]);
  const showToast = (m2) => {
    setToast(m2);
    setTimeout(() => setToast(""), 2800);
  };
  const effective = (k2) => overrides[k2] ?? body;
  const empty = !title.trim() && !body.trim();
  const isVideoPath = (p) => /\.(mp4|mov|flv|mkv|avi|webm|m4v|wmv|ts|mpe?g)$/i.test(p);
  const toggleMedia = (path) => setSelectedMedia((prev) => {
    if (prev.includes(path)) return prev.filter((x2) => x2 !== path);
    if (isVideoPath(path)) {
      if (prev.length && !prev.every(isVideoPath)) {
        showToast("\u56FE\u7247\u548C\u89C6\u9891\u4E0D\u80FD\u540C\u65F6\u53D1\u5E03\uFF0C\u8BF7\u5148\u53D6\u6D88\u5DF2\u9009\u56FE\u7247");
        return prev;
      }
      return [path];
    }
    if (prev.some(isVideoPath)) {
      showToast("\u56FE\u7247\u548C\u89C6\u9891\u4E0D\u80FD\u540C\u65F6\u53D1\u5E03\uFF0C\u8BF7\u5148\u53D6\u6D88\u5DF2\u9009\u89C6\u9891");
      return prev;
    }
    return [...prev, path];
  });
  const adapt = async () => {
    if (empty || platforms.length === 0 || adapting) return;
    const sel = PLATFORMS2.filter((p) => platforms.includes(p.key));
    const batch = `adapt-${Date.now().toString(36)}`;
    const prompt = `\u8BF7\u6267\u884C\u6280\u80FD skill-content-repurposing\uFF08\u5148\u8BFB\u53D6 skills/openclaw/skill-content-repurposing/SKILL.md\uFF0C\u52A1\u5FC5\u53C2\u8003\u8BE5 SKILL \u7684 platform-specs \u4E0E\u6539\u5199\u914D\u65B9\uFF09\uFF1A\u628A\u4E0B\u9762\u8FD9\u6761\u5185\u5BB9\u6539\u7F16\u5230\u8FD9\u4E9B\u5E73\u53F0\uFF1A${sel.map((p) => p.label).join("\u3001")}\u3002
\u3010\u786C\u6027\u8981\u6C42\u3011\u6BCF\u4E2A\u5E73\u53F0\u8F93\u51FA\u201C\u53EF\u76F4\u63A5\u590D\u5236\u53D1\u5E03\u7684\u7EAF\u6587\u672C\u6B63\u6587\u201D\uFF0C\u7981\u6B62\u4EFB\u4F55 Markdown \u8BED\u6CD5\uFF1A\u4E0D\u8981 **\u52A0\u7C97**\u3001# \u6807\u9898\u3001---\u3001\u8868\u683C\u3001\u4EE3\u7801\u5757\u3001\u7F16\u53F7\u5217\u8868\u7B26\u53F7\uFF1B\u5C0F\u7EA2\u4E66\u53EF\u7528 emoji \u548C #\u8BDD\u9898\u6807\u7B7E\uFF0C\u6309\u5E73\u53F0\u4E60\u60EF\u81EA\u7136\u5206\u884C\u5373\u53EF\u3002
\u3010\u4EA4\u4ED8\u65B9\u5F0F\u3011\u628A\u6BCF\u4E2A\u5E73\u53F0\u7684\u6B63\u6587\u5206\u522B\u5199\u5165\u4EE5\u4E0B\u6587\u4EF6\uFF08UTF-8 \u7EAF\u6587\u672C\uFF0C\u4E00\u4E2A\u5E73\u53F0\u4E00\u4E2A\u6587\u4EF6\uFF0C\u6587\u4EF6\u5185\u5BB9\u53EA\u6709\u6B63\u6587\u672C\u8EAB\uFF09\uFF1A
` + sel.map((p) => `outputs/_adapt/${batch}/${p.key}.txt \u2190 ${p.label}\u7248`).join("\n") + `
\u9664\u4E0A\u8FF0\u6587\u4EF6\u5916\u4E0D\u8981\u5199\u5176\u5B83\u6587\u4EF6\u3002

\u539F\u59CB\u5185\u5BB9\uFF1A
\u6807\u9898\uFF1A${title}
\u6B63\u6587\uFF1A${body}`;
    setAdapting(true);
    try {
      const handle = await pushTask(prompt, { open: false });
      adaptCtl.current = handle.abort;
      const verdict = await handle.settled;
      if (verdict === "aborted") {
        setAdapting(false);
        return;
      }
      const next = { ...overrides };
      let hit = 0;
      for (const p of sel) {
        try {
          const file = await fetchOutputContent(`_adapt/${batch}/${p.key}.txt`);
          if (!file.isBinary && file.content.trim()) {
            next[p.key] = file.content.trim();
            hit++;
          }
        } catch {
        }
      }
      setOverrides(next);
      showToast(hit ? `\u5DF2\u751F\u6210 ${hit} \u4E2A\u5E73\u53F0\u7248\u672C` : "\u672A\u80FD\u8BFB\u56DE\u7ED3\u679C\uFF0C\u4EA7\u51FA\u53EF\u80FD\u53EA\u5728\u5BF9\u8BDD\u91CC\uFF0C\u53EF\u91CD\u8BD5");
    } catch {
      showToast("\u6539\u5199\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    } finally {
      setAdapting(false);
    }
  };
  const stopAdapt = () => adaptCtl.current?.();
  const runPrecheck = async () => {
    const batch = `precheck-${Date.now().toString(36)}.md`;
    const prompt = `\u4F60\u662F\u793E\u5A92\u53D1\u5E03\u5BA1\u6838\u52A9\u624B\u3002\u5BF9\u4E0B\u9762\u8FD9\u6761\u5F85\u53D1\u5185\u5BB9\u505A\u4E09\u9879\u68C0\u67E5\uFF0C\u7528\u7B80\u6D01\u4E2D\u6587\u5206\u70B9\u8F93\u51FA\uFF1A
1. **\u5408\u89C4\u98CE\u9669**\uFF1A\u662F\u5426\u542B\u6781\u9650\u8BCD/\u533B\u7597\u529F\u6548/\u654F\u611F\u6216\u8FDD\u89C4\u8868\u8FF0\uFF0C\u5217\u51FA\u95EE\u9898\u8BCD+\u66FF\u6362\u5EFA\u8BAE\uFF1B\u65E0\u5219\u5199"\u672A\u89C1\u660E\u663E\u98CE\u9669"\u3002
2. **\u6807\u9898/\u94A9\u5B50**\uFF1A\u7ED9\u6807\u9898\u6253 1-10 \u5206\uFF0C\u5E76\u7ED9 1-2 \u4E2A\u66F4\u597D\u7684\u5907\u9009\u3002
` + (persona ? `3. **\u4EBA\u8BBE\u4E00\u81F4\u6027**\uFF1A\u7ED3\u5408\u6211\u7684\u753B\u50CF\u300C${persona}\u300D\uFF08profiles/${persona}/ \u4E0B\u7684\u516D\u7EF4\u6587\u4EF6\uFF09\u68C0\u67E5\u5185\u5BB9\u662F\u5426\u8D34\u5408\u4EBA\u8BBE\u3002
` : `3. **\u4EBA\u8BBE\u4E00\u81F4\u6027**\uFF1A\u672A\u9009\u62E9\u753B\u50CF\uFF0C\u6CE8\u660E"\u672A\u9009\u62E9\u753B\u50CF\uFF0C\u5DF2\u8DF3\u8FC7"\u3002
`) + `\u6700\u540E\u4E00\u884C\u7ED9\u300C\u2705\u53EF\u53D1 / \u26A0\uFE0F\u5EFA\u8BAE\u4FEE\u6539\u300D\u7ED3\u8BBA\u3002
\u5B8C\u6210\u540E\u628A\u5B8C\u6574\u9884\u68C0\u62A5\u544A\u5199\u5165 outputs/_adapt/${batch}\uFF08Markdown\uFF09\u3002\u9664\u8BE5\u6587\u4EF6\u5916\u4E0D\u8981\u5199\u5176\u5B83\u6587\u4EF6\u3002

\u5F85\u68C0\u5185\u5BB9\uFF1A
\u6807\u9898\uFF1A${title}
\u6B63\u6587\uFF1A${body}`;
    const handle = await pushTask(prompt, { open: false });
    checkCtl.current = handle.abort;
    const verdict = await handle.settled;
    if (verdict !== "done") throw new Error("\u9884\u68C0\u672A\u5B8C\u6210\uFF08\u8BE6\u60C5\u89C1\u5BF9\u8BDD\uFF09");
    const file = await fetchOutputContent(`_adapt/${batch}`);
    if (file.isBinary || !file.content.trim()) throw new Error("\u9884\u68C0\u7ED3\u679C\u672A\u843D\u76D8\uFF08\u8BE6\u60C5\u89C1\u5BF9\u8BDD\uFF09");
    return file.content;
  };
  const check = async () => {
    if (empty) return;
    setChecking(true);
    setCheckResult("");
    try {
      setCheckResult(await runPrecheck());
    } catch (e) {
      setCheckResult(e instanceof Error ? e.message : "\u9884\u68C0\u5931\u8D25");
    } finally {
      setChecking(false);
    }
  };
  const publishAll = async () => {
    if (empty || publishing || checking) return;
    const targets = PLATFORMS2.filter((p) => platforms.includes(p.key) && PUBLISHABLE.has(p.key));
    if (targets.length === 0) {
      showToast("\u6240\u9009\u5E73\u53F0\u6682\u4E0D\u652F\u6301\u4E00\u952E\u53D1\u5E03\uFF08B\u7AD9\u8BF7\u7528\u300C\u590D\u5236\u300D\u6216\u7EC8\u7AEF biliup\uFF09");
      return;
    }
    setChecking(true);
    try {
      setCheckResult(await runPrecheck());
    } catch (e) {
      setCheckResult(`\u9884\u68C0\u5931\u8D25\uFF1A${e instanceof Error ? e.message : "\u672A\u77E5\u9519\u8BEF"}

\u9884\u68C0\u4EC5\u7528\u4E8E\u63D0\u9192\uFF0C\u4E0D\u4F1A\u963B\u6B62\u4F60\u7EE7\u7EED\u53D1\u5E03\u3002`);
    } finally {
      setChecking(false);
    }
    const okToSend = window.confirm(
      `\u53D1\u5E03\u524D\u9884\u68C0\u5DF2\u6267\u884C\uFF0C\u7ED3\u679C\u5DF2\u663E\u793A\u5728\u9875\u9762\u4E2D\u3002\u4EBA\u8BBE\u8BC4\u5206\u53EA\u505A\u63D0\u9192\uFF0C\u4E0D\u4F1A\u963B\u6B62\u53D1\u5E03\u3002

\u5373\u5C06\u3010\u771F\u5B9E\u53D1\u5E03\u3011\u5230\uFF1A${targets.map((t) => t.label).join("\u3001")}\u3002
\u8FD9\u4F1A\u516C\u5F00\u53D1\u5E03\u5230\u4F60\u7684\u8D26\u53F7\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F`
    );
    if (!okToSend) return;
    setPublishing(true);
    for (const t of targets) {
      if (!loginOf(t.key)) {
        setPub((r) => ({ ...r, [t.key]: { status: "fail", msg: "\u672A\u767B\u5F55 \xB7 \u53BB\u8D26\u53F7\u9875\u767B\u5F55" } }));
        continue;
      }
      if (MEDIA_REQUIRED.has(t.key) && selectedMedia.length === 0) {
        setPub((r) => ({ ...r, [t.key]: { status: "fail", msg: "\u9700\u9644\u5E26\u56FE\u7247/\u89C6\u9891" } }));
        continue;
      }
      if (VIDEO_ONLY.has(t.key) && !selectedMedia.some((p) => VIDEO_RE.test(p))) {
        setPub((r) => ({ ...r, [t.key]: { status: "fail", msg: `${t.label}\u53EA\u80FD\u53D1\u89C6\u9891\uFF0C\u8BF7\u4ECE\u5185\u5BB9\u5E93\u9009\u4E00\u4E2A\u89C6\u9891` } }));
        continue;
      }
      setPub((r) => ({ ...r, [t.key]: { status: "publishing", msg: "\u53D1\u5E03\u4E2D\u2026\u53EF\u80FD\u9700 1-2 \u5206\u949F" } }));
      try {
        const res = await publishNow(t.key, { title, body: effective(t.key), media: selectedMedia, tags });
        if (res.async) {
          await pollAsyncPublish(t.key, t.label);
        } else {
          setPub((r) => ({
            ...r,
            [t.key]: res.ok ? { status: "ok", msg: "\u5DF2\u53D1\u5E03 \u2705" } : { status: "fail", msg: res.detail || res.message || "\u53D1\u5E03\u5931\u8D25" }
          }));
        }
      } catch (e) {
        setPub((r) => ({ ...r, [t.key]: { status: "fail", msg: e instanceof Error ? e.message : "\u53D1\u5E03\u5931\u8D25" } }));
      }
    }
    setPublishing(false);
    showToast("\u53D1\u5E03\u6D41\u7A0B\u7ED3\u675F\uFF0C\u89C1\u5404\u5E73\u53F0\u5361\u7247\u72B6\u6001");
  };
  const pollAsyncPublish = (key, label2) => new Promise((resolve) => {
    const started = Date.now();
    const iv = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1e3) {
        clearInterval(iv);
        setPubSms(null);
        setPub((r) => ({ ...r, [key]: { status: "fail", msg: "\u53D1\u5E03\u8D85\u65F6" } }));
        resolve();
        return;
      }
      let s;
      try {
        s = await publishStatus(key);
      } catch {
        return;
      }
      if (s.state === "sms_required" || s.state === "verifying") {
        setPubSms({ platform: key, name: label2, state: s.state, message: s.message });
        setPub((r) => ({ ...r, [key]: { status: "publishing", msg: s.message || "\u9700\u77ED\u4FE1\u9A8C\u8BC1" } }));
      } else if (s.state === "success") {
        clearInterval(iv);
        setPubSms(null);
        setPub((r) => ({ ...r, [key]: { status: "ok", msg: "\u5DF2\u53D1\u5E03 \u2705" } }));
        resolve();
      } else if (s.state === "error") {
        clearInterval(iv);
        setPubSms(null);
        setPub((r) => ({ ...r, [key]: { status: "fail", msg: s.message || "\u53D1\u5E03\u5931\u8D25" } }));
        resolve();
      } else {
        setPub((r) => ({ ...r, [key]: { status: "publishing", msg: s.message || "\u53D1\u5E03\u4E2D\u2026" } }));
      }
    }, 2500);
  });
  const submitPubSms = async () => {
    if (!pubSms) return;
    const code2 = pubSmsCode.replace(/\D/g, "");
    if (code2.length < 4) {
      showToast("\u9A8C\u8BC1\u7801\u5E94\u4E3A 4-6 \u4F4D\u6570\u5B57");
      return;
    }
    setPubSmsBusy(true);
    try {
      await submitPublishSms(pubSms.platform, code2);
      setPubSmsCode("");
      setPubSms((p) => p && { ...p, state: "verifying", message: "\u6B63\u5728\u9A8C\u8BC1\u9A8C\u8BC1\u7801\u2026" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "\u63D0\u4EA4\u5931\u8D25");
    } finally {
      setPubSmsBusy(false);
    }
  };
  const copyFor = (key) => {
    const text2 = (title ? title + "\n\n" : "") + effective(key);
    navigator.clipboard?.writeText(text2);
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  };
  const addToCalendar = async (key) => {
    if (empty) return;
    const d2 = /* @__PURE__ */ new Date();
    await createSchedule({
      title: title.trim() || effective(key).slice(0, 20),
      date: d2.toISOString().slice(0, 10),
      platform: PLATFORMS2.find((p) => p.key === key)?.label || "",
      time: "",
      status: "draft",
      note: effective(key)
    });
    showToast("\u5DF2\u5B58\u4E3A\u8349\u7A3F\u5E76\u52A0\u5165\u4ECA\u5929\u7684\u65E5\u5386");
  };
  const canPublish = platforms.some((k2) => PUBLISHABLE.has(k2));
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "publish-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "publish-editor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("h1", { className: "page-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconPublish, { size: 21 }),
        " \u53D1\u5E03\u4E2D\u5FC3"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "page-subtitle", children: "\u4E00\u6B21\u7F16\u8F91 \u2192 AI \u4E00\u952E\u6539\u5199\u6210\u5404\u5E73\u53F0\u7248\u672C \u2192 \u9884\u68C0 \u2192 \u9644\u5A92\u4F53 \u2192 \u4E00\u952E\u771F\u53D1\u5E03\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("label", { className: "field-label", children: "\u6807\u9898" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "input",
        {
          className: "field",
          value: title,
          placeholder: "\u6807\u9898\uFF08\u90E8\u5206\u5E73\u53F0\u9700\u8981\uFF09",
          onChange: (e) => setTitle(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("label", { className: "field-label", children: "\u6B63\u6587\uFF08\u6BCD\u7248\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "textarea",
        {
          className: "field",
          style: { minHeight: 180 },
          value: body,
          placeholder: "\u5199\u4E0B\u4F60\u7684\u5185\u5BB9\uFF0C\u53F3\u4FA7\u6309\u5404\u5E73\u53F0\u89C4\u5219\u5B9E\u65F6\u9884\u89C8\uFF1B\u70B9\u300C\u4E00\u952E\u9002\u914D\u300D\u8BA9 AI \u5206\u5E73\u53F0\u6539\u5199\u2026",
          onChange: (e) => setBody(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("label", { className: "field-label", children: [
        "\u8BDD\u9898\u6807\u7B7E ",
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: { color: "var(--text-secondary)", fontWeight: 400, fontSize: 12 }, children: "\uFF08\u9017\u53F7\u5206\u9694\uFF0C\u5982\u300CAI,\u804C\u573A,\u5E72\u8D27\u300D\uFF1B\u5C0F\u7EA2\u4E66\u4F1A\u7528 # \u8054\u60F3\u771F\u6B63\u7ED1\u5B9A\u8BDD\u9898\uFF09" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "input",
        {
          className: "field",
          value: tags,
          placeholder: "AI,\u804C\u573A,\u5E72\u8D27",
          onChange: (e) => setTags(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("label", { className: "field-label", children: "\u53D1\u5E03\u5E73\u53F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: PLATFORMS2.map((p) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "button",
        {
          className: `chip ${platforms.includes(p.key) ? "active" : ""}`,
          onClick: () => toggle(p.key),
          children: p.label
        },
        p.key
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("label", { className: "field-label", style: { marginTop: 14 }, children: [
        "\u5A92\u4F53\u9644\u4EF6 ",
        selectedMedia.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "pv-badge", children: [
          selectedMedia.length,
          " \u4E2A"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: { color: "var(--text-secondary)", fontWeight: 400, fontSize: 12 }, children: "\uFF08\u5C0F\u7EA2\u4E66/\u6296\u97F3/\u5FEB\u624B/\u5FAE\u4FE1\u89C6\u9891\u53F7/B\u7AD9\u5FC5\u9700\uFF0C\u4ECE\u5185\u5BB9\u5E93\u9009\uFF1B\u6296\u97F3\u3001\u89C6\u9891\u53F7\u3001B\u7AD9\u987B\u4E3A\u89C6\u9891\uFF09" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "btn btn-sm", onClick: () => setShowPicker((v2) => !v2), children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconSkills, { size: 13 }),
          " ",
          showPicker ? "\u6536\u8D77" : "\u9009\u62E9\u5A92\u4F53"
        ] }),
        selectedMedia.map((path) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "media-chip", onClick: () => toggleMedia(path), title: "\u70B9\u51FB\u79FB\u9664", children: [
          mediaFiles.find((f) => f.path === path)?.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("img", { src: mediaUrl(path), alt: "" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "media-vid", children: "\u{1F3AC}" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "media-x", children: "\xD7" })
        ] }, path))
      ] }),
      showPicker && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "media-grid", children: [
        mediaFiles.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dash-empty", children: "\u5185\u5BB9\u5E93\u6682\u65E0\u56FE\u7247/\u89C6\u9891" }),
        mediaFiles.slice(0, 40).map((f) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "div",
          {
            className: `media-cell ${selectedMedia.includes(f.path) ? "sel" : ""}`,
            onClick: () => toggleMedia(f.path),
            title: f.path,
            children: [
              f.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("img", { src: mediaUrl(f.path), alt: f.name, loading: "lazy" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "media-vid", children: [
                "\u{1F3AC}",
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("br", {}),
                f.name.slice(0, 12)
              ] }),
              selectedMedia.includes(f.path) && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "media-check", children: "\u2713" })
            ]
          },
          f.path
        ))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "publish-actions", children: [
        adapting ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "btn btn-sm", onClick: stopAdapt, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconStop, { size: 13 }),
          " \u505C\u6B62\u751F\u6210"
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "btn btn-sm btn-primary", disabled: empty || platforms.length === 0, onClick: adapt, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconSkills, { size: 14 }),
          " \u4E00\u952E\u9002\u914D\u5404\u5E73\u53F0"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "btn btn-sm", disabled: empty || checking || adapting, onClick: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCheck, { size: 14 }),
          " ",
          checking ? "\u9884\u68C0\u4E2D\u2026" : "\u53D1\u5E03\u524D\u9884\u68C0"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "btn btn-sm", disabled: empty, onClick: () => addToCalendar(platforms[0] || "xiaohongshu"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCalendar, { size: 14 }),
          " \u5B58\u8349\u7A3F\u5E76\u6392\u671F"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "button",
          {
            className: "btn btn-sm btn-primary",
            disabled: empty || publishing || checking || !canPublish,
            title: canPublish ? "\u771F\u5B9E\u53D1\u5E03\u5230\u5DF2\u767B\u5F55\u5E73\u53F0" : "\u6240\u9009\u5E73\u53F0\u65E0\u4E00\u952E\u53D1\u5E03\uFF08B\u7AD9\u8D70\u7EC8\u7AEF biliup\uFF09",
            onClick: publishAll,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconPublish, { size: 14 }),
              " ",
              publishing ? "\u53D1\u5E03\u4E2D\u2026" : "\u4E00\u952E\u53D1\u5E03"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "button",
          {
            className: "btn btn-sm btn-ghost",
            disabled: empty || adapting,
            onClick: () => {
              setTitle("");
              setBody("");
              setTags("");
              setOverrides({});
              setCheckResult("");
              setPub({});
              showToast("\u5DF2\u6E05\u7A7A");
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconTrash, { size: 13 }),
              " \u6E05\u7A7A"
            ]
          }
        )
      ] }),
      adapting && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "adapt-hint", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "live-pulse" }),
        "AI \u6B63\u5728\u9010\u5B57\u6539\u5199\u5404\u5E73\u53F0\u7248\u672C\u2026\u53EF\u968F\u65F6\u505C\u6B62\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "publish-saved-note", children: "\u8349\u7A3F\u5DF2\u81EA\u52A8\u4FDD\u5B58\uFF0C\u5207\u6362\u9875\u9762/\u5237\u65B0\u56DE\u6765\u5185\u5BB9\u90FD\u5728\u3002\u4E00\u952E\u53D1\u5E03\u4EC5\u5BF9\u300C\u5DF2\u767B\u5F55 + \u5A92\u4F53\u9F50\u5168\u300D\u7684\u5E73\u53F0\u751F\u6548\u3002" }),
      checkResult && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "panel", style: { marginTop: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "panel-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCheck, { size: 14 }),
          " \u53D1\u5E03\u524D\u9884\u68C0"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "skill-body-md", dangerouslySetInnerHTML: { __html: renderMarkdown(checkResult) } })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "publish-previews", children: [
      platforms.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dash-empty", children: "\u9009\u62E9\u81F3\u5C11\u4E00\u4E2A\u5E73\u53F0\u67E5\u770B\u9884\u89C8" }),
      PLATFORMS2.filter((p) => platforms.includes(p.key)).map((p) => {
        const text2 = effective(p.key);
        const over = text2.length > p.bodyLimit;
        const titleOver = p.titleLimit != null && title.length > p.titleLimit;
        const isEdit = editing === p.key;
        const ps = pub[p.key];
        const publishable = PUBLISHABLE.has(p.key);
        const logged = loginOf(p.key);
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `card pv-card pv-${p.key}`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "pv-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "pv-plat", children: [
              p.label,
              overrides[p.key] != null && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "pv-badge", children: "AI \u7248" }),
              publishable && (logged ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "pv-badge pv-badge-ok", children: "\u5DF2\u767B\u5F55" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "pv-badge", children: "\u672A\u767B\u5F55" }))
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: `pv-count ${over ? "over" : ""}`, children: [
              text2.length,
              "/",
              p.bodyLimit
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "pv-body", children: [
            p.titleLimit != null && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `pv-title ${titleOver ? "over" : ""}`, children: title || /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "pv-ph", children: "\u6807\u9898\u2026" }) }),
            isEdit ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              "textarea",
              {
                className: "field",
                style: { minHeight: 120 },
                value: text2,
                autoFocus: true,
                onChange: (e) => setOverrides((o) => ({ ...o, [p.key]: e.target.value }))
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "pv-text", children: text2 || /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "pv-ph", children: "\u6B63\u6587\u9884\u89C8\u2026" }) })
          ] }),
          ps && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `pv-pubstate ${ps.status}`, children: [
            ps.status === "publishing" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "live-pulse" }),
            ps.status === "ok" ? "\u2705 " : ps.status === "fail" ? "\u26A0\uFE0F " : "",
            ps.msg
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "pv-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "pv-hint", children: [
              p.hint,
              over ? " \xB7 \u5DF2\u8D85\u5B57\u6570" : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "pv-copy", onClick: () => setEditing(isEdit ? null : p.key), children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconEdit, { size: 13 }),
                isEdit ? "\u5B8C\u6210" : "\u7F16\u8F91"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "pv-copy", onClick: () => copyFor(p.key), children: [
                copied === p.key ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCheck, { size: 13 }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCopy, { size: 13 }),
                copied === p.key ? "\u5DF2\u590D\u5236" : "\u590D\u5236"
              ] })
            ] })
          ] })
        ] }, p.key);
      })
    ] }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "toast ok", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "toast-icon", children: "\u2713" }),
      toast
    ] }),
    pubSms && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "overlay", onClick: (e) => {
      if (e.target === e.currentTarget) setPubSms(null);
    }, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "modal", onClick: (e) => e.stopPropagation(), style: { maxWidth: 380 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("h3", { style: { margin: "0 0 4px" }, children: [
        "\u53D1\u5E03\u9A8C\u8BC1 \xB7 ",
        pubSms.name
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { style: { fontSize: 13, color: /错误|过期|失败|重新|未完成|不正确|失效/.test(pubSms.message || "") ? "var(--red)" : "var(--text-secondary)" }, children: pubSms.message || "\u5E73\u53F0\u98CE\u63A7\u8981\u6C42\u77ED\u4FE1\u9A8C\u8BC1\uFF0C\u9A8C\u8BC1\u7801\u5DF2\u53D1\u5230\u4F60\u624B\u673A\uFF0C\u8BF7\u8F93\u5165\uFF1A" }),
      pubSms.state === "verifying" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dash-empty", style: { padding: 16 }, children: "\u6B63\u5728\u9A8C\u8BC1\u9A8C\u8BC1\u7801\u2026" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "input",
          {
            inputMode: "numeric",
            autoFocus: true,
            placeholder: "\u8BF7\u8F93\u5165\u624B\u673A\u6536\u5230\u7684\u9A8C\u8BC1\u7801",
            value: pubSmsCode,
            onChange: (e) => setPubSmsCode(e.target.value.replace(/\D/g, "").slice(0, 8)),
            onKeyDown: (e) => {
              if (e.key === "Enter") submitPubSms();
            },
            style: {
              width: "100%",
              boxSizing: "border-box",
              textAlign: "center",
              letterSpacing: 6,
              fontSize: 20,
              padding: "10px 12px",
              margin: "4px 0 10px",
              border: "1px solid var(--border)",
              borderRadius: 8
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { className: "btn btn-sm btn-ghost", onClick: () => setPubSms(null), children: "\u5173\u95ED" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { className: "btn btn-sm btn-primary", disabled: pubSmsBusy, onClick: submitPubSms, children: pubSmsBusy ? "\u63D0\u4EA4\u4E2D\u2026" : "\u63D0\u4EA4\u9A8C\u8BC1\u7801" })
        ] })
      ] })
    ] }) })
  ] });
}

// src/features/publish.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var view7 = "publish";
var order7 = 36;
var labels7 = { zh: "\u53D1\u5E03\u4E2D\u5FC3", en: "Publish" };
var Icon7 = IconPublish;
var Component7 = PublishPage;
var plugin7 = {
  name: "easel-view-publish",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view7),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Component7, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view7),
      order: order7,
      locale: "easel.panel",
      label: () => t(view7)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Icon7, { size });
    }));
  }
};

// src/features/accounts.tsx
var accounts_exports = {};
__export(accounts_exports, {
  Component: () => Component8,
  Icon: () => Icon8,
  labels: () => labels8,
  order: () => order8,
  plugin: () => plugin8,
  view: () => view8
});

// src/components/AccountsPage.tsx
var import_react10 = require("react");
var import_jsx_runtime17 = require("react/jsx-runtime");
var STATE_LABEL = {
  starting: "\u542F\u52A8\u4E2D\u2026",
  window_login: "\u8BF7\u5728\u5F39\u51FA\u7684\u6D4F\u89C8\u5668\u7A97\u53E3\u91CC\u5B8C\u6210\u767B\u5F55",
  qr_ready: "\u8BF7\u626B\u7801",
  scanned: "\u626B\u7801\u6210\u529F",
  sms_required: "\u9700\u77ED\u4FE1\u9A8C\u8BC1",
  verifying: "\u9A8C\u8BC1\u4E2D\u2026",
  success: "\u767B\u5F55\u6210\u529F \u2705",
  expired: "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F",
  error: "\u767B\u5F55\u51FA\u9519",
  unknown: "\u7B49\u5F85\u4E2D\u2026"
};
function Avatar({ url, name }) {
  const [broken, setBroken] = (0, import_react10.useState)(false);
  const initial = (name || "?").trim().charAt(0);
  if (url && !broken) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      "img",
      {
        className: "account-avatar",
        src: url,
        alt: name,
        referrerPolicy: "no-referrer",
        onError: () => setBroken(true)
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "account-avatar account-avatar-fallback", children: initial });
}
var LOGIN_MODES = [
  { key: "qr", label: "\u626B\u7801\u767B\u5F55", title: "\u65E0\u5934\u6D4F\u89C8\u5668\u51FA\u4E8C\u7EF4\u7801\uFF0C\u624B\u673A App \u626B\u7801\uFF08\u53D7\u5E73\u53F0\u98CE\u63A7\u5F71\u54CD\u6700\u5927\uFF09" },
  { key: "manual", label: "\u624B\u52A8\u767B\u5F55", title: "\u5F39\u51FA\u53EF\u89C1\u6D4F\u89C8\u5668\u7A97\u53E3\uFF0C\u4F60\u4EB2\u624B\u626B\u7801/\u8F93\u8D26\u53F7\u2014\u2014\u672C\u673A IP + \u771F\u7A97\u53E3\u6307\u7EB9\uFF0C\u6700\u63A8\u8350" },
  { key: "cdp", label: "\u63A5\u7BA1 Chrome", title: "\u63A5\u7BA1\u4F60\u4EE5\u8C03\u8BD5\u7AEF\u53E3\u542F\u52A8\u7684\u81EA\u5DF1 Chrome\uFF08\u771F\u5B9E\u6307\u7EB9/\u767B\u5F55\u6001\uFF09\u3002\u9700\u5148\u7528 chrome --remote-debugging-port=9222 \u542F\u52A8\uFF0C\u7AEF\u70B9\u5728\u70ED\u70B9\u96F7\u8FBE\u8BBE\u7F6E\u91CC\u914D" }
];
function DeconstructSources() {
  const NAMES = { douyin: "\u6296\u97F3", xhs: "\u5C0F\u7EA2\u4E66", bili: "B\u7AD9", youtube: "YouTube" };
  const HINTS = {
    douyin: "\u79FB\u52A8\u7AEF\u63A5\u53E3\u76F4\u8FDE\uFF0C\u514D\u767B\u5F55\u3002",
    xhs: "\u767B\u5F55 web \u7248\u5C0F\u7EA2\u4E66 \u2192 F12 \u2192 \u7F51\u7EDC \u2192 \u4EFB\u4E00\u8BF7\u6C42\u7684 Cookie \u8BF7\u6C42\u5934\u6574\u4E32\u7C98\u8D34\u3002",
    bili: "\u516C\u5F00\u89C6\u9891\u514D\u767B\u5F55\uFF1B\u6295\u7A3F/\u8BC4\u8BBA\u6293\u53D6\u7528\u4E0A\u65B9\u626B\u7801\u767B\u5F55\u3002",
    youtube: "\u516C\u5F00\u89C6\u9891\u514D\u767B\u5F55\uFF08\u9700\u672C\u673A yt-dlp\uFF09\u3002"
  };
  const [rows, setRows] = (0, import_react10.useState)([]);
  const [draft, setDraft] = (0, import_react10.useState)("");
  const [saving, setSaving] = (0, import_react10.useState)(false);
  const [msg, setMsg] = (0, import_react10.useState)("");
  const refresh = (0, import_react10.useCallback)(() => {
    fetch("/easel/api/source-status", { headers: { accept: "application/json" } }).then((r) => r.ok ? r.json() : Promise.reject(new Error("\u8BFB\u53D6\u5931\u8D25"))).then((data) => {
      setRows(data.platforms ?? []);
      setDraft("");
    }).catch(() => setMsg("\u8BFB\u53D6\u6570\u636E\u6E90\u72B6\u6001\u5931\u8D25\uFF0C\u7A0D\u540E\u91CD\u8BD5\u3002"));
  }, []);
  (0, import_react10.useEffect)(() => {
    refresh();
  }, [refresh]);
  (0, import_react10.useEffect)(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const importFromLogin = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/easel/api/cookies/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: "xhs" })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? "\u5BFC\u5165\u5931\u8D25");
      setMsg(`\u5DF2\u4ECE\u767B\u5F55\u4F1A\u8BDD\u5BFC\u5165 ${String(data.count ?? "")} \u6761 cookie\u3002`);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "\u5BFC\u5165\u5931\u8D25");
    } finally {
      setSaving(false);
    }
  };
  const save = async (platform, value) => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/easel/api/cookies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, cookie: value })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? "\u4FDD\u5B58\u5931\u8D25");
      setMsg(value.trim() ? "\u5DF2\u4FDD\u5B58\uFF0C\u56DE\u300C\u7206\u6B3E\u62C6\u89E3\u300D\u91CD\u65B0\u70B9\u5F00\u59CB\u91C7\u96C6\u5373\u53EF\u3002" : "\u5DF2\u6E05\u9664\u3002");
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "\u4FDD\u5B58\u5931\u8D25");
    } finally {
      setSaving(false);
    }
  };
  const badge2 = (row2) => {
    if (!row2.authRequired) return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { fontSize: 12, color: "var(--green)" }, children: "\u514D\u767B\u5F55" });
    if (row2.loggedIn) return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { fontSize: 12, color: "var(--green)" }, children: "\u5DF2\u626B\u7801\u767B\u5F55" });
    if (row2.cookieSet) return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { fontSize: 12, color: "var(--green)" }, children: "cookie \u5DF2\u914D\u7F6E" });
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { fontSize: 12, color: "var(--amber)" }, children: "\u672A\u914D\u7F6E" });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "card", style: { marginTop: 16, padding: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "account-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "account-card-name", children: "\u62C6\u89E3\u6570\u636E\u6E90\uFF08\u7206\u6B3E\u62C6\u89E3\u7684\u89C6\u9891\u6293\u53D6\u767B\u5F55\u6001\uFF09" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }, children: rows.map((row2) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { style: { minWidth: 52 }, children: NAMES[row2.platform] ?? row2.platform }),
      badge2(row2),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { color: "var(--text-secondary)", fontSize: 12.5 }, children: HINTS[row2.platform] ?? "" })
    ] }, row2.platform)) }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      "textarea",
      {
        className: "field",
        style: { minHeight: 54, marginTop: 10, fontFamily: "monospace", fontSize: 12 },
        placeholder: "\u5C0F\u7EA2\u4E66 cookie\uFF1A\u7C98\u8D34\u7F51\u9875\u7248\u767B\u5F55\u540E\u7684 Cookie \u8BF7\u6C42\u5934\u6574\u4E32\uFF08\u660E\u6587\u4E0D\u56DE\u663E\uFF1B\u7559\u7A7A\u5E76\u4FDD\u5B58=\u6E05\u9664\uFF09",
        value: draft,
        onChange: (e) => setDraft(e.target.value)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn btn-primary btn-sm", disabled: saving || !draft.trim(), onClick: () => void save("xhs", draft), children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5C0F\u7EA2\u4E66 cookie" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn btn-ghost btn-sm", disabled: saving, onClick: () => void save("xhs", ""), children: "\u6E05\u9664" }),
      rows.find((r) => r.platform === "xhs")?.loggedIn && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn btn-sm", disabled: saving, onClick: () => void importFromLogin(), children: "\u4ECE\u767B\u5F55\u4F1A\u8BDD\u5BFC\u5165" })
    ] }),
    msg && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { fontSize: 12.5, color: "var(--text-secondary)", marginTop: 8 }, children: msg })
  ] });
}
function AccountsPage() {
  const [accounts, setAccounts] = (0, import_react10.useState)([]);
  const [err, setErr] = (0, import_react10.useState)("");
  const [loginMode, setLoginMode] = (0, import_react10.useState)(
    () => localStorage.getItem("easel_login_mode") || "manual"
  );
  const pickLoginMode = (m2) => {
    setLoginMode(m2);
    try {
      localStorage.setItem("easel_login_mode", m2);
    } catch {
    }
  };
  const [qr, setQr] = (0, import_react10.useState)(null);
  const [qrNonce, setQrNonce] = (0, import_react10.useState)(0);
  const [terminalMsg, setTerminalMsg] = (0, import_react10.useState)("");
  const [busy, setBusy] = (0, import_react10.useState)("");
  const [logoutBusy, setLogoutBusy] = (0, import_react10.useState)("");
  const [smsCode, setSmsCode] = (0, import_react10.useState)("");
  const [smsBusy, setSmsBusy] = (0, import_react10.useState)(false);
  const [smsErr, setSmsErr] = (0, import_react10.useState)("");
  const [whoami, setWhoami] = (0, import_react10.useState)(() => getWhoamiCache());
  const [cred, setCred] = (0, import_react10.useState)(null);
  const [credForm, setCredForm] = (0, import_react10.useState)({ appId: "", appSecret: "", author: "" });
  const [credBusy, setCredBusy] = (0, import_react10.useState)(false);
  const [credMsg, setCredMsg] = (0, import_react10.useState)("");
  const [credErr, setCredErr] = (0, import_react10.useState)("");
  const pollRef = (0, import_react10.useRef)(null);
  const aliveRef = (0, import_react10.useRef)(true);
  const qrPlatformRef = (0, import_react10.useRef)("");
  (0, import_react10.useEffect)(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const runWhoami = (0, import_react10.useCallback)((platform) => {
    setWhoami((w2) => ({ ...w2, [platform]: "loading" }));
    accountWhoami(platform).then((r) => {
      if (aliveRef.current) {
        setWhoami((w2) => ({ ...w2, [platform]: r }));
        setWhoamiCache(platform, r);
      }
    }).catch(() => {
      if (aliveRef.current) setWhoami((w2) => {
        const n = { ...w2 };
        delete n[platform];
        return n;
      });
    });
  }, []);
  const load = (0, import_react10.useCallback)(() => {
    setErr("");
    fetchAccounts().then((list) => {
      if (!aliveRef.current) return;
      setAccounts(list);
      const targets = list.filter((a) => a.supported && a.backend !== "biliup").map((a) => a.platform);
      verifyStale(targets, {
        alive: () => aliveRef.current,
        onUpdate: (platform, r) => setWhoami((w2) => ({ ...w2, [platform]: r }))
      });
    }).catch(() => setErr("\u52A0\u8F7D\u8D26\u53F7\u72B6\u6001\u5931\u8D25"));
  }, []);
  (0, import_react10.useEffect)(() => {
    load();
  }, [load]);
  (0, import_react10.useEffect)(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !pollRef.current) load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const stopPoll = (0, import_react10.useCallback)(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  (0, import_react10.useEffect)(() => () => stopPoll(), [stopPoll]);
  const closeQr = (0, import_react10.useCallback)(() => {
    stopPoll();
    setQr(null);
    setSmsCode("");
    setSmsErr("");
    setSmsBusy(false);
    load();
  }, [stopPoll, load]);
  const submitSms = (0, import_react10.useCallback)(async () => {
    const code2 = smsCode.replace(/\D/g, "");
    if (code2.length < 4) {
      setSmsErr("\u8BF7\u8F93\u5165\u624B\u673A\u6536\u5230\u7684\u9A8C\u8BC1\u7801");
      return;
    }
    setSmsBusy(true);
    setSmsErr("");
    try {
      await submitLoginSms(qrPlatformRef.current, code2);
      setSmsCode("");
      setQr((prev) => prev && { ...prev, state: "verifying", message: "\u6B63\u5728\u9A8C\u8BC1\u9A8C\u8BC1\u7801\u2026" });
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : "\u63D0\u4EA4\u9A8C\u8BC1\u7801\u5931\u8D25");
    } finally {
      setSmsBusy(false);
    }
  }, [smsCode]);
  const openCred = (0, import_react10.useCallback)((a) => {
    setCred({ platform: a.platform, name: a.name });
    setCredForm({ appId: "", appSecret: "", author: "" });
    setCredMsg("");
    setCredErr("");
    getCredentials(a.platform).then((c) => {
      if (aliveRef.current && c.configured) setCredMsg(`\u5DF2\u914D\u7F6E\uFF1AAppID ${c.appIdMasked}`);
    }).catch(() => {
    });
  }, []);
  const closeCred = (0, import_react10.useCallback)(() => {
    setCred(null);
    setCredBusy(false);
    load();
  }, [load]);
  const submitCred = (0, import_react10.useCallback)(async () => {
    if (!cred) return;
    const appId = credForm.appId.trim();
    const appSecret = credForm.appSecret.trim();
    if (!appId || !appSecret) {
      setCredErr("AppID \u548C AppSecret \u90FD\u8981\u586B");
      return;
    }
    setCredBusy(true);
    setCredErr("");
    setCredMsg("");
    try {
      const r = await saveCredentials(cred.platform, { appId, appSecret, name: cred.name, author: credForm.author.trim() });
      if (r.ok) {
        runWhoami(cred.platform);
        closeCred();
      } else {
        setCredErr(r.message || "\u9A8C\u8BC1\u672A\u901A\u8FC7");
      }
    } catch (e) {
      setCredErr(e instanceof Error ? e.message : "\u4FDD\u5B58\u5931\u8D25");
    } finally {
      setCredBusy(false);
    }
  }, [cred, credForm, runWhoami, closeCred]);
  const handleLogin = (0, import_react10.useCallback)(async (a, mode = loginMode) => {
    if (!a.supported) return;
    if (a.backend === "wechat-oa") {
      openCred(a);
      return;
    }
    setTerminalMsg("");
    setBusy(a.platform);
    setSmsCode("");
    setSmsErr("");
    qrPlatformRef.current = a.platform;
    setQrNonce((n) => n + 1);
    try {
      const res = await startLogin(a.platform, mode);
      if (res.mode === "terminal") {
        setTerminalMsg(res.message || "\u8BF7\u5728\u7EC8\u7AEF\u767B\u5F55");
        return;
      }
      if (res.mode === "credentials") {
        openCred(a);
        return;
      }
      setQr({
        platform: a.platform,
        name: a.name,
        state: res.state || "starting",
        message: res.message || "",
        qr: res.qr || ""
      });
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const s = await loginStatus(a.platform);
          setQr((prev) => prev && { ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs });
          if (["success", "expired", "error"].includes(s.state)) {
            stopPoll();
            if (s.state === "success") {
              runWhoami(a.platform);
              if (a.platform === "xiaohongshu") {
                void fetch("/easel/api/cookies/import", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ platform: "xhs" })
                }).catch(() => {
                });
              }
            }
          }
        } catch {
        }
      }, 2e3);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "\u542F\u52A8\u767B\u5F55\u5931\u8D25");
    } finally {
      setBusy("");
    }
  }, [loginMode, stopPoll, runWhoami]);
  const handleMpLogin = (0, import_react10.useCallback)(async (a) => {
    setBusy(a.platform + ":mp");
    setSmsCode("");
    setSmsErr("");
    setQrNonce((n) => n + 1);
    try {
      const res = await startMpLogin(a.platform);
      setQr({
        platform: a.platform,
        name: a.name + " \xB7 \u540E\u53F0\u53D6\u6570",
        state: res.state || "starting",
        message: res.message || "",
        qr: res.qr || "",
        qrTs: res.qrTs
      });
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const s = await mpLoginStatus(a.platform);
          setQr((prev) => prev && { ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs });
          if (["success", "expired", "error"].includes(s.state)) {
            stopPoll();
            if (s.state === "success") {
              setAccounts((list) => list.map((x2) => x2.platform === a.platform ? { ...x2, loggedIn: true } : x2));
              setWhoami((w2) => {
                const n = { ...w2 };
                delete n[a.platform];
                return n;
              });
              setWhoamiCache(a.platform, null);
              runWhoami(a.platform);
              load();
            }
          }
        } catch {
        }
      }, 2e3);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "\u542F\u52A8\u540E\u53F0\u767B\u5F55\u5931\u8D25");
    } finally {
      setBusy("");
    }
  }, [stopPoll, runWhoami, load]);
  const handleLogout = (0, import_react10.useCallback)(async (a) => {
    if (!window.confirm(`\u786E\u5B9A\u9000\u51FA\u300C${a.name}\u300D\u7684\u767B\u5F55\uFF1F\u767B\u5F55\u6001\u5C06\u88AB\u6E05\u9664\uFF0C\u4E0B\u6B21\u53D1\u5E03\u9700\u91CD\u65B0\u626B\u7801\u3002`)) return;
    setLogoutBusy(a.platform);
    try {
      await logoutAccount(a.platform);
      setAccounts((list) => list.map((x2) => x2.platform === a.platform ? { ...x2, loggedIn: false } : x2));
      setWhoami((w2) => {
        const n = { ...w2 };
        delete n[a.platform];
        return n;
      });
      setWhoamiCache(a.platform, null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "\u9000\u51FA\u767B\u5F55\u5931\u8D25");
    } finally {
      setLogoutBusy("");
    }
  }, [load]);
  const effLoggedIn = (a) => {
    if (a.backend === "wechat-oa") return a.loggedIn;
    const w2 = whoami[a.platform];
    if (w2 && w2 !== "loading") return w2.loggedIn;
    return a.loggedIn;
  };
  const badge2 = (a) => {
    if (!a.supported) return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "badge", children: "\u5F85\u91CD\u5199" });
    if (whoami[a.platform] === "loading") return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "badge", children: "\u6821\u9A8C\u4E2D\u2026" });
    if (effLoggedIn(a)) return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "badge badge-ok", children: "\u2713 \u5DF2\u767B\u5F55" });
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "badge", children: "\u672A\u767B\u5F55" });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "accounts-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h1", { className: "page-title", children: "\u8D26\u53F7\u767B\u5F55 Accounts" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("p", { className: "page-subtitle", children: [
          "\u7528\u624B\u673A App \u626B\u7801\u767B\u5F55\uFF0C\u767B\u5F55\u6001\u672C\u5730\u6301\u4E45\u5316\uFF0C\u4E4B\u540E\u53D1\u5E03\u514D\u767B\u3002",
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
          "\u26A0\uFE0F \u5E73\u53F0\u53EF\u80FD\u5BF9\u673A\u623F/\u4EE3\u7406 IP \u5224\u98CE\u9669\u5BFC\u81F4\u4E8C\u7EF4\u7801\u5F39\u4E0D\u51FA\uFF0C\u9700\u5E72\u51C0/\u5BB6\u5BBD IP\uFF0C\u6216\u5728\u6B63\u5E38\u7F51\u7EDC\u767B\u5F55\u540E\u62F7\u8D1D\u767B\u5F55\u6001\u76EE\u5F55\u3002"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn btn-sm", onClick: load, children: "\u27F3 \u5237\u65B0" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { display: "flex", gap: 0, borderRadius: 980, overflow: "hidden", boxShadow: "var(--shadow-sm)" }, children: LOGIN_MODES.map((m2) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          "button",
          {
            title: m2.title,
            onClick: () => pickLoginMode(m2.key),
            style: {
              padding: "5px 12px",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: loginMode === m2.key ? 600 : 400,
              background: loginMode === m2.key ? "var(--accent-soft)" : "var(--surface)",
              color: loginMode === m2.key ? "var(--accent-start)" : "var(--text-secondary)"
            },
            children: m2.label
          },
          m2.key
        )) })
      ] })
    ] }),
    err && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { color: "var(--red)", fontSize: 13, marginTop: 12 }, children: err }),
    terminalMsg && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "card", style: { padding: 13, fontSize: 13, marginTop: 14 }, children: terminalMsg }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "accounts-grid", children: accounts.map((a) => {
      const w2 = whoami[a.platform];
      const info = w2 && w2 !== "loading" ? w2 : null;
      const logged = effLoggedIn(a);
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "card account-card", style: { opacity: a.supported ? 1 : 0.6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "account-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "account-card-name", children: a.name }),
          badge2(a)
        ] }),
        logged && info && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "account-identity", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Avatar, { url: info.avatar, name: info.name || a.name }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "account-nick", children: info.name || "\uFF08\u5DF2\u767B\u5F55\uFF09" })
        ] }),
        !logged && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "account-card-note", children: a.note ? a.note : `\u540E\u7AEF\uFF1A${a.name}` }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { display: "flex", gap: 8, marginTop: "auto" }, children: logged ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            "button",
            {
              className: "btn btn-sm",
              style: { flex: 1 },
              disabled: busy === a.platform || busy === a.platform + ":mp" || w2 === "loading",
              onClick: () => runWhoami(a.platform),
              children: w2 === "loading" ? "\u6821\u9A8C\u4E2D\u2026" : "\u6821\u9A8C\u8D26\u53F7"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            "button",
            {
              className: "btn btn-sm btn-ghost",
              style: { flex: 1 },
              disabled: logoutBusy === a.platform,
              onClick: () => handleLogout(a),
              children: logoutBusy === a.platform ? "\u9000\u51FA\u4E2D\u2026" : "\u9000\u51FA\u767B\u5F55"
            }
          )
        ] }) : (
          // 公众号与其它平台统一：都走扫码登录（公众号扫的是后台会话，用于发布+数据）
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            "button",
            {
              className: `btn btn-block ${a.supported ? "btn-primary" : ""}`,
              disabled: !a.supported || busy === a.platform || busy === a.platform + ":mp",
              onClick: () => a.backend === "wechat-oa" ? handleMpLogin(a) : handleLogin(a),
              children: busy === a.platform || busy === a.platform + ":mp" ? "\u542F\u52A8\u4E2D\u2026" : "\u767B\u5F55"
            }
          )
        ) })
      ] }, a.platform);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(DeconstructSources, {}),
    qr && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "overlay", onClick: closeQr, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
      "div",
      {
        className: "modal",
        style: { width: 360, maxWidth: "100%", textAlign: "center" },
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("h3", { style: { margin: "0 0 4px" }, children: [
            "\u767B\u5F55 ",
            qr.name
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: {
            fontSize: 13,
            marginBottom: 14,
            color: qr.state === "success" ? "var(--green)" : ["error", "expired"].includes(qr.state) ? "var(--red)" : "var(--text-secondary)"
          }, children: [
            STATE_LABEL[qr.state] || qr.state,
            qr.message ? ` \u2014 ${qr.message}` : ""
          ] }),
          qr.state === "sms_required" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { padding: "6px 4px 2px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: {
              fontSize: 13,
              marginBottom: 10,
              color: /错误|过期|失败|重新|未找到|未完成|不正确|失效/.test(qr.message || "") ? "var(--red)" : "var(--text-secondary)"
            }, children: qr.message || "\u5E73\u53F0\u98CE\u63A7\u8981\u6C42\u77ED\u4FE1\u9A8C\u8BC1\uFF0C\u9A8C\u8BC1\u7801\u5DF2\u53D1\u5230\u4F60\u624B\u673A\uFF0C\u8BF7\u8F93\u5165\uFF1A" }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              "input",
              {
                value: smsCode,
                onChange: (e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 8)),
                onKeyDown: (e) => {
                  if (e.key === "Enter") submitSms();
                },
                placeholder: "\u77ED\u4FE1\u9A8C\u8BC1\u7801",
                inputMode: "numeric",
                autoFocus: true,
                style: {
                  width: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  letterSpacing: 6,
                  fontSize: 20,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8
                }
              }
            ),
            smsErr && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { color: "var(--red)", fontSize: 12, marginTop: 6 }, children: smsErr }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              "button",
              {
                className: "btn btn-primary btn-block",
                style: { marginTop: 12 },
                disabled: smsBusy,
                onClick: submitSms,
                children: smsBusy ? "\u63D0\u4EA4\u4E2D\u2026" : "\u63D0\u4EA4\u9A8C\u8BC1\u7801"
              }
            )
          ] }) : qr.state === "window_login" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { padding: "18px 6px", textAlign: "left", fontSize: 13, lineHeight: 1.7 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { fontSize: 30, textAlign: "center", marginBottom: 10 }, children: "\u{1FA9F}" }),
            qr.message || "\u8BF7\u5728\u5F39\u51FA\u7684\u6D4F\u89C8\u5668\u7A97\u53E3\u91CC\u5B8C\u6210\u767B\u5F55\u3002",
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { color: "var(--text-secondary)" }, children: "\u5B8C\u6210\u540E\u8FD9\u91CC\u4F1A\u81EA\u52A8\u68C0\u6D4B\u5230\u767B\u5F55\u6210\u529F\uFF1B\u671F\u95F4\u4E0D\u8981\u5173\u95ED\u90A3\u4E2A\u7A97\u53E3\u3002" })
          ] }) : qr.state === "qr_ready" && qr.qr ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("img", { className: "qr-img", src: `${mediaUrl(qr.qr)}?v=${qr.qrTs || qrNonce}`, alt: "\u767B\u5F55\u4E8C\u7EF4\u7801" }) : qr.state === "scanned" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "loading", style: { padding: 40 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "spinner" }),
            "\u626B\u7801\u6210\u529F\uFF0C\u6B63\u5728\u8DF3\u8F6C\u9A8C\u8BC1\u2026\uFF08\u9996\u6B21\u53EF\u80FD\u7B49\u5341\u51E0\u79D2\uFF09"
          ] }) : qr.state === "verifying" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "loading", style: { padding: 40 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "spinner" }),
            "\u6B63\u5728\u9A8C\u8BC1\u9A8C\u8BC1\u7801\uFF0C\u767B\u5F55\u4E2D\u2026"
          ] }) : qr.state === "success" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { fontSize: 48, padding: 40 }, children: "\u2705" }) : ["error", "expired"].includes(qr.state) ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { fontSize: 13, color: "var(--red)", padding: 30 }, children: [
            qr.message || "\u767B\u5F55\u5931\u8D25",
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
            "\u53EF\u5173\u95ED\u540E\u91CD\u8BD5\uFF08\u6216\u6362\u5E72\u51C0 IP\uFF09\u3002"
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "loading", style: { padding: 40 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "spinner" }),
            "\u51C6\u5907\u4E8C\u7EF4\u7801\u2026"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { marginTop: 16 }, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn", onClick: closeQr, children: qr.state === "success" ? "\u5B8C\u6210" : "\u5173\u95ED" }) })
        ]
      }
    ) }),
    cred && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "overlay", onClick: closeCred, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "modal", style: { width: 420, maxWidth: "100%" }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("h3", { style: { margin: "0 0 4px" }, children: [
        "\u914D\u7F6E ",
        cred.name
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }, children: [
        "\u516C\u4F17\u53F7\u7528\u5B98\u65B9\u63A5\u53E3\u53D1\u5E03\uFF0C\u9700\u586B\u5F00\u53D1\u8005\u51ED\u8BC1\uFF08\u516C\u4F17\u5E73\u53F0 \u2192 \u8BBE\u7F6E\u4E0E\u5F00\u53D1 \u2192 \u5F00\u53D1\u63A5\u53E3\u7BA1\u7406\uFF09\u3002",
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
        "\u26A0\uFE0F \u9700\u628A\u672C\u670D\u52A1\u5668\u51FA\u53E3 IP \u52A0\u5165\u516C\u4F17\u53F7\u300CIP \u767D\u540D\u5355\u300D\uFF0C\u5426\u5219\u62A5 40164\u3002\u6587\u7AE0\u53D1\u5230",
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { children: "\u8349\u7A3F\u7BB1" }),
        "\uFF0C\u7FA4\u53D1\u8BF7\u5230 mp \u540E\u53F0\u786E\u8BA4\u3002"
      ] }),
      credMsg && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { fontSize: 12.5, color: "var(--green)", marginBottom: 10 }, children: credMsg }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("label", { style: { fontSize: 12, color: "var(--text-secondary)" }, children: "AppID" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
        "input",
        {
          value: credForm.appId,
          autoFocus: true,
          onChange: (e) => setCredForm((f) => ({ ...f, appId: e.target.value.trim() })),
          placeholder: "wx...",
          style: {
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 12px",
            margin: "4px 0 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("label", { style: { fontSize: 12, color: "var(--text-secondary)" }, children: "AppSecret" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
        "input",
        {
          value: credForm.appSecret,
          type: "password",
          onChange: (e) => setCredForm((f) => ({ ...f, appSecret: e.target.value.trim() })),
          placeholder: "\u5F00\u53D1\u8005\u5BC6\u94A5\uFF08\u4E0D\u4F1A\u56DE\u663E\uFF09",
          style: {
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 12px",
            margin: "4px 0 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("label", { style: { fontSize: 12, color: "var(--text-secondary)" }, children: "\u9ED8\u8BA4\u4F5C\u8005\uFF08\u53EF\u9009\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
        "input",
        {
          value: credForm.author,
          onChange: (e) => setCredForm((f) => ({ ...f, author: e.target.value })),
          placeholder: "\u6587\u7AE0\u7F72\u540D",
          style: {
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 12px",
            margin: "4px 0 4px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14
          }
        }
      ),
      credErr && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { color: "var(--red)", fontSize: 12.5, marginTop: 8 }, children: credErr }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 16 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn btn-primary", style: { flex: 1 }, disabled: credBusy, onClick: submitCred, children: credBusy ? "\u9A8C\u8BC1\u4E2D\u2026" : "\u4FDD\u5B58\u5E76\u9A8C\u8BC1" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { className: "btn", onClick: closeCred, children: "\u5173\u95ED" })
      ] })
    ] }) })
  ] });
}

// src/features/accounts.tsx
var import_jsx_runtime18 = require("react/jsx-runtime");
var view8 = "accounts";
var order8 = 37;
var labels8 = { zh: "\u8D26\u53F7", en: "Accounts" };
var Icon8 = IconAccounts;
var Component8 = AccountsPage;
var plugin8 = {
  name: "easel-view-accounts",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view8),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Component8, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view8),
      order: order8,
      locale: "easel.panel",
      label: () => t(view8)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Icon8, { size });
    }));
  }
};

// src/features/profile.tsx
var profile_exports = {};
__export(profile_exports, {
  Component: () => Component9,
  Icon: () => Icon9,
  labels: () => labels9,
  order: () => order9,
  plugin: () => plugin9,
  view: () => view9
});

// src/components/PersonaBrowser.tsx
var import_react13 = require("react");

// src/components/ProfilePage.tsx
var import_react11 = require("react");
var import_jsx_runtime19 = require("react/jsx-runtime");
function fanTier(n) {
  if (n <= 0) return "\u65B0\u53F7 / 0";
  if (n < 500) return "\u51B7\u542F\u52A8 <500";
  if (n < 1e3) return "\u6570\u767E";
  if (n < 5e3) return "\u5343\u7EA7";
  if (n < 1e4) return "\u6570\u5343";
  if (n < 1e5) return "\u4E07\u7EA7";
  if (n < 1e6) return "\u5341\u4E07\u7EA7";
  return "\u767E\u4E07+";
}
var WX_START = "<!-- wechat-oa:auto:start -->";
var WX_END = "<!-- wechat-oa:auto:end -->";
function buildWechatBlock(a) {
  const fans = a.followers ?? 0;
  const posts = a.posts ?? 0;
  const reads = a.likes ?? 0;
  const tops = [...new Set(a.notes.map((n) => n.title).filter(Boolean))].slice(0, 3);
  const stamp = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { hour12: false });
  const lines = [
    `### \u5FAE\u4FE1\u516C\u4F17\u53F7\uFF08\u81EA\u52A8\u6293\u53D6 \xB7 ${stamp}\uFF09`,
    "",
    `- **\u7C89\u4E1D\u91CF\u7EA7**\uFF1A${fans}\uFF08${fanTier(fans)}\uFF09`,
    `- **\u5185\u5BB9\u5F62\u5F0F**\uFF1A\u56FE\u6587\u63A8\u6587\uFF08\u516C\u4F17\u53F7\u6587\u7AE0\uFF09\uFF1B\u5DF2\u53D1\u8868 ${posts} \u7BC7${reads ? `\uFF0C\u7D2F\u8BA1\u9605\u8BFB ${reads}` : ""}`
  ];
  if (a.metrics?.length) {
    lines.push(`- **\u540E\u53F0\u6570\u636E**\uFF1A${a.metrics.map((m2) => `${m2.label} ${m2.value}`).join(" \xB7 ")}`);
  }
  if (tops.length) lines.push(`- **\u4EE3\u8868\u5185\u5BB9**\uFF1A${tops.join("\uFF5C")}`);
  return lines.join("\n");
}
function mergeWechatBlock(existing, block) {
  const wrapped = `${WX_START}
${block}
${WX_END}`;
  const s = existing.indexOf(WX_START);
  const e = existing.indexOf(WX_END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + wrapped + existing.slice(e + WX_END.length);
  }
  const head = existing.replace(/\s+$/, "");
  return head ? `${head}

${wrapped}` : wrapped;
}
var DIM_META = {
  "identity.md": { label: "\u8EAB\u4EFD\u5B9A\u4F4D", icon: "\u{1FAAA}" },
  "style.md": { label: "\u5185\u5BB9\u98CE\u683C", icon: "\u{1F3A8}" },
  "audience.md": { label: "\u76EE\u6807\u53D7\u4F17", icon: "\u{1F465}" },
  "platforms.md": { label: "\u5E73\u53F0\u8FD0\u8425", icon: "\u{1F4F1}" },
  "preferences.md": { label: "\u504F\u597D\u4E0E\u7EA2\u7EBF", icon: "\u2696\uFE0F" },
  "memory.md": { label: "\u7ECF\u9A8C\u6C89\u6DC0", icon: "\u{1F9E0}" }
};
function ProfilePage({ persona, onNewProfile, onDeleted }) {
  const [files, setFiles] = (0, import_react11.useState)([]);
  const [drafts, setDrafts] = (0, import_react11.useState)({});
  const [editing, setEditing] = (0, import_react11.useState)(false);
  const [loading, setLoading] = (0, import_react11.useState)(false);
  const [error, setError] = (0, import_react11.useState)("");
  const [savingFile, setSavingFile] = (0, import_react11.useState)("");
  const [deleting, setDeleting] = (0, import_react11.useState)(false);
  const [toast, setToast] = (0, import_react11.useState)("");
  const [fetchingWx, setFetchingWx] = (0, import_react11.useState)(false);
  (0, import_react11.useEffect)(() => {
    if (!persona) {
      setFiles([]);
      return;
    }
    let ignore = false;
    setLoading(true);
    setError("");
    setEditing(false);
    fetchPersonaFiles(persona).then((d2) => {
      if (ignore) return;
      setFiles(d2.files);
      setDrafts(Object.fromEntries(d2.files.map((f) => [f.filename, f.content])));
    }).catch(() => {
      if (!ignore) setError("\u52A0\u8F7D\u753B\u50CF\u5931\u8D25");
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [persona]);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };
  const handleSave = async (filename) => {
    setSavingFile(filename);
    try {
      await savePersonaFile(persona, filename, drafts[filename] ?? "");
      setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, content: drafts[filename] ?? "" } : f));
      showToast(`\u5DF2\u4FDD\u5B58 ${DIM_META[filename]?.label || filename} \u2713`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "\u4FDD\u5B58\u5931\u8D25");
    } finally {
      setSavingFile("");
    }
  };
  const handleFetchWechat = async (filename) => {
    setFetchingWx(true);
    try {
      const a = await fetchAccountAnalytics("wechat-oa");
      if (!a.loggedIn) {
        showToast("\u516C\u4F17\u53F7\u540E\u53F0\u672A\u767B\u5F55\uFF1A\u8BF7\u5148\u5230\u300C\u8D26\u53F7\u300D\u9875\u626B\u7801\u767B\u5F55\u540E\u518D\u6293\u53D6");
        return;
      }
      const base = files.find((f) => f.filename === filename)?.content ?? "";
      const merged = mergeWechatBlock(base, buildWechatBlock(a));
      await savePersonaFile(persona, filename, merged);
      setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, content: merged } : f));
      setDrafts((p) => ({ ...p, [filename]: merged }));
      showToast(`\u5DF2\u6293\u53D6\u5E76\u66F4\u65B0\u753B\u50CF\uFF08\u7C89\u4E1D ${a.followers ?? 0}\uFF0C\u5DF2\u53D1\u8868 ${a.posts ?? 0} \u7BC7\uFF09\u2713`);
    } catch (e) {
      showToast(e instanceof Error ? `\u6293\u53D6\u5931\u8D25\uFF1A${e.message}` : "\u6293\u53D6\u5931\u8D25\uFF08\u53EF\u80FD\u672A\u767B\u5F55\u6216\u5E73\u53F0\u6539\u7248\uFF09");
    } finally {
      setFetchingWx(false);
    }
  };
  const handleDelete = async () => {
    if (!window.confirm(`\u786E\u5B9A\u5220\u9664\u753B\u50CF\u300C${persona}\u300D\u5417\uFF1F
\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\uFF0C\u5C06\u5220\u9664\u8BE5\u753B\u50CF\u7684\u5168\u90E8\u516D\u7EF4\u6587\u4EF6\u3002`)) return;
    setDeleting(true);
    try {
      await deletePersona(persona);
      onDeleted(persona);
      showToast(`\u5DF2\u5220\u9664\u753B\u50CF\u300C${persona}\u300D`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "\u5220\u9664\u5931\u8D25");
    } finally {
      setDeleting(false);
    }
  };
  if (!persona) {
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "profile-page", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("h1", { className: "page-title", children: "\u7528\u6237\u753B\u50CF Profile" }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "empty-state", style: { height: "70%" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "empty-icon", children: "\u{1F464}" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("h3", { children: "\u8FD8\u6CA1\u6709\u9009\u62E9\u753B\u50CF" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { children: "\u753B\u50CF\u6C89\u6DC0\u4F60\u7684\u5B9A\u4F4D\u3001\u98CE\u683C\u3001\u53D7\u4F17\u4E0E\u7EA2\u7EBF\uFF0C\u751F\u6210\u5185\u5BB9\u4F1A\u66F4\u8D34\u5408\u4F60\u7684\u4EBA\u8BBE\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { className: "btn btn-primary", onClick: onNewProfile, children: "+ \u65B0\u5EFA\u753B\u50CF" })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "profile-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "profile-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("h1", { className: "page-title", children: persona }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: "page-subtitle", children: "\u516D\u4E2A\u7EF4\u5EA6\u6784\u6210\u4E00\u4E2A\u5B8C\u6574\u4EBA\u8BBE\uFF0C\u53EF\u968F\u65F6\u7F16\u8F91\u4FDD\u5B58\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { className: `btn ${editing ? "btn-primary" : ""}`, onClick: () => setEditing((v2) => !v2), children: editing ? "\u5B8C\u6210\u7F16\u8F91" : "\u270F\uFE0F \u7F16\u8F91\u8D44\u6599" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "button",
          {
            className: "btn",
            style: { color: "var(--red)", borderColor: "var(--red)" },
            disabled: deleting,
            onClick: handleDelete,
            children: deleting ? "\u5220\u9664\u4E2D\u2026" : "\u{1F5D1} \u5220\u9664\u753B\u50CF"
          }
        )
      ] })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { color: "var(--red)", fontSize: 14, marginTop: 12 }, children: error }),
    loading ? /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "loading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "spinner" }),
      "\u52A0\u8F7D\u4E2D\u2026"
    ] }) : files.map((f) => {
      const meta = DIM_META[f.filename] || { label: f.filename, icon: "\u{1F4C4}" };
      const dirty = editing && (drafts[f.filename] ?? "") !== f.content;
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "profile-dim", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "profile-dim-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "profile-dim-title", children: [
            meta.icon,
            " ",
            meta.label
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
            f.filename === "platforms.md" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
              "button",
              {
                className: "btn btn-sm",
                disabled: fetchingWx,
                title: "\u7528\u5DF2\u767B\u5F55\u7684\u516C\u4F17\u53F7\u540E\u53F0\u4F1A\u8BDD\u6293\u53D6\u7C89\u4E1D/\u5185\u5BB9\u6570\u636E\uFF0C\u5199\u5165\u672C\u680F\uFF08\u4E0E\u6570\u636E\u4E2D\u5FC3\u540C\u6E90\uFF09",
                onClick: () => handleFetchWechat(f.filename),
                children: fetchingWx ? "\u6293\u53D6\u4E2D\u2026" : "\u{1F4CA} \u6293\u53D6\u516C\u4F17\u53F7\u6570\u636E"
              }
            ),
            editing && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
              "button",
              {
                className: "btn btn-sm btn-primary",
                disabled: !dirty || savingFile === f.filename,
                onClick: () => handleSave(f.filename),
                children: savingFile === f.filename ? "\u4FDD\u5B58\u4E2D\u2026" : dirty ? "\u4FDD\u5B58" : "\u5DF2\u4FDD\u5B58"
              }
            )
          ] })
        ] }),
        editing ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "textarea",
          {
            className: "field",
            style: { minHeight: 150, fontFamily: "'SF Mono','Consolas',monospace", fontSize: 13 },
            value: drafts[f.filename] ?? "",
            onChange: (e) => setDrafts((p) => ({ ...p, [f.filename]: e.target.value }))
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "card", style: { padding: "14px 18px" }, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "div",
          {
            className: "profile-content",
            dangerouslySetInnerHTML: { __html: renderMarkdown(f.content || "_\uFF08\u7A7A\uFF09_") }
          }
        ) })
      ] }, f.filename);
    }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "toast ok", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "toast-icon", children: "\u2713" }),
      toast
    ] })
  ] });
}

// src/components/OnboardingWizard.tsx
var import_react12 = require("react");
var import_jsx_runtime20 = require("react/jsx-runtime");
var PLATFORMS3 = ["\u5C0F\u7EA2\u4E66", "\u6296\u97F3", "B\u7AD9", "\u89C6\u9891\u53F7", "\u516C\u4F17\u53F7", "\u5FAE\u535A", "\u77E5\u4E4E"];
var TONES = ["\u4E13\u4E1A\u4E25\u8C28", "\u8F7B\u677E\u5E7D\u9ED8", "\u4EB2\u5207\u65E5\u5E38", "\u7280\u5229\u5410\u69FD", "\u6CBB\u6108\u6E29\u6696", "\u5E72\u8D27\u5B9E\u7528"];
var EMPTY3 = {
  name: "",
  platforms: [],
  accountStage: "\u5168\u65B0\u8D77\u53F7",
  links: {},
  direction: "",
  reason: "",
  goal: "",
  formats: "",
  likes: "",
  tone: "",
  avoid: ""
};
var STEPS = ["\u57FA\u7840\u4FE1\u606F", "\u793E\u5A92\u94FE\u63A5", "\u8FD0\u8425\u610F\u56FE", "\u504F\u597D\u4E0E\u7EA2\u7EBF"];
function OnboardingWizard({ onClose, onCreated }) {
  const [step, setStep] = (0, import_react12.useState)(0);
  const [form, setForm] = (0, import_react12.useState)(EMPTY3);
  const [submitting, setSubmitting] = (0, import_react12.useState)(false);
  const [phase, setPhase] = (0, import_react12.useState)("form");
  const [error, setError] = (0, import_react12.useState)("");
  const taskRef = (0, import_react12.useRef)(null);
  const set = (k2, v2) => setForm((f) => ({ ...f, [k2]: v2 }));
  const togglePlatform = (p) => setForm((f) => ({
    ...f,
    platforms: f.platforms.includes(p) ? f.platforms.filter((x2) => x2 !== p) : [...f.platforms, p]
  }));
  const canNext = step === 0 && form.name.trim() !== "" || step === 2 && form.direction.trim() !== "" || step === 1 || step === 3;
  const formToInstruction = (name, f) => {
    const linksTxt = Object.entries(f.links).filter(([, u]) => u).map(([p, u]) => `  - ${p}: ${u}`).join("\n") || "  \uFF08\u672A\u63D0\u4F9B\uFF09";
    return `\u753B\u50CF\u540D\uFF1A${name}
\u8FD0\u8425\u5E73\u53F0\uFF1A${f.platforms.join("\u3001") || "\uFF08\u672A\u586B\uFF09"}
\u8D77\u53F7\u72B6\u6001\uFF1A${f.accountStage || "\uFF08\u672A\u586B\uFF09"}
\u793E\u5A92\u4E3B\u9875\u94FE\u63A5\uFF1A
${linksTxt}
\u60F3\u505A\u7684\u65B9\u5411\uFF1A${f.direction || "\uFF08\u672A\u586B\uFF09"}
\u4E3A\u4EC0\u4E48\u505A/\u6211\u7684\u4F18\u52BF\uFF1A${f.reason || "\uFF08\u672A\u586B\uFF09"}
\u8FD0\u8425\u76EE\u6807\uFF1A${f.goal || "\uFF08\u672A\u586B\uFF09"}
\u60F3\u4EA7\u51FA\u7684\u5F62\u5F0F\uFF1A${f.formats || "\uFF08\u672A\u586B\uFF09"}
\u559C\u6B22\u770B\u7684\u5185\u5BB9/\u5BF9\u6807\u8D26\u53F7\uFF1A${f.likes || "\uFF08\u672A\u586B\uFF09"}
\u671F\u671B\u8C03\u6027\uFF1A${f.tone || "\uFF08\u672A\u586B\uFF09"}
\u4E0D\u505A\u7684\u5185\u5BB9/\u7EA2\u7EBF\uFF1A${f.avoid || "\uFF08\u672A\u586B\uFF09"}
`;
  };
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await buildProfile(form.name.trim(), form);
      if (res.created) {
        setSubmitting(false);
        setPhase("enhancing");
        const name = form.name.trim();
        const prompt = `\u8BF7\u6267\u884C\u6280\u80FD skill-profile-builder\uFF0C\u5B8C\u5584\u5DF2\u5B58\u5728\u7684\u753B\u50CF\u300C${name}\u300D\u3002\u7528\u6237\u5DF2\u901A\u8FC7\u8868\u5355\u63D0\u4F9B\u4EE5\u4E0B\u4FE1\u606F\uFF0C\u57FA\u7EBF\u516D\u7EF4\u6587\u4EF6\u5DF2\u5199\u597D\uFF08profiles/${name}/\uFF09\u3002\u8BF7\uFF1A\u2460\u5C3D\u529B\u6293\u53D6\u7528\u6237\u7ED9\u7684\u793E\u5A92\u94FE\u63A5\u5206\u6790\u5DF2\u53D1\u5185\u5BB9/\u98CE\u683C/\u53D7\u4F17\uFF08\u6293\u4E0D\u5230\u5C31\u964D\u7EA7\uFF0C\u6807\u6CE8[\u5F85\u8865\u5145]\uFF0C\u52FF\u81C6\u9020\uFF09\u2461\u636E\u5206\u6790\u7ED3\u679C\u6DA6\u8272/\u8865\u5168\u5404\u7EF4\u5EA6\u6587\u4EF6 \u2462\u7ED9\u51FA\u4E00\u53E5\u8BDD\u5B8C\u6210\u5EA6\u6458\u8981\u3002\u8868\u5355\u4FE1\u606F\u5982\u4E0B\uFF1A

${formToInstruction(name, form)}`;
        const handle = await pushTask(prompt);
        taskRef.current = handle;
        await handle.settled;
        onCreated(name);
      } else {
        setError("\u753B\u50CF\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
        setSubmitting(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "\u521B\u5EFA\u5931\u8D25");
      setSubmitting(false);
    }
  };
  const box2 = {
    width: "100%",
    padding: "10px 12px",
    marginTop: 6,
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-elev)",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit"
  };
  const label2 = { display: "block", marginTop: 16, fontSize: 13, color: "var(--text-secondary)" };
  const chip = (active) => ({
    padding: "6px 13px",
    borderRadius: 999,
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: active ? "var(--accent-gradient)" : "var(--bg-elev)",
    color: active ? "#fff" : "var(--text)"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "overlay", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "modal", style: { width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("h2", { style: { margin: 0, fontSize: 20 }, children: "\u914D\u7F6E\u8D26\u53F7\u753B\u50CF" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        "button",
        {
          onClick: onClose,
          disabled: submitting,
          style: { background: "none", border: "none", color: "var(--text-secondary)", fontSize: 22, cursor: "pointer" },
          children: "\xD7"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { display: "flex", gap: 6, margin: "16px 0 4px" }, children: STEPS.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { flex: 1 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { height: 4, borderRadius: 2, background: i <= step ? "var(--accent-start)" : "var(--border)" } }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { fontSize: 11, color: i === step ? "var(--text)" : "var(--text-secondary)", marginTop: 4 }, children: s })
    ] }, s)) }),
    submitting ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { padding: "48px 0", textAlign: "center", color: "var(--text-secondary)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "spinner", style: { margin: "0 auto 16px" } }),
      "\u6B63\u5728\u521B\u5EFA\u753B\u50CF\u57FA\u7EBF\u2026"
    ] }) : phase === "enhancing" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { padding: "40px 0", textAlign: "center", color: "var(--text-secondary)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "spinner", style: { margin: "0 auto 16px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { color: "var(--text)", fontSize: 15, marginBottom: 6 }, children: "\u753B\u50CF\u5DF2\u521B\u5EFA \u2713\u3000AI \u6B63\u5728\u5BF9\u8BDD\u91CC\u589E\u5F3A\u2026" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("span", { style: { fontSize: 12 }, children: [
        "\u589E\u5F3A\u8FC7\u7A0B\u5728 dsh \u5BF9\u8BDD\u91CC\u8FDB\u884C\uFF08\u53EF\u65C1\u89C2\u3001\u53EF\u8FFD\u95EE\uFF09\uFF0C\u5B8C\u6210\u540E\u8FD9\u91CC\u4F1A\u81EA\u52A8\u8FDB\u5165\u753B\u50CF\u3002",
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("br", {}),
        "\u4E5F\u53EF\u4EE5\u73B0\u5728\u5C31\u8FDB\u53BB\u7528\uFF0C\u589E\u5F3A\u4F1A\u5728\u540E\u53F0\u7EE7\u7EED\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { marginTop: 20 }, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { className: "btn btn-primary", onClick: () => onCreated(form.name.trim()), children: "\u5148\u8FDB\u53BB\u7528" }) })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { minHeight: 240 }, children: [
      step === 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u753B\u50CF\u540D *\uFF08\u4E00\u4E2A\u4EBA\u8BBE = \u4E00\u4E2A\u753B\u50CF\uFF0C\u53EF\u8DE8\u591A\u5E73\u53F0\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "input",
          {
            style: box2,
            value: form.name,
            placeholder: "\u5982\uFF1A\u79D1\u6280\u6570\u7801\u8FBE\u4EBA",
            onChange: (e) => set("name", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u8FD0\u8425\u5E73\u53F0\uFF08\u53EF\u591A\u9009\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }, children: PLATFORMS3.map((p) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { onClick: () => togglePlatform(p), style: chip(form.platforms.includes(p)), children: p }, p)) }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u8D77\u53F7\u72B6\u6001" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { display: "flex", gap: 8, marginTop: 6 }, children: ["\u5168\u65B0\u8D77\u53F7", "\u5DF2\u6709\u8D26\u53F7"].map((s) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { onClick: () => set("accountStage", s), style: chip(form.accountStage === s), children: s }, s)) })
      ] }),
      step === 1 && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { style: { fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }, children: "\u8D34\u4E0A\u5404\u5E73\u53F0\u4E3B\u9875\u94FE\u63A5\uFF0CAI \u4F1A\u5C3D\u529B\u5206\u6790\u4F60\u5DF2\u53D1\u7684\u5185\u5BB9\u548C\u98CE\u683C\uFF08\u6293\u4E0D\u5230\u4F1A\u8DF3\u8FC7\uFF0C\u53EF\u7559\u7A7A\uFF09\u3002" }),
        form.platforms.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { style: { fontSize: 13, color: "var(--text-secondary)" }, children: "\uFF08\u672A\u9009\u5E73\u53F0\uFF0C\u53EF\u76F4\u63A5\u4E0B\u4E00\u6B65\uFF09" }),
        form.platforms.map((p) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("label", { style: label2, children: [
            p,
            " \u4E3B\u9875\u94FE\u63A5"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            "input",
            {
              style: box2,
              value: form.links[p] || "",
              placeholder: `https://\u2026`,
              onChange: (e) => set("links", { ...form.links, [p]: e.target.value })
            }
          )
        ] }, p))
      ] }),
      step === 2 && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u60F3\u505A\u4EC0\u4E48\u65B9\u5411\u7684\u5185\u5BB9 *\uFF08\u8D8A\u5177\u4F53\u8D8A\u597D\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "input",
          {
            style: box2,
            value: form.direction,
            placeholder: "\u5982\uFF1A\u5E73\u4EF7\u62A4\u80A4\u6D4B\u8BC4",
            onChange: (e) => set("direction", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u4E3A\u4EC0\u4E48\u505A\u8FD9\u4E2A / \u4F60\u7684\u4F18\u52BF\xB7\u72EC\u7279\u7ECF\u5386" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "textarea",
          {
            style: { ...box2, minHeight: 60, resize: "vertical" },
            value: form.reason,
            onChange: (e) => set("reason", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u8FD0\u8425\u76EE\u6807" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "input",
          {
            style: box2,
            value: form.goal,
            placeholder: "\u6DA8\u7C89 / \u53D8\u73B0 / \u4E2A\u4EBA\u54C1\u724C / \u5F15\u6D41\u79C1\u57DF",
            onChange: (e) => set("goal", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u60F3\u4EA7\u51FA\u7684\u5F62\u5F0F" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "input",
          {
            style: box2,
            value: form.formats,
            placeholder: "\u56FE\u6587 / \u77ED\u89C6\u9891 / \u4E2D\u957F\u89C6\u9891 / \u957F\u6587",
            onChange: (e) => set("formats", e.target.value)
          }
        )
      ] }),
      step === 3 && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u559C\u6B22\u770B\u7684\u5185\u5BB9 / \u5BF9\u6807\u8D26\u53F7" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "textarea",
          {
            style: { ...box2, minHeight: 60, resize: "vertical" },
            value: form.likes,
            onChange: (e) => set("likes", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u671F\u671B\u8C03\u6027" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }, children: TONES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { onClick: () => set("tone", form.tone === t ? "" : t), style: chip(form.tone === t), children: t }, t)) }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("label", { style: label2, children: "\u4E0D\u505A\u7684\u5185\u5BB9 / \u5408\u89C4\u7EA2\u7EBF" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "textarea",
          {
            style: { ...box2, minHeight: 60, resize: "vertical" },
            value: form.avoid,
            placeholder: "\u5982\uFF1A\u4E0D\u63A5\u533B\u7597\u529F\u6548\u3001\u4E0D\u505A\u865A\u5047\u5BA3\u4F20",
            onChange: (e) => set("avoid", e.target.value)
          }
        )
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { color: "var(--red)", fontSize: 13, marginTop: 12 }, children: error })
    ] }),
    phase === "form" && !submitting && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 20 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { className: "btn", onClick: () => step === 0 ? onClose() : setStep(step - 1), children: step === 0 ? "\u53D6\u6D88" : "\u4E0A\u4E00\u6B65" }),
      step < STEPS.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { className: "btn btn-primary", onClick: () => canNext && setStep(step + 1), disabled: !canNext, children: "\u4E0B\u4E00\u6B65" }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { className: "btn btn-primary", onClick: submit, disabled: !form.name.trim() || !form.direction.trim(), children: "\u751F\u6210\u753B\u50CF" })
    ] })
  ] }) });
}

// src/components/PersonaBrowser.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
function PersonaBrowser({ persona, personas, onPersonaChange, onDeleted, onRefresh }) {
  const [wizardOpen, setWizardOpen] = (0, import_react13.useState)(false);
  (0, import_react13.useEffect)(() => {
    onRefresh?.();
  }, [onRefresh]);
  const handleDeleted = (name) => {
    onDeleted();
    if (name === persona) onPersonaChange("");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "persona-browser", children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("aside", { className: "persona-list", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "persona-list-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "persona-list-title", children: "\u8D26\u53F7\u753B\u50CF" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: { display: "flex", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("button", { className: "btn btn-sm", title: "\u91CD\u65B0\u8BFB\u53D6\u753B\u50CF\u76EE\u5F55\uFF08agent \u4F1A\u8BDD\u53EF\u80FD\u5EFA\u8FC7/\u6539\u540D\uFF09", onClick: () => onRefresh?.(), children: "\u27F3" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("button", { className: "btn btn-sm", onClick: () => setWizardOpen(true), children: "+ \u65B0\u5EFA\u753B\u50CF" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "persona-groups", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
          "button",
          {
            className: `persona-row ${persona === "" ? "active" : ""}`,
            onClick: () => onPersonaChange(""),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "persona-row-name", children: "\u901A\u7528\u6A21\u5F0F" }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "persona-row-desc", children: "\u4E0D\u6307\u5B9A\u753B\u50CF\uFF0C\u5404\u9875\u9762\u6309\u901A\u7528\u65B9\u5F0F\u751F\u6210" })
            ]
          }
        ),
        personas.map((p) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
          "button",
          {
            className: `persona-row ${persona === p.name ? "active" : ""}`,
            onClick: () => onPersonaChange(p.name),
            title: p.description,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "persona-row-name", children: p.name }),
              p.description && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "persona-row-desc", children: p.description })
            ]
          },
          p.name
        )),
        personas.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "persona-row persona-row-static", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "persona-row-desc", children: "\u8FD8\u6CA1\u6709\u8D26\u53F7\u753B\u50CF\u2014\u2014\u70B9\u53F3\u4E0A\u300C+ \u65B0\u5EFA\u753B\u50CF\u300D\u521B\u5EFA\u7B2C\u4E00\u4E2A\u3002" }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "persona-detail", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      ProfilePage,
      {
        persona,
        onNewProfile: () => setWizardOpen(true),
        onDeleted: handleDeleted
      }
    ) }),
    wizardOpen && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      OnboardingWizard,
      {
        onClose: () => setWizardOpen(false),
        onCreated: (name) => {
          setWizardOpen(false);
          onDeleted();
          onPersonaChange(name);
        }
      }
    )
  ] });
}

// src/features/profile.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
var view9 = "profile";
var order9 = 38;
var labels9 = { zh: "\u753B\u50CF", en: "Profile" };
var Icon9 = IconProfile;
var Component9 = PersonaBrowser;
var plugin9 = {
  name: "easel-view-profile",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view9),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Component9, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view9),
      order: order9,
      locale: "easel.panel",
      label: () => t(view9)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Icon9, { size });
    }));
  }
};

// src/features/breakdown.tsx
var breakdown_exports = {};
__export(breakdown_exports, {
  Component: () => Component10,
  Icon: () => Icon10,
  labels: () => labels10,
  order: () => order10,
  plugin: () => plugin10,
  view: () => view10
});

// src/components/BreakdownPage.tsx
var import_react14 = require("react");
var import_jsx_runtime23 = require("react/jsx-runtime");
var FETCH_STAGES = [
  { key: "fetch", label: "\u4E0B\u8F7D\u89C6\u9891" },
  { key: "frames", label: "\u62BD\u53D6\u753B\u9762" },
  { key: "asr", label: "\u8BED\u97F3\u8F6C\u5199" }
];
var PLATFORM_NAMES = {
  douyin: "\u6296\u97F3",
  xhs: "\u5C0F\u7EA2\u4E66",
  bili: "B\u7AD9",
  youtube: "YouTube",
  other: "\u901A\u7528\u94FE\u63A5"
};
function stageIndex(stage) {
  const i = FETCH_STAGES.findIndex((item) => item.key === stage);
  return i < 0 ? FETCH_STAGES.length : i;
}
function flattenCatalog(payload) {
  if (!payload) return [];
  return payload.groups.flatMap(
    (group) => group.models.map((model) => ({ provider: group.id, providerName: group.name, model }))
  );
}
function BreakdownPage({ persona, onNavigate, remote }) {
  const [input, setInput] = (0, import_react14.useState)("");
  const [catalog, setCatalog] = (0, import_react14.useState)(null);
  const [catalogError, setCatalogError] = (0, import_react14.useState)("");
  const [asrModel, setAsrModel] = (0, import_react14.useState)("");
  const [visionModel, setVisionModel] = (0, import_react14.useState)("");
  const [preflight, setPreflight] = (0, import_react14.useState)(null);
  const [gateChecking, setGateChecking] = (0, import_react14.useState)(false);
  const [job, setJob] = (0, import_react14.useState)(null);
  const [capturing, setCapturing] = (0, import_react14.useState)(false);
  const [analyzeState, setAnalyzeState] = (0, import_react14.useState)("idle");
  const [report, setReport] = (0, import_react14.useState)("");
  const abortRef = (0, import_react14.useRef)(null);
  (0, import_react14.useEffect)(() => () => {
    abortRef.current?.();
  }, []);
  (0, import_react14.useEffect)(() => {
    let alive = true;
    void (async () => {
      try {
        const read = remote?.session?.modelCatalog;
        const response = read ? await read.call(remote.session) : await Promise.reject(new Error("\u6A21\u578B\u76EE\u5F55\u901A\u9053\u4E0D\u53EF\u7528"));
        if (!alive) return;
        if (!response.ok || !response.value) throw new Error(response.error?.message ?? "\u6A21\u578B\u76EE\u5F55\u8BFB\u53D6\u5931\u8D25");
        setCatalog(response.value);
        const models2 = flattenCatalog(response.value);
        const asr = models2.find((entry) => /asr/i.test(entry.model.id) || /asr/i.test(entry.model.name));
        if (asr) setAsrModel(`${asr.provider}::${asr.model.id}`);
      } catch (error) {
        if (alive) setCatalogError(String(error.message ?? error));
      }
    })();
    return () => {
      alive = false;
    };
  }, [remote]);
  const poll = (0, import_react14.useCallback)(async (id) => {
    for (; ; ) {
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const res = await fetch(`/easel/api/deconstruct/${id}`, { headers: { accept: "application/json" } }).catch(() => null);
      if (!res?.ok) continue;
      const data = await res.json();
      setJob(data);
      if (data.stage === "ready" || data.stage === "failed") return;
    }
  }, []);
  const checkGate = (0, import_react14.useCallback)(async () => {
    const url = input.trim();
    if (!url) return null;
    const res = await fetch("/easel/api/deconstruct/preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    }).catch(() => null);
    if (!res?.ok) return null;
    return await res.json();
  }, [input]);
  const startCapture = async () => {
    const url = input.trim();
    if (!url || capturing) return;
    setCapturing(true);
    setPreflight(null);
    try {
      const gate = await checkGate();
      if (gate === null) {
        setPreflight({ platform: "other", blocked: true, row: null });
        return;
      }
      if (gate.blocked) {
        setPreflight(gate);
        return;
      }
      setJob(null);
      setReport("");
      setAnalyzeState("idle");
      const res = await fetch("/easel/api/deconstruct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, asrModel: asrModel.split("::")[1] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "\u91C7\u96C6\u4EFB\u52A1\u521B\u5EFA\u5931\u8D25");
      setJob(data);
      void poll(data.id);
    } catch (error) {
      setJob({ id: "", url, stage: "failed", error: String(error.message ?? error) });
    } finally {
      setCapturing(false);
    }
  };
  const startAnalyze = async () => {
    if (!job || analyzeState === "running") return;
    setAnalyzeState("running");
    setReport("");
    const firstLine = job.url.split("\n")[0].slice(0, 24);
    const ideaTitle = job.title ?? `\u62C6\u89E3\u6A21\u677F\uFF1A${firstLine}`;
    const assets = [
      job.video ? `- \u89C6\u9891\u6587\u4EF6\uFF1A${job.video}` : "",
      job.framesDir ? `- \u62BD\u5E27\u76EE\u5F55\uFF1A${job.framesDir}\uFF08\u5171 ${job.frames ?? 0} \u5F20 f-*.jpg\uFF0C\u7528 Read \u9010\u5F20\u770B\u5173\u952E\u5E27\uFF09` : "",
      job.srt ? `- \u5B57\u5E55\u6587\u4EF6\uFF1A${job.srt}\uFF08\u53E3\u64AD\u5168\u6587\uFF0C\u5FC5\u8BFB\uFF09` : "",
      job.framesError ? `- \u6CE8\u610F\uFF1A\u62BD\u5E27\u5931\u8D25\uFF08${job.framesError}\uFF09\uFF0C\u672C\u6B21\u53EA\u9760\u5B57\u5E55\u62C6\u89E3` : ""
    ].filter(Boolean).join("\n");
    const prompt = `\u4F60\u662F\u7206\u6B3E\u5185\u5BB9\u62C6\u89E3\u4E13\u5BB6\u3002\u7D20\u6750\u5DF2\u7531\u6D41\u6C34\u7EBF\u91C7\u96C6\u5B8C\u6210\uFF0C\u76F4\u63A5\u57FA\u4E8E\u4EE5\u4E0B\u7D20\u6750\u505A\u62C6\u89E3${visionModel ? `\uFF08\u672C\u4F1A\u8BDD\u5DF2\u5207\u5230\u89C6\u89C9\u6A21\u578B ${visionModel.split("::")[1]}\uFF0C\u52A1\u5FC5 Read \u770B\u5E27\u5F15\u7528\u753B\u9762\u8BC1\u636E\uFF09` : ""}\uFF1A
${assets}

\u7528\u4E2D\u6587\u5206\u70B9\u8F93\u51FA\uFF1A
1. **\u4E00\u53E5\u8BDD\u6982\u62EC**
2. **\u94A9\u5B50\u62C6\u89E3**\uFF1A\u5F00\u5934\u4E3A\u4EC0\u4E48\u6293\u4EBA\uFF08\u524D 3 \u79D2\u753B\u9762 + \u53E3\u64AD\u5982\u4F55\u914D\u5408\uFF0C\u987B\u5F15\u7528\u753B\u9762/\u5B57\u5E55\u8BC1\u636E\uFF09
3. **\u7ED3\u6784\u5957\u8DEF**\uFF1A\u5206\u6BB5/\u8282\u594F/\u4FE1\u606F\u7F16\u6392
4. **\u4E3A\u4EC0\u4E48\u4F1A\u706B**\uFF1A\u60C5\u7EEA/\u5171\u9E23/\u5B9E\u7528/\u4E89\u8BAE\u70B9
5. **\u53EF\u590D\u5236\u6A21\u677F**\uFF1A\u628A\u5957\u8DEF\u62BD\u8C61\u6210\u80FD\u76F4\u63A5\u5957\u7528\u7684\u7ED3\u6784\u6846\u67B6
6. **\u501F\u8FD9\u4E2A\u5957\u8DEF${persona ? `\u3001\u7ED3\u5408\u6211\u7684\u753B\u50CF\u300C${persona}\u300D` : ""}\u53EF\u505A\u7684 3 \u4E2A\u9009\u9898**

\u3010\u5B8C\u6210\u540E\u5FC5\u987B\u6267\u884C\u3011
a) \u628A\u4E0A\u9762 1-6 \u70B9\u7684\u5B8C\u6574 Markdown \u62A5\u544A\u5199\u5165 outputs/_deconstruct/${job.id}/report.md\uFF1B
b) \u8BFB\u53D6 outputs/_ideas.json\uFF08\u4E0D\u5B58\u5728\u5F53 []\uFF09\uFF0C\u5728\u6700\u524D\u63D2\u5165\u4E00\u6761\uFF1A
{"id":"<12\u4F4D\u968F\u673Ahex>","title":${JSON.stringify(ideaTitle)},"note":"<\u5B8C\u6574\u62A5\u544AMarkdown>","source":"\u7206\u6B3E\u62C6\u89E3","status":"pending","deconstruct":"${job.id}","created":<\u5F53\u524Dunix\u79D2>}\uFF0C
\u4FDD\u5B58\u4E3A\u5408\u6CD5 JSON\uFF08UTF-8\u3001\u7F29\u8FDB 2\u3001\u6CE8\u610F Markdown \u8F6C\u4E49\uFF09\u3002title \u5DF2\u662F\u5408\u6CD5 JSON \u5B57\u9762\u91CF\uFF0C\u539F\u6837\u4FDD\u7559\uFF1Bdeconstruct \u5B57\u6BB5\u662F\u62C6\u89E3\u6279\u6B21\u53F7\uFF0C\u7ACB\u9879\u65F6\u51ED\u5B83\u628A\u7D20\u6750\u88C5\u914D\u8FDB\u9879\u76EE\u5DE5\u4F5C\u533A\uFF0C\u5FC5\u987B\u539F\u6837\u4FDD\u7559\u3002`;
    try {
      const handle = await pushTask(prompt, {
        model: visionModel ? (() => {
          const [provider, model] = visionModel.split("::");
          return { provider, model };
        })() : void 0
      });
      abortRef.current = handle.abort;
      const verdict = await handle.settled;
      if (verdict !== "done") {
        setAnalyzeState("error");
        return;
      }
      const content = await fetchOutputContent(`outputs/_deconstruct/${job.id}/report.md`).then((data) => data.isBinary ? "" : data.content).catch(() => "");
      setReport(content);
      setAnalyzeState(content ? "done" : "error");
    } catch {
      setAnalyzeState("error");
    }
  };
  const captureFailed = job?.stage === "failed";
  const captureReady = job?.stage === "ready";
  const currentStage = job ? stageIndex(job.stage) : -1;
  const models = flattenCatalog(catalog);
  const anyModalitiesDeclared = models.some((entry) => entry.model.inputModalities !== void 0);
  const visionModels = models.filter((entry) => !anyModalitiesDeclared || (entry.model.inputModalities?.includes("image") ?? false));
  const gatePlatform = preflight ? PLATFORM_NAMES[preflight.platform] ?? preflight.platform : "";
  const modelSelect = (value, onChange, allowEmpty, emptyLabel, list, disabled) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
    "select",
    {
      className: "field",
      style: { marginLeft: 6, width: 250, padding: "5px 8px" },
      value,
      disabled,
      onChange: (e) => onChange(e.target.value),
      children: [
        allowEmpty && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("option", { value: "", children: emptyLabel }),
        !allowEmpty && models.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("option", { value: "", children: "\uFF08\u65E0\u53EF\u7528\u6A21\u578B\uFF09" }),
        catalog?.groups.map((group) => {
          const groupModels = list.filter((entry) => entry.provider === group.id);
          if (groupModels.length === 0) return null;
          return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("optgroup", { label: group.name, children: groupModels.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("option", { value: `${group.id}::${entry.model.id}`, children: entry.model.name }, `${group.id}::${entry.model.id}`)) }, group.id);
        })
      ]
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "page-scroll breakdown-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "page-head", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("h1", { className: "page-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconFire, { size: 21 }),
        " \u7206\u6B3E\u62C6\u89E3"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: "page-subtitle", children: "\u8D34\u4E00\u6761\u89C6\u9891\u94FE\u63A5\uFF08\u6296\u97F3/\u5C0F\u7EA2\u4E66/B\u7AD9/\u2026\uFF09\uFF0C\u6D41\u6C34\u7EBF\u81EA\u52A8\u4E0B\u8F7D\u3001\u62BD\u5E27\u3001\u8F6C\u5199\u5B57\u5E55\uFF0C\u518D\u7531 AI \u7ED3\u5408\u753B\u9762\u4E0E\u53E3\u64AD\u62C6\u51FA\u94A9\u5B50\u3001\u7ED3\u6784\u3001\u706B\u7684\u539F\u56E0\u4E0E\u53EF\u590D\u5236\u6A21\u677F\uFF0C\u62A5\u544A\u5B58\u6863\u5E76\u81EA\u52A8\u5165\u5E93\u9009\u9898\u5E93\u3002" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "breakdown-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        "textarea",
        {
          className: "field",
          style: { minHeight: 72 },
          value: input,
          placeholder: "\u628A\u89C6\u9891\u94FE\u63A5\u8D34\u8FDB\u6765\uFF0C\u4F8B\u5982 https://v.douyin.com/\u2026",
          disabled: capturing || captureReady && analyzeState !== "idle",
          onChange: (e) => setInput(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("label", { style: { fontSize: 12.5, color: "var(--text-secondary)" }, children: [
          "ASR \u6A21\u578B",
          modelSelect(asrModel, setAsrModel, false, "", models, capturing)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("label", { style: { fontSize: 12.5, color: "var(--text-secondary)" }, children: [
          "\u89C6\u89C9\u6A21\u578B",
          modelSelect(visionModel, setVisionModel, true, "\u8DDF\u968F\u4F1A\u8BDD\u5F53\u524D\u6A21\u578B", visionModels, capturing)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
          "button",
          {
            className: "btn btn-primary",
            style: { marginLeft: "auto" },
            disabled: capturing || !input.trim() || captureReady && analyzeState !== "idle",
            onClick: startCapture,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconSkills, { size: 15 }),
              " ",
              capturing ? "\u68C0\u67E5\u4E2D\u2026" : "\u2460 \u5F00\u59CB\u91C7\u96C6"
            ]
          }
        )
      ] }),
      catalogError && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("p", { style: { fontSize: 12.5, color: "var(--amber, #d97706)", margin: "8px 0 0" }, children: [
        "\u6A21\u578B\u76EE\u5F55\u8BFB\u53D6\u5931\u8D25\uFF08",
        catalogError,
        "\uFF09\u3002\u8BF7\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u300D\u786E\u8BA4\u6A21\u578B\u914D\u7F6E\u540E\u5237\u65B0\u672C\u9875\uFF1B \u91C7\u96C6\u4E0E\u62C6\u89E3\u9700\u8981\u53EF\u7528\u6A21\u578B\u3002"
      ] }),
      !anyModalitiesDeclared && models.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { style: { fontSize: 12.5, color: "var(--text-secondary)", margin: "8px 0 0" }, children: "\u6A21\u578B\u672A\u6807\u6CE8\u89C6\u89C9\u80FD\u529B\uFF1A\u8BF7\u81EA\u884C\u786E\u8BA4\u6240\u9009\u89C6\u89C9\u6A21\u578B\u652F\u6301\u56FE\u50CF\u8F93\u5165\uFF0C\u5426\u5219\u770B\u5E27\u62C6\u89E3\u4F1A\u9000\u5316\u3002" }),
      preflight?.blocked && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "panel", style: { marginTop: 16, borderColor: "var(--amber, #d97706)" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "panel-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconFire, { size: 14 }),
          " ",
          gatePlatform,
          "\u8FD8\u6CA1\u51C6\u5907\u597D"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("p", { style: { fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 10px" }, children: [
          gatePlatform,
          "\u6293\u53D6\u9700\u8981\u767B\u5F55\u6001\uFF1A\u8FD8\u6CA1\u6709\u53EF\u7528\u7684 cookie\uFF0C\u4E5F\u6CA1\u6709\u626B\u7801\u767B\u5F55\u3002\u5148\u628A\u8FD9\u4E00\u6B65\u8865\u4E0A\uFF0C \u62C6\u89E3\u5DE5\u4F5C\u6D41\u624D\u80FD\u542F\u52A8\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { className: "btn btn-sm", onClick: () => onNavigate?.("accounts"), children: "\u53BB\u8D26\u53F7\u9875\uFF08\u586B cookie / \u626B\u7801\u767B\u5F55\uFF09" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { className: "btn btn-ghost", onClick: () => onNavigate?.("chat"), children: "\u8BA9 Agent \u5728\u5BF9\u8BDD\u91CC\u767B\u5F55" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { style: { fontSize: 12, color: "var(--text-tertiary, #9ca3af)", margin: "10px 0 0" }, children: "\u5B8C\u6210\u4EFB\u610F\u4E00\u79CD\u540E\u56DE\u5230\u672C\u9875\u91CD\u65B0\u70B9\u300C\u5F00\u59CB\u91C7\u96C6\u300D\u5373\u53EF\uFF1B\u6296\u97F3\u65E0\u9700\u767B\u5F55\u3002" })
      ] }),
      job !== null && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "panel", style: { marginTop: 16 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "panel-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconFire, { size: 14 }),
          " \u91C7\u96C6\u6D41\u6C34\u7EBF"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }, children: [
          FETCH_STAGES.map((stage, i) => {
            const done = captureReady || currentStage > i && !captureFailed;
            const active = job.stage === stage.key;
            const color = done ? "var(--green, #16a34a)" : active ? "var(--amber, #d97706)" : captureFailed && currentStage === i ? "var(--red)" : "var(--text-tertiary, #9ca3af)";
            return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { style: { fontSize: 13, color }, children: [
              done ? "\u2713" : active ? "\u25D0" : captureFailed && currentStage === i ? "\u2715" : "\u25CB",
              " ",
              stage.label
            ] }, stage.key);
          }),
          captureReady && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { style: { fontSize: 13, color: "var(--green, #16a34a)" }, children: "\u2713 \u91C7\u96C6\u5B8C\u6210" }),
          captureFailed && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { style: { fontSize: 13, color: "var(--red)" }, children: "\u2715 \u91C7\u96C6\u5931\u8D25" }),
          (capturing || !captureReady && !captureFailed) && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "loading", style: { padding: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "spinner" }) })
        ] }),
        captureFailed && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { style: { fontSize: 13, color: "var(--red)", margin: "10px 0 0" }, children: job.error }),
        captureReady && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("p", { style: { fontSize: 12.5, color: "var(--text-secondary)", margin: "10px 0 0" }, children: [
          job.title && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { style: { display: "block", color: "var(--text)", marginBottom: 2 }, children: [
            "\u300A",
            job.title,
            "\u300B"
          ] }),
          "\u89C6\u9891",
          job.seconds !== void 0 ? `\uFF08${Math.round(job.seconds)}s\uFF09` : "",
          " \xB7 \u5E27 ",
          job.frames ?? 0,
          " \u5F20",
          job.framesError ? `\uFF08\u62BD\u5E27\u5931\u8D25\uFF1A${job.framesError}\uFF09` : "",
          " \xB7 \u5B57\u5E55\u5DF2\u751F\u6210"
        ] })
      ] }),
      captureReady && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "panel", style: { marginTop: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "panel-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconFire, { size: 14 }),
          " AI \u62C6\u89E3"
        ] }),
        analyzeState === "idle" && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("button", { className: "btn btn-primary", onClick: startAnalyze, children: [
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconFire, { size: 15 }),
            " \u2461 \u5F00\u59CB AI \u62C6\u89E3"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { className: "btn btn-ghost", style: { marginLeft: 8 }, onClick: () => onNavigate?.("chat"), children: "\u5728\u5BF9\u8BDD\u4E2D\u8DDF\u8FDB" })
        ] }),
        analyzeState === "running" && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "loading", style: { marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "spinner" }),
          "AI \u6B63\u5728\u770B\u7D20\u6750\u62C6\u89E3\uFF08\u5BF9\u8BDD\u91CC\u53EF\u5BA1\u6279/\u8FFD\u95EE\uFF09\u2026"
        ] }),
        analyzeState === "error" && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { style: { fontSize: 13, color: "var(--red)", margin: "0 0 8px" }, children: "\u62C6\u89E3\u56DE\u5408\u672A\u6B63\u5E38\u5B8C\u6210\uFF0C\u8BE6\u60C5\u89C1\u5BF9\u8BDD\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { className: "btn btn-sm", onClick: startAnalyze, children: "\u91CD\u8BD5" })
        ] }),
        analyzeState === "done" && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "markdown-body", dangerouslySetInnerHTML: { __html: renderMarkdown(report) } }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 12 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("button", { className: "btn btn-sm", onClick: () => onNavigate?.("ideas"), children: [
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconIdea, { size: 13 }),
              " \u53BB\u9009\u9898\u5E93"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { className: "btn btn-sm", onClick: () => onNavigate?.("chat"), children: "\u67E5\u770B\u5BF9\u8BDD" })
          ] })
        ] })
      ] }),
      job === null && !capturing && !preflight?.blocked && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { style: { fontSize: 12.5, color: "var(--text-secondary)", marginTop: 14 }, children: "\u5C0F\u7EA2\u4E66\u9700\u8981\u767B\u5F55\u6001\uFF08\u8BBE\u7F6E\u91CC\u586B cookie \u6216\u8D26\u53F7\u9875\u626B\u7801\uFF09\uFF1B\u6296\u97F3\u514D\u767B\u5F55\u76F4\u8FDE\u3002\u7D20\u6750\u4E0E\u62A5\u544A\u5F52\u6863\u5728 outputs/_deconstruct/<\u4EFB\u52A1id>/ \u4E0B\u3002" })
    ] })
  ] });
}

// src/features/breakdown.tsx
var import_jsx_runtime24 = require("react/jsx-runtime");
var view10 = "breakdown";
var order10 = 39;
var labels10 = { zh: "\u7206\u6B3E\u62C6\u89E3", en: "Breakdown" };
var Icon10 = IconSkills;
var Component10 = BreakdownPage;
var plugin10 = {
  name: "easel-view-breakdown",
  inject: ["slots", "easelShell"],
  apply(ctx) {
    const { useShellProps, t } = ctx.easelShell;
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: pageKey(view10),
      inject: () => ({})
    }, function EaselPage() {
      const props = useShellProps();
      return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "easel-scope", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Component10, { ...props }) });
    }));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: pageKey(view10),
      order: order10,
      locale: "easel.panel",
      label: () => t(view10)
    }, function EaselRailIcon({ size }) {
      return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(Icon10, { size });
    }));
  }
};

// src/lib/media-preview.tsx
var import_react15 = require("react");

// src/lib/media-url.js
var VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "mkv"];
var AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"];
var MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];
function mediaKindOf(name) {
  const matched = /\.([a-z0-9]+)$/i.exec(String(name).trim());
  const ext = matched ? matched[1].toLowerCase() : "";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  return null;
}
function normalizePath(value) {
  let p = String(value ?? "").replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "");
  p = p.replace(/[\\/]+/g, "/");
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}
function workspaceMediaPath(absolutePath, projectRoot2) {
  if (!absolutePath || !projectRoot2) return null;
  const file = normalizePath(absolutePath);
  const root = normalizePath(projectRoot2);
  if (!file || !root || file.toLowerCase() === root.toLowerCase()) return null;
  const lowerFile = file.toLowerCase();
  const lowerRoot = root.toLowerCase();
  if (!lowerFile.startsWith(lowerRoot + "/")) return null;
  const rel = file.slice(root.length + 1);
  if (rel === "") return null;
  const segments = rel.split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment === "")) return null;
  return rel;
}

// src/lib/media-preview.tsx
var import_jsx_runtime25 = require("react/jsx-runtime");
var MEDIA_BODY_ID = "easel-media-player";
var MEDIA_COPY = {
  zh: {
    title: "\u5A92\u4F53\u64AD\u653E",
    unavailable: "\u9875\u5185\u64AD\u653E\u4E0D\u53EF\u7528\uFF08\u6587\u4EF6\u5728\u9879\u76EE\u76EE\u5F55\u5916\u6216\u5DF2\u65E0\u6CD5\u8BFB\u53D6\uFF09\uFF0C\u8BF7\u7528\u4E0A\u65B9\u300C\u6253\u5F00\u300D\u8C03\u7528\u672C\u5730\u64AD\u653E\u5668",
    decodeFailed: "\u6D4F\u89C8\u5668\u65E0\u6CD5\u89E3\u7801\u6B64\u683C\u5F0F\uFF0C\u8BF7\u7528\u4E0A\u65B9\u300C\u6253\u5F00\u300D\u8C03\u7528\u672C\u5730\u64AD\u653E\u5668"
  },
  en: {
    title: "Media",
    unavailable: "In-page playback is unavailable (the file is outside the project or unreadable) \u2014 use Open above.",
    decodeFailed: "The browser cannot decode this format \u2014 use Open above to launch a local player."
  }
};
function parseFileAddress(address) {
  const prefix = "dsh-resource://file/session/";
  if (!address.startsWith(prefix)) return null;
  const rest = address.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  return {
    sessionId: decode(rest.slice(0, slash)),
    path: rest.slice(slash + 1).split("/").map(decode).join("/")
  };
}
var STAGE_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  minHeight: "140px",
  padding: "12px",
  boxSizing: "border-box"
};
var VIDEO_STYLE = { maxWidth: "100%", maxHeight: "100%" };
var AUDIO_STYLE = { width: "100%" };
function MediaBody(props) {
  const { content, resolve, t } = props;
  const file = parseFileAddress(props.resourceAddress);
  const [state, setState] = (0, import_react15.useState)(null);
  const [error, setError] = (0, import_react15.useState)("");
  const revision = content.kind === "renderer" ? content.revision : void 0;
  (0, import_react15.useEffect)(() => {
    if (revision === void 0) return;
    const controller = new AbortController();
    setState(null);
    setError("");
    if (file === null) {
      setError(t("unavailable"));
      content.failed?.();
      return () => controller.abort();
    }
    void (async () => {
      try {
        const result = await resolve(file.sessionId, file.path, controller.signal);
        if (!result?.ok || !result.value) throw new Error("stat failed");
        const kind = mediaKindOf(file.path);
        const rel = workspaceMediaPath(result.value.absolutePath, await projectRoot());
        if (controller.signal.aborted) return;
        if (!kind || !rel) throw new Error("outside project root");
        const src = `/easel/api/workspace-media/${rel.split("/").map(encodeURIComponent).join("/")}`;
        setState({ src, kind, version: result.value.version ?? "" });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(t("unavailable"));
        content.failed?.();
        console.warn("easel-media: playback unavailable", cause);
      }
    })();
    return () => controller.abort();
  }, [props.resourceAddress, revision]);
  if (content.kind !== "renderer" || revision === void 0) return null;
  if (error !== "") {
    return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { style: STAGE_STYLE, "data-easel-media-state": "unavailable", children: /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("p", { style: { margin: 0, textAlign: "center", opacity: 0.75 }, children: error }) });
  }
  if (state === null) return null;
  const reportLoaded = () => {
    content.loaded?.(state.version);
  };
  const onDecodeError = () => {
    setError(t("decodeFailed"));
    setState(null);
    content.failed?.();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { style: STAGE_STYLE, "data-easel-media-state": "playing", children: state.kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    "video",
    {
      controls: true,
      preload: "metadata",
      src: state.src,
      style: VIDEO_STYLE,
      onLoadedMetadata: reportLoaded,
      onError: onDecodeError
    }
  ) : /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    "audio",
    {
      controls: true,
      preload: "metadata",
      src: state.src,
      style: AUDIO_STYLE,
      onLoadedMetadata: reportLoaded,
      onError: onDecodeError
    }
  ) });
}
function registerMediaPreview(ctx) {
  ctx.effect(() => ctx.locale.register("easelMedia", MEDIA_COPY), "easel-media: dictionaries");
  const t = ctx.locale.bind("easelMedia");
  const attach = (scope) => {
    const files = scope.remote.workspaceFiles;
    scope.effect(
      () => scope.documentPreviews.register({
        id: MEDIA_BODY_ID,
        extensions: MEDIA_EXTENSIONS,
        binaryExtensions: MEDIA_EXTENSIONS,
        priority: "extension",
        title: () => t("title"),
        loading: "renderer",
        wrap: false
      }),
      "easel-media: metadata"
    );
    scope.effect(
      () => scope.slots.inject("sidebar.right.tab.document", () => scope.slots.register({
        name: "sidebar.right.tab.document",
        key: MEDIA_BODY_ID,
        locale: "easelMedia",
        inject: () => ({
          resolve: (sessionId, path, signal) => files.stat(sessionId, path, signal)
        })
      }, MediaBody)),
      "easel-media: body"
    );
  };
  if (typeof ctx.inject === "function") ctx.inject(["documentPreviews", "remote.workspaceFiles"], attach);
  else if (ctx.get?.("documentPreviews") !== void 0) attach(ctx);
}

// src/features/media.ts
var plugin11 = {
  name: "easel-media",
  inject: ["slots", "locale"],
  apply(ctx) {
    try {
      registerMediaPreview(ctx);
    } catch (error) {
      console.warn("easel-media: registration failed", error);
    }
  }
};

// src/lib/context-menu-model.js
var FILE_ROW_SELECTOR = "[data-files-entry]";
var FILE_ROOT_SELECTOR = "[data-files-root]";
var EDITABLE_SELECTOR = [
  "[data-composer-input]",
  "textarea",
  'input:not([type="checkbox"]):not([type="radio"]):not([type="file"])',
  '[contenteditable="true"]'
].join(", ");
var CHAT_FLOW_SELECTOR = "[data-chat-flow]";
var CHAT_NODE_SELECTOR = "[data-chat-node-key]";
var PRESENTED_FILE_SELECTOR = "[data-presented-file]";
var TREND_ROW_SELECTOR = "[data-easel-trend]";
var FILE_LINK_SELECTOR = "button[title]";
var MESSAGE_KINDS = /* @__PURE__ */ new Set(["user", "assistant-step"]);
function dataOf(element, name) {
  if (element == null) return void 0;
  const value = element.dataset?.[name];
  return typeof value === "string" ? value : void 0;
}
function isFilePath(value) {
  if (typeof value !== "string" || value === "" || value.includes("\n")) return false;
  if (!/[/\\]/.test(value)) return false;
  const base = value.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
  return /\.[A-Za-z0-9]{1,8}$/.test(base);
}
function fileLinkSurface(target) {
  const card = target.closest(PRESENTED_FILE_SELECTOR);
  if (card != null) {
    const preview = card.querySelector?.("button[title]") ?? null;
    const path2 = preview?.getAttribute?.("title")?.trim();
    if (preview !== null && isFilePath(path2)) {
      return { kind: "file", path: path2, root: void 0, entry: "file", preview };
    }
    return null;
  }
  const button = target.closest(FILE_LINK_SELECTOR);
  const path = button?.getAttribute?.("title")?.trim();
  if (button != null && isFilePath(path)) {
    return { kind: "file", path, root: void 0, entry: "file", preview: button };
  }
  return null;
}
function trendPayloadOf(element) {
  const raw = element?.dataset?.easelTrend;
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const data = JSON.parse(raw);
    if (data === null || typeof data !== "object") return null;
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (title === "") return null;
    return {
      title,
      url: typeof data.url === "string" ? data.url : "",
      source: typeof data.source === "string" ? data.source : "",
      platform: typeof data.platform === "string" ? data.platform : "",
      ...typeof data.rank === "number" ? { rank: data.rank } : {},
      ...typeof data.hot === "string" && data.hot !== "" ? { hot: data.hot } : {}
    };
  } catch {
    return null;
  }
}
function resolveSurface(target, selection) {
  if (target == null || typeof target.closest !== "function") return null;
  const row2 = target.closest(FILE_ROW_SELECTOR);
  if (row2 != null && typeof row2.closest === "function") {
    const root = row2.closest(FILE_ROOT_SELECTOR);
    const path = dataOf(row2, "filesPath");
    const entry = dataOf(row2, "filesEntry");
    if (root != null && typeof path === "string" && path !== "" && entry !== "other") {
      return {
        kind: "file",
        row: row2,
        path,
        root: dataOf(root, "filesRoot"),
        entry,
        preview: row2.querySelector?.("button") ?? null
      };
    }
  }
  const link = fileLinkSurface(target);
  if (link !== null) return link;
  const trendRow = target.closest(TREND_ROW_SELECTOR);
  if (trendRow != null) {
    const trend = trendPayloadOf(trendRow);
    if (trend !== null) return { kind: "trend", element: trendRow, trend };
  }
  const editable = target.closest(EDITABLE_SELECTOR);
  if (editable != null) return { kind: "editable", element: editable };
  const chat = target.closest(CHAT_FLOW_SELECTOR);
  if (chat == null) return null;
  const inside = (node2) => node2 != null && typeof chat.contains === "function" && chat.contains(node2);
  const selected = selection != null && !selection.isCollapsed ? String(selection.toString() ?? "").trim() : "";
  if (selected !== "" && (inside(selection.anchorNode) || inside(selection.focusNode))) {
    return { kind: "conversation", element: chat, text: selected };
  }
  const node = target.closest(CHAT_NODE_SELECTOR);
  if (node != null && MESSAGE_KINDS.has(dataOf(node, "chatFlowKind") ?? "")) {
    const text2 = messageText(node);
    if (text2 !== "") return { kind: "conversation", element: chat, text: text2 };
  }
  return null;
}
function messageText(node) {
  const raw = typeof node?.innerText === "string" ? node.innerText : String(node?.textContent ?? "");
  return raw.replace(/\r\n?/g, "\n").replace(/\n\s*(?:\d{1,2}月\d{1,2}日\s*)?\d{1,2}:\d{2}\s*$/u, "").trim();
}
function isAbsolutePath(path) {
  return /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path);
}
function absolutePathFor(root, path) {
  if (isAbsolutePath(path)) return path;
  if (typeof root !== "string" || root === "") return path;
  return `${root.replace(/\\/g, "/").replace(/\/+$/, "")}/${path.replace(/^[\\/]+/, "")}`;
}
function relativePath(root, absolute) {
  const path = String(absolute ?? "").replace(/\\/g, "/");
  if (typeof root !== "string" || root === "") return path;
  const base = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (base === "") return path;
  if (path === base) return "";
  const prefix = `${base}/`;
  if (path.toLowerCase().startsWith(prefix.toLowerCase())) return path.slice(prefix.length);
  return path;
}
function quoteBlock(text2) {
  const lines = String(text2 ?? "").replace(/\r\n?/g, "\n").trim().split("\n");
  if (lines.length === 1 && lines[0] === "") return "";
  return lines.map((line) => line === "" ? ">" : `> ${line}`).join("\n");
}
function draftBlock(text2) {
  const quoted = quoteBlock(text2);
  return quoted === "" ? "" : `

${quoted}

`;
}
function fileNameOf(path) {
  const parts = String(path ?? "").replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? "";
}

// src/features/context-menu.js
var STYLE_ID = "easel-context-menu-style";
var MENU_CLASS = "easel-ctx-menu";
var ITEM_CLASS = "easel-ctx-menu__item";
var SEPARATOR_CLASS = "easel-ctx-menu__separator";
var HINT_CLASS = "easel-ctx-menu__hint";
var TOAST_CLASS = "easel-ctx-toast";
var CSS = `
.${MENU_CLASS} {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  min-width: 176px;
  max-width: 320px;
  max-height: min(420px, calc(100vh - 12px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-elevated, #ffffff));
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(15, 23, 42, 0.16));
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(12px) saturate(1.4));
  color: var(--dsw-alias-label-primary, #1f2329);
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: 1.35;
  user-select: none;
  -webkit-user-select: none;
}
.${ITEM_CLASS} {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 9px;
  border: 0;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.${ITEM_CLASS}:hover:not(:disabled),
.${ITEM_CLASS}:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.06));
  outline: none;
}
.${ITEM_CLASS}:disabled {
  opacity: 0.45;
  cursor: default;
}
.${HINT_CLASS} {
  margin-left: auto;
  padding-left: 18px;
  color: var(--dsw-alias-label-secondary, rgba(31, 35, 41, 0.5));
  font-size: 11px;
}
.${SEPARATOR_CLASS} {
  height: 1px;
  margin: 4px 6px;
  background: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
}
.${TOAST_CLASS} {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 2147483000;
  max-width: min(70vw, 460px);
  padding: 9px 16px;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-elevated, #ffffff));
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(15, 23, 42, 0.2));
  color: var(--dsw-alias-label-primary, #1f2329);
  font: var(--dsw-text-body-font, 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif);
  text-align: center;
  pointer-events: none;
}
.${TOAST_CLASS}--ok { color: var(--dsh-success-text, #0f9d58); }
.${TOAST_CLASS}--warn { color: var(--dsh-warning-text, #b45309); }
.${TOAST_CLASS}--error { color: var(--dsh-error-text, #dc2626); }
`;
var SEPARATOR = Object.freeze({ separator: true });
var plugin12 = {
  name: "easel-context-menu",
  inject: [
    "sessions",
    "uiSession",
    "uiWorkspace",
    "conversation",
    "remote",
    "remote.session"
  ],
  apply(ctx) {
    ctx.effect(() => installStyles(), "easel-context-menu: styles");
    ctx.effect(() => installListener(ctx), "easel-context-menu: listener");
  }
};
function installStyles() {
  if (document.getElementById(STYLE_ID) !== null) return () => {
  };
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
  return () => {
    style.remove();
  };
}
function installListener(ctx) {
  let closeActive = null;
  const close = () => {
    if (closeActive === null) return;
    const active = closeActive;
    closeActive = null;
    active();
  };
  const onContextMenu = (event) => {
    let surface;
    try {
      surface = resolveSurface(event.target, window.getSelection());
    } catch (error) {
      console.warn("easel-context-menu: surface resolution failed", error);
      return;
    }
    if (surface === null) {
      close();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    close();
    try {
      closeActive = showMenu({
        x: event.clientX,
        y: event.clientY,
        items: itemsFor(ctx, surface),
        onClosed: () => {
          closeActive = null;
        },
        onError: (error) => {
          reportError(ctx, error);
        }
      });
    } catch (error) {
      reportError(ctx, error);
    }
  };
  document.addEventListener("contextmenu", onContextMenu, true);
  return () => {
    document.removeEventListener("contextmenu", onContextMenu, true);
    close();
  };
}
function itemsFor(ctx, surface) {
  if (surface.kind === "file") return fileItems(ctx, surface);
  if (surface.kind === "trend") return trendItems(surface.trend);
  if (surface.kind === "editable") return editableItems(surface.element);
  return [
    menuRow("\u590D\u5236", () => copyOrThrow(surface.text)),
    menuRow("\u590D\u5236 Markdown \u5F15\u7528", () => copyOrThrow(quoteBlock(surface.text))),
    SEPARATOR,
    menuRow("\u6DFB\u52A0\u5230\u5F53\u524D\u4EFB\u52A1", () => addToTask(ctx, surface.text), { disabled: currentInput(ctx) === void 0 }),
    menuRow("\u5728\u8F85\u52A9\u5BF9\u8BDD\u4E2D\u63D0\u95EE", () => askInAuxiliaryConversation(ctx, surface.text), { disabled: currentSessionId(ctx) === void 0 })
  ];
}
function trendItems(trend) {
  const { title, url, source } = trend;
  return [
    menuRow("\u6293\u53D6\u6B63\u6587\u5E76\u5165\u5E93", () => captureTrend(trend), {
      disabled: url === "",
      hint: url === "" ? "\u65E0\u539F\u6587\u94FE\u63A5" : void 0
    }),
    menuRow("\u4EC5\u6536\u85CF\u6807\u9898\u5230\u9009\u9898\u5E93", () => saveTrendTitle(title, source)),
    SEPARATOR,
    menuRow("\u590D\u5236\u6807\u9898", () => copyOrThrow(title)),
    menuRow("\u590D\u5236\u539F\u6587\u94FE\u63A5", () => copyOrThrow(url), { disabled: url === "" }),
    menuRow("\u6253\u5F00\u539F\u6587", () => openTrendUrl(url), { disabled: url === "" })
  ];
}
async function captureTrend(trend) {
  contextToast("\u6B63\u5728\u6293\u53D6\u6B63\u6587\u2026", "info");
  try {
    const result = await captureTrendArticle({
      title: trend.title,
      url: trend.url,
      source: trend.source,
      platform: trend.platform,
      rank: trend.rank,
      hot: trend.hot
    });
    if (typeof result.warning === "string" && result.warning !== "") {
      contextToast(`\u5DF2\u5165\u5E93 \xB7 ${result.warning}`, "warn");
    } else {
      contextToast(result.reused === true ? "\u6B63\u6587\u5DF2\u66F4\u65B0" : "\u5DF2\u5B58\u5165\u5185\u5BB9\u5E93\u4E0E\u9009\u9898\u5E93", "ok");
    }
    notifyTrendSaved(trend.title);
  } catch (error) {
    contextToast(`\u6293\u53D6\u5931\u8D25\uFF1A${messageOf(error)}`, "error");
  }
}
function saveTrendTitle(title, source) {
  createIdea({ title, source }).then(() => {
    contextToast("\u5DF2\u6536\u85CF\u5230\u9009\u9898\u5E93", "ok");
    notifyTrendSaved(title);
  }).catch((error) => {
    contextToast(`\u6536\u85CF\u5931\u8D25\uFF1A${messageOf(error)}`, "error");
  });
}
function notifyTrendSaved(title) {
  window.dispatchEvent(new CustomEvent("easel:trend-saved", { detail: { title } }));
}
function openTrendUrl(url) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
var contextToastTimer = null;
function contextToast(message, kind) {
  const previous = document.querySelector(`.${TOAST_CLASS}`);
  if (previous !== null) previous.remove();
  if (contextToastTimer !== null) clearTimeout(contextToastTimer);
  const toast = document.createElement("div");
  toast.className = `${TOAST_CLASS} ${TOAST_CLASS}--${kind}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  contextToastTimer = setTimeout(() => toast.remove(), 2600);
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function fileItems(ctx, surface) {
  const { path, root, entry, preview } = surface;
  const cwd = currentSessionCwd(ctx);
  const absolute = absolutePathFor(root ?? cwd, path);
  const relative = isAbsolutePath(path) ? relativePath(root ?? cwd, path) : path.replace(/\\/g, "/");
  const items = [];
  if (entry === "file") {
    if (preview !== null && typeof preview.click === "function") items.push(menuRow("\u9884\u89C8", () => {
      preview.click();
    }));
    items.push(menuRow("\u6253\u5F00", () => openPath(ctx, surface)));
    items.push(menuRow("\u6253\u5F00\u65B9\u5F0F\u2026", (menu) => showApplications(ctx, surface, menu), { keepOpen: true }));
  } else {
    items.push(menuRow("\u6253\u5F00", () => openPath(ctx, surface)));
  }
  items.push(SEPARATOR);
  items.push(menuRow("\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u663E\u793A", () => revealPath(ctx, surface)));
  items.push(SEPARATOR);
  items.push(menuRow("\u590D\u5236\u76F8\u5BF9\u8DEF\u5F84", () => copyOrThrow(relative)));
  items.push(menuRow("\u590D\u5236\u7EDD\u5BF9\u8DEF\u5F84", () => copyOrThrow(absolute)));
  if (entry === "file") items.push(menuRow("\u590D\u5236\u6587\u4EF6\u540D", () => copyOrThrow(fileNameOf(absolute))));
  items.push(SEPARATOR);
  items.push(menuRow("\u63A8\u9001\u5230\u8BBE\u5907\u2026", (menu) => showPushTargets(ctx, surface, menu, items), { keepOpen: true }));
  return items;
}
async function showPushTargets(ctx, surface, menu, previousItems) {
  menu.render([{ label: "\u6B63\u5728\u67E5\u627E\u5DF2\u914D\u5BF9\u8BBE\u5907\u2026", disabled: true }]);
  const path = await resolveHostPath(ctx, surface);
  let status;
  try {
    status = await fetchHandoffPaired();
  } catch {
    status = { available: false, paired: [] };
  }
  const items = [];
  if (status.available !== true || status.paired.length === 0) {
    items.push({ label: status.available ? "\u6CA1\u6709\u5DF2\u914D\u5BF9\u7684\u8BBE\u5907" : "\u9694\u7A7A\u4F20\u9001\u672A\u542F\u7528", disabled: true });
  } else {
    for (const device of status.paired) {
      items.push(menuRow(`\u63A8\u9001\u5230\u300C${device.name}\u300D`, () => pushToDevice(device.id, device.name, path)));
    }
  }
  items.push(SEPARATOR);
  items.push(menuRow("\u2190 \u8FD4\u56DE", (row2) => row2.render(previousItems), { keepOpen: true }));
  menu.render(items);
}
async function pushToDevice(peerId, deviceName, path) {
  contextToast(`\u6B63\u5728\u63A8\u9001\u5230\u300C${deviceName}\u300D\u2026`, "info");
  try {
    await pushFileToPeer(peerId, path);
    contextToast(`\u5DF2\u63A8\u9001\u5230\u300C${deviceName}\u300D`, "ok");
  } catch (error) {
    contextToast(`\u63A8\u9001\u5931\u8D25\uFF1A${messageOf(error)}`, "error");
  }
}
function editableItems(element) {
  const selected = hasSelection(element);
  const mod = isMac() ? "\u2318" : "Ctrl+";
  const redo = isMac() ? "\u21E7\u2318Z" : "Ctrl+Y";
  return [
    menuRow("\u64A4\u9500", () => runCommand(element, "undo"), { hint: `${mod}Z` }),
    menuRow("\u91CD\u505A", () => runCommand(element, "redo"), { hint: redo }),
    SEPARATOR,
    menuRow("\u526A\u5207", () => runCommand(element, "cut"), { hint: `${mod}X`, disabled: !selected }),
    menuRow("\u590D\u5236", () => copyOrThrow(selectedText(element)), { hint: `${mod}C`, disabled: !selected }),
    menuRow("\u7C98\u8D34", () => pasteInto(element, false), { hint: `${mod}V` }),
    menuRow("\u7C98\u8D34\u4E3A\u7EAF\u6587\u672C", () => pasteInto(element, true), { hint: isMac() ? "\u21E7\u2318V" : "Ctrl+Shift+V" }),
    menuRow("\u5220\u9664", () => runCommand(element, "delete"), { hint: "Del", disabled: !selected }),
    SEPARATOR,
    menuRow("\u5168\u9009", () => selectAll(element), { hint: `${mod}A` })
  ];
}
function menuRow(label2, action, options = {}) {
  return { label: label2, action, hint: options.hint, disabled: options.disabled === true, keepOpen: options.keepOpen === true };
}
function showMenu({ x: x2, y: y2, items, onClosed, onError }) {
  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.style.visibility = "hidden";
  menu.style.left = "0px";
  menu.style.top = "0px";
  const restoreTarget = document.activeElement;
  let closed = false;
  const restoreFocus = () => {
    if (restoreTarget !== null && restoreTarget.isConnected && typeof restoreTarget.focus === "function") {
      restoreTarget.focus({ preventScroll: true });
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", close);
    window.removeEventListener("blur", close);
    menu.remove();
    if (typeof onClosed === "function") onClosed();
  };
  const enabledItems = () => [...menu.querySelectorAll(`.${ITEM_CLASS}:not(:disabled)`)];
  const focusFirst = () => {
    const first = enabledItems()[0];
    if (first !== void 0) first.focus({ preventScroll: true });
  };
  const place = () => {
    const margin = 6;
    menu.style.visibility = "hidden";
    menu.style.left = "0px";
    menu.style.top = "0px";
    const rect = menu.getBoundingClientRect();
    let left = x2;
    let top = y2;
    if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, x2 - rect.width);
    if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, y2 - rect.height);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.visibility = "visible";
  };
  const render = (nextItems) => {
    if (closed) return;
    menu.replaceChildren();
    for (const item of nextItems) menu.append(item.separator === true ? separatorElement() : itemElement(item, close, restoreFocus, render, onError));
    place();
    focusFirst();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      restoreFocus();
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    const list = enabledItems();
    if (list.length === 0) return;
    const current = list.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list[current < 0 ? 0 : (current + 1) % list.length].focus({ preventScroll: true });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[current < 0 ? list.length - 1 : (current - 1 + list.length) % list.length].focus({ preventScroll: true });
    } else if (event.key === "Home") {
      event.preventDefault();
      list[0].focus({ preventScroll: true });
    } else if (event.key === "End") {
      event.preventDefault();
      list[list.length - 1].focus({ preventScroll: true });
    }
  };
  const onPointerDown = (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
  };
  const onScroll = (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
  };
  document.body.append(menu);
  render(items);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", close);
  window.addEventListener("blur", close);
  return close;
}
function itemElement(item, close, restoreFocus, render, onError) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = ITEM_CLASS;
  button.setAttribute("role", "menuitem");
  button.disabled = item.disabled === true;
  const label2 = document.createElement("span");
  label2.textContent = item.label;
  button.append(label2);
  if (typeof item.hint === "string" && item.hint !== "") {
    const hint = document.createElement("span");
    hint.className = HINT_CLASS;
    hint.textContent = item.hint;
    button.append(hint);
  }
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    const report = onError ?? ((error) => {
      console.warn("easel-context-menu:", error);
    });
    const run = () => {
      try {
        Promise.resolve(item.action?.({ render, close })).catch(report);
      } catch (error) {
        report(error);
      }
    };
    if (item.keepOpen === true) {
      run();
      return;
    }
    close();
    restoreFocus();
    run();
  });
  return button;
}
function separatorElement() {
  const separator = document.createElement("div");
  separator.className = SEPARATOR_CLASS;
  separator.setAttribute("role", "separator");
  return separator;
}
async function showApplications(ctx, surface, menu) {
  menu.render([{ label: "\u6B63\u5728\u67E5\u627E\u5E94\u7528\u2026", disabled: true }]);
  const path = await resolveHostPath(ctx, surface);
  let applications = null;
  try {
    const result = await ctx.remote.session.workspacePathApplications({ path });
    applications = result.ok ? result.value : null;
  } catch (_error) {
    applications = null;
  }
  const items = [];
  if (applications === null) {
    items.push({ label: "\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\u5173\u8054", disabled: true });
  } else if (applications.length === 0) {
    items.push({ label: "\u6CA1\u6709\u53EF\u7528\u7684\u5E94\u7528", disabled: true });
  } else {
    for (const application of applications) {
      items.push({
        label: application.default ? `${application.name}\uFF08\u9ED8\u8BA4\uFF09` : application.name,
        action: () => openPathAt(ctx, path, application.id)
      });
    }
  }
  items.push(SEPARATOR);
  items.push(menuRow("\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u663E\u793A", () => revealPathAt(ctx, path)));
  menu.render(items);
}
async function resolveHostPath(ctx, surface) {
  const cwd = currentSessionCwd(ctx);
  const display = absolutePathFor(surface.root ?? cwd, surface.path);
  const sessionId = currentSessionId(ctx);
  if (sessionId === void 0) return display;
  const relative = isAbsolutePath(surface.path) ? relativePath(surface.root ?? cwd, surface.path) : surface.path.replace(/\\/g, "/");
  if (relative === "" || isAbsolutePath(relative)) return display;
  try {
    const files = ctx.get?.("remote.workspaceFiles");
    if (files === void 0) return display;
    const result = await files.stat(sessionId, relative, new AbortController().signal);
    const canonical = result.ok ? result.value?.absolutePath : void 0;
    if (typeof canonical === "string" && canonical !== "") return canonical;
  } catch (_error) {
  }
  return display;
}
async function openPath(ctx, surface, application) {
  const path = await resolveHostPath(ctx, surface);
  await openPathAt(ctx, path, application);
}
async function openPathAt(ctx, path, application) {
  const result = await ctx.remote.session.openWorkspacePath({
    path,
    ...application === void 0 ? {} : { application }
  });
  if (!result.ok) throw new Error(result.error?.message ?? "\u6253\u5F00\u5931\u8D25");
}
async function revealPath(ctx, surface) {
  const path = await resolveHostPath(ctx, surface);
  await revealPathAt(ctx, path);
}
async function revealPathAt(ctx, path) {
  const result = await ctx.remote.session.openWorkspacePath({ path, action: "reveal" });
  if (!result.ok) throw new Error(result.error?.message ?? "\u5B9A\u4F4D\u6587\u4EF6\u5931\u8D25");
}
function currentSessionId(ctx) {
  const binding = ctx.uiSession?.adapter?.current?.value;
  return typeof binding?.key === "string" && binding.key !== "" ? binding.key : void 0;
}
function currentSessionCwd(ctx) {
  const sessionId = currentSessionId(ctx);
  if (sessionId === void 0) return void 0;
  return ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
}
function currentInput(ctx) {
  const sessionId = currentSessionId(ctx);
  if (sessionId === void 0) return void 0;
  let binding;
  try {
    binding = ctx.sessions.binding(sessionId);
  } catch (_error) {
    return void 0;
  }
  if (binding === void 0) return void 0;
  try {
    return ctx.conversation.input.for(binding.ctx);
  } catch (_error) {
    return void 0;
  }
}
function addToTask(ctx, text2) {
  const input = currentInput(ctx);
  if (input === void 0) throw new Error("\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u8F93\u5165\u6846");
  const block = draftBlock(text2);
  if (block === "") return;
  const actions2 = input.actions;
  if (typeof actions2?.captureInsertion === "function" && typeof actions2?.insertText === "function") {
    if (actions2.insertText(block, actions2.captureInsertion())) {
      input.focus();
      return;
    }
    if (actions2.insertText(block, actions2.captureInsertion())) {
      input.focus();
      return;
    }
  }
  const draft = input.state?.getSnapshot?.().draft;
  input.setDraft(`${typeof draft === "string" ? draft : ""}${block}`);
  input.focus();
}
function askInAuxiliaryConversation(ctx, text2) {
  const prompt = `${quoteBlock(text2)}

`;
  ctx.uiWorkspace.startSession(void 0, { prompt, clearPreviousDraft: true });
}
async function copyOrThrow(text2) {
  if (await writeClipboard(text2)) return;
  throw new Error("\u590D\u5236\u5931\u8D25");
}
async function writeClipboard(text2) {
  try {
    await navigator.clipboard.writeText(text2);
    return true;
  } catch (_error) {
  }
  try {
    const field = document.createElement("textarea");
    field.value = text2;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
    document.body.append(field);
    field.focus({ preventScroll: true });
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  } catch (_error) {
    return false;
  }
}
function hasSelection(element) {
  if (isTextField(element)) return (element.selectionStart ?? 0) !== (element.selectionEnd ?? 0);
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed) return false;
  const within = (node) => node !== null && element.contains(node);
  return within(selection.anchorNode) || within(selection.focusNode);
}
function selectedText(element) {
  if (isTextField(element)) {
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    return element.value.slice(start, end);
  }
  return window.getSelection()?.toString() ?? "";
}
function isTextField(element) {
  const name = element?.tagName;
  return name === "INPUT" || name === "TEXTAREA";
}
function focusField(element) {
  if (typeof element.focus === "function") element.focus({ preventScroll: true });
}
function runCommand(element, command) {
  focusField(element);
  try {
    document.execCommand(command);
  } catch (error) {
    reportError(void 0, error);
  }
}
async function pasteInto(element, plain) {
  focusField(element);
  if (!plain) {
    try {
      if (document.execCommand("paste")) return;
    } catch (_error) {
    }
  }
  let text2 = "";
  try {
    text2 = await navigator.clipboard.readText();
  } catch (_error) {
    return;
  }
  if (text2 === "") return;
  insertAtCaret(element, text2);
}
function insertAtCaret(element, text2) {
  if (isTextField(element)) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    element.setRangeText(text2, start, end, "end");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  try {
    document.execCommand("insertText", false, text2);
  } catch (error) {
    reportError(void 0, error);
  }
}
function selectAll(element) {
  if (isTextField(element)) {
    element.focus({ preventScroll: true });
    element.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  if (selection === null) return;
  selection.removeAllRanges();
  selection.addRange(range);
  focusField(element);
}
function isMac() {
  return /mac|iphone|ipad/i.test(navigator.userAgent);
}
function reportError(ctx, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`easel-context-menu: ${message}`);
  if (ctx === void 0) return;
  try {
    const input = currentInput(ctx);
    if (input !== void 0) input.notify("error", message);
  } catch (_error) {
  }
}

// src/components/HandoffSettings.tsx
var import_react16 = require("react");

// src/lib/handoff-api.ts
var BASE2 = "/easel";
async function request2(url, options) {
  const res = await fetch(`${BASE2}${url}`, { cache: "no-store", ...options });
  if (!res.ok) {
    let detail = "";
    try {
      const payload = await res.json();
      detail = payload && (payload.detail || payload.error) || "";
    } catch {
    }
    throw new Error(detail || `\u8BF7\u6C42\u5931\u8D25\uFF08${res.status} ${res.statusText}\uFF09`);
  }
  return res.json();
}
function getHandoffStatus() {
  return request2("/api/handoff/status");
}
function getHandoffWorkspaces() {
  return request2("/api/handoff/workspaces");
}
function pairWithPeer(peerId) {
  return request2("/api/handoff/pair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ peerId })
  });
}
function acceptPairing(id) {
  return request2(`/api/handoff/pair/${encodeURIComponent(id)}/accept`, { method: "POST" });
}
function rejectPairing(id) {
  return request2(`/api/handoff/pair/${encodeURIComponent(id)}/reject`, { method: "POST" });
}
function sendHandoff(peerId, workspacePath, payload) {
  return request2("/api/handoff/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ peerId, workspacePath, payload })
  });
}

// src/components/HandoffSettings.tsx
var import_jsx_runtime26 = require("react/jsx-runtime");
var COPY = {
  en: {
    nav: "Air Transfer",
    intro: "Send a project and its agent sessions to another device on this network, or receive one. Both devices stay on the same network with the app open.",
    unavailable: "Air Transfer is not enabled in this profile.",
    device: "This device",
    port: "port",
    refresh: "Refresh",
    paired: "Paired devices",
    pairedBadge: "Paired",
    noPaired: "Nothing paired yet. Pair a nearby device first.",
    nearby: "Nearby devices",
    noNearby: "No devices found. Keep both apps open on the same network, then refresh.",
    pair: "Pair",
    pending: "Waiting for confirmation",
    sasHint: "Check that both screens show this number, then confirm on each. Only pair when they match.",
    confirm: "They match \u2014 pair",
    reject: "Decline",
    sendTitle: "Send a project",
    pickWorkspace: "Choose a project",
    pickPeer: "Choose a device",
    payloadTitle: "Include",
    withSessions: "Sessions (agent continuation)",
    withMaterials: "Project materials (\u7D20\u6750/)",
    withLibrary: "Content library (outputs/)",
    withConfig: "Config (.env / profiles / skills)",
    configHint: "Contains API keys \u2014 only sent when selected, merged into the receiving device\u2019s own config on arrival.",
    send: "Send",
    sending: "Sending\u2026",
    sent: "Handoff complete.",
    failed: "Handoff failed"
  },
  zh: {
    nav: "\u9694\u7A7A\u4F20\u9001",
    intro: "\u628A\u9879\u76EE\u8FDE\u540C agent \u4F1A\u8BDD\u53D1\u5230\u672C\u7F51\u7EDC\u7684\u53E6\u4E00\u53F0\u8BBE\u5907\uFF0C\u6216\u4ECE\u53E6\u4E00\u53F0\u8BBE\u5907\u63A5\u6536\u3002\u4E24\u53F0\u8BBE\u5907\u9700\u5728\u540C\u4E00\u7F51\u7EDC\u5E76\u90FD\u4FDD\u6301\u5E94\u7528\u5F00\u542F\u3002",
    unavailable: "\u5F53\u524D profile \u672A\u542F\u7528\u9694\u7A7A\u4F20\u9001\u3002",
    device: "\u672C\u673A",
    port: "\u7AEF\u53E3",
    refresh: "\u5237\u65B0",
    paired: "\u5DF2\u914D\u5BF9\u8BBE\u5907",
    pairedBadge: "\u5DF2\u914D\u5BF9",
    noPaired: "\u8FD8\u6CA1\u6709\u5DF2\u914D\u5BF9\u7684\u8BBE\u5907\uFF0C\u5148\u5728\u9644\u8FD1\u8BBE\u5907\u91CC\u914D\u5BF9\u3002",
    nearby: "\u9644\u8FD1\u8BBE\u5907",
    noNearby: "\u5C1A\u672A\u53D1\u73B0\u8BBE\u5907\u3002\u8BF7\u8BA9\u4E24\u53F0\u8BBE\u5907\u90FD\u5F00\u7740\u5E94\u7528\u5E76\u5904\u4E8E\u540C\u4E00\u7F51\u7EDC\uFF0C\u7136\u540E\u5237\u65B0\u3002",
    pair: "\u914D\u5BF9",
    pending: "\u7B49\u5F85\u786E\u8BA4",
    sasHint: "\u8BF7\u6838\u5BF9\u4E24\u53F0\u5C4F\u5E55\u663E\u793A\u7684\u662F\u540C\u4E00\u4E32\u6570\u5B57\uFF0C\u518D\u5206\u522B\u5728\u5404\u81EA\u8BBE\u5907\u4E0A\u786E\u8BA4\uFF1B\u4E00\u81F4\u624D\u914D\u5BF9\u3002",
    confirm: "\u4E00\u81F4\uFF0C\u914D\u5BF9",
    reject: "\u62D2\u7EDD",
    sendTitle: "\u53D1\u9001\u9879\u76EE",
    pickWorkspace: "\u9009\u62E9\u9879\u76EE",
    pickPeer: "\u9009\u62E9\u8BBE\u5907",
    payloadTitle: "\u968F\u5305\u5185\u5BB9",
    withSessions: "\u4F1A\u8BDD\uFF08agent \u7EED\u4F5C\u4E0A\u4E0B\u6587\uFF09",
    withMaterials: "\u9879\u76EE\u7D20\u6750\uFF08\u7D20\u6750/\uFF09",
    withLibrary: "\u5185\u5BB9\u5E93\uFF08outputs/\uFF09",
    withConfig: "\u914D\u7F6E\u9879\uFF08.env / \u753B\u50CF / \u6280\u80FD\uFF09",
    configHint: "\u914D\u7F6E\u9879\u542B API \u5BC6\u94A5\uFF0C\u53EA\u5728\u52FE\u9009\u540E\u968F\u5305\u53D1\u9001\uFF1B\u5230\u8FBE\u540E\u5408\u5E76\u8FDB\u5BF9\u65B9\u672C\u673A\u914D\u7F6E\u3002",
    send: "\u53D1\u9001",
    sending: "\u53D1\u9001\u4E2D\u2026",
    sent: "\u4EA4\u63A5\u5B8C\u6210\u3002",
    failed: "\u4EA4\u63A5\u5931\u8D25"
  }
};
var HANDOFF_STYLES = `
.ehs-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.ehs-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-settings-card-fill);
}
.ehs-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}
.ehs-pending { border-color: var(--dsw-alias-state-business-primary); }
.ehs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}
.ehs-row + .ehs-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.ehs-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ehs-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ehs-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-device { display: flex; flex-direction: column; gap: 2px; }
.ehs-device-name { font-size: 14px; line-height: 22px; }
.ehs-device-meta { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-device-meta code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.02em; }
.ehs-sas-block { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0 2px; text-align: center; }
.ehs-sas {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 32px;
  line-height: 40px;
  font-weight: 600;
  letter-spacing: 0.18em;
  padding-left: 0.18em;
}
.ehs-actions { display: flex; gap: 8px; justify-content: center; }
.ehs-empty { padding: 6px 0; color: var(--dsw-alias-label-secondary); }
.ehs-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-family: inherit;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-sm);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
  transition: transform 100ms ease-out, background-color 120ms ease-out;
}
.ehs-btn-md { height: 36px; padding: 0 14px; border-radius: var(--dsw-radius-md); font-size: 14px; line-height: 22px; }
.ehs-btn:active:not(:disabled) { transform: scale(0.97); }
.ehs-btn:disabled { cursor: not-allowed; opacity: 0.4; }
.ehs-btn:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.ehs-btn-primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.ehs-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.ehs-btn-outline { border: 0.5px solid var(--dsw-alias-border-l3); }
.ehs-btn-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.ehs-btn-ghost:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.ehs-chip {
  flex: none;
  padding: 1px 8px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.ehs-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.ehs-field { display: flex; flex-direction: column; gap: 4px; min-width: 160px; flex: 1; }
.ehs-field > span { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-payload { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ehs-payload-row { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.ehs-check { display: inline-flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; cursor: pointer; }
.ehs-check input { width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.ehs-check input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.ehs-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-select {
  box-sizing: border-box;
  height: 32px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
}
.ehs-select:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ehs-outcome { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ehs-outcome[data-tone='ok'] { color: var(--dsw-alias-state-success-primary); }
.ehs-outcome[data-tone='fail'] { color: var(--dsw-alias-state-error-primary); }
.ehs-error { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
@media (prefers-reduced-motion: reduce) {
  .ehs-btn { transition: none; }
  .ehs-btn:active:not(:disabled) { transform: none; }
}
`;
function HandoffSettings({ t }) {
  const [status, setStatus] = (0, import_react16.useState)(void 0);
  const [workspaces, setWorkspaces] = (0, import_react16.useState)([]);
  const [error, setError] = (0, import_react16.useState)("");
  const [busy, setBusy] = (0, import_react16.useState)(void 0);
  const [workspacePath, setWorkspacePath] = (0, import_react16.useState)("");
  const [peerId, setPeerId] = (0, import_react16.useState)("");
  const [payload, setPayload] = (0, import_react16.useState)({ sessions: true, materials: true, library: false, config: false });
  const mounted = (0, import_react16.useRef)(true);
  (0, import_react16.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refresh = (0, import_react16.useCallback)(async () => {
    try {
      const next = await getHandoffStatus();
      if (!mounted.current) return;
      setStatus(next);
      if (next.available) {
        const listing = await getHandoffWorkspaces();
        if (!mounted.current) return;
        setWorkspaces(listing.workspaces);
        setWorkspacePath((current) => current !== "" && listing.workspaces.some((item) => item.path === current) ? current : listing.workspaces[0]?.path ?? "");
        setPeerId((current) => current !== "" && next.paired.some((item) => item.id === current) ? current : next.paired[0]?.id ?? "");
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, []);
  (0, import_react16.useEffect)(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 3e3);
    return () => {
      clearInterval(timer);
    };
  }, [refresh]);
  const run = async (action, work) => {
    setBusy(action);
    setError("");
    try {
      await work();
      await refresh();
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (mounted.current) setBusy(void 0);
    }
  };
  if (status === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-root", children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: "ehs-muted", children: error || "\u2026" }) });
  }
  const pending = status.pending;
  const unpaired = status.discovered.filter((peer) => !status.paired.some((paired) => paired.id === peer.id));
  const last = status.last ?? void 0;
  const canSend = workspacePath !== "" && peerId !== "";
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: "ehs-intro", children: t("intro") }),
    status.available && status.device !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("section", { className: "ehs-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-card-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("device") }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
          "button",
          {
            type: "button",
            className: "ehs-btn ehs-btn-ghost",
            disabled: busy !== void 0,
            onClick: () => {
              void run("refresh", refresh);
            },
            children: t("refresh")
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-device", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-device-name", children: status.device.name }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-device-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("code", { children: status.device.id.slice(0, 12) }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: "\xB7" }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("span", { children: [
            t("port"),
            " ",
            status.device.port
          ] })
        ] })
      ] })
    ] }),
    !status.available && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: "ehs-empty", children: status.reason ?? t("unavailable") }),
    status.available && pending.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("section", { className: "ehs-card ehs-pending", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("pending") }) }),
      pending.map((offer) => /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-sas-block", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { children: [
          offer.peer.name,
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("span", { className: "ehs-muted", children: [
            "(",
            offer.peer.platform,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-sas", "aria-label": `${offer.sas}`, children: offer.sas }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-muted", children: t("sasHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
            "button",
            {
              type: "button",
              className: "ehs-btn ehs-btn-outline",
              disabled: busy !== void 0,
              onClick: () => {
                void run(`reject:${offer.id}`, () => rejectPairing(offer.id));
              },
              children: t("reject")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
            "button",
            {
              type: "button",
              className: "ehs-btn ehs-btn-primary",
              disabled: busy !== void 0,
              onClick: () => {
                void run(`accept:${offer.id}`, () => acceptPairing(offer.id));
              },
              children: t("confirm")
            }
          )
        ] })
      ] }, offer.id))
    ] }),
    status.available && /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("section", { className: "ehs-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("nearby") }) }),
      unpaired.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-empty", children: t("noNearby") }) : unpaired.map((peer) => /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-row-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: "ehs-row-title", children: peer.name }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("span", { className: "ehs-muted", children: [
            peer.platform,
            peer.compatible === false ? " \xB7 \u26A0" : ""
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
          "button",
          {
            type: "button",
            className: "ehs-btn ehs-btn-outline",
            disabled: busy !== void 0,
            onClick: () => {
              void run(`pair:${peer.id}`, () => pairWithPeer(peer.id));
            },
            children: t("pair")
          }
        )
      ] }, peer.id))
    ] }),
    status.available && /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("section", { className: "ehs-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("paired") }) }),
      status.paired.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-empty", children: t("noPaired") }) : status.paired.map((peer) => /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-row-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: "ehs-row-title", children: peer.name }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("span", { className: "ehs-muted", children: [
            peer.platform,
            " \xB7 ",
            peer.id.slice(0, 8)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: "ehs-chip", children: t("pairedBadge") })
      ] }, peer.id))
    ] }),
    status.available && /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("section", { className: "ehs-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("sendTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-form", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("label", { className: "ehs-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("pickWorkspace") }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(
            "select",
            {
              className: "ehs-select",
              value: workspacePath,
              onChange: (event) => {
                setWorkspacePath(event.target.value);
              },
              children: [
                workspaces.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("option", { value: "", children: t("pickWorkspace") }),
                workspaces.map((workspace) => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("option", { value: workspace.path, children: workspace.title }, workspace.path))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("label", { className: "ehs-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { children: t("pickPeer") }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(
            "select",
            {
              className: "ehs-select",
              value: peerId,
              onChange: (event) => {
                setPeerId(event.target.value);
              },
              children: [
                status.paired.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("option", { value: "", children: t("pickPeer") }),
                status.paired.map((peer) => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("option", { value: peer.id, children: peer.name }, peer.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
          "button",
          {
            type: "button",
            className: "ehs-btn ehs-btn-md ehs-btn-primary",
            disabled: busy !== void 0 || !canSend,
            onClick: () => {
              void run("send", () => sendHandoff(peerId, workspacePath, payload));
            },
            children: busy === "send" ? t("sending") : t("send")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-payload", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: "ehs-hint", children: t("payloadTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "ehs-payload-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("label", { className: "ehs-check", children: [
              /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: payload.sessions,
                  onChange: (event) => {
                    setPayload((current) => ({ ...current, sessions: event.target.checked }));
                  }
                }
              ),
              t("withSessions")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("label", { className: "ehs-check", children: [
              /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: payload.materials,
                  onChange: (event) => {
                    setPayload((current) => ({ ...current, materials: event.target.checked }));
                  }
                }
              ),
              t("withMaterials")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("label", { className: "ehs-check", children: [
              /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: payload.library,
                  onChange: (event) => {
                    setPayload((current) => ({ ...current, library: event.target.checked }));
                  }
                }
              ),
              t("withLibrary")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("label", { className: "ehs-check", children: [
              /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: payload.config,
                  onChange: (event) => {
                    setPayload((current) => ({ ...current, config: event.target.checked }));
                  }
                }
              ),
              t("withConfig")
            ] })
          ] }),
          payload.config && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: "ehs-hint", children: t("configHint") })
        ] })
      ] }),
      last !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "ehs-outcome", "data-tone": last.ok ? "ok" : "fail", "aria-live": "polite", children: last.ok ? t("sent") : `${t("failed")}\uFF1A${last.detail}` })
    ] }),
    error !== "" && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: "ehs-error", role: "alert", children: error })
  ] });
}

// src/features/handoff.tsx
var NS = "easel.handoff";
var STYLE_ID2 = "easel-handoff-settings-styles";
var plugin13 = {
  name: "easel-handoff-settings",
  inject: ["slots", "locale"],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, COPY), "easel: handoff dictionaries");
    ctx.effect(() => {
      const style = document.createElement("style");
      style.id = STYLE_ID2;
      style.textContent = HANDOFF_STYLES;
      document.head.append(style);
      return () => {
        style.remove();
      };
    }, "easel: handoff styles");
    const t = ctx.locale.bind(NS);
    ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "easel-handoff",
      order: 60,
      locale: NS,
      label: () => t("nav"),
      inject: () => ({ t })
    }, HandoffSettings));
  }
};

// src/features/index.ts
var views = [dashboard_exports, trends_exports, ideas_exports, calendar_exports, skills_exports, outputs_exports, publish_exports, accounts_exports, profile_exports, breakdown_exports];
var FEATURES = views.map((module2) => ({
  view: module2.view,
  order: module2.order,
  labels: module2.labels,
  plugin: module2.plugin
}));
var CLIENT_PLUGINS = [...FEATURES.map((feature) => feature.plugin), plugin11, plugin12, plugin13];

// src/components/DataRootSection.tsx
var import_react17 = require("react");
var import_jsx_runtime27 = require("react/jsx-runtime");
var box = { display: "flex", flexDirection: "column", gap: 12, fontSize: 13 };
var row = { display: "flex", flexDirection: "column", gap: 4 };
var label = { opacity: 0.7 };
var code = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, wordBreak: "break-all" };
var actions = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
var inputStyle = {
  flex: "1 1 320px",
  minWidth: 0,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(127,127,127,.35)",
  background: "transparent",
  color: "inherit",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12
};
var buttonStyle = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid rgba(127,127,127,.35)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer"
};
var primaryStyle = {
  ...buttonStyle,
  border: "none",
  background: "var(--dsw-accent, #4f7cff)",
  color: "#fff"
};
var warningStyle = { margin: 0, padding: "8px 10px", borderRadius: 6, background: "rgba(214,158,46,.12)", color: "inherit" };
var errorStyle = { margin: 0, color: "var(--dsw-danger, #d14)", whiteSpace: "pre-wrap" };
async function request3(path, init) {
  const headers = {
    accept: "application/json",
    ...init?.body === void 0 ? {} : { "content-type": "application/json" },
    ...init?.headers
  };
  const res = await fetch(`/easel/api${path}`, { ...init, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail ?? data.message ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data;
}
function DataRootSection({ t }) {
  const [status, setStatus] = (0, import_react17.useState)(null);
  const [value, setValue] = (0, import_react17.useState)("");
  const [busy, setBusy] = (0, import_react17.useState)(false);
  const [error, setError] = (0, import_react17.useState)(null);
  const [notice, setNotice] = (0, import_react17.useState)(null);
  (0, import_react17.useEffect)(() => {
    let active = true;
    request3("/data-root").then((next) => {
      if (!active) return;
      setStatus(next);
      setValue(next.current ?? next.default ?? "");
    }).catch((err) => {
      if (active) setError(err.message);
    });
    return () => {
      active = false;
    };
  }, []);
  if (status !== null && !status.supported) {
    return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("section", { style: box, children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("h2", { children: t("nav") }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { children: t("onlyDesktop") })
    ] });
  }
  if (status === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("section", { style: box, children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("h2", { children: t("nav") }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { children: t("loading") }),
      error === null ? null : /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: errorStyle, role: "alert", children: error })
    ] });
  }
  const choose = async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await request3("/data-root/pick", { method: "POST" });
      if (picked.path) setValue(picked.path);
    } catch (err) {
      const message = err.message;
      setNotice(message === "picker-unavailable" ? t("pickUnavailable") : message);
    } finally {
      setBusy(false);
    }
  };
  const migrate = async () => {
    setBusy(true);
    setError(null);
    try {
      await request3("/data-root", { method: "POST", body: JSON.stringify({ path: value.trim() }) });
      setNotice(t("migrating"));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const trimmed = value.trim().replace(/[\\/]+$/, "");
  const current = (status.current ?? "").replace(/[\\/]+$/, "");
  const unchanged = trimmed.length === 0 || trimmed === current;
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("section", { style: box, children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("h2", { children: t("nav") }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: { margin: 0 }, children: t("intro") }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { style: label, children: t("current") }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("code", { style: code, children: status.current })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { style: label, children: t("default") }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("code", { style: code, children: status.default })
    ] }),
    status.isDefault ? null : /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { style: actions, children: /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      "button",
      {
        type: "button",
        style: buttonStyle,
        disabled: busy,
        onClick: () => {
          setValue(status.default ?? "");
          setNotice(null);
        },
        children: t("useDefault")
      }
    ) }),
    status.cloudSynced ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: warningStyle, children: t("cloudWarning") }) : null,
    status.pending ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: { margin: 0 }, children: t("pending") }) : null,
    status.lastError ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: errorStyle, role: "alert", children: status.lastError }) : null,
    notice ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: { margin: 0 }, children: notice }) : null,
    error ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { style: errorStyle, role: "alert", children: error }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { style: actions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
        "input",
        {
          style: inputStyle,
          value,
          spellCheck: false,
          onChange: (event) => {
            setValue(event.target.value);
            setNotice(null);
          },
          "aria-label": t("current")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("button", { type: "button", style: buttonStyle, disabled: busy, onClick: () => {
        void choose();
      }, children: t("choose") }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("button", { type: "button", style: primaryStyle, disabled: busy || unchanged, onClick: () => {
        void migrate();
      }, children: t("migrate") })
    ] })
  ] });
}

// src/locales/dataRoot.ts
var DATA_ROOT_COPY = {
  zh: {
    nav: "\u6570\u636E\u4F4D\u7F6E",
    intro: "\u9879\u76EE\u548C\u4F1A\u8BDD\u5B58\u653E\u5728\u8FD9\u91CC\u3002\u8FC1\u79FB\u4F1A\u628A\u6574\u4E2A\u6570\u636E\u76EE\u5F55\u79FB\u5230\u65B0\u4F4D\u7F6E\uFF0C\u65E7\u8DEF\u5F84\u4FDD\u7559\u94FE\u63A5\uFF0C\u5DF2\u6709\u9879\u76EE\u4ECD\u53EF\u76F4\u63A5\u6253\u5F00\u3002",
    current: "\u5F53\u524D\u76EE\u5F55",
    default: "\u9ED8\u8BA4\u4F4D\u7F6E",
    useDefault: "\u4F7F\u7528\u9ED8\u8BA4\u4F4D\u7F6E",
    choose: "\u9009\u62E9\u6587\u4EF6\u5939\u2026",
    migrate: "\u8FC1\u79FB\u5E76\u91CD\u542F",
    migrating: "\u6B63\u5728\u8FC1\u79FB\uFF0C\u5E94\u7528\u4F1A\u81EA\u52A8\u91CD\u542F\u2026",
    pending: "\u5DF2\u6709\u4E00\u6B21\u8FC1\u79FB\u5728\u7B49\u5F85\u91CD\u542F\u540E\u6267\u884C\u3002",
    cloudWarning: "\u8FD9\u4E2A\u4F4D\u7F6E\u5728\u4E91\u540C\u6B65\u76EE\u5F55\u4E0B\uFF08OneDrive/iCloud \u7B49\uFF09\uFF0C\u5927\u9879\u76EE\u4F1A\u968F\u4E4B\u4E0A\u4F20\u3002\u53EF\u4EE5\u6362\u5230\u4E0D\u540C\u6B65\u7684\u76EE\u5F55\u3002",
    onlyDesktop: "\u4EC5\u684C\u9762\u7248\u652F\u6301\u4FEE\u6539\u6570\u636E\u4F4D\u7F6E\u3002",
    loading: "\u8BFB\u53D6\u4E2D\u2026",
    pickUnavailable: "\u7CFB\u7EDF\u6CA1\u6709\u53EF\u7528\u7684\u76EE\u5F55\u9009\u62E9\u5668\uFF0C\u8BF7\u76F4\u63A5\u8F93\u5165\u8DEF\u5F84\u3002"
  },
  en: {
    nav: "Data location",
    intro: "Projects and sessions live here. Moving the data root keeps the old path as a link, so existing projects stay reachable.",
    current: "Current folder",
    default: "Default folder",
    useDefault: "Use default",
    choose: "Choose folder\u2026",
    migrate: "Move and restart",
    migrating: "Moving the data root; the app will restart automatically\u2026",
    pending: "A move is queued and will run after the next restart.",
    cloudWarning: "This folder is inside a cloud-sync location (OneDrive/iCloud, etc.), so large projects will be uploaded. Pick a non-synced folder if that is not desired.",
    onlyDesktop: "Changing the data location is available in the desktop app only.",
    loading: "Loading\u2026",
    pickUnavailable: "No folder picker is available; type the path instead."
  }
};

// src/client.tsx
var NS2 = "easel.panel";
var STYLE_ID3 = "dsh-plugin-easel-style";
var STYLES = EASEL_CSS;
var COPY2 = {
  zh: Object.fromEntries(FEATURES.map((feature) => [feature.view, feature.labels.zh])),
  en: Object.fromEntries(FEATURES.map((feature) => [feature.view, feature.labels.en]))
};
var client_default = {
  inject: ["slots", "locale", "uiSidebarPanels", "sessions", "uiWorkspace", "remote", "remote.session"],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS2, COPY2), "easel: rail dictionaries");
    ctx.effect(() => {
      const style = document.createElement("style");
      style.id = STYLE_ID3;
      style.textContent = STYLES;
      document.head.append(style);
      return () => style.remove();
    }, "easel: workbench styles");
    ctx.effect(() => ctx.uiSidebarPanels.hidden("schedules"), "easel: hide schedules rail icon");
    ctx.effect(
      () => ctx.locale.register("settings.dataRoot", DATA_ROOT_COPY),
      "easel: data root dictionaries"
    );
    ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "data-root",
      order: 40,
      label: () => ctx.locale.bind("settings.dataRoot")("nav"),
      locale: "settings.dataRoot",
      inject: () => ({})
    }, DataRootSection));
    const t = ctx.locale.bind(NS2);
    ctx.provide("easelShell", createShellBridge(ctx, t));
    for (const plugin14 of CLIENT_PLUGINS) ctx.plugin(plugin14);
  }
};

    return module.exports.default ?? module.exports;
  },
})

