import { expect, test } from 'bun:test'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { atomicWrite, checkCoverage, generate } from './refresh-commands'

const raw = { status: 0, result: [
  { id: 'z:run', summary: 'Run it', description: 'Long\n description', flags: { help: {}, json: {}, hidden: { hidden: true }, name: { summary: 'A name' } }, args: { file: { description: 'Input file', required: true } }, examples: ['Use it: <%= config.bin %> <%= command.id %> --name test', { command: 'sf z run', description: 'Run:' }] },
  { id: 'secret', hidden: true },
  { id: 'a', flags: {}, args: [], examples: [] },
] }

test('transforms supported CLI shapes deterministically without truncating', () => {
  const result = generate(raw)
  expect(result.map(c => c.id)).toEqual(['a', 'z:run'])
  expect(result[1]).toEqual({ id: 'z:run', summary: 'Run it', description: 'Long description', flags: [['name', 'A name']], args: [['file', 'Input file', true]], examples: [['sf z run --name test', 'Use it:'], ['sf z run', 'Run:']] })
  expect(generate(raw)).toEqual(result)
  expect(generate(raw.result)).toEqual(result)
  expect(generate([{ id: 'a', flags: { 'flags-dir': { helpGroup: 'GLOBAL', summary: 'Import flags' } } }])[0].flags).toEqual([])
  expect(generate([{ id: 'a', examples: ['A note only.', 'Show details.\n$ sf a --verbose', 'Pipe input:\ncat input | sf a'] }])[0].examples).toEqual([['sf a --verbose', 'Show details.'], ['cat input | sf a', 'Pipe input:']])
})
test('rejects unsuccessful, malformed and duplicate inventories', () => {
  for (const input of [{ status: 1, result: [] }, { status: 0, result: [] }, { status: 0, result: [{ id: 'a' }, { id: 'a' }] }, { status: 0, result: [{ id: 'a', examples: [12] }] }]) {
    expect(() => generate(input)).toThrow()
  }
})
test('refuses large inventory and detail losses', () => {
  const previous = generate(raw)
  expect(() => checkCoverage(previous.slice(0, 1), previous)).toThrow()
  expect(() => checkCoverage(previous.map(c => ({ ...c, examples: [] })), previous)).toThrow()
  expect(() => checkCoverage(previous, previous)).not.toThrow()
})
test('atomic replacement preserves original when preparation fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sfcli-test-'))
  try {
    const path = join(dir, 'commands.json')
    await writeFile(path, 'original')
    await expect(atomicWrite(join(dir, 'missing', 'commands.json'), 'bad')).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('original')
    await atomicWrite(path, 'new')
    expect(await readFile(path, 'utf8')).toBe('new')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
test('CLI failures never replace snapshot; successful mock refresh does', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sfcli-process-'))
  try {
    await Promise.all(['scripts', 'src/data', 'bin'].map(p => mkdir(join(dir, p), { recursive: true })))
    await copyFile(join(import.meta.dir, 'refresh-commands.ts'), join(dir, 'scripts/refresh-commands.ts'))
    const snapshot = join(dir, 'src/data/commands.json')
    const before = JSON.stringify(generate(raw))
    await writeFile(snapshot, before)
    const mock = join(dir, 'bin/sf')
    await writeFile(mock, '#!/bin/sh\n[ "$1 $2" = "commands --json" ] || exit 9\n[ "$MOCK_FAIL" = 1 ] && exit 3\nprintf "%s" "$MOCK_JSON"\n')
    await chmod(mock, 0o755)
    const run = async (fail: string) => {
      const proc = Bun.spawn([process.execPath, join(dir, 'scripts/refresh-commands.ts')], {
        env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, MOCK_FAIL: fail, MOCK_JSON: JSON.stringify(raw) },
        stdout: 'pipe', stderr: 'pipe',
      })
      return proc.exited
    }
    expect(await run('1')).not.toBe(0)
    expect(await readFile(snapshot, 'utf8')).toBe(before)
    expect(await run('0')).toBe(0)
    expect(await readFile(snapshot, 'utf8')).toBe(before + '\n')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
