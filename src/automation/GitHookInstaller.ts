import * as path from 'path';
import * as vscode from 'vscode';

export class GitHookInstaller {
  async installPreCommitHook(policyPath: string): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      throw new Error('Open a workspace folder first.');
    }

    const hooksDir = path.join(root, '.git', 'hooks');
    const scriptDir = path.join(root, '.natlang');
    const checkerPath = path.join(scriptDir, 'policy-check.js');
    const hookPath = path.join(hooksDir, 'pre-commit');

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(scriptDir));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(hooksDir));

    const checker = this.buildPolicyCheckerScript(policyPath);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(checkerPath), Buffer.from(checker, 'utf8'));

    const hook = '#!/bin/sh\nnode .natlang/policy-check.js\nif [ $? -ne 0 ]; then\n  echo "NatLang policy check failed"\n  exit 1\nfi\n';
    await vscode.workspace.fs.writeFile(vscode.Uri.file(hookPath), Buffer.from(hook, 'utf8'));
  }

  private buildPolicyCheckerScript(policyPath: string): string {
    const normalized = policyPath.replace(/\\/g, '\\\\');
    return [
      "const fs = require('fs');",
      "const cp = require('child_process');",
      `const policyPath = '${normalized}';`,
      "let policy;",
      "try { policy = JSON.parse(fs.readFileSync(policyPath, 'utf8')); } catch (e) { console.log('NatLang: policy file missing, skipping'); process.exit(0); }",
      "const blocked = Array.isArray(policy.blockedPatterns) ? policy.blockedPatterns : [];",
      "const required = Array.isArray(policy.requiredPatterns) ? policy.requiredPatterns : [];",
      "const files = cp.execSync('git diff --cached --name-only', { encoding: 'utf8' }).split(/\\r?\\n/).filter(Boolean);",
      "let failed = false;",
      "for (const file of files) {",
      "  if (!fs.existsSync(file)) continue;",
      "  const text = fs.readFileSync(file, 'utf8');",
      "  for (const rule of blocked) {",
      "    try { const re = new RegExp(rule.pattern, rule.flags || 'i'); if (re.test(text)) { console.error(`Blocked by ${rule.id} in ${file}`); failed = true; } } catch {}",
      "  }",
      "  for (const rule of required) {",
      "    try { const re = new RegExp(rule.pattern, rule.flags || 'i'); if (!re.test(text)) { console.error(`Missing required ${rule.id} in ${file}`); failed = true; } } catch {}",
      "  }",
      "}",
      "process.exit(failed ? 1 : 0);"
    ].join('\n');
  }
}
