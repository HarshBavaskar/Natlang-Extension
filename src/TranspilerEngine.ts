import * as vscode from 'vscode';
import { AIProvider } from './providers/AIProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
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
          config.get('ollamaModel') as string || 'codellama'
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

      default:
        throw new Error(`UNKNOWN_PROVIDER: ${providerName}`);
    }
  }

  async generate(pseudocode: string, language: string, fileName: string, onToken: (token: string) => void): Promise<string> {
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
        
        const cleanedCode = this.cleanupCode(code);
        
        let topic = 'General Script';
        let complexity = 'Standard';
        try {
            const metaResult = await provider.generate(
                "You are a code analyzer. Extract a 2-3 word topic and a complexity level (Simple, Moderate, Complex). Output format: TOPIC | COMPLEXITY. No other text.",
                `Analyze this ${language} code:\n\n${cleanedCode}`,
                () => {}
            );
            const [t, c] = metaResult.split('|');
            if (t) topic = t.trim();
            if (c) complexity = c.trim();
        } catch (e) { /* Defaults */ }

        this.lastGeneratedCode = cleanedCode;
        this.lastGeneratedLanguage = language;

        this.history.unshift({
          timestamp: Date.now(),
          fileName,
          pseudocode,
          code: cleanedCode,
          language,
          provider: provider.getName(),
          topic,
          complexity
        });
        if (this.history.length > 50) this.history = this.history.slice(0, 50);
        this._saveHistory();

        this.isGenerating = false;
        return cleanedCode;
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.isGenerating = false;
    throw lastError!;
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

  private cleanupCode(code: string): string {
    let result = code.trim();
    
    // Remove markdown fences
    if (result.includes('```')) {
        const match = result.match(/```(?:\w+)?\n([\s\S]+?)\n?```/);
        if (match && match[1]) {
            result = match[1];
        } else {
            result = result.replace(/```/g, '');
        }
    }
    
    // Remove conversational filler
    result = result.replace(/^(Here is|Sure|Sure!|Certainly|As requested|Below is|The code|Transforming).+?:\n+/i, '');
    
    // FINAL SAFETY: Strip all comments manually
    // Handles //, /* */ and #
    result = result.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*|#.*/g, '$1');
    
    // Remove empty lines created by comment stripping
    return result.split('\n').filter(line => line.trim().length > 0).join('\n').trim();
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
