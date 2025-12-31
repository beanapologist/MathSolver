import { InvariantType, SolverResult } from '../../types';
import { BaseSolverPlugin } from '../pluginSystem';
import { Fraction } from '../fraction';

/**
 * Polynomial Plugin
 * Solves polynomial interpolation and evaluation problems.
 * Uses exact fraction arithmetic for precise calculations.
 */
export class PolynomialPlugin extends BaseSolverPlugin {
  name = 'polynomial';
  invariantType = InvariantType.POLYNOMIAL;
  private modulo: number = 100000;

  constructor(modulo: number = 100000) {
    super();
    this.modulo = modulo;
  }

  solve(problem: string): SolverResult | null {
    const p = problem.toLowerCase();
    if (!p.includes('quadratic') && !p.includes('polynomial')) return null;

    const coeffMatch = problem.match(/leading coeff.*?(-?\d+).*?(-?\d+)/i);
    const points = Array.from(problem.matchAll(/\((-?\d+)\s*,\s*(-?\d+)\)/g));

    const targetMatch = p.match(/(?:find|calculate|evaluate)\s+(?:p|q|p\+q)\((\d+)\)/i);
    const targetX = targetMatch ? BigInt(targetMatch[1]) : 0n;

    if (!coeffMatch || points.length < 2) return null;

    const a1 = parseInt(coeffMatch[1]);
    const a2 = parseInt(coeffMatch[2]);
    const x1 = BigInt(points[0][1]);
    const y1 = BigInt(points[0][2]);
    const x2 = BigInt(points[1][1]);
    const y2 = BigInt(points[1][2]);

    const getPolynomialAt = (a: number, x1: bigint, y1: bigint, x2: bigint, y2: bigint, tx: bigint) => {
      const aBI = BigInt(a);
      const r1 = new Fraction(y1 - aBI * x1 * x1);
      const r2 = new Fraction(y2 - aBI * x2 * x2);

      if (x1 === x2) return new Fraction(0n);

      const b = r1.sub(r2).div(new Fraction(x1 - x2));
      const c = r1.sub(b.mul(new Fraction(x1)));

      const quadPart = new Fraction(aBI * tx * tx);
      const linPart = b.mul(new Fraction(tx));
      return quadPart.add(linPart).add(c);
    };

    const pVal = getPolynomialAt(a1, x1, y1, x2, y2, targetX);
    const qVal = getPolynomialAt(a2, x1, y1, x2, y2, targetX);
    const total = pVal.add(qVal).toNumber();

    return {
      answer: Math.floor(total) % this.modulo,
      invariantUsed: InvariantType.POLYNOMIAL,
      steps: [
        `Mapping quadratic coefficients ${a1}, ${a2}`,
        `Evaluating interpolation points (${x1}, ${y1}), (${x2}, ${y2})`,
        `P(${targetX}) = ${pVal.toString()}`,
        `Q(${targetX}) = ${qVal.toString()}`,
        `Resulting sum: ${total}`
      ],
      logs: [
        this.createLog(`Analysis: Polynomial reduction resolved at x=${targetX}`),
        this.createLog(`Evaluation successful.`, 'success')
      ]
    };
  }
}
