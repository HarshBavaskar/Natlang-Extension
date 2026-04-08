import * as path from 'path';
import * as vscode from 'vscode';
import { runDeterministicBenchmark } from './CompilerSelfTest';

interface BaselineFile {
  createdAt: string;
  outputs: Record<string, string>;
}

export class BaselineManager {
  async captureBaseline(): Promise<{ path: string; entries: number }> {
    const benchmark = runDeterministicBenchmark();
    const root = await this.getBaselineDir();
    const target = vscode.Uri.file(path.join(root.fsPath, 'deterministic-baseline.json'));
    const payload: BaselineFile = {
      createdAt: new Date().toISOString(),
      outputs: benchmark.outputs
    };
    await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
    return { path: target.fsPath, entries: Object.keys(payload.outputs).length };
  }

  async detectDrift(): Promise<{ driftCount: number; details: string[] }> {
    const root = await this.getBaselineDir();
    const target = vscode.Uri.file(path.join(root.fsPath, 'deterministic-baseline.json'));

    let baseline: BaselineFile;
    try {
      const raw = await vscode.workspace.fs.readFile(target);
      baseline = JSON.parse(Buffer.from(raw).toString('utf8')) as BaselineFile;
    } catch {
      return { driftCount: 0, details: ['No baseline found. Capture one first.'] };
    }

    const latest = runDeterministicBenchmark();
    const details: string[] = [];
    let driftCount = 0;

    for (const [key, value] of Object.entries(latest.outputs)) {
      const prev = baseline.outputs[key];
      if (prev === undefined) {
        driftCount += 1;
        details.push(`New output key: ${key}`);
        continue;
      }
      if (prev !== value) {
        driftCount += 1;
        details.push(`Drift detected: ${key}`);
      }
    }

    for (const key of Object.keys(baseline.outputs)) {
      if (!(key in latest.outputs)) {
        driftCount += 1;
        details.push(`Missing output key in latest run: ${key}`);
      }
    }

    if (driftCount === 0) {
      details.push('No drift detected.');
    }

    return { driftCount, details };
  }

  private async getBaselineDir(): Promise<vscode.Uri> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace folder first.');
    }
    const dir = vscode.Uri.joinPath(folder.uri, '.natlang', 'baselines');
    await vscode.workspace.fs.createDirectory(dir);
    return dir;
  }
}
