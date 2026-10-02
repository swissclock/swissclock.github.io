"""Build public/data/vessels.bin from the registered VesSAP graph. See src/scene/vessels.js for layout."""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import sys
import numpy as np
from scipy import ndimage, sparse
from scipy.sparse import csgraph
from voxelize import LO, RES

exec(open(__import__('pathlib').Path(__file__).with_name('register.py')).read().split('best = None')[0])  # transform(), masks
reg = np.load('registration.npy')
perm = tuple(int(v) for v in reg[:3]); sign = reg[3:6]; x = reg[6:]

BIG = float(sys.argv[1]) if len(sys.argv) > 1 else 98.0       # radius percentile kept whole
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 110000        # capillary segments sampled
WALL = float(sys.argv[3]) if len(sys.argv) > 3 else 99.6       # percentile drawn with points too
NEURONS = int(sys.argv[5]) if len(sys.argv) > 5 else 4500
S1_NEURONS = 2500
OUT = sys.argv[4] if len(sys.argv) > 4 else str(paths.OUT / 'vessels.bin')

rng = np.random.default_rng(7)
edges = np.load('edges.npy')
P = (p[:, perm] * sign - (sub[:, perm] * sign).mean(0))
cx, cy, cz = np.cos(x[6:9]); sx, sy, sz = np.sin(x[6:9])
Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
P = (P * x[:3]) @ (Rz @ Ry @ Rx).T + acen + x[3:6]


def lookup(mask, q):
    g = np.floor((q - LO) / RES).astype(int)
    ok = np.all((g >= 0) & (g < mask.shape), 1)
    out = np.zeros(len(q), mask.dtype)
    out[ok] = mask[tuple(g[ok].T)]
    return out


root_d = ndimage.binary_dilation(root, iterations=2)
depth = ndimage.distance_transform_edt(root) * RES  # mm below the surface
cortex = np.load('mask_315.npy')
s1 = np.load('mask_329.npy')

a, b = edges[:, 0].astype(int), edges[:, 1].astype(int)
radius = edges[:, 3] * 3.0  # um
inside = lookup(root_d, P[a]) & lookup(root_d, P[b])
seg = np.linalg.norm(P[a] - P[b], axis=1)
keep = inside & (seg < 0.35)  # drop stitching artefacts
print('edges', len(edges), 'inside', keep.sum())

# Graph distance from the right barrel field, along the vessels.
src_nodes = np.where(lookup(s1, P) & (P[:, 2] > 0))[0]
g = sparse.coo_matrix((seg[keep], (a[keep], b[keep])), shape=(len(P), len(P))).tocsr()
dist = csgraph.dijkstra(g, directed=False, indices=src_nodes[::25], min_only=True, limit=12.7)
dist[~np.isfinite(dist)] = 12.75
print('graph dist pct', np.percentile(dist[dist < 12.7], [10, 50, 90]).round(2))

r_lo, r_hi = np.percentile(radius, [10, 99.9])
big_cut = np.percentile(radius, BIG)
wall_cut = np.percentile(radius, WALL)
idx = np.where(keep)[0]
big = idx[radius[idx] >= big_cut]
small = idx[radius[idx] < big_cut]
cap = rng.choice(small, min(CAP, len(small)), replace=False)
line_edges = np.r_[big, cap]
print('big', len(big), 'cap', len(cap))


def info(q, r, gd):
    r01 = np.clip((np.log(np.maximum(r, r_lo)) - np.log(r_lo)) / (np.log(r_hi) - np.log(r_lo)), 0, 1)
    return np.stack([
        (r01 * 255).round(),
        (np.clip(gd, 0, 12.75) / 0.05).round(),
        lookup(cortex, q) * 255,
        (np.clip(lookup(depth, q), 0, 2.55) * 100).round()
    ], 1).astype(np.uint8)


