<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AvailabilityDialog from '#lib/components/AvailabilityDialog.svelte';
	import BuddyFinder from '#lib/components/BuddyFinder.svelte';
	import CityMap from '#lib/components/CityMap.svelte';
	import type { City } from '#lib/maps/city.ts';
	import type { PageProps } from './$types';

	const authMessages = {
		setup: 'Strava sign-in needs valid OAuth settings and an AUTH_SECRET in .env.',
		state: 'Your sign-in link expired or was invalid. Please try logging in again.',
		denied: 'Strava sign-in was cancelled. You can try again whenever you’re ready.',
		callback: 'Strava did not return the required sign-in details. Please try again.',
		exchange: 'We could not complete Strava sign-in. Please try again.',
		profile: 'Your Strava profile could not be saved. Please try logging in again.'
	};

	let { data }: PageProps = $props();
	let city = $state<City>(untrack(() => data.initialCity));
	let nearMe = $state(false);
	let locating = $state(false);
	let previous: { city: City; nearMe: boolean } | undefined;
	let map: { locate: () => void } | undefined = $state();
	let availabilityOpen = $state(false);
	let availabilityTrigger: HTMLButtonElement | undefined = $state();

	onMount(() => {
		if (data.athlete && data.openAvailability) {
			availabilityOpen = true;
			const url = new URL(window.location.href);
			url.searchParams.delete('availability');
			replaceState(url, page.state);
		}
	});

	function choosePlace(place: City) {
		city = { ...place };
		nearMe = false;
		locating = false;
		previous = undefined;
	}

	function startLocating() {
		if (!locating) previous = { city, nearMe };
		nearMe = true;
		locating = true;
	}

	function located(place: City) {
		city = place;
		nearMe = true;
		locating = false;
		previous = undefined;
	}

	function locationFailed() {
		if (previous) {
			city = previous.city;
			nearMe = previous.nearMe;
		}
		locating = false;
		previous = undefined;
	}
</script>

<svelte:head>
	<title>ChumRush — Find an activity buddy</title>
	<meta name="description" content="Find a buddy for a run, trail run, or bike ride near you." />
</svelte:head>

<main>
	<header>
		<h1>Chum<span>Rush</span></h1>
		{#if data.athlete}
			<div class="account">
				<span>Hi, {data.athlete.firstName || 'runner'}</span>
				<form method="POST" action={resolve('/auth/logout')}>
					<button class="logout" type="submit">Log out</button>
				</form>
			</div>
		{:else}
			<a class="strava-login" href={resolve('/auth/strava')} data-sveltekit-reload>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="m10.2 0 6.8 13.8h-4.6l-2.2-4.4-2.1 4.4H3.5L10.2 0Zm5.2 17.9 2.1-4.1h3.1L15.4 24l-5.2-10.2h3.1l2.1 4.1Z"
					/>
				</svg>
				Log in with Strava
			</a>
		{/if}
	</header>

	{#if data.authError}
		<p class="auth-error" role="alert">{authMessages[data.authError]}</p>
	{/if}

	<BuddyFinder
		defaultCity={data.initialCity}
		{city}
		{nearMe}
		{locating}
		onplace={choosePlace}
		onnearby={() => map?.locate()}
	/>

	<section class="availability-prompt" aria-label="Your running availability">
		<p>
			Up for letting people join you on your run?
			{#if data.athlete}
				<button
					bind:this={availabilityTrigger}
					type="button"
					class="availability-link"
					aria-haspopup="dialog"
					onclick={() => (availabilityOpen = true)}>Set your availability</button
				>
			{:else}
				<a
					class="availability-link"
					href={`${resolve('/auth/strava')}?next=availability`}
					data-sveltekit-reload>Set your availability</a
				>
			{/if}
		</p>
		<p class="privacy-note">No information will be shared without your permission.</p>
	</section>

	<CityMap
		bind:this={map}
		{city}
		{nearMe}
		onlocating={startLocating}
		onlocate={located}
		onlocationerror={locationFailed}
	/>
</main>

{#if data.athlete}
	<AvailabilityDialog
		open={availabilityOpen}
		athlete={data.athlete}
		onclose={() => {
			availabilityOpen = false;
			availabilityTrigger?.focus();
		}}
	/>
{/if}

<style>
	main {
		--page-gap: 1rem;

		display: grid;
		gap: var(--page-gap);
		max-inline-size: 72rem;
		margin-inline: auto;
		padding-block: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-bottom));
		padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--page-gap);
	}

	h1 {
		font-size: clamp(3rem, 8vw, 5rem);
		font-weight: 300;
		line-height: 1.1;
		letter-spacing: -0.04em;
	}

	h1 span {
		color: var(--color-brand-ink);
	}

	.strava-login {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		inline-size: 100%;
		min-block-size: var(--control-height);
		border: 1px solid var(--color-border);
		border-radius: var(--control-radius);
		padding: 0.5rem 1rem;
		color: var(--color-ink);
		background: var(--color-surface);
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.5;
		text-decoration: none;
		box-shadow: 0 0.25rem 1rem -0.5rem var(--color-shadow);
	}

	.strava-login:hover {
		border-color: var(--color-brand-ink);
	}

	.strava-login svg {
		inline-size: 1.5rem;
		block-size: 1.5rem;
		fill: #fc4c02;
	}

	.account {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--page-gap);
		inline-size: 100%;
	}

	.logout {
		min-block-size: var(--control-height);
		border: 1px solid var(--color-border);
		border-radius: var(--control-radius);
		padding: 0.5rem 1rem;
		color: var(--color-brand-ink);
		background: var(--color-surface);
		cursor: pointer;
	}

	@media (max-width: 23rem) {
		main {
			--control-height: 4.5rem;
		}
	}

	@media (min-width: 48rem) {
		main {
			--page-gap: 1.5rem;

			padding-block: max(2rem, env(safe-area-inset-top)) max(2rem, env(safe-area-inset-bottom));
			padding-inline: max(1.5rem, env(safe-area-inset-left)) max(1.5rem, env(safe-area-inset-right));
		}

		.strava-login,
		.account {
			inline-size: auto;
		}
	}

	.availability-prompt {
		border: 1px solid var(--color-border);
		border-radius: var(--control-radius);
		padding: 0.875rem 1rem;
		background: var(--color-surface);
		box-shadow: 0 0.25rem 1rem -0.5rem var(--color-shadow);
	}

	.availability-link {
		border: 0;
		padding: 0;
		color: var(--color-brand-ink);
		background: transparent;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.privacy-note {
		margin-block-start: 0.375rem;
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.auth-error {
		border-inline-start: 3px solid var(--color-brand-ink);
		border-radius: 0.25rem 0.75rem 0.75rem 0.25rem;
		padding: 0.875rem 1rem;
		background: var(--color-surface);
		font-size: 0.9375rem;
	}
</style>
