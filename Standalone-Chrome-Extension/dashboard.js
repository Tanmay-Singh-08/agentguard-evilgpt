const $ = id => document.getElementById(id);
function request(message) { return chrome.runtime.sendMessage(message); }
async function render() {
  const data = await request({ type: 'AG_GET_AUDIT' });
  $('monitor').textContent = data.enabled === false ? 'Paused' : 'On';
  $('count').textContent = String((data.audit || []).length);
  $('decision').textContent = data.audit?.[0]?.decision || '—';
  const area = $('events'); area.replaceChildren();
  if (!data.audit?.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No activity yet. Open ChatGPT or Claude with the extension installed.'; area.append(empty); return; }
  data.audit.slice().reverse().forEach(item => {
    const row = document.createElement('div'); row.className = 'event';
    const time = document.createElement('time'); time.textContent = new Date(item.at).toLocaleString();
    const provider = document.createElement('span'); provider.className = 'meta'; provider.textContent = item.provider;
    if (item.runId) { const run = document.createElement('span'); run.className = 'meta'; run.textContent = `Run ${item.runId.slice(-5)}`; row.append(time, provider, run); }
    else row.append(time, provider);
    const type = document.createElement('span'); type.className = 'type'; type.textContent = item.event;
    const summary = document.createElement('span'); summary.textContent = item.summary;
    const risk = document.createElement('span'); risk.className = item.risk >= 70 ? 'risk' : 'meta'; risk.textContent = item.risk ? `${item.risk}/100` : item.decision;
    row.append(type, summary, risk); area.append(row);
  });
}
$('refresh').addEventListener('click', render);
$('clear').addEventListener('click', async () => { await request({ type: 'AG_CLEAR_AUDIT' }); render(); });
render();
window.setInterval(render, 2000);
