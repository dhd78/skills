# 来源与重建

## 上游

| 项 | 值 |
| --- | --- |
| 仓库 | <https://github.com/dhd78/many-crafts> |
| commit | `d2934c39dddf8d0d7410528efac57367911c48d0`（2026-11-09 12:38:31 +08:00，`release: rename to many-crafts; copyright dhd only`） |
| 上游目录 | `many-crafts/vesta-bridge/` |
| 上游版本 | `package.json` version `0.1.0` |
| 上游许可 | MIT，Copyright (c) 2026 dhd (<https://github.com/dhd78>) |
| 本包版本 | `0.1.3` |

## 与上游的关系 / 版本对应

`vesta-render` **不是 fork**，也不是上游插件的替换：它是 `many-crafts/vesta-bridge` 的 **CLI 化包装**——复用上游 `lib/` 的 VESTA 进程/场景逻辑，外面加一层不依赖 DSH 的命令行入口与自检。上游 `index.js`（DSH 插件入口）、`cordis.patch.yml`、`package.json` 不进入本包。

| 上游 `vesta-bridge` | 本包 `vesta-render` | 说明 |
| --- | --- | --- |
| `0.1.0` | `0.1.0` | 首个 CLI 候选；同一 `0.1.x` 线，避免用户困惑 |
| `0.1.0` | `0.1.1` | 按 12 的 Agensi 规范调整：英文优先 description、显式 VESTA 前提、署名行、纯文本发布包；**代码未改** |
| `0.1.0` | `0.1.2` | 换用上游修复版 `lib/vesta.js`（从 exe 读构建号）；VESTA 版本更正为 3.90.6a；Cursor 实测记录；LICENSE 仍只写 dhd |
| `0.1.0` | `0.1.3` | 技能包移除窗口抓取命令（插件保留）；CLI 面只剩 `status / open / export / render / close`；其余代码与文档不变 |
| `0.1.x`（非破坏） | `0.1.x`（跟随） | 上游只改 `lib/` 内部时，本包重新复制并重算 SHA；打包层修订用本包 patch |
| `0.2.0+`（破坏性） | `0.2.0+` | 需要重新对齐 CLI 参数与文档，另开版本，不覆盖旧包 |

当前对应关系：**上游 `vesta-bridge` 0.1.0 ↔ 本包 `vesta-render` 0.1.3**（2026-11-09）。

## 本包做了什么

从上游 **只读取**，按 MIT 许可复制以下文件，未改内容：

| 本包路径 | 上游路径 |
| --- | --- |
| `lib/vesta.js` | `vesta-bridge/lib/vesta.js` |
| `lib/scene.js` | `vesta-bridge/lib/scene.js` |
| `lib/pwsh.js` | `vesta-bridge/lib/pwsh.js` |
| `references/IMPLEMENTATION.md` | `vesta-bridge/docs/IMPLEMENTATION.md` |
| `templates/template.vesta` | `vesta-bridge/templates/template.vesta` |
| `LICENSE` | `vesta-bridge/LICENSE` |
| `examples/fe_fcc_cell.cif` | `vesta-bridge/examples/fe-figure/fe_fcc_cell.cif` |
| `examples/fe47x_surface.cif` | `vesta-bridge/examples/liang-figure/fe47x_surface.cif` |
| `examples/fe_slab.vesta` | `vesta-bridge/examples/fe-figure/fe_slab.vesta` |

新增（打包层，不在上游仓库内）：

- `SKILL.md`、`README.md`、`SOURCE.md`、`THIRD_PARTY_NOTICES.md`、`AI-DISCLOSURE.md`；
- `scripts/vesta.mjs`：CLI，只做参数解析 / JSON 输出 / 退出码，渲染逻辑全部调用上游 `lib/vesta.js`；
- `scripts/doctor.mjs`：装机自检，只调用 `lib/vesta.js` 的路径/版本读取与 `lib/scene.js` 的场景改写；
- `examples/README.md`；
- `examples/out-fe-cell.png`、`examples/out-fe-slab.png`：本包 + VESTA 3.90.6a 实际渲染产物（2026-11-09），不是上游 PNG，也不是论文原图。

未复制上游的 `generate.py`、`compose.py`、示例 PNG、`locale/`、`cordis.patch.yml`、`index.js`、`package.json`：本包是通用技能，不是 DSH 插件；生成脚本与更多示例留在上游。

## 重建

1. 取上游 commit `d2934c3` 的 `vesta-bridge/`；
2. 按上表复制文件；
3. 放入本包的 `SKILL.md` / `scripts/` / 说明文件；
4. 用 `make_package.py`（本次审计目录）生成 `SHA256SUMS.txt` 与确定性 zip；
5. 按 `examples/README.md` 的命令重新渲染示例图（需要 VESTA 3.90.6a；3.4.5 及更早未验证）。

## 打包环境

| 项 | 值 |
| --- | --- |
| 系统 | Windows 11 家庭版中文版，10.0.26200 |
| Node | v24.21.0（DSH 运行时自带） |
| Python | 3.12.14（仅用于确定性 zip，不进包） |
| PowerShell | 5.1.26100.7920 |
| VESTA | **3.90.6a**（用户已安装；`VESTA.ini` 的 3.4.5 是格式常量，不是程序版本；路径不写入包） |
| 时区 | Asia/Shanghai |

## 发布形态与校验和

- 完整包：`vesta-render-v0.1.1.zip`（含示例 PNG，用于 GitHub / Release）；
- Agensi 文本版：`vesta-render-v0.1.1-agensi.zip`（去掉 `examples/out-*.png`，只带文本 / CIF / `.vesta`；符合 Agensi zip 扫描第 7 项）；
- 两个包都是单顶层 `vesta-render/`、无符号链接；包内 `SHA256SUMS.txt` 分别按各自文件集生成；
- zip 条目按名称排序、固定时间戳（`1980-01-01 00:00:00`）、deflate 9、无 `__pycache__` / `.git` / `node_modules`；zip 旁 `.zip.sha256` 记录各自 SHA-256。

## 验证记录（v0.1.3 候选）

| 项 | 结果 |
| --- | --- |
| `doctor --strict`（真实 VESTA 3.90.6a） | 通过；0 warn；`doctor` 优先读 exe 构建号，ini 3.4.5 只作格式显示 |
| CIF → PNG | 通过：`examples/fe_fcc_cell.cif` → 1740×1352、203,171 字节、约 3 秒 |
| `.vesta` + 四项覆盖 | 通过：`view` / `zoom` / `boundary` / `background` 全部 applied |
| 确定性 zip | 连续两次打包 SHA 一致 |
| 干净解压 | 含空格 + 中文路径，包内 SHA 逐项匹配 |
| 敏感信息 / 私有路径 | 无命中 |
| 00 独立回归（v0.1.1） | G1/G2 PASS；G3 PARTIAL：**Cursor 3.29.9 实跑通过**；Claude Code 2.1.319 未验证（需 Anthropic 账号，业主不付费） |
| 真实 agent（v0.1.2） | **Cursor 3.29.9 已在 v0.1.2 上实跑通过**；**Claude Code 仍未验证**；v0.1.3 只删窗口抓取命令，待 00 快速补测 |
| LICENSE | 只写 `Copyright (c) 2026 dhd`（业主 2026-11-09 决定）；AI 参与仍写在 `AI-DISCLOSURE.md` |

完整命令与输出见本次打包的本地审计记录（不随包分发）。

## 发布记录

| 渠道 | 状态 | 地址 / 值 |
| --- | --- | --- |
| GitHub（源码，完整包） | 已发布 | <https://github.com/dhd78/many-crafts/tree/main/vesta-render> |
| Agensi（免费条目，文本包） | **已上架**（2026-11-09，审核通过） | <https://www.agensi.io/skills/vesta-render> |
| 完整包 SHA-256 | `vesta-render-v0.1.3.zip` | `0E30589CEBCD62FAF2D1FD59913E6E41E3313E398202C12C889E1F17FFA7A6FB` |
| Agensi 包 SHA-256 | `vesta-render-v0.1.3-agensi.zip` | `31126970FA30E563B9DBDBDBC496F248D8EBA4A402610E71DB824A373DC5EE77` |

上架页面显示：Security scanned 通过、Free、分类 Research & Analysis、标签含 vesta / crystallography / materials-science / cif。