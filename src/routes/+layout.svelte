<script lang="ts">
	import '../app.css';
	import { asset } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#f0edf8" />
	<link rel="icon" type="image/svg+xml" href={asset('icon.svg')} />
	<link rel="apple-touch-icon" href={asset('icons/apple-touch-icon.png')} />
	<link rel="manifest" href={asset('manifest.webmanifest')} />
</svelte:head>

{@render children()}
