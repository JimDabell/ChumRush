<script lang="ts">
	import { onMount } from 'svelte';
	import type { SearchBoxCore, SearchBoxSuggestion } from '@mapbox/search-js-core';
	import { PUBLIC_MAPBOX_ACCESS_TOKEN } from '$app/env/public';
	import type { City } from '#lib/maps/city.ts';

	let { proximity, onselect }: { proximity: City['center']; onselect: (city: City) => void } =
		$props();

	let search = $state.raw<SearchBoxCore>();
	let sessionToken = '';
	let startupError = $state('');

	onMount(() => {
		let disposed = false;
		if (PUBLIC_MAPBOX_ACCESS_TOKEN) {
			void import('@mapbox/search-js-core')
				.then(({ SearchBoxCore }) => {
					if (disposed) return;
					sessionToken = crypto.randomUUID();
					search = new SearchBoxCore({
						accessToken: PUBLIC_MAPBOX_ACCESS_TOKEN,
						language: 'en',
						limit: 5,
						types: 'place,locality,neighborhood,address,poi'
					});
				})
				.catch(() => {
					if (!disposed) startupError = 'Location search could not start. Please reopen this menu.';
				});
		}
		return () => {
			disposed = true;
		};
	});
	let query = $state('');
	let suggestions = $state<SearchBoxSuggestion[]>([]);
	let activeIndex = $state(-1);
	let loading = $state(false);
	let retrieving = $state(false);
	let error = $state('');
	let searched = $state(false);
	let attribution = $state('');
	let retrieveController: AbortController | undefined;
	let revision = 0;
	const id = $props.id();

	$effect(() => {
		const text = query.trim();
		const center = proximity;
		const client = search;
		const current = ++revision;
		const controller = new AbortController();
		retrieveController?.abort();
		retrieving = false;
		suggestions = [];
		activeIndex = -1;
		searched = false;
		error = '';
		attribution = '';
		const shouldSearch = text.length >= 2 && Boolean(PUBLIC_MAPBOX_ACCESS_TOKEN);
		loading = shouldSearch;

		if (!shouldSearch || !client) return () => controller.abort();

		const timer = setTimeout(async () => {
			const timeout = setTimeout(() => controller.abort(), 10_000);
			try {
				const response = await client.suggest(text, {
					sessionToken,
					proximity: center,
					signal: controller.signal
				});
				if (current !== revision || controller.signal.aborted) return;
				suggestions = response.suggestions;
				attribution = response.attribution ?? '';
				searched = true;
			} catch {
				if (current === revision) error = 'Location search is unavailable. Please try again.';
			} finally {
				clearTimeout(timeout);
				if (current === revision) loading = false;
			}
		}, 300);

		return () => {
			++revision;
			clearTimeout(timer);
			controller.abort();
			retrieveController?.abort();
		};
	});

	async function select(suggestion: SearchBoxSuggestion) {
		if (!search) return;
		retrieveController?.abort();
		const controller = new AbortController();
		retrieveController = controller;
		const current = revision;
		retrieving = true;
		error = '';
		const timeout = setTimeout(() => controller.abort(), 10_000);
		try {
			const response = await search.retrieve(suggestion, {
				sessionToken,
				signal: controller.signal
			});
			if (current !== revision || controller.signal.aborted) return;
			const feature = response.features[0];
			const [longitude, latitude] = feature?.geometry.coordinates ?? [];
			if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error('No location');
			onselect({
				name: feature.properties.name || suggestion.name,
				center: [longitude, latitude],
				zoom: feature.properties.feature_type === 'place' ? 11 : 14
			});
		} catch {
			if (current === revision) error = 'This location could not load. Please try again.';
		} finally {
			clearTimeout(timeout);
			sessionToken = crypto.randomUUID();
			if (current === revision) retrieving = false;
		}
	}

	function navigate(event: KeyboardEvent) {
		if (retrieving || !suggestions.length) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
			document.getElementById(`${id}-result-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault();
			void select(suggestions[activeIndex]);
		}
	}
</script>

<div class="location-search">
	<label for={`${id}-input`}>Search for a place</label>
	<input
		bind:value={query}
		id={`${id}-input`}
		type="search"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={suggestions.length > 0}
		aria-controls={`${id}-results`}
		aria-activedescendant={activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined}
		aria-describedby={`${id}-status`}
		placeholder="City, neighbourhood, or park"
		autocomplete="off"
		maxlength="256"
		disabled={!PUBLIC_MAPBOX_ACCESS_TOKEN}
		onkeydown={navigate}
	/>
	<ul id={`${id}-results`} role="listbox" aria-label="Location suggestions">
		{#each suggestions as suggestion, index (suggestion.mapbox_id)}
			<li
				id={`${id}-result-${index}`}
				role="option"
				aria-selected={activeIndex === index}
				aria-disabled={retrieving}
				tabindex="-1"
				onpointerdown={(event) => event.preventDefault()}
				onclick={() => {
					if (!retrieving) void select(suggestion);
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' && !retrieving) void select(suggestion);
				}}
			>
				<strong>{suggestion.name}</strong>
				<span>{suggestion.place_formatted}</span>
			</li>
		{/each}
	</ul>
	<p id={`${id}-status`} class="status" role="status">
		{#if !PUBLIC_MAPBOX_ACCESS_TOKEN}
			Add a Mapbox token to enable location search.
		{:else if error || startupError}
			{error || startupError}
		{:else if retrieving}
			Opening location…
		{:else if loading}
			Searching…
		{:else if searched && suggestions.length === 0}
			No places found. Try another name.
		{/if}
	</p>
	{#if searched}
		<p class="attribution">
			{attribution || '© Mapbox'} ·
			<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a>
		</p>
	{/if}
</div>

<style>
	.location-search {
		border-block-start: 1px solid var(--color-border);
		margin-block-start: 0.5rem;
		padding: 1rem 0.5rem 0.25rem;
	}

	label {
		display: block;
		margin-block-end: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	input {
		inline-size: 100%;
		min-block-size: 2.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.625rem;
		padding: 0.625rem 0.75rem;
		color: var(--color-ink);
		background: white;
		font-size: 1rem;
	}

	ul {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
	}

	li {
		display: grid;
		gap: 0.125rem;
		border-radius: 0.5rem;
		padding: 0.75rem;
		cursor: pointer;
	}

	li:hover,
	li[aria-selected='true'] {
		background: var(--color-canvas);
	}

	li[aria-disabled='true'] {
		cursor: wait;
	}

	strong {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	li span,
	.status,
	.attribution {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.status:not(:empty),
	.attribution {
		margin-block-start: 0.75rem;
	}

	.attribution a {
		color: inherit;
	}
</style>
