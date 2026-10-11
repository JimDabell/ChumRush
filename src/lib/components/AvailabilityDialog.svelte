<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { DAYS, defaultAvailability, type Availability } from '#lib/availability.ts';
	import { getAvailability, saveAvailability } from '#lib/availability.remote.ts';
	import TimeRange from './TimeRange.svelte';

	let {
		open,
		athlete,
		onclose
	}: {
		open: boolean;
		athlete: { firstName: string; profile?: string };
		onclose: () => void;
	} = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement | undefined = $state();
	let draft = $state<Availability>(defaultAvailability('UTC'));
	let loading = $state(false);
	let ready = $state(false);
	let saving = $state(false);
	let loadFailed = $state(false);
	let message = $state('');
	let photoFailed = $state(false);
	let revision = 0;
	let pendingSave: Promise<void> | undefined;

	onDestroy(() => {
		revision += 1;
	});

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			untrack(() => void load());
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	async function load() {
		const current = ++revision;
		loading = true;
		ready = false;
		loadFailed = false;
		message = '';
		try {
			// Reopening during a save must not load the previous time slots.
			await pendingSave?.catch(() => {});
			const query = getAvailability();
			if (query.ready) await query.refresh();
			const stored = await query;
			if (current !== revision) return;
			const value = stored ?? defaultAvailability(Intl.DateTimeFormat().resolvedOptions().timeZone);
			draft = {
				timeZone: value.timeZone,
				sharingConsent: value.sharingConsent,
				days: value.days.map((day) => ({ ...day }))
			};
			ready = true;
		} catch {
			if (current !== revision) return;
			loadFailed = true;
			message = 'We couldn’t load your availability. Please try again, or log in again.';
		} finally {
			if (current === revision) loading = false;
		}
	}

	function closed() {
		revision += 1;
		onclose();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready || saving) return;
		message = '';
		if (draft.sharingConsent && !draft.days.some((day) => day.enabled)) {
			message = 'Select a day to make your availability public.';
			return;
		}
		const current = revision;
		saving = true;
		try {
			pendingSave = saveAvailability($state.snapshot(draft));
			await pendingSave;
			if (current === revision) dialog?.close();
		} catch {
			if (current === revision) message = 'We couldn’t save your availability. Please try again.';
		} finally {
			pendingSave = undefined;
			saving = false;
		}
	}
</script>

