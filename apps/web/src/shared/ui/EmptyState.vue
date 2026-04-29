<script setup>
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  actionLabel: { type: String, default: "" },
});

const emit = defineEmits(["action"]);
</script>

<template>
  <div
    class="rounded-xl2 border border-white/10 bg-surface/70 p-6 shadow-bento backdrop-blur"
  >
    <div class="dt-font-display text-base font-bold">{{ props.title }}</div>
    <div v-if="props.description" class="mt-1 text-sm text-muted">
      {{ props.description }}
    </div>
    <div v-if="props.actionLabel" class="mt-4">
      <el-button type="primary" @click="emit('action')">
        {{ props.actionLabel }}
      </el-button>
    </div>
  </div>
</template>

