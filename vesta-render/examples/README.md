# 示例

三个自建结构的输入，加两张实际渲染产物。原论文图不随包分发；完整示例与生成脚本留在上游 `many-crafts/vesta-bridge/examples/`。

## 输入

| 文件 | 结构 | 上游来源 |
| --- | --- | --- |
| `fe_fcc_cell.cif` | FCC-Fe 单胞 | `examples/fe-figure/fe_fcc_cell.cif` |
| `fe_slab.vesta` | FCC-Fe (111) 12 层滑移模型（VESTA 场景） | `examples/fe-figure/fe_slab.vesta` |
| `fe47x_surface.cif` | Fe47X1 表面模型 | `examples/liang-figure/fe47x_surface.cif` |

## 产物（VESTA 3.90.6a 实际渲染）

| 图 | 复现命令 |
| --- | --- |
| `out-fe-cell.png` | `node scripts\vesta.mjs export examples\fe_fcc_cell.cif --out examples\out-fe-cell.png --scale 2` |
| `out-fe-slab.png` | `node scripts\vesta.mjs render examples\fe_slab.vesta --view 1,0,0 --zoom 0.8 --out examples\out-fe-slab.png` |

两张图均为 1740×1352，2026-11-09 用本包 + VESTA 3.90.6a 渲染，不是论文原图。**图片在完整包 / GitHub 仓库可见；Agensi 文本版 zip 只带 CIF / `.vesta` 输入与文字说明，不含 PNG。** 需要本机已安装 VESTA 并设置 `VESTA_EXE`；没有 VESTA 时 CLI 会返回明确错误，不会静默失败。

## 复现

```powershell
$env:VESTA_EXE = 'C:\Program Files\VESTA-win64\VESTA.exe'
node scripts\doctor.mjs --strict

# CIF → PNG
node scripts\vesta.mjs export examples\fe_fcc_cell.cif --out examples\out-fe-cell.png --scale 2

# .vesta 场景 + 视角/缩放覆盖
node scripts\vesta.mjs render examples\fe_slab.vesta --view 1,0,0 --zoom 0.8 --out examples\out-fe-slab.png
```

更完整的复现（`generate.py` 生成 `.vesta` 场景、批量渲染、拼图）见上游：

- <https://github.com/dhd78/many-crafts/tree/main/vesta-bridge/examples>
