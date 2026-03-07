<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  content: string;
}>();

const renderedHtml = computed(() => {
  try {
    return marked.parse(props.content, { async: false }) as string;
  } catch {
    return '<p>Error rendering markdown</p>';
  }
});
</script>

<template>
  <div class="markdown-preview">
    <div class="preview-content" v-html="renderedHtml"></div>
  </div>
</template>

<style scoped>
.markdown-preview {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  background: #fff;
}

.preview-content {
  max-width: 800px;
  line-height: 1.7;
  color: #333;
  font-size: 0.95rem;
}

.preview-content :deep(h1) {
  font-size: 2rem;
  font-weight: 700;
  margin: 1.5rem 0 0.75rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #eee;
}

.preview-content :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #eee;
}

.preview-content :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
}

.preview-content :deep(h4),
.preview-content :deep(h5),
.preview-content :deep(h6) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
}

.preview-content :deep(p) {
  margin: 0 0 0.75rem;
}

.preview-content :deep(a) {
  color: #4a90d9;
  text-decoration: none;
}

.preview-content :deep(a:hover) {
  text-decoration: underline;
}

.preview-content :deep(strong) {
  font-weight: 700;
}

.preview-content :deep(code) {
  background: #f5f5f5;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
  font-size: 0.85em;
}

.preview-content :deep(pre) {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0 0 1rem;
}

.preview-content :deep(pre code) {
  background: none;
  padding: 0;
}

.preview-content :deep(blockquote) {
  border-left: 3px solid #ddd;
  margin: 0 0 1rem;
  padding: 0.5rem 1rem;
  color: #666;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  margin: 0 0 1rem;
  padding-left: 1.5rem;
}

.preview-content :deep(li) {
  margin-bottom: 0.25rem;
}

.preview-content :deep(hr) {
  border: none;
  border-top: 1px solid #e5e5e5;
  margin: 1.5rem 0;
}

.preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.preview-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.preview-content :deep(th),
.preview-content :deep(td) {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: left;
}

.preview-content :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
}
</style>
