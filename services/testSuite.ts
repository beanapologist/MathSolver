
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

    // --- POLYNOMIAL TESTS ---
    results.push(await this.runTest('POLYNOMIAL: Basic Quadratic Reversion', async () => {
      const problem = "Quadratic polynomials P(x) and Q(x) have leading coefficients 2 and -2. They pass through (16,54) and (20,53). Find P(0)+Q(0).";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.POLYNOMIAL);
      this.assertEquals(res.answer, 116);
    }));

    // --- DIOPHANTINE TESTS ---
    results.push(await this.runTest('DIOPHANTINE: Frobenius Coin (Chicken McNugget)', async () => {
      const problem = "What is the largest integer that cannot be written as a sum of multiples of 6 and 11?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.DIOPHANTINE);
      this.assertEquals(res.answer, 49);
    }));

    results.push(await this.runTest('DIOPHANTINE: Frobenius (Alternative Phrasing)', async () => {
      const problem = "Identify the greatest impossible sum using denominations of 7 and 13.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.answer, 71); // 7*13 - 7 - 13 = 91 - 20 = 71
    }));

    // --- COMBINATORIAL TESTS ---
    results.push(await this.runTest('COMBINATORIAL: Subset Intersection S_n (n=2)', async () => {
      const problem = "Let S = {1, 2}. Find the sum of the sizes of the intersections of all ordered pairs of subsets of S.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.COMBINATORIAL);
      this.assertEquals(res.answer, 8); // 2 * 4^(2-1) = 2 * 4 = 8
    }));

    results.push(await this.runTest('COMBINATORIAL: Set n elements phrasing', async () => {
      const problem = "For a set of 5 elements, what is the value of S_n?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.answer, 1280); // 5 * 4^4 = 1280
    }));

    // --- MODULAR TESTS ---
    results.push(await this.runTest('MODULAR: Binary Exponentiation', async () => {
      const problem = "What is 3^4 mod 10?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.answer, 1);
    }));

    // --- GEOMETRIC TESTS ---
    results.push(await this.runTest('GEOMETRIC: Tangent Spheres Area', async () => {
      const problem = "Three spheres with radii of 3, 4, and 5 are mutually tangent. Find the area of the triangle formed by their centers.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.GEOMETRIC);
      // Area = sqrt((3+4+5)*3*4*5) = sqrt(12*60) = sqrt(720) ≈ 26.8328... rounded to 27
      this.assertEquals(res.answer, 27);
    }));

    // --- REPEATING DECIMAL TESTS ---
    results.push(await this.runTest('REPEATING_DECIMAL: Period 2', async () => {
      const problem = "Repeating decimal with period length of two digits.";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, InvariantType.REPEATING_DECIMAL);
      // d=99. Sum k/gcd(k,99) for k=1 to 99
      // Axiomatic Logic: 1 + Σ(m*φ(m)/2) for divisors m|d, m>1
      // Sum = 1 (m=1) + 3 (m=3) + 27 (m=9) + 55 (m=11) + 330 (m=33) + 2970 (m=99) = 3386
      this.assertEquals(res.answer, 3386);
    }));

    // --- EDGE CASE TESTS ---
    results.push(await this.runTest('FALLBACK: No Invariant Match', async () => {
      const problem = "How many apples are in a basket if I have 2 and give 1 away?";
      const res = await this.solver.solve(problem);
      this.assertEquals(res.invariantUsed, null);
      this.assertEquals(res.answer, 0);
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
