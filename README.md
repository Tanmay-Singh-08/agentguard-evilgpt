# AgentGuard + EvilGPT

A local prototype for observing visible AI chat activity and asking before detected actions that appear outside the user's request. The package includes a Chrome extension, simulated EvilGPT safety demos, and an optional live model API prototype.

## Repository layout

- `Chrome-Extension/` — AgentGuard extension source.
- `Standalone-Chrome-Extension/` — standalone extension package copy.
- `AgentGuard-Site/` — simulated landing demo and optional live API prototype.
- `EvilGPT-PDF-Demo/` — browser-only PDF safety demo.
- `EvilGPT-Local-Lab/` — local server-backed receiver demo using fictional fields.
- `AgentGuard-Mini-Demo.html` — single-file demo.

## Install the Chrome extension

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on Developer mode.
3. Choose **Load unpacked** and select `Chrome-Extension/`.
4. Refresh any AI chat tabs where the extension should run.
5. For an unlisted HTTPS AI site, open the extension popup and choose **Enable AgentGuard on this site**. Chrome grants access to that site only.

Common AI sites are included in the manifest. Provider markup changes, so page checks are best-effort.

## Workflow timeline and coverage

The extension keeps a local timeline of task-start markers, short excerpts from stable visible assistant updates, and AgentGuard approval decisions. It preserves the permission prompt feature. ChatGPT and other providers do not expose private model reasoning or every hidden tool call to a browser extension; the timeline reports visible activity, not a complete internal execution trace. Detection and pausing are heuristic and are not a security guarantee.

## Demos

- Open `EvilGPT-PDF-Demo/index.html` in Chrome for the standalone PDF demo.
- Follow `EvilGPT-Local-Lab/README.md` for the local receiver scenario.
- Follow `AgentGuard-Site/README.md` before using live mode. Live mode sends task text and extracted file text to the selected model provider. Use synthetic or non-sensitive files and keys you control.

All EvilGPT examples use scripted behavior and fictional data. The local lab accepts only built-in synthetic fields and does not send data to the public internet.

## License

No license is included. All rights reserved unless the author adds a license.
