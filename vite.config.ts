import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite-plus';
import { loadEnv } from 'vite';
import { resolveDeployment } from './src/lib/environment.ts';

export default defineConfig(({ mode }) => {
	const configured = loadEnv(mode, process.cwd(), 'APP_');
	const deployment = resolveDeployment(configured.APP_ENV, configured.APP_ORIGIN);
	const allowedHosts = [deployment.hostname, deployment.apexHostname];

	return {
		define: {
			__CHUMRUSH_APP_ENV__: JSON.stringify(deployment.name),
			__CHUMRUSH_APP_ORIGIN__: JSON.stringify(deployment.origin)
		},
		plugins: [
			sveltekit({
				adapter: adapter(),
				compilerOptions: {
					experimental: { async: true },
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				experimental: { remoteFunctions: true },
				paths: { origin: deployment.origin }
			})
		],
		server: {
			allowedHosts,
			strictPort: true
		},
		preview: {
			allowedHosts
		},
		build: {
			target: 'baseline-widely-available'
		},
		fmt: {
			svelte: true,
			useTabs: true,
			singleQuote: true,
			trailingComma: 'none',
			ignorePatterns: ['.svelte-kit/**', 'build/**', '.pi/**', '.agents/**']
		},
		lint: {
			ignorePatterns: ['.svelte-kit/**', 'build/**', '.pi/**', '.agents/**']
		}
	};
});
