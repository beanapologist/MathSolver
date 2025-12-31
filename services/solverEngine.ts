
import { InvariantType, SolverResult, SolverLog } from '../types';
import { PluginRegistry, ISolverPlugin } from './pluginSystem';
import { SpectralZetaPlugin } from './plugins/spectralZeta';
import { PolynomialPlugin } from './plugins/polynomial';
import { RootDynamicsPlugin } from './plugins/rootDynamics';
import { SequencesPlugin } from './plugins/sequences';
import { FunctionalEquationPlugin } from './plugins/functionalEquation';
import { NumberTheoryPlugin } from './plugins/numberTheory';
import { DiophantinePlugin } from './plugins/diophantine';
import { CombinatorialPlugin } from './plugins/combinatorial';

export class AxiomPrimeSolver {
  private modulo: number = 100000;
  private registry: PluginRegistry;

  constructor(modulo: number = 100000) {
    this.modulo = modulo;
    this.registry = new PluginRegistry();
    this.initializePlugins();
  }

  /**
   * Initialize all available plugins in the registry
   */
  private initializePlugins(): void {
    // Register plugins in the order they should be tried
    this.registry.register(new SpectralZetaPlugin());
    this.registry.register(new PolynomialPlugin(this.modulo));
    this.registry.register(new NumberTheoryPlugin());
    this.registry.register(new CombinatorialPlugin(this.modulo));
    this.registry.register(new DiophantinePlugin(this.modulo));
    this.registry.register(new SequencesPlugin());
    this.registry.register(new RootDynamicsPlugin());
    this.registry.register(new FunctionalEquationPlugin());
  }

  /**
   * Get the plugin registry for inspection or dynamic plugin management
   */
  getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Register a custom plugin at runtime
   */
  registerPlugin(plugin: ISolverPlugin): void {
    this.registry.register(plugin);
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name: string): boolean {
    return this.registry.unregister(name);
  }

  private createLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): SolverLog {
    return {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
  }

  /**
   * Main solve method that tries all registered plugins in order
   * @param problem The problem to solve
   * @returns The solution result or a fallback message
   */
  async solve(problem: string): Promise<SolverResult> {
    const plugins = this.registry.getAllPlugins();

    // Try each plugin in order
    for (const plugin of plugins) {
      try {
        const result = plugin.solve(problem);
        if (result && (result.answer !== 0 || result.invariantUsed !== null)) {
          return result;
        }
      } catch (e) {
        // Continue to next plugin if current one throws
        continue;
      }
    }

    // Fallback: no plugin could solve the problem
    return {
      answer: 0,
      invariantUsed: null,
      steps: ["No deterministic invariant found. Switching to stochastic logic engine."],
      logs: [this.createLog(`Analysis: Deterministic bypass. Engaging Gemini engine.`, 'warning')]
    };
  }
}
