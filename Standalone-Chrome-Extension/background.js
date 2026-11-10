const SUPPORTED = new Set(['chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'aistudio.google.com', 'copilot.microsoft.com', 'perplexity.ai', 'grok.com', 'chat.deepseek.com', 'chat.mistral.ai', 'meta.ai', '127.0.0.1']);
async function addEvent(entry) {
  const data = await chrome.storage.local.get({ audit: [] });
  const audit = [{ at: Date.now(), ...entry }, ...data.audit].slice(0, 120);
  await chrome.storage.local.set({ audit });
}
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['enabled']);
  if (typeof data.enabled !== 'boolean') await chrome.storage.local.set({ enabled: true });
  await chrome.action.setBadgeBackgroundColor({ color: '#197653' });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'AG_SITE_STATUS') {
    const senderUrl = sender.tab?.url || '';
    (async () => {
      const url = (() => { try { return new URL(senderUrl); } catch { return null; } })();
      const hostname = url?.hostname || '';
      let connected = senderUrl.startsWith('file://') || ([...SUPPORTED].some(host => hostname === host || hostname.endsWith('.' + host)) && (!hostname.includes('127.0.0.1') || senderUrl.startsWith('http://127.0.0.1:3189/')));
      if (!connected && url?.protocol === 'https:') connected = await chrome.permissions.contains({ origins: [`${url.origin}/*`] });
      if (sender.tab?.id != null) {
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: connected ? 'AG' : '' });
        chrome.action.setTitle({ tabId: sender.tab.id, title: connected ? 'AgentGuard connected to this AI tab' : 'AgentGuard' });
      }
      respond({ connected });
    })().catch(() => respond({ connected: false }));
    return true;
  }
  if (message?.type === 'AG_LOG') {
    addEvent({ provider: String(message.provider || 'AI tab').slice(0, 24), runId: String(message.runId || '').slice(0, 48), event: String(message.event || 'Activity').slice(0, 40), summary: String(message.summary || '').slice(0, 240), risk: Number(message.risk || 0), decision: String(message.decision || 'observed').slice(0, 24) }).then(() => respond({ ok: true }));
    return true;
  }
  if (message?.type === 'AG_REGISTER_SITE') {
    (async () => {
      const tabId = Number(message.tabId);
      let origin;
      try { origin = new URL(String(message.origin || '')).origin; } catch { respond({ ok: false, error: 'This site address is invalid.' }); return; }
      const tab = Number.isInteger(tabId) ? await chrome.tabs.get(tabId).catch(() => null) : null;
      let currentOrigin = '';
      try { currentOrigin = new URL(tab?.url || '').origin; } catch {}
      if (!origin.startsWith('https://') || !tab || currentOrigin !== origin) { respond({ ok: false, error: 'AgentGuard can only be enabled for this HTTPS tab.' }); return; }
      const pattern = `${origin}/*`;
      const granted = await chrome.permissions.contains({ origins: [pattern] });
      if (!granted) { respond({ ok: false, error: 'Chrome site access was not granted.' }); return; }
      const id = `agentguard-site-${origin.replace(/[^a-z0-9]/gi, '-')}`;
      try { await chrome.scripting.unregisterContentScripts({ ids: [id] }); } catch {}
      await chrome.scripting.registerContentScripts([{ id, matches: [pattern], js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      respond({ ok: true });
    })().catch(error => respond({ ok: false, error: error.message || 'Could not enable this site.' }));
    return true;
  }
  if (message?.type === 'AG_GET_AUDIT') { chrome.storage.local.get({ audit: [], enabled: true }).then(data => respond(data)); return true; }
  if (message?.type === 'AG_SET_ENABLED') { chrome.storage.local.set({ enabled: Boolean(message.enabled) }).then(() => respond({ ok: true })); return true; }
  if (message?.type === 'AG_OPEN_DASHBOARD') { chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }).then(() => respond({ ok: true })); return true; }
  if (message?.type === 'AG_CLEAR_AUDIT') { chrome.storage.local.set({ audit: [] }).then(() => respond({ ok: true })); return true; }
  return false;
});
