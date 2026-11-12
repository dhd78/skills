#!/usr/bin/env node
/**
 * vesta-render doctor —— 装机自检。
 *
 * 只检查本包能否工作，不启动 VESTA、不渲染：
 *   1. Node 版本（>= 22）
 *   2. 平台（Windows）
 *   3. VESTA.exe 路径（--vesta 或 VESTA_EXE）
 *   4. .vesta 场景改写自检（视角/缩放/范围/背景）
 *
 * 输出 JSON；必需项失败时退出码 1。`--strict` 时环境项缺失也算失败。
 * 任何一项都不写游戏内存、不注入、不联网。
 */

import { existsSync, readFileSync } from 'node:fs';
import { createVesta } from '../lib/vesta.js';
import { patchScene } from '../lib/scene.js';

const VERSION = '0.1.3';
const TEMPLATE = new URL('../templates/template.vesta', import.meta.url);

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const vestaEq = args.find((arg) => arg.startsWith('--vesta='));
const vestaIndex = args.indexOf('--vesta');
const vestaPath = vestaEq !== undefined
  ? vestaEq.slice('--vesta='.length)
  : (vestaIndex >= 0 && args[vestaIndex + 1] !== undefined && !args[vestaIndex + 1].startsWith('--')
    ? args[vestaIndex + 1]
    : (typeof process.env.VESTA_EXE === 'string' ? process.env.VESTA_EXE : ''));

const checks = [];
function add(id, status, detail) {
  checks.push({ id, status, detail });
}

// 1. Node
const nodeMajor = Number(process.versions.node.split('.')[0]);
add(
  'node',
  nodeMajor >= 22 ? 'pass' : 'fail',
  `Node ${process.version}（需要 >= 22）`,
);

// 2. 平台
add(
  'platform',
  process.platform === 'win32' ? 'pass' : 'fail',
  `platform=${process.platform}（本包只支持 Windows）`,
);

// 3. VESTA
if (vestaPath.trim() === '') {
  add('vesta', strict ? 'fail' : 'warn', '未指定 VESTA：请设置 VESTA_EXE 或使用 --vesta=<path>');
} else if (!existsSync(vestaPath)) {
  add('vesta', strict ? 'fail' : 'warn', `找不到 VESTA.exe：${vestaPath}`);
} else {
  let version;
  try {
    version = createVesta({ config: { vestaPath } }).version();
  } catch {
    version = undefined;
  }
  const build = version?.build ?? version?.app;
  add('vesta', 'pass', build !== undefined ? `VESTA ${build}（ini 格式 ${version?.iniFormat ?? '未知'}）：${vestaPath}` : `VESTA 存在（版本未知）：${vestaPath}`);
}

// 4. 场景改写自检
try {
  const original = readFileSync(TEMPLATE, 'utf8');
  const { text, applied } = patchScene(original, {
    direction: [0, 0, 1],
    zoom: 0.9,
    boundary: [0, 1, 0, 1, 0, 1],
    background: [20, 24, 32],
  });
  const assertions = [
    [applied.length === 4, `applied=${applied.join(' ')}`],
    [text !== original, '场景文本已改变'],
    [!text.startsWith('\uFEFF'), '无 BOM'],
    [text.includes('0.900'), 'zoom 已写入'],
    [text.includes('20 24 32'), 'background 已写入'],
  ];
  const failed = assertions.filter(([ok]) => !ok);
  add(
    'scene-patch',
    failed.length === 0 ? 'pass' : 'fail',
    failed.length === 0 ? `4 项覆盖通过：${applied.join(' ')}` : `失败：${failed.map(([, detail]) => detail).join('；')}`,
  );
} catch (error) {
  add('scene-patch', 'fail', error instanceof Error ? error.message : String(error));
}

const failedRequired = checks.some((check) => check.status === 'fail');
const warnings = checks.filter((check) => check.status === 'warn').length;
process.stdout.write(`${JSON.stringify({
  ok: !failedRequired,
  name: 'vesta-render',
  version: VERSION,
  strict,
  warnings,
  checks,
}, null, 2)}\n`);
process.exitCode = failedRequired ? 1 : 0;
