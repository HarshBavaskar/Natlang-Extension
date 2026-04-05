import * as vscode from 'vscode';

interface Block {
  startLine: number;
  endLine: number;
  text: string;
}

export class NatLangCodeLensProvider implements vscode.CodeLensProvider<vscode.CodeLens> {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  refreshCodeLenses(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | null | Thenable<vscode.CodeLens[] | null> {
    const blocks = this.parseBlocks(document);
    const lenses: vscode.CodeLens[] = [];

    for (const block of blocks) {
      const range = document.lineAt(block.startLine).range.with({ start: new vscode.Position(block.startLine, 0), end: new vscode.Position(block.startLine, 0) });

      lenses.push(new vscode.CodeLens(range, {
        title: '⚡ Generate Python',
        command: 'natlang.generate',
        arguments: [{ startLine: block.startLine, endLine: block.endLine }]
      }));

      lenses.push(new vscode.CodeLens(range.with({ start: new vscode.Position(block.startLine + 1, 0) }), {
        title: '🌐 Change Language',
        command: 'natlang.changeLanguage',
        arguments: []
      }));

      lenses.push(new vscode.CodeLens(range.with({ start: new vscode.Position(block.startLine + 2, 0) }), {
        title: '📋 Copy Last',
        command: 'natlang.copyGenerated',
        arguments: []
      }));
    }

    return lenses;
  }

  private parseBlocks(document: vscode.TextDocument): Block[] {
    const blocks: Block[] = [];
    let currentBlock: Block | null = null;

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text.trim();
      
      if (line === '---') {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        continue;
      }

      if (line) {
        if (!currentBlock) {
          currentBlock = { startLine: i, endLine: i, text: line };
        } else {
          currentBlock.text += '\n' + line;
          currentBlock.endLine = i;
        }
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }


}
