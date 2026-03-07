<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readonly?: boolean;
  }>(),
  {
    readonly: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const textarea = ref<HTMLTextAreaElement | null>(null);

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const value = props.modelValue;
    const newValue = value.substring(0, start) + '  ' + value.substring(end);
    emit('update:modelValue', newValue);
    // Restore cursor position after Vue re-renders
    requestAnimationFrame(() => {
      if (textarea.value) {
        textarea.value.selectionStart = start + 2;
        textarea.value.selectionEnd = start + 2;
      }
    });
  }
}
</script>

<template>
  <div class="markdown-editor">
    <textarea
      ref="textarea"
      :value="modelValue"
      :disabled="readonly"
      class="editor-textarea"
      :class="{ 'editor-textarea--readonly': readonly }"
      placeholder="Write your markdown here..."
      spellcheck="false"
      @input="handleInput"
      @keydown="handleKeydown"
    ></textarea>
  </div>
</template>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  padding: 1rem;
  border: none;
  outline: none;
  resize: none;
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #333;
  background: #fafafa;
  box-sizing: border-box;
}

.editor-textarea::placeholder {
  color: #bbb;
}

.editor-textarea--readonly {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}
</style>
