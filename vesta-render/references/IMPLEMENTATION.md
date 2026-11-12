# Implementation notes

## 1. Why this design

VESTA is a desktop GUI with no scripting API. Two facts make a cheap, robust route
work:

1. **VESTA ships a command line**: `VESTA.exe -open <input> -export_img scale=N <output>`
   writes a PNG without any UI interaction.
2. **`.vesta` scene files are plain text**, so view angle, display range, background
   and zoom can be generated programmatically.

The skill therefore does file-level control + command-line rendering + window
management. It never reads pixels to decide anything and never injects code.

## 2. Commands

| Command | Implementation |
| --- | --- |
| `status` | resolves `vestaPath` (config > `VESTA_EXE`), reads the real build from `VESTA.exe`, enumerates windows |
| `open` | `spawn VESTA.exe -open <file>`, then detect the window/title (single-instance forwarding) |
| `export` | `spawn VESTA.exe -open <in> -export_img scale=N <out>`, poll the output file until its size is stable twice, then clean up |
| `render` | patch a temporary `.vesta` copy (`view` / `zoom` / `boundary` / `background`), then export it |
| `close` | `WM_CLOSE`, then a forced kill if it does not exit |

Window enumeration is done in PowerShell (`EnumWindows` + `GetWindowThreadProcessId`),
returning JSON.

## 3. Rendering

- `-export_img scale=N` — `N` is a viewport multiplier, not a pixel size.
- Because VESTA is single-instance, a second launch forwards the file into the
  running window and exits; tool success must be judged by the window/title, not
  by the launcher's exit code.
- After rendering, the helper process is killed with `taskkill /T /F`.

## 4. Scene files

`.vesta` is plain text. Relevant sections:

- `SCENE` — the first three lines are a 3×3 camera basis (right, up, view direction)
  in Cartesian crystal coordinates. Identity means "look along c" (a → right, b → up).
- `BOUND` — fractional display range, e.g. `0 1 0 1 0 1` for one cell.
- `BKGRC` — background RGB.
- The trailing `0.458` in `SCENE` is the model zoom.

`lib/scene.js` converts a direction `[h,k,l]` plus cell parameters into an
orthonormal basis and rewrites those lines. All overrides are written to a
temporary copy; the original scene is never modified.

**Pitfall**: VESTA does not accept a BOM at the start of the scene file. Write
UTF-8 without BOM, or the render comes out blank.

## 5. Facts that cost time

| Symptom | Cause |
| --- | --- |
| `open` "fails" instantly | VESTA is single-instance; the launcher exits after forwarding |
| Blank rendered PNG | scene file saved with a UTF-8 BOM |
| New code not loaded after edit | restart the CLI process |

## 6. Examples

`examples/fe_fcc_cell.cif` and `examples/fe_slab.vesta` are self-built structures.
The full upstream examples build cells from lattice constants, write `.vesta`
scenes from `templates/template.vesta`, and render them with `view` / `zoom` /
`boundary`. Reference thesis figures are copyrighted and are not included.
