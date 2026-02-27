import { Env } from './types';
import { handleRequest } from './router';
import { StorageService } from './services/storage';
import { runScheduledBackupIfDue } from './services/backup';
import { applyCors, jsonResponse } from './utils/response';

let dbInitialized = false;
let dbInitError: string | null = null;
let dbInitPromise: Promise<void> | null = null;

async function ensureDatabaseInitialized(env: Env): Promise<void> {
  if (dbInitialized) return;

  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const storage = new StorageService(env.DB);
      await storage.initializeDatabase();
      dbInitialized = true;
      dbInitError = null;
    })()
      .catch((error: unknown) => {
        console.error('Failed to initialize database:', error);
        dbInitError = error instanceof Error ? error.message : 'Unknown database initialization error';
      })
      .finally(() => {
        dbInitPromise = null;
      });
  }

  await dbInitPromise;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    void ctx;
    await ensureDatabaseInitialized(env);
    if (dbInitError) {
      const resp = jsonResponse(
        {
          error: 'Database not initialized',
          error_description: dbInitError,
          ErrorModel: {
            Message: dbInitError,
            Object: 'error',
          },
        },
        500
      );
      return applyCors(request, resp);
    }

    const resp = await handleRequest(request, env);
    return applyCors(request, resp);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    void controller;

    await ensureDatabaseInitialized(env);
    if (dbInitError) {
      console.error('Scheduled task skipped: database not initialized', dbInitError);
      return;
    }

    ctx.waitUntil((async () => {
      const result = await runScheduledBackupIfDue(env);
      if (result.status === 'failure') {
        console.error('Scheduled backup failed:', result.state.lastError || 'unknown error');
      }
    })());
  },
};
