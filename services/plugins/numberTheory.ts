import { InvariantType, SolverResult } from '../../types';
import { BaseSolverPlugin } from '../pluginSystem';

/**
 * Number Theory Plugin
 * Implements Lucas theorem for binomial coefficients modulo prime
 * and Euler's totient function calculations.
 */
export class NumberTheoryPlugin extends BaseSolverPlugin {
  name = 'number-theory';
  invariantType = InvariantType.NUMBER_THEORY;

  solve(problem: string): SolverResult | null {
    const p = problem.toLowerCase();

    const binomialMatch =
      problem.match(/(?:choose|ncr|\\binom|C)\s*\(?(\d+)(?:,|\s+|(?:\s+choose\s+))(\d+)\)?.*?(?:mod|divided by)\s*(\d+)/i) ||
      problem.match(/\((\d+)\s+choose\s+(\d+)\).*?(?:mod|divided by)\s*(\d+)/i);

    if (binomialMatch) {
      const n = parseInt(binomialMatch[1]);
      const k = parseInt(binomialMatch[2]);
      const pVal = parseInt(binomialMatch[3]);

      const nCrModP = (n: number, r: number, p: number): number => {
        if (r === 0) return 1;
        if (r > n) return 0;
        let num = 1;
        for (let i = 0; i < r; i++) num = (num * (n - i)) % p;
        let den = 1;
        for (let i = 1; i <= r; i++) den = (den * i) % p;
        const power = (a: number, b: number, m: number) => {
          let res = 1;
          a %= m;
          while (b > 0) {
            if (b % 2 === 1) res = (res * a) % m;
            a = (a * a) % m;
            b = Math.floor(b / 2);
          }
          return res;
        };
        return (num * power(den, p - 2, p)) % p;
      };

      const lucas = (n: number, k: number, p: number): number => {
        if (k === 0) return 1;
        return (lucas(Math.floor(n / p), Math.floor(k / p), p) * nCrModP(n % p, k % p, p)) % p;
      };

      const ans = lucas(n, k, pVal);
      return {
        answer: ans,
        invariantUsed: InvariantType.NUMBER_THEORY,
        steps: [
          `Applying Lucas Theorem for n=${n}, k=${k}, mod ${pVal}`,
          `Base-${pVal} decomposition successful`,
          `Modular congruence: ${ans}`
        ],
        logs: [this.createLog(`Analysis: Modular binomial reduction completed.`)]
      };
    }

    if (p.includes('totient') || p.includes('phi') || (p.includes('relatively prime') && p.includes('less than'))) {
      const nMatch = problem.match(/(\d+)/);
      if (nMatch) {
        let n = parseInt(nMatch[0]);
        let result = n;
        let temp = n;
        for (let i = 2; i * i <= temp; i++) {
          if (temp % i === 0) {
            while (temp % i === 0) temp /= i;
            result -= Math.floor(result / i);
          }
        }
        if (temp > 1) result -= Math.floor(result / temp);

        return {
          answer: result,
          invariantUsed: InvariantType.NUMBER_THEORY,
          steps: [
            `Euler Totient analysis for n=${n}`,
            `Prime factorization complete`,
            `φ(${n}) = ${result}`
          ],
          logs: [this.createLog(`Analysis: Eulerian totient calculated.`)]
        };
      }
    }

    return null;
  }
}
