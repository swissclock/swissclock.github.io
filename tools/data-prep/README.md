# Data prep

How the files in `public/data/` beyond the Allen shell were made. Every script
imports `paths.py`, which runs it inside `work/` (git-ignored: downloads and
intermediates) and writes the site's files straight into `public/data/`.
Each pipeline below reproduces the shipped file byte for byte.

Python 3 with numpy, scipy and pandas. The two sibling projects are read, never
written; set `NEXTPREDICTOR` / `LOTTERY` if they are not in `~/Dev/`.

## Allen meshes and masks (shared)

Download structure meshes into `work/` from
`https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/annotation/ccf_2017/structure_meshes/<id>.obj`
(997 root, 315 isocortex, 329 barrel field, 776 corpus callosum, 81 lateral
ventricle), then voxelise them into 50 µm masks in the model frame:

    python3 -c "import sys; sys.path.insert(0, 'tools/data-prep'); import paths, numpy as np; from voxelize import voxelize; [np.save(f'mask_{i}.npy', voxelize(f'{i}.obj')) for i in ('997', '315', '329', '776', '81')]"

Allen CCF µm (AP, DV, ML) to model mm is `((7829.74 - AP), (4296.03 - DV), (ML - 5694.50)) / 1000`.

## vessels.bin (Research)

VesSAP whole-brain vessel graph (Todorov et al. 2020) via VesselGraph
(Paetzold et al. 2021), CC BY-NC 4.0. Download `C57BL_6_no1_raw.zip` (349 MB)
from the VesselGraph README into `work/` and unzip; the server allows byte
ranges, so parallel `curl -r` chunks are much faster than one stream.

    python3 tools/data-prep/vessels/load_graph.py     # CSV -> nodes.npy, edges.npy
    python3 tools/data-prep/vessels/register.py       # fit onto the Allen root mask -> registration.npy
    python3 tools/data-prep/vessels/prep.py 98.7 45000 99.75

## fun.json (For fun)

Lotto: every draw of the current 6-of-37 format, from the Lottery project's
database (read-only):

    sqlite3 -readonly -csv "$LOTTERY/data/lotto.db" "select d.seq, d.draw_date, e.pool, d.n1,d.n2,d.n3,d.n4,d.n5,d.n6, d.draw_id from draws d join eras e on e.key=d.era order by d.seq" > tools/data-prep/work/draws.csv

Football: NextPredictor's published season simulations (`web/public/data/league/`).
`football.py` re-runs its out-of-sample walk read-only with the saved
parameters (about five minutes) for the per-match file only the Scorelines
alternative needs; the shipped Seasons view does not. Run both with
NextPredictor's own environment:

    "$NEXTPREDICTOR/.venv/bin/python" tools/data-prep/fun/football.py
    "$NEXTPREDICTOR/.venv/bin/python" tools/data-prep/fun/pack_fun.py

## tracts.bin (Connect)

Allen Mouse Brain Connectivity Atlas paths from the API service
`service::mouse_connectivity_target_spatial[seed_point$eqAP,DV,ML]`, which
returns every experiment whose tracer reaches the point, each with its path
back to the injection site. Needs the masks above.

    python3 tools/data-prep/tracts/query.py         # left-cortex and subcortical targets -> paths.json
    python3 tools/data-prep/tracts/query_right.py   # right-cortex targets -> paths_right.json
    python3 tools/data-prep/tracts/build.py         # callosal / descending -> callosal.npy, descending.npy
    python3 tools/data-prep/tracts/pack.py
