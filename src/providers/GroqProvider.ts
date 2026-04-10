import { AIProvider, makeHttpsRequest } from './AIProvider';

export class GroqProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'openai/gpt-oss-120b') {
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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onToken(content);
              fullResponse += content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    };

    await makeHttpsRequest(
      'https://api.groq.com',
      '/openai/v1/chat/completions',
      'POST',
      {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      JSON.stringify({
        model: this.model,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0
      }),
      onData
    );

    return fullResponse;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getName(): string {
    return 'Groq';
  }

  getModel(): string {
    return this.model;
  }
}