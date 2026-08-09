/** Client-side ZIP → self-contained vortex-plugin manifest (no extra deps). */

const MANIFEST = 'vortex-plugin.json'
const MAX_ZIP_BYTES = 2 * 1024 * 1024

function normalizePath(name: string): string | null {
  const raw = name.replace(/\\/g, '/').replace(/^\.?\//, '')
  if (!raw || raw.endsWith('/')) return null
  const parts = raw.split('/').filter((p) => p && p !== '.')
  if (!parts.length || parts.some((p) => p === '..')) return null
  return parts.join('/')
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser cannot decompress ZIP (no DecompressionStream)')
  }
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

type ZipEntry = { path: string; data: Uint8Array }

async function readZip(buf: ArrayBuffer): Promise<ZipEntry[]> {
  if (buf.byteLength > MAX_ZIP_BYTES) {
    throw new Error('ZIP exceeds 2 MiB limit')
  }
  const view = new DataView(buf)
  const u8 = new Uint8Array(buf)
  const entries: ZipEntry[] = []
  let offset = 0

  while (offset + 30 <= view.byteLength) {
    const sig = view.getUint32(offset, true)
    if (sig !== 0x04034b50) break

    const method = view.getUint16(offset + 8, true)
    const compSize = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const nameBytes = u8.subarray(nameStart, nameStart + nameLen)
    const name = new TextDecoder('utf-8').decode(nameBytes)
    const dataStart = nameStart + nameLen + extraLen
    const comp = u8.subarray(dataStart, dataStart + compSize)

    // Skip data descriptor / directories
    const path = normalizePath(name)
    offset = dataStart + compSize

    if (!path || name.endsWith('/')) continue

    let data: Uint8Array
    if (method === 0) {
      data = comp
    } else if (method === 8) {
      data = await inflateRaw(comp)
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} for ${path}`)
    }
    entries.push({ path, data })
  }

  if (!entries.length) {
    throw new Error('Not a valid ZIP or empty archive')
  }
  return entries
}

function decodeJson(data: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(data)) as unknown
  } catch {
    throw new Error(`Invalid JSON in archive: ${path}`)
  }
}

/**
 * Unpack a plugin ZIP the same way Core `materialize_manifest_from_zip` does:
 * find vortex-plugin.json, inline ui/ + schemas/.
 */
export async function materializeManifestFromZip(
  file: File,
): Promise<Record<string, unknown>> {
  const entries = await readZip(await file.arrayBuffer())
  const byPath = new Map(entries.map((e) => [e.path, e.data]))

  const manifestPaths = [...byPath.keys()]
    .filter((p) => p === MANIFEST || p.endsWith(`/${MANIFEST}`))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)

  if (!manifestPaths.length) {
    throw new Error(`Archive must contain ${MANIFEST}`)
  }

  const manifestPath = manifestPaths[0]!
  const root = manifestPath === MANIFEST ? '' : manifestPath.slice(0, -MANIFEST.length)

  const raw = decodeJson(byPath.get(manifestPath)!, manifestPath)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Manifest must be a JSON object')
  }
  const manifest = { ...(raw as Record<string, unknown>) }

  const views: Record<string, unknown> = {
    ...((manifest.views as Record<string, unknown> | undefined) ?? {}),
  }
  const schemas: Record<string, unknown> = {
    ...((manifest.schemas as Record<string, unknown> | undefined) ?? {}),
  }

  const loadRel = (rel: string): unknown | undefined => {
    const full = normalizePath(`${root}${rel}`)
    if (!full || !byPath.has(full)) return undefined
    return decodeJson(byPath.get(full)!, full)
  }

  for (const path of byPath.keys()) {
    if (root && !path.startsWith(root)) continue
    const rel = root ? path.slice(root.length) : path
    if (rel === MANIFEST || !rel.endsWith('.json')) continue
    const payload = decodeJson(byPath.get(path)!, path)
    if (rel.startsWith('ui/') && views[rel] === undefined) views[rel] = payload
    else if (rel.startsWith('schemas/') && schemas[rel] === undefined) schemas[rel] = payload
  }

  const ui = manifest.ui
  const contribs =
    ui && typeof ui === 'object' && !Array.isArray(ui)
      ? (ui as { contributions?: unknown }).contributions
      : undefined
  if (Array.isArray(contribs)) {
    for (const c of contribs) {
      if (!c || typeof c !== 'object') continue
      const contrib = c as Record<string, unknown>
      if (typeof contrib.view === 'string' && views[contrib.view] === undefined) {
        const loaded = loadRel(contrib.view)
        if (loaded !== undefined) views[contrib.view] = loaded
      }
      if (typeof contrib.schema === 'string' && schemas[contrib.schema] === undefined) {
        const loaded = loadRel(contrib.schema)
        if (loaded !== undefined) schemas[contrib.schema] = loaded
      }
    }
  }

  for (const key of ['config_schema', 'host_binding_schema'] as const) {
    const ref = manifest[key]
    if (typeof ref === 'string' && schemas[ref] === undefined) {
      const loaded = loadRel(ref)
      if (loaded !== undefined) schemas[ref] = loaded
    }
  }

  manifest.views = views
  manifest.schemas = schemas
  return manifest
}
