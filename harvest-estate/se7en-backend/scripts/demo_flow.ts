#!/usr/bin/env tsx
import { assertDemoReady } from './scriptUtils.js';

async function main() {
  const { todos } = assertDemoReady('demo:alpha');
  if (todos.length > 0) {
    process.exit(1);
  }
  console.log('TODO: Implement demo:alpha orchestration (intake → issuance → insure → peg → cycle).');
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
