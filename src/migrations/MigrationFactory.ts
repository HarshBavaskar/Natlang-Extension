export type MigrationPack =
  | 'javascript-modernize'
  | 'typescript-modernize'
  | 'java-modernize'
  | 'python-modernize';

export interface MigrationResult {
  code: string;
  applied: string[];
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  changedLines: number;
}

export class MigrationFactory {
  run(pack: MigrationPack, code: string): MigrationResult {
    switch (pack) {
      case 'javascript-modernize':
        return this.javascriptModernize(code, false);
      case 'typescript-modernize':
        return this.javascriptModernize(code, true);
      case 'java-modernize':
        return this.javaModernize(code);
      case 'python-modernize':
        return this.pythonModernize(code);
      default:
        return this.toResult(code, code, []);
    }
  }

  preview(pack: MigrationPack, code: string): MigrationResult {
    return this.run(pack, code);
  }

  private javascriptModernize(code: string, withTypes: boolean): MigrationResult {
    let out = code;
    const applied: string[] = [];

    const varMatches = out.match(/\bvar\b/g)?.length || 0;
    if (varMatches > 0) {
      out = out.replace(/\bvar\b/g, 'let');
      applied.push(`Replaced ${varMatches} var declarations with let`);
    }

    const eqMatches = out.match(/([^=!<>])==([^=])/g)?.length || 0;
    if (eqMatches > 0) {
      out = out.replace(/([^=!<>])==([^=])/g, '$1===$2');
      applied.push(`Replaced ${eqMatches} loose equality checks with strict equality`);
    }

    const neqMatches = out.match(/!=/g)?.filter((m, idx, arr) => {
      void m;
      return arr[idx - 1] !== '!';
    }).length || 0;
    if (neqMatches > 0) {
      out = out.replace(/!=/g, '!==');
      applied.push(`Replaced ${neqMatches} loose inequality checks with strict inequality`);
    }

    if (withTypes && !/\bunknown\b|\bany\b/.test(out)) {
      applied.push('TypeScript pack completed with no unsafe type marker changes required');
    }

    return this.toResult(code, out, applied);
  }

  private javaModernize(code: string): MigrationResult {
    let out = code;
    const applied: string[] = [];

    if (/\bVector\b/.test(out)) {
      out = out.replace(/\bVector\b/g, 'ArrayList');
      applied.push('Replaced Vector with ArrayList');
    }

    if (/\bStringBuffer\b/.test(out)) {
      out = out.replace(/\bStringBuffer\b/g, 'StringBuilder');
      applied.push('Replaced StringBuffer with StringBuilder');
    }

    if (/System\.gc\s*\(\s*\)\s*;/.test(out)) {
      out = out.replace(/System\.gc\s*\(\s*\)\s*;\s*/g, '');
      applied.push('Removed explicit System.gc() calls');
    }

    return this.toResult(code, out, applied);
  }

  private pythonModernize(code: string): MigrationResult {
    let out = code;
    const applied: string[] = [];

    const oldPrint = out.match(/print\s+[^\(].*/g)?.length || 0;
    if (oldPrint > 0) {
      out = out.replace(/^\s*print\s+(.+)$/gm, 'print($1)');
      applied.push(`Converted ${oldPrint} print statements to function style`);
    }

    if (/xrange\(/.test(out)) {
      out = out.replace(/xrange\(/g, 'range(');
      applied.push('Replaced xrange() with range()');
    }

    return this.toResult(code, out, applied);
  }

  private toResult(original: string, next: string, applied: string[]): MigrationResult {
    const changedLines = this.countChangedLines(original, next);
    const riskScore = Math.min(100, (applied.length * 10) + changedLines);
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 25 ? 'medium' : 'low';
    return {
      code: next,
      applied,
      riskScore,
      riskLevel,
      changedLines
    };
  }

  private countChangedLines(a: string, b: string): number {
    const aLines = a.split(/\r?\n/);
    const bLines = b.split(/\r?\n/);
    const max = Math.max(aLines.length, bLines.length);
    let changed = 0;
    for (let i = 0; i < max; i++) {
      if ((aLines[i] || '') !== (bLines[i] || '')) {
        changed += 1;
      }
    }
    return changed;
  }
}
