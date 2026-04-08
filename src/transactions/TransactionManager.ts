import * as path from 'path';
import * as vscode from 'vscode';

interface Snapshot {
  uri: string;
  content: Uint8Array;
}

interface Transaction {
  id: string;
  createdAt: number;
  snapshots: Snapshot[];
  files: string[];
}

interface PersistedSnapshot {
  uri: string;
  contentBase64: string;
}

interface PersistedTransaction {
  id: string;
  createdAt: number;
  files: string[];
  snapshots: PersistedSnapshot[];
}

const ACTIVE_TRANSACTION_KEY = 'natlang.activeTransaction';

export class TransactionManager {
  private readonly context: vscode.ExtensionContext;
  private active: Transaction | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.restoreFromState();
  }

  begin(files: vscode.Uri[]): string {
    const id = `tx-${Date.now()}`;
    this.active = {
      id,
      createdAt: Date.now(),
      snapshots: [],
      files: files.map((f) => f.toString())
    };
    this.persistActive();
    void this.persistJournal();
    return id;
  }

  async captureBefore(uri: vscode.Uri): Promise<void> {
    this.ensureActive();
    const key = uri.toString();
    if (this.active!.snapshots.some((s) => s.uri === key)) {
      return;
    }

    const content = await vscode.workspace.fs.readFile(uri);
    this.active!.snapshots.push({ uri: key, content });
    this.persistActive();
    await this.persistJournal();
  }

  async applyEdits(edits: Array<{ uri: vscode.Uri; content: string }>): Promise<void> {
    this.ensureActive();

    for (const edit of edits) {
      await this.captureBefore(edit.uri);
      await vscode.workspace.fs.writeFile(edit.uri, Buffer.from(edit.content, 'utf8'));
    }
  }

  async applyAtomic(edits: Array<{ uri: vscode.Uri; content: string }>): Promise<void> {
    this.ensureActive();
    try {
      await this.applyEdits(edits);
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  commit(): void {
    this.ensureActive();
    const completedId = this.active!.id;
    this.active = null;
    this.clearPersisted();
    void this.cleanupJournal(completedId);
  }

  async rollback(): Promise<void> {
    this.ensureActive();
    const rollbackId = this.active!.id;
    for (const snapshot of this.active!.snapshots) {
      await vscode.workspace.fs.writeFile(vscode.Uri.parse(snapshot.uri), snapshot.content);
    }
    this.active = null;
    this.clearPersisted();
    await this.cleanupJournal(rollbackId);
  }

  hasActiveTransaction(): boolean {
    return this.active !== null;
  }

  hasRecoverableTransaction(): boolean {
    return this.active !== null && this.active.snapshots.length > 0;
  }

  describeActive(): string {
    if (!this.active) {
      return 'No active transaction.';
    }

    return `Transaction ${this.active.id} with ${this.active.files.length} file(s), ${this.active.snapshots.length} snapshot(s).`;
  }

  private restoreFromState(): void {
    const persisted = this.context.globalState.get<PersistedTransaction>(ACTIVE_TRANSACTION_KEY);
    if (!persisted) {
      return;
    }

    this.active = {
      id: persisted.id,
      createdAt: persisted.createdAt,
      files: persisted.files,
      snapshots: persisted.snapshots.map((s) => ({
        uri: s.uri,
        content: Buffer.from(s.contentBase64, 'base64')
      }))
    };
  }

  private persistActive(): void {
    if (!this.active) {
      this.clearPersisted();
      return;
    }

    const persisted: PersistedTransaction = {
      id: this.active.id,
      createdAt: this.active.createdAt,
      files: this.active.files,
      snapshots: this.active.snapshots.map((s) => ({
        uri: s.uri,
        contentBase64: Buffer.from(s.content).toString('base64')
      }))
    };

    void this.context.globalState.update(ACTIVE_TRANSACTION_KEY, persisted);
  }

  private clearPersisted(): void {
    void this.context.globalState.update(ACTIVE_TRANSACTION_KEY, undefined);
  }

  private async persistJournal(): Promise<void> {
    if (!this.active) {
      return;
    }

    const root = await this.getJournalDir();
    const journalFile = vscode.Uri.file(path.join(root.fsPath, `${this.active.id}.json`));
    const persisted: PersistedTransaction = {
      id: this.active.id,
      createdAt: this.active.createdAt,
      files: this.active.files,
      snapshots: this.active.snapshots.map((s) => ({
        uri: s.uri,
        contentBase64: Buffer.from(s.content).toString('base64')
      }))
    };
    await vscode.workspace.fs.writeFile(journalFile, Buffer.from(JSON.stringify(persisted, null, 2), 'utf8'));
  }

  private async cleanupJournal(id: string): Promise<void> {
    try {
      const root = await this.getJournalDir();
      const journalFile = vscode.Uri.file(path.join(root.fsPath, `${id}.json`));
      await vscode.workspace.fs.delete(journalFile);
    } catch {
      // Best effort cleanup.
    }
  }

  private async getJournalDir(): Promise<vscode.Uri> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace folder first.');
    }

    const dir = vscode.Uri.joinPath(folder.uri, '.natlang', 'transactions');
    await vscode.workspace.fs.createDirectory(dir);
    return dir;
  }

  private ensureActive(): void {
    if (!this.active) {
      throw new Error('No active transaction. Start one before applying edits.');
    }
  }
}
