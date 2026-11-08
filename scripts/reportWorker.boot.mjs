// Bootstraps the TypeScript worker through tsx's ESM loader (worker_threads do not inherit it).
import { register } from 'tsx/esm/api';
register();
await import('./reportWorker.ts');
