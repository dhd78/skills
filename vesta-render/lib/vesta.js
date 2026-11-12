/**
 * VESTA 的核心操作。
 *
 * 全部通过「启动进程 + 命令行参数 + PowerShell 窗口查询」完成，不注入、不读内存、
 * 不做屏幕识别。`-open` / `-export_img` 是 VESTA 自带的命令行接口；渲染结果
 * 直接落盘，交给 read_image 检查即可。
 */

import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { killTree, runPowerShell } from './pwsh.js';
import { patchScene } from './scene.js';

/** 未配置时的空值；路径由插件 config 的 vestaPath 或环境变量 VESTA_EXE 提供。 */
const DEFAULT_EXE = '';

/** 枚举 VESTA 顶层窗口；输出 JSON（单个对象或数组）。 */
const ENUM_WINDOWS_SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class VestaWin {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    public static List<string> Rows(uint targetPid) {
        List<string> rows = new List<string>();
        EnumWindows(delegate (IntPtr h, IntPtr l) {
            uint pid;
            GetWindowThreadProcessId(h, out pid);
            if (pid == targetPid) {
                StringBuilder sb = new StringBuilder(512);
                GetWindowTextW(h, sb, 512);
                StringBuilder cls = new StringBuilder(256);
                GetClassNameW(h, cls, 256);
                RECT r;
                GetWindowRect(h, out r);
                rows.Add(string.Join("\t", new string[] {
                    h.ToInt64().ToString(),
                    sb.ToString().Replace("\t", " "),
                    cls.ToString().Replace("\t", " "),
                    IsWindowVisible(h) ? "1" : "0",
                    (r.Right - r.Left).ToString(),
                    (r.Bottom - r.Top).ToString()
                }));
            }
            return true;
        }, IntPtr.Zero);
        return rows;
    }
}
'@
$result = @()
foreach ($p in @(Get-Process -Name VESTA -ErrorAction SilentlyContinue)) {
    foreach ($row in [VestaWin]::Rows([uint32]$p.Id)) {
        $parts = $row -split "\t"
        $result += [pscustomobject]@{
            pid    = [int]$p.Id
            hwnd   = [long]$parts[0]
            title  = $parts[1]
            class  = $parts[2]
            visible = ($parts[3] -eq '1')
            width  = [int]$parts[4]
            height = [int]$parts[5]
        }
    }
}
if ($result.Count -eq 0) { '[]' } else { $result | ConvertTo-Json -Compress }
`;

/** 关闭 VESTA：先发 WM_CLOSE，必要时再强杀；输出 { before, after }。 */
const CLOSE_SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$procs = @(Get-Process -Name VESTA -ErrorAction SilentlyContinue)
$before = $procs.Count
foreach ($p in $procs) {
    try { [void]$p.CloseMainWindow() } catch { }
}
Start-Sleep -Milliseconds 2500
if (__FORCE__) {
    Get-Process -Name VESTA -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
}
$after = @(Get-Process -Name VESTA -ErrorAction SilentlyContinue).Count
[pscustomobject]@{ before = $before; after = $after } | ConvertTo-Json -Compress
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 把 PowerShell 的 CLIXML/堆栈整理成一行可读错误。 */
function cleanPowerShellError(text) {
  if (typeof text !== 'string' || text.trim() === '') return '';
  const plain = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/_x000D__x000A_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, 400);
}

/** 读取 PNG 头部尺寸；不是 PNG 时返回 undefined。 */
function imageInfo(file) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const buf = Buffer.alloc(32);
    const n = readSync(fd, buf, 0, 32, 0);
    if (n < 24) return undefined;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!isPng) return undefined;
    return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

/** 默认导出路径：与输入同目录、同名的 .png。 */
export function defaultOutputPath(input) {
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  return path.join(dir, `${base}.png`);
}

/** 时间戳，用于默认截图文件名。 */
export function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export class VestaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VestaError';
  }
}

/**
 * 创建 VESTA 操作器。
 * @param {{ config?: Record<string, unknown>, logger?: { info?: Function, warn?: Function } }} options
 */
export function createVesta({ config = {}, logger } = {}) {
  const settings = {
    vestaPath: DEFAULT_EXE,
    defaultScale: 2,
    exportTimeoutMs: 120000,
    ...config,
  };

  const exePath = () => {
    const configured = typeof settings.vestaPath === 'string' && settings.vestaPath.trim() !== ''
      ? settings.vestaPath
      : (typeof process.env.VESTA_EXE === 'string' ? process.env.VESTA_EXE.trim() : '');
    return configured === '' ? '' : path.resolve(configured);
  };

  const exists = () => {
    try {
      return statSync(exePath()).isFile();
    } catch {
      return false;
    }
  };

  const requireSupported = () => {
    if (process.platform !== 'win32') throw new VestaError('VESTA 集成目前只支持 Windows。');
  };

  const requireExe = () => {
    requireSupported();
    if (exePath() === '') {
      throw new VestaError('未配置 VESTA.exe 路径：请在插件配置里设置 vestaPath，或设置环境变量 VESTA_EXE。');
    }
    if (!exists()) throw new VestaError(`找不到 VESTA.exe：${exePath()}。请检查插件配置里的 vestaPath。`);
  };

  let cachedBuild;

  /**
   * VESTA.ini 第二段（如 3.4.5）是该文件的格式版本常量，不是程序版本，也不能用来判断旧版；
   * 所以真实构建号从 exe 里取：二进制含 "VESTA <version>" 的提示串，例如 3.90.6a。
   * 只读一次并缓存。
   */
  const exeBuild = () => {
    if (cachedBuild !== undefined) return cachedBuild;
    cachedBuild = null;
    try {
      const exe = exePath();
      const size = statSync(exe).size;
      const fd = openSync(exe, 'r');
      try {
        const chunk = 4 * 1024 * 1024;
        const buf = Buffer.allocUnsafe(chunk + 64);
        let pos = 0;
        let tail = '';
        while (pos < size) {
          const read = readSync(fd, buf, 0, chunk, pos);
          if (read <= 0) break;
          const text = tail + buf.toString('latin1', 0, read);
          const match = /VESTA (\d+\.\d+\.\d+[a-z]?)/.exec(text);
          if (match !== null) {
            cachedBuild = match[1];
            return cachedBuild;
          }
          tail = text.slice(-64);
          pos += read;
        }
      } finally {
        closeSync(fd);
      }
    } catch {
      cachedBuild = null;
    }
    return cachedBuild;
  };

  const version = () => {
    try {
      const ini = path.join(path.dirname(exePath()), 'VESTA.ini');
      const firstLine = (readFileSync(ini, 'utf8').split(/\r?\n/, 1)[0] ?? '').trim();
      const match = /#VESTA_INI_VER\s+(\d+(?:\.\d+)*)\s+(\d+(?:\.\d+)*)/.exec(firstLine);
      if (match === null) return undefined;
      return { iniFormat: match[1], app: match[2], build: exeBuild() ?? undefined };
    } catch {
      return undefined;
    }
  };

  /**
   * 枚举当前 VESTA 顶层窗口。
   * @returns {Promise<Array<{pid:number, hwnd:number, title:string, class:string, visible:boolean, width:number, height:number}>>}
   */
  const listWindows = async (timeoutMs = 20000) => {
    requireSupported();
    const { code, stdout, stderr } = await runPowerShell(ENUM_WINDOWS_SCRIPT, timeoutMs);
    if (code !== 0) {
      throw new VestaError(`枚举 VESTA 窗口失败：${cleanPowerShellError(stderr || stdout) || `退出码 ${code}`}`);
    }
    const text = stdout.trim();
    if (text === '' || text === '[]') return [];
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((row) => ({
      pid: Number(row.pid) || 0,
      hwnd: Number(row.hwnd) || 0,
      title: typeof row.title === 'string' ? row.title : '',
      class: typeof row.class === 'string' ? row.class : '',
      visible: row.visible === true,
      width: Number(row.width) || 0,
      height: Number(row.height) || 0,
    }));
  };

  const launch = (files) => new Promise((resolve, reject) => {
    const args = files.map((file) => path.resolve(file));
    const child = spawn(exePath(), args, {
      cwd: path.dirname(exePath()),
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.once('error', (error) => reject(new VestaError(`启动 VESTA 失败：${error.message}`)));
    child.once('spawn', () => {
      child.unref();
      resolve({ pid: child.pid, files: args });
    });
  });

  /**
   * 在桌面用 VESTA 打开一个或多个结构文件。
   * @param {string[]} files 文件路径。
   * @param {{ waitMs?: number }} [options]
   */
  const open = async (files, { waitMs = 6000 } = {}) => {
    requireExe();
    if (!Array.isArray(files) || files.length === 0) throw new VestaError('至少需要一个文件路径。');
    const resolved = files.map((file) => path.resolve(file));
    const missing = resolved.filter((file) => !existsSync(file));
    if (missing.length > 0) throw new VestaError(`文件不存在：${missing.join('、')}`);

    const launched = await launch(resolved);
    const baseNames = resolved.map((file) => path.basename(file).toLowerCase());
    const deadline = Date.now() + Math.max(0, waitMs);
    let windows = [];
    let byPid = false;
    let byTitle = false;
    do {
      await sleep(400);
      windows = await listWindows().catch(() => []);
      byPid = windows.some((win) => win.pid === launched.pid);
      byTitle = windows.some((win) => {
        const title = win.title.toLowerCase();
        return title !== '' && baseNames.some((name) => title.includes(name));
      });
      if (byPid || byTitle) break;
    } while (Date.now() < deadline);

    return {
      pid: launched.pid,
      files: launched.files,
      windows,
      detected: byPid || byTitle,
      forwarded: !byPid && byTitle,
    };
  };

  /**
   * 用命令行渲染图片：VESTA.exe -open <input> -export_img scale=N <output>
   * @param {{ input: string, output?: string, scale?: number, timeoutMs?: number, signal?: AbortSignal }} options
   */
  const exportImage = async ({ input, output, scale, timeoutMs, signal }) => {
    requireExe();
    if (typeof input !== 'string' || input.trim() === '') throw new VestaError('需要 input 参数。');
    const inPath = path.resolve(input);
    if (!existsSync(inPath)) throw new VestaError(`输入文件不存在：${inPath}`);

    const outPath = path.resolve(output ?? defaultOutputPath(inPath));
    const outDir = path.dirname(outPath);
    mkdirSync(outDir, { recursive: true });
    if (existsSync(outPath)) unlinkSync(outPath);

    const scaleValue = Number.isInteger(scale) && scale >= 1 && scale <= 10 ? scale : settings.defaultScale;
    const limitMs = Number.isInteger(timeoutMs) && timeoutMs >= 5000 ? timeoutMs : settings.exportTimeoutMs;

    const child = spawn(exePath(), ['-open', inPath, '-export_img', `scale=${scaleValue}`, outPath], {
      cwd: path.dirname(exePath()),
      stdio: 'ignore',
      windowsHide: false,
    });
    let exited = false;
    let exitedAt = 0;
    let exitCode = null;
    child.once('exit', (code) => { exited = true; exitedAt = Date.now(); exitCode = code; });
    child.once('error', () => { exited = true; exitedAt = Date.now(); exitCode = -1; });

    const deadline = Date.now() + limitMs;
    let lastSize = -1;
    let stableSince = 0;
    let written = false;
    let forwardedChecked = false;
    try {
      while (Date.now() < deadline) {
        if (signal?.aborted) throw new VestaError('渲染已取消。');
        if (existsSync(outPath)) {
          const size = statSync(outPath).size;
          if (size > 0) {
            if (size === lastSize) {
              if (Date.now() - stableSince >= 500) { written = true; break; }
            } else {
              lastSize = size;
              stableSince = Date.now();
            }
          }
        } else if (exited && exitedAt > 0 && Date.now() - exitedAt > 8000 && !forwardedChecked) {
          // VESTA 是单实例程序：已有窗口时，新进程会把参数转发给旧实例后立即退出。
          // 只有确认没有任何 VESTA 进程在运行时，才判定为失败。
          forwardedChecked = true;
          const running = await listWindows().catch(() => []);
          if (running.length === 0) {
            throw new VestaError(
              `VESTA 在写出图片前退出（退出码 ${exitCode}）。请确认输入文件能被 VESTA 解析，且当前版本支持 -export_img。`,
            );
          }
        }
        await sleep(250);
      }
    } finally {
      await killTree(child.pid);
    }

    if (!written) {
      throw new VestaError(
        `等待 ${Math.round(limitMs / 1000)} 秒仍未生成图片：${outPath}。VESTA 可能不支持命令行导出，或输入文件无法解析。`,
      );
    }

    const size = statSync(outPath).size;
    const info = imageInfo(outPath);
    return {
      input: inPath,
      output: outPath,
      bytes: size,
      width: info?.width ?? 0,
      height: info?.height ?? 0,
      scale: scaleValue,
    };
  };

  /**
   * 渲染 .vesta 场景，可先应用视角 / 缩放 / 边界 / 背景覆盖。
   * 覆盖参数写入临时场景文件（与原场景同目录，保证相对路径引用不失效），渲染后删除。
   */
  const renderScene = async ({
    input,
    output,
    scale,
    timeoutMs,
    signal,
    overrides = {},
    saveSceneAs,
  }) => {
    requireExe();
    const inPath = path.resolve(input);
    if (!existsSync(inPath)) throw new VestaError(`输入文件不存在：${inPath}`);
    if (!/\.vesta$/i.test(inPath)) {
      if (Object.keys(overrides).length > 0 || saveSceneAs !== undefined) {
        throw new VestaError('视角/缩放/边界/背景覆盖只支持 .vesta 场景文件；CIF 等结构文件请先用 vesta_open 打开并在 VESTA 里另存为场景。');
      }
      const plain = await exportImage({ input: inPath, output, scale, timeoutMs, signal });
      return { ...plain, applied: [], scene: inPath, saved: false };
    }

    const original = readFileSync(inPath, 'utf8');
    const { text, applied } = patchScene(original, overrides);

    let scenePath = inPath;
    let temporary = false;
    if (saveSceneAs !== undefined) {
      scenePath = path.resolve(saveSceneAs);
      mkdirSync(path.dirname(scenePath), { recursive: true });
      writeFileSync(scenePath, text, 'utf8');
    } else if (applied.length > 0) {
      scenePath = path.join(path.dirname(inPath), `.dsh-vesta-${process.pid}-${Date.now()}.vesta`);
      writeFileSync(scenePath, text, 'utf8');
      temporary = true;
    }

    try {
      const result = await exportImage({ input: scenePath, output, scale, timeoutMs, signal });
      return {
        ...result,
        applied,
        scene: scenePath,
        saved: saveSceneAs !== undefined,
      };
    } finally {
      if (temporary) {
        try { unlinkSync(scenePath); } catch { /* ignore */ }
      }
    }
  };

  /** 关闭所有 VESTA 窗口（先礼后兵）。 */
  const close = async ({ force = false } = {}) => {
    requireSupported();
    const script = CLOSE_SCRIPT.replace('__FORCE__', force ? '$true' : '$false');
    const { code, stdout, stderr } = await runPowerShell(script, 40000);
    if (code !== 0) throw new VestaError(`关闭 VESTA 失败：${cleanPowerShellError(stderr || stdout) || `退出码 ${code}`}`);
    let parsed;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      throw new VestaError(`关闭 VESTA 返回了无法解析的结果：${stdout.trim()}`);
    }
    return {
      closed: Math.max(0, (Number(parsed.before) || 0) - (Number(parsed.after) || 0)),
      remaining: Number(parsed.after) || 0,
      forced: force === true,
    };
  };

  /** 安装状态 + 当前窗口。 */
  const status = async () => {
    const info = version();
    return {
      exe: exePath(),
      exists: exists(),
      version: info?.build ?? info?.app,
      iniFormat: info?.iniFormat,
      windows: await listWindows().catch(() => []),
    };
  };

  return {
    exePath,
    exists,
    version,
    status,
    listWindows,
    open,
    exportImage,
    renderScene,
    close,
    settings,
    logger,
  };
}
