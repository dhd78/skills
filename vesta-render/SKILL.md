---
name: vesta-render
description: Render crystal-structure figures from CIF / POSCAR / .vesta files with a locally installed VESTA on Windows. Use when the user asks to draw a crystal structure, render a VESTA scene, export a structure image, convert CIF to PNG, or automate VESTA.
license: MIT
---

# vesta-render

## 这个技能做什么

把本机安装的 [VESTA](https://jp-minerals.org/vesta/en/) 变成一个可脚本调用的工具：打开结构文件、用 `-export_img` 渲染 PNG、按晶向/缩放/范围/背景覆盖 `.vesta` 场景、关闭进程。渲染结果是普通图片文件，不依赖 OCR 或屏幕抓取。

不捆绑 VESTA，不读取 VESTA 内存，不注入进程。**前提：VESTA 必须由用户自行安装**（本包不包含、不下载、不代替安装），并遵守其许可与引用要求。

## 环境

| 项 | 要求 |
| --- | --- |
| 系统 | **Windows**（调用 PowerShell 5.1 与 Win32 窗口接口；macOS / Linux 不支持） |
| VESTA | **3.90.6a 实测**（2026-03 构建）；**3.4.5 及更早版本未验证**，旧版可能缺少 `-export_img`，工具会明确报错。注意：`VESTA.ini` 里的 `3.4.5` 是文件格式常量，不是程序版本 |
| Node | **>= 22** |
| 依赖 | 无 npm 依赖；只用 Node 内置模块 |

## 安装

1. 解压本包到任意目录，例如 `C:\tools\vesta-render`；
2. 设置 VESTA 路径（二选一）：
   - 环境变量 `VESTA_EXE=C:\Program Files\VESTA-win64\VESTA.exe`；
   - 每次命令加 `--vesta "C:\Program Files\VESTA-win64\VESTA.exe"`。
3. 自检：

```bash
node scripts/doctor.mjs --strict
```

`doctor` 只检查 Node / 平台 / VESTA 路径 / 场景改写，不启动 VESTA。必需项失败时退出码为 1。

## 怎么用

```bash
# 安装状态 + 窗口
node scripts/vesta.mjs status

# 打开结构文件（单实例时转发到已有窗口）
node scripts/vesta.mjs open examples/fe_fcc_cell.cif

# 用命令行渲染 PNG
node scripts/vesta.mjs export examples/fe_fcc_cell.cif --out out/cell.png --scale 2

# 渲染 .vesta 场景，并临时覆盖视角 / 缩放 / 显示范围 / 背景
node scripts/vesta.mjs render my-scene.vesta --view 0,0,1 --zoom 0.9 --boundary 0,1,0,1,0,1 --background 20,24,32 --out out/view.png

# 把覆盖后的场景另存（之后再渲染，便于复现）
node scripts/vesta.mjs render my-scene.vesta --view 1,1,0 --save-scene out/my-scene-view110.vesta --out out/view110.png

# 关闭
node scripts/vesta.mjs close
```

输入：

- `CIF` / `POSCAR` / `.vesta` 结构文件；
- `.vesta` 覆盖参数：`view`（晶向 `[h,k,l]`）、`zoom`、`boundary`（6 个分数坐标）、`background`（RGB）。

输出：

- 成功：stdout 输出 JSON（`ok: true` + 路径、尺寸、字节数、窗口信息等），退出码 0；
- 失败：stderr 输出 `错误：…`，退出码 1。

示例产物（用本包 + VESTA 3.90.6a 实际渲染，1740×1352；PNG 在完整包 / GitHub 仓库可见，Agensi 文本版 zip 不含图片）：

| 输入 | 产物 |
| --- | --- |
| `examples/fe_fcc_cell.cif` | `examples/out-fe-cell.png` |
| `examples/fe_slab.vesta`（`view=[1,0,0]`、`zoom=0.8`） | `examples/out-fe-slab.png` |

复现命令见 `examples/README.md`。

## 失败怎么办

| 现象 | 处理 |
| --- | --- |
| `未配置 VESTA.exe 路径` | 设置 `VESTA_EXE` 或加 `--vesta`；路径要用 `.exe` 的绝对路径 |
| `找不到 VESTA.exe` | 检查路径与权限；VESTA 未安装时先从官网安装 |
| `VESTA 集成目前只支持 Windows` | 换 Windows 机器；本包不做跨平台移植 |
| `VESTA 在写出图片前退出` | 输入文件可能无法解析，或 VESTA 版本不支持 `-export_img`；先在 VESTA 里手工打开确认 |
| 等待超时 | 大结构/慢机器加 `--timeout 300000`；确认 VESTA 没有被弹窗挡住 |
| 渲染出的图是旧图/空图 | VESTA 是单实例：先 `close`，再单独渲染；确认输出路径可写 |
| 中文/空格路径 | 用引号包住路径；PowerShell 侧已用 `-EncodedCommand`，但仍需保证文件存在 |

## 边界

- 只做文件级控制 + 命令行渲染 + 窗口管理；**不读取 VESTA 内存**，不注入 DLL。
- VESTA 是单实例程序：已有窗口时，`open` / `render` 会把文件转发到该窗口，可能切换焦点；批量渲染前先 `close`。
- 多面体、空间填充、线框、逐元素半径/颜色、光照、标签没有程序化覆盖；需要时先在 VESTA 里调好并另存 `.vesta` 场景，再用 `view` / `zoom` / `boundary` / `background` 覆盖。
- 不读取 VESTA 内存，不注入 DLL，也不做屏幕抓取；渲染只走 VESTA 命令行与 `.vesta` 文件。
- 不捆绑 VESTA / 商业 SDK / 论文原图；示例只含自建结构的 CIF。

## 跨 agent 接入

本包的最小共同集是 `SKILL.md` + 一个 CLI。不同 agent 的目录约定不同，以各自官方格式为准：

- **Claude Code**：把 `vesta-render/` 放到 `.claude/skills/vesta-render/`，确认 `SKILL.md` 的 `name` 与目录名一致；
- **Cursor**：把 `SKILL.md` 作为规则/技能说明引用（或放进项目的 agent 指令目录），让 agent 通过终端调用 `node scripts/vesta.mjs`；
- **Copilot**：把 `SKILL.md` 内容并入仓库的 agent 指令文件（如 `.github/copilot-instructions.md`），入口仍是同一个 CLI；
- **其他 agent**：只要能执行 shell 命令并读取 `SKILL.md`，就可以用；不需要 DSH，不需要 session-bus。

## 许可 / 声明

- 代码：MIT（见 `LICENSE`；上游版权 dhd / dhd78）。
- 第三方：VESTA 不随包分发，见 `THIRD_PARTY_NOTICES.md`。
- AI 参与：见 `AI-DISCLOSURE.md`。
- 来源与重建：见 `SOURCE.md`。

## English

`vesta-render` is a Windows CLI skill that drives a locally installed [VESTA](https://jp-minerals.org/vesta/en/):
open CIF / POSCAR / `.vesta` files, render PNGs through `-export_img`,
override view / zoom / boundary / background on `.vesta` scenes, and close the process.

- Requirements: Windows, Node >= 22, VESTA 3.90.6a tested (not bundled; earlier versions untested; the `3.4.5` in `VESTA.ini` is a file-format constant, not the app version).
- Install: unzip anywhere, set `VESTA_EXE`, run `node scripts/doctor.mjs --strict`.
- Usage: `node scripts/vesta.mjs status|open|export|render|close` (JSON output, exit code 0/1).
- Boundaries: no OCR, no screen reading, no VESTA memory reading, no injection, no bundled VESTA; Windows-only.
- License: MIT; AI disclosure and third-party notices are included.
