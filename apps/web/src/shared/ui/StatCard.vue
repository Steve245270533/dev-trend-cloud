<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: "" },
  tone: { type: String, default: "default" },
});

const toneClass = computed(() => {
  if (props.tone === "good") {
    return "border-good/25 bg-good/5";
  }
  if (props.tone === "warn") {
    return "border-warn/25 bg-warn/5";
  }
  if (props.tone === "bad") {
    return "border-bad/25 bg-bad/5";
  }
  return "border-white/10 bg-white/0";
});
</script>

<template>
  <div
    class="rounded-xl2 border bg-surface/70 p-4 shadow-bento backdrop-blur"
    :class="toneClass"
  >
    <div class="text-xs font-semibold uppercase tracking-wide text-muted">
      {{ props.label }}
    </div>
    <div class="mt-2 dt-font-display text-2xl font-bold tracking-tight">
      {{ props.value }}
    </div>
    <div v-if="props.hint" class="mt-1 text-xs text-muted">
      {{ props.hint }}
    </div>
  </div>
</template>