<dialog bind:this={dialog} aria-labelledby={`${id}-title`} onclose={closed}>
	<div class="content">
		<header>
			<h2 id={`${id}-title`}>Set your availability</h2>
			<button
				class="close"
				type="button"
				aria-label="Close availability"
				onclick={() => dialog?.close()}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
			</button>
		</header>

		<section class="profile" aria-label="Profile and visibility">
			<div class="identity">
				<div class="avatar">
					{#if athlete.profile && !photoFailed}
						<img
							src={athlete.profile}
							alt={`${athlete.firstName || 'Your'} Strava profile`}
							referrerpolicy="no-referrer"
							onerror={() => (photoFailed = true)}
						/>
					{:else}
						<span aria-label="No profile photo"
							>{athlete.firstName.slice(0, 1).toUpperCase() || '?'}</span
						>
					{/if}
				</div>
				<p class="name">{athlete.firstName || 'Runner'}</p>
			</div>
			<fieldset class="visibility" disabled={!ready || saving}>
				<legend class="visually-hidden">Profile and availability visibility</legend>
				<label class="visibility-option">
					<input
						class="visually-hidden"
						type="radio"
						name={`${id}-visibility`}
						value={false}
						bind:group={draft.sharingConsent}
					/>
					<span>Hidden</span>
				</label>
				<label class="visibility-option">
					<input
						class="visually-hidden"
						type="radio"
						name={`${id}-visibility`}
						value={true}
						bind:group={draft.sharingConsent}
					/>
					<span>Public</span>
				</label>
			</fieldset>
		</section>

		{#if loading}<p class="hint" role="status">Loading…</p>{/if}

		<form onsubmit={submit}>
			<fieldset disabled={!ready || saving} aria-busy={loading || saving}>
				<legend class="visually-hidden">Weekly availability</legend>
				{#each draft.days as day, index (day.day)}
					<div class="day-row">
						<label class="day-label">
							<input
								type="checkbox"
								bind:checked={day.enabled}
								aria-label={`Available on ${DAYS[index].label}`}
							/>
							<span>{DAYS[index].shortLabel}</span>
						</label>
						<div class="time-controls">
							<TimeRange
								start={day.start}
								end={day.end}
								label={DAYS[index].label}
								disabled={!ready || saving}
								onrange={(start, end) => {
									day.enabled = true;
									day.start = start;
									day.end = end;
								}}
							/>
						</div>
					</div>
				{/each}
			</fieldset>

			{#if message}
				<p class="message" role="alert">{message}</p>
			{/if}
			{#if loadFailed}
				<div class="recovery">
					<button class="secondary" type="button" onclick={load}>Try again</button>
					<a href={`${resolve('/auth/strava')}?next=availability`} data-sveltekit-reload
						>Log in again</a
					>
				</div>
			{/if}

			<footer>
				<button class="secondary" type="button" disabled={saving} onclick={() => dialog?.close()}
					>Cancel</button
				>
				<button class="save" type="submit" disabled={!ready || saving}>
					{saving ? 'Saving…' : 'Save availability'}
				</button>
			</footer>
		</form>
	</div>
</dialog>

<style>
	dialog {
		inline-size: 36rem;
		max-inline-size: calc(100% - 2rem);
		max-block-size: calc(100svh - 2rem);
		margin: auto;
		border: 1px solid var(--color-border);
		border-radius: 1.5rem;
		padding: 0;
		color: var(--color-ink);
		background: var(--color-surface);
		box-shadow: 0 1rem 4rem var(--color-shadow);
	}

	dialog::backdrop {
		background: #2f34436b;
	}

	:global(body:has(dialog[open])) {
		overflow: hidden;
	}

	.content {
		padding: 1rem;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-block-end: 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.close {
		display: grid;
		flex: none;
		place-items: center;
		inline-size: 2.75rem;
		block-size: 2.75rem;
		border: 0;
		border-radius: 50%;
		padding: 0.625rem;
		color: var(--color-ink);
		background: var(--color-canvas);
		cursor: pointer;
	}

	.close svg {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}

	.profile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-block-end: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		padding: 0.75rem;
		background: var(--color-canvas);
	}

	.identity {
		display: flex;
		flex: 1 1 8rem;
		align-items: center;
		gap: 0.75rem;
		min-inline-size: 0;
	}

	.visibility {
		display: inline-flex;
		flex: none;
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 0.125rem;
		background: var(--color-surface);
	}

	.visibility-option {
		display: grid;
		place-items: center;
		min-block-size: 2.5rem;
		border-radius: 0.625rem;
		padding-inline: 0.75rem;
		color: var(--color-muted);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.visibility-option:has(input:checked) {
		color: var(--color-surface);
		background: var(--color-brand-ink);
	}

	.visibility-option:has(input:focus-visible) {
		outline: 3px solid var(--color-ink);
		outline-offset: 2px;
	}

	.visibility:disabled {
		opacity: 0.55;
	}

	.avatar {
		display: grid;
		flex: none;
		place-items: center;
		inline-size: 3rem;
		block-size: 3rem;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		color: var(--color-brand-ink);
		background: var(--color-canvas);
		font-size: 1.5rem;
	}

	.avatar img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	.name {
		min-inline-size: 0;
		font-family: var(--rounded);
		font-size: 1.125rem;
		font-weight: 500;
		overflow-wrap: anywhere;
	}

	.hint {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	fieldset {
		min-inline-size: 0;
		margin: 0;
		border: 0;
		padding: 0;
	}

	.visually-hidden {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.day-row {
		display: grid;
		grid-template-columns: 3.75rem minmax(0, 1fr);
		align-items: center;
		gap: 0.875rem;
		border-block-start: 1px solid var(--color-border);
		padding-block: 0.125rem;
	}

	.day-label {
		display: inline-flex;
		align-self: end;
		align-items: center;
		gap: 0.375rem;
		min-block-size: 2.75rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	input[type='checkbox'] {
		flex: none;
		inline-size: 1.125rem;
		block-size: 1.125rem;
		margin: 0;
		accent-color: var(--color-brand-ink);
	}

	.message {
		margin-block-start: 1rem;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
	}

	.recovery {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-block-start: 0.75rem;
	}

	a {
		color: var(--color-brand-ink);
	}

	footer {
		position: sticky;
		inset-block-end: -1rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-block-start: 0.75rem;
		border-block-start: 1px solid var(--color-border);
		padding-block: 0.75rem 0;
		background: var(--color-surface);
	}

	.secondary,
	.save {
		min-block-size: 3rem;
		border: 1px solid var(--color-border);
		border-radius: var(--control-radius);
		padding: 0.625rem 0.875rem;
		cursor: pointer;
	}

	.secondary {
		color: var(--color-brand-ink);
		background: var(--color-surface);
	}

	.save {
		border-color: var(--color-brand-ink);
		color: var(--color-surface);
		background: var(--color-brand-ink);
	}

	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	@media (max-width: 23rem) {
		h2 {
			font-size: 1.25rem;
		}
	}
</style>
