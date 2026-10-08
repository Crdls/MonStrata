/**
 * Minimal Prometheus text exposition format parser.
 * Handles metric names with colons (e.g. `strata:gpu_util`), label values
 * with escapes, and optional trailing timestamps.
 */

export type MetricType = 'gauge' | 'counter' | 'histogram' | 'summary' | 'untyped'

export interface Sample {
  metric: string
  labels: Record<string, string>
  value: number
}

export interface ParseResult {
  samples: Sample[]
  types: Record<string, MetricType>
}

const SAMPLE_RE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?[\d.eE+]+|NaN|\+Inf|-Inf|nan|\+inf|-inf)(?:\s+\S+)?\s*$/

/** Parse the inside of `{...}` into a label record. */
function parseLabels (input: string): Record<string, string> {
  const labels: Record<string, string> = {}
  let i = 0
  while (i < input.length) {
    // skip separators / whitespace
    while (i < input.length && (input[i] === ',' || input[i] === ' ')) i++
    const eq = input.indexOf('=', i)
    if (eq === -1) break
    const key = input.slice(i, eq).trim()
    // value must start with a quote
    if (input[eq + 1] !== '"') break
    let j = eq + 2
    let value = ''
    while (j < input.length) {
      const ch = input[j]
      if (ch === '\\' && j + 1 < input.length) {
        const next = input[j + 1]
        value += next === 'n' ? '\n' : next === '\\' ? '\\' : next === '"' ? '"' : next
        j += 2
        continue
      }
      if (ch === '"') break
      value += ch
      j++
    }
    if (key) labels[key] = value
    i = j + 1
  }
  return labels
}

/** Stable string form of a label set: sorted `k=v` joined with commas. */
export function normalizeLabels (labels: Record<string, string>): string {
  return Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(',')
}

export function parsePrometheus (text: string): ParseResult {
  const samples: Sample[] = []
  const types: Record<string, MetricType> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      // `# TYPE name type`
      const m = /^#\s*TYPE\s+(\S+)\s+(\S+)/.exec(line)
      if (m) types[m[1]!] = m[2] as MetricType
      continue
    }
    const m = SAMPLE_RE.exec(line)
    if (!m) continue
    const raw = m[3]!
    let value: number
    if (raw === '+Inf' || raw === '+inf') value = Infinity
    else if (raw === '-Inf' || raw === '-inf') value = -Infinity
    else if (raw === 'NaN' || raw === 'nan') continue
    else value = Number.parseFloat(raw)
    if (Number.isNaN(value)) continue
    samples.push({
      metric: m[1]!,
      labels: m[2] ? parseLabels(m[2]) : {},
      value
    })
  }
  return { samples, types }
}
