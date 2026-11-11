/**
 * The listener port one handoff root last bound.
 *
 * The OS assigns a fresh port on every start unless a port is configured,
 * which breaks manual pairing by address after a restart: the stored endpoint
 * would name a port nothing listens on. Remembering the last bound port keeps
 * a device reachable at the same address:port across restarts; a port another
 * process took makes the start fall back to an OS-assigned one and store it.
 * @module @easel-dsh/easel-air-transfer/port
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** File name of the remembered listener port inside the handoff root. */
const PORT_FILE_NAME = 'listener-port.json'

/**
 * Load the port this root last bound.
 * @param root - handoff root directory.
 * @returns the remembered port, or undefined when none is stored or the file is unusable.
 */
export async function loadSavedPort(root: string): Promise<number | undefined> {
  let raw: string
  try {
    raw = await readFile(join(root, PORT_FILE_NAME), 'utf8')
  } catch {
    // Absence and an unreadable file both mean "no remembered port".
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const port = (parsed as { readonly port?: unknown }).port
  return typeof port === 'number' && Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

/**
 * Remember one bound port atomically.
 * @param root - handoff root directory.
 * @param port - the port the listener bound.
 */
export async function saveSavedPort(root: string, port: number): Promise<void> {
  const file = join(root, PORT_FILE_NAME)
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify({ port }), { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, file)
}
