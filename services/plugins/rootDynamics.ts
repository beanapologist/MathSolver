import { InvariantType, SolverResult } from '../../types';
import { BaseSolverPlugin } from '../pluginSystem';

/**
 * Root Dynamics Plugin
 * Applies Vieta's identities and Newton's sum formulas to analyze polynomial roots.
 * Solves for sum of roots and sum of squares of roots.
 */
export class RootDynamicsPlugin extends BaseSolverPlugin {
  name = 'root-dynamics';
  invariantType = InvariantType.ROOT_DYNAMICS;

  solve(problem: string): SolverResult | null {
    const p = problem.toLowerCase();
    if (!p.includes('root')) return null;

    const polyMatch = problem.match(/x\^2\s*([+-]\s*\d*)\s*x\s*([+-]\s*\d*)\s*=\s*0/i);
    if (!polyMatch) return null;

    const bStr = polyMatch[1].replace(/\s/g, '');
    const b = bStr === '+' ? 1 : bStr === '-' ? -1 : (bStr === '' ? 0 : parseInt(bStr));
    const c = parseInt(polyMatch[2].replace(/\s/g, ''));

    const e1 = -b;
    const e2 = c;

    if (p.includes('sum of the roots')) {
      return {
        answer: e1,
        invariantUsed: InvariantType.ROOT_DYNAMICS,
        steps: [`Quadratic: x² + ${b}x + ${c} = 0`, `Vieta Identity: Σr = -b/a = ${e1}`],
        logs: [this.createLog(`Analysis: Vieta's identity applied.`)]
      };
    }

    if (p.includes('sum of the squares')) {
      const sumSquares = e1 * e1 - 2 * e2;
      return {
        answer: sumSquares,
        invariantUsed: InvariantType.ROOT_DYNAMICS,
        steps: [
          `Quadratic: x² + ${b}x + ${c} = 0`,
          `Newton's Sum Identity: Σr² = (Σr)² - 2Σr₁r₂`,
          `Calculation: ${e1}² - 2(${e2}) = ${sumSquares}`
        ],
        logs: [this.createLog(`Analysis: Newton sums applied.`)]
      };
    }

    return null;
  }
}
