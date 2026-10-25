// Native OS pickers shared by the data-root setting and the project archive
// feature. The host process owns these dialogs: the webview never sees a file
// path from a browser picker, and the desktop shell already uses this exact
// pattern for choosing the data directory.
//
// Scripts and prompts are fixed per locale. A project name reaches the save
// dialog only through an environment variable or an argv item, never through
// string interpolation into PowerShell/osascript source.
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Raised when the platform has no usable native chooser. */
export class PickerUnavailableError extends Error {
  /**
   * @param {string} command - the command that was missing.
   */
  constructor(command) {
    super(`picker-unavailable: ${command}`)
    this.name = 'PickerUnavailableError'
    this.code = 'picker-unavailable'
  }
}

/**
 * Run one native picker. Returns the chosen path, null when the user cancelled,
 * and `'missing'` when the command is not installed.
 * @param {string} command - executable to spawn.
 * @param {string[]} args - command arguments.
 * @param {{ env?: Record<string, string>, timeoutMs?: number }} [options] - extra environment and timeout.
 * @returns {Promise<string|null|'missing'>} the trimmed output, null, or 'missing'.
 */
export function runPicker(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    let settled = false
    let out = ''
    const child = spawn(command, args, {
      windowsHide: true,
      env: options.env === undefined ? process.env : { ...process.env, ...options.env },
    })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolvePromise(null)
    }, options.timeoutMs ?? 120_000)
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise(value)
    }
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', () => {})
    child.on('error', (error) => {
      if (error.code === 'ENOENT') return finish('missing')
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => finish(code === 0 ? out.trim() || null : null))
  })
}

function isWindows() { return process.platform === 'win32' }
function isMac() { return process.platform === 'darwin' }
function isEnglish(locale) { return locale === 'en' }

/**
 * Pick one existing directory through the OS chooser.
 * @returns {Promise<string|null>} the absolute directory, or null when cancelled.
 * @throws {PickerUnavailableError} when no chooser exists.
 */
export async function pickDirectory() {
  if (isWindows()) {
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      "$dialog.Description = '选择 Easel 数据目录'",
      '$dialog.ShowNewFolderButton = $true',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }',
    ].join('; ')
    const picked = await runPicker('powershell', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script])
    if (picked === 'missing') throw new PickerUnavailableError('powershell')
    return picked
  }
  if (isMac()) {
    const picked = await runPicker('osascript', ['-e', 'POSIX path of (choose folder with prompt "选择 Easel 数据目录")'])
    if (picked === 'missing') throw new PickerUnavailableError('osascript')
    return picked
  }
  const zenity = await runPicker('zenity', ['--file-selection', '--directory', '--title=选择 Easel 数据目录'])
  if (zenity !== 'missing') return zenity
  const kdialog = await runPicker('kdialog', ['--getexistingdirectory', homedir()])
  if (kdialog === 'missing') throw new PickerUnavailableError('kdialog')
  return kdialog
}

/**
 * Pick one existing zip archive.
 * @param {'zh'|'en'} [locale] - dialog language.
 * @returns {Promise<string|null>} the absolute file path, or null when cancelled.
 * @throws {PickerUnavailableError} when no chooser exists.
 */
export async function pickZipFile(locale = 'zh') {
  const english = isEnglish(locale)
  if (isWindows()) {
    const title = english ? 'Choose a project archive' : '选择项目压缩包'
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
      `$dialog.Title = '${title}'`,
      "$dialog.Filter = 'Zip (*.zip)|*.zip'",
      '$dialog.CheckFileExists = $true',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }',
    ].join('; ')
    const picked = await runPicker('powershell', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script])
    if (picked === 'missing') throw new PickerUnavailableError('powershell')
    return picked
  }
  if (isMac()) {
    const prompt = english ? 'Choose a project archive' : '选择项目压缩包'
    const picked = await runPicker('osascript', ['-e', `POSIX path of (choose file with prompt "${prompt}" of type {"zip"})`])
    if (picked === 'missing') throw new PickerUnavailableError('osascript')
    return picked
  }
  const title = english ? 'Choose a project archive' : '选择项目压缩包'
  const zenity = await runPicker('zenity', [
    '--file-selection', `--title=${title}`, '--file-filter=Zip | *.zip',
  ])
  if (zenity !== 'missing') return zenity
  const kdialog = await runPicker('kdialog', ['--getopenfilename', homedir(), '*.zip|Zip'])
  if (kdialog === 'missing') throw new PickerUnavailableError('kdialog')
  return kdialog
}

/**
 * Choose a destination zip through the OS save dialog.
 * @param {'zh'|'en'} [locale] - dialog language.
 * @param {string} defaultName - suggested file name; passed as data, never interpolated.
 * @returns {Promise<string|null>} the absolute destination, or null when cancelled.
 * @throws {PickerUnavailableError} when no chooser exists.
 */
export async function pickSaveZip(locale = 'zh', defaultName = 'project.zip') {
  const english = isEnglish(locale)
  const name = String(defaultName).replace(/[\r\n\0]/g, '').slice(0, 200) || 'project.zip'
  if (isWindows()) {
    const title = english ? 'Export project archive' : '导出项目压缩包'
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.SaveFileDialog',
      `$dialog.Title = '${title}'`,
      "$dialog.Filter = 'Zip (*.zip)|*.zip'",
      "$dialog.DefaultExt = 'zip'",
      '$dialog.AddExtension = $true',
      '$dialog.OverwritePrompt = $true',
      '$dialog.FileName = $env:EASEL_SAVE_NAME',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }',
    ].join('; ')
    const picked = await runPicker(
      'powershell',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { env: { EASEL_SAVE_NAME: name } },
    )
    if (picked === 'missing') throw new PickerUnavailableError('powershell')
    return picked
  }
  if (isMac()) {
    const prompt = english ? 'Export project archive' : '导出项目压缩包'
    const picked = await runPicker('osascript', [
      '-e', 'on run argv',
      '-e', `set target to choose file name with prompt "${prompt}" default name (item 1 of argv)`,
      '-e', 'return POSIX path of target',
      '-e', 'end run',
      '--', name,
    ])
    if (picked === 'missing') throw new PickerUnavailableError('osascript')
    return picked
  }
  const title = english ? 'Export project archive' : '导出项目压缩包'
  const initial = join(homedir(), name)
  const zenity = await runPicker('zenity', [
    '--file-selection', '--save', '--confirm-overwrite',
    `--filename=${initial}`, `--title=${title}`, '--file-filter=Zip | *.zip',
  ])
  if (zenity !== 'missing') return zenity
  const kdialog = await runPicker('kdialog', ['--getsavefilename', initial, '*.zip|Zip'])
  if (kdialog === 'missing') throw new PickerUnavailableError('kdialog')
  return kdialog
}
