<script setup>
import { computed } from "vue";

const props = defineProps({
  signals: { type: Array, default: () => [] },
});

const emit = defineEmits(["select"]);

function growthTone(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("spike") || v.includes("up") || v.includes("growth")) {
    return "warning";
  }
  if (v.includes("long") || v.includes("unresolved")) {
    return "danger";
  }
  return "info";
}

function confidenceTone(value) {
  const score = Number(value || 0);
  if (score >= 0.75) {
    return "success";
  }
  if (score >= 0.45) {
    return "warning";
  }
  return "danger";
}

const count = computed(() => props.signals.length);
</script>

<template>
  <div class="mt-4">
    <div class="mb-3 flex items-center justify-between text-sm text-muted">
      <div>共 {{ count }} 条</div>
      <div class="dt-mono">点击进入详情</div>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <button
        v-for="signal in props.signals"
        :key="signal.clusterId"
        type="button"
        class="group w-full rounded-xl2 border border-white/10 bg-surface/70 p-4 text-left shadow-bento backdrop-blur transition hover:border-white/20 hover:bg-surface2/70"
        @click="emit('select', signal)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="dt-font-display text-base font-bold leading-snug">
              {{ signal.canonicalQuestion }}
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <el-tag type="info" effect="dark">
                压力 {{ Number(signal.pressureScore).toFixed(1) }}
              </el-tag>
              <el-tag type="info" effect="dark">
                未解决 {{ signal.unresolvedVolume }}
              </el-tag>
              <el-tag :type="growthTone(signal.growthLabel)" effect="dark">
                {{ signal.growthLabel }}
              </el-tag>
              <el-tag :type="confidenceTone(signal.confidenceScore)" effect="dark">
                置信度 {{ Number(signal.confidenceScore).toFixed(2) }}
              </el-tag>
              <el-tag v-if="signal.fallbackUsed" type="warning" effect="dark">
                回退
              </el-tag>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            <div
              class="dt-mono rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted"
            >
              {{ signal.evidenceCount }} 条证据
            </div>
            <ArrowRight
              class="h-5 w-5 opacity-0 transition group-hover:opacity-70"
            />
          </div>
        </div>

        <div v-if="signal.recommendedAction" class="mt-3 text-sm text-muted">
          {{ signal.recommendedAction }}
        </div>
      </button>
    </div>
  </div>
</template>
