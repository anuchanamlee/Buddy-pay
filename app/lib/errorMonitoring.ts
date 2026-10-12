/**
 * Production Error Monitoring System
 * ระบบติดตามและจัดการข้อผิดพลาดสำหรับ production
 */

interface ErrorContext {
  userId?: string;
  userEmail?: string;
  page?: string;
  action?: string;
  component?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  sessionId?: string;
  buildVersion?: string;
  fromErrorMonitoring?: boolean;
  [key: string]: any;
}

interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  type: 'error' | 'warning' | 'info';
  level: 'low' | 'medium' | 'high' | 'critical';
  context: ErrorContext;
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  resourceLoadTimes: Record<string, number>;
}

class ErrorMonitoring {
  private static instance: ErrorMonitoring;
  private errors: Map<string, ErrorReport> = new Map();
  private isProduction = process.env.NODE_ENV === 'production';
  private maxErrors = 1000; // จำกัดจำนวน error ใน memory
  private sessionId: string;
  private buildVersion: string;
  private isCapturing = false; // ป้องกัน recursive error

  constructor() {
    this.sessionId = this.generateSessionId();
    this.buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown';
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorMonitoring {
    if (!ErrorMonitoring.instance) {
      ErrorMonitoring.instance = new ErrorMonitoring();
    }
    return ErrorMonitoring.instance;
  }

  /**
   * ตั้งค่า Global Error Handlers
   */
  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // จัดการ JavaScript errors
    window.addEventListener('error', (event) => {
      try {
        // ป้องกัน recursive error จาก Error Monitoring ตัวเอง
        if (this.isCapturing) return;
        
        const errorMessage = event.error?.message || event.message || 'Unknown error';
        const errorStack = event.error?.stack || '';
        const filename = event.filename || '';

        // Skip errors from error monitoring system
        if (this.shouldSkipError(errorMessage, errorStack, filename)) {
          return;
        }

        this.captureError(event.error || new Error(event.message), {
          component: 'Global',
          action: 'JavaScript Error',
          url: filename,
          line: event.lineno,
          column: event.colno,
          fromErrorMonitoring: false,
        });
      } catch (monitoringError) {
        // Silent fail เพื่อป้องกัน recursive error
      }
    });

    // จัดการ Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      try {
        // ป้องกัน recursive error
        if (this.isCapturing) return;
        
        const reason = event.reason;
        const reasonMessage = reason?.message || String(reason);
        
        if (this.shouldSkipError(reasonMessage, reason?.stack)) {
          return;
        }

        this.captureError(
          event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
          {
            component: 'Global',
            action: 'Unhandled Promise Rejection',
            fromErrorMonitoring: false,
          }
        );
      } catch (monitoringError) {
        // Silent fail เพื่อป้องกัน recursive error
      }
    });

    // จัดการ Network errors
    this.setupNetworkErrorMonitoring();

    // จัดการ Performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * ตรวจสอบว่าควร skip error นี้หรือไม่
   */
  private shouldSkipError(message: string, stack?: string, filename?: string): boolean {
    const skipPatterns = [
      '[Error Monitoring]',
      'ErrorMonitoring',
      'errorMonitoring',
      'captureError',
      'captureWarning',
      'Error Boundary',
    ];

    return skipPatterns.some(pattern => 
      message.includes(pattern) || 
      stack?.includes(pattern) || 
      filename?.includes(pattern)
    );
  }

  /**
   * บันทึก Error
   */
  captureError(
    error: Error | string,
    context: Partial<ErrorContext> = {},
    level: ErrorReport['level'] = 'medium'
  ): string {
    try {
      // ป้องกัน recursive error
      if (this.isCapturing) {
        return 'error-monitoring-busy';
      }
      
      this.isCapturing = true;

      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      // ป้องกัน recursive error จาก Error Monitoring ตัวเอง
      if (context.fromErrorMonitoring || 
          this.shouldSkipError(errorObj.message, errorObj.stack)) {
        this.isCapturing = false;
        return 'skipped-recursive-error';
      }

      const fingerprint = this.generateFingerprint(errorObj);
      const timestamp = new Date().toISOString();

      const fullContext: ErrorContext = {
        ...context,
        timestamp,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server',
        sessionId: this.sessionId,
        buildVersion: this.buildVersion,
        fromErrorMonitoring: false,
      };

      // ตรวจสอบว่ามี error นี้แล้วหรือไม่
      const existingError = this.errors.get(fingerprint);
      if (existingError) {
        existingError.count++;
        existingError.lastSeen = timestamp;
        existingError.context = { ...existingError.context, ...fullContext };
      } else {
        const newError: ErrorReport = {
          id: this.generateId(),
          message: errorObj.message,
          stack: errorObj.stack,
          type: this.determineErrorType(errorObj),
          level,
          context: fullContext,
          fingerprint,
          count: 1,
          firstSeen: timestamp,
          lastSeen: timestamp,
          resolved: false,
        };

        this.errors.set(fingerprint, newError);

        // ลบ error เก่าถ้าเกินขีด จำกัด
        if (this.errors.size > this.maxErrors) {
          const oldestFingerprint = this.errors.keys().next().value;
          if (oldestFingerprint) {
            this.errors.delete(oldestFingerprint);
          }
        }
      }

      // ส่งไปยัง external services (async, non-blocking)
      const errorReport = this.errors.get(fingerprint);
      if (errorReport) {
        // ใช้ setTimeout เพื่อให้เป็น non-blocking และป้องกัน recursive call
        setTimeout(() => {
          this.sendToExternalServices(errorReport).catch(() => {
            // Silent fail
          });
        }, 0);
      }

      // Log ใน development (ป้องกัน recursive error)
      if (!this.isProduction && !fullContext.fromErrorMonitoring) {
        try {
          // ใช้ console.warn แทน console.error เพื่อหลีกเลี่ยง error listener
          console.warn('[Error Monitoring] Captured Error:', {
            message: errorObj.message,
            level,
            context: fullContext,
            fingerprint,
          });
        } catch (logError) {
          // Silent fail เพื่อป้องกัน recursive error
        }
      }

      this.isCapturing = false;
      return fingerprint;

    } catch (monitoringError) {
      // Silent fail เพื่อป้องกัน recursive error
      this.isCapturing = false;
      return 'error-monitoring-failed';
    }
  }

  /**
   * บันทึก Warning
   */
  captureWarning(message: string, context: Partial<ErrorContext> = {}): string {
    return this.captureError(new Error(message), context, 'low');
  }

  /**
   * บันทึก Critical Error
   */
  captureCriticalError(error: Error | string, context: Partial<ErrorContext> = {}): string {
    return this.captureError(error, context, 'critical');
  }

  /**
   * ตั้งค่า User Context
   */
  setUserContext(userId: string, userEmail?: string): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('error_monitoring_user', JSON.stringify({
          userId,
          userEmail,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        // Silent fail
      }
    }
  }

  /**
   * ล้าง User Context
   */
  clearUserContext(): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('error_monitoring_user');
      } catch (error) {
        // Silent fail
      }
    }
  }

  /**
   * ตั้งค่า Network Error Monitoring
   */
  private setupNetworkErrorMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();

        // Log slow requests
        if (endTime - startTime > 5000) {
          this.captureWarning('Slow Network Request', {
            action: 'Network Request',
            url: args[0]?.toString(),
            duration: endTime - startTime,
          });
        }

        // Log HTTP errors
        if (!response.ok) {
          this.captureError(`HTTP ${response.status}: ${response.statusText}`, {
            action: 'HTTP Error',
            url: args[0]?.toString(),
            status: response.status,
            statusText: response.statusText,
          });
        }

        return response;
      } catch (error) {
        this.captureError(error as Error, {
          action: 'Network Error',
          url: args[0]?.toString(),
        });
        throw error;
      }
    };
  }

  /**
   * ตั้งค่า Performance Monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const metrics = this.collectPerformanceMetrics();
        
        // Log slow page loads
        if (metrics.loadTime > 3000) {
          this.captureWarning('Slow Page Load', {
            action: 'Performance',
            loadTime: metrics.loadTime,
            renderTime: metrics.renderTime,
            memoryUsage: metrics.memoryUsage,
          });
        }

        // Log high memory usage
        if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
          this.captureWarning('High Memory Usage', {
            action: 'Performance',
            memoryUsage: metrics.memoryUsage,
          });
        }
      }, 1000);
    });

    // Monitor memory leaks
    setInterval(() => {
      if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
          this.captureWarning('Potential Memory Leak', {
            action: 'Performance',
            memoryUsage: memory.usedJSHeapSize,
          });
        }
      }
    }, 30000); // ตรวจทุก 30 วินาที
  }

  /**
   * รวบรวม Performance Metrics
   */
  private collectPerformanceMetrics(): PerformanceMetrics {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const memory = 'memory' in performance ? (performance as any).memory : null;

    return {
      loadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
      renderTime: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : 0,
      memoryUsage: memory ? memory.usedJSHeapSize : 0,
      networkLatency: navigation ? navigation.responseStart - navigation.requestStart : 0,
      resourceLoadTimes: this.getResourceLoadTimes(),
    };
  }

  /**
   * ดึง Resource Load Times
   */
  private getResourceLoadTimes(): Record<string, number> {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const loadTimes: Record<string, number> = {};

    resources.forEach((resource) => {
      if (resource.name && resource.duration > 0) {
        const url = new URL(resource.name);
        const key = `${url.pathname}${url.search}`;
        loadTimes[key] = resource.duration;
      }
    });

    return loadTimes;
  }

  /**
   * ส่งข้อมูลไปยัง External Services
   */
  private async sendToExternalServices(errorReport: ErrorReport): Promise<void> {
    // ป้องกัน recursive error จาก Error Monitoring ตัวเอง
    if (this.isCapturing || errorReport.context.fromErrorMonitoring || 
        this.shouldSkipError(errorReport.message, errorReport.stack)) {
      return;
    }

    try {
      // ส่งไป Firebase Analytics (ถ้ามี) - เฉพาะ production
      if (this.isProduction && typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'exception', {
          description: errorReport.message,
          fatal: errorReport.level === 'critical',
          custom_map: {
            error_id: errorReport.id,
            fingerprint: errorReport.fingerprint,
            component: errorReport.context.component,
          },
        });
      }

      // ไม่ส่งไป /api/errors แล้ว (ปิดใช้งาน endpoint) error แสดงให้ผู้ใช้เห็นผ่าน ErrorBoundary แทน

      // ส่งไป Third-party services (เช่น Sentry, LogRocket ฯลฯ) - เฉพาะ production
      if (this.isProduction) {
        await this.sendToThirdPartyServices(errorReport);
      }

    } catch (error) {
      // ไม่ให้ error ของ error monitoring ไปรบกวนระบบหลัก
      // Silent fail เพื่อป้องกัน recursive error
    }
  }

  /**
   * ส่งไป Third-party Services
   */
  private async sendToThirdPartyServices(errorReport: ErrorReport): Promise<void> {
    // สามารถเพิ่ม integration กับ services อื่นๆ ได้ที่นี่
    // เช่น Sentry, LogRocket, Bugsnag ฯลฯ
    
    // ตัวอย่าง: ส่งไป webhook
    if (process.env.NEXT_PUBLIC_ERROR_WEBHOOK_URL) {
      try {
        await fetch(process.env.NEXT_PUBLIC_ERROR_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `🚨 Error Alert: ${errorReport.message}`,
            attachments: [{
              color: this.getLevelColor(errorReport.level),
              fields: [{
                title: 'Error Details',
                value: `**Level:** ${errorReport.level}\n**Component:** ${errorReport.context.component}\n**Count:** ${errorReport.count}`,
                short: false,
              }],
            }],
          }),
        });
      } catch (error) {
        // Silent fail
      }
    }
  }

  /**
   * สร้าง Fingerprint สำหรับ Error
   */
  private generateFingerprint(error: Error): string {
    const message = error.message || 'Unknown Error';
    const stack = error.stack?.split('\n')[0] || '';
    return btoa(message + stack).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * กำหนดประเภทของ Error
   */
  private determineErrorType(error: Error): ErrorReport['type'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('warning') || message.includes('deprecated')) {
      return 'warning';
    }
    
    if (message.includes('info') || message.includes('notice')) {
      return 'info';
    }
    
    return 'error';
  }

  /**
   * สร้าง Session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * สร้าง Error ID
   */
  private generateId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * ดึงสีตาม Error Level
   */
  private getLevelColor(level: ErrorReport['level']): string {
    switch (level) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#33cc33';
      default: return '#666666';
    }
  }

  /**
   * ดึงรายการ Errors ทั้งหมด
   */
  getErrors(): ErrorReport[] {
    return Array.from(this.errors.values()).sort((a, b) => 
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }

  /**
   * ดึง Error สถิติ
   */
  getErrorStats(): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
    unresolved: number;
  } {
    const errors = this.getErrors();
    
    return {
      total: errors.length,
      critical: errors.filter(e => e.level === 'critical').length,
      high: errors.filter(e => e.level === 'high').length,
      medium: errors.filter(e => e.level === 'medium').length,
      low: errors.filter(e => e.level === 'low').length,
      resolved: errors.filter(e => e.resolved).length,
      unresolved: errors.filter(e => !e.resolved).length,
    };
  }

  /**
   * แก้ไข Error (mark as resolved)
   */
  resolveError(fingerprint: string): boolean {
    const error = this.errors.get(fingerprint);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * ล้าง Errors
   */
  clearErrors(): void {
    this.errors.clear();
  }

  /**
   * Export Errors เป็น JSON
   */
  exportErrors(): string {
    return JSON.stringify(this.getErrors(), null, 2);
  }
}

// Export singleton instance
export const errorMonitoring = ErrorMonitoring.getInstance();

// Export helper functions
export const captureError = (error: Error | string, context?: Partial<ErrorContext>) => 
  errorMonitoring.captureError(error, context);

export const captureWarning = (message: string, context?: Partial<ErrorContext>) => 
  errorMonitoring.captureWarning(message, context);

export const captureCriticalError = (error: Error | string, context?: Partial<ErrorContext>) => 
  errorMonitoring.captureCriticalError(error, context);

export const setUserContext = (userId: string, userEmail?: string) => 
  errorMonitoring.setUserContext(userId, userEmail);

export const clearUserContext = () => 
  errorMonitoring.clearUserContext();

// Export types
export type { ErrorContext, ErrorReport, PerformanceMetrics };

export default errorMonitoring; 