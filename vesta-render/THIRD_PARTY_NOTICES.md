# Third-party notices

## VESTA

- Product: VESTA (Visualization for Electronic and Structural Analysis), **3.90.6a tested**
- Authors: Koichi Momma and Fujio Izumi
- Site: <https://jp-minerals.org/vesta/en/>
- License: VESTA's own license (free of charge; citation requested by the authors)
- Note: `VESTA.ini` may contain `3.4.5`; that is a file-format constant, not the application
  version. 3.4.5 and earlier are untested.

VESTA is **not** bundled with this package. The scripts only launch an installed
`VESTA.exe` and read its output files. Install VESTA yourself and follow its
license and citation guidance.

## Upstream code

- Project: `many-crafts` / `vesta-bridge`
- Source: <https://github.com/dhd78/many-crafts>
- Commit: `d2934c39dddf8d0d7410528efac57367911c48d0`
- License: MIT, Copyright (c) 2026 dhd (<https://github.com/dhd78>)
- Files reused: `lib/vesta.js`, `lib/scene.js`, `lib/pwsh.js`,
  `docs/IMPLEMENTATION.md`, `templates/template.vesta`, `LICENSE`

The CLI (`scripts/vesta.mjs`) and doctor (`scripts/doctor.mjs`) are new files
contributed by this packaging candidate under the same MIT license.

## Examples / data

No third-party structures, figures or datasets are redistributed here. The
example inputs (`examples/*.cif`, `examples/fe_slab.vesta`) are built from lattice
constants by the upstream `examples/*/generate.py` scripts; the original paper
figures are copyrighted and are not included.

`examples/out-fe-cell.png` and `examples/out-fe-slab.png` were rendered on
2026-11-09 by the packaging candidate using VESTA 3.90.6a and the same inputs. They
are project output, not paper figures. The VESTA renderer itself is not bundled;
see above.

## Node.js

Node.js is a runtime requirement, not bundled. It is licensed under the Node.js
license (MIT plus third-party notices); install it separately.
