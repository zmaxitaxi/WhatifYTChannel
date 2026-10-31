import { compileFromFile } from 'json-schema-to-typescript';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('web/src/generated', { recursive: true });
const output = await compileFromFile('contracts/production.schema.json', {
  bannerComment: '/* Generated from Pydantic. Run: uv run aether schema && npm run contracts */',
  additionalProperties: false,
  unreachableDefinitions: true,
});
await writeFile('web/src/generated/production.ts', output);
