
export enum InvariantType {
  POLYNOMIAL = 'Polynomial Linear Reduction',
  COMBINATORIAL = 'Combinatorial Subset Identity',
  DIOPHANTINE = 'Frobenius Boundary Analysis',
  REPEATING_DECIMAL = 'Repeating Decimal Periodicity',
  MODULAR = 'Modular Congruence',
  GEOMETRIC = 'Geometric Vertex Analysis',
  NUMBER_THEORY = 'Eulerian Number Theory',
  ROOT_DYNAMICS = 'Root-Dynamic Newton Sums',
  SPECTRAL_ZETA = 'Spectral Zeta Convergence',
  SEQUENCES = 'Sequence Progression Analysis',
  FUNCTIONAL_EQ = 'Functional Equation Synthesis',
  QUANTUM_FALLBACK = 'Stochastic Deduction (AI)',
  LIVE_TRANSCRIPTION = 'Acoustic Feed Sync'
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
