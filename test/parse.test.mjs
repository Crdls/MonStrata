// Quick smoke test for the Prometheus parser against real fixtures.
// Run: node test/parse.test.mjs
import { readFileSync } from 'node:fs'
import { parsePrometheus, normalizeLabels } from '../server/utils/parse.ts'

let failed = 0
function check (name, cond) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`)
  if (!cond) failed++
}

for (const file of ['metrics1.txt', 'metrics2.txt']) {
  const text = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8')
  const { samples, types } = parsePrometheus(text)
  check(`${file}: parsed ${samples.length} samples`, samples.length > 50)
  check(`${file}: types detected`, Object.keys(types).length > 15 && types['strata:gpu_util'] === 'gauge')

  const gpu = samples.filter(s => s.metric === 'strata:gpu_util')
  check(`${file}: gpu_util has gpu labels`, gpu.length >= 2 && gpu.every(s => 'gpu' in s.labels))

  const state = samples.filter(s => s.metric === 'strata:live_state')
  check(`${file}: live_state one-hot`, state.length === 4 && state.reduce((a, s) => a + s.value, 0) === 1)

  const hist = samples.find(s => s.metric === 'vllm:time_to_first_token_seconds_bucket' && s.labels.le === '+Inf')
  check(`${file}: histogram +Inf bucket`, hist !== undefined && hist.value > 0)

  const ctx = samples.find(s => s.metric === 'strata:engine_max_context')
  check(`${file}: colon metric name`, ctx !== undefined && ctx.value >= 262144)

  const model = samples.find(s => s.labels.model_name)?.labels.model_name
  check(`${file}: model_name label kept`, typeof model === 'string' && model.length > 0)

  const norm = normalizeLabels(gpu[0].labels)
  check(`${file}: normalizeLabels stable`, norm.includes('gpu=') && norm.includes('model_name='))
}

// edge cases
const edge = parsePrometheus([
  '# HELP x test',
  '# TYPE x gauge',
  'x 1',
  'x{a="1",b="2"} 2',
  'x{a="say \\"hi\\"",b="line\\nbreak"} 3',
  'weird:name_total{z=""} 4.5e3 1700000000000',
  'nan_metric NaN',
  'inf_metric +Inf',
  'broken{unterminated 5'
].join('\n'))
check('edge: skips comments and broken lines', edge.samples.length === 5)
check('edge: escaped quotes', edge.samples.some(s => s.labels.a === 'say "hi"'))
check('edge: escaped newline', edge.samples.some(s => s.labels.b === 'line\nbreak'))
check('edge: sci notation + timestamp', edge.samples.some(s => s.metric === 'weird:name_total' && s.value === 4500))
check('edge: NaN skipped, +Inf kept', !edge.samples.some(s => s.metric === 'nan_metric') && edge.samples.some(s => s.metric === 'inf_metric'))

console.log(failed === 0 ? '\nAll checks passed' : `\n${failed} checks FAILED`)
process.exit(failed === 0 ? 0 : 1)
