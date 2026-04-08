import * as crypto from 'crypto';
import * as vscode from 'vscode';

export interface PolicyViolation {
  rule: string;
  message: string;
}

export interface PolicyEvaluation {
  mode: 'enforce' | 'warn';
  violations: PolicyViolation[];
  warnings: string[];
  profile: string;
}

interface PatternRule {
  id: string;
  description: string;
  pattern: string;
  flags?: string;
}

interface PolicyDocument {
  schemaVersion?: number;
  mode?: 'enforce' | 'warn';
  blockedPatterns?: PatternRule[];
  requiredPatterns?: PatternRule[];
}

interface PolicyLock {
  schemaVersion: 1;
  profile: string;
  hash: string;
  updatedAt: string;
}

const DEFAULT_POLICY: PolicyDocument = {
  schemaVersion: 1,
  mode: 'enforce',
  blockedPatterns: [
    {
      id: 'no-eval',
      description: 'Blocks eval usage.',
      pattern: '\\beval\\s*\\('
    },
    {
      id: 'no-shell-exec',
      description: 'Blocks shell execution APIs.',
      pattern: 'Runtime\\.getRuntime\\(\\)\\.exec|child_process\\.exec|subprocess\\.Popen'
    }
  ],
  requiredPatterns: []
};

export class PolicyEngine {
  async evaluateCode(code: string): Promise<PolicyViolation[]> {
    const result = await this.evaluateDetailed(code);
    return result.violations;
  }

  async evaluateDetailed(code: string): Promise<PolicyEvaluation> {
    const profile = await this.getActiveProfile();
    const { policy, warnings } = await this.loadPolicy(profile);
    const violations: PolicyViolation[] = [];

    const lockStatus = await this.verifyPolicyLock();
    if (lockStatus.lockExists && !lockStatus.valid) {
      violations.push({
        rule: 'policy-lock-integrity',
        message: `Policy lock mismatch for profile '${profile}'. Expected ${lockStatus.expectedHash}, got ${lockStatus.actualHash}.`
      });
    }

    for (const rule of policy.blockedPatterns || []) {
      const regex = this.safeRegex(rule.pattern, rule.flags);
      if (!regex) {
        warnings.push(`Invalid blocked pattern regex in rule '${rule.id}'.`);
        continue;
      }
      if (regex.test(code)) {
        violations.push({ rule: rule.id, message: rule.description });
      }
    }

    for (const rule of policy.requiredPatterns || []) {
      const regex = this.safeRegex(rule.pattern, rule.flags);
      if (!regex) {
        warnings.push(`Invalid required pattern regex in rule '${rule.id}'.`);
        continue;
      }
      if (!regex.test(code)) {
        violations.push({
          rule: rule.id,
          message: `Required pattern missing: ${rule.description}`
        });
      }
    }

    return {
      mode: policy.mode || 'enforce',
      violations,
      warnings,
      profile
    };
  }

