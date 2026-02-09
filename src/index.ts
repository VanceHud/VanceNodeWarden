import { Env } from './types';
import { handleRequest } from './router';
import { StorageService } from './services/storage';

// Global flag to track if database has been initialized in this worker instance
let dbInitialized = false;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Auto-initialize database on first request
    if (!dbInitialized) {
      try {
        const storage = new StorageService(env.DB);
        await storage.initializeDatabase();
        dbInitialized = true;
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Continue anyway - the error will surface when actual DB operations are attempted
      }
    }

    return handleRequest(request, env);
  },
};
