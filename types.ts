
export enum InvariantType {
  POLYNOMIAL = 'Polynomial (Linear Reduction)',
  COMBINATORIAL = 'Combinatorial (Subset S_n)',
  DIOPHANTINE = 'Diophantine (Frobenius)',
  REPEATING_DECIMAL = 'Repeating Decimal',
  MODULAR = 'Modular Arithmetic',
  GEOMETRIC = 'Geometric',
  NUMBER_THEORY = 'Eulerian Number Theory (Totient/Lucas)',
  ROOT_DYNAMICS = 'Root Dynamics (Newton Sums)',
  SPECTRAL_ZETA = 'Spectral Zeta Analysis (Riemann/Euler Score)',
  SEQUENCES = 'Sequence Analysis (Arithmetic/Geometric)',
  FUNCTIONAL_EQ = 'Functional Equation (Cauchy/Shifted)',
  QUANTUM_FALLBACK = 'Quantum Fallback (AI)',
  LIVE_TRANSCRIPTION = 'Live Voice Sync'
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  type: 'proof' | 'scratch' | 'invariant' | 'benchmark';
  lastModified: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SolverLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface ReferenceProblem {
  id: number;
  title: string;
  problem: string;
  expectedAnswer: number;
}

export interface SolverResult {
  answer: number | string | null;
  invariantUsed: InvariantType | null;
  steps: string[];
  logs: SolverLog[];
  reasoning?: string;
  groundingSources?: GroundingSource[];
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  expected: any;
  actual: any;
  error?: string;
  duration: number;
}

export interface TestSuiteReport {
  timestamp: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  results: TestResult[];
}

export interface UserRequest {
  id: string;
  timestamp: string;
  title: string;
  category: 'Deduction Logic' | 'UI/UX' | 'Optic Feed' | 'General';
  description: string;
  status: 'Pending' | 'Researching' | 'Validated';
}
