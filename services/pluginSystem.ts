import { InvariantType, SolverResult, SolverLog } from '../types';

/**
 * Base interface for all solver plugins.
 * Each plugin represents a specific mathematical algorithm that can solve certain types of problems.
 */
export interface ISolverPlugin {
  /**
   * Unique identifier for the plugin
   */
  name: string;

  /**
   * The invariant type this plugin solves for
   */
  invariantType: InvariantType;

  /**
   * Attempts to solve the given problem using this plugin's algorithm
   * @param problem The problem statement
   * @returns The solution result, or null if this plugin cannot solve the problem
   */
  solve(problem: string): SolverResult | null;
}

/**
 * Abstract base class for solver plugins.
 * Provides common utilities like logging and helper methods.
 */
export abstract class BaseSolverPlugin implements ISolverPlugin {
  abstract name: string;
  abstract invariantType: InvariantType;

  /**
   * Create a standardized log entry
   */
  protected createLog(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): SolverLog {
    return {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
  }

  /**
   * Calculate GCD of two numbers
   */
  protected gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      a %= b;
      [a, b] = [b, a];
    }
    return a;
  }

  /**
   * Main solve method - implemented by subclasses
   */
  abstract solve(problem: string): SolverResult | null;
}

/**
 * Registry for managing solver plugins.
 * Allows registering, retrieving, and iterating over plugins.
 */
export class PluginRegistry {
  private plugins: Map<string, ISolverPlugin> = new Map();

  /**
   * Register a new plugin
   */
  register(plugin: ISolverPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): ISolverPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): ISolverPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin names in order
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
  }
}
