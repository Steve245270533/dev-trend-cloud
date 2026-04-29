<script setup>
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiGet } from "@/shared/api/client.js";
import { useAsyncState } from "@/shared/composables/useAsyncState.js";
import EmptyState from "@/shared/ui/EmptyState.vue";
import SectionHeader from "@/shared/ui/SectionHeader.vue";
import StatCard from "@/shared/ui/StatCard.vue";
import SignalFilters from "./components/SignalFilters.vue";
import SignalList from "./components/SignalList.vue";

const route = useRoute();
const router = useRouter();

const topic = computed({
  get: () => String(route.query.topic ?? ""),
  set: (value) => router.replace({ query: { ...route.query, topic: value || undefined } }),
});

const entity = computed({
  get: () => String(route.query.entity ?? ""),
  set: (value) => router.replace({ query: { ...route.query, entity: value || undefined } }),
});

const limit = computed({
  get: () => {
    const raw = route.query.limit;
    const asNumber = Number(raw ?? 20);
    return Number.isFinite(asNumber) ? asNumber : 20;
  },
  set: (value) =>
    router.replace({
      query: { ...route.query, limit: value ? String(value) : undefined },
    }),
});

const state = useAsyncState(async () => {
  return apiGet("/signals/question-pressure", {
    topic: topic.value || undefined,
    entity: entity.value || undefined,
    limit: limit.value || undefined,
  });
});

const meta = computed(() => state.data.value?.meta ?? null);
const signals = computed(() => state.data.value?.data ?? []);

const sourceStatus = computed(() => meta.value?.sourceStatus ?? {});
const sourceTotals = computed(() => {
  const entries = Object.values(sourceStatus.value);
  const total = entries.length;
  const healthy = entries.filter((s) => s.status === "healthy").length;
  const degraded = entries.filter((s) => s.status === "degraded").length;
  const failed = entries.filter((s) => s.status === "failed").length;
  return { total, healthy, degraded, failed };
});

const maxPressure = computed(() => {
  const values = signals.value.map((s) => Number(s.pressureScore ?? 0));
  return values.length ? Math.max(...values) : 0;
});

function refresh() {
  state.run();
}

function onSelect(signal) {
  router.push({ name: "cluster-detail", params: { clusterId: signal.clusterId } });
}

watch(
  () => [topic.value, entity.value, limit.value],
  () => {
    refresh();
  },
  { deep: false },
);
</script>

<template>
  <div>
    <SectionHeader
      title="问题压力"
      subtitle="按压力分数排序（只读）"
    >
      <el-button :loading="state.loading.value" plain @click="refresh">
        <Refresh class="mr-1 h-4 w-4" />
        刷新
      </el-button>
    </SectionHeader>

    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="信号条数" :value="signals.length" hint="当前返回条数" />
      <StatCard
        label="新鲜度（分钟）"
        :value="meta?.freshnessMinutes ?? '—'"
        :tone="(meta?.freshnessMinutes ?? 0) <= 30 ? 'good' : 'warn'"
      />
      <StatCard
        label="最高压力"
        :value="maxPressure.toFixed(1)"
        hint="当前列表中的最大 pressureScore"
      />
      <StatCard
        label="数据源"
        :value="`${sourceTotals.healthy}/${sourceTotals.total}`"
        :hint="`健康/总数 · 降级 ${sourceTotals.degraded} · 失败 ${sourceTotals.failed}`"
        :tone="sourceTotals.failed > 0 ? 'bad' : sourceTotals.degraded > 0 ? 'warn' : 'good'"
      />
    </div>

    <div class="mt-4">
      <SignalFilters
        v-model:topic="topic"
        v-model:entity="entity"
        v-model:limit="limit"
        :loading="state.loading.value"
        @apply="refresh"
      />
    </div>

    <div v-if="state.error.value" class="mt-4">
      <EmptyState
        title="加载失败"
        :description="state.error.value.message"
        action-label="重试"
        @action="refresh"
      />
    </div>

    <div v-else-if="state.loading.value" class="mt-4">
      <div
        class="animate-pulse rounded-xl2 border border-white/10 bg-surface/70 p-6 shadow-bento backdrop-blur"
      >
        <div class="h-4 w-48 rounded bg-white/10" />
        <div class="mt-4 h-3 w-full rounded bg-white/8" />
        <div class="mt-2 h-3 w-5/6 rounded bg-white/6" />
        <div class="mt-2 h-3 w-4/6 rounded bg-white/6" />
      </div>
    </div>

    <div v-else-if="signals.length === 0" class="mt-4">
      <EmptyState
        title="暂无信号"
        description="数据库中还没有可展示的 question pressure 结果。请先跑 seed 或 worker pipeline。"
        action-label="刷新"
        @action="refresh"
      />
    </div>

    <SignalList v-else :signals="signals" @select="onSelect" />
  </div>
</template>
