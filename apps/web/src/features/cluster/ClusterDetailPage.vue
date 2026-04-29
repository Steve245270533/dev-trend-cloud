<script setup>
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiGet } from "@/shared/api/client.js";
import { useAsyncState } from "@/shared/composables/useAsyncState.js";
import EmptyState from "@/shared/ui/EmptyState.vue";
import SectionHeader from "@/shared/ui/SectionHeader.vue";
import StatCard from "@/shared/ui/StatCard.vue";
import EvidenceList from "./components/EvidenceList.vue";
import SourceDistributionChart from "./components/SourceDistributionChart.vue";

const route = useRoute();
const router = useRouter();

const clusterId = computed(() => String(route.params.clusterId || ""));
const evidenceLimit = computed(() => {
  const raw = Number(route.query.limit ?? 30);
  if (!Number.isFinite(raw)) {
    return 30;
  }
  return Math.max(1, Math.min(100, raw));
});

const clusterState = useAsyncState(async () => {
  return apiGet(`/question-clusters/${clusterId.value}`);
});

const evidenceState = useAsyncState(async () => {
  return apiGet(`/question-clusters/${clusterId.value}/evidence`, {
    limit: evidenceLimit.value,
  });
});

const cluster = computed(() => clusterState.data.value?.data ?? null);
const evidence = computed(() => evidenceState.data.value?.data ?? []);

function refresh() {
  clusterState.run();
  evidenceState.run();
}

function back() {
  router.push({ name: "question-pressure" });
}

watch(
  () => clusterId.value,
  () => refresh(),
);
</script>

<template>
  <div>
    <SectionHeader
      title="聚类详情"
      :subtitle="clusterId ? `clusterId: ${clusterId}` : ''"
    >
      <div class="flex items-center gap-2">
        <el-button plain @click="back">
          <ArrowLeft class="mr-1 h-4 w-4" />
          返回
        </el-button>
        <el-button :loading="clusterState.loading.value" plain @click="refresh">
          <Refresh class="mr-1 h-4 w-4" />
          刷新
        </el-button>
      </div>
    </SectionHeader>

    <div v-if="clusterState.error.value" class="mt-4">
      <EmptyState
        title="加载失败"
        :description="clusterState.error.value.message"
        action-label="返回列表"
        @action="back"
      />
    </div>

    <div v-else-if="clusterState.loading.value" class="mt-4">
      <div
        class="animate-pulse rounded-xl2 border border-white/10 bg-surface/70 p-6 shadow-bento backdrop-blur"
      >
        <div class="h-4 w-64 rounded bg-white/10" />
        <div class="mt-4 h-3 w-full rounded bg-white/8" />
        <div class="mt-2 h-3 w-5/6 rounded bg-white/6" />
        <div class="mt-2 h-3 w-4/6 rounded bg-white/6" />
      </div>
    </div>

    <div v-else-if="!cluster" class="mt-4">
      <EmptyState
        title="聚类不存在"
        description="该 clusterId 在数据库中未找到。"
        action-label="返回列表"
        @action="back"
      />
    </div>

    <div v-else class="mt-4">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div
          class="rounded-xl2 border border-white/10 bg-surface/70 p-5 shadow-bento backdrop-blur lg:col-span-2"
        >
          <div class="dt-font-display text-xl font-bold leading-snug">
            {{ cluster.canonicalQuestion }}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <el-tag type="info" effect="dark">
              growth {{ cluster.growthLabel }}
            </el-tag>
            <el-tag type="info" effect="dark">
              novelty {{ cluster.noveltyLabel }}
            </el-tag>
            <el-tag type="info" effect="dark">
              evidence {{ cluster.evidenceCount }}
            </el-tag>
            <el-tag type="info" effect="dark">
              新鲜度 {{ cluster.freshnessMinutes }}m
            </el-tag>
            <el-tag v-if="cluster.fallbackUsed" type="warning" effect="dark">
              fallback
            </el-tag>
            <el-tag type="info" effect="dark">
              confidence {{ Number(cluster.confidenceScore).toFixed(2) }}
            </el-tag>
          </div>

          <div class="mt-4 text-sm text-muted">
            {{ cluster.recommendedAction }}
          </div>

          <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-muted">
                影响 Topics
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <el-tag
                  v-for="t in cluster.affectedTopics"
                  :key="t"
                  type="info"
                  effect="dark"
                >
                  {{ t }}
                </el-tag>
                <div v-if="cluster.affectedTopics.length === 0" class="text-xs text-muted">
                  —
                </div>
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-muted">
                影响 Entities
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <el-tag
                  v-for="e in cluster.affectedEntities"
                  :key="e"
                  type="info"
                  effect="dark"
                >
                  {{ e }}
                </el-tag>
                <div v-if="cluster.affectedEntities.length === 0" class="text-xs text-muted">
                  —
                </div>
              </div>
            </div>
          </div>

          <div class="mt-5">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted">
              相关仓库
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <el-tag
                v-for="r in cluster.relatedRepos"
                :key="r"
                type="info"
                effect="dark"
              >
                {{ r }}
              </el-tag>
              <div v-if="cluster.relatedRepos.length === 0" class="text-xs text-muted">
                —
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <StatCard
            label="证据"
            :value="evidence.length"
            hint="已加载条数（可通过 URL query limit 调整）"
          />
          <SourceDistributionChart :distribution="cluster.sourceDistribution" />
        </div>
      </div>

      <div class="mt-6">
        <SectionHeader title="证据" subtitle="点击打开原始链接" />
        <div v-if="evidenceState.error.value" class="mt-3">
          <EmptyState
            title="证据加载失败"
            :description="evidenceState.error.value.message"
            action-label="重试"
            @action="evidenceState.run()"
          />
        </div>
        <div v-else-if="evidenceState.loading.value" class="mt-3">
          <div
            class="animate-pulse rounded-xl2 border border-white/10 bg-surface/70 p-6 shadow-bento backdrop-blur"
          >
            <div class="h-3 w-full rounded bg-white/8" />
            <div class="mt-2 h-3 w-5/6 rounded bg-white/6" />
            <div class="mt-2 h-3 w-4/6 rounded bg-white/6" />
          </div>
        </div>
        <div v-else-if="evidence.length === 0" class="mt-3">
          <EmptyState title="暂无证据" description="该聚类暂无证据记录。" />
        </div>
        <div v-else class="mt-3">
          <EvidenceList :items="evidence" />
        </div>
      </div>
    </div>
  </div>
</template>
