<script lang="ts">
	import { tick } from 'svelte';
	import LocationSearch from './LocationSearch.svelte';
	import type { City } from '#lib/maps/city.ts';

	type Picker = 'distance' | 'activity' | 'location';
	let {
		defaultCity,
		city,
		nearMe,
		locating,
		onplace,
		onnearby
	}: {
		defaultCity: City;
		city: City;
		nearMe: boolean;
		locating: boolean;
		onplace: (city: City) => void;
		onnearby: () => void;
	} = $props();

	const distances = [3, 5, 10, 15, 21.1, 42.2, 50, 100];
	const activities = ['run', 'trail run', 'bike ride'];
	const id = $props.id();
	let distance = $state(5);
	let activity = $state('run');
	let active = $state<Picker | null>(null);
	let root: HTMLElement;
	let panel: HTMLDivElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined;
	let left = $state(0);
	let top = $state(0);

	function position() {
		if (!panel || !trigger) return;
		const bounds = root.getBoundingClientRect();
		const anchor = trigger.getBoundingClientRect();
		left = Math.max(0, Math.min(anchor.left - bounds.left, root.clientWidth - panel.offsetWidth));
		top = anchor.bottom - bounds.top + 12;
	}

	async function toggle(picker: Picker, button: HTMLButtonElement) {
		if (active === picker) {
			close();
			return;
		}
		trigger = button;
		active = picker;
		await tick();
		position();
		const selected = panel?.querySelector<HTMLElement>(
			'button[aria-pressed="true"]:not(:disabled)'
		);
		const first = panel?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)');
		(selected ?? first)?.focus();
	}

	function close(restoreFocus = true) {
		active = null;
		if (restoreFocus) trigger?.focus();
	}

	function outside(event: PointerEvent) {
		if (
			active &&
			event.target instanceof Node &&
			!panel?.contains(event.target) &&
			!trigger?.contains(event.target)
		)
			close(false);
	}

	function keyboard(event: KeyboardEvent) {
		if (!active) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.target instanceof HTMLInputElement) return;
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const options = [
			...(panel?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
		];
		if (!options.length) return;
		event.preventDefault();
		const index = options.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? options.length - 1
					: (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
		options[next].focus();
	}

	function focusChanged(event: FocusEvent) {
		if (
			active &&
			event.target instanceof Node &&
			!panel?.contains(event.target) &&
			!trigger?.contains(event.target)
		)
			close(false);
	}

	function choosePlace(place: City) {
		onplace(place);
		close();
	}
</script>

<svelte:window
	onpointerdown={outside}
	onkeydown={keyboard}
	onfocusin={focusChanged}
	onresize={position}
/>

<section class="finder" bind:this={root} aria-label="Find an activity buddy">
	<h2>
		Find a buddy for a
		<button
			type="button"
			class="field"
			aria-label={`Distance: ${distance}km`}
			aria-expanded={active === 'distance'}
			aria-controls={active === 'distance' ? `${id}-picker` : undefined}
			onclick={(event) => toggle('distance', event.currentTarget)}>{distance}km</button
		>
		<button
			type="button"
			class="field"
			aria-label={`Activity: ${activity}`}
			aria-expanded={active === 'activity'}
			aria-controls={active === 'activity' ? `${id}-picker` : undefined}
			onclick={(event) => toggle('activity', event.currentTarget)}>{activity}</button
		>
		<button
			type="button"
			class="field location"
			aria-label={`Location: ${nearMe ? 'near me' : city.name}`}
			aria-expanded={active === 'location'}
			aria-controls={active === 'location' ? `${id}-picker` : undefined}
			onclick={(event) => toggle('location', event.currentTarget)}
			>{nearMe ? 'near me' : `in ${city.name}`}</button
		>
	</h2>
	{#if locating}<p class="locating" role="status">Finding your location…</p>{/if}

	{#if active}
		<div
			bind:this={panel}
			id={`${id}-picker`}
			class="popover"
			class:places={active === 'location'}
			role="group"
			aria-label={`Choose ${active}`}
			style:left={`${left}px`}
			style:top={`${top}px`}
		>
			<p class="label">
				{active === 'distance' ? 'Distance' : active === 'activity' ? 'Activity' : 'Location'}
			</p>
			{#if active === 'distance'}
				<div class="distances">
					{#each distances as option}
						<button
							type="button"
							aria-pressed={distance === option}
							onclick={() => {
								distance = option;
								close();
							}}>{option}km</button
						>
					{/each}
				</div>
			{:else if active === 'activity'}
				{#each activities as option}
					<button
						type="button"
						class="option"
						aria-pressed={activity === option}
						onclick={() => {
							activity = option;
							close();
						}}
					>
						<span>{option}</span><span aria-hidden="true">{activity === option ? '✓' : ''}</span>
					</button>
				{/each}
			{:else}
				<button
					type="button"
					class="option"
					aria-pressed={!nearMe &&
						city.name === defaultCity.name &&
						city.center[0] === defaultCity.center[0] &&
						city.center[1] === defaultCity.center[1]}
					onclick={() => choosePlace(defaultCity)}
				>
					<span>{defaultCity.name}</span>
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle
							cx="12"
							cy="10"
							r="2.5"
						/></svg
					>
				</button>
				<button
					type="button"
					class="option"
					aria-pressed={nearMe}
					disabled={locating}
					onclick={() => {
						onnearby();
						close();
					}}
				>
					<span>Near me</span>
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path
							d="M12 2v3m0 14v3M2 12h3m14 0h3"
						/></svg
					>
				</button>
				<LocationSearch proximity={city.center} onselect={choosePlace} />
			{/if}
		</div>
	{/if}
</section>

<style>
	.finder {
		position: relative;
		z-index: 2;
		display: grid;
		align-content: center;
		min-block-size: var(--control-height);
		border: 1px solid var(--color-border);
		border-radius: var(--control-radius);
		padding: 0.5rem 1rem;
		background: var(--color-surface);
		box-shadow: 0 0.25rem 1rem -0.5rem var(--color-shadow);
	}

	h2 {
		margin: 0;
		font-size: clamp(1.125rem, 1.8vw, 1.25rem);
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: -0.01em;
	}

	.field {
		border: 0;
		border-radius: 0.25rem;
		padding: 0 0.1em;
		color: var(--color-brand-ink);
		background: transparent;
		text-decoration: underline dotted;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.22em;
		cursor: pointer;
	}

	.field:hover,
	.field[aria-expanded='true'] {
		background: var(--color-canvas);
	}

	.location {
		max-inline-size: 100%;
		text-align: start;
		overflow-wrap: anywhere;
	}

	.locating {
		margin-block-start: 0.5rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.popover {
		position: absolute;
		inline-size: min(18rem, 100%);
		max-block-size: min(32rem, 65svh);
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		padding: 0.625rem;
		background: var(--color-surface);
		box-shadow: 0 1rem 3rem -0.75rem var(--color-shadow);
	}

	.places {
		inline-size: min(23rem, 100%);
	}

	.label {
		padding: 0.375rem 0.625rem 0.625rem;
		color: var(--color-muted);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.distances {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}

	.distances button,
	.option {
		min-block-size: 2.75rem;
		border: 0;
		border-radius: 0.625rem;
		padding: 0.625rem 0.75rem;
		color: var(--color-ink);
		background: transparent;
		cursor: pointer;
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		inline-size: 100%;
		text-align: start;
	}

	.option span:first-child::first-letter {
		text-transform: uppercase;
	}

	.option svg {
		flex: none;
		inline-size: 1.125rem;
		block-size: 1.125rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}

	button[aria-pressed='true'] {
		color: var(--color-brand-ink);
		background: var(--color-canvas);
	}

	.distances button:hover,
	.option:hover {
		background: var(--color-secondary);
	}

	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
</style>
