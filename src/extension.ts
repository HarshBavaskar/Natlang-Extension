import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { TranspilerEngine } from './TranspilerEngine';
import { StatusBarManager } from './StatusBarManager';
import { NatLangCodeLensProvider } from './CodeLensProvider';
import { SidePanelProvider } from './SidePanelProvider';

const STARTER_TEMPLATE = `# NatLang — Write logic. Get code.
# Press Ctrl+Shift+G on any block to generate.
# Change language anytime from the status bar.
# ──────────────────────────────────────────────

# BLOCK 1 — Basic function (works in any language)
define a function called greet that takes a name:
    if name is empty:
        return "Hello, stranger!"
    return "Hello, " + name + "!"

call greet with "World" and print the result

---

# BLOCK 2 — Data processing (works in any language)
create a list of numbers from 1 to 20
filter the list to keep only even numbers
sort it in descending order
print each number with its index

---

# BLOCK 3 — OOP with Java (set language to Java before generating this block)
# Demonstrates: Encapsulation, Inheritance, Polymorphism, Abstraction

create an abstract class called Animal:
    it has a private field called name of type String
    it has a private field called sound of type String
    constructor takes name and sound and sets both fields
    public getter for name
    public getter for sound
    define an abstract method called speak that returns a String
    override toString to return the animal's name and sound

create a class called Dog that inherits from Animal:
    it has a private field called breed of type String
    constructor takes name and breed, calls super with name and "Woof", sets breed
    public getter for breed
    override speak to return name + " says: Woof! I am a " + breed
    override toString to include breed alongside the parent toString

create a class called Cat that inherits from Animal:
    it has a private field called isIndoor of type boolean
    constructor takes name and isIndoor, calls super with name and "Meow", sets isIndoor
    override speak to return name + " says: Meow!" and if isIndoor add " (indoor cat)"
    override toString to include indoor status

create an interface called Trainable:
    define a method called train that takes a command of type String and returns boolean
    define a method called getTrainingLevel that returns int

make Dog implement Trainable:
    it has a private field called trainingLevel of type int starting at 0
    train method: if command is not empty increment trainingLevel and return true, else return false
    getTrainingLevel returns trainingLevel

in the main method:
    create a list of Animal called animals
    add a new Dog with name "Rex" and breed "Labrador"
    add a new Cat with name "Whiskers" and isIndoor true
    add a new Dog with name "Buddy" and breed "Poodle"
    for each animal in the list: call speak and print the result
    print a blank line
    for each animal that is an instance of Trainable:
        cast it to Trainable and train it with "sit"
        print the animal name + " training level: " + getTrainingLevel`;

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
    }
  }));

  // Initial status bar setup
  const config = vscode.workspace.getConfiguration('natlang');
  const language = config.get('defaultLanguage') as string || 'Python';
  const providerName = config.get('aiProvider') as string || 'ollama';
  statusBar.setIdle(language, providerName);

  // Register all commands
  const disposables: vscode.Disposable[] = [];

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
    
    // Map VS Code language IDs to NatLang display names
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
        
        // No longer waiting for side panel if user doesn't want it, 
        // but we keep it updated if it is open.
        
        let currentRange = range;
        let streamedCode = "";
        let firstToken = true;

        const code = await engine.generate(pseudocode, language, fileName, async (token) => {
          if (sidePanel) {
            sidePanel.postToken(token);
          }

          // Live Typing into the editor
          if (firstToken) {
            // On the very first token, clear the existing pseudocode
            await editor.edit(editBuilder => {
                editBuilder.replace(range, "");
            }, { undoStopBefore: true, undoStopAfter: false });
            firstToken = false;
            currentRange = new vscode.Range(range.start, range.start);
          }

          streamedCode += token;
          
          await editor.edit(editBuilder => {
              editBuilder.insert(currentRange.end, token);
          }, { undoStopBefore: false, undoStopAfter: false });

          // Update the range to the new end position
          const lines = token.split('\n');
          const lastLineLength = lines[lines.length - 1].length;
          let newEndLine = currentRange.end.line + lines.length - 1;
          let newEndCharacter = (lines.length > 1 ? 0 : currentRange.end.character) + lastLineLength;
          
          currentRange = new vscode.Range(range.start, new vscode.Position(newEndLine, newEndCharacter));
        });

        if (sidePanel) {
          sidePanel.postDone(code, language);
        }

        // REPLACE CODE IN EDITOR
        await editor.edit(editBuilder => {
          editBuilder.replace(range, code);
        });

      statusBar.setSuccess();
      codeLensProvider.refreshCodeLenses();
    } catch (error) {
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
    const providers = ['anthropic', 'gemini', 'openai'];
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

  context.subscriptions.push(...disposables, viewProvider, codeLensReg, statusBar);
}

export function deactivate() { }

