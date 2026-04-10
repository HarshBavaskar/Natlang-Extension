import * as vscode from 'vscode';
import { AIProvider } from './providers/AIProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GroqProvider } from './providers/GroqProvider';
import { buildPrompt } from './PromptBuilder';

interface HistoryEntry {
  timestamp: number;
  fileName: string;
  pseudocode: string;
  code: string;
  language: string;
  provider: string;
  topic: string;
  complexity: string;
}

export interface GenerationOptions {
  persistResult?: boolean;
}

export class TranspilerEngine {
  private context: vscode.ExtensionContext;
  private lastGeneratedCode: string = '';
  private lastGeneratedLanguage: string = '';
  private isGenerating: boolean = false;
  private history: HistoryEntry[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this._loadHistory();
  }

  private _loadHistory(): void {
    const stored = this.context.globalState.get<HistoryEntry[]>('natlang.history');
    if (stored) {
      this.history = stored;
    }
  }

  private _saveHistory(): void {
    this.context.globalState.update('natlang.history', this.history);
  }

  async getProvider(): Promise<AIProvider> {
    const config = vscode.workspace.getConfiguration('natlang');
    const providerName = config.get('aiProvider') as string || 'ollama';

    switch (providerName) {
      case 'ollama':
        return new OllamaProvider(
          config.get('ollamaBaseUrl') as string || 'http://localhost:11434',
          config.get('ollamaModel') as string || 'gemma3:4b'
        );

      case 'anthropic': {
        const apiKey = await this.context.secrets.get('natlang.anthropicKey') || '';
        if (!apiKey) throw new Error('NO_API_KEY:anthropic');
        return new AnthropicProvider(apiKey, config.get('anthropicModel') as string || 'claude-3-5-sonnet-20240620');
      }

      case 'gemini': {
        const apiKey = await this.context.secrets.get('natlang.geminiKey') || '';
        if (!apiKey) throw new Error('NO_API_KEY:gemini');
        return new GeminiProvider(apiKey, config.get('geminiModel') as string || 'gemini-1.5-flash');
      }

      case 'openai': {
        const apiKey = await this.context.secrets.get('natlang.openaiKey') || '';
        if (!apiKey) throw new Error('NO_API_KEY:openai');
        return new OpenAIProvider(apiKey, config.get('openaiModel') as string || 'gpt-4o');
      }

      case 'groq': {
        const apiKey = await this.context.secrets.get('natlang.groqKey') || '';
        if (!apiKey) throw new Error('NO_API_KEY:groq');
        return new GroqProvider(apiKey, config.get('groqModel') as string || 'llama-3.3-70b-versatile');
      }

      default:
        throw new Error(`UNKNOWN_PROVIDER: ${providerName}`);
    }
  }