lv = np.empty((len(line_edges) * 2, 3)); lv[0::2] = P[a[line_edges]]; lv[1::2] = P[b[line_edges]]
lr = np.repeat(radius[line_edges], 2)
lg = np.empty(len(lv)); lg[0::2] = dist[a[line_edges]]; lg[1::2] = dist[b[line_edges]]
linfo = info(lv, lr, lg)

# Points along the largest vessels, every 20 um, so they read with a body.
wall = idx[radius[idx] >= wall_cut]
pv, pr, pg = [], [], []
for e in wall:
    A, B = P[a[e]], P[b[e]]
    n = max(1, int(np.linalg.norm(B - A) / 0.02))
    t = (np.arange(n) + rng.random(n)) / n
    pv.append(A + (B - A) * t[:, None]); pr.append(np.full(n, radius[e])); pg.append(dist[a[e]] + (dist[b[e]] - dist[a[e]]) * t)
pv = np.concatenate(pv); pinfo = info(pv, np.concatenate(pr), np.concatenate(pg))
print('wall points', len(pv))

# Neurons: within 15 um of capillaries, in isocortex.
capn = np.unique(a[small[lookup(cortex, P[a[small]]) > 0]])
S1C = np.array([1.09, 2.55, 3.32])
near_s1 = capn[np.linalg.norm(P[capn] - S1C, axis=1) < 1.7]
pick = np.r_[rng.choice(capn, NEURONS, replace=False), rng.choice(near_s1, S1_NEURONS, replace=False)]
nv = P[pick] + rng.normal(0, 0.012, (len(pick), 3))

def morton(q):
    q = (np.floor((q + 16) / 0.4)).astype(np.int64)
    out = np.zeros(len(q), np.int64)
    for bit in range(10):
        for k in range(3):
            out |= ((q[:, k] >> bit) & 1) << (3 * bit + k)
    return out


# Spatial order compresses far better than graph order.
o = np.argsort(morton((lv[0::2] + lv[1::2]) / 2))
lv = lv.reshape(-1, 2, 3)[o].reshape(-1, 3); linfo = linfo.reshape(-1, 2, 4)[o].reshape(-1, 4)
o = np.argsort(morton(pv)); pv = pv[o]; pinfo = pinfo[o]
o = np.argsort(morton(nv)); nv = nv[o]

QUANT = 80  # units per mm: 12.5 um, under a pixel at every framing
allv = np.concatenate([lv, pv, nv])
q = np.clip(np.round(allv * QUANT), -32768, 32767).astype('<i2').T.copy()  # planar x, y, z
planes = q.view(np.uint8).reshape(3, -1, 2)
inf = np.concatenate([linfo, pinfo]).astype(np.int32)
# byte A: radius (4 bits) | depth (4 bits, 0.16 mm steps to 2.4 mm)
# byte B: graph distance (7 bits, 0.1 mm steps to 12.7 mm) | cortex (1 bit)
radius4 = np.round(inf[:, 0] / 255 * 15)
depth4 = np.round(np.clip(inf[:, 3] / 100, 0, 2.4) / 0.16)
graph7 = np.round(np.clip(inf[:, 1] * 0.05, 0, 12.7) / 0.1)
a_byte = (radius4.astype(np.uint8) << 4) | depth4.astype(np.uint8)
b_byte = graph7.astype(np.uint8) | ((inf[:, 2] > 127).astype(np.uint8) << 7)
with open(OUT, 'wb') as f:
    f.write(np.array([len(lv), len(pv), len(nv), QUANT], '<u4').tobytes())
    f.write(planes[:, :, 1].tobytes())  # high bytes, x y z
    f.write(planes[:, :, 0].tobytes())  # low bytes, x y z
    f.write(a_byte.tobytes())
    f.write(b_byte.tobytes())
import os, zlib
raw = open(OUT, 'rb').read()
print('wrote', OUT, len(raw) / 1e6, 'MB raw', len(zlib.compress(raw, 9)) / 1e6, 'MB gz', 'verts', len(allv))
