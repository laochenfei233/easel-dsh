// Publish-draft persistence only. The rest of Easel's store (chat sessions,
// pending turns) belongs to the chat surface that dsh's conversation replaces,
// so it is deliberately not carried over.

export interface PublishDraft {
  title: string;
  body: string;
  platforms: string[];
  overrides: Record<string, string>;
  tags: string;   // 话题标签，逗号分隔（小红书绑话题；其它平台按需写入）
}
const PUBLISH_KEY = 'easel_publish_draft';
const PREVIOUS_BRAND = ['post', 'craft'].join('');

function readMigratedLocalValue(key: string, suffix: string): string | null {
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

const PUBLISH_DEFAULT: PublishDraft = {
  title: '', body: '', platforms: ['xiaohongshu', 'douyin'], overrides: {}, tags: '',
};
export function loadPublishDraft(): PublishDraft {
  try {
    const raw = readMigratedLocalValue(PUBLISH_KEY, 'publish_draft');
    if (!raw) return { ...PUBLISH_DEFAULT };
    return { ...PUBLISH_DEFAULT, ...(JSON.parse(raw) as PublishDraft) };
  } catch {
    return { ...PUBLISH_DEFAULT };
  }
}
export function savePublishDraft(d: PublishDraft): void {
  try { localStorage.setItem(PUBLISH_KEY, JSON.stringify(d)); } catch { /* quota */ }
}
