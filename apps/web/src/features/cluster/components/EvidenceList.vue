<script setup>
function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

const props = defineProps({
  items: { type: Array, default: () => [] },
});
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <a
      v-for="item in props.items"
      :key="item.id"
      :href="item.url"
      target="_blank"
      rel="noreferrer"
      class="group rounded-xl2 border border-white/10 bg-surface/70 p-4 shadow-bento backdrop-blur transition hover:border-white/20 hover:bg-surface2/70"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold leading-snug text-text">
            {{ item.title }}
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <el-tag type="info" effect="dark">{{ item.source }}</el-tag>
            <el-tag type="info" effect="dark">{{ item.label }}</el-tag>
            <el-tag type="info" effect="dark">分数 {{ item.score }}</el-tag>
            <el-tag type="info" effect="dark">{{ formatDate(item.publishedAt) }}</el-tag>
          </div>
        </div>
        <ArrowUpRight
          class="mt-0.5 h-5 w-5 shrink-0 opacity-0 transition group-hover:opacity-70"
        />
      </div>
      <div class="mt-2 text-xs text-muted">
        {{ item.url }}
      </div>
    </a>
  </div>
</template>
