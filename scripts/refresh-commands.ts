import { rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

type Obj = Record<string, unknown>
type Entry = { id: string; summary: string; description: string; flags: [string, string][]; args: [string, string, boolean][]; examples: [string, string][] }
const object = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, label: string): string => {
  if (v == null) return ''
  if (typeof v !== 'string') throw new Error(`${label} must be text`)
  return v.replace(/\s+/g, ' ').trim()
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const globalFlags = new Set(['help', 'json'])

function fields(value: unknown, label: string): [string, Obj][] {
  if (value == null) return []
  if (!object(value) && !Array.isArray(value)) throw new Error(`${label} must be an object or array`)
  return Object.entries(value).map(([key, item]) => {
    if (!object(item)) throw new Error(`Invalid ${label} entry ${key}`)
    const name = text(item.name ?? (Array.isArray(value) ? undefined : key), `${label} name`)
    if (!name) throw new Error(`Missing ${label} name`)
    return [name, item]
  })
}

function example(value: unknown, id: string): [string, string] | null {
  let command: string, description = ''
  if (typeof value === 'string') command = value
  else if (object(value) && typeof value.command === 'string') {
    command = value.command
    description = text(value.description, 'example description')
  } else throw new Error(`Unsupported example for ${id}`)
  command = command.replace(/<%=\s*config\.bin\s*%>/g, 'sf')
    .replace(/<%=\s*command\.id\s*%>/g, id.replace(/:/g, ' '))
  // CLI examples often have a prose paragraph followed by a shell command on a new line.
  const lines = command.split(/\r?\n/)
  const commandLine = /^(?:\$\s*)?(?:(?:sf|sfdx)\s|(?:cat|echo|printf|SF_[A-Z_]+=).*\b(?:sf|sfdx)\s)/
  const index = lines.findIndex(line => commandLine.test(line.trim()))
  if (index >= 0) {
    if (!description) description = text(lines.slice(0, index).join(' '), 'example description')
    command = lines.slice(index).join('\n').trim().replace(/^\$\s*/, '')
  } else {
    const match = command.match(/^([\s\S]*?):\s+((?:sf|sfdx)\s+[\s\S]*)$/)
    if (!match) return null // Prose-only notes are not copyable commands.
    if (!description) description = text(match[1] + ':', 'example description')
    command = match[2].trim()
  }
  return [command, description]
}

export function generate(input: unknown): Entry[] {
  const commands = Array.isArray(input) ? input : object(input) && input.status === 0 && Array.isArray(input.result) ? input.result : null
  if (!commands?.length) throw new Error('Expected non-empty sf commands --json array')
  const seen = new Set<string>()
  const result: Entry[] = []
  for (const raw of commands) {
    if (!object(raw)) throw new Error('Invalid command')
    if (raw.hidden === true) continue
    const id = text(raw.id, 'command id')
    if (!id || seen.has(id)) throw new Error(`Missing or duplicate command id: ${id}`)
    seen.add(id)
    if (raw.hidden != null && typeof raw.hidden !== 'boolean') throw new Error(`Invalid hidden field: ${id}`)
    if (raw.examples != null && !Array.isArray(raw.examples)) throw new Error(`Invalid examples: ${id}`)
    result.push({
      id, summary: text(raw.summary, 'summary'), description: text(raw.description, 'description'),
      flags: fields(raw.flags, 'flags').filter(([name, flag]) => !globalFlags.has(name) && flag.hidden !== true && flag.helpGroup !== 'GLOBAL')
        .map(([name, flag]) => [name, text(flag.summary ?? flag.description, 'flag description')]).sort((a, b) => compare(a[0], b[0])),
      args: fields(raw.args, 'args').filter(([, arg]) => arg.hidden !== true)
        .map(([name, arg]) => [name, text(arg.description ?? arg.summary, 'arg description'), arg.required === true]),
      examples: (raw.examples as unknown[] | undefined ?? []).map(item => example(item, id)).filter((item): item is [string, string] => item !== null),
    })
  }
  if (!result.length) throw new Error('No visible commands')
  return result.sort((a, b) => compare(a.id, b.id))
}

export function checkCoverage(next: Entry[], previous: Entry[]) {
  for (const [label, count] of [
    ['commands', (x: Entry[]) => x.length],
    ['flags', (x: Entry[]) => x.reduce((n, c) => n + c.flags.length, 0)],
    ['args', (x: Entry[]) => x.reduce((n, c) => n + c.args.length, 0)],
    ['examples', (x: Entry[]) => x.reduce((n, c) => n + c.examples.length, 0)],
    ['descriptions', (x: Entry[]) => x.filter(c => c.description).length],
  ] as const) {
    if (count(next) < count(previous) * 0.8) throw new Error(`${label} dropped by more than 20%; refusing to overwrite`)
  }
}

export async function atomicWrite(path: string, data: string) {
  const temp = join(dirname(path), `.${randomUUID()}.tmp`)
  try { await writeFile(temp, data, { flag: 'wx' }); await rename(temp, path) }
  finally { await unlink(temp).catch(() => {}) }
}

async function main() {
  const destination = resolve(import.meta.dir, '../src/data/commands.json')
  const process = Bun.spawn(['sf', 'commands', '--json'], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (code !== 0) throw new Error(`sf commands failed (${code}): ${stderr}`)
  const commands = generate(JSON.parse(stdout))
  const previous = await Bun.file(destination).json() as Entry[]
  checkCoverage(commands, previous)
  await atomicWrite(destination, JSON.stringify(commands) + '\n')
  console.log(`Wrote ${commands.length} commands to ${destination}`)
}
if (import.meta.main) main().catch(error => { console.error(error); globalThis.process.exitCode = 1 })
