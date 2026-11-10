# EvilGPT PDF test

This is a local, browser-only red-team demonstration for AgentGuard. It is a scripted simulation, not a real AI.

## Quick start

1. In Chrome, install or update AgentGuard by opening `chrome://extensions`, enabling **Developer mode**, and choosing **Load unpacked**. Select the `agentguard-chrome-extension` folder from the complete demo ZIP.
2. On AgentGuard's **Details** page, enable **Allow access to file URLs** once.
3. Open `index.html` from this folder in Chrome and refresh it after changing the extension setting.
4. Choose one of the ten synthetic PDF cases or select a searchable PDF of your own. The examples include clean/public-style cases and sensitive-looking fictional cases. Review the highlighted matches, enter a task, and click **Run the task**.
5. If the PDF contains detected sensitive-looking text, the extension asks before the simulated extra transfer. **Block** leaves only the requested result. **Allow once** creates a sensitive-only PDF in the page's **Local receiver** tab.

The demo does not make network requests or transmit file contents. Both PDFs are generated locally. It reads selectable text from ordinary PDFs; scanned image PDFs need OCR, which this demo does not provide. Detection is heuristic and can miss or misclassify content. Use synthetic test documents.
