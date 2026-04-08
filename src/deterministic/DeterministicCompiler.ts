export type SupportedDeterministicLanguage = 'Python' | 'JavaScript' | 'TypeScript';

export interface CompileResult {
  code: string;
  warnings: string[];
  ast: Statement[];
  transformations: string[];
}

export type Statement =
  | { kind: 'function'; name: string; params: string[]; body: Statement[] }
  | { kind: 'if'; condition: string; body: Statement[]; elseBody?: Statement[] }
  | { kind: 'forEach'; item: string; collection: string; body: Statement[] }
  | { kind: 'pass' }
  | { kind: 'return'; value: string }
  | { kind: 'assign'; name: string; value: string }
  | { kind: 'print'; value: string }
  | { kind: 'call'; fn: string; args: string[]; assignTo?: string };

interface BlockCursor {
  indent: number;
  body: Statement[];
  parent?: BlockCursor;
}

export class DeterministicCompiler {
  compile(source: string, language: SupportedDeterministicLanguage): CompileResult {
    const warnings: string[] = [];
    const transformations: string[] = [];
    const ast = this.parse(source, warnings);
    return {
      code: this.emit(ast, language),
      warnings,
      ast,
      transformations: [
        'Parsed pseudocode into deterministic AST',
        `Emitted ${language} output from AST`,
        ...transformations
      ]
    };
  }

  parseToAst(source: string): { ast: Statement[]; warnings: string[] } {
    const warnings: string[] = [];
    return { ast: this.parse(source, warnings), warnings };
  }

  private parse(source: string, warnings: string[]): Statement[] {
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.replace(/\t/g, '    '));

