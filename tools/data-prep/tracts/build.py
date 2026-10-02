import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import json, sys
import numpy as np
from voxelize import LO, RES
C = np.array([7829.74, 4296.03, 5694.50])
def model(c):
    c = np.asarray(c, float)
    return np.stack([C[0] - c[..., 0], C[1] - c[..., 1], c[..., 2] - C[2]], -1) / 1000
cortex = np.load('mask_315.npy')
def in_cortex(p):
    g = np.floor((p - LO) / RES).astype(int)
    return bool(np.all((g >= 0) & (g < cortex.shape)) and cortex[tuple(g)])

data = json.load(open('paths.json')) + json.load(open('paths_right.json'))
keep = {'callosal': [], 'descending': []}
seen = set()
for q in data:
    for m in q['paths']:
        pts = model(m['path'])[::-1]          # injection first
        if len(pts) < 8: continue
        inj = model(m['inj'])
        side = -1 if q['kind'] == 'callosal_r' else 1       # which hemisphere the injection must be in
        if not in_cortex(inj) or inj[2] * side < 0.4: continue
        key = (m['id'], tuple(q['seed']))
        if key in seen: continue
        seen.add(key)
        if q['kind'] in ('callosal', 'callosal_r'):
            if (pts[:, 2] * side).min() > -0.3: continue  # must reach the other hemisphere
            keep['callosal'].append(pts)
        else:
            if pts[:, 1].min() > 1.0 and q['seed'][1] < 2000: pass
            keep['descending'].append(pts)
for k, v in keep.items():
    lens = [len(p) for p in v]
    print(k, len(v), 'paths', sum(lens), 'points')
# where callosal paths cross the midline (AP, model x)
cross = []
for p in keep['callosal']:
    i = np.where(np.diff(np.sign(p[:, 2])) != 0)[0]
    if len(i): cross.append(p[i[0]])
cross = np.array(cross)
print('midline crossing x pct', np.percentile(cross[:, 0], [10, 50, 90]).round(2), 'y', np.percentile(cross[:, 1], [10, 50, 90]).round(2))
np.save('callosal.npy', np.array(keep['callosal'], dtype=object), allow_pickle=True)
np.save('descending.npy', np.array(keep['descending'], dtype=object), allow_pickle=True)