  async openOrCreatePolicyFile(): Promise<void> {
    const uri = await this.getActivePolicyUri();
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(this.getDefaultPolicyTemplate(), 'utf8'));
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }

  async listProfiles(): Promise<string[]> {
    const policyRoot = await this.getPolicyRoot();
    const entries = await vscode.workspace.fs.readDirectory(policyRoot.policiesDir);
    const profiles = entries
      .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
      .map(([name]) => name.replace(/\.json$/, ''));

    if (!profiles.includes('default')) {
      const defaultUri = vscode.Uri.joinPath(policyRoot.policiesDir, 'default.json');
      await vscode.workspace.fs.writeFile(defaultUri, Buffer.from(this.getDefaultPolicyTemplate(), 'utf8'));
      profiles.push('default');
    }

    return profiles.sort();
  }

  async setActiveProfile(name: string): Promise<void> {
    const configUri = await this.getProfileConfigUri();
    const body = JSON.stringify({ activeProfile: name }, null, 2);
    await vscode.workspace.fs.writeFile(configUri, Buffer.from(body, 'utf8'));
  }

  async createProfile(name: string, sourceProfile?: string): Promise<void> {
    const root = await this.getPolicyRoot();
    const source = sourceProfile || await this.getActiveProfile();
    const sourceUri = vscode.Uri.joinPath(root.policiesDir, `${source}.json`);
    const targetUri = vscode.Uri.joinPath(root.policiesDir, `${name}.json`);

    let payload: Uint8Array;
    try {
      payload = await vscode.workspace.fs.readFile(sourceUri);
    } catch {
      payload = Buffer.from(this.getDefaultPolicyTemplate(), 'utf8');
    }

    await vscode.workspace.fs.writeFile(targetUri, payload);
  }

  async verifyPolicyLock(): Promise<{ valid: boolean; lockExists: boolean; expectedHash: string; actualHash: string }> {
    const profile = await this.getActiveProfile();
    const root = await this.getPolicyRoot();
    const policyUri = vscode.Uri.joinPath(root.policiesDir, `${profile}.json`);
    const lockUri = vscode.Uri.joinPath(root.policyDir, 'policy.lock');

    let policyRaw: Uint8Array;
    try {
      policyRaw = await vscode.workspace.fs.readFile(policyUri);
    } catch {
      policyRaw = Buffer.from(this.getDefaultPolicyTemplate(), 'utf8');
    }

    const actualHash = this.sha256(Buffer.from(policyRaw).toString('utf8'));

    try {
      const lockRaw = await vscode.workspace.fs.readFile(lockUri);
      const parsed = JSON.parse(Buffer.from(lockRaw).toString('utf8')) as PolicyLock;
      if (parsed.profile !== profile) {
        return { valid: false, lockExists: true, expectedHash: parsed.hash, actualHash };
      }
      return {
        valid: parsed.hash === actualHash,
        lockExists: true,
        expectedHash: parsed.hash,
        actualHash
      };
    } catch {
      return {
        valid: false,
        lockExists: false,
        expectedHash: '',
        actualHash
      };
    }
  }

  async updatePolicyLock(): Promise<void> {
    const profile = await this.getActiveProfile();
    const root = await this.getPolicyRoot();
    const policyUri = vscode.Uri.joinPath(root.policiesDir, `${profile}.json`);
    const lockUri = vscode.Uri.joinPath(root.policyDir, 'policy.lock');

    let policyRaw: Uint8Array;
    try {
      policyRaw = await vscode.workspace.fs.readFile(policyUri);
    } catch {
      policyRaw = Buffer.from(this.getDefaultPolicyTemplate(), 'utf8');
    }

    const lock: PolicyLock = {
      schemaVersion: 1,
      profile,
      hash: this.sha256(Buffer.from(policyRaw).toString('utf8')),
      updatedAt: new Date().toISOString()
    };

    await vscode.workspace.fs.writeFile(lockUri, Buffer.from(JSON.stringify(lock, null, 2), 'utf8'));
  }

  getDefaultPolicyTemplate(): string {
    return JSON.stringify(DEFAULT_POLICY, null, 2);
  }

  async getPolicyPathsForScripts(): Promise<{ policyPath: string; profilePath: string }> {
    const profile = await this.getActiveProfile();
    const root = await this.getPolicyRoot();
    return {
      policyPath: vscode.Uri.joinPath(root.policiesDir, `${profile}.json`).fsPath,
      profilePath: root.policyDir.fsPath
    };
  }

  private async loadPolicy(profile: string): Promise<{ policy: PolicyDocument; warnings: string[] }> {
    const root = await this.getPolicyRoot();
    const uri = vscode.Uri.joinPath(root.policiesDir, `${profile}.json`);
    const warnings: string[] = [];

    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as PolicyDocument;

      if (parsed.schemaVersion !== 1) {
        warnings.push(`Unsupported policy schemaVersion '${String(parsed.schemaVersion)}'. Falling back to defaults.`);
        return { policy: DEFAULT_POLICY, warnings };
      }

      const mode = parsed.mode === 'warn' ? 'warn' : 'enforce';
      const blocked = Array.isArray(parsed.blockedPatterns) ? parsed.blockedPatterns : [];
      const required = Array.isArray(parsed.requiredPatterns) ? parsed.requiredPatterns : [];

      const policy: PolicyDocument = {
        schemaVersion: 1,
        mode,
        blockedPatterns: blocked.filter((rule) => this.isValidRule(rule, warnings, 'blockedPatterns')),
        requiredPatterns: required.filter((rule) => this.isValidRule(rule, warnings, 'requiredPatterns'))
      };

      return { policy, warnings };
    } catch {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(this.getDefaultPolicyTemplate(), 'utf8'));
      return { policy: DEFAULT_POLICY, warnings };
    }
  }

  private async getActiveProfile(): Promise<string> {
    const configUri = await this.getProfileConfigUri();
    try {
      const raw = await vscode.workspace.fs.readFile(configUri);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as { activeProfile?: string };
      return parsed.activeProfile || 'default';
    } catch {
      const body = JSON.stringify({ activeProfile: 'default' }, null, 2);
      await vscode.workspace.fs.writeFile(configUri, Buffer.from(body, 'utf8'));
      return 'default';
    }
  }

  private async getActivePolicyUri(): Promise<vscode.Uri> {
    const profile = await this.getActiveProfile();
    const root = await this.getPolicyRoot();
    return vscode.Uri.joinPath(root.policiesDir, `${profile}.json`);
  }

  private async getProfileConfigUri(): Promise<vscode.Uri> {
    const root = await this.getPolicyRoot();
    return vscode.Uri.joinPath(root.policyDir, 'profile.json');
  }

  private async getPolicyRoot(): Promise<{ policyDir: vscode.Uri; policiesDir: vscode.Uri }> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace folder first.');
    }

    const policyDir = vscode.Uri.joinPath(folder.uri, '.natlang');
    const policiesDir = vscode.Uri.joinPath(policyDir, 'policies');
    await vscode.workspace.fs.createDirectory(policyDir);
    await vscode.workspace.fs.createDirectory(policiesDir);

    return { policyDir, policiesDir };
  }

  private isValidRule(value: unknown, warnings: string[], section: string): value is PatternRule {
    if (!value || typeof value !== 'object') {
      warnings.push(`Invalid rule in ${section}: expected object.`);
      return false;
    }

    const candidate = value as PatternRule;
    if (!candidate.id || !candidate.description || !candidate.pattern) {
      warnings.push(`Invalid rule in ${section}: missing id, description, or pattern.`);
      return false;
    }

    if (typeof candidate.id !== 'string' || typeof candidate.description !== 'string' || typeof candidate.pattern !== 'string') {
      warnings.push(`Invalid rule '${String(candidate.id)}' in ${section}: fields must be strings.`);
      return false;
    }

    if (candidate.flags && typeof candidate.flags !== 'string') {
      warnings.push(`Invalid rule '${candidate.id}' in ${section}: flags must be a string.`);
      return false;
    }

    return true;
  }

  private safeRegex(pattern: string, flags?: string): RegExp | null {
    try {
      return new RegExp(pattern, flags || 'i');
    } catch {
      return null;
    }
  }

  private sha256(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }
}
