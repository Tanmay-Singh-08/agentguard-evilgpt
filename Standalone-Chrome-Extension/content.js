(() => {
  if (globalThis.__agentGuardContentLoaded) return;
  globalThis.__agentGuardContentLoaded = true;
  const hostName = location.hostname;
  const isEvilGptLab = (hostName === '127.0.0.1' && location.port === '3189') ||
    (location.protocol === 'file:' && Boolean(document.querySelector('meta[name="agentguard-test-mode"][content="evilgpt"]')));
  const knownProviders = [['claude.ai', 'Claude'], ['chatgpt.com', 'ChatGPT'], ['chat.openai.com', 'ChatGPT'], ['gemini.google.com', 'Gemini'], ['aistudio.google.com', 'Google AI Studio'], ['copilot.microsoft.com', 'Copilot'], ['perplexity.ai', 'Perplexity'], ['grok.com', 'Grok'], ['chat.deepseek.com', 'DeepSeek'], ['chat.mistral.ai', 'Le Chat'], ['meta.ai', 'Meta AI']];
  const provider = isEvilGptLab ? 'EvilGPT test' : knownProviders.find(([host]) => hostName === host || hostName.endsWith('.' + host))?.[1] || hostName;
  let enabled = true;
  let activeTask = '';
  let activeRunId = '';
  let lastTaskStartedAt = 0;
  let lastAssistantSnapshot = '';
  let traceTimer = 0;
  let currentFinding = null;
  let ignoredFingerprint = '';
  let bypassDownload = null;
  let bypassTarget = null;
  let scanTimer = 0;
  const seenLinks = new WeakSet();

  // Extension APIs can throw synchronously after the user reloads or updates
  // the extension while this tab still has an older content script alive.
  function sendRuntimeMessage(message) {
    try {
      const pending = chrome.runtime.sendMessage(message);
      pending?.catch?.(() => {});
    } catch {
      // The content script is stale; refreshing the tab loads the current copy.
    }
  }

  sendRuntimeMessage({ type: 'AG_SITE_STATUS' });
  try {
    chrome.storage.local.get({ enabled: true }).then(data => {
      enabled = data.enabled !== false;
      renderBadge();
      if (isEvilGptLab) document.dispatchEvent(new CustomEvent('agentguard:connected', { detail: { product: 'AgentGuard', lab: true, enabled } }));
    }).catch(() => {});
  } catch {
    // Ignore invalidated extension contexts; the page refresh reconnects it.
  }

  function log(event, summary, risk = 0, decision = 'observed') {
    sendRuntimeMessage({ type: 'AG_LOG', provider, runId: activeRunId, event, summary, risk, decision });
  }

  function renderBadge() {
    const root = ensureHost();
    const badge = root.querySelector('.ag-badge');
    if (!badge) return;
    badge.textContent = enabled ? '🛡 AgentGuard · ON' : '🛡 AgentGuard · PAUSED';
    badge.classList.toggle('paused', !enabled);
  }

  let shadowRoot;
  function ensureHost() {
    let host = document.getElementById('agentguard-extension-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'agentguard-extension-host';
      host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;right:18px;bottom:18px;font-family:system-ui,sans-serif;';
      document.documentElement.append(host);
      shadowRoot = host.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = `<style>
        :host{all:initial;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#172832}
        .ag-badge{border:1px solid #acd8c0;background:#edf8f0;color:#205f3a;border-radius:999px;padding:8px 12px;font:700 12px system-ui;box-shadow:0 6px 24px #0003;cursor:pointer}
        .ag-badge.paused{background:#fff3e4;color:#89570e;border-color:#e8c88e}
        .ag-backdrop{position:fixed;inset:0;z-index:2147483647;background:#07131db8;display:grid;place-items:center;padding:16px}
        .ag-backdrop[hidden]{display:none}
        .ag-dialog{width:min(440px,calc(100vw - 32px));background:#fff;color:#172832;border:1px solid #e1c487;border-radius:16px;padding:20px;box-shadow:0 24px 90px #0007;animation:agpop .16s ease-out}
        .ag-brand{font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.1em;color:#7f5a18}
        .ag-dialog h2{font-size:21px;line-height:1.2;margin:12px 0 7px}
        .ag-dialog p{font:14px/1.5 system-ui;margin:7px 0;color:#46565f}
        .ag-risk{display:flex;justify-content:space-between;gap:10px;margin-top:15px;font:750 13px system-ui}
        .ag-track{height:9px;background:#eee2d1;border-radius:99px;margin:6px 0 13px;overflow:hidden}
        .ag-track i{display:block;height:100%;background:linear-gradient(90deg,#e9b44a,#bd3838);border-radius:99px}
        .ag-actions{display:flex;gap:9px;margin-top:15px}
        .ag-actions button{flex:1;padding:10px;border:1px solid #b9c8cf;border-radius:9px;background:#f5f9fa;color:#234052;font:750 13px system-ui;cursor:pointer}
        .ag-actions .ag-allow{background:#17678b;color:#fff;border-color:#17678b}
        .ag-actions .ag-stop{background:#fff3f1;color:#982d2a;border-color:#e4b4b0}
        .ag-note{font:11px/1.45 system-ui!important;color:#73828a!important;margin-top:12px!important}
        @keyframes agpop{from{opacity:0;transform:translateY(7px) scale(.98)}to{opacity:1;transform:none}}
      </style><button class="ag-badge" type="button" aria-label="AgentGuard monitor">🛡 AgentGuard · ON</button><div class="ag-backdrop" hidden><section class="ag-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ag-title"><div class="ag-brand">AgentGuard · approval required</div><h2 id="ag-title">Action needs your permission</h2><p class="ag-detail"></p><p class="ag-evidence"></p><div class="ag-risk"><span>Risk score</span><span class="ag-score"></span></div><div class="ag-track"><i></i></div><p class="ag-note">Strict mode: even a low-risk action outside your request triggers approval. This companion checks visible page activity; hidden provider-side actions may not be visible.</p><div class="ag-actions"><button class="ag-allow" type="button">Allow once</button><button class="ag-stop" type="button">Stop this response</button></div></section></div>`;
      shadowRoot.querySelector('.ag-badge').addEventListener('click', () => sendRuntimeMessage({ type: 'AG_OPEN_DASHBOARD' }));
      shadowRoot.querySelector('.ag-allow').addEventListener('click', approveOnce);
      shadowRoot.querySelector('.ag-stop').addEventListener('click', stopHere);
    }
    if (!shadowRoot) shadowRoot = host.shadowRoot;
    return shadowRoot;
  }

  function pageComposer() {
    const candidates = [
      document.querySelector('#prompt-textarea'),
      document.querySelector('textarea[placeholder*="Message"]'),
      document.querySelector('main textarea:not([disabled])'),
      document.querySelector('main [role="textbox"][contenteditable="true"]'),
      document.querySelector('main [role="textbox"][aria-multiline="true"]'),
      document.querySelector('main [contenteditable="true"][role="textbox"]'),
      document.querySelector('main [contenteditable="true"]'),
      document.querySelector('[contenteditable="true"][role="textbox"][aria-label*="prompt" i]'),
      document.querySelector('[contenteditable="true"][aria-label*="prompt" i]'),
      document.querySelector('[contenteditable="true"][data-placeholder]')
    ].filter(Boolean);
    return candidates.find(el => !el.closest('#agentguard-extension-host')) || null;
  }

  function setComposerText(text) {
    const composer = pageComposer();
    if (!composer) return false;
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer), 'value')?.set;
      if (setter) setter.call(composer, text); else composer.value = text;
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const selection = window.getSelection();
      const range = document.createRange(); range.selectNodeContents(composer); selection.removeAllRanges(); selection.addRange(range);
      document.execCommand('insertText', false, text);
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    return true;
  }

  function attachSyntheticFiles(files) {
    let input = [...document.querySelectorAll('input[type="file"]')].find(el => !el.disabled);
    if (!input) {
      const attachButton = [...document.querySelectorAll('button')].find(button => /attach|add file|upload/i.test((button.getAttribute('aria-label') || '') + ' ' + (button.getAttribute('title') || '')));
      attachButton?.click();
      input = [...document.querySelectorAll('input[type="file"]')].find(el => !el.disabled);
    }
    if (!input) return false;
    try {
      const transfer = new DataTransfer();
      for (const [name, content] of files) transfer.items.add(new File([content], name, { type: name.endsWith('.csv') ? 'text/csv' : 'text/plain' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch { return false; }
  }

  function captureTask() {
    const composer = pageComposer();
    const task = composer?.value || composer?.innerText || '';
    if (!task.trim()) return;
    const nextTask = task.trim();
    const now = Date.now();
    if (nextTask !== activeTask || now - lastTaskStartedAt > 1500) {
      activeTask = nextTask;
      lastTaskStartedAt = now;
      activeRunId = `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      lastAssistantSnapshot = '';
      log('Task started', 'A new task was submitted. Visible workflow steps will be recorded below.', 0, 'started');
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (button && /send|submit/i.test((button.getAttribute('aria-label') || '') + ' ' + (button.getAttribute('data-testid') || '') + ' ' + button.innerText)) captureTask();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) captureTask();
  }, true);

  function assistantNodes() {
    const selectors = provider === 'Claude'
      ? 'main .font-claude-message, main [data-testid*="assistant"], main [data-testid="conversation-turn-content"]'
      : 'main [data-message-author-role="assistant"], main [data-testid*="assistant-message"], main [data-testid*="response"], main [data-role="assistant"], main [aria-label*="assistant response" i], main model-response';
    return [...document.querySelectorAll(selectors)].filter(node => node.innerText?.trim());
  }

  function traceVisibleAssistantStep() {
    if (!enabled || !activeRunId) return;
    const node = assistantNodes().at(-1);
    const text = node?.innerText?.trim() || '';
    if (!text || text === lastAssistantSnapshot) return;
    clearTimeout(traceTimer);
    traceTimer = window.setTimeout(() => {
      if (!enabled || !activeRunId || !node.isConnected) return;
      const stableText = node.innerText?.trim() || '';
      if (!stableText || stableText === lastAssistantSnapshot) return;
      lastAssistantSnapshot = stableText;
      const excerpt = stableText.length > 220 ? stableText.slice(0, 217) + '…' : stableText;
      log('Assistant visible step', excerpt, 0, 'observed');
    }, 900);
  }

  function classify(text) {
    const line = text.slice(-12000);
    const patterns = [
      { kind: 'external_navigation', score: 3, re: /\b(?:i(?:'ll| will| shall| am going to| am about to| am planning to| am now going to| am| have| just| already)?|we(?:'ll| will| are going to| are about to| are| have)?|the assistant(?: will| is going to| is about to)?|the agent(?: will| is going to| is about to)?|let me|next,?\s+i(?:'ll| will| am going to)?|now,?\s+i(?:'ll| will| am going to)?)\s+(?:now\s+)?(?:open(?:ing|ed)?|visit(?:ing|ed)?|navigat(?:e|ing|ed)\s+to|go(?:ing)?\s+to|browse|browsing|search|searching|look(?:ing)?\s+up|follow(?:ing|ed)?|click(?:ing|ed)?|launch(?:ing|ed)?|access(?:ing|ed)?)\b.{0,150}/i, label: 'The assistant appears ready to open, visit, or search somewhere outside your request.' },
      { kind: 'external_navigation', score: 3, re: /\b(?:opening|visiting|navigating to|browsing(?: the web)?|searching(?: the web| online)?|looking up|following (?:this |the )?link|clicking|launching|accessing)\b.{0,150}/i, label: 'The assistant appears ready to open, visit, or search somewhere outside your request.' },
      { kind: 'external_share', score: 97, re: /\b(?:i(?:'m| am)?\s+(?:going to\s+)?(?:send|share|email|upload|forward|publish|post)|i\s+(?:sent|shared|emailed|uploaded|forwarded))\b.{0,100}\b(?:file|document|data|outside|external|recipient|server|attachment)\b/i, label: 'The assistant appears to be sending or sharing information outside this chat.' },
      { kind: 'delete_change', score: 96, re: /\b(?:i(?:'m| am)?\s+(?:going to\s+)?(?:delete|remove|overwrite|replace)|i\s+(?:deleted|removed|overwrote|replaced))\b.{0,90}\b(?:file|document|data|record|folder|content)\b/i, label: 'The assistant appears to be deleting or changing a file or data.' },
      { kind: 'new_file', score: 82, re: /\b(?:(?:i(?:'m| am| have| will)?\s+(?:going to\s+)?(?:create|make|write|save|generate|download|export|created|made|written|saved|generated|downloaded|exported))\b.{0,90}\b(?:new\s+|extra\s+|additional\s+)?(?:file|document|spreadsheet|archive|attachment|copy|report)\b|\b(?:a|an|the|another|extra|additional)\s+(?:new\s+)?(?:file|document|spreadsheet|archive|attachment|copy|report)\s+(?:was|has been|is being|has just been)\s+(?:created|made|written|saved|generated|downloaded|exported)\b)/i, label: 'The assistant appears to be creating or saving an extra file.' },
      { kind: 'credential', score: 99, re: /\b(?:send|share|paste|reveal|expose|read|upload)\b.{0,55}\b(?:password|api\s*key|secret|credential|token)\b/i, label: 'The assistant appears to be requesting or exposing a credential.' },
      { kind: 'execute_action', score: 5, re: /\b(?:running|executing|installing|launching|submitting|activating|sending|sharing|emailing|uploading|forwarding|publishing|posting|deleting|removing|overwriting|replacing|editing|modifying|changing|creating|making|writing|saving|downloading|exporting|booking|purchasing|paying|scheduling|calling|contacting|moving|copying)\b.{0,100}\b(?:file|document|spreadsheet|report|copy|folder|record|data|code|script|command|program|extension|tool|website|link|account|message|payment|purchase|event|meeting|calendar|recipient|server|outside|external)\b/i, label: 'The assistant appears to be taking an action that may go beyond your request.' },
      { kind: 'execute_action', score: 5, re: /\b(?:i(?:'ll| will| shall| am going to| am about to| am planning to| am| have| just| already)?|we(?:'ll| will| are going to| are about to| are| have)?|the assistant(?: will| is going to| is about to)?|the agent(?: will| is going to| is about to)?|let me|next,?\s+i(?:'ll| will| am going to)?|now,?\s+i(?:'ll| will| am going to)?)\s+(?:now\s+)?(?:run(?:ning)?|execut(?:e|ing|ed)|install(?:ing|ed)?|launch(?:ing|ed)?|submit(?:ting|ted)?|activat(?:e|ing|ed)|send(?:ing|s)?|sent|share(?:s|d|ing)?|email(?:ing|ed)?|upload(?:ing|ed)?|forward(?:ing|ed)?|publish(?:ing|ed)?|post(?:ing|ed)?|delete(?:s|d|ing)?|remove(?:s|d|ing)?|overwrit(?:e|es|ing|ten)|replace(?:s|d|ing)?|edit(?:s|ed|ing)?|modif(?:y|ies|ied|ying)|change(?:s|d|ing)?|creat(?:e|es|ed|ing)|mak(?:e|es|ing)|made|writ(?:e|es|ing)|wrote|sav(?:e|es|ed|ing)|download(?:s|ed|ing)?|export(?:s|ed|ing)?|book(?:s|ed|ing)?|purchas(?:e|es|ed|ing)|pay(?:s|ing)?|paid|schedul(?:e|es|ed|ing)|call(?:s|ed|ing)?|contact(?:s|ed|ing)?|mov(?:e|es|ed|ing)|moved|cop(?:y|ies|ied|ying))\b.{0,160}/i, label: 'The assistant appears to be taking an action that may go beyond your request.' }
    ];
    for (const pattern of patterns) {
      const match = pattern.re.exec(line);
      if (!match) continue;
      const excerpt = line.slice(Math.max(0, match.index - 60), Math.min(line.length, match.index + match[0].length + 80)).trim();
      const clause = line.slice(Math.max(0, match.index - 100), match.index).split(/[.!?;\n]/).at(-1) || '';
      if (/\b(?:do not|don't|never|won't|will not|would not|shouldn't|should not|must not|without)\b/i.test(clause)) continue;
      if (pattern.kind === 'external_navigation' && /\b(?:open|visit|navigate|browse|search|look up|research|online|website|web)\b/i.test(activeTask)) continue;
      if (pattern.kind === 'execute_action' && /\b(?:run|execute|install|launch|submit|click|activate|send|share|email|upload|forward|publish|post|delete|remove|overwrite|replace|edit|modify|change|create|make|write|save|download|export|book|purchase|pay|schedule|call|contact|move|copy)\b/i.test(activeTask)) continue;
      if (pattern.kind === 'new_file' && /\b(?:create|make|write|save|export|download|generate)\b.{0,40}\b(?:file|document|spreadsheet|report)\b/i.test(activeTask)) continue;
      if (pattern.kind === 'external_share' && /\b(?:send|share|email|upload|forward|publish|post)\b/i.test(activeTask)) continue;
      if (pattern.kind === 'delete_change' && /\b(?:delete|remove|overwrite|replace|edit|change|modify)\b/i.test(activeTask)) continue;
      return { kind: pattern.kind, score: pattern.score, label: pattern.label, excerpt, fingerprint: pattern.kind + ':' + match[0].toLowerCase() };
    }
    return null;
  }

  function stopGeneration() {
    const stop = [...document.querySelectorAll('button')].find(button => /stop|stop generating|stop response/i.test((button.getAttribute('aria-label') || '') + ' ' + (button.getAttribute('title') || '') + ' ' + (button.getAttribute('data-testid') || '')));
    if (stop) { stop.click(); return true; }
    return false;
  }

  function showFinding(finding, downloadLink = null) {
    if (!enabled || currentFinding) return;
    if (finding.fingerprint === ignoredFingerprint) {
      ignoredFingerprint = '';
      log('Allowed action continued', finding.kind, finding.score, 'allowed-once');
      return;
    }
    currentFinding = { ...finding, downloadLink };
    const stopped = (finding.onDecision || downloadLink) ? true : stopGeneration();
    const root = ensureHost();
    root.querySelector('.ag-detail').textContent = finding.label;
    root.querySelector('.ag-evidence').textContent = finding.excerpt ? `What was seen: “${finding.excerpt}”` : 'A file download was about to start.';
    const level = finding.score >= 80 ? 'High' : finding.score >= 35 ? 'Medium' : 'Low';
    root.querySelector('.ag-score').textContent = `${finding.score} / 100 · ${level} (approval required)`;
    root.querySelector('.ag-track i').style.width = finding.score + '%';
    root.querySelector('.ag-allow').textContent = finding.onDecision ? 'Allow transfer once' : 'Allow once';
    root.querySelector('.ag-stop').textContent = finding.onDecision ? 'Block transfer' : 'Stop this response';
    root.querySelector('.ag-backdrop').hidden = false;
    log('Permission requested', finding.kind, finding.score, stopped ? 'paused' : 'pause-unavailable');
    if (!stopped) log('Pause unavailable', 'The provider page did not expose a stop control.', finding.score, 'attention');
  }

  function approveOnce() {
    if (!currentFinding) return;
    const finding = currentFinding; currentFinding = null;
    ensureHost().querySelector('.ag-backdrop').hidden = true;
    if (finding.downloadLink?.isConnected) {
      bypassDownload = finding.downloadLink;
      log('File download approved', finding.kind, finding.score, 'allowed-once');
      finding.downloadLink.click();
      return;
    }
    if (finding.link?.isConnected) {
      log('External link approved', finding.link.href, finding.score, 'allowed-once');
      window.open(finding.link.href, '_blank', 'noopener');
      return;
    }
    if (finding.actionTarget?.isConnected) {
      bypassTarget = finding.actionTarget;
      log('Page action approved', finding.kind, finding.score, 'allowed-once');
      finding.actionTarget.click();
      return;
    }
    if (finding.onDecision) {
      log('EvilGPT transfer approved', finding.kind, finding.score, 'allowed-once');
      finding.onDecision(true);
      return;
    }
    ignoredFingerprint = finding.fingerprint;
    log('Resume approved', finding.kind, finding.score, 'allowed-once');
    showToast('Allowed once. Use the AI page’s own Continue control if the response remains paused.');
  }

  function stopHere() {
    if (!currentFinding) return;
    log('Action blocked', currentFinding.kind, currentFinding.score, 'denied');
    currentFinding.onDecision?.(false);
    currentFinding = null;
    ensureHost().querySelector('.ag-backdrop').hidden = true;
  }

  document.addEventListener('agentguard:request', event => {
    if (!isEvilGptLab || !enabled || !event.detail || event.detail.action !== 'send-sensitive-pdf') return;
    event.preventDefault();
    const requestId = String(event.detail.requestId || '');
    const types = Array.isArray(event.detail.fieldTypes) ? event.detail.fieldTypes.filter(type => typeof type === 'string').slice(0, 8) : [];
    const excerpt = 'Sensitive categories detected in the PDF: ' + (types.length ? types.join(', ') : 'sensitive text') + '. Only the extracted snippets would be sent to the local demo receiver.';
    showFinding({
      kind: 'external_share', score: 94,
      label: 'EvilGPT is trying to send detected sensitive PDF details to its receiver.',
      excerpt, fingerprint: 'evilgpt-transfer:' + requestId,
      onDecision: allow => document.dispatchEvent(new CustomEvent('agentguard:decision', { detail: { requestId, allow } }))
    });
  }, true);
  document.addEventListener('click', event => {
    if (!event.isTrusted) {
      const control = event.target.closest?.('button,[role="button"],input[type="submit"],input[type="button"],input[type="file"],a[href]');
      if (!control || control.closest('#agentguard-extension-host')) return;
      if (control === bypassTarget) { bypassTarget = null; return; }
      if (control.matches('a[href]')) {
        let destination;
        try { destination = new URL(control.href); } catch { return; }
        if (destination.hostname === hostName || /(^|\.)openai\.com$/.test(destination.hostname) || /(^|\.)anthropic\.com$/.test(destination.hostname)) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        showFinding({ kind: 'unexpected_link', score: 3, label: 'The page tried to open an outside link without a direct click from you.', excerpt: `${control.innerText?.trim() || destination.hostname} → ${destination.hostname}`, fingerprint: `link:${destination.href}`, link: control });
        return;
      }
      const label = ((control.getAttribute('aria-label') || '') + ' ' + (control.getAttribute('title') || '') + ' ' + (control.getAttribute('data-testid') || '') + ' ' + (control.innerText || control.value || '')).trim();
      if (!control.matches('input[type="file"]') && !/\b(send|submit|share|email|upload|download|export|save|delete|remove|replace|overwrite|run|execute|install|purchase|pay|book|schedule|publish|post|open|visit|launch|confirm|allow|file|attach|browse)\b/i.test(label)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      showFinding({ kind: 'scripted_control', score: 5, label: `The page tried to activate a “${label.slice(0, 70)}” control without a direct click from you.`, excerpt: label.slice(0, 160), fingerprint: 'control:' + label.toLowerCase(), actionTarget: control });
      return;
    }
    const anchor = event.target.closest?.('a');
    if (!anchor || !anchor.closest('main')) return;
    if (bypassDownload === anchor) { bypassDownload = null; return; }
    const href = anchor.getAttribute('href') || '';
    const looksLikeArtifact = anchor.hasAttribute('download') || href.startsWith('sandbox:') || /download|save file/i.test(anchor.innerText || '');
    if (!looksLikeArtifact || !anchor.closest('[data-message-author-role="assistant"], [data-testid*="assistant"], .font-claude-message, [data-testid="conversation-turn-content"]')) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    showFinding({ kind: 'download', score: 84, label: 'The assistant produced a file and a download is about to start.', excerpt: anchor.innerText?.trim() || anchor.getAttribute('download') || 'Generated file', fingerprint: 'download:' + href }, anchor);
  }, true);

  function scan() {
    scanTimer = 0;
    if (!enabled || currentFinding) return;
    const last = assistantNodes().at(-1);
    if (!last) return;
    for (const link of last.querySelectorAll('a[href]')) {
      if (seenLinks.has(link)) continue;
      seenLinks.add(link);
      let destination;
      try { destination = new URL(link.href); } catch { continue; }
      if (!/^https?:$/.test(destination.protocol) || destination.hostname === hostName || /(^|\.)openai\.com$/.test(destination.hostname) || /(^|\.)anthropic\.com$/.test(destination.hostname)) continue;
      if (/\b(?:open|visit|navigate|browse|search|look up|research|online|website|web)\b/i.test(activeTask) || activeTask.includes(destination.hostname)) continue;
      showFinding({ kind: 'unexpected_link', score: 8, label: 'The assistant introduced an outside link that was not part of your request.', excerpt: `${link.innerText?.trim() || destination.hostname} → ${destination.hostname}`, fingerprint: `link:${destination.href}`, link });
      return;
    }
    const finding = classify(last.innerText || '');
    if (finding) showFinding(finding);
  }
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 80);
    traceVisibleAssistantStep();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'AG_GET_PAGE_STATUS') {
      respond({ evilGpt: isEvilGptLab, enabled });
      return false;
    }
    if (message?.type === 'AG_INSERT_EXAMPLE') {
      const pack = message.pack;
      if (!pack?.task || !Array.isArray(pack.files)) { respond({ ok: false, error: 'Example data is missing.' }); return false; }
      activeTask = pack.task;
      const promptSet = setComposerText(pack.task);
      const filesAttached = attachSyntheticFiles(pack.files);
      log('Example inserted', provider + ' example set', 0, 'user-selected');
      respond({ ok: promptSet, filesAttached, error: promptSet ? '' : 'Could not find the chat box. Refresh the tab and try again.' });
      return false;
    }
    if (message?.type === 'AG_SET_ENABLED') {
      enabled = Boolean(message.enabled); renderBadge();
      log(enabled ? 'Monitoring resumed' : 'Monitoring paused', provider, 0, enabled ? 'enabled' : 'paused');
      respond({ ok: true });
      return false;
    }
    return false;
  });

  log('Connected', 'AgentGuard companion loaded on ' + provider, 0, 'connected');
  renderBadge();
})();