  async generate(
    pseudocode: string,
    language: string,
    fileName: string,
    onToken: (token: string) => void,
    options: GenerationOptions = {}
  ): Promise<string> {
    if (this.isGenerating) {
      throw new Error('ALREADY_GENERATING');
    }

    this.isGenerating = true;
    let lastError: Error | null = null;
    
    let currentRaw = '';
    let filteredStarted = false;
    let buffer = '';

    let stoppedEarly = false;
    const streamedOnToken = (token: string) => {
        if (stoppedEarly) return;
        currentRaw += token;
        
        if (!filteredStarted) {
            buffer += token;
            if (buffer.length > 200) {
                filteredStarted = true;
                const stripped = this.stripPreambles(buffer);
                if (stripped) onToken(stripped);
            } else {
                const stripped = this.stripPreambles(buffer);
                if (stripped.length > 0 && !buffer.includes('`')) {
                   const codeStarts = /^(import|const|let|var|function|public|private|class|def|#|\/\/|package|using|@|\[|\{|if\s|for\s|while\s|return\s)/i;
                   if (codeStarts.test(stripped) || buffer.includes('\n\n')) {
                        filteredStarted = true;
                        onToken(stripped);
                   }
                }
            }
        } else {
            // Post-amble detection: if code ended and conversational text starts
            if ((token.includes('```') || token.includes('~~~')) && currentRaw.split('\n').length > 1) {
                stoppedEarly = true;
                return;
            }

            // Check if the previous text ended with a newline and this token starts an explanation
            const previousText = currentRaw.substring(0, currentRaw.length - token.length);
            if (previousText.endsWith('\n') || previousText.trim() === '') {
                const postAmbles = /^(Note|This|The|Explanation|In this|To run|I hope|Let me|Summary|Follow these)/i;
                if (postAmbles.test(token.trim())) {
                    stoppedEarly = true;
                    return;
                }
            }

            const filtered = token.replace(/```/g, '').replace(/~~~/g, '');
            if (filtered) onToken(filtered);
        }
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const provider = await this.getProvider();
        const { system, user } = buildPrompt(pseudocode, language);
        
        currentRaw = ''; 
        const code = await provider.generate(system, user, streamedOnToken);
        
        const cleanedCode = await this.refineAndFinalizeGeneratedCode(provider, code, language, pseudocode);
        const finalCode = cleanedCode;
        
        let topic = 'General Script';
        let complexity = 'Standard';
        try {
            const metaResult = await provider.generate(
                "You are a code analyzer. Extract a 2-3 word topic and a complexity level (Simple, Moderate, Complex). Output format: TOPIC | COMPLEXITY. No other text.",
            `Analyze this ${language} code:\n\n${finalCode}`,
                () => {}
            );
            const [t, c] = metaResult.split('|');
            if (t) topic = t.trim();
            if (c) complexity = c.trim();
        } catch (e) { /* Defaults */ }

        if (options.persistResult !== false) {
          this.lastGeneratedCode = finalCode;
          this.lastGeneratedLanguage = language;

          this.history.unshift({
            timestamp: Date.now(),
            fileName,
            pseudocode,
            code: finalCode,
            language,
            provider: provider.getName(),
            topic,
            complexity
          });
          if (this.history.length > 50) this.history = this.history.slice(0, 50);
          this._saveHistory();
        }

        this.isGenerating = false;
        return finalCode;
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.isGenerating = false;
    throw lastError!;
  }

  public sanitizeStreamingLine(line: string, language: string): string {
    const cleaned = this.sanitizeLine(line, language, true);
    return cleaned ?? '';
  }

  private stripPreambles(text: string): string {
    let clean = text.trimStart();
    clean = clean.replace(/^```(\w+)?\s*\n?/i, '');
    clean = clean.replace(/^~~~(\w+)?\s*\n?/i, '');
    // Regex for common conversational preambles
    const preambleRegex = /^(Sure!|Certainly|Here is|Here's|Sure,|Of course|Certainly,|Below is|Attached is|I have|The code|Transforming|Converting|The requested|I've|As requested|Based on).+?(\.\s*|\:\s*|\!\s*)\n*/i;
    clean = clean.replace(preambleRegex, '');
    clean = clean.replace(/^`+/g, '');
    return clean;
  }

  private finalizeGeneratedCode(code: string, language: string): string {
    let result = code.trim();

    for (let pass = 0; pass < 3; pass++) {
      const next = this.cleanupCodePass(result, language);
      if (next === result) {
        break;
      }
      result = next;
    }

    return result;
  }

  private async refineAndFinalizeGeneratedCode(
    provider: AIProvider,
    code: string,
    language: string,
    pseudocode: string
  ): Promise<string> {
    const firstPass = this.finalizeGeneratedCode(code, language);
    if (!firstPass) {
      return firstPass;
    }

    try {
      const system = [
        `You are a strict ${language} code refiner.`,
        'Return raw code only.',
        'Do not output markdown, comments, explanations, notes, or prompts.',
        'Preserve the original intent and context exactly.',
        'Repair indentation, blank lines, syntax, formatting, and any visible artifacts.',
        'If the code is already correct, return it unchanged except for cleanup.'
      ].join(' ');

      const user = [
        'Refine this code using the original pseudocode context and return the final code only.',
        '',
        'Original pseudocode:',
        pseudocode,
        '',
        'Current code:',
        firstPass
      ].join('\n');

      const secondPass = await provider.generate(system, user, () => {});
      const refined = this.finalizeGeneratedCode(secondPass || firstPass, language);
      if (!refined || !this.hasVisibleArtifactSignals(refined)) {
        return refined || firstPass;
      }

      const thirdPass = await provider.generate(system, user, () => {});
      const retested = this.finalizeGeneratedCode(thirdPass || refined, language);
      return retested || refined || firstPass;
    } catch {
      return firstPass;
    }
  }

  private cleanupCodePass(code: string, language: string): string {
    let result = code.replace(/\r/g, '').trim();

    // Prefer fenced body when model wraps code in markdown.
    const fenced = result.match(/```(?:[\w#+.-]+)?\s*\n?([\s\S]*?)\n?```/);
    if (fenced && fenced[1]) {
      result = fenced[1].trim();
    }

    // Remove markdown wrappers and lightweight formatting that can leak into output.
    result = result.replace(/```(?:[\w#+.-]+)?/g, '');
    result = result.replace(/~~~(?:[\w#+.-]+)?/g, '');
    result = result.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    result = result.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+(?=[A-Za-z])/gm, '');
    result = result.replace(/^\s*`([^`]+)`\s*$/gm, '$1');

    const lines = result.split('\n');
    const filteredLines: string[] = [];

    for (const line of lines) {
      const sanitized = this.sanitizeLine(line, language, false);
      if (sanitized === null) {
        continue;
      }
      filteredLines.push(sanitized);
    }

    result = filteredLines.join('\n');
    result = result.replace(/^(Here is|Here's|Sure|Certainly|As requested|Below is|The code|Transforming|Converting|Output raw|STRICT INSTRUCTION|System prompt|Prompt|Note|Explanation|Summary).+?(\n+|$)/i, '');

    // Trim only leading/trailing empty lines; preserve code structure.
    return result.replace(/^\s*\n+|\n+\s*$/g, '');
  }

  private sanitizeLine(line: string, language: string, keepBlankLines: boolean): string | null {
    const trimmed = line.trim();
    if (!trimmed) {
      return keepBlankLines ? '' : '';
    }

    if (this.isArtifactLine(trimmed, language)) {
      return null;
    }

    return line.replace(/[\t ]+$/g, '');
  }

  private isArtifactLine(trimmedLine: string, language: string): boolean {
    const artifactPhrases = [
      /^(Here is|Here's|Sure|Certainly|As requested|Below is|The code|Transforming|Converting|Output raw|STRICT INSTRUCTION|System prompt|Prompt|Note|Explanation|Summary|Follow these|Let me)/i,
      /^(Do not|Don't|Never|No comments|No markdown|No fences|No explanations|No conversational text)/i,
      /^(Convert this pseudocode|STRICT INSTRUCTION:|STRICTLY:|Instruction:)/i
    ];

    if (artifactPhrases.some((pattern) => pattern.test(trimmedLine))) {
      return true;
    }

    if (/^(\/\/|\/\*|\*\/|\*\s)/.test(trimmedLine)) {
      return true;
    }

    if (/^--\s*/.test(trimmedLine)) {
      return true;
    }

    if (language === 'Python' || language === 'Bash' || language === 'PowerShell' || language === 'Shell' || language === 'YAML') {
      if (/^#\s+/.test(trimmedLine)) {
        return true;
      }
    }

    return false;
  }

  private hasVisibleArtifactSignals(text: string): boolean {
    if (!text) {
      return false;
    }

    const suspiciousPatterns = [
      /(?:^|\n)\s*(Here is|Here's|Sure|Certainly|As requested|Below is|The code|Transforming|Converting|Prompt|Note|Explanation|Summary|System prompt)/i,
      /(?:^|\n)\s*(Do not|Don't|Never|No comments|No markdown|No fences|No explanations|No conversational text)/i,
      /```|~~~/,
      /\b(?:prompt|instructions?|artifact|notes?|comments?)\b/i
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(text));
  }


  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    void this.context.globalState.update('natlang.history', []);
  }

  getLastCode(): string {
    return this.lastGeneratedCode;
  }

  getLastLanguage(): string {
    return this.lastGeneratedLanguage;
  }

  isCurrentlyGenerating(): boolean {
    return this.isGenerating;
  }
}
