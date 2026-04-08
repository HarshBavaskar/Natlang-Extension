import * as path from 'path';
import * as vscode from 'vscode';

interface RegexTransform {
  find: string;
  replace: string;
  flags?: string;
}

interface PluginSpec {
  name: string;
  version: string;
  preParse?: RegexTransform[];
  postEmit?: RegexTransform[];
}

export class PluginEngine {
  async ensurePluginFolder(): Promise<vscode.Uri> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace folder first.');
    }
    const pluginsDir = vscode.Uri.joinPath(folder.uri, '.natlang', 'plugins');
    await vscode.workspace.fs.createDirectory(pluginsDir);
    return pluginsDir;
  }

  async scaffoldSamplePlugin(): Promise<vscode.Uri> {
    const dir = await this.ensurePluginFolder();
    const uri = vscode.Uri.file(path.join(dir.fsPath, 'sample-plugin.json'));
    const sample: PluginSpec = {
      name: 'sample-normalizer',
      version: '1.0.0',
      preParse: [
        {
          find: 'equals',
          replace: '=='
        }
      ],
      postEmit: [
        {
          find: '\\s+$',
          replace: '',
          flags: 'gm'
        }
      ]
    };
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(sample, null, 2), 'utf8'));
    return uri;
  }

  async applyPreParse(input: string): Promise<{ output: string; applied: string[] }> {
    return this.apply(input, 'preParse');
  }

  async applyPostEmit(input: string): Promise<{ output: string; applied: string[] }> {
    return this.apply(input, 'postEmit');
  }

  private async apply(input: string, stage: 'preParse' | 'postEmit'): Promise<{ output: string; applied: string[] }> {
    const plugins = await this.loadPlugins();
    let output = input;
    const applied: string[] = [];

    for (const plugin of plugins) {
      const transforms = stage === 'preParse' ? plugin.preParse : plugin.postEmit;
      if (!transforms || transforms.length === 0) {
        continue;
      }

      for (const t of transforms) {
        try {
          const regex = new RegExp(t.find, t.flags || 'g');
          const before = output;
          output = output.replace(regex, t.replace);
          if (before !== output) {
            applied.push(`${plugin.name}@${plugin.version} (${stage})`);
          }
        } catch {
          // Ignore malformed plugin rule.
        }
      }
    }

    return { output, applied };
  }

  private async loadPlugins(): Promise<PluginSpec[]> {
    const dir = await this.ensurePluginFolder();
    const entries = await vscode.workspace.fs.readDirectory(dir);
    const plugins: PluginSpec[] = [];

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !name.endsWith('.json')) {
        continue;
      }
      const uri = vscode.Uri.file(path.join(dir.fsPath, name));
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as PluginSpec;
        if (parsed.name && parsed.version) {
          plugins.push(parsed);
        }
      } catch {
        // Skip malformed plugin files.
      }
    }

    return plugins;
  }
}
