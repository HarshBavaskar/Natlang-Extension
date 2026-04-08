import * as path from 'path';
import * as vscode from 'vscode';

interface OwnerRule {
  pattern: string;
  owner: string;
}

interface OwnerApprovalConfig {
  requireOwnerApproval: boolean;
  ownerTokens: Record<string, string>;
}

export class OwnershipGuard {
  async openOrCreateConfig(): Promise<void> {
    const uri = await this.getConfigUri();
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      const initial: OwnerApprovalConfig = {
        requireOwnerApproval: false,
        ownerTokens: {}
      };
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(initial, null, 2), 'utf8'));
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }

  async enforce(uris: vscode.Uri[]): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.loadConfig();
    if (!config.requireOwnerApproval) {
      return { allowed: true };
    }

    const rules = await this.loadCodeOwnersRules();
    if (rules.length === 0) {
      return { allowed: false, reason: 'Owner approval is enabled, but CODEOWNERS has no usable rules.' };
    }

    const owners = new Set<string>();
    for (const uri of uris) {
      const owner = this.findOwner(uri, rules);
      if (owner) {
        owners.add(owner);
      }
    }

    for (const owner of owners) {
      const expectedToken = config.ownerTokens[owner];
      if (!expectedToken) {
        return { allowed: false, reason: `No approval token configured for owner '${owner}'.` };
      }

      const entered = await vscode.window.showInputBox({
        prompt: `Enter approval token for owner ${owner}`,
        password: true,
        ignoreFocusOut: true
      });

      if (!entered || entered !== expectedToken) {
        return { allowed: false, reason: `Approval token failed for owner '${owner}'.` };
      }
    }

    return { allowed: true };
  }

  private async loadConfig(): Promise<OwnerApprovalConfig> {
    const uri = await this.getConfigUri();
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as OwnerApprovalConfig;
      return {
        requireOwnerApproval: !!parsed.requireOwnerApproval,
        ownerTokens: parsed.ownerTokens || {}
      };
    } catch {
      return {
        requireOwnerApproval: false,
        ownerTokens: {}
      };
    }
  }

  private async loadCodeOwnersRules(): Promise<OwnerRule[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return [];
    }

    const candidates = [
      vscode.Uri.joinPath(folder.uri, 'CODEOWNERS'),
      vscode.Uri.joinPath(folder.uri, '.github', 'CODEOWNERS')
    ];

    for (const uri of candidates) {
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const lines = Buffer.from(raw).toString('utf8').split(/\r?\n/);
        const rules: OwnerRule[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            rules.push({ pattern: parts[0], owner: parts[1] });
          }
        }
        if (rules.length > 0) {
          return rules;
        }
      } catch {
        // Try next location.
      }
    }

    return [];
  }

  private findOwner(uri: vscode.Uri, rules: OwnerRule[]): string | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return null;
    }

    const rel = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
    let matched: string | null = null;

    for (const rule of rules) {
      const regex = this.patternToRegex(rule.pattern);
      if (regex.test(rel)) {
        matched = rule.owner;
      }
    }

    return matched;
  }

  private patternToRegex(pattern: string): RegExp {
    const normalized = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${normalized}`);
  }

  private async getConfigUri(): Promise<vscode.Uri> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace folder first.');
    }

    const policyDir = vscode.Uri.joinPath(folder.uri, '.natlang');
    await vscode.workspace.fs.createDirectory(policyDir);
    return vscode.Uri.joinPath(policyDir, 'owner-approvals.json');
  }
}
