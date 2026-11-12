/**
 * PowerShell 桥。
 *
 * 插件本身运行在 DSH 宿主进程里（不是被沙箱包住的终端），因此可以正常
 * 创建 GUI 进程、查询窗口、抓取屏幕。为了避开命令行转义问题，脚本统一用
 * `-EncodedCommand`（UTF-16LE + Base64）传入。
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const SYSTEM_ROOT = process.env.SystemRoot ?? process.env.windir ?? 'C:\\Windows';

/** Windows PowerShell 5.1 的绝对路径（不依赖 PATH）。 */
export const POWERSHELL = path.join(SYSTEM_ROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

/** taskkill 的绝对路径。 */
export const TASKKILL = path.join(SYSTEM_ROOT, 'System32', 'taskkill.exe');

/**
 * 在宿主进程里运行一段 PowerShell 脚本。
 *
 * @param {string} script 脚本正文（UTF-8 字符串）。
 * @param {number} timeoutMs 超时，超时后杀掉 PowerShell。
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runPowerShell(script, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const child = spawn(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`PowerShell 执行超时（${Math.round(timeoutMs / 1000)} 秒）`));
    }, timeoutMs);

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: typeof code === 'number' ? code : -1, stdout, stderr });
    });
  });
}

/** taskkill 结束整棵进程树；忽略失败（进程可能已经退出）。 */
export function killTree(pid) {
  if (typeof pid !== 'number' || pid <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const child = spawn(TASKKILL, ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    child.once('error', resolve);
    child.once('close', resolve);
  });
}
