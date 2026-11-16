<script lang="ts">
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { todayStr } from '$lib/format';

	/** Kalendarz miesięczny w arkuszu (zamiast systemowego input[type=date]). Daty jako YYYY-MM-DD. */
	interface Props {
		open: boolean;
		value: string | null;
		title?: string;
		onPick: (d: string) => void;
		/** pokazuje przycisk „Wyczyść” (np. powrót do szybkiego wyboru dni) */
		onClear?: () => void;
	}
	let { open = $bindable(), value, title = 'Wybierz datę', onPick, onClear }: Props = $props();

	const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
	const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
	const pad = (n: number) => String(n).padStart(2, '0');
	const iso = (y: number, m: number, d: number) => {
		let dt = new Date(y, m, d);
		return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
	};

	let today = $derived(todayStr());
	// widoczny miesiąc: [rok, miesiąc 0-11]
	let view = $state<[number, number]>([0, 0]);

	// przy każdym otwarciu pokaż miesiąc wybranej daty (albo bieżący)
	$effect(() => {
		if (!open) return;
		let [y, m] = (value ?? todayStr()).split('-').map(Number);
		view = [y, m - 1];
	});

	function shift(n: number) {
		let d = new Date(view[0], view[1] + n, 1);
		view = [d.getFullYear(), d.getMonth()];
	}

	// 6 tygodni od poniedziałku przed 1. dniem miesiąca
	let cells = $derived.by(() => {
		let [y, m] = view;
		let lead = (new Date(y, m, 1).getDay() + 6) % 7;
		return Array.from({ length: 42 }, (_, i) => {
			let d = iso(y, m, 1 - lead + i);
			return { d, day: Number(d.slice(8)), inMonth: Number(d.slice(5, 7)) === m + 1, weekend: i % 7 >= 5 };
		});
	});

	function pick(d: string) {
		onPick(d);
		open = false;
	}
</script>

<Sheet bind:open {title}>
	<div class="flex items-center justify-between pb-2">
		<button type="button" class="grid size-11 place-items-center rounded-full text-ink-2 active:bg-ink/6" aria-label="Poprzedni miesiąc" onclick={() => shift(-1)}>
			<ChevronLeft class="size-5" />
		</button>
		<p class="text-base font-extrabold" aria-live="polite">{MONTHS[view[1]]} {view[0]}</p>
		<button type="button" class="grid size-11 place-items-center rounded-full text-ink-2 active:bg-ink/6" aria-label="Następny miesiąc" onclick={() => shift(1)}>
			<ChevronRight class="size-5" />
		</button>
	</div>
	<div class="grid grid-cols-7 gap-1 text-center" role="grid">
		{#each WEEKDAYS as w, i (w)}
			<span class="pb-1 text-[11px] font-bold uppercase {i >= 5 ? 'text-bad/70' : 'text-muted'}">{w}</span>
		{/each}
		{#each cells as c (c.d)}
			{@const sel = c.d === value}
			{@const isToday = c.d === today}
			<button
				type="button"
				aria-pressed={sel}
				aria-label={c.d}
				class="relative grid h-11 place-items-center rounded-xl font-mono text-[15px] font-bold
					{sel ? 'bg-task text-task-ink' : isToday ? 'border-2 border-ink' : 'active:bg-ink/6'}
					{!sel && !c.inMonth ? 'text-muted/50' : !sel && c.weekend ? 'text-bad/80' : ''}"
				onclick={() => pick(c.d)}
			>
				{c.day}
			</button>
		{/each}
	</div>
	{#snippet footer()}
		<div class="flex gap-2">
			{#if onClear && value}
				<Button variant="secondary" size="lg" class="flex-1" onclick={() => { onClear(); open = false; }}>Wyczyść</Button>
			{/if}
			<Button variant="secondary" size="lg" class="flex-1" onclick={() => pick(today)}>Dziś</Button>
		</div>
	{/snippet}
</Sheet>
