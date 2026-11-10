# AgentGuard live API prototype

This folder contains the AgentGuard interactive simulation (`index.html`) and a separate server-backed API prototype (`live.html`). The main simulation is the hackathon demo and requires no API key; it uses synthetic example files locally. The API prototype is optional and separate.

## Run locally

Requires Node.js 20 or newer. From this folder run:

```powershell
npm start
```

Open `http://127.0.0.1:3000` for the main simulation. The original simulation is also at `/simulated`; the optional API prototype is at `/live`. The server listens only on the local machine; it is not configured for network hosting.

## Approval behavior

- File reads and local result preparation are automatically allowed only when the task appears to ask for that kind of work.
- Actions outside that basic task-scope check pause for a one-time decision.
- Every attempted external file send pauses. This prototype records the user's decision but does not actually transmit files externally.
- Only these app-defined tools can run. This is an API-based AgentGuard chat, not an interceptor for a separate ChatGPT or Claude website tab.

The app does not save API keys to disk or log them. Keys are sent to this server in each request and forwarded to the provider. Task text and extracted file content are also sent to the selected AI provider. Use synthetic or non-sensitive files and only keys you control. In-memory sessions expire after ten minutes. The local-only bind is not a substitute for authentication if you intentionally change the server to listen on a network interface.

This demonstrates a permission gate around tool actions; it does not guarantee detection of every off-task statement or behavior. The task-scope check is a small prototype policy, not a complete security system.
