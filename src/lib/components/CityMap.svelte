<script lang="ts">
	import { onMount } from 'svelte';
	import type { Map, GeolocateControl } from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { PUBLIC_MAPBOX_ACCESS_TOKEN } from '$app/env/public';
	import type { City } from '#lib/maps/city.ts';

	let {
		city,
		nearMe = false,
		onlocating,
		onlocate,
		onlocationerror
	}: {
		city: City;
		nearMe?: boolean;
		onlocating?: () => void;
		onlocate?: (city: City) => void;
		onlocationerror?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let ready = $state(false);
	let mapError = $state('');
	let locationError = $state('');
	let map = $state.raw<Map>();
	let geolocate: GeolocateControl | undefined;
	let pendingLocation = false;
	let lastPlace: City | undefined;

	$effect(() => {
		const place = city;
		if (map && !nearMe) {
			pendingLocation = false;
			if (place !== lastPlace) locationError = '';
			map.flyTo({ center: place.center, zoom: place.zoom ?? 11 });
		}
		lastPlace = place;
	});

	function failLocation(message: string) {
		pendingLocation = false;
		locationError = message;
		onlocationerror?.();
	}

	function requestLocation() {
		pendingLocation = false;
		if (!geolocate?.trigger()) failLocation('Device location is unavailable. Please try again.');
	}

	export function locate() {
		locationError = '';
		onlocating?.();
		if (!PUBLIC_MAPBOX_ACCESS_TOKEN || mapError) {
			failLocation('Load the map before using device location.');
		} else if (ready) {
			requestLocation();
		} else {
			pendingLocation = true;
		}
	}

	onMount(() => {
		let disposed = false;
		function handleLocationClick(event: MouseEvent) {
			if (event.target instanceof Element && event.target.closest('.mapboxgl-ctrl-geolocate')) {
				locationError = '';
				onlocating?.();
			}
		}
		container.addEventListener('click', handleLocationClick, true);

		async function initialize() {
			if (!PUBLIC_MAPBOX_ACCESS_TOKEN) return;

			const { default: sdk } = await import('mapbox-gl');
			if (disposed) return;

			map = new sdk.Map({
				container,
				accessToken: PUBLIC_MAPBOX_ACCESS_TOKEN,
				// Mapbox's Cool template from the official style gallery.
				style: 'mapbox://styles/mapbox-map-design/cmclxnhzb008001sb6g3m49ko',
				center: city.center,
				zoom: city.zoom ?? 11,
				attributionControl: true
			});

			map.on('style.load', () => {
				map?.setSnow(null);
			});

			map.addControl(new sdk.NavigationControl({ showCompass: false }), 'top-right');

			geolocate = new sdk.GeolocateControl({
				positionOptions: { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
				trackUserLocation: false,
				showUserLocation: true,
				showAccuracyCircle: true,
				fitBoundsOptions: { maxZoom: 15 }
			});
			map.addControl(geolocate, 'top-right');
			geolocate.on('geolocate', (position: GeolocationPosition) => {
				if (disposed) return;
				// A city picked while GPS was pending takes precedence over its late result.
				if (!nearMe && onlocating) {
					map?.jumpTo({ center: city.center, zoom: city.zoom ?? 11 });
					return;
				}
				locationError = '';
				onlocate?.({
					name: 'near me',
					center: [position.coords.longitude, position.coords.latitude],
					zoom: 15
				});
			});
			geolocate.on('error', () => {
				if (!disposed && (nearMe || !onlocating)) {
					failLocation('Location unavailable. Check your browser’s location permission.');
				}
			});

			map.on('load', () => {
				ready = true;
				mapError = '';
				if (pendingLocation) requestLocation();
			});
			map.on('error', () => {
				mapError = 'Map data could not load. Check your connection and Mapbox token, then reload.';
				if (pendingLocation) failLocation('Device location is unavailable until the map loads.');
			});
		}

		void initialize().catch(() => {
			if (!disposed) {
				mapError = 'The map could not start. Check your connection and WebGL support.';
				if (pendingLocation) failLocation('Device location is unavailable until the map loads.');
			}
		});

		return () => {
			disposed = true;
			container.removeEventListener('click', handleLocationClick, true);
			map?.remove();
		};
	});
</script>

<div class="map-frame">
	<div class="map" bind:this={container} role="region" aria-label="Interactive map"></div>

	{#if !PUBLIC_MAPBOX_ACCESS_TOKEN}
		<div class="message">
			<p>Add your Mapbox public token to load the map.</p>
			<p>
				Set <code>PUBLIC_MAPBOX_ACCESS_TOKEN</code> in <code>.env</code> and restart the dev server.
			</p>
		</div>
	{:else if mapError}
		<p class="message" role="alert">{mapError}</p>
	{:else if !ready}
		<p class="message" role="status">Loading map…</p>
	{/if}

	{#if locationError}
		<p class="location-error" role="alert">{locationError}</p>
	{/if}
</div>

<style>
	.map-frame {
		position: relative;
		z-index: 0;
		min-inline-size: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 1.5rem;
		background: var(--color-secondary);
		box-shadow: 0 1.5rem 4rem -1.5rem var(--color-shadow);
	}

	.map {
		inline-size: 100%;
		block-size: clamp(22rem, 65svh, 44rem);
	}

	.map :global(.mapboxgl-ctrl-group) {
		border-radius: 0.625rem;
		background: var(--color-surface);
		box-shadow: 0 0.125rem 0.75rem var(--color-shadow);
	}

	.map :global(.mapboxgl-ctrl-geolocate) {
		background-color: var(--color-accent);
	}

	.map :global(.mapboxgl-ctrl-group button:not(:disabled):hover) {
		background-color: var(--color-secondary);
	}

	.message,
	.location-error {
		position: absolute;
		inset-inline-start: 1rem;
		max-inline-size: calc(100% - 5rem);
		border-radius: 0.75rem;
		padding: 1rem;
		background: var(--color-surface);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}

	.message {
		inset-block-start: 1rem;
		display: grid;
		gap: 0.5rem;
	}

	.location-error {
		inset-block-end: 3rem;
	}
</style>
