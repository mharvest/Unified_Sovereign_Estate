import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function usage() {
  console.error('Usage: npm run hash:docs -- --path=<folder>');
  process.exit(1);
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  const hash = createHash('sha256').update(data).digest('hex');
  return {
    file: path.basename(filePath),
    hash: `0x${hash}`,
    size: data.length,
  };
}

async function main() {
  const dirArg = process.argv.find((arg) => arg.startsWith('--path='));
  if (!dirArg) usage();
  const dirPath = dirArg.split('=')[1];
  const absPath = path.resolve(process.cwd(), dirPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    console.error(`Directory not found: ${absPath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(absPath).filter((name) => !name.startsWith('.'));
  if (files.length === 0) {
    console.warn('No files found to hash.');
    return;
  }

  const results = files.map((file) => hashFile(path.join(absPath, file)));
  const outputPath = path.join(absPath, 'hash_manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), files: results }, null, 2));

  console.log(`Hash manifest written to ${outputPath}`);
  for (const result of results) {
    console.log(`${result.hash}  ${result.file} (${result.size} bytes)`);
  }
}

main().catch((error) => {
  console.error('Failed to hash documents:', error);
  process.exit(1);
});
