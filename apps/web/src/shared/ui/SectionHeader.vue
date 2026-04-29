<script setup>
const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
});
</script>

<template>
  <div class="flex items-end justify-between gap-4">
    <div class="min-w-0">
      <div class="dt-font-display truncate text-lg font-bold tracking-tight">
        {{ props.title }}
      </div>
      <div v-if="props.subtitle" class="mt-1 truncate text-sm text-muted">
        {{ props.subtitle }}
      </div>
    </div>
    <slot />
  </div>
</template>

