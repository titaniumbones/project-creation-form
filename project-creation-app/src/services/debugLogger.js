// Debug logging system for capturing all API operations
// Enable debug mode in the UI to capture requests, responses, and data transformations
// Download the log as JSON for inspection

class DebugLogger {
  constructor() {
    this.enabled = false;
    this.logs = [];
    this.startTime = null;
  }

  start() {
    this.enabled = true;
    this.logs = [];
    this.startTime = Date.now();
    this.log('session', 'Debug session started');
  }

  stop() {
    this.log('session', 'Debug session ended', {
      duration: Date.now() - this.startTime,
      totalLogs: this.logs.length,
    });
    this.enabled = false;
  }

  log(category, message, data = null) {
    if (!this.enabled) return;

    this.logs.push({
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      category, // 'form', 'airtable', 'asana', 'google', 'transform', 'error', 'session'
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : null, // Deep clone to avoid mutations
    });
  }

  logApiRequest(service, endpoint, method, payload) {
    this.log(service, `API Request: ${method} ${endpoint}`, {
      type: 'request',
      method,
      endpoint,
      payload,
    });
  }

  logApiResponse(service, endpoint, response, error = null) {
    this.log(service, `API Response: ${endpoint}`, {
      type: 'response',
      endpoint,
      success: !error,
      response,
      error: error ? { message: error.message, stack: error.stack } : null,
    });
  }

  logTransform(from, to, beforeData, afterData) {
    this.log('transform', `Data transform: ${from} -> ${to}`, {
      before: beforeData,
      after: afterData,
    });
  }

  logError(category, message, error, context = null) {
    this.log('error', `[${category}] ${message}`, {
      error: {
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }

  getLogs() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessionDuration: this.startTime ? Date.now() - this.startTime : 0,
      logCount: this.logs.length,
      logs: this.logs,
    };
  }

  downloadLogs() {
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

  isEnabled() {
    return this.enabled;
  }

  getLogCount() {
    return this.logs.length;
  }
}

export const debugLogger = new DebugLogger();
export default debugLogger;
