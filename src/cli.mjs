#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadStore } from './data-store.mjs';
import { createServer } from './server.mjs';

try {
  const store = loadStore();
  const server = createServer(store);
  await server.connect(new StdioServerTransport());
  console.error(
    `korean-elementary-learning-map-mcp ${store.manifest.taxonomyVersion}: stdio 서버 시작됨`
  );
} catch (error) {
  console.error(`서버 시작 실패: ${error.message}`);
  process.exit(1);
}
