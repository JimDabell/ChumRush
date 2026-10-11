<script lang="ts">
	import { MINUTES_PER_DAY, TIME_STEP, formatTime } from '#lib/availability.ts';

	let {
		start,
		end,
		label,
		disabled = false,
		onrange
	}: {
		start: number;
		end: number;
		label: string;
		disabled?: boolean;
		onrange: (start: number, end: number) => void;
	} = $props();

	type Handle = 'start' | 'end';
	const handles: Handle[] = ['start', 'end'];
	const snap = (value: number) => Math.round(value / TIME_STEP) * TIME_STEP;
	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
	let lower = $derived(
		clamp(snap(Number.isFinite(start) ? start : 0), 0, MINUTES_PER_DAY - TIME_STEP)
	);
	let upper = $derived(
		clamp(snap(Number.isFinite(end) ? end : MINUTES_PER_DAY), lower + TIME_STEP, MINUTES_PER_DAY)
	);
	let midpoint = $derived(((lower + upper) / 2 / MINUTES_PER_DAY) * 100);
	let track: HTMLDivElement;
	let focused = $state<Handle | null>(null);
	let drag: {
		input: HTMLInputElement;
		id: number;
		handle: Handle;
		x: number;
		value: number;
		width: number;
	} | null = null;

	function change(handle: Handle, value: number, input: HTMLInputElement) {
		// Restore the DOM even if clamping produces unchanged props or the parent declines the edit.
		input.value = String(handle === 'start' ? lower : upper);
		if (disabled || !Number.isFinite(value)) return;
		const next =
			handle === 'start'
				? clamp(snap(value), 0, upper - TIME_STEP)
				: clamp(snap(value), lower + TIME_STEP, MINUTES_PER_DAY);
		if (next === (handle === 'start' ? lower : upper)) return;
		onrange(handle === 'start' ? next : lower, handle === 'end' ? next : upper);
	}

	function begin(event: PointerEvent, handle: Handle) {
		if (disabled || drag || !event.isPrimary || event.button !== 0) return;
		const width = track.getBoundingClientRect().width;
		if (width <= 0) return;
		event.preventDefault();
		const input = event.currentTarget as HTMLInputElement;
		input.focus({ preventScroll: true });
		input.setPointerCapture(event.pointerId);
		onrange(lower, upper);
		drag = {
			input,
			id: event.pointerId,
			handle,
			x: event.clientX,
			value: handle === 'start' ? lower : upper,
			width
		};
	}

	function move(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		if (disabled) return cancelDrag();
		event.preventDefault();
		// Measure displacement from the grab point, not the thumb centre.
		change(
			drag.handle,
			drag.value + ((event.clientX - drag.x) / drag.width) * MINUTES_PER_DAY,
			drag.input
		);
	}

	function cancelDrag() {
		const previous = drag;
		drag = null;
		if (previous?.input.hasPointerCapture(previous.id)) {
			previous.input.releasePointerCapture(previous.id);
		}
	}

	function finish(event: PointerEvent) {
		if (event.pointerId === drag?.id) cancelDrag();
	}

	function keydown(event: KeyboardEvent, handle: Handle) {
		const value = handle === 'start' ? lower : upper;
		let next: number;
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowDown':
				next = value - TIME_STEP;
				break;
			case 'ArrowRight':
			case 'ArrowUp':
				next = value + TIME_STEP;
				break;
			case 'Home':
				next = handle === 'start' ? 0 : lower + TIME_STEP;
				break;
			case 'End':
				next = handle === 'start' ? upper - TIME_STEP : MINUTES_PER_DAY;
				break;
			default:
				return;
		}
		event.preventDefault();
		change(handle, next, event.currentTarget as HTMLInputElement);
	}

	$effect(() => {
		if (disabled) cancelDrag();
		return cancelDrag;
	});
</script>

