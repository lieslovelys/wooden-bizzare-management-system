// Split from app.js (P1-11) so the Express app can be imported without binding a port —
// supertest needs the bare `app`, not a listening server. app.js owns every middleware/route
// registration; this file owns only process-level concerns: starting the listener and draining
// it on shutdown.
import { app, pool } from './app.js';
import photoStorage from './utils/photoStorage.js';
import { logger } from './config/logger.js';

// Fail fast if the upload directory (a Docker named volume in the deployed stack — see
// docker-compose.yml) isn't writable, rather than surfacing as a mysterious 500 on the first
// photo upload. Deliberately not in app.js: supertest-driven tests import `app` directly without
// going through this file, and have no reason to touch the real filesystem.
try {
    await photoStorage.ensureUploadDir();
} catch (error) {
    logger.fatal({ err: error, uploadDir: photoStorage.UPLOAD_DIR }, 'upload directory is not writable');
    process.exit(1);
}

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
    logger.info({ port }, 'server running');
});

// P1-8: without this, every container restart/redeploy (expected to be routine under the
// planned Docker Compose setup, P1-10) severs in-flight requests instead of finishing them.
// Stop accepting new connections, let existing ones drain, close the pool, then exit — with a
// forced-exit fallback in case something hangs.
function shutdown(signal) {
    logger.info({ signal }, 'shutdown: received signal, closing server');
    server.close(async () => {
        try {
            await pool.end();
            logger.info('shutdown: pool closed, exiting');
            process.exit(0);
        } catch (error) {
            logger.error({ err: error }, 'shutdown: error while closing pool');
            process.exit(1);
        }
    });
    setTimeout(() => {
        logger.error('shutdown: forced exit after timeout');
        process.exit(1);
    }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
