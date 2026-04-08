import * as http from 'http';
import * as https from 'https';

export interface AgenticProcessRequest {
  userId?: number;
  action?: 'optimize' | 'summarize' | 'better' | 'auto';
  prompt?: string;
  code?: string;
  language: string;
  provider: string;
  projectContext?: string;
}

export interface AgenticProcessResponse {
  finalCode: string;
  optimizedCode: string;
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
  suggestions: string;
  topic: string;
  steps: string[];
  decisionLog: string;
}

export interface ProviderRuntimeStatus {
  provider: string;
  model: string;
  configured: boolean;
  reachable: boolean;
  detail: string;
}

export interface DictionaryEntry {
  term: string;
  canonical: string;
  confidence?: number;
  source?: string;
}

interface ProviderHealthStatus {
  provider: string;
  configured: boolean;
  reachable: boolean;
  detail: string;
}

export class AgenticBackendClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async process(payload: AgenticProcessRequest): Promise<AgenticProcessResponse> {
    return new Promise<AgenticProcessResponse>((resolve, reject) => {
      const target = new URL(`${this.baseUrl}/api/process`);
      const body = JSON.stringify(payload);
      const lib = target.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk.toString();
          });
          res.on('end', () => {
            if ((res.statusCode || 500) >= 400) {
              let detail = `${res.statusCode} ${res.statusMessage}`;
              try {
                const parsed = JSON.parse(raw) as { error?: string; detail?: string };
                const errorMessage = parsed.error || '';
                const detailMessage = parsed.detail || '';
                detail = detailMessage || errorMessage || detail;
                if (errorMessage && detailMessage && errorMessage.toLowerCase() !== 'internal server error') {
                  detail = `${errorMessage}: ${detailMessage}`;
                }
              } catch {
                // Ignore non-JSON error body and preserve HTTP detail.
              }
              reject(new Error(`Agentic backend request failed: ${detail}`));
              return;
            }

            try {
              resolve(JSON.parse(raw) as AgenticProcessResponse);
            } catch (error) {
              reject(new Error(`Failed to parse agentic backend response: ${(error as Error).message}`));
            }
          });
        }
      );

      req.on('error', (error) => reject(error));
      req.write(body);
      req.end();
    });
  }

  async getProviderRuntimeStatus(): Promise<ProviderRuntimeStatus[]> {
    try {
      return await this.getProviderRuntimeStatusFromEndpoint('/api/providers/runtime');
    } catch (error) {
      const message = (error as Error).message || '';
      if (message.includes('No static resource api/providers/runtime') || message.includes('Failed to load provider runtime status: 404')) {
        const health = await this.getProviderHealthStatus();
        return health.map((item) => ({
          provider: item.provider,
          model: '',
          configured: item.configured,
          reachable: item.reachable,
          detail: item.detail
        }));
      }
      throw error;
    }
  }

  async ingestDictionary(entries: DictionaryEntry[]): Promise<number> {
    return this.requestJson<number>('/api/dictionary/ingest', 'POST', { entries });
  }

  async getDictionary(): Promise<DictionaryEntry[]> {
    return this.requestJson<DictionaryEntry[]>('/api/dictionary', 'GET');
  }

  private async requestJson<T>(pathname: string, method: 'GET' | 'POST', payload?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const target = new URL(`${this.baseUrl}${pathname}`);
      const lib = target.protocol === 'https:' ? https : http;
      const body = payload ? JSON.stringify(payload) : '';

      const headers: Record<string, string | number> = {};
      if (body) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = lib.request(
        {
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method,
          headers
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk.toString();
          });
          res.on('end', () => {
            if ((res.statusCode || 500) >= 400) {
              let detail = `${res.statusCode} ${res.statusMessage}`;
              try {
                const parsed = JSON.parse(raw) as { error?: string; detail?: string };
                detail = parsed.detail || parsed.error || detail;
              } catch {
                // Preserve HTTP detail when body is not JSON.
              }
              reject(new Error(`Backend request failed: ${detail}`));
              return;
            }

            try {
              if (!raw.trim()) {
                resolve(undefined as T);
                return;
              }
              resolve(JSON.parse(raw) as T);
            } catch (error) {
              reject(new Error(`Failed to parse backend response: ${(error as Error).message}`));
            }
          });
        }
      );

      req.on('error', (error) => reject(error));
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  private async getProviderRuntimeStatusFromEndpoint(pathname: string): Promise<ProviderRuntimeStatus[]> {
    return new Promise<ProviderRuntimeStatus[]>((resolve, reject) => {
      const target = new URL(`${this.baseUrl}${pathname}`);
      const lib = target.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method: 'GET'
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk.toString();
          });
          res.on('end', () => {
            if ((res.statusCode || 500) >= 400) {
              let detail = `${res.statusCode} ${res.statusMessage}`;
              try {
                const parsed = JSON.parse(raw) as { error?: string; detail?: string };
                detail = parsed.detail || parsed.error || detail;
              } catch {
                // Preserve HTTP detail when the body is not JSON.
              }
              reject(new Error(`Failed to load provider runtime status: ${detail}`));
              return;
            }

            try {
              resolve(JSON.parse(raw) as ProviderRuntimeStatus[]);
            } catch (error) {
              reject(new Error(`Failed to parse provider runtime status: ${(error as Error).message}`));
            }
          });
        }
      );

      req.on('error', (error) => reject(error));
      req.end();
    });
  }

  private async getProviderHealthStatus(): Promise<ProviderHealthStatus[]> {
    return new Promise<ProviderHealthStatus[]>((resolve, reject) => {
      const target = new URL(`${this.baseUrl}/api/providers/health`);
      const lib = target.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method: 'GET'
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk.toString();
          });
          res.on('end', () => {
            if ((res.statusCode || 500) >= 400) {
              let detail = `${res.statusCode} ${res.statusMessage}`;
              try {
                const parsed = JSON.parse(raw) as { error?: string; detail?: string };
                detail = parsed.detail || parsed.error || detail;
              } catch {
                // Preserve HTTP detail when the body is not JSON.
              }
              reject(new Error(`Failed to load provider health status: ${detail}`));
              return;
            }

            try {
              resolve(JSON.parse(raw) as ProviderHealthStatus[]);
            } catch (error) {
              reject(new Error(`Failed to parse provider health status: ${(error as Error).message}`));
            }
          });
        }
      );

      req.on('error', (error) => reject(error));
      req.end();
    });
  }
}
