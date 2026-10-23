// LAN handoff API client: shapes mirror the host's /handoff/* routes.
const BASE = '/easel';

/** One paired or discovered device as the status route reports it. */
export interface HandoffPeer {
  id: string;
  name: string;
  platform: string;
  port?: number;
  addresses?: string[];
  compatible?: boolean;
  pairedAt?: number;
}

/** One pairing waiting for the user's comparison decision. */
export interface HandoffPending {
  id: string;
  sas: string;
  direction: 'dialed' | 'received';
  peer: { id: string; name: string; platform: string };
}

/** Full status projection rendered by the settings item. */
export interface HandoffStatus {
  available: boolean;
  reason?: string;
  device?: { id: string; name: string; port: number; handoffDirectory: string };
  paired: HandoffPeer[];
  discovered: HandoffPeer[];
  pending: HandoffPending[];
  last?: { at: number; ok: boolean; detail: string } | null;
}

/** One registered workspace the user can hand off. */
export interface HandoffWorkspace {
  path: string;
  title: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, { cache: 'no-store', ...options });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = payload && (payload.detail || payload.error) || '';
    } catch {
      /* non-JSON error bodies carry nothing actionable */
    }
    throw new Error(detail || `请求失败（${res.status} ${res.statusText}）`);
  }
  return res.json() as Promise<T>;
}

/** Read the current handoff status. */
export function getHandoffStatus(): Promise<HandoffStatus> {
  return request<HandoffStatus>('/api/handoff/status');
}

/** List the workspaces this device can hand off. */
export function getHandoffWorkspaces(): Promise<{ workspaces: HandoffWorkspace[] }> {
  return request<{ workspaces: HandoffWorkspace[] }>('/api/handoff/workspaces');
}

/** Dial a discovered peer and park the pairing for confirmation. */
export function pairWithPeer(peerId: string): Promise<{ id: string; sas: string; direction: string; peer: HandoffPending['peer'] }> {
  return request('/api/handoff/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ peerId }),
  });
}

/** Confirm one pairing after comparing the six-digit string on both screens. */
export function acceptPairing(id: string): Promise<{ ok: boolean }> {
  return request(`/api/handoff/pair/${encodeURIComponent(id)}/accept`, { method: 'POST' });
}

/** Decline one pairing. */
export function rejectPairing(id: string): Promise<{ ok: boolean }> {
  return request(`/api/handoff/pair/${encodeURIComponent(id)}/reject`, { method: 'POST' });
}

/** Hand one workspace to one paired peer. */
export function sendHandoff(peerId: string, workspacePath: string): Promise<{ ok: boolean; sent: unknown[]; skipped: unknown[] }> {
  return request('/api/handoff/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ peerId, workspacePath }),
  });
}
