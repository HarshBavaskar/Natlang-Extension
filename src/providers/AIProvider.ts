import * as https from 'https';
import * as http from 'http';

export interface AIProvider {
  generate(system: string, user: string, onToken: (token: string) => void): Promise<string>;
  isConfigured(): boolean;
  getName(): string;
  getModel(): string;
}

export async function makeHttpsRequest(
  urlStr: string,
  path: string | undefined, // path can be part of URL or separate
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  onData: (chunk: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      const lib = url.protocol === 'https:' ? https : http;
      
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: path || url.pathname + url.search,
        method,
        headers,
      };

      const req = lib.request(options, (res) => {
        let responseBody = '';

      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        onData(chunkStr);
        responseBody += chunkStr;
      });

      res.on('end', () => {
        if (res.statusCode! >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        } else {
          resolve();
        }
      });
    });

    req.on('error', reject);

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}
