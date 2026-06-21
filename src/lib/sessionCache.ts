/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple, lightweight session-level memory cache for fast SPA transitions
class SessionCache {
  private store: Map<string, any> = new Map();

  get<T>(key: string, defaultValue: T): T {
    if (this.store.has(key)) {
      return this.store.get(key) as T;
    }
    return defaultValue;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const sessionCache = new SessionCache();
