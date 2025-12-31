import { InvariantType, SolverResult } from '../../types';
import { BaseSolverPlugin } from '../pluginSystem';

/**
 * Diophantine Plugin
 * Solves Frobenius coin problem (largest integer that cannot be expressed
 * as a linear combination of coprime coefficients).
 */
export class DiophantinePlugin extends BaseSolverPlugin {
  name = 'diophantine';
  invariantType = InvariantType.DIOPHANTINE;
  private modulo: number = 100000;

  constructor(modulo: number = 100000) {
    super();
    this.modulo = modulo;
  }

  solve(problem: string): SolverResult | null {
    const p = problem.toLowerCase();
    const triggers = ['largest integer', 'cannot be written', 'cannot be expressed', 'impossible sum', 'chicken mcnugget', 'frobenius'];
    if (!triggers.some(t => p.includes(t))) return null;

    const nums = (problem.match(/\b\d+\b/g) || []).map(Number);
    const coeffs = nums.filter(n => n >= 2 && n <= 500);

    if (coeffs.length < 2) return null;

    const a = coeffs[0];
    const b = coeffs[1];

    if (this.gcd(a, b) !== 1) {
      return {
        answer: "Infinity",
        invariantUsed: InvariantType.DIOPHANTINE,
        steps: [`Gaps are infinite for non-coprime generators ${a}, ${b}`],
        logs: [this.createLog(`Analysis: Non-coprime boundary detected.`)]
      };
    }

    const result = (a * b) - a - b;

    return {
      answer: result % this.modulo,
      invariantUsed: InvariantType.DIOPHANTINE,
      steps: [
        `Applying Frobenius identity for {${a}, ${b}}`,
        `G(a,b) = ab - a - b`,
        `Outcome: ${result}`
      ],
      logs: [
        this.createLog(`Analysis: Diophantine boundary resolved.`),
        this.createLog(`Calculation complete.`, 'success')
      ]
    };
  }
}
