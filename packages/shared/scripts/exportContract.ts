// `npm run contract:export`: API 계약 JSON Schema 파일을 다시 만든다(D-141, src/contract.ts).
// 스키마에서 없어진 파일은 지운다.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildContract } from '../src/contract.ts';

const outDir = join(import.meta.dirname, '..', 'contract');
const files = buildContract();

mkdirSync(join(outDir, 'schemas'), { recursive: true });
for (const name of readdirSync(join(outDir, 'schemas'))) {
  if (!files.has(`schemas/${name}`)) rmSync(join(outDir, 'schemas', name));
}
for (const [path, content] of files) {
  mkdirSync(dirname(join(outDir, path)), { recursive: true });
  writeFileSync(join(outDir, path), content);
}
console.log(`contract: ${files.size}개 파일 → packages/shared/contract/`);
