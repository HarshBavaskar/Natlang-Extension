import { AIProvider, makeHttpsRequest } from './AIProvider';

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20240620') {
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
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
              const token = parsed.delta.text;
              onToken(token);
              fullResponse += token;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    };

    await makeHttpsRequest(
      'https://api.anthropic.com',
      '/v1/messages',
      'POST',
      {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        stream: true,
        system,
        messages: [{ role: 'user', content: user }],
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
    return 'Anthropic';
  }

  getModel(): string {
    return this.model;
  }
}
