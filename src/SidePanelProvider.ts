import * as vscode from 'vscode';
import { TranspilerEngine } from './TranspilerEngine';
import { AgenticBackendClient, AgenticProcessResponse } from './AgenticBackendClient';

export class SidePanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly _engine: TranspilerEngine;
  private readonly _extensionUri: vscode.Uri;
  private _lastAgenticCode: string = '';
  private _selectionDisposables: vscode.Disposable[] = [];


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

    webviewView.webview.onDidReceiveMessage(async data => {
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
        case 'runAgentic':
          await this.runAgenticPipeline(data.action, data.prompt);
          break;
        case 'insertAgenticCode':
          if (!this._lastAgenticCode) {
            vscode.window.showInformationMessage('No Agentic AI result available yet.');
            break;
          }
          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor) {
            await activeEditor.edit(editBuilder => {
              if (activeEditor.selection.isEmpty) {
                editBuilder.insert(activeEditor.selection.active, this._lastAgenticCode);
              } else {
                editBuilder.replace(activeEditor.selection, this._lastAgenticCode);
              }
            });
            vscode.window.showInformationMessage('Agentic AI code inserted at cursor.');
          }
          break;
        case 'refreshProviderRuntime':
          await this.refreshProviderRuntimeState();
          break;
      }
    });

    this.postHistory();
    this.postSelectionState();
    void this.refreshProviderRuntimeState();

    this._selectionDisposables.forEach(disposable => disposable.dispose());
    this._selectionDisposables = [
      vscode.window.onDidChangeTextEditorSelection(() => this.postSelectionState()),
      vscode.window.onDidChangeActiveTextEditor(() => this.postSelectionState())
    ];

    webviewView.onDidDispose(() => {
      this._selectionDisposables.forEach(disposable => disposable.dispose());
      this._selectionDisposables = [];
    });

    // Re-send after a short delay to ensure webview JS is ready
    setTimeout(() => {
      this.postHistory();
      this.postSelectionState();
      void this.refreshProviderRuntimeState();
    }, 300);
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
  <div class="top-bar">
    <div class="brand-header">
      <span class="nat">NAT</span><span class="lang">LANG</span>
    </div>
    <button id="settings-toggle" class="settings-icon-btn" title="Settings">⚙</button>
  </div>

  <div id="settings-panel" class="settings-panel hidden">
    <div class="collapsible-section" data-section="models">
      <button class="collapse-toggle" data-target="models-panel">
        <span>AI Models</span>
        <span class="chevron">▸</span>
      </button>
      <div id="models-panel" class="collapse-panel">
        <div class="model-section">
          <label class="section-label">AI Model</label>
          <div class="button-grid" id="provider-buttons">
            <button class="core-btn ${aiProvider === 'ollama' ? 'active' : ''}" data-value="ollama">Ollama</button>
            <button class="core-btn ${aiProvider === 'anthropic' ? 'active' : ''}" data-value="anthropic">Claude</button>
            <button class="core-btn ${aiProvider === 'gemini' ? 'active' : ''}" data-value="gemini">Gemini</button>
            <button class="core-btn ${aiProvider === 'openai' ? 'active' : ''}" data-value="openai">GPT-4</button>
          </div>
        </div>
      </div>
    </div>

    <div class="provider-runtime">
      <div class="provider-runtime-header">
        <button class="collapse-toggle provider-runtime-toggle" data-target="provider-runtime-panel">
          <span>Provider Runtime</span>
          <span class="chevron">▸</span>
        </button>
        <button id="provider-runtime-refresh" class="provider-runtime-refresh" title="Refresh provider runtime">↻</button>
      </div>
      <div id="provider-runtime-panel" class="collapse-panel provider-runtime-panel">
        <div id="provider-runtime-message" class="provider-runtime-message">Loading provider status...</div>
        <div id="provider-runtime-list" class="provider-runtime-list"></div>
      </div>
    </div>
  </div>

  <div class="collapsible-section" data-section="languages">
    <button class="collapse-toggle" data-target="languages-panel">
      <span>Languages</span>
      <span class="chevron">▸</span>
    </button>
    <div id="languages-panel" class="collapse-panel">
      <div class="architecture-section">
        <label class="section-label">Target Architecture</label>
        <div class="lang-grid" id="language-buttons">
          ${languages.map(lang =>
            `<button class="lang-btn ${lang === defaultLanguage ? 'active' : ''}" data-value="${lang}">${lang}</button>`
          ).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="agentic-section">
    <div class="agentic-header">
      <label class="section-label">Agentic AI</label>
      <button id="agentic-insert" class="icon-btn" title="Insert Agentic AI code">⤵</button>
    </div>
    <div class="agentic-actions">
      <button class="agentic-action-btn" data-action="optimize">Optimize</button>
      <button class="agentic-action-btn" data-action="summarize">Summarize</button>
      <button class="agentic-action-btn" data-action="better">Better Code</button>
    </div>

    <div id="agentic-meta" class="agentic-meta">
      <span id="agentic-time">Time: -</span>
      <span id="agentic-space">Space: -</span>
    </div>

    <div id="agentic-empty" class="result-empty">Run an action to see output.</div>

    <div id="optimized-section" class="result-section hidden">
      <div class="result-label">Optimized Code</div>
      <div class="stream-box agentic-box xterm-box">
        <pre><code id="agentic-code"></code></pre>
      </div>
    </div>

    <div id="summary-section" class="result-section hidden">
      <div class="result-label">Summarize</div>
      <div id="summary-content" class="text-result scrollable-result"></div>
    </div>

    <div id="better-section" class="result-section hidden">
      <div class="result-label">Better Code</div>
      <div id="better-content" class="text-result"></div>
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

  public postAgenticDone(result: AgenticProcessResponse): void {
    const normalizedFinalCode = this.normalizeAgenticCode(result.finalCode || '');
    const normalizedOptimizedCode = this.normalizeAgenticCode(result.optimizedCode || '');
    this._lastAgenticCode = normalizedFinalCode || normalizedOptimizedCode || '';
    if (this._view) {
      this._view.webview.postMessage({
        type: 'agenticDone',
        result: {
          ...result,
          finalCode: normalizedFinalCode,
          optimizedCode: normalizedOptimizedCode
        }
      });
    }
  }

  public postAgenticError(message: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'agenticError', message });
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

  private async refreshProviderRuntimeState(): Promise<void> {
    if (!this._view) {
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('natlang');
      const baseUrl = (config.get('backendBaseUrl') as string) || 'http://localhost:8080';
      const client = new AgenticBackendClient(baseUrl);
      const runtime = await client.getProviderRuntimeStatus();
      this._view.webview.postMessage({ type: 'providerRuntime', runtime });
    } catch (error) {
      this._view.webview.postMessage({
        type: 'providerRuntimeError',
        message: (error as Error).message
      });
    }
  }

  private postSelectionState(): void {
    const editor = vscode.window.activeTextEditor;
    if (!this._view || !editor) {
      this._view?.webview.postMessage({
        type: 'selectionState',
        hasSelection: false,
        languageId: '',
        selectedLength: 0,
        preview: ''
      });
      return;
    }

    const hasSelection = !editor.selection.isEmpty;
    const selectedText = hasSelection ? editor.document.getText(editor.selection) : '';
    const preview = selectedText.replace(/\s+/g, ' ').slice(0, 160);

    this._view.webview.postMessage({
      type: 'selectionState',
      hasSelection,
      languageId: editor.document.languageId,
      selectedLength: selectedText.length,
      preview
    });
  }

  private async runAgenticPipeline(action: 'optimize' | 'summarize' | 'better' | 'auto' = 'auto', promptOverride?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.postAgenticError('Open a file or selection before running Agentic AI.');
      return;
    }

    const config = vscode.workspace.getConfiguration('natlang');
    const baseUrl = (config.get('backendBaseUrl') as string) || 'http://localhost:8080';
    const language = (config.get('defaultLanguage') as string) || 'TypeScript';
    const provider = (config.get('aiProvider') as string) || 'ollama';

    const hasSelection = !editor.selection.isEmpty;
    const selectedText = hasSelection ? editor.document.getText(editor.selection).trim() : '';

    const isPromptFile = editor.document.languageId === 'natlang';
    const isExplicitAction = action !== 'auto';

    if (isExplicitAction && !hasSelection) {
      this.postAgenticError('Select code in the editor before using Optimize, Summarize, or Better Code.');
      return;
    }

    if (!isExplicitAction && !isPromptFile && !hasSelection) {
      this.postAgenticError('Select code in the editor to run Agentic AI actions.');
      return;
    }

    const actionPrompts: Record<'optimize' | 'summarize' | 'better' | 'auto', string> = {
      optimize: 'Deterministically optimize this code for better time and space complexity while keeping behavior unchanged. Return optimized code only.',
      summarize: 'Provide only a deterministic meaning summary of this code (purpose, flow, outcome). Do not output code.',
      better: 'Provide deterministic next-step recommendations to improve this codebase. Do not output rewritten code.',
      auto: ''
    };

    const prompt = (promptOverride || actionPrompts[action] || (isPromptFile ? selectedText : '')).trim();
    const code = isExplicitAction
      ? selectedText
      : (!isPromptFile ? selectedText : '').trim();

    if (!prompt && !code) {
      this.postAgenticError('Provide pseudocode prompt or source code to run Agentic AI.');
      return;
    }

    try {
      this._view?.webview.postMessage({ type: 'agenticStart' });
      const projectContext = await this.collectProjectContext();
      const client = new AgenticBackendClient(baseUrl);
      const result = await client.process({
        action,
        prompt,
        code,
        language,
        provider,
        projectContext
      });
      this.postAgenticDone(result);
    } catch (error) {
      this.postAgenticError((error as Error).message);
    }
  }

  private normalizeAgenticCode(code: string): string {
    if (!code) {
      return '';
    }
    return code
      .replace(/\\u003c/gi, '<')
      .replace(/\\u003e/gi, '>')
      .replace(/\\u003d/gi, '=')
      .replace(/\\u0026/gi, '&')
      .replace(/u003c/gi, '<')
      .replace(/u003e/gi, '>')
      .replace(/u003d/gi, '=')
      .replace(/u0026/gi, '&');
  }

  private async collectProjectContext(): Promise<string> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return '';
    }

    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx,java,py,cs,go,cpp,c,rs,kt,sql,json,md}',
      '**/{node_modules,dist,out,.git,backend}/**',
      20
    );

    const snapshots: string[] = [];
    for (const file of files) {
      try {
        const bytes = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(bytes).toString('utf8');
        const trimmed = text.slice(0, 1200);
        snapshots.push(`FILE:${vscode.workspace.asRelativePath(file)}\n${trimmed}`);
      } catch {
        // Skip unreadable files.
      }
    }

    return snapshots.join('\n\n');
  }
}
