#!/usr/bin/env node
/**
 * vesta-render CLI —— 不依赖 DSH 的 VESTA 命令行封装。
 *
 * 复用 many-crafts/vesta-bridge 的 lib/vesta.js、lib/scene.js、lib/pwsh.js（MIT），
 * 只做参数解析、JSON 输出与退出码；不改变上游的渲染/窗口逻辑。
 *
 * 用法：node scripts/vesta.mjs <command> [args] [--options]
 * 成功：stdout 输出 JSON，退出码 0。
 * 失败：stderr 输出“错误：…”，退出码 1。
 */

import { createVesta } from '../lib/vesta.js';

const VERSION = '0.1.3';

const HELP = `vesta-render ${VERSION}

用本机安装的 VESTA 打开/渲染晶体结构文件；不需要 DSH，不需要截图识别。

用法：
  node scripts/vesta.mjs <command> [参数] [选项]

命令：
  status                          查看 VESTA 路径、版本、运行中的窗口
  open <file...>                  用 VESTA 打开 CIF / POSCAR / .vesta
  export <input>                  命令行渲染结构文件为 PNG
  render <scene.vesta>            渲染 .vesta 场景，可临时覆盖视角/缩放/范围/背景
  close                           关闭 VESTA（先 WM_CLOSE，必要时 --force）

通用选项：
  --vesta <path>                  指定 VESTA.exe（优先于环境变量 VESTA_EXE）
  --out <path>                    输出路径（export / render）
  --scale <1-10>                  渲染倍率，默认 2
  --timeout <ms>                  超时，默认 120000
  -h, --help                      显示本帮助
  -V, --version                   显示版本

render 覆盖选项（只对 .vesta 场景生效；不修改原文件）：
  --view <h,k,l>                  晶向视角，例如 --view 0,0,1
  --zoom <number>                 模型缩放，例如 --zoom 0.9
  --boundary <a0,a1,b0,b1,c0,c1>  显示范围（分数坐标）
  --background <r,g,b>            背景色
  --save-scene <path>             把覆盖后的场景另存为新文件

示例：
  node scripts/vesta.mjs status
  node scripts/vesta.mjs export examples/fe_fcc_cell.cif --out out/cell.png --scale 2
  node scripts/vesta.mjs render my.vesta --view 0,0,1 --zoom 0.9 --out out/view.png

环境：
  VESTA_EXE   VESTA.exe 路径；未设置时必须用 --vesta 指定
  平台        Windows（调用 PowerShell 与 Win32 窗口接口）
  Node        >= 22

许可：MIT（见 LICENSE）；VESTA 不随本包分发，见 THIRD_PARTY_NOTICES.md。
`;

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`错误：${message}\n`);
  process.exitCode = 1;
}

/** 解析 --key value / --key=value / 位置参数。 */
function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      opts._.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '-h' || arg === '--help') { opts.help = true; continue; }
    if (arg === '-V' || arg === '--version') { opts.version = true; continue; }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq >= 0) {
        opts[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i += 1;
      } else {
        opts[key] = true;
      }
      continue;
    }
    opts._.push(arg);
  }
  return opts;
}

/** 逗号/空格分隔的数字列表；也接受 [0,0,1] 写法。 */
function numberList(value, count, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} 需要一个值，例如 ${label} 0,0,1。`);
  }
  const cleaned = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  const parts = cleaned.split(/[\s,]+/).filter((part) => part !== '').map(Number);
  if (parts.length !== count || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`${label} 需要 ${count} 个数字，收到：${value}`);
  }
  return parts;
}

function intOption(value, label, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} 需要 ${min} 到 ${max} 之间的整数，收到：${value}`);
  }
  return number;
}

function makeVesta(opts) {
  const config = typeof opts.vesta === 'string' ? { vestaPath: opts.vesta } : {};
  return createVesta({ config });
}

function inputFile(opts, label = '输入文件') {
  const file = opts._[0];
  if (typeof file !== 'string' || file.trim() === '') {
    throw new Error(`${label} 缺失。用法见 --help。`);
  }
  return file;
}

const handlers = {
  async status(opts) {
    const vesta = makeVesta(opts);
    const result = await vesta.status();
    return {
      node: process.version,
      platform: process.platform,
      ...result,
    };
  },

  async open(opts) {
    if (opts._.length === 0) throw new Error('open 至少需要一个文件路径。');
    const vesta = makeVesta(opts);
    return await vesta.open(opts._);
  },

  async export(opts) {
    const vesta = makeVesta(opts);
    return await vesta.exportImage({
      input: inputFile(opts),
      output: typeof opts.out === 'string' ? opts.out : undefined,
      scale: intOption(opts.scale, '--scale', { min: 1, max: 10 }),
      timeoutMs: intOption(opts.timeout, '--timeout', { min: 5000 }),
    });
  },

  async render(opts) {
    const overrides = {};
    if (opts.view !== undefined) overrides.direction = numberList(opts.view, 3, '--view');
    if (opts.zoom !== undefined) {
      const zoom = Number(opts.zoom);
      if (!Number.isFinite(zoom) || zoom <= 0) throw new Error(`--zoom 需要正数，收到：${opts.zoom}`);
      overrides.zoom = zoom;
    }
    if (opts.boundary !== undefined) overrides.boundary = numberList(opts.boundary, 6, '--boundary');
    if (opts.background !== undefined) overrides.background = numberList(opts.background, 3, '--background');

    const vesta = makeVesta(opts);
    return await vesta.renderScene({
      input: inputFile(opts, '.vesta 场景文件'),
      output: typeof opts.out === 'string' ? opts.out : undefined,
      scale: intOption(opts.scale, '--scale', { min: 1, max: 10 }),
      timeoutMs: intOption(opts.timeout, '--timeout', { min: 5000 }),
      overrides,
      saveSceneAs: typeof opts['save-scene'] === 'string' ? opts['save-scene'] : undefined,
    });
  },

  async close(opts) {
    const vesta = makeVesta(opts);
    const force = opts.force === true || opts.force === 'true';
    return await vesta.close({ force });
  },
};

/** 把上游面向插件的报错改写成 CLI 用户能照做的说法。 */
function friendly(message) {
  return message
    .replace(
      '请在插件配置里设置 vestaPath，或设置环境变量 VESTA_EXE。',
      '请设置环境变量 VESTA_EXE，或加 --vesta <path>。',
    )
    .replace(
      '请检查插件配置里的 vestaPath。',
      '请检查 --vesta 或 VESTA_EXE 指向的路径。',
    );
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const opts = parseArgs(argv.slice(1));

  if (command === '-V' || command === '--version' || opts.version) {
    printJson({ ok: true, name: 'vesta-render', version: VERSION });
    return;
  }
  if (command === undefined || command === '-h' || command === '--help' || command === 'help' || opts.help) {
    process.stdout.write(HELP);
    return;
  }
  const handler = handlers[command];
  if (handler === undefined) {
    fail(`未知命令 “${command}”。可用命令：${Object.keys(handlers).join(' / ')}`);
    return;
  }
  try {
    const result = await handler(opts);
    printJson({ ok: true, command, ...result });
  } catch (error) {
    fail(friendly(error instanceof Error ? error.message : String(error)));
  }
}

await main();
