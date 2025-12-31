
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

    results.push(await this.runTest('POLYNOMIAL: Deterministic Reversion', async () => {
      const problem = "Quadratic polynomials P(x) and Q(x) have leading coefficients 2 and -2. They pass through (16,54) and (20,53). Find P(0)+Q(0).";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.POLYNOMIAL);
      this.assertEquals(res.answer, 116);
    }));

    results.push(await this.runTest('DIOPHANTINE: Frobenius Boundary', async () => {
      const problem = "What is the largest integer that cannot be written as a sum of multiples of 6 and 11?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.DIOPHANTINE);
      this.assertEquals(res.answer, 49);
    }));

    results.push(await this.runTest('COMBINATORIAL: S_n Intersection Manifold', async () => {
      const problem = "Let S = {1, 2}. Find the sum of the sizes of the intersections of all ordered pairs of subsets of S.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.COMBINATORIAL);
      this.assertEquals(res.answer, 8);
    }));

    results.push(await this.runTest('MODULAR: Fast Modular Traversal', async () => {
      const problem = "What is 3^4 mod 10?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.answer, 1);
    }));

    results.push(await this.runTest('GEOMETRIC: Spherical Tangency Center Manifold', async () => {
      const problem = "Three spheres with radii of 3, 4, and 5 are mutually tangent. Find the area of the triangle formed by their centers.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.GEOMETRIC);
      this.assertEquals(res.answer, 27);
    }));

    results.push(await this.runTest('REPEATING_DECIMAL: Period Manifold', async () => {
      const problem = "Repeating decimal with period length of two digits.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.REPEATING_DECIMAL);
      this.assertEquals(res.answer, 3386);
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