    const root: BlockCursor = { indent: -1, body: [] };
    let current = root;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed === '---') {
        continue;
      }

      const indent = this.leadingSpaces(raw);
      while (current.parent && indent <= current.indent) {
        current = current.parent;
      }

      const fnMatch = trimmed.match(/^define a function called\s+([a-zA-Z_]\w*)\s+that takes\s+(.+):?$/i);
      if (fnMatch) {
        const params = fnMatch[2]
          .split(/,| and /i)
          .map((x) => this.normalizeIdentifier(x))
          .filter(Boolean);

        const node: Statement = {
          kind: 'function',
          name: this.normalizeIdentifier(fnMatch[1]),
          params,
          body: []
        };
        current.body.push(node);
        current = { indent, body: node.body, parent: current };
        continue;
      }

      const ifMatch = trimmed.match(/^if\s+(.+):?$/i);
      if (ifMatch) {
        const node: Statement = {
          kind: 'if',
          condition: this.normalizeCondition(ifMatch[1]),
          body: [],
          elseBody: []
        };
        current.body.push(node);
        current = { indent, body: node.body, parent: current };
        continue;
      }

      const elseMatch = trimmed.match(/^else:?$/i);
      if (elseMatch) {
        const last = current.body[current.body.length - 1];
        if (last && last.kind === 'if') {
          last.elseBody = [];
          current = { indent, body: last.elseBody, parent: current };
          continue;
        }
        warnings.push(`Line ${i + 1}: 'else' without matching 'if'.`);
        continue;
      }

      const forEachMatch = trimmed.match(/^for each\s+([a-zA-Z_]\w*)\s+in\s+(.+):?$/i);
      if (forEachMatch) {
        const node: Statement = {
          kind: 'forEach',
          item: this.normalizeIdentifier(forEachMatch[1]),
          collection: this.normalizeExpression(forEachMatch[2]),
          body: []
        };
        current.body.push(node);
        current = { indent, body: node.body, parent: current };
        continue;
      }

      if (/^pass$/i.test(trimmed)) {
        current.body.push({ kind: 'pass' });
        continue;
      }

      const returnMatch = trimmed.match(/^return\s+(.+)$/i);
      if (returnMatch) {
        current.body.push({ kind: 'return', value: this.normalizeExpression(returnMatch[1]) });
        continue;
      }

      const assignMatch = trimmed.match(/^(set|assign|let)\s+([a-zA-Z_]\w*)\s+(to|=)\s+(.+)$/i);
      if (assignMatch) {
        current.body.push({
          kind: 'assign',
          name: this.normalizeIdentifier(assignMatch[2]),
          value: this.normalizeExpression(assignMatch[4])
        });
        continue;
      }

      const printMatch = trimmed.match(/^print\s+(.+)$/i);
      if (printMatch) {
        current.body.push({ kind: 'print', value: this.normalizeExpression(printMatch[1]) });
        continue;
      }

      const callAssign = trimmed.match(/^call\s+([a-zA-Z_]\w*)\s+with\s+(.+)\s+and\s+store\s+in\s+([a-zA-Z_]\w*)$/i);
      if (callAssign) {
        current.body.push({
          kind: 'call',
          fn: this.normalizeIdentifier(callAssign[1]),
          args: this.parseArgs(callAssign[2]),
          assignTo: this.normalizeIdentifier(callAssign[3])
        });
        continue;
      }

      const callMatch = trimmed.match(/^call\s+([a-zA-Z_]\w*)\s+with\s+(.+)$/i);
      if (callMatch) {
        current.body.push({
          kind: 'call',
          fn: this.normalizeIdentifier(callMatch[1]),
          args: this.parseArgs(callMatch[2])
        });
        continue;
      }

      warnings.push(`Line ${i + 1}: Unsupported statement ignored -> ${trimmed}`);
    }

    return root.body;
  }

  private emit(statements: Statement[], language: SupportedDeterministicLanguage): string {
    if (language === 'Python') {
      return this.emitPython(statements, 0).join('\n');
    }
    const jsLike = this.emitJsLike(statements, 0, language === 'TypeScript');
    return jsLike.join('\n');
  }

  private emitPython(statements: Statement[], level: number): string[] {
    const out: string[] = [];
    const indent = '    '.repeat(level);

    for (const s of statements) {
      if (s.kind === 'function') {
        out.push(`${indent}def ${s.name}(${s.params.join(', ')}):`);
        const body = s.body.length ? this.emitPython(s.body, level + 1) : [`${indent}    pass`];
        out.push(...body);
        continue;
      }
      if (s.kind === 'if') {
        out.push(`${indent}if ${this.renderCondition(s.condition, 'Python')}:`);
        const body = s.body.length ? this.emitPython(s.body, level + 1) : [`${indent}    pass`];
        out.push(...body);
        if (s.elseBody && s.elseBody.length > 0) {
          out.push(`${indent}else:`);
          out.push(...this.emitPython(s.elseBody, level + 1));
        }
        continue;
      }
      if (s.kind === 'forEach') {
        out.push(`${indent}for ${s.item} in ${s.collection}:`);
        const body = s.body.length ? this.emitPython(s.body, level + 1) : [`${indent}    pass`];
        out.push(...body);
        continue;
      }
      if (s.kind === 'return') {
        out.push(`${indent}return ${s.value}`);
        continue;
      }
      if (s.kind === 'pass') {
        out.push(`${indent}pass`);
        continue;
      }
      if (s.kind === 'assign') {
        out.push(`${indent}${s.name} = ${s.value}`);
        continue;
      }
      if (s.kind === 'print') {
        out.push(`${indent}print(${s.value})`);
        continue;
      }
      if (s.kind === 'call') {
        const call = `${s.fn}(${s.args.join(', ')})`;
        out.push(s.assignTo ? `${indent}${s.assignTo} = ${call}` : `${indent}${call}`);
      }
    }

    return out;
  }

  private emitJsLike(statements: Statement[], level: number, isTypeScript: boolean): string[] {
    const out: string[] = [];
    const indent = '    '.repeat(level);

    for (const s of statements) {
      if (s.kind === 'function') {
        const params = isTypeScript
          ? s.params.map((p) => `${p}: any`).join(', ')
          : s.params.join(', ');
        const retType = isTypeScript ? ': any' : '';
        out.push(`${indent}function ${s.name}(${params})${retType} {`);
        const body = s.body.length ? this.emitJsLike(s.body, level + 1, isTypeScript) : [`${indent}    // TODO`];
        out.push(...body);
        out.push(`${indent}}`);
        continue;
      }
      if (s.kind === 'if') {
        out.push(`${indent}if (${this.renderCondition(s.condition, isTypeScript ? 'TypeScript' : 'JavaScript')}) {`);
        const body = s.body.length ? this.emitJsLike(s.body, level + 1, isTypeScript) : [`${indent}    // TODO`];
        out.push(...body);
        out.push(`${indent}}`);
        if (s.elseBody && s.elseBody.length > 0) {
          out.push(`${indent}else {`);
          out.push(...this.emitJsLike(s.elseBody, level + 1, isTypeScript));
          out.push(`${indent}}`);
        }
        continue;
      }
      if (s.kind === 'forEach') {
        out.push(`${indent}for (const ${s.item} of ${s.collection}) {`);
        const body = s.body.length ? this.emitJsLike(s.body, level + 1, isTypeScript) : [`${indent}    // TODO`];
        out.push(...body);
        out.push(`${indent}}`);
        continue;
      }
      if (s.kind === 'return') {
        out.push(`${indent}return ${s.value};`);
        continue;
      }
      if (s.kind === 'pass') {
        out.push(`${indent}// no-op`);
        continue;
      }
      if (s.kind === 'assign') {
        out.push(`${indent}let ${s.name} = ${s.value};`);
        continue;
      }
      if (s.kind === 'print') {
        out.push(`${indent}console.log(${s.value});`);
        continue;
      }
      if (s.kind === 'call') {
        const call = `${s.fn}(${s.args.join(', ')})`;
        out.push(s.assignTo ? `${indent}const ${s.assignTo} = ${call};` : `${indent}${call};`);
      }
    }

    return out;
  }

  private parseArgs(args: string): string[] {
    return args
      .split(/,| and /i)
      .map((x) => this.normalizeExpression(x))
      .filter(Boolean);
  }

  private normalizeCondition(value: string): string {
    return this.normalizeExpression(value)
      .replace(/\bis within\b/gi, 'in')
      .replace(/\bis in\b/gi, 'in')
      .replace(/\bis not in\b/gi, 'not in')
      .replace(/\bis greater than or equal to\b/gi, '>=')
      .replace(/\bis less than or equal to\b/gi, '<=')
      .replace(/\bis greater than\b/gi, '>')
      .replace(/\bis less than\b/gi, '<')
      .replace(/\bis equal to\b/gi, '==')
      .replace(/\bis not equal to\b/gi, '!=')
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bis empty\b/gi, '== ""')
      .replace(/\bis not empty\b/gi, '!= ""');
  }

  private renderCondition(condition: string, language: SupportedDeterministicLanguage): string {
    const cond = condition.trim();

    if (language === 'Python') {
      return cond.replace(/&&/g, 'and').replace(/\|\|/g, 'or');
    }

    const notIn = cond.match(/^(.+)\s+not\s+in\s+(.+)$/i);
    if (notIn) {
      const lhs = notIn[1].trim();
      const rhs = notIn[2].trim();
      return `!${rhs}.includes(${lhs})`;
    }

    const inMatch = cond.match(/^(.+)\s+in\s+(.+)$/i);
    if (inMatch) {
      const lhs = inMatch[1].trim();
      const rhs = inMatch[2].trim();
      return `${rhs}.includes(${lhs})`;
    }

    return cond;
  }

  private normalizeExpression(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeIdentifier(value: string): string {
    return value.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private leadingSpaces(line: string): number {
    const m = line.match(/^\s*/);
    return m ? m[0].length : 0;
  }
}
