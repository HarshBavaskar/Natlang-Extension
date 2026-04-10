import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { TranspilerEngine } from './TranspilerEngine';
import { StatusBarManager } from './StatusBarManager';
import { NatLangCodeLensProvider } from './CodeLensProvider';
import { SidePanelProvider } from './SidePanelProvider';
import { DeterministicCompiler, SupportedDeterministicLanguage } from './deterministic/DeterministicCompiler';
import { runDeterministicBenchmark, runDeterministicSelfTest } from './deterministic/CompilerSelfTest';
import { BaselineManager } from './deterministic/BaselineManager';
import { AgenticBackendClient, DictionaryEntry } from './AgenticBackendClient';
import { LiveGenerationManager } from './LiveGenerationManager';
import { PolicyEngine } from './policy/PolicyEngine';
import { TransactionManager } from './transactions/TransactionManager';
import { MigrationFactory, MigrationPack } from './migrations/MigrationFactory';
import { PluginEngine } from './plugins/PluginEngine';
import { OwnershipGuard } from './governance/OwnershipGuard';
import { GitHookInstaller } from './automation/GitHookInstaller';
import {
  applyDictionaryToPseudocode,
  buildHeuristicEntries,
  getDictionaryLearningPrompt,
  getPairDictionaryLearningPrompt,
  parseDictionaryEntries
} from './deterministic/DictionaryLearner';

const STARTER_TEMPLATE = '';

