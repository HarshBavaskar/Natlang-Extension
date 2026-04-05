import { AIProvider, makeHttpsRequest } from './AIProvider';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(system: string, user: string, onToken: (token: string) => void): Promise<string> {
    let fullResponse = '';

    const onData = (chunk: string) => {
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              onToken(text);
              fullResponse += text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    };

    const urlPath = `/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    await makeHttpsRequest(
      'https://generativelanguage.googleapis.com',
      urlPath,
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
        }
      }),
      onData
    );

    return fullResponse;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getName(): string {
    return 'Gemini';
  }

  getModel(): string {
    return this.model;
  }
}
