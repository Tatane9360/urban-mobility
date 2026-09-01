import { loadTestEnv } from './env';

// setupFiles runs inside every Jest worker before the test module graph is
// imported, which is what AppModule's ConfigModule ends up reading.
loadTestEnv();
