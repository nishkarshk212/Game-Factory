import { config } from './config.js';
import { createAppServer } from './app.js';

async function main() {
  const srv = await createAppServer();
  srv.httpServer.listen(config.port, () => {
    console.log(
      `[GameVerse | Powered by Sonic Network] Server listening on http://localhost:${config.port}`
    );
  });

  const shutdown = async () => {
    console.log('\n[GameVerse] Shutting down gracefully...');
    await srv.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[GameVerse] Fatal startup error:', err);
  process.exit(1);
});

