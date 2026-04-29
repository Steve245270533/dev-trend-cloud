<script setup>
import { computed } from "vue";

const props = defineProps({
  topic: { type: String, default: "" },
  entity: { type: String, default: "" },
  limit: { type: Number, default: 20 },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(["update:topic", "update:entity", "update:limit", "apply"]);

const limitOptions = [10, 20, 50, 100];

const limitModel = computed({
  get: () => props.limit,
  set: (value) => emit("update:limit", Number(value)),
});
</script>

<template>
  <div
    class="rounded-xl2 border border-white/10 bg-surface/70 p-4 shadow-bento backdrop-blur"
  >
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <el-input
        :model-value="props.topic"
        placeholder="Topic（slug，可选）"
        clearable
        @update:model-value="emit('update:topic', $event)"
      >
        <template #prefix>
          <Tag class="h-4 w-4 opacity-70" />
        </template>
      </el-input>

      <el-input
        :model-value="props.entity"
        placeholder="Entity（slug，可选）"
        clearable
        @update:model-value="emit('update:entity', $event)"
      >
        <template #prefix>
          <Box class="h-4 w-4 opacity-70" />
        </template>
      </el-input>

      <div class="flex gap-3">
        <el-select v-model="limitModel" class="w-full" placeholder="数量">
          <el-option
            v-for="value in limitOptions"
            :key="value"
            :label="`数量 ${value}`"
            :value="value"
          />
        </el-select>
        <el-button type="primary" :loading="props.loading" @click="emit('apply')">
          刷新
        </el-button>
      </div>
    </div>
  </div>
</template>
