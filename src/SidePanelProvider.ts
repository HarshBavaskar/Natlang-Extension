import * as vscode from 'vscode';
import { TranspilerEngine } from './TranspilerEngine';

export class SidePanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly _engine: TranspilerEngine;
  private readonly _extensionUri: vscode.Uri;


  constructor(context: vscode.ExtensionContext, engine: TranspilerEngine) {
    this._engine = engine;
    this._extensionUri = context.extensionUri;
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'insert':
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            editor.edit(editBuilder => {
              editBuilder.insert(editor.selection.active, data.code);
            });
            vscode.window.showInformationMessage('Snippet inserted at cursor.');
          }
          break;
        case 'copy':
          vscode.env.clipboard.writeText(data.code || this._engine.getLastCode());
          vscode.window.showInformationMessage('Copied to clipboard.');
          break;
        case 'save':
          vscode.commands.executeCommand('natlang.saveGenerated');
          break;
        case 'run':
          vscode.commands.executeCommand('natlang.runGenerated');
          break;
        case 'changeLanguage':
          vscode.workspace.getConfiguration('natlang').update('defaultLanguage', data.language, vscode.ConfigurationTarget.Global);
          break;
        case 'changeProvider':
          vscode.workspace.getConfiguration('natlang').update('aiProvider', data.provider, vscode.ConfigurationTarget.Global);
          break;
        case 'toggleDictionary':
          vscode.workspace.getConfiguration('natlang').update('dictionaryMode', data.enabled, vscode.ConfigurationTarget.Global);
          this.postHistory(); // Refresh to apply mode
          break;
        case 'setApiKey':
          vscode.commands.executeCommand('natlang.setApiKey', data.provider);
          break;
        case 'historySelect':
          // Re-trigger history select to update current view
          const history = this._engine.getHistory();
          if (data.index >= 0 && data.index < history.length) {
            this.postDone(history[data.index].code, history[data.index].language);
          }
          break;
      }
    });

    this.postHistory();
    // Re-send after a short delay to ensure webview JS is ready
    setTimeout(() => this.postHistory(), 300);
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const config = vscode.workspace.getConfiguration('natlang');
    const defaultLanguage = config.get('defaultLanguage') as string || 'TypeScript';
    const aiProvider = config.get('aiProvider') as string || 'ollama';

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'panel.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'panel.js'));
    const hljsCss = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default-dark.min.css';
    const hljsJs = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';

    const languages = ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C', 'C++', 'C#', 'Bash', 'PowerShell', 'SQL', 'HTML', 'CSS', 'React JSX', 'Vue'];


    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}' ${webview.cspSource} https://cdnjs.cloudflare.com 'unsafe-eval' 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src https://cdnjs.cloudflare.com;">
  <link href="${hljsCss}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="brand-header">
    <span class="nat">NAT</span><span class="lang">LANG</span>
  </div>

  <div class="architecture-section">
    <label class="section-label">Target Architecture</label>
    <div class="lang-grid" id="language-buttons">
      ${languages.map(lang => 
        `<button class="lang-btn ${lang === defaultLanguage ? 'active' : ''}" data-value="${lang}">${lang}</button>`
      ).join('')}
    </div>
  </div>

  <div class="model-section">
    <label class="section-label">AI Model</label>
    <div class="button-grid" id="provider-buttons">
      <button class="core-btn ${aiProvider === 'ollama' ? 'active' : ''}" data-value="ollama">Ollama</button>
      <button class="core-btn ${aiProvider === 'anthropic' ? 'active' : ''}" data-value="anthropic">Claude</button>
      <button class="core-btn ${aiProvider === 'gemini' ? 'active' : ''}" data-value="gemini">Gemini</button>
      <button class="core-btn ${aiProvider === 'openai' ? 'active' : ''}" data-value="openai">GPT-4</button>
    </div>
  </div>



  <div id="stream-card" class="stream-card" style="display:none;">
    <div class="card-title">
      <span class="section-label">Real-time Stream</span>
      <div class="loader"></div>
    </div>
    <div class="stream-box">
      <pre><code id="code-content"></code></pre>
    </div>
  </div>

  <div class="footer-status">
    <div class="status-meta">
      <span class="stat-label">System State</span>
      <span id="system-state" class="stat-value">READY</span>
    </div>
    <div id="progress-container" class="progress-wrap" style="opacity: 0;">
      <div class="progress-bar">
        <div id="progress-bar-fill" class="progress-fill"></div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${hljsJs}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public postToken(token: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'token', text: token });
    }
  }

  public postDone(code: string, language: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'done', code, language });
    }
  }

  public postError(message: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'error', message });
    }
  }

  public postHistory(): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'history', items: this._engine.getHistory() });
    }
  }

  public clearPanel(): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'clear' });
    }
  }
}
