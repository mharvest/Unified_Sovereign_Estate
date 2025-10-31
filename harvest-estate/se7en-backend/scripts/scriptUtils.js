import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import {
  collectMissingInputs,
  missingToTodoList,
  updateEvidenceDoc,
} from '../src/lib/requiredInputs.js';

function logMissing(scriptName, todos) {
  const header = `[${scriptName}] missing prerequisites:`;
  const body = todos.map((item) => ` - ${item}`).join('\n');
  console.error(`${header}\n${body}`);
}

let envLoaded = false;

function loadEnvFile(candidate) {
  if (!candidate) {
    return false;
  }
  const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);
  if (!fs.existsSync(resolved)) {
    return false;
  }
  config({ path: resolved, override: true });
  return true;
}

function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  const candidates = [];
  if (process.env.ENV_FILE && process.env.ENV_FILE.trim().length > 0) {
    candidates.push(process.env.ENV_FILE.trim());
  }

  candidates.push('.env', '.env.demo', '../.env', '../.env.demo', '../.env.live');

  for (const candidate of candidates) {
    if (loadEnvFile(candidate)) {
      envLoaded = true;
      break;
    }
  }

  if (!envLoaded) {
    const fallback = config();
    envLoaded = Boolean(fallback?.parsed);
  }
}

/**
 * Validates readiness for scripted demos by checking required inputs.
 * @param {string} scriptName - Human-readable identifier for logging.
 * @returns {{
 *   todos: string[];
 *   missingBase: import('../src/lib/requiredInputs.js').MissingInput[];
 *   missingLive: import('../src/lib/requiredInputs.js').MissingInput[];
 *   demoMode: boolean;
 *   liveMode: boolean;
 * }}
 */
export function assertDemoReady(scriptName) {
  ensureEnvLoaded();
  const snapshot = collectMissingInputs();
  const missing = [...snapshot.base, ...snapshot.live];
  const todos = missingToTodoList(missing);

  if (todos.length > 0) {
    logMissing(scriptName, todos);
  } else {
    console.log(`[${scriptName}] prerequisites satisfied.`);
  }

  updateEvidenceDoc(missing).catch((error) => {
    console.warn(
      `[${scriptName}] failed to update needed evidence log: ${
        error instanceof Error ? error.message : error
      }`,
    );
  });

  return {
    todos,
    missingBase: snapshot.base,
    missingLive: snapshot.live,
    demoMode: snapshot.demoMode,
    liveMode: snapshot.liveMode,
  };
}
