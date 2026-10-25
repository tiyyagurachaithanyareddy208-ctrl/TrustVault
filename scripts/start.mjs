import { spawn } from 'child_process';

function run(command, args) {
  return new Promise((resolve) => {
    console.log(`[TrustVault] Running: ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      resolve(code);
    });
    proc.on('error', (err) => {
      console.warn(`[TrustVault] Step warning: ${err.message}`);
      resolve(1);
    });
  });
}

async function start() {
  console.log('[TrustVault] Initializing deployment database schema...');
  await run('npx', ['prisma', 'db', 'push', '--skip-generate']);

  console.log('[TrustVault] Ensuring seed records exist...');
  await run('node', ['scripts/seed.mjs']);

  const port = process.env.PORT || '3000';
  console.log(`[TrustVault] Starting Next.js server on 0.0.0.0:${port}...`);

  const server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-H', '0.0.0.0', '-p', port], {
    stdio: 'inherit',
    shell: true,
  });

  server.on('close', (code) => {
    process.exit(code || 0);
  });
}

start();
