import { DeterministicCompiler } from './DeterministicCompiler';

export interface SelfTestResult {
  passed: number;
  failed: number;
  details: string[];
}

export interface BenchmarkResult {
  cases: number;
  passed: number;
  failed: number;
  durationMs: number;
  avgMsPerCase: number;
  details: string[];
  outputs: Record<string, string>;
}

interface TestCase {
  name: string;
  input: string;
  language: 'Python' | 'JavaScript' | 'TypeScript';
  expectedContains: string[];
}

export const TEST_CASES: TestCase[] = [
  {
    name: 'python function and return',
    input: 'define a function called greet that takes name:\n    return "hello"',
    language: 'Python',
    expectedContains: ['def greet(name):', 'return "hello"']
  },
  {
    name: 'javascript call',
    input: 'call greet with "world"',
    language: 'JavaScript',
    expectedContains: ['greet("world");']
  },
  {
    name: 'typescript if statement',
    input: 'if user is empty:\n    return "none"',
    language: 'TypeScript',
    expectedContains: ['if (user == "") {', 'return "none";']
  }
];

export function runDeterministicSelfTest(): SelfTestResult {
  const compiler = new DeterministicCompiler();
  const details: string[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const result = compiler.compile(tc.input, tc.language);
    const missing = tc.expectedContains.filter((expected) => !result.code.includes(expected));

    if (missing.length === 0) {
      passed += 1;
      details.push(`PASS: ${tc.name}`);
    } else {
      failed += 1;
      details.push(`FAIL: ${tc.name}`);
      for (const item of missing) {
        details.push(`  Missing: ${item}`);
      }
      details.push(`  Output: ${result.code.replace(/\n/g, ' | ')}`);
    }
  }

  return { passed, failed, details };
}

export function runDeterministicBenchmark(): BenchmarkResult {
  const start = Date.now();
  const compiler = new DeterministicCompiler();
  const details: string[] = [];
  const outputs: Record<string, string> = {};
  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const result = compiler.compile(tc.input, tc.language);
    outputs[`${tc.name}::${tc.language}`] = result.code;
    const missing = tc.expectedContains.filter((expected) => !result.code.includes(expected));
    if (missing.length === 0) {
      passed += 1;
      details.push(`PASS: ${tc.name}`);
    } else {
      failed += 1;
      details.push(`FAIL: ${tc.name} (${missing.join(', ')})`);
    }
  }

  const durationMs = Date.now() - start;
  return {
    cases: TEST_CASES.length,
    passed,
    failed,
    durationMs,
    avgMsPerCase: TEST_CASES.length > 0 ? durationMs / TEST_CASES.length : 0,
    details,
    outputs
  };
}
