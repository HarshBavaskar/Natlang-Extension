import { AIProvider, makeHttpsRequest } from './AIProvider';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'codellama') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generate(system: string, user: string, onToken: (token: string) => void): Promise<string> {
    const prompt = user + '\n\nSystem: ' + system;
    let fullResponse = '';

    const onData = (chunk: string) => {
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim() === '') continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            const token = parsed.response;
            onToken(token);
            fullResponse += token;
          }
          if (parsed.done) {
            return;
          }
        } catch (e) {
          // Invalid JSON line, skip
        }
      }
    };

    await makeHttpsRequest(
      this.baseUrl,
      '/api/generate',
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
        options: {
          temperature: 0
        }
      }),
      onData
    );

    if (fullResponse === '') {
      throw new Error('OLLAMA_OFFLINE');
    }

    return fullResponse;
  }

  isConfigured(): boolean {
    return true;
  }

  getName(): string {
    return 'Ollama';
  }

  getModel(): string {
    return this.model;
  }
}
