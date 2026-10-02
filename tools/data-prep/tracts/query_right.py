"""Query Allen connectivity paths to target points: left cortex (callosal) and right subcortical targets (descending)."""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import json, sys, time, urllib.request
import numpy as np
from voxelize import LO, RES

C = np.array([7829.74, 4296.03, 5694.50])
def to_ccf(p):  # model mm -> CCF um (AP, DV, ML)
    return [round(C[0] - p[0] * 1000), round(C[1] - p[1] * 1000), round(p[2] * 1000 + C[2])]

rng = np.random.default_rng(3)
cortex = np.load('mask_315.npy')
from scipy import ndimage
depth = ndimage.distance_transform_edt(np.load('mask_997.npy')) * RES
vox = np.argwhere(cortex & (depth > 0.35) & (depth < 0.8))
pts = vox * RES + LO + RES / 2
left = pts[(pts[:, 2] < -0.8) & (pts[:, 0] > -2.0) & (pts[:, 0] < 4.2)]
seeds = [('callosal', to_ccf(p)) for p in left[rng.choice(len(left), 26, replace=False)]]
right = pts[(pts[:, 2] > 0.8) & (pts[:, 0] > -2.0) & (pts[:, 0] < 4.2)]
seeds = [('callosal_r', to_ccf(p)) for p in right[rng.choice(len(right), 26, replace=False)]]
seeds += [] if True else [('descending', s) for s in ([5000, 3600, 7900], [5600, 3900, 7600], [7300, 3900, 6900], [7900, 4100, 7300],
                                       [9000, 1700, 6600], [9500, 6100, 6300], [8800, 5600, 6600], [6600, 4400, 7000])]
out = []
for kind, s in seeds:
    url = f"http://api.brain-map.org/api/v2/data/query.json?criteria=service::mouse_connectivity_target_spatial[seed_point$eq{s[0]},{s[1]},{s[2]}]"
    for attempt in range(3):
        try:
            d = json.load(urllib.request.urlopen(url, timeout=120))
            break
        except Exception as e:
            print('retry', s, e); time.sleep(3)
    msg = d.get('msg', []) if d.get('success') else []
    out.append({'kind': kind, 'seed': s, 'paths': [{'id': m['id'], 'line': m['transgenic-line'], 'structure': m['structure-abbrev'],
               'inj': m['injection-coordinates'], 'density': m.get('density'), 'path': [p['coord'] for p in m['path']]} for m in msg]})
    print(kind, s, len(msg), flush=True)
json.dump(out, open('paths_right.json', 'w'))
