<script lang="ts">
	let { value, max, label }: { value: number; max: number; label?: string } = $props();
	let pct = $derived(max ? Math.min(100, (value / max) * 100) : 0);
</script>

<div class="flex items-center gap-3">
	<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
		<div class="h-full rounded-full {value >= max && max > 0 ? 'bg-ok' : 'bg-task'}" style:width="{pct}%"></div>
	</div>
	<span class="text-xs font-bold whitespace-nowrap tabular-nums">{label ?? `${value}/${max}`}</span>
</div>
