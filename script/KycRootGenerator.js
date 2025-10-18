#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { utils } = require('ethers');

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  const lines = content.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const [address, salt] = line.split(',').map((value) => value.trim());
    if (!utils.isAddress(address)) {
      throw new Error(`Invalid address in CSV: ${address}`);
    }
    rows.push({ address: utils.getAddress(address), salt });
  }
  return rows;
}

function buildLeaves(rows) {
  return rows.map(({ address, salt }) => utils.solidityKeccak256(['address', 'bytes32'], [address, salt]));
}

function buildMerkleTree(leaves) {
  if (leaves.length === 0) {
    throw new Error('No leaves supplied');
  }
  let level = [...leaves];
  const tree = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      const pair = [left, right].sort();
      next.push(utils.keccak256(utils.solidityPack(['bytes32', 'bytes32'], pair)));
    }
    level = next;
    tree.unshift(level);
  }
  return { root: level[0], tree };
}

function buildProofs(leaves, tree) {
  const proofs = [];
  for (let index = 0; index < leaves.length; index += 1) {
    const proof = [];
    let idx = index;
    for (let level = tree.length - 1; level > 0; level -= 1) {
      const nodes = tree[level];
      const isRightNode = idx % 2 === 1;
      const pairIndex = isRightNode ? idx - 1 : idx + 1;
      const sibling = pairIndex < nodes.length ? nodes[pairIndex] : nodes[idx];
      proof.push(sibling);
      idx = Math.floor(idx / 2);
    }
    proofs.push(proof);
  }
  return proofs;
}

function main() {
  const [, , csvPath, outputPath = 'kyc-root.json'] = process.argv;
  if (!csvPath) {
    console.error('Usage: node KycRootGenerator.js <csvPath> [outputPath]');
    process.exit(1);
  }
  const rows = parseCsv(path.resolve(csvPath));
  const leaves = buildLeaves(rows);
  const { root, tree } = buildMerkleTree(leaves);
  const proofs = buildProofs(leaves, tree);

  const payload = rows.map((row, idx) => ({
    address: row.address,
    salt: row.salt,
    leaf: leaves[idx],
    proof: proofs[idx],
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    merkleRoot: root,
    entries: payload,
  };

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(output, null, 2));
  console.log(`Merkle root written to ${outputPath}`);
  console.log(`Root: ${root}`);
}

main();
