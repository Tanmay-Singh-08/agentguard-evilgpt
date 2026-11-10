# AgentGuard local Chrome companion

This is a strict local prototype for the hackathon demo. It adds an AgentGuard badge to supported AI chat sites, lets you insert synthetic example prompts/files, and asks before a broad range of visible action statements, scripted clicks on risky controls, and unexpected outside links. ChatGPT, Claude, Gemini, Google AI Studio, Copilot, Perplexity, Grok, DeepSeek, Mistral Le Chat, and Meta AI are included. For another HTTPS AI site, open the AgentGuard toolbar popup and choose **Enable AgentGuard on this site**. Chrome will grant access to that site only; you can remove it from the extension’s site access settings. It also connects to the EvilGPT demos for a simulated sensitive-data transfer. The dashboard keeps a local workflow timeline.

## Install in Chrome

1. Extract this project folder if you downloaded a ZIP.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the `agentguard-chrome-extension` folder (the folder containing `manifest.json`).
5. Pin AgentGuard from Chrome's Extensions menu.
6. Open a supported AI chat site. Refresh it once if it was already open. On other HTTPS AI chat sites, open the AgentGuard toolbar popup and enable access for that site.
7. Click the AgentGuard toolbar icon, choose a sample, and click **Insert example prompt + files**. Review the text and attachments, then press Send yourself. The shield inside the AI page opens the activity dashboard.
8. Open the EvilGPT PDF demo at `EvilGPT-PDF-Demo/index.html` in Chrome. On the AgentGuard extension's **Details** page turn on **Allow access to file URLs**, then reload the demo. Select a searchable PDF with sensitive-looking text and run the task. The extension's approval popup should appear before the sensitive-only PDF is created. The local server lab is in `EvilGPT-Local-Lab/`.

## Safety and scope

- The bundled examples are synthetic. The extension does not ask for API keys and does not access files from your computer.
- The workflow timeline uses Chrome local extension storage. It records task-start markers, short excerpts (up to 220 characters) from stable visible assistant updates, and AgentGuard decisions. It does not store the full prompt or file contents. Clear the history from the dashboard at any time.
- The timeline shows page-visible steps in order. ChatGPT and Claude do not expose private reasoning or every hidden tool action to this extension, so it is not a complete internal trace.
- AgentGuard requests access only to the current HTTPS site when you enable an unlisted service. It does not ask for access to every website.
- This prototype scans text and links visible on the page and intercepts some scripted clicks. A low risk score still triggers an approval prompt when an action appears outside the request. Page markup and provider behavior can change, so this is best effort; it cannot guarantee interception of hidden provider-side actions, browser actions performed outside the page, or actions completed before text becomes visible. This is not a guarantee that every tiny semantic deviation will be detected.
- “Allow once” records a one-time approval for the detected item. For a text-based alert, if generation remains paused, use the provider page’s own Continue control; AgentGuard does not type or send approval text. “Stop” leaves that response stopped. You press Send for the initial request.
- Each AI provider controls its own website; this prototype is not an official integration and does not control provider infrastructure.
- EvilGPT is a scripted local demo. Its page sends a permission request to the extension; Allow creates a sensitive-only PDF in the page's local receiver tab, while Block prevents that PDF from being created. The page makes no network upload.
- File URL access is a user-controlled Chrome setting required for extensions to run on a `file://` page.

The dashboard is available from the toolbar popup or the in-page AgentGuard shield.
