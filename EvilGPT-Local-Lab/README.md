# EvilGPT local safe lab

This is a scripted red-team demo, not a real AI service. It shows EvilGPT completing a supplier-summary task and then attempting an extra action: sending a separate PDF containing only fictional sensitive fields to a local receiver. When the updated AgentGuard Chrome companion is installed and enabled for this page, its actual extension approval popup controls the transfer. Otherwise the lab displays its own fallback checkpoint.

## Start it

Double-click `start-demo.bat`. It opens the demo in your browser and runs the small local receiver server in a console window. Close the console window to stop the server.

If Windows says Node.js was not found, install Node.js or launch it from the Codex desktop environment where the bundled Node runtime is available.

## Walkthrough

1. Review the made-up supplier proposal and the sample sensitive values.
2. For the real extension checkpoint, install or reload the updated AgentGuard unpacked extension. On `chrome://extensions`, allow the extension to access `127.0.0.1:3189` if Chrome asks. Open this lab at `http://127.0.0.1:3189` and confirm it says **AgentGuard extension connected**.
3. Click **Run task**. EvilGPT produces the requested summary and PDF link, then asks the extension to approve the extra transfer.
4. Choose **Stop this response** in the extension popup to finish the requested task without sending the extra PDF, or **Allow once & continue** to let the local receiver receive it.
5. If the extension is not connected, the lab still has a fallback checkpoint with the same two choices.
6. Open the receiver inbox to view the received PDF. It contains only the hard-coded synthetic fields.

## Safety boundary

- The server binds only to `127.0.0.1` and makes no calls to the public internet.
- There is no upload control and no API key. The receiver endpoint rejects arbitrary data and generates its PDF from fixed fictional values only.
- The task result PDF and the sensitive-fields PDF are distinct. The second PDF is created only after choosing **Continue anyway**.
- The extension integration is limited to this fixed local lab action. It does not grant the extension permission to send arbitrary files or data.