<div class="time-range" class:disabled>
	<div class="track" bind:this={track}>
		<div
			class="selection"
			style:left="{(lower / MINUTES_PER_DAY) * 100}%"
			style:right="{100 - (upper / MINUTES_PER_DAY) * 100}%"
		></div>
		{#each handles as handle}
			<span
				class="hour"
				class:start={handle === 'start'}
				style:left="{((handle === 'start' ? lower : upper) / MINUTES_PER_DAY) * 100}%"
				aria-hidden="true">{formatTime(handle === 'start' ? lower : upper)}</span
			>
			<!-- Split only the hit areas, not the visible circles, at the midpoint.
			     Neither thumb can cover the other's pointer target when adjacent. -->
			<div
				class="hit-area"
				style:clip-path={handle === 'start'
					? `polygon(-22px 0, ${midpoint}% 0, ${midpoint}% 100%, -22px 100%)`
					: `polygon(${midpoint}% 0, calc(100% + 22px) 0, calc(100% + 22px) 100%, ${midpoint}% 100%)`}
			>
				<input
					type="range"
					min={handle === 'start' ? 0 : lower + TIME_STEP}
					max={handle === 'start' ? upper - TIME_STEP : MINUTES_PER_DAY}
					step={TIME_STEP}
					value={handle === 'start' ? lower : upper}
					{disabled}
					aria-label={`${label} ${handle} time`}
					aria-valuetext={formatTime(handle === 'start' ? lower : upper)}
					style:left="{((handle === 'start' ? lower : upper) / MINUTES_PER_DAY) * 100}%"
					oninput={(event) =>
						change(handle, event.currentTarget.valueAsNumber, event.currentTarget)}
					onkeydown={(event) => keydown(event, handle)}
					onpointerdown={(event) => begin(event, handle)}
					onpointermove={move}
					onpointerup={finish}
					onpointercancel={finish}
					onlostpointercapture={finish}
					onfocus={() => (focused = handle)}
					onblur={() => {
						focused = null;
						cancelDrag();
					}}
				/>
			</div>
			<span
				class="thumb"
				class:focused={focused === handle && !disabled}
				style:left="{((handle === 'start' ? lower : upper) / MINUTES_PER_DAY) * 100}%"
				aria-hidden="true"
			></span>
		{/each}
	</div>
</div>

<style>
	.time-range {
		min-width: 0;
		width: 100%;
		padding: 0 2.25rem;
		direction: ltr;
	}

	.track {
		position: relative;
		height: 52px;
	}

	.track::before,
	.selection {
		position: absolute;
		top: 27px;
		height: 6px;
		border-radius: 3px;
	}

	.track::before {
		content: '';
		left: 0;
		right: 0;
		background: var(--color-border);
	}

	.selection {
		background: var(--color-accent);
	}

	.hour {
		position: absolute;
		top: 0;
		padding-inline-start: 0.25rem;
		color: var(--color-brand-ink);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		white-space: nowrap;
		pointer-events: none;
	}

	.hour.start {
		padding-inline: 0 0.25rem;
		transform: translateX(-100%);
	}

	.hit-area {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	input {
		position: absolute;
		top: 8px;
		width: 44px;
		height: 44px;
		margin: 0;
		transform: translateX(-50%);
		opacity: 0;
		pointer-events: auto;
		touch-action: none;
		cursor: grab;
	}

	input:active {
		cursor: grabbing;
	}

	.thumb {
		position: absolute;
		top: 18px;
		width: 24px;
		height: 24px;
		transform: translateX(-50%);
		border: 2px solid var(--color-brand-ink);
		border-radius: 50%;
		background: var(--color-surface);
		pointer-events: none;
	}

	.thumb.focused {
		z-index: 1;
		outline: 3px solid var(--color-brand-ink);
		outline-offset: 3px;
		background: var(--color-secondary);
	}

	.disabled {
		opacity: 0.5;
	}

	input:disabled {
		pointer-events: none;
	}

	@media (forced-colors: active) {
		.track::before {
			background: GrayText;
		}
		.selection {
			background: Highlight;
		}
		.thumb {
			border-color: ButtonText;
			background: Canvas;
		}
		.thumb.focused {
			outline-color: Highlight;
		}
	}
</style>
