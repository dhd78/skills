# vesta-render

把本机 [VESTA](https://jp-minerals.org/vesta/en/) 包装成跨 agent 可用的命令行技能：打开结构文件、渲染 PNG、覆盖 `.vesta` 场景的视角/缩放/范围/背景、关闭进程。

**English:** `vesta-render` is a Windows CLI skill that drives a locally installed VESTA:
open CIF / POSCAR / `.vesta` files, render PNGs through `-export_img`,
override view / zoom / boundary / background on `.vesta` scenes, and close the process.
No DSH dependency, no injection, no memory reading, no screen reading, no bundled VESTA.

- 入口：`node scripts/vesta.mjs <command>`
- 自检：`node scripts/doctor.mjs --strict`
- 平台：Windows（Windows 11 实测；Win10 未测）；Node >= 22；**VESTA 3.90.6a 实测**（3.4.5 及更早未验证；`VESTA.ini` 的 3.4.5 是格式常量）
- 无 npm 依赖、无 DSH 依赖、不注入、不读内存、不捆绑 VESTA

## 包内容

```text
vesta-render/
├─ SKILL.md                  # 技能说明（frontmatter: name / description / license；正文含 English 段）
├─ README.md                 # 本文件
├─ LICENSE                   # MIT（上游 dhd）
├─ THIRD_PARTY_NOTICES.md    # VESTA 与上游代码边界
├─ AI-DISCLOSURE.md          # AI 参与声明
├─ SOURCE.md                 # 来源、commit、版本对应、重建与验证记录
├─ SHA256SUMS.txt            # 包内文件校验和（不含本文件）
├─ scripts/
│  ├─ vesta.mjs              # CLI（本包新增）
│  └─ doctor.mjs             # 装机自检（本包新增）
├─ lib/                      # 上游 MIT 代码：vesta / scene / pwsh
├─ references/IMPLEMENTATION.md
├─ templates/template.vesta
└─ examples/                 # CIF / .vesta 输入 + 复现命令（PNG 仅在完整包 / GitHub）
```

发布形态（两个 zip，同一份源码）：

- `vesta-render-v0.1.1.zip`：完整包，含两张示例 PNG，用于 GitHub 仓库 / Release；
- `vesta-render-v0.1.1-agensi.zip`：**纯文本包**，去掉 PNG，符合 Agensi zip 扫描要求；效果图看 GitHub / Agensi 列表截图。

## 快速开始

```powershell
# 1. 解压到任意目录
# 2. 指定 VESTA（二选一）
$env:VESTA_EXE = 'C:\Program Files\VESTA-win64\VESTA.exe'

# 3. 自检（会检查 VESTA 版本与场景改写，不启动 VESTA）
node scripts\doctor.mjs --strict

# 4. 渲染
node scripts\vesta.mjs export examples\fe_fcc_cell.cif --out out\cell.png --scale 2
node scripts\vesta.mjs render examples\fe_slab.vesta --view 1,0,0 --zoom 0.8 --out out\slab.png
```

## 示例产物

| 输入 | 产物 | 说明 |
| --- | --- | --- |
| `examples/fe_fcc_cell.cif` | `examples/out-fe-cell.png` | FCC-Fe 单胞，`scale=2`，1740×1352 |
| `examples/fe_slab.vesta` | `examples/out-fe-slab.png` | FCC-Fe (111) 12 层滑移模型，`view=[1,0,0]`、`zoom=0.8` |

两张图都是本包 + VESTA 3.90.6a 实际渲染的产物，不使用论文原图。复现命令见 `examples/README.md`。**Agensi 文本版 zip 不含这两张 PNG**，效果图见 GitHub 仓库或 Agensi 列表截图。

## 验证状态（候选包 v0.1.2）

本目录是 **v0.1.3 候选**（相对 v0.1.2：技能包只保留 `status` / `open` / `export` / `render` / `close`；渲染只走 `export` / `render`；插件保留自己的窗口能力），未发布。已做：

- 结构自检、Node 语法、`doctor --strict`（真实 VESTA 3.90.6a）、CLI `--help` / `status`；
- 真实 CIF → PNG 渲染；真实 `.vesta` 渲染 + `view` / `zoom` / `boundary` / `background` 四项覆盖；
- 缺 VESTA / 假路径 / 未知命令的错误提示；路径含空格与中文；`open` → `close` 正常；
- 确定性 zip（两次 SHA 一致）、干净解压、包内 SHA 逐项核对、敏感信息 / 私有路径扫描；
- 00 独立回归（v0.1.1）：G1/G2 PASS，G3 PARTIAL —— **Cursor 3.29.9 真实实跑通过**（识别 skill、`doctor`、`export` 出 1740×1352 PNG）；**Claude Code 2.1.319 未验证**（需 Anthropic 账号，业主不付费）。

**未完成**：Claude Code 真实实跑；Windows 10 / macOS / Linux（本包只支持 Windows）。发布前须由 12 审许可 / AI 声明。

## 许可

MIT，见 `LICENSE`（`Copyright (c) 2026 dhd`；AI 参与写在 `AI-DISCLOSURE.md`，不进 LICENSE）。VESTA 不随本包分发，见 `THIRD_PARTY_NOTICES.md`。
