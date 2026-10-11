import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			compilerOptions: {
				experimental: { async: true },
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			experimental: { remoteFunctions: true }
		})
	],
	server: {
		allowedHosts: ['www.chumrush.localhost'],
		strictPort: true
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
});
