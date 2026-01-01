import { rtdb } from "@/lib/firebase";
import { ServerValue } from "firebase-admin/database";
import { auth } from "@/auth";

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
  environment: string;
  userId?: string;
  context?: string;
  createdAt?: any;
}

const MAX_LOGS = 1000;
const CLEANUP_PROBABILITY = 0.1; // 10% chance to run cleanup on log write

/**
 * Unified Logger for Server Actions
 */
class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  async info(message: string, data?: any, context?: string) {
    await this.log('info', message, data, context);
  }

  async warn(message: string, data?: any, context?: string) {
    await this.log('warn', message, data, context);
  }

  async error(message: string, data?: any, context?: string) {
    await this.log('error', message, data, context);
  }

  async debug(message: string, data?: any, context?: string) {
    await this.log('debug', message, data, context);
  }

  private async log(level: LogLevel, message: string, data?: any, context?: string) {
    const timestamp = Date.now();
    let userId = 'system';

    try {
        const session = await auth();
        if (session?.user?.id) userId = session.user.id;
    } catch (e) {
        // ignore
    }

    const entry: LogEntry = {
      level,
      message,
      data: this.sanitize(data),
      timestamp,
      environment: process.env.NODE_ENV || 'unknown',
      userId,
      context
    };

    // 1. Console Output
    this.consoleLog(entry);

    // 2. RTDB Storage (Prod or explicit request)
    await this.pushToRTDB(entry);
  }

  private consoleLog(entry: LogEntry) {
    if (this.isDev) {
      const color = this.getColor(entry.level);
      const reset = "\x1b[0m";
      const gray = "\x1b[90m";
      const time = new Date(entry.timestamp).toISOString().split('T')[1].slice(0, -1);
      
      console.log(
        `${gray}[${time}]${reset} ${color}${entry.level.toUpperCase()}${reset} ${entry.message}`,
        entry.data ? entry.data : '',
        entry.context ? `${gray}(${entry.context})${reset}` : ''
      );
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  private async pushToRTDB(entry: LogEntry) {
    try {
      const logsRef = rtdb.ref('server_logs');
      
      await logsRef.push({
        ...entry,
        createdAt: ServerValue.TIMESTAMP
      });

      if (Math.random() < CLEANUP_PROBABILITY) {
          await this.cleanupOldLogs();
      }
    } catch (e) {
      console.error("Logger failed to push to RTDB:", e);
    }
  }

  private async cleanupOldLogs() {
      try {
          const logsRef = rtdb.ref('server_logs');
          
          // Fetch the last MAX_LOGS logs to find the boundary
          const recentSnap = await logsRef.orderByChild('createdAt').limitToLast(MAX_LOGS).once('value');
          
          if (!recentSnap.exists()) return;

          const recentLogs = recentSnap.val();
          const recentKeys = Object.keys(recentLogs);
          
          if (recentKeys.length < MAX_LOGS) return; // Not full yet

          // Logic: Get the oldest key in the "recent" set. Anything strictly before that key should be deleted.
          // Since keys are push IDs (chronological) & we sort by createdAt, the 'boundary' is fuzzy if we rely on createdAt.
          // But limitToLast returns correct set.
          
          // However, we want to delete everything NOT in this set.
          // Efficient way in Admin SDK:
          // 1. Get first 1 log (oldest in entire DB)
          // 2. If it's not in our 'recent' set, we need to delete range.
          
          // Simpler: Just fetch limitToLast(MAX_LOGS + 50) and delete the excess 50.
          // This keeps it strictly bounded without scanning whole DB.
          
          const bufferSize = 50;
          const checkSnap = await logsRef.orderByChild('createdAt').limitToLast(MAX_LOGS + bufferSize).once('value');
          
          if (!checkSnap.exists()) return;
          
          const val = checkSnap.val();
          const keys = Object.keys(val);
          
          if (keys.length <= MAX_LOGS) return;
          
          // Sort keys by createdAt (values) or just by Push ID (keys)
          // Push IDs are monotonic, so sorting keys is enough.
          keys.sort();
          
          const tasksToDeleteCount = keys.length - MAX_LOGS;
          const keysToDelete = keys.slice(0, tasksToDeleteCount);
          
          const updates: Record<string, null> = {};
          keysToDelete.forEach(k => {
              updates[k] = null;
          });
          
          await logsRef.update(updates);

      } catch (e) {
          console.error("Cleanup failed:", e);
      }
  }

  private sanitize(data: any): any {
    if (data === undefined || data === null) return null;
    if (typeof data !== 'object') return data;
    
    try {
        const str = JSON.stringify(data, (key, value) => {
            if (['password', 'token', 'key', 'secret', 'auth'].some(k => key.toLowerCase().includes(k))) {
                return '***MASKED***';
            }
            return value;
        });
        return JSON.parse(str);
    } catch {
        return '[Circular/Unserializable]';
    }
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'info': return "\x1b[36m"; 
      case 'warn': return "\x1b[33m"; 
      case 'error': return "\x1b[31m";
      case 'debug': return "\x1b[35m";
      default: return "\x1b[37m";
    }
  }
}

export const logger = new Logger();
