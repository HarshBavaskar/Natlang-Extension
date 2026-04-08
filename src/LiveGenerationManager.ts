import * as vscode from 'vscode';
import { TranspilerEngine } from './TranspilerEngine';

type LiveGenerationState = {
  previewUri: vscode.Uri;
  previewText: string;
  sourceUri: vscode.Uri;
  sourceVersion: number;
  targetLanguage: string;
};

type PreviewFormat = 'code' | 'fenced' | 'markdown' | 'plain';

interface LineGenerationOutcome {
  codeText: string;
  loopDetected: boolean;
}

interface LoopState {
  lastMeaningfulLine: string;
  repeatCount: number;
}

const LIVE_PREVIEW_SCHEME = 'natlang-live-preview';

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  Python: 'py',
  JavaScript: 'js',
  TypeScript: 'ts',
  Java: 'java',
  Go: 'go',
  Rust: 'rs',
  C: 'c',
  'C++': 'cpp',
  'C#': 'cs',
  Bash: 'sh',
  PowerShell: 'ps1',
  SQL: 'sql',
  HTML: 'html',
  CSS: 'css',
  'React JSX': 'jsx',
  Vue: 'vue'
};

export class LiveGenerationManager implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly sourceLanguageIds = new Set(['natlang']);
  private state?: LiveGenerationState;
  private enabled = false;
  private running = false;
  private dirty = false;
  private requestId = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly engine: TranspilerEngine
  ) {
    this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(LIVE_PREVIEW_SCHEME, this));
    this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => this.handleDocumentChange(event)));
    this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (this.enabled && editor && this.isTrackedDocument(editor.document)) {
        void this.scheduleRefresh(true);
      }
    }));
  }

  onDidChange = this.changeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    if (this.state && uri.toString() === this.state.previewUri.toString()) {
      return this.state.previewText;
    }

    if (!this.enabled) {
      return 'NatLang live preview is off. Run "NatLang: Toggle Live Generation Preview" to start.';
    }

    return 'Waiting for a NatLang document...';
  }

  async toggle(): Promise<void> {
    if (this.enabled) {
      this.stop();
      vscode.window.showInformationMessage('NatLang live preview stopped.');
      return;
    }

    this.enabled = true;
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isTrackedDocument(editor.document)) {
      vscode.window.showInformationMessage('Open a NatLang file and start typing pseudocode to use live preview.');
      return;
    }

    await this.scheduleRefresh(true);
    vscode.window.showInformationMessage('NatLang live preview started.');
  }

  async generateCodeLineByLine(source: string, language: string, fileName: string): Promise<LineGenerationOutcome> {
    const provider = await this.engine.getProvider();
    const config = this.getLiveGenerationConfig();
    const sourceLines = source.split(/\r?\n/);
    const generatedLines: string[] = [];
    const loopState: LoopState = { lastMeaningfulLine: '', repeatCount: 0 };
    let detectedFormat: PreviewFormat = 'code';
    let loopDetected = false;

    for (let index = 0; index < sourceLines.length; index++) {
      const sourceLine = sourceLines[index];
      if (!sourceLine.trim()) {
        generatedLines.push('');
        continue;
      }

      let accepted = false;
      let lastIssue = '';

      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        const prompt = this.buildLinePrompt(
          sourceLines,
          generatedLines,
          index,
          language,
          fileName,
          lastIssue,
          config.contextLines
        );
        const raw = await this.requestLineCompletion(provider, prompt.system, prompt.user, 0, false);
        const format = this.detectFormat(raw);
        const normalized = this.normalizeGeneratedOutput(raw, format);
        const nextLines = normalized
          .split(/\r?\n/)
          .map((line) => line.replace(/[\t ]+$/g, ''))
          .filter((line, lineIndex, all) => lineIndex < config.maxLinesPerStep && (line.trim().length > 0 || all.length === 1));

        if (format !== 'code' && format !== detectedFormat) {
          detectedFormat = format;
        }

        const chosenLines = nextLines.length > 0 ? nextLines : [''];
        const quality = this.validateGeneratedLines(generatedLines, chosenLines, language);
        const repeated = this.detectRepeat(chosenLines, loopState);

        if (repeated) {
          loopDetected = true;
          break;
        }

        if (!quality.ok) {
          lastIssue = quality.reason;
          continue;
        }

        for (const line of chosenLines) {
          generatedLines.push(line);
        }

        accepted = true;
        break;
      }

      if (!accepted || loopDetected) {
        break;
      }
    }

    const codeText = generatedLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return {
      codeText,
      loopDetected
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getCurrentLanguage(): string {
    return this.resolveTargetLanguage();
  }

  async refreshActivePreview(openPreview = false): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isTrackedDocument(editor.document)) {
      return;
    }

    await this.refresh(openPreview);
  }

  stop(): void {
    this.enabled = false;
    this.running = false;
    this.dirty = false;
    this.requestId += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.state) {
      this.state.previewText = 'NatLang live preview is off. Run "NatLang: Toggle Live Generation Preview" to start.';
      this.changeEmitter.fire(this.state.previewUri);
    }
  }

  dispose(): void {
    this.stop();
    this.changeEmitter.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.enabled || !this.isTrackedDocument(event.document)) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== event.document.uri.toString()) {
      return;
    }

    void this.scheduleRefresh(false);
  }

  private async scheduleRefresh(openPreview: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.enabled || !this.isTrackedDocument(editor.document)) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    const debounceMs = (vscode.workspace.getConfiguration('natlang').get('liveGenerationDebounceMs') as number) || 650;
    this.timer = setTimeout(() => {
      void this.refresh(openPreview);
    }, debounceMs);
  }

  private async refresh(openPreview: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (!this.enabled || !this.isTrackedDocument(editor.document)) {
      return;
    }

    if (this.running) {
      this.dirty = true;
      return;
    }

    const current = this.resolveCurrentSource(editor);
    if (!current.source.trim()) {
      this.state = {
        previewUri: this.buildPreviewUri(editor.document.uri, this.resolveTargetLanguage()),
        previewText: 'Type pseudocode to see live generated code here.',
        sourceUri: editor.document.uri,
        sourceVersion: editor.document.version,
        targetLanguage: this.resolveTargetLanguage()
      };
      this.changeEmitter.fire(this.state.previewUri);
      if (openPreview) {
        await this.openPreviewEditor(this.state.previewUri);
      }
      return;
    }

    const targetLanguage = this.resolveTargetLanguage();
    const previewUri = this.buildPreviewUri(editor.document.uri, targetLanguage);
    this.state = {
      previewUri,
      previewText: 'Generating live preview...\n',
      sourceUri: editor.document.uri,
      sourceVersion: editor.document.version,
      targetLanguage
    };
    this.changeEmitter.fire(previewUri);
    if (openPreview || !vscode.window.visibleTextEditors.some((visibleEditor) => visibleEditor.document.uri.toString() === previewUri.toString())) {
      await this.openPreviewEditor(previewUri);
    }

    const requestId = ++this.requestId;
    this.running = true;

    try {
      const code = await this.engine.generate(
        current.source,
        targetLanguage,
        vscode.workspace.asRelativePath(editor.document.uri),
        () => {},
        { persistResult: false }
      );

      if (!this.state || requestId !== this.requestId) {
        return;
      }

      this.state.previewText = (code || '').trim() || 'Type pseudocode to see live generated code here.';
      this.changeEmitter.fire(this.state.previewUri);
    } catch (error) {
      if (this.state && requestId === this.requestId) {
        this.state.previewText = `Live generation failed: ${(error as Error).message || String(error)}`;
        this.changeEmitter.fire(this.state.previewUri);
      }
    } finally {
      this.running = false;
      if (this.dirty && this.enabled) {
        this.dirty = false;
        const editorAfterRefresh = vscode.window.activeTextEditor;
        if (editorAfterRefresh && this.isTrackedDocument(editorAfterRefresh.document)) {
          void this.refresh(false);
        }
      }
    }
  }

  private async openPreviewEditor(previewUri: vscode.Uri): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(previewUri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: true
    });
  }

  private resolveTargetLanguage(): string {
    return (vscode.workspace.getConfiguration('natlang').get('defaultLanguage') as string) || 'TypeScript';
  }

  private getLiveGenerationConfig(): { contextLines: number; maxRetries: number; maxLinesPerStep: number } {
    const config = vscode.workspace.getConfiguration('natlang');
    return {
      contextLines: Math.max(1, Number(config.get('liveGenerationContextLines') ?? 3)),
      maxRetries: Math.max(0, Number(config.get('liveGenerationMaxLineRetries') ?? 2)),
      maxLinesPerStep: Math.max(1, Number(config.get('liveGenerationMaxLinesPerStep') ?? 4))
    };
  }

  private async generateLineByLinePreview(source: string, language: string, fileName: string, requestId: number): Promise<LineGenerationOutcome> {
    const provider = await this.engine.getProvider();
    const config = this.getLiveGenerationConfig();
    const sourceLines = source.split(/\r?\n/);
    const generatedLines: string[] = [];
    const warnings: string[] = [];
    let detectedFormat: PreviewFormat = 'code';
    let loopDetected = false;

    for (let index = 0; index < sourceLines.length; index++) {
      if (!this.enabled || requestId !== this.requestId) {
        break;
      }

      const sourceLine = sourceLines[index];
      if (!sourceLine.trim()) {
        generatedLines.push('');
        this.publishPreview(generatedLines, detectedFormat, warnings);
        continue;
      }

      let accepted = false;
      let lastIssue = '';

      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        if (!this.enabled || requestId !== this.requestId) {
          break;
        }

        const prompt = this.buildLinePrompt(
          sourceLines,
          generatedLines,
          index,
          language,
          fileName,
          lastIssue,
          config.contextLines
        );
        const raw = await this.requestLineCompletion(provider, prompt.system, prompt.user, requestId, true);
        const format = this.detectFormat(raw);
        const normalized = this.normalizeGeneratedOutput(raw, format);
        const nextLines = normalized
          .split(/\r?\n/)
          .map((line) => line.replace(/[\t ]+$/g, ''))
          .filter((line, lineIndex, all) => lineIndex < config.maxLinesPerStep && (line.trim().length > 0 || all.length === 1));

        if (format !== 'code' && format !== detectedFormat) {
          detectedFormat = format;
          warnings.push(`Detected ${format} output and normalized it automatically.`);
        }

        const chosenLines = nextLines.length > 0 ? nextLines : [''];
        const quality = this.validateGeneratedLines(generatedLines, chosenLines, language);
        const repeated = this.detectRepeat(chosenLines, loopState);

        if (repeated) {
          loopDetected = true;
          warnings.push('Repeated output detected; live generation stopped to prevent a loop.');
          break;
        }

        if (!quality.ok) {
          lastIssue = quality.reason;
          warnings.push(`Recheck failed on line ${index + 1}: ${quality.reason}`);
          continue;
        }

        for (const line of chosenLines) {
          generatedLines.push(line);
        }

        this.publishPreview(generatedLines, detectedFormat, warnings);
        accepted = true;
        break;
      }

      if (!accepted || loopDetected) {
        break;
      }
    }

    const finalText = this.postProcessPreview(generatedLines, detectedFormat, warnings);
    return {
      previewText: finalText,
      warnings,
      format: detectedFormat,
      loopDetected
    };
  }

  private async requestLineCompletion(
    provider: Awaited<ReturnType<TranspilerEngine['getProvider']>>,
    system: string,
    user: string,
    requestId: number,
    gateByLivePreviewState: boolean
  ): Promise<string> {
    let raw = '';
    await provider.generate(system, user, (token) => {
      if ((gateByLivePreviewState && (!this.enabled || requestId !== this.requestId)) || (!gateByLivePreviewState && requestId !== 0)) {
        return;
      }

      raw += token;
      if (this.state && requestId === this.requestId) {
        const partial = this.normalizeGeneratedOutput(raw, this.detectFormat(raw));
        if (partial.trim()) {
          const draft = this.postProcessPreview([partial]);
          this.state.previewText = draft;
          this.changeEmitter.fire(this.state.previewUri);
        }
      }
    });

    return raw;
  }

  private buildLinePrompt(
    sourceLines: string[],
    generatedLines: string[],
    currentIndex: number,
    language: string,
    fileName: string,
    lastIssue: string,
    contextLines: number
  ): { system: string; user: string } {
    const currentLine = sourceLines[currentIndex] || '';
    const sourceContextStart = Math.max(0, currentIndex - contextLines);
    const sourceContextEnd = Math.min(sourceLines.length, currentIndex + contextLines + 1);
    const sourceContext = sourceLines.slice(sourceContextStart, sourceContextEnd).join('\n');
    const generatedContext = generatedLines.slice(Math.max(0, generatedLines.length - contextLines * 3)).join('\n');
    const blockContext = this.getBlockContext(sourceLines, currentIndex);
    const inferredIntent = this.inferIntent(sourceLines, generatedLines, currentIndex);

    const system = [
      `You are NatLang's line-by-line code engine for ${language}.`,
      'Output only raw code.',
      'Do not output markdown, notes, explanations, comments, or labels.',
      'Use the surrounding pseudocode to infer the intended structure, not only the current line.',
      'Preserve the target language formatting exactly.',
      'Prefer the smallest correct continuation that matches the surrounding block.',
      'If the source line is blank, return a blank line.',
      'Never repeat the same line continuously.',
      'If you detect a formatting shift, normalize to plain code immediately.',
      'Prefer context-aware completions over literal line-by-line transcription.'
    ].join(' ');

    const user = [
      `File: ${fileName}`,
      `Target language: ${language}`,
      `Inferred intent: ${inferredIntent}`,
      `Source line ${currentIndex + 1} of ${sourceLines.length}:`,
      currentLine,
      '',
      'Current block context:',
      blockContext || '(no explicit block context)',
      '',
      'Nearby source context:',
      sourceContext,
      '',
      'Recently generated code:',
      generatedContext || '(none yet)',
      '',
      lastIssue ? `Recheck issue to fix: ${lastIssue}` : 'Return the next line only.'
    ].join('\n');

    return { system, user };
  }

  private detectFormat(text: string): PreviewFormat {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'code';
    }

    if (/```|~~~/.test(trimmed)) {
      return 'fenced';
    }
    if (/^#{1,6}\s+/m.test(trimmed) || /^[-*+]\s+/m.test(trimmed) || /^\d+\.\s+/m.test(trimmed)) {
      return 'markdown';
    }
    if (/^(Sure|Certainly|Here is|Here's|Below is|Explanation|Note|To run|I hope|Let me)/i.test(trimmed)) {
      return 'plain';
    }

    return 'code';
  }

  private normalizeGeneratedOutput(text: string, format: PreviewFormat): string {
    let result = text.replace(/\r/g, '').trim();

    if (format === 'fenced' || /```|~~~/.test(result)) {
      const fenced = result.match(/```(?:[\w#+.-]+)?\s*\n?([\s\S]*?)\n?```/);
      if (fenced && fenced[1]) {
        result = fenced[1].trim();
      }
      result = result.replace(/```(?:[\w#+.-]+)?/g, '').replace(/~~~(?:[\w#+.-]+)?/g, '');
    }

    result = result.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    result = result.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '');
    result = result.replace(/^(Sure|Certainly|Here is|Here's|Below is|Explanation|Note|To run|I hope|Let me).+?\n+/i, '');
    result = result.replace(/^`+|`+$/g, '');

    return result.replace(/[\t ]+$/gm, '').replace(/^\s*\n+|\n+\s*$/g, '');
  }

  private validateGeneratedLines(existingLines: string[], candidateLines: string[], language: string): { ok: boolean; reason: string } {
    const nextLines = [...existingLines, ...candidateLines];

    for (const candidate of candidateLines) {
      if (!candidate.trim()) {
        continue;
      }

      if (/```|~~~/.test(candidate)) {
        return { ok: false, reason: 'Markdown fences are not allowed in code output.' };
      }

      if (/^(Sure|Certainly|Here is|Here's|Below is|Explanation|Note|To run|I hope|Let me)/i.test(candidate.trim())) {
        return { ok: false, reason: 'Conversational text leaked into generated code.' };
      }
    }

    if (!this.checkLoopSafety(nextLines)) {
      return { ok: false, reason: 'Repeated line pattern detected.' };
    }

    if (language === 'Python') {
      for (const line of nextLines) {
        if (/\t/.test(line)) {
          return { ok: false, reason: 'Python output should not use tabs.' };
        }
      }
    }

    const balance = this.checkDelimiterBalance(nextLines.join('\n'));
    if (!balance.ok) {
      return balance;
    }

    return { ok: true, reason: 'ok' };
  }

  private checkLoopSafety(lines: string[]): boolean {
    const recent = lines.filter((line) => line.trim().length > 0).slice(-6).map((line) => line.trim());
    if (recent.length < 3) {
      return true;
    }

    const last = recent[recent.length - 1];
    const sameCount = recent.filter((line) => line === last).length;
    if (sameCount >= 3) {
      return false;
    }

    const fingerprint = recent.join('\n');
    return !/(.+\n\1\n\1)/s.test(fingerprint);
  }

  private checkDelimiterBalance(text: string): { ok: boolean; reason: string } {
    const pairs: Array<[string, string]> = [['(', ')'], ['{', '}'], ['[', ']']];
    for (const [open, close] of pairs) {
      const openCount = (text.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closeCount = (text.match(new RegExp(`\\${close}`, 'g')) || []).length;
      if (closeCount > openCount + 1) {
        return { ok: false, reason: `Too many closing ${close} delimiters detected.` };
      }
    }

    return { ok: true, reason: 'ok' };
  }

  private detectRepeat(candidateLines: string[], loopState: LoopState): boolean {
    let sawMeaningfulLine = false;

    for (const line of candidateLines) {
      const normalized = this.normalizeLoopLine(line);
      if (!normalized) {
        continue;
      }

      sawMeaningfulLine = true;
      if (normalized === loopState.lastMeaningfulLine) {
        loopState.repeatCount += 1;
      } else {
        loopState.lastMeaningfulLine = normalized;
        loopState.repeatCount = 1;
      }

      if (loopState.repeatCount >= 4) {
        return true;
      }
    }

    if (!sawMeaningfulLine) {
      return false;
    }

    return false;
  }

  private normalizeLoopLine(line: string): string {
    const trimmed = line.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return '';
    }

    if (/^[{}()[\];,]+$/.test(trimmed)) {
      return '';
    }

    const alphaNumChars = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
    if (alphaNumChars < 3) {
      return '';
    }

    if (/^(pass|break|continue|else|end|case|default)$/i.test(trimmed)) {
      return '';
    }

    if (trimmed.length <= 2) {
      return '';
    }

    return trimmed;
  }

  private publishPreview(lines: string[]): void {
    if (!this.state) {
      return;
    }

    this.state.previewText = this.postProcessPreview(lines);
    this.changeEmitter.fire(this.state.previewUri);
  }

  private postProcessPreview(lines: string[]): string {
    const cleaned = lines
      .map((line) => line.replace(/[\t ]+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();

    return cleaned || 'Type pseudocode to see live generated code here.';
  }

  private getBlockContext(sourceLines: string[], currentIndex: number): string {
    const windowStart = Math.max(0, currentIndex - 12);
    const windowEnd = Math.min(sourceLines.length, currentIndex + 1);
    const lines = sourceLines.slice(windowStart, windowEnd).filter((line) => line.trim().length > 0);
    const structuralLines = lines.filter((line) => {
      const trimmed = line.trim();
      return /^(define|create|build|make|if|else|for each|for every|while|return|call|set|assign|let|class|interface|function|method|constructor|try|catch|repeat|until)/i.test(trimmed);
    });

    return (structuralLines.length > 0 ? structuralLines : lines).slice(-8).join('\n');
  }

  private inferIntent(sourceLines: string[], generatedLines: string[], currentIndex: number): string {
    const currentLine = (sourceLines[currentIndex] || '').trim();
    const prevLine = this.findNearestNonEmptyLine(sourceLines, currentIndex - 1);
    const nextLine = this.findNearestNonEmptyLine(sourceLines, currentIndex + 1, 1);
    const recentGenerated = generatedLines.slice(-4).join(' | ') || '(none yet)';
    const parts = [currentLine, prevLine, nextLine].filter(Boolean);

    if (parts.length === 0) {
      return 'blank or structural continuation';
    }

    return `${parts.join(' -> ')} ; recent code: ${recentGenerated}`;
  }

  private findNearestNonEmptyLine(lines: string[], startIndex: number, step = -1): string {
    let index = startIndex;
    while (index >= 0 && index < lines.length) {
      const value = lines[index].trim();
      if (value) {
        return value;
      }
      index += step;
    }

    return '';
  }

  private resolveCurrentSource(editor: vscode.TextEditor): { source: string; range: vscode.Range } {
    if (!editor.selection.isEmpty) {
      const range = new vscode.Range(editor.selection.start, editor.selection.end);
      return { source: editor.document.getText(range), range };
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

      const range = new vscode.Range(startLine, 0, endLine, 1000);
      return { source: editor.document.getText(range), range };
    }

    const range = editor.document.lineAt(editor.selection.active.line).range;
    return { source: editor.document.getText(range), range };
  }

  private isTrackedDocument(document: vscode.TextDocument): boolean {
    return this.sourceLanguageIds.has(document.languageId);
  }

  private buildPreviewUri(sourceUri: vscode.Uri, targetLanguage: string): vscode.Uri {
    const baseName = sourceUri.path.split('/').pop() || 'live-preview';
    const normalizedName = baseName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'live-preview';
    const extension = LANGUAGE_EXTENSIONS[targetLanguage] || 'txt';
    return vscode.Uri.from({
      scheme: LIVE_PREVIEW_SCHEME,
      path: `/${normalizedName}.${extension}`
    });
  }
}