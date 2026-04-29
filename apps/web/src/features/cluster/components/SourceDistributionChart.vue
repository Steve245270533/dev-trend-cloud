<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import * as echarts from "echarts";

const props = defineProps({
  distribution: { type: Object, default: () => ({}) },
});

const containerRef = ref(null);
let chart = null;

const seriesData = computed(() =>
  Object.entries(props.distribution || {})
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value),
);

function render() {
  if (!containerRef.value) {
    return;
  }
  if (!chart) {
    chart = echarts.init(containerRef.value, null, { renderer: "canvas" });
  }

  chart.setOption(
    {
      backgroundColor: "transparent",
      grid: { left: 8, right: 8, top: 10, bottom: 10, containLabel: true },
      xAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        axisLabel: { color: "rgba(235,242,255,0.7)" },
      },
      yAxis: {
        type: "category",
        data: seriesData.value.map((d) => d.name),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisTick: { show: false },
        axisLabel: { color: "rgba(235,242,255,0.7)" },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      series: [
        {
          type: "bar",
          data: seriesData.value.map((d) => d.value),
          itemStyle: {
            color: "rgba(34,211,238,0.85)",
            borderRadius: [8, 8, 8, 8],
          },
          emphasis: { itemStyle: { color: "rgba(34,211,238,1)" } },
        },
      ],
    },
    { notMerge: true },
  );

  chart.resize();
}

function dispose() {
  if (chart) {
    chart.dispose();
    chart = null;
  }
}

let resizeObserver = null;

onMounted(() => {
  render();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (chart) {
        chart.resize();
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  dispose();
});

watch(
  () => props.distribution,
  () => {
    render();
  },
  { deep: true },
);
</script>

<template>
  <div
    class="rounded-xl2 border border-white/10 bg-surface/70 p-4 shadow-bento backdrop-blur"
  >
    <div class="mb-3 text-sm font-semibold text-muted">来源分布</div>
    <div ref="containerRef" class="h-[220px] w-full" />
  </div>
</template>