export function activate(context: vscode.ExtensionContext) {
  const engine = new TranspilerEngine(context);

  const statusBar = new StatusBarManager();
  const sidePanel = new SidePanelProvider(context, engine);
  const codeLensProvider = new NatLangCodeLensProvider();

  // Register providers
  const viewProvider = vscode.window.registerWebviewViewProvider('natlang.sidepanel', sidePanel);
  const codeLensReg = vscode.languages.registerCodeLensProvider({ language: 'natlang' }, codeLensProvider);

  // Listen for config changes
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('natlang')) {
      const newConfig = vscode.workspace.getConfiguration('natlang');
      const lang = newConfig.get('defaultLanguage') as string || 'Python';
      const prov = newConfig.get('aiProvider') as string || 'ollama';
      statusBar.setIdle(lang, prov);
      void liveGenerationManager.refreshActivePreview(false);
      sidePanel.postLivePreviewState(liveGenerationManager.isEnabled(), liveGenerationManager.getCurrentLanguage());
    }
  }));

  // Initial status bar setup
  const config = vscode.workspace.getConfiguration('natlang');
  const language = config.get('defaultLanguage') as string || 'Python';
  const providerName = config.get('aiProvider') as string || 'ollama';
  statusBar.setIdle(language, providerName);

  // Register all commands
  const disposables: vscode.Disposable[] = [];
  const deterministicCompiler = new DeterministicCompiler();
  const policyEngine = new PolicyEngine();
  const transactionManager = new TransactionManager(context);
  const migrationFactory = new MigrationFactory();
  const pluginEngine = new PluginEngine();
  const ownershipGuard = new OwnershipGuard();
  const hookInstaller = new GitHookInstaller();
  const baselineManager = new BaselineManager();
  const liveGenerationManager = new LiveGenerationManager(engine);
  const pipelineOutput = vscode.window.createOutputChannel('NatLang Deterministic Pipeline');
  context.subscriptions.push(pipelineOutput);
  let dictionaryCache: DictionaryEntry[] = (context.globalState.get<DictionaryEntry[]>('natlang.dictionaryEntries')) || [];

  if (transactionManager.hasRecoverableTransaction()) {
    vscode.window
      .showWarningMessage(
        `NatLang recovered an unfinished transaction. ${transactionManager.describeActive()}`,
        'Rollback Now',
        'Keep'
      )
      .then(async (choice) => {
        if (choice === 'Rollback Now' && transactionManager.hasActiveTransaction()) {
          await transactionManager.rollback();
          vscode.window.showInformationMessage('Recovered transaction rolled back.');
        }
      });
  }

  const vscodeLangToNatLang: Record<string, string> = {
    'python': 'Python',
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'csharp': 'C#',
    'go': 'Go',
    'rust': 'Rust',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'ruby': 'Ruby',
    'php': 'PHP',
    'scala': 'Scala',
    'r': 'R',
    'dart': 'Dart',
    'lua': 'Lua',
    'shellscript': 'Bash',
    'powershell': 'PowerShell',
    'sql': 'SQL',
    'html': 'HTML',
    'css': 'CSS',
    'javascriptreact': 'React JSX',
    'typescriptreact': 'React JSX',
    'vue': 'Vue'
  };

  const deterministicLanguages: SupportedDeterministicLanguage[] = ['Python', 'JavaScript', 'TypeScript'];

  const getBackendClient = () => {
    const backendBaseUrl = (vscode.workspace.getConfiguration('natlang').get('backendBaseUrl') as string) || 'http://localhost:9001';
    return new AgenticBackendClient(backendBaseUrl);
  };

  const collectCorpus = async (): Promise<string> => {
    const include = '**/*.{nl,md,txt,py,js,ts,java,cpp,c,cs,go,rs,rb,php,sql}';
    const exclude = '**/{node_modules,dist,target,out,.git}/**';
    const uris = await vscode.workspace.findFiles(include, exclude, 120);
    const chunks: string[] = [];

    for (const uri of uris) {
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf8').slice(0, 3500);
        if (text.trim()) {
          chunks.push(text);
        }
      } catch {
        // Ignore unreadable files.
      }
    }

    return chunks.join('\n');
  };

  const mergeDictionaryEntries = (entries: DictionaryEntry[]): DictionaryEntry[] => {
    const map = new Map<string, DictionaryEntry>();
    for (const item of entries) {
      const key = (item.term || '').trim().toLowerCase();
      const canonical = (item.canonical || '').trim().toLowerCase();
      if (!key || !canonical) {
        continue;
      }

      const next: DictionaryEntry = {
        term: key,
        canonical,
        confidence: item.confidence ?? 0.7,
        source: item.source || 'dictionary-learn'
      };
      const prev = map.get(key);
      if (!prev || (next.confidence || 0) >= (prev.confidence || 0)) {
        map.set(key, next);
      }
    }
    return [...map.values()];
  };

  const upsertDictionaryEntries = async (newEntries: DictionaryEntry[], source: string): Promise<number> => {
    if (newEntries.length === 0) {
      return 0;
    }

    const withSource = newEntries.map((entry) => ({
      ...entry,
      source: entry.source || source
    }));

    const merged = mergeDictionaryEntries([...(dictionaryCache || []), ...withSource]);
    dictionaryCache = merged;
    await context.globalState.update('natlang.dictionaryEntries', merged);

    try {
      const client = getBackendClient();
      await client.ingestDictionary(withSource);
    } catch {
      // Keep local cache even if backend ingest fails.
    }

    return withSource.length;
  };

  const normalizeAgenticCode = (code: string): string => {
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
      .replace(/u0026/gi, '&')
      .trim();
  };

  const resolveSourceRange = (editor: vscode.TextEditor, args?: unknown): vscode.Range => {
    if (args && typeof args === 'object' && args !== null && 'startLine' in (args as any) && 'endLine' in (args as any)) {
      const { startLine, endLine } = args as any;
      return new vscode.Range(startLine, 0, endLine, 1000);
    }

    if (!editor.selection.isEmpty) {
      return new vscode.Range(editor.selection.start, editor.selection.end);
    }

    if (editor.document.languageId === 'natlang') {
      const position = editor.selection.active;
      const text = editor.document.getText();
      const lines = text.split('\n');
      let startLine = 0;
      let endLine = position.line;
      let inBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') {
          inBlock = false;
          continue;
        }
        if (line && !inBlock) {
          startLine = i;
          inBlock = true;
        }
        if (inBlock && i >= position.line) {
          endLine = i;
          break;
        }
      }

      return new vscode.Range(startLine, 0, endLine, 1000);
    }

    return editor.document.lineAt(editor.selection.active.line).range;
  };

  // natlang.generate
  disposables.push(vscode.commands.registerCommand('natlang.generate', async (args) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open a file first.');
      return;
    }

    let range: vscode.Range;
    
    if (args && typeof args === 'object' && 'startLine' in args && 'endLine' in args) {
      const { startLine, endLine } = args as any;
      range = new vscode.Range(startLine, 0, endLine, 1000);
    } else if (!editor.selection.isEmpty) {
      range = new vscode.Range(editor.selection.start, editor.selection.end);
    } else if (editor.document.languageId === 'natlang') {
      // Find block containing cursor - simplified for .nl files
      const position = editor.selection.active;
      const text = editor.document.getText();
      const lines = text.split('\n');
      let startLine = 0;
      let endLine = 0;
      let inBlock = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') {
          inBlock = false;
        } else if (line && !inBlock) {
          startLine = i;
          inBlock = true;
        }
        if (inBlock && i >= position.line) {
          endLine = i;
          break;
        }
      }
      range = new vscode.Range(startLine, 0, endLine, 1000);
    } else {
      // Default to current line if no selection and not .nl
      range = editor.document.lineAt(editor.selection.active.line).range;
    }

    const pseudocode = editor.document.getText(range);
    
    const languages = Object.values(vscodeLangToNatLang);
    const config = vscode.workspace.getConfiguration('natlang');
    const defaultLang = config.get('defaultLanguage') as string;
    const detected = vscodeLangToNatLang[editor.document.languageId];
    
    let language = defaultLang;

    // If no default set, or if we want to confirm, show the Prompt.
    // If the sidebar select has been changed, it updates defaultLanguage.
    if (!language) {
        const selectedLanguage = await vscode.window.showQuickPick(languages, {
            placeHolder: detected || 'Select target language',
            title: 'Target Code Language',
            canPickMany: false
        });
        if (!selectedLanguage) return;
        language = selectedLanguage;
    }
    const fileName = vscode.workspace.asRelativePath(editor.document.uri);

    try {
        codeLensProvider.refreshCodeLenses();
        statusBar.setGenerating(language);

        const originalText = editor.document.getText(range);
        if (!range.isEmpty) {
          await editor.edit(editBuilder => {
            editBuilder.delete(range);
          });
        }
        
        // Stream code line-by-line into editor and update sidebar
        let currentLine = '';
        let insertPosition = range.start;
        let pendingInsertEdits: Promise<void> = Promise.resolve();
        
        const onToken = (token: string) => {
          currentLine += token;
          
          // Check if we have complete lines to insert
          const lines = currentLine.split('\n');
          
          // Insert all complete lines except the last (incomplete) one
          if (lines.length > 1) {
            const completeLines = lines.slice(0, -1);
            const lastIncomplete = lines[lines.length - 1];
            
            for (const line of completeLines) {
              const isBlankLine = !line.trim();
              const sanitized = isBlankLine ? '\n' : engine.sanitizeStreamingLine(line, language);
              if (!isBlankLine && !sanitized.trim()) {
                continue;
              }

              pendingInsertEdits = pendingInsertEdits.then(async () => {
                const textToInsert = isBlankLine ? '\n' : `${sanitized}\n`;
                await editor.edit(editBuilder => {
                  editBuilder.insert(insertPosition, textToInsert);
                });
                sidePanel.postToken(textToInsert);
                insertPosition = insertPosition.translate(1, 0);
              });
            }
            
            currentLine = lastIncomplete;
          }
        };
        
        const generatedCode = await engine.generate(pseudocode, language, fileName, onToken);

        let code = generatedCode;
        try {
          const projectContext = (await collectCorpus()).slice(0, 15000);
          const optimized = await getBackendClient().process({
            action: 'optimize',
            prompt: `Optimize generated ${language} code while preserving behavior. Return optimized code only.`,
            code: generatedCode,
            language,
            provider: (vscode.workspace.getConfiguration('natlang').get('aiProvider') as string) || 'ollama',
            projectContext
          });

          const candidate = normalizeAgenticCode(optimized.optimizedCode || optimized.finalCode || '');
          if (candidate) {
            code = candidate;
          }
        } catch (optError) {
          vscode.window.showWarningMessage('Agentic optimize pass failed, using generated code.');
        }

        if (!code.trim()) {
          throw new Error('NatLang produced empty output.');
        }

        // Insert any remaining code that wasn't complete lines
        if (currentLine.trim()) {
          const trailingLines = currentLine.split('\n');
          for (let index = 0; index < trailingLines.length; index++) {
            const line = trailingLines[index];
            const isLast = index === trailingLines.length - 1;
            const isBlankLine = !line.trim();
            const sanitized = isBlankLine ? '\n' : engine.sanitizeStreamingLine(line, language);
            if (!isBlankLine && !sanitized.trim()) {
              continue;
            }

            pendingInsertEdits = pendingInsertEdits.then(async () => {
              const textToInsert = isBlankLine ? '\n' : `${sanitized}${isLast ? '' : '\n'}`;
              await editor.edit(editBuilder => {
                editBuilder.insert(insertPosition, textToInsert);
              });
              sidePanel.postToken(textToInsert);
              insertPosition = insertPosition.translate(1, 0);
            });
          }
        }

        await pendingInsertEdits;

        // Final reconciliation pass: replace streamed draft with the fully cleaned engine output.
        const streamedRange = new vscode.Range(range.start, insertPosition);
        await editor.edit(editBuilder => {
          editBuilder.replace(streamedRange, code);
        });
        sidePanel.postDone(code, language);

        const autoLearn = (vscode.workspace.getConfiguration('natlang').get('autoLearnDictionaryFromGeneration') as boolean) ?? true;
        if (autoLearn) {
          void (async () => {
            try {
              const provider = await engine.getProvider();
              const pairPrompt = getPairDictionaryLearningPrompt(pseudocode, code, language);
              const raw = await provider.generate(pairPrompt.system, pairPrompt.user, () => {});
              const learned = parseDictionaryEntries(raw).map((entry) => ({
                ...entry,
                source: 'ai-generation-learn'
              }));
              await upsertDictionaryEntries(learned, 'ai-generation-learn');
            } catch (learnError) {
            }
          })();
        }

      statusBar.setSuccess();
      codeLensProvider.refreshCodeLenses();
    } catch (error) {
      if (range) {
        try {
          const currentInsertedRange = new vscode.Range(range.start, insertPosition);
          await editor.edit(editBuilder => {
            editBuilder.replace(currentInsertedRange, originalText);
          });
        } catch {
          // Best effort restore.
        }
      }
      let friendlyMessage = (error as Error).message;
      let actionTitle: string | undefined;
      let actionCommand: string | undefined;

      if (friendlyMessage.includes('OLLAMA_OFFLINE')) {
        friendlyMessage = 'Ollama is not running. Start it with: ollama serve';
        actionTitle = 'How to start Ollama';
        actionCommand = 'vscode.open';
        vscode.env.openExternal(vscode.Uri.parse('https://ollama.com'));
      } else if (friendlyMessage.startsWith('NO_API_KEY:')) {
        const provider = friendlyMessage.split(':')[1];
        friendlyMessage = provider + ' API key not set.';
        actionTitle = 'Set ' + provider + ' Key';
        actionCommand = 'natlang.setApiKey';
      } else if (friendlyMessage.includes('RATE_LIMIT')) {
        friendlyMessage = 'Rate limit hit. Try again in a moment.';
      } else if (friendlyMessage === 'ALREADY_GENERATING') {
        vscode.window.showInformationMessage('Generation already in progress.');
        return;
      }

      sidePanel?.postError(friendlyMessage);
      statusBar.setError();
      codeLensProvider.refreshCodeLenses();

      if (actionTitle) {
        const choice = await vscode.window.showErrorMessage(friendlyMessage, { title: actionTitle } as any);
        if (choice && actionCommand) {
          vscode.commands.executeCommand(actionCommand);
        }
      }
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.toggleLiveGeneration', async () => {
    let editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'natlang') {
      await vscode.commands.executeCommand('natlang.newFile');
      editor = vscode.window.activeTextEditor;
    }

    await liveGenerationManager.toggle();
    sidePanel.postLivePreviewState(liveGenerationManager.isEnabled(), liveGenerationManager.getCurrentLanguage());
  }));

  // Placeholder commands
  disposables.push(vscode.commands.registerCommand('natlang.runGenerated', async () => {
    const code = engine.getLastCode();
    const language = engine.getLastLanguage();

    if (!code) {
      vscode.window.showErrorMessage('No code generated yet.');
      return;
    }

    const langMap: Record<string, { ext: string, cmd: string }> = {
      'Python': { ext: 'py', cmd: 'python' },
      'JavaScript': { ext: 'js', cmd: 'node' },
      'TypeScript': { ext: 'ts', cmd: 'ts-node' },
      'Java': { ext: 'java', cmd: 'java' },
      'C': { ext: 'c', cmd: 'gcc' },
      'C++': { ext: 'cpp', cmd: 'g++' },
      'Bash': { ext: 'sh', cmd: 'bash' },
      'PowerShell': { ext: 'ps1', cmd: 'powershell' },
      'SQL': { ext: 'sql', cmd: 'psql' }
    };

    const config = langMap[language];
    if (!config) {
      vscode.window.showInformationMessage(`Direct execution for ${language} not pre-configured. Save the file to run.`);
      return;
    }

    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `natlang_temp.${config.ext}`);
    const fs = require('fs').promises;
    await fs.writeFile(tmpFile, code);

    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('NatLang Run');
    terminal.show();
    
    if (language === 'Java') {
        const className = code.match(/class\s+(\w+)/)?.[1] || 'Main';
        terminal.sendText(`javac "${tmpFile}" && java -cp "${tmpDir}" ${className}`);
    } else if (language === 'C' || language === 'C++') {
        const out = path.join(tmpDir, 'natlang_out');
        terminal.sendText(`${config.cmd} "${tmpFile}" -o "${out}" && "${out}"`);
    } else {
        terminal.sendText(`${config.cmd} "${tmpFile}"`);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.saveGenerated', async () => {
    const code = engine.getLastCode();
    const language = engine.getLastLanguage();

    if (!code) {
      vscode.window.showErrorMessage('No code generated yet.');
      return;
    }

    const langMap: Record<string, string> = {
      'Python': 'py', 'JavaScript': 'js', 'TypeScript': 'ts', 'Java': 'java', 'C': 'c', 'C++': 'cpp', 'C#': 'cs', 'Go': 'go', 'Rust': 'rs', 'Swift': 'swift', 'Kotlin': 'kt', 'Ruby': 'rb', 'PHP': 'php', 'Scala': 'scala', 'R': 'r', 'Dart': 'dart', 'Lua': 'lua', 'Bash': 'sh', 'PowerShell': 'ps1', 'SQL': 'sql', 'HTML': 'html', 'CSS': 'css', 'React JSX': 'jsx', 'Vue': 'vue'
    };
    
    const ext = langMap[language] || 'txt';
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || os.homedir();
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(workspacePath, `generated.${ext}`)),
      filters: { 'Code': [ext], 'All Files': ['*'] }
    });

    if (uri) {
      const uint8 = Buffer.from(code);
      await vscode.workspace.fs.writeFile(uri, uint8);
      vscode.window.showInformationMessage(`Saved to ${path.basename(uri.fsPath)}`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.generateFile', async () => {
    vscode.window.showInformationMessage('Generate entire file coming soon!');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.changeLanguage', async () => {
    const languages = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'Scala', 'R', 'Dart', 'Lua', 'Bash', 'PowerShell', 'SQL', 'HTML', 'CSS', 'React JSX', 'Vue', 'Haskell', 'Elixir', 'Julia', 'MATLAB', 'Perl', 'Zig'];
    const selected = await vscode.window.showQuickPick(languages, { placeHolder: 'Select target language' });
    if (selected) {
      await config.update('defaultLanguage', selected, vscode.ConfigurationTarget.Global);
      statusBar.setIdle(selected, providerName);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.openPanel', () => {
    vscode.commands.executeCommand('workbench.view.extension.natlang-explorer');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.copyGenerated', async () => {
    const code = engine.getLastCode();
    if (code) {
      await vscode.env.clipboard.writeText(code);
      vscode.window.showInformationMessage('Copied to clipboard!');
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.newFile', async () => {
    const doc = await vscode.workspace.openTextDocument({ 
      language: 'natlang', 
      content: STARTER_TEMPLATE 
    });
    await vscode.window.showTextDocument(doc);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.clearHistory', () => {
    engine.clearHistory();
    sidePanel.clearPanel();
    vscode.window.showInformationMessage('History cleared!');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.setApiKey', async (providerParam?: string) => {
    const providers = ['anthropic', 'gemini', 'groq', 'openai'];
    let provider = providerParam || await vscode.window.showQuickPick(providers, { placeHolder: 'Select provider' });
    if (!provider) return;

    const key = await vscode.window.showInputBox({
      prompt: 'Enter your ' + provider + ' API key',
      password: true
    });

    if (key) {
      await context.secrets.store('natlang.' + provider + 'Key', key);
      vscode.window.showInformationMessage('API key saved securely!');
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.openPolicyFile', async () => {
    try {
      await policyEngine.openOrCreatePolicyFile();
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message || 'Failed to open policy file.');
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.validateCurrentFilePolicy', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open a file first.');
      return;
    }

    const evaluation = await policyEngine.evaluateDetailed(editor.document.getText());
    if (evaluation.warnings.length > 0) {
      pipelineOutput.clear();
      pipelineOutput.show(true);
      for (const warning of evaluation.warnings) {
        pipelineOutput.appendLine(`Policy warning: ${warning}`);
      }
    }

    if (evaluation.violations.length === 0) {
      vscode.window.showInformationMessage('Policy check passed. No violations found.');
      return;
    }

    pipelineOutput.show(true);
    pipelineOutput.appendLine('Policy violations:');
    for (const violation of evaluation.violations) {
      pipelineOutput.appendLine(`- [${violation.rule}] ${violation.message}`);
    }
    if (evaluation.mode === 'warn') {
      vscode.window.showWarningMessage(`Policy violations found (${evaluation.violations.length}), mode=warn.`);
    } else {
      vscode.window.showErrorMessage(`Policy check failed with ${evaluation.violations.length} violation(s).`);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.beginTransaction', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open a file first.');
      return;
    }

    const started = transactionManager.begin([editor.document.uri]);
    await transactionManager.captureBefore(editor.document.uri);
    vscode.window.showInformationMessage(`Started ${started}.`);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.rollbackTransaction', async () => {
    if (!transactionManager.hasActiveTransaction()) {
      vscode.window.showInformationMessage('No active transaction to rollback.');
      return;
    }

    await transactionManager.rollback();
    vscode.window.showInformationMessage('Transaction rolled back.');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.commitTransaction', () => {
    if (!transactionManager.hasActiveTransaction()) {
      vscode.window.showInformationMessage('No active transaction to commit.');
      return;
    }

    transactionManager.commit();
    vscode.window.showInformationMessage('Transaction committed.');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.compileDeterministic', async (args) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open a file first.');
      return;
    }

    const selectedLanguage = await vscode.window.showQuickPick(deterministicLanguages, {
      placeHolder: 'Select deterministic compiler target language'
    });

    if (!selectedLanguage) {
      return;
    }

    if (!deterministicLanguages.includes(selectedLanguage as SupportedDeterministicLanguage)) {
      vscode.window.showErrorMessage('Unsupported deterministic target language.');
      return;
    }

    const range = resolveSourceRange(editor, args);
    const pseudocode = editor.document.getText(range);

    try {
      statusBar.setGenerating(`${selectedLanguage} deterministic`);
      pipelineOutput.clear();
      pipelineOutput.show(true);

      const dictionaryReady = dictionaryCache.length > 0
        ? dictionaryCache
        : (context.globalState.get<DictionaryEntry[]>('natlang.dictionaryEntries') || []);
      const normalizedPseudocode = applyDictionaryToPseudocode(pseudocode, dictionaryReady);

      const pre = await pluginEngine.applyPreParse(normalizedPseudocode);
      const compileResult = deterministicCompiler.compile(pre.output, selectedLanguage as SupportedDeterministicLanguage);
      const post = await pluginEngine.applyPostEmit(compileResult.code);
      compileResult.code = post.output;
      if (pre.applied.length > 0 || post.applied.length > 0) {
        pipelineOutput.appendLine(`Plugin transforms: ${[...pre.applied, ...post.applied].join(', ')}`);
      }
      const evaluation = await policyEngine.evaluateDetailed(compileResult.code);
      for (const warning of evaluation.warnings) {
        pipelineOutput.appendLine(`Policy warning: ${warning}`);
      }

      if (evaluation.violations.length > 0) {
        for (const violation of evaluation.violations) {
          pipelineOutput.appendLine(`Policy violation [${violation.rule}]: ${violation.message}`);
        }
        if (evaluation.mode === 'enforce') {
          statusBar.setError();
          vscode.window.showErrorMessage('Deterministic compile blocked by policy rules.');
          return;
        }
        vscode.window.showWarningMessage('Policy violations detected, but policy mode is warn. Continuing.');
      }

      if (compileResult.warnings.length > 0) {
        for (const warning of compileResult.warnings) {
          pipelineOutput.appendLine(`Warning: ${warning}`);
        }

        const allowPartial = (vscode.workspace.getConfiguration('natlang').get('deterministicAllowPartial') as boolean) || false;
        if (!allowPartial) {
          statusBar.setError();
          vscode.window.showErrorMessage(
            `Deterministic compile blocked: ${compileResult.warnings.length} unsupported line(s). Fix pseudocode or enable natlang.deterministicAllowPartial.`
          );
          return;
        }
      }

      const doc = editor.document;
      if (doc.isDirty) {
        const saved = await doc.save();
        if (!saved) {
          throw new Error('Save the file before applying a transactional write.');
        }
      }

      const start = doc.offsetAt(range.start);
      const end = doc.offsetAt(range.end);
      const currentText = doc.getText();
      const nextText = `${currentText.slice(0, start)}${compileResult.code}${currentText.slice(end)}`;

      const guard = await ownershipGuard.enforce([doc.uri]);
      if (!guard.allowed) {
        throw new Error(guard.reason || 'Ownership guard blocked the change.');
      }

      transactionManager.begin([doc.uri]);
      try {
        await transactionManager.applyAtomic([{ uri: doc.uri, content: nextText }]);
        transactionManager.commit();
      } catch (error) {
        if (transactionManager.hasActiveTransaction()) {
          await transactionManager.rollback();
        }
        throw error;
      }

      const refreshed = await vscode.workspace.openTextDocument(doc.uri);
      await vscode.window.showTextDocument(refreshed, editor.viewColumn);
      statusBar.setSuccess();
      vscode.window.showInformationMessage('Deterministic compile applied successfully.');
    } catch (error) {
      statusBar.setError();
      pipelineOutput.appendLine(`Compile failed: ${(error as Error).message || String(error)}`);
      vscode.window.showErrorMessage(`Deterministic compile failed: ${(error as Error).message || 'Unknown error'}`);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.scrapeDictionary', async () => {
    try {
      pipelineOutput.clear();
      pipelineOutput.show(true);
      pipelineOutput.appendLine('Dictionary scrape started...');

      const corpus = await collectCorpus();
      const provider = await engine.getProvider();
      const prompt = getDictionaryLearningPrompt(corpus);
      let aiEntries: DictionaryEntry[] = [];

      try {
        const raw = await provider.generate(prompt.system, prompt.user, () => {});
        aiEntries = parseDictionaryEntries(raw);
      } catch (error) {
        pipelineOutput.appendLine(`AI scrape failed, using heuristics only: ${(error as Error).message || String(error)}`);
      }

      const merged = [...buildHeuristicEntries(), ...aiEntries];
      const deduped = mergeDictionaryEntries(merged.map((item) => ({
        term: item.term.trim().toLowerCase(),
        canonical: item.canonical.trim().toLowerCase(),
        confidence: item.confidence ?? 0.7,
        source: item.source || 'dictionary-scrape'
      })));

      const count = await upsertDictionaryEntries(deduped, 'dictionary-scrape');
      pipelineOutput.appendLine(`Dictionary upserted with ${count} entries (backend + local cache best effort).`);

      pipelineOutput.appendLine(`Dictionary scrape completed. Entries: ${deduped.length}`);
      vscode.window.showInformationMessage(`NatLang dictionary updated (${deduped.length} entries).`);
    } catch (error) {
      vscode.window.showErrorMessage(`Dictionary scrape failed: ${(error as Error).message || 'Unknown error'}`);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.refreshDictionaryFromDb', async () => {
    try {
      const client = getBackendClient();
      const entries = await client.getDictionary();
      dictionaryCache = entries;
      await context.globalState.update('natlang.dictionaryEntries', entries);
      vscode.window.showInformationMessage(`Loaded ${entries.length} dictionary entries from backend.`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh dictionary: ${(error as Error).message || 'Unknown error'}`);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.runMigrationPack', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open a file first.');
      return;
    }

    const pack = await vscode.window.showQuickPick(
      ['javascript-modernize', 'typescript-modernize', 'java-modernize', 'python-modernize'],
      { placeHolder: 'Select migration pack' }
    );

    if (!pack) {
      return;
    }

    const doc = editor.document;
    if (doc.isDirty) {
      const saved = await doc.save();
      if (!saved) {
        vscode.window.showErrorMessage('Save the file before running a migration pack.');
        return;
      }
    }

    const currentCode = doc.getText();
    const migration = migrationFactory.run(pack as MigrationPack, currentCode);

    if (migration.applied.length === 0) {
      vscode.window.showInformationMessage('Migration completed with no changes needed.');
      return;
    }

    const confirmation = await vscode.window.showQuickPick(['Apply', 'Cancel'], {
      placeHolder: `Risk ${migration.riskLevel.toUpperCase()} (${migration.riskScore}) with ${migration.changedLines} changed lines`
    });
    if (confirmation !== 'Apply') {
      vscode.window.showInformationMessage('Migration cancelled.');
      return;
    }

    const evaluation = await policyEngine.evaluateDetailed(migration.code);
    for (const warning of evaluation.warnings) {
      pipelineOutput.appendLine(`Policy warning: ${warning}`);
    }
    if (evaluation.violations.length > 0) {
      pipelineOutput.clear();
      pipelineOutput.show(true);
      for (const violation of evaluation.violations) {
        pipelineOutput.appendLine(`Policy violation [${violation.rule}]: ${violation.message}`);
      }
      if (evaluation.mode === 'enforce') {
        vscode.window.showErrorMessage('Migration blocked by policy rules.');
        return;
      }
      vscode.window.showWarningMessage('Policy violations detected, but policy mode is warn. Continuing migration.');
    }

    const guard = await ownershipGuard.enforce([doc.uri]);
    if (!guard.allowed) {
      vscode.window.showErrorMessage(guard.reason || 'Ownership guard blocked migration.');
      return;
    }

    transactionManager.begin([doc.uri]);
    try {
      await transactionManager.applyAtomic([{ uri: doc.uri, content: migration.code }]);
      transactionManager.commit();
    } catch (error) {
      if (transactionManager.hasActiveTransaction()) {
        await transactionManager.rollback();
      }
      throw error;
    }

    const refreshed = await vscode.workspace.openTextDocument(doc.uri);
    await vscode.window.showTextDocument(refreshed, editor.viewColumn);
    pipelineOutput.clear();
    pipelineOutput.show(true);
    pipelineOutput.appendLine(`Migration pack: ${pack}`);
    pipelineOutput.appendLine(`Risk: ${migration.riskLevel} (${migration.riskScore}), changed lines: ${migration.changedLines}`);
    for (const item of migration.applied) {
      pipelineOutput.appendLine(`- ${item}`);
    }

    vscode.window.showInformationMessage(`Migration applied with ${migration.applied.length} change(s).`);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.recoverTransaction', async () => {
    if (!transactionManager.hasActiveTransaction()) {
      vscode.window.showInformationMessage('No active transaction to recover.');
      return;
    }

    const pick = await vscode.window.showQuickPick(['Rollback', 'Commit', 'Cancel'], {
      placeHolder: `${transactionManager.describeActive()}`
    });

    if (pick === 'Rollback') {
      await transactionManager.rollback();
      vscode.window.showInformationMessage('Transaction recovered by rollback.');
      return;
    }

    if (pick === 'Commit') {
      transactionManager.commit();
      vscode.window.showInformationMessage('Transaction recovered by commit.');
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.runDeterministicSelfTest', async () => {
    const result = runDeterministicSelfTest();
    pipelineOutput.clear();
    pipelineOutput.show(true);
    pipelineOutput.appendLine(`Deterministic self-test: ${result.passed} passed, ${result.failed} failed`);
    for (const line of result.details) {
      pipelineOutput.appendLine(line);
    }

    if (result.failed > 0) {
      vscode.window.showErrorMessage(`Deterministic self-test failed (${result.failed}). See output.`);
    } else {
      vscode.window.showInformationMessage('Deterministic self-test passed.');
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.showDeterministicAstDiff', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open a file first.');
      return;
    }

    const range = resolveSourceRange(editor);
    const source = editor.document.getText(range);
    const ast = deterministicCompiler.parseToAst(source);
    const compileResult = deterministicCompiler.compile(source, 'TypeScript');

    pipelineOutput.clear();
    pipelineOutput.show(true);
    pipelineOutput.appendLine('--- Source AST ---');
    pipelineOutput.appendLine(JSON.stringify(ast.ast, null, 2));
    pipelineOutput.appendLine('--- Transformations ---');
    for (const t of compileResult.transformations) {
      pipelineOutput.appendLine(`- ${t}`);
    }
    pipelineOutput.appendLine('--- Output Preview ---');
    pipelineOutput.appendLine(compileResult.code);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.previewMigrationPack', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open a file first.');
      return;
    }

    const pack = await vscode.window.showQuickPick(
      ['javascript-modernize', 'typescript-modernize', 'java-modernize', 'python-modernize'],
      { placeHolder: 'Select migration pack for preview' }
    );
    if (!pack) {
      return;
    }

    const preview = migrationFactory.preview(pack as MigrationPack, editor.document.getText());
    pipelineOutput.clear();
    pipelineOutput.show(true);
    pipelineOutput.appendLine(`Preview pack: ${pack}`);
    pipelineOutput.appendLine(`Risk: ${preview.riskLevel} (${preview.riskScore}), changed lines: ${preview.changedLines}`);
    for (const line of preview.applied) {
      pipelineOutput.appendLine(`- ${line}`);
    }
    pipelineOutput.appendLine('--- Preview Output ---');
    pipelineOutput.appendLine(preview.code);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.lockPolicyPack', async () => {
    await policyEngine.updatePolicyLock();
    vscode.window.showInformationMessage('Policy pack lock file updated.');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.verifyPolicyPack', async () => {
    const status = await policyEngine.verifyPolicyLock();
    if (!status.lockExists) {
      vscode.window.showWarningMessage('No policy lock found. Run NatLang: Lock Policy Pack first.');
      return;
    }
    if (status.valid) {
      vscode.window.showInformationMessage('Policy lock verification passed.');
      return;
    }
    vscode.window.showErrorMessage(`Policy lock mismatch. Expected ${status.expectedHash}, got ${status.actualHash}.`);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.switchPolicyProfile', async () => {
    const profiles = await policyEngine.listProfiles();
    const selected = await vscode.window.showQuickPick([...profiles, 'Create New Profile...'], {
      placeHolder: 'Select active policy profile'
    });
    if (!selected) {
      return;
    }

    if (selected === 'Create New Profile...') {
      const name = await vscode.window.showInputBox({ prompt: 'Enter new policy profile name' });
      if (!name) {
        return;
      }
      await policyEngine.createProfile(name);
      await policyEngine.setActiveProfile(name);
      vscode.window.showInformationMessage(`Created and switched to profile '${name}'.`);
      return;
    }

    await policyEngine.setActiveProfile(selected);
    vscode.window.showInformationMessage(`Switched policy profile to '${selected}'.`);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.installPreCommitPolicyHook', async () => {
    const paths = await policyEngine.getPolicyPathsForScripts();
    await hookInstaller.installPreCommitHook(paths.policyPath);
    vscode.window.showInformationMessage('Installed pre-commit policy hook.');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.scaffoldRulePlugin', async () => {
    const uri = await pluginEngine.scaffoldSamplePlugin();
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('Sample plugin scaffolded.');
  }));

  disposables.push(vscode.commands.registerCommand('natlang.configureOwnerApprovals', async () => {
    await ownershipGuard.openOrCreateConfig();
  }));

  disposables.push(vscode.commands.registerCommand('natlang.runDeterministicBenchmark', async () => {
    const benchmark = runDeterministicBenchmark();
    pipelineOutput.clear();
    pipelineOutput.show(true);
    pipelineOutput.appendLine(`Benchmark: ${benchmark.cases} case(s), ${benchmark.passed} passed, ${benchmark.failed} failed`);
    pipelineOutput.appendLine(`Duration: ${benchmark.durationMs}ms, avg ${benchmark.avgMsPerCase.toFixed(2)}ms/case`);
    for (const line of benchmark.details) {
      pipelineOutput.appendLine(line);
    }
  }));

  disposables.push(vscode.commands.registerCommand('natlang.captureDeterministicBaseline', async () => {
    const result = await baselineManager.captureBaseline();
    vscode.window.showInformationMessage(`Baseline captured with ${result.entries} entries at ${result.path}.`);
  }));

  disposables.push(vscode.commands.registerCommand('natlang.detectDeterministicDrift', async () => {
    const drift = await baselineManager.detectDrift();
    pipelineOutput.clear();
    pipelineOutput.show(true);
    pipelineOutput.appendLine(`Deterministic drift count: ${drift.driftCount}`);
    for (const line of drift.details) {
      pipelineOutput.appendLine(line);
    }

    if (drift.driftCount > 0) {
      vscode.window.showWarningMessage(`Deterministic drift detected (${drift.driftCount}).`);
    } else {
      vscode.window.showInformationMessage('No deterministic drift detected.');
    }
  }));

  context.subscriptions.push(...disposables, viewProvider, codeLensReg, statusBar, liveGenerationManager);
}

export function deactivate() { }

