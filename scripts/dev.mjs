import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { loadEnv } from 'vite';
import { resolveDeployment } from '../src/lib/environment.ts';

const configured = loadEnv('development', process.cwd(), 'APP_');
const deployment = resolveDeployment(configured.APP_ENV, configured.APP_ORIGIN);
if (deployment.name !== 'local' || !deployment.hostname.endsWith('.localhost')) {
	throw new Error('npm run dev requires a local APP_ENV and a .localhost APP_ORIGIN.');
}

const suffix = '.localhost';
const routes = [deployment.hostname, deployment.apexHostname].map((hostname) =>
	hostname.slice(0, -suffix.length)
);

const port = await new Promise((resolve, reject) => {
	const reservation = createServer();
	reservation.once('error', reject);
	reservation.listen(0, '127.0.0.1', () => {
		const address = reservation.address();
		if (!address || typeof address === 'string') {
			reservation.close();
			reject(new Error('Could not reserve a development port.'));
			return;
		}
		reservation.close((error) => (error ? reject(error) : resolve(String(address.port))));
	});
});

const registered = [];
function portless(args) {
	const result = spawnSync('portless', args, { stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Portless command failed: ${args.join(' ')}`);
}

function removeRoutes() {
	for (const route of registered.reverse()) {
		spawnSync('portless', ['alias', '--remove', route], { stdio: 'inherit' });
	}
}

let server;
const signals = ['SIGINT', 'SIGTERM'];
const forwardSignal = (signal) => server?.kill(signal);
try {
	portless(['proxy', 'start']);
	for (const route of routes) {
		portless(['alias', route, port, '--force']);
		registered.push(route);
	}
	server = spawn('vp', ['dev', '--host', '127.0.0.1', '--port', port], {
		env: {
			...process.env,
			APP_ENV: deployment.name,
			APP_ORIGIN: deployment.origin
		},
		stdio: 'inherit'
	});
	for (const signal of signals) process.once(signal, forwardSignal);
	const result = await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.once('exit', (code, signal) => resolve({ code, signal }));
	});
	process.exitCode = result.code ?? (result.signal === 'SIGINT' ? 130 : 143);
} finally {
	for (const signal of signals) process.removeListener(signal, forwardSignal);
	removeRoutes();
}
