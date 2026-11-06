<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import { addDays, fmtDayLong, todayStr } from '$lib/format';

	/** Wybór dnia: szybkie chipy (wczoraj … pojutrze) + kalendarz */
	let { value, onChange }: { value: string; onChange: (d: string) => void } = $props();

	let days = $derived([-1, 0, 1, 2].map((o) => addDays(todayStr(), o)));
	let custom = $derived(!days.includes(value));
</script>

<div class="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
	{#each days as d (d)}
		<button type="button" class="h-9 shrink-0 rounded-full border px-3 text-sm font-bold {d === value ? 'border-task bg-task text-task-ink' : 'border-line-strong bg-surface text-ink-2'}" onclick={() => onChange(d)}>
			{fmtDayLong(d)}
		</button>
	{/each}
	<label class="relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold {custom ? 'border-task bg-task text-task-ink' : 'border-line-strong bg-surface text-ink-2'}">
		<CalendarDays class="size-4" />{custom ? fmtDayLong(value) : 'Inny dzień'}
		<input type="date" class="absolute inset-0 opacity-0" {value} onchange={(e) => e.currentTarget.value && onChange(e.currentTarget.value)} />
	</label>
</div>
