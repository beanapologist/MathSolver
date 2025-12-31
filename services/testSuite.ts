
import { AxiomPrimeSolver } from './solverEngine';
import { TestSuiteReport, TestResult, InvariantType } from '../types';

export class AxiomPrimeTestSuite {
  private solver: AxiomPrimeSolver;

  constructor() {
    this.solver = new AxiomPrimeSolver();
  }

  private async runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
    const start = performance.now();
    try {
      await fn();
      return {
        name,
        status: 'passed',
        expected: 'match',
        actual: 'match',
        duration: performance.now() - start
      };
    } catch (e: any) {
      return {
        name,
        status: 'failed',
        expected: e.expected,
        actual: e.actual,
        error: e.message,
        duration: performance.now() - start
      };
    }
  }

  private assertEquals(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      const err = new Error(message || `Expected ${expected} but received ${actual}`);
      (err as any).expected = expected;
      (err as any).actual = actual;
      throw err;
    }
  }

  public async runDiagnostics(): Promise<TestSuiteReport> {
    const results: TestResult[] = [];

    results.push(await this.runTest('ROOT_DYNAMICS: Newton Sum of Squares', async () => {
      const problem = "Find the sum of the squares of the roots of x^2 - 5x + 6 = 0.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.ROOT_DYNAMICS);
      // roots 2, 3. Squares 4, 9. Sum 13.
      // P2 = e1*P1 - 2e2 = 5*5 - 2*6 = 25-12 = 13.
      this.assertEquals(res.answer, 13);
    }));

    results.push(await this.runTest('SEQUENCES: Arithmetic Sum', async () => {
      const problem = "arithmetic progression with first term 5, common difference 3, up to 10 terms";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.SEQUENCES);
      // Sn = 10/2 * (2*5 + 9*3) = 5 * (10 + 27) = 5 * 37 = 185.
      this.assertEquals(res.answer, 185);
    }));

    results.push(await this.runTest('SPECTRAL_ZETA: Euler Score Traversal', async () => {
      const problem = "Calculate the spectral score for frequency t=14.1347";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.SPECTRAL_ZETA);
      this.assertEquals(parseFloat(res.answer as string) > 5.0, true);
    }));

    results.push(await this.runTest('POLYNOMIAL: Linear Reduction at x=5', async () => {
      const problem = "Quadratic polynomials P(x) and Q(x) have leading coefficients 2 and -2. They pass through (16,54) and (20,53). Find P(5)+Q(5).";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.POLYNOMIAL);
      this.assertEquals(res.answer, 113);
    }));

    results.push(await this.runTest('NUMBER_THEORY: Lucas Theorem Binomial', async () => {
      const problem = "Find (10 choose 5) mod 7.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.NUMBER_THEORY);
      this.assertEquals(res.answer, 0);
    }));

    results.push(await this.runTest('NUMBER_THEORY: Euler Totient Function', async () => {
      const problem = "How many positive integers less than 10 are relatively prime to 10?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.NUMBER_THEORY);
      this.assertEquals(res.answer, 4);
    }));

    const passCount = results.filter(r => r.status === 'passed').length;
    return {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passCount,
      failCount: results.length - passCount,
      results
    };
  }
}
