// Debug logging system for capturing all API operations
// Enable debug mode in the UI to capture requests, responses, and data transformations
// Download the log as JSON for inspection

import type { DebugLog, DebugCategory } from '../types';

interface LogExport {
  version: string;
  exportedAt: string;
  sessionDuration: number;
  logCount: number;
  logs: DebugLog[];
}

class DebugLogger {
  private enabled: boolean = false;
  private logs: DebugLog[] = [];
  private startTime: number | null = null;

  start(): void {
    this.enabled = true;
    this.logs = [];
    this.startTime = Date.now();
    this.log('session', 'Debug session started');
  }

  stop(): void {
    this.log('session', 'Debug session ended', {
      duration: Date.now() - (this.startTime || 0),
      totalLogs: this.logs.length,
    });
    this.enabled = false;
  }

  log(category: DebugCategory, message: string, data: unknown = null): void {
    if (!this.enabled) return;

    this.logs.push({
      timestamp: Date.now(),
      elapsed: Date.now() - (this.startTime || 0),
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
    });
  }

  logApiRequest(service: DebugCategory, endpoint: string, method: string, payload: unknown): void {
    this.log(service, `API Request: ${method} ${endpoint}`, {
      type: 'request',
      method,
      endpoint,
      payload,
    });
  }

  logApiResponse(service: DebugCategory, endpoint: string, response: unknown, error: Error | null = null): void {
    this.log(service, `API Response: ${endpoint}`, {
      type: 'response',
      endpoint,
      success: !error,
      response,
      error: error ? { message: error.message, stack: error.stack } : null,
    });
  }

  logTransform(from: string, to: string, beforeData: unknown, afterData: unknown): void {
    this.log('transform', `Data transform: ${from} -> ${to}`, {
      before: beforeData,
      after: afterData,
    });
  }

  logError(category: DebugCategory, message: string, error: Error, context: unknown = null): void {
    this.log('error', `[${category}] ${message}`, {
      error: {
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }

  getLogs(): LogExport {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessionDuration: this.startTime ? Date.now() - this.startTime : 0,
      logCount: this.logs.length,
      logs: this.logs,
    };
  }

  downloadLogs(): void {
    const data = this.getLogs();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-creation-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getLogCount(): number {
    return this.logs.length;
  }
}

export const debugLogger = new DebugLogger();
export default debugLogger;
