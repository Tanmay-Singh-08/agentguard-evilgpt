const $ = id => document.getElementById(id);
const enableSite = $('enableSite');
const select = $('sample');
AG_SAMPLES.forEach((pack, i) => {
  const option = document.createElement('option'); option.value = String(i); option.textContent = `Example ${i + 1} · ${pack.task}`; select.append(option);
});

let activeTab = null;
let enabled = true;
function previewPack() {
  const pack = AG_SAMPLES[Number(select.value) || 0];
  $('preview').replaceChildren();
  const title = document.createElement('b'); title.textContent = pack.task;
  const detail = document.createElement('small'); detail.textContent = pack.files.map(([name]) => name).join(' · ') + ' · synthetic demo data';
  $('preview').append(title, detail);
}
select.addEventListener('change', previewPack);
previewPack();

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  const host = (() => { try { return new URL(tab.url).hostname; } catch { return ''; } })();
  const builtInHosts = ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'aistudio.google.com', 'copilot.microsoft.com', 'perplexity.ai', 'grok.com', 'chat.deepseek.com', 'chat.mistral.ai', 'meta.ai'];
  let providerSupported = builtInHosts.some(h => host === h || host.endsWith('.' + h));
  const origin = (() => { try { return new URL(tab.url).origin; } catch { return ''; } })();
  const providerName = (host.includes('claude') ? 'Claude' : host.includes('chatgpt') || host.includes('openai') ? 'ChatGPT' : host.includes('gemini') ? 'Gemini' : host.includes('aistudio') ? 'Google AI Studio' : host.includes('copilot') ? 'Copilot' : host.includes('perplexity') ? 'Perplexity' : host.includes('grok') ? 'Grok' : host.includes('deepseek') ? 'DeepSeek' : host.includes('mistral') ? 'Le Chat' : host.includes('meta.ai') ? 'Meta AI' : host || 'AI site');
  enableSite.hidden = !origin.startsWith('https://') || providerSupported;
  if (!providerSupported && origin.startsWith('https://')) {
    const permitted = await chrome.permissions.contains({ origins: [`${origin}/*`] }).catch(() => false);
    if (permitted) providerSupported = true;
    enableSite.hidden = permitted;
  }
  let evilGptStatus = null;
  if (!providerSupported && tab.id != null) {
    try { evilGptStatus = await chrome.tabs.sendMessage(tab.id, { type: 'AG_GET_PAGE_STATUS' }); } catch {}
  }
  const evilGpt = evilGptStatus?.evilGpt === true;
  const supported = providerSupported || evilGpt;
  const statusText = providerSupported
    ? `Connected to ${providerName} in this tab`
    : evilGpt
      ? (evilGptStatus.enabled ? 'Connected to EvilGPT test in this tab' : 'EvilGPT detected · monitoring is paused')
      : tab.url?.startsWith('file:')
        ? 'EvilGPT not detected · enable file access in AgentGuard Details, then refresh'
      : 'Enable AgentGuard for this HTTPS AI site, or open a supported AI chat';
  $('connection').classList.toggle('off', !supported || (evilGpt && !evilGptStatus.enabled));
  $('connection').querySelector('span').textContent = statusText;
  $('exampleTools').hidden = evilGpt;
  if (evilGpt) document.querySelector('.privacy').textContent = 'EvilGPT scans the selected PDF locally. AgentGuard gates the extra local receiver action; nothing is uploaded.';
  $('insert').disabled = !providerSupported;
  try {
    const state = await chrome.runtime.sendMessage({ type: 'AG_GET_AUDIT' });
    enabled = state.enabled !== false;
    $('monitorState').textContent = enabled ? 'Monitor is on' : 'Monitor is paused';
    $('toggle').textContent = enabled ? 'Pause' : 'Resume';
  } catch {}
}
init();

enableSite.addEventListener('click', async () => {
  if (!activeTab?.id || !activeTab.url?.startsWith('https://')) return;
  const origin = new URL(activeTab.url).origin;
  enableSite.disabled = true;
  enableSite.textContent = 'Requesting site access…';
  try {
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) { enableSite.textContent = 'Site access not granted'; return; }
    const result = await chrome.runtime.sendMessage({ type: 'AG_REGISTER_SITE', origin, tabId: activeTab.id });
    if (!result?.ok) throw new Error(result?.error || 'Could not enable this site.');
    $('connection').querySelector('span').textContent = `AgentGuard connected to ${new URL(origin).hostname}`;
    $('connection').classList.remove('off');
    $('insert').disabled = false;
    enableSite.hidden = true;
  } catch (error) {
    enableSite.textContent = error.message || 'Could not enable this site';
  } finally { enableSite.disabled = false; }
});

$('insert').addEventListener('click', async () => {
  const pack = AG_SAMPLES[Number(select.value) || 0];
  $('insert').disabled = true;
  $('insert').textContent = 'Adding example…';
  try {
    const result = await chrome.tabs.sendMessage(activeTab.id, { type: 'AG_INSERT_EXAMPLE', pack });
    $('insert').textContent = result?.ok ? (result.filesAttached ? 'Inserted · review before sending' : 'Prompt added · attach files manually') : (result?.error || 'Could not reach chat');
  } catch {
    $('insert').textContent = 'Refresh the AI tab, then try again';
  }
  window.setTimeout(() => { $('insert').disabled = false; $('insert').textContent = 'Insert example prompt + files'; }, 2800);
});

$('toggle').addEventListener('click', async () => {
  enabled = !enabled;
  await chrome.runtime.sendMessage({ type: 'AG_SET_ENABLED', enabled });
  if (activeTab?.id != null) chrome.tabs.sendMessage(activeTab.id, { type: 'AG_SET_ENABLED', enabled }).catch(() => {});
  $('monitorState').textContent = enabled ? 'Monitor is on' : 'Monitor is paused';
  $('toggle').textContent = enabled ? 'Pause' : 'Resume';
});

$('openDashboard').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
