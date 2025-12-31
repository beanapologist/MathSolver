import { InvariantType, SolverResult } from '../../types';
import { BaseSolverPlugin } from '../pluginSystem';

/**
 * Sequences Plugin
 * Solves arithmetic and geometric sequence problems.
 * Handles summation formulas for progressions.
 */
export class SequencesPlugin extends BaseSolverPlugin {
  name = 'sequences';
  invariantType = InvariantType.SEQUENCES;

  solve(problem: string): SolverResult | null {
    const p = problem.toLowerCase();
    if (!p.includes('progression') && !p.includes('arithmetic series') && !p.includes('geometric series'))
      return null;

    const arithMatch = p.match(/arithmetic.*?first term\s*(\d+).*?common difference\s*(\d+).*?(\d+)\s*terms/i);
    if (arithMatch) {
      const a = parseInt(arithMatch[1]);
      const d = parseInt(arithMatch[2]);
      const n = parseInt(arithMatch[3]);
      const sum = (n / 2) * (2 * a + (n - 1) * d);
      return {
        answer: sum,
        invariantUsed: InvariantType.SEQUENCES,
        steps: [
          `Arithmetic Progression: a=${a}, d=${d}, n=${n}`,
          `Sum Formula: n/2 * (2a + (n-1)d)`,
          `Result: ${sum}`
        ],
        logs: [this.createLog(`Analysis: Sequence summation complete.`)]
      };
    }

    return null;
  }
}
