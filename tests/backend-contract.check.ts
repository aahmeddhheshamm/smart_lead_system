// Contract check: every endpoint + method used by src/api/backend.ts must exist in the
// backend's OpenAPI schema (contracts/leadflow-openapi.json, fetched from /api/schema/).
// Run: npm run test:contract   (refresh the snapshot with npm run contract:update)
import { readFileSync } from 'node:fs'

const schema = JSON.parse(readFileSync('contracts/leadflow-openapi.json', 'utf8'))
const source = readFileSync('src/api/backend.ts', 'utf8')

const ops = new Set<string>()
for (const [path, methods] of Object.entries<any>(schema.paths)) {
  for (const m of Object.keys(methods)) {
    if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) {
      ops.add(`${m.toUpperCase()} ${path.replace(/^\/api\/v1\//, '').replace(/\{[^}]+\}/g, '{}').replace(/\/$/, '')}`)
    }
  }
}

const calls = new Map<string, number>()
const re = /api\.(get|post|patch|put|delete)\(\s*(['"`])([^'"`]+)\2/g
for (const m of source.matchAll(re)) {
  const line = source.slice(0, m.index).split('\n').length
  const path = m[3].replace(/\$\{[^}]+\}/g, '{}').replace(/\/$/, '')
  calls.set(`${m[1].toUpperCase()} ${path}`, line)
}

const missing = [...calls].filter(([op]) => !ops.has(op))
for (const [op, line] of [...calls].sort()) console.log(`${missing.some(([m]) => m === op) ? '  ✗' : '  ✓'} ${op}  (backend.ts:${line})`)
console.log(`\n${calls.size - missing.length}/${calls.size} operations found in the OpenAPI schema (${schema.info?.title} ${schema.info?.version})`)
if (missing.length) process.exit(1)
