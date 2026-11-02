// 账号名册：把注册表账号 + 画像绑定拼成给 agent 的提示词段。
// 注入点：技能推送（SkillDrawer）、发布预检（PublishPage）、拆解选题（BreakdownPage）。
import { fetchAccounts, type AccountItem } from './api';

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  kuaishou: '快手',
  'weixin-channels': '微信视频号',
  zhihu: '知乎',
  bilibili: 'B站',
  douyin: '抖音',
  'wechat-oa': '微信公众号',
};

export interface RosterAccount {
  id: string;
  platform: string;
  name: string;
  persona: string;
}

/** 平台 key → 中文名（未知 key 原样返回）。 */
export const platformLabel = (platform: string): string => PLATFORM_LABELS[platform] ?? platform;

/** 拉账号名册；接口失败按空名册处理（调用方拿到空串就不注入）。 */
export async function fetchRoster(): Promise<RosterAccount[]> {
  const accounts = await fetchAccounts().catch((): AccountItem[] => []);
  return accounts.map(account => ({
    id: account.id,
    platform: account.platform,
    name: account.name,
    persona: account.persona || '',
  }));
}

/** 名册 → 提示词段；空注册表返回空串。 */
export function renderRosterPrompt(accounts: RosterAccount[]): string {
  if (accounts.length === 0) return '';
  const lines = accounts.map(account => {
    const label = platformLabel(account.platform);
    const persona = account.persona ? `，画像「${account.persona}」（profiles/${account.persona}/ 下的六维文件）` : '，未绑定画像';
    return `- ${label}「${account.name}」（账号 id：${account.id}${persona}）`;
  });
  return (
    `\n\n【可用发布账号】\n${lines.join('\n')}\n` +
    `涉及发布/推送时明确目标账号（账号 id 或名字）；用户没指定就先确认，或按画像贴合度给建议后再执行；` +
    `给指定账号写文案时按其画像调整语气与选题。`
  );
}

export async function rosterPrompt(): Promise<string> {
  return renderRosterPrompt(await fetchRoster());
}
