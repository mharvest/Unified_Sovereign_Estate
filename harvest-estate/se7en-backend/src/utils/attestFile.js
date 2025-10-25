import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export async function attestFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const stats = await stat(resolvedPath);

  if (!stats.isFile()) {
    throw new Error(`attestFile: ${resolvedPath} is not a regular file`);
  }

  const hash = createHash('sha256');

  await new Promise((resolve, reject) => {
    const stream = createReadStream(resolvedPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  return {
    fileName: path.basename(resolvedPath),
    filePath: resolvedPath,
    size: stats.size,
    sha256: `0x${hash.digest('hex')}`,
    modifiedAt: stats.mtime.toISOString(),
  };
}
