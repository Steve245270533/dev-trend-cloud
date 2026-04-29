<script setup>
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiGet } from "@/shared/api/client.js";
import { useAsyncState } from "@/shared/composables/useAsyncState.js";
import EmptyState from "@/shared/ui/EmptyState.vue";
import SectionHeader from "@/shared/ui/SectionHeader.vue";

const route = useRoute();
const router = useRouter();

const source = computed({
  get: () => String(route.query.source ?? ""),
  set: (value) =>
    router.replace({ query: { ...route.query, source: value || undefined } }),
});

const topic = computed({
  get: () => String(route.query.topic ?? ""),
  set: (value) =>
    router.replace({ query: { ...route.query, topic: value || undefined } }),
});

const entity = computed({
  get: () => String(route.query.entity ?? ""),
  set: (value) =>
    router.replace({ query: { ...route.query, entity: value || undefined } }),
});

const limit = computed({
  get: () => {
    const raw = Number(route.query.limit ?? 30);
    if (!Number.isFinite(raw)) {
      return 30;
    }
    return Math.max(1, Math.min(100, raw));
  },
  set: (value) =>
    router.replace({
      query: { ...route.query, limit: value ? String(value) : undefined },
    }),
});

const state = useAsyncState(async () => {
  return apiGet("/feed", {
    source: source.value || undefined,
    topic: topic.value || undefined,
    entity: entity.value || undefined,
    limit: limit.value || undefined,
  });
});

const items = computed(() => state.data.value?.data ?? []);
const meta = computed(() => state.data.value?.meta ?? null);

function refresh() {
  state.run();
}

watch(
  () => [source.value, topic.value, entity.value, limit.value],
  () => refresh(),
);

const sourceOptions = ["", "stackoverflow", "hackernews", "devto", "ossinsight"];
const limitOptions = [10, 20, 30, 50, 100];

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

function hasLink(item) {
  return typeof item?.url === "string" && item.url.length > 0;
}
</script>

<template>
  <div>
    <SectionHeader
      title="Feed 浏览"
      subtitle="用于调试归一化 items 与 topic/entity 匹配结果"
    >
      <el-button :loading="state.loading.value" plain @click="refresh">
        <Refresh class="mr-1 h-4 w-4" />
        刷新
      </el-button>
    </SectionHeader>

    <div
      class="mt-4 rounded-xl2 border border-white/10 bg-surface/70 p-4 shadow-bento backdrop-blur"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <el-select v-model="source" placeholder="数据源（可选）" clearable>
          <el-option
            v-for="value in sourceOptions"
            :key="value || 'all'"
            :label="value ? value : '全部数据源'"
            :value="value"
          />
        </el-select>

        <el-input v-model="topic" placeholder="Topic（slug，可选）" clearable />
        <el-input v-model="entity" placeholder="Entity（slug，可选）" clearable />

        <div class="flex gap-3">
          <el-select v-model="limit" class="w-full" placeholder="数量">
            <el-option
              v-for="value in limitOptions"
              :key="value"
              :label="`数量 ${value}`"
              :value="value"
            />
          </el-select>
          <el-button type="primary" :loading="state.loading.value" @click="refresh">
            应用
          </el-button>
        </div>
      </div>
      <div v-if="meta" class="mt-3 text-xs text-muted">
        生成时间 {{ meta.generatedAt }} · 新鲜度 {{ meta.freshnessMinutes }}m
      </div>
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
        <div class="h-4 w-40 rounded bg-white/10" />
        <div class="mt-4 h-3 w-full rounded bg-white/8" />
        <div class="mt-2 h-3 w-5/6 rounded bg-white/6" />
      </div>
    </div>

    <div v-else-if="items.length === 0" class="mt-4">
      <EmptyState title="暂无数据" description="当前过滤条件下没有 feed items。" />
    </div>

    <div v-else class="mt-4 grid grid-cols-1 gap-3">
      <component
        :is="hasLink(item) ? 'a' : 'div'"
        v-for="item in items"
        :key="item.id"
        :href="hasLink(item) ? item.url : undefined"
        :target="hasLink(item) ? '_blank' : undefined"
        :rel="hasLink(item) ? 'noreferrer' : undefined"
        :class="[
          'group rounded-xl2 border border-white/10 bg-surface/70 p-4 shadow-bento backdrop-blur transition',
          hasLink(item)
            ? 'hover:border-white/20 hover:bg-surface2/70'
            : 'cursor-default',
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold leading-snug text-text">
              {{ item.title }}
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <el-tag type="info" effect="dark">{{ item.source }}</el-tag>
              <el-tag type="info" effect="dark">{{ item.contentType }}</el-tag>
              <el-tag type="info" effect="dark">分数 {{ item.score }}</el-tag>
              <el-tag type="info" effect="dark">
                回答 {{ item.answerCount }}
              </el-tag>
              <el-tag type="info" effect="dark">
                评论 {{ item.commentCount }}
              </el-tag>
              <el-tag type="info" effect="dark">{{ formatDate(item.publishedAt) }}</el-tag>
            </div>
            <div v-if="item.summary" class="mt-3 text-sm text-muted">
              {{ item.summary }}
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <el-tag
                v-for="tag in item.tags"
                :key="tag"
                type="info"
                effect="plain"
              >
                {{ tag }}
              </el-tag>
            </div>
            <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                <div class="text-xs font-semibold text-muted">Topics</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <el-tag
                    v-for="t in item.topics"
                    :key="t.id"
                    type="success"
                    effect="dark"
                  >
                    {{ t.slug }} · {{ Number(t.confidence).toFixed(2) }}
                  </el-tag>
                  <div v-if="item.topics.length === 0" class="text-xs text-muted">
                    —
                  </div>
                </div>
              </div>
              <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                <div class="text-xs font-semibold text-muted">Entities</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <el-tag
                    v-for="e in item.entities"
                    :key="e.id"
                    type="warning"
                    effect="dark"
                  >
                    {{ e.slug }} · {{ Number(e.confidence).toFixed(2) }}
                  </el-tag>
                  <div v-if="item.entities.length === 0" class="text-xs text-muted">
                    —
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ArrowUpRight
            class="mt-0.5 h-5 w-5 shrink-0 opacity-0 transition group-hover:opacity-70"
          />
        </div>
        <div class="mt-2 text-xs text-muted">
          {{ item.url || "无可用原始链接" }}
        </div>
      </component>
    </div>
  </div>
</template>
