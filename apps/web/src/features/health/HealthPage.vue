<script setup>
import { computed, onMounted } from "vue";
import { apiGet } from "@/shared/api/client.js";
import { useAsyncState } from "@/shared/composables/useAsyncState.js";
import EmptyState from "@/shared/ui/EmptyState.vue";
import SectionHeader from "@/shared/ui/SectionHeader.vue";
import StatCard from "@/shared/ui/StatCard.vue";

const healthState = useAsyncState(() => apiGet("/healthz"), { immediate: false });
const readyState = useAsyncState(() => apiGet("/readyz"), { immediate: false });
const statusState = useAsyncState(
  () => apiGet("/signals/question-pressure", { limit: 1 }),
  { immediate: false },
);

const sourceStatus = computed(() => statusState.data.value?.meta?.sourceStatus ?? {});
const generatedAt = computed(() => statusState.data.value?.meta?.generatedAt ?? null);
const freshnessMinutes = computed(() => statusState.data.value?.meta?.freshnessMinutes ?? null);

const totals = computed(() => {
  const values = Object.values(sourceStatus.value);
  const total = values.length;
  const healthy = values.filter((s) => s.status === "healthy").length;
  const degraded = values.filter((s) => s.status === "degraded").length;
  const failed = values.filter((s) => s.status === "failed").length;
  return { total, healthy, degraded, failed };
});

function refresh() {
  healthState.run();
  readyState.run();
  statusState.run();
}

onMounted(() => {
  refresh();
});

function toneByStatus(status) {
  if (status === "healthy" || status === "ok" || status === "ready") {
    return "success";
  }
  if (status === "degraded" || status === "not-ready") {
    return "warning";
  }
  return "danger";
}
</script>

<template>
  <div>
    <SectionHeader title="健康状态" subtitle="API 与数据源运行情况">
      <el-button :loading="healthState.loading.value" plain @click="refresh">
        <Refresh class="mr-1 h-4 w-4" />
        刷新
      </el-button>
    </SectionHeader>

    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="/healthz"
        :value="healthState.data.value?.data?.status ?? '—'"
        :tone="
          (healthState.data.value?.data?.status ?? '') === 'ok' ? 'good' : 'warn'
        "
      />
      <StatCard
        label="/readyz"
        :value="readyState.data.value?.data?.status ?? '—'"
        :tone="
          (readyState.data.value?.data?.status ?? '') === 'ready' ? 'good' : 'warn'
        "
      />
      <StatCard
        label="数据源"
        :value="`${totals.healthy}/${totals.total}`"
        :hint="`降级 ${totals.degraded} · 失败 ${totals.failed}`"
        :tone="totals.failed > 0 ? 'bad' : totals.degraded > 0 ? 'warn' : 'good'"
      />
      <StatCard
        label="新鲜度（分钟）"
        :value="freshnessMinutes ?? '—'"
        :hint="generatedAt ? `生成时间 ${generatedAt}` : ''"
        :tone="(freshnessMinutes ?? 0) <= 30 ? 'good' : 'warn'"
      />
    </div>

    <div v-if="healthState.error.value || readyState.error.value || statusState.error.value" class="mt-4">
      <EmptyState
        title="部分状态加载失败"
        :description="
          [
            healthState.error.value?.message,
            readyState.error.value?.message,
            statusState.error.value?.message,
          ]
            .filter(Boolean)
            .join(' · ')
        "
        action-label="重试"
        @action="refresh"
      />
    </div>

    <div
      v-else
      class="mt-4 rounded-xl2 border border-white/10 bg-surface/70 p-4 shadow-bento backdrop-blur"
    >
      <div class="mb-3 text-sm font-semibold text-muted">数据源状态</div>
      <div class="grid grid-cols-1 gap-2">
        <div
          v-for="(status, key) in sourceStatus"
          :key="key"
          class="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
        >
          <div class="dt-mono text-xs text-text">{{ key }}</div>
          <div class="flex items-center gap-2">
            <el-tag :type="toneByStatus(status.status)" effect="dark">
              {{ status.status }}
            </el-tag>
            <div class="dt-mono text-xs text-muted">
              {{ status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString() : "—" }}
            </div>
          </div>
        </div>
        <div v-if="Object.keys(sourceStatus).length === 0" class="text-sm text-muted">
          — 暂无 source status
        </div>
      </div>
    </div>
  </div>
</template>
