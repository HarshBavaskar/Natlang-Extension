import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private lastLanguage: string = 'Python';
  private lastProvider: string = 'Ollama';

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'natlang.changeLanguage';
    this.setIdle(this.lastLanguage, this.lastProvider);
    this.statusBarItem.show();
  }

  setIdle(language: string, provider: string): void {
    this.lastLanguage = language;
    this.lastProvider = provider;
    this.statusBarItem.text = `NatLang: ${language} | ${provider}`;
    this.statusBarItem.tooltip = 'Click to change language';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.command = 'natlang.changeLanguage';
  }

  setGenerating(language: string): void {
    this.statusBarItem.text = `$(sync~spin) NatLang: Generating ${language}...`;
    this.statusBarItem.command = undefined;
  }

  setSuccess(): void {
    this.statusBarItem.text = `$(check) NatLang: Done`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    setTimeout(() => {
      this.setIdle(this.lastLanguage, this.lastProvider);
    }, 2000);
  }

  setError(): void {
    this.statusBarItem.text = `$(error) NatLang: Failed`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    setTimeout(() => {
      this.setIdle(this.lastLanguage, this.lastProvider);
    }, 3000);
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
