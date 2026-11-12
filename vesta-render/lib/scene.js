/**
 * .vesta 场景文件的最小编辑层。
 *
 * 只做三件有确定语义的事：
 *   - SCENE 的 3×3 相机基（行向量 = 右、上、视线方向，晶胞笛卡尔坐标）；
 *   - BOUND 的显示范围（分数坐标，每个轴一对 min/max）；
 *   - BKGRC 背景色、SCENE 末尾的缩放因子。
 *
 * 其余内容原样保留。写回时保持原文件的换行风格，且不写 BOM（VESTA 不认带 BOM 的文件头）。
 */

export class SceneError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SceneError';
  }
}

/** 从场景文本里读取 CELLP 晶胞参数。 */
export function parseCell(text) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim() === 'CELLP');
  if (index < 0 || index + 1 >= lines.length) return undefined;
  const values = lines[index + 1].trim().split(/\s+/).map(Number);
  if (values.length < 6 || values.some((value) => !Number.isFinite(value))) return undefined;
  return {
    a: values[0],
    b: values[1],
    c: values[2],
    alpha: values[3],
    beta: values[4],
    gamma: values[5],
  };
}

/** 晶胞参数 → 笛卡尔基矢（a 沿 x，b 在 xy 平面内）。 */
export function cellToCartesian(cell) {
  const rad = Math.PI / 180;
  const alpha = cell.alpha * rad;
  const beta = cell.beta * rad;
  const gamma = cell.gamma * rad;
  const ca = Math.cos(alpha);
  const cb = Math.cos(beta);
  const cg = Math.cos(gamma);
  const sg = Math.sin(gamma);

  const av = [cell.a, 0, 0];
  const bv = [cell.b * cg, cell.b * sg, 0];
  const cx = cell.c * cb;
  const cy = cell.c * (ca - cb * cg) / sg;
  const cz = cell.c * Math.sqrt(Math.max(0, 1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg)) / sg;
  const cv = [cx, cy, cz];
  return { av, bv, cv };
}

const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

function cross(u, v) {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!Number.isFinite(length) || length === 0) throw new SceneError('方向向量长度为 0。');
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * 把晶向 [h,k,l] 换算成 SCENE 的三行相机基。
 * 约定：c 轴尽量朝上（与视线平行时改用 b 轴），与 VESTA 默认观感一致。
 */
export function directionMatrix(hkl, cell) {
  if (!Array.isArray(hkl) || hkl.length !== 3 || hkl.some((value) => !Number.isFinite(value))) {
    throw new SceneError('view 需要三个数字，例如 [1,0,0]。');
  }
  const { av, bv, cv } = cellToCartesian(cell);
  const view = normalize([
    av[0] * hkl[0] + bv[0] * hkl[1] + cv[0] * hkl[2],
    av[1] * hkl[0] + bv[1] * hkl[1] + cv[1] * hkl[2],
    av[2] * hkl[0] + bv[2] * hkl[1] + cv[2] * hkl[2],
  ]);

  let reference = normalize(cv);
  if (Math.abs(dot(reference, view)) > 0.999) reference = normalize(bv);
  if (Math.abs(dot(reference, view)) > 0.999) reference = normalize(av);

  const right = normalize(cross(reference, view));
  const up = cross(view, right);
  return [right, up, view];
}

function formatMatrixRow(row) {
  return ` ${row.map((value) => value.toFixed(6)).join('  ')}  0.000000`;
}

/**
 * 按覆盖参数改写场景文本。
 *
 * @param {string} text 原场景文本。
 * @param {{ direction?: number[], zoom?: number, boundary?: number[], background?: number[] }} overrides
 * @returns {{ text: string, applied: string[] }}
 */
export function patchScene(text, overrides = {}) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const applied = [];

  const find = (name) => lines.findIndex((line) => line.trim() === name);

  if (overrides.direction !== undefined) {
    const cell = parseCell(text);
    if (cell === undefined) throw new SceneError('场景缺少 CELLP 晶胞参数，无法按晶向设置视角。');
    const sceneIndex = find('SCENE');
    if (sceneIndex < 0) throw new SceneError('场景缺少 SCENE 段，无法设置视角。');
    if (sceneIndex + 3 >= lines.length) throw new SceneError('SCENE 段不完整。');
    const rows = directionMatrix(overrides.direction, cell);
    for (let row = 0; row < 3; row += 1) {
      lines[sceneIndex + 1 + row] = formatMatrixRow(rows[row]);
    }
    applied.push(`view=[${overrides.direction.join(',')}]`);
  }

  if (overrides.zoom !== undefined) {
    const zoom = Number(overrides.zoom);
    if (!Number.isFinite(zoom) || zoom <= 0) throw new SceneError('zoom 必须是正数。');
    const sceneIndex = find('SCENE');
    if (sceneIndex < 0) throw new SceneError('场景缺少 SCENE 段，无法设置缩放。');
    const zoomIndex = sceneIndex + 7;
    if (zoomIndex >= lines.length) throw new SceneError('SCENE 段缺少缩放值。');
    lines[zoomIndex] = `   ${zoom.toFixed(3)}`;
    applied.push(`zoom=${zoom}`);
  }

  if (overrides.boundary !== undefined) {
    const boundary = overrides.boundary;
    if (!Array.isArray(boundary) || boundary.length !== 6 || boundary.some((value) => !Number.isFinite(Number(value)))) {
      throw new SceneError('boundary 需要 6 个数字：[aMin,aMax,bMin,bMax,cMin,cMax]。');
    }
    const boundIndex = find('BOUND');
    if (boundIndex < 0 || boundIndex + 1 >= lines.length) throw new SceneError('场景缺少 BOUND 段，无法设置显示范围。');
    lines[boundIndex + 1] = `${boundary.map((value) => Number(value)).join(' ')} `;
    applied.push(`boundary=[${boundary.join(',')}]`);
  }

  if (overrides.background !== undefined) {
    const background = overrides.background.map(Number);
    if (background.length !== 3 || background.some((value) => !Number.isFinite(value) || value < 0 || value > 255)) {
      throw new SceneError('background 需要 3 个 0-255 的整数：[r,g,b]。');
    }
    const bgIndex = find('BKGRC');
    if (bgIndex < 0 || bgIndex + 1 >= lines.length) throw new SceneError('场景缺少 BKGRC 段，无法设置背景色。');
    lines[bgIndex + 1] = ` ${background.map((value) => Math.round(value)).join(' ')}`;
    applied.push(`background=[${background.join(',')}]`);
  }

  return { text: lines.join(newline), applied };
}
