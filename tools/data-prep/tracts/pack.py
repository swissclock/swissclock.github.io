"""public/data/tracts.bin: Allen connectivity paths (callosal + descending) and a coronal section outline.

Layout: Uint32 [paths, points, outline, units per mm], Uint16 [length, kind] per path (kind 2 callosal through the callosum near the section, 1 other callosal, 0 descending),
Int16 xyz per path point (paths back to back, injection first), Int16 xyz per outline point, Uint8 kind per outline
point (0 brain, 1 corpus callosum, 2 lateral ventricle).
"""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
OUT_DIR = paths.OUT  # captured now: `paths` is reused below for the tract list
import sys, struct, zlib
import numpy as np
from scipy import ndimage
from voxelize import LO, RES

rng = np.random.default_rng(11)
def smooth(p):
    k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
    q = np.stack([np.convolve(np.pad(p[:, i], 2, mode='edge'), k, 'valid') for i in range(3)], 1)
    q[0], q[-1] = p[0], p[-1]
    return q[::2] if len(q) > 20 else q
SLICE = 1.93  # model x (AP 5.9 mm), where the callosal paths cross the midline
def pieces(p):
    # Path finding hops across a gap now and then, mostly where a path meets its
    # end points: cut there and keep the runs long enough to read as a tract.
    cut = np.where(np.linalg.norm(np.diff(p, axis=0), axis=1) > 0.25)[0] + 1
    return [q for q in np.split(p, cut) if len(q) >= 8]
def through_callosum(p):
    i = np.where(np.diff(np.sign(p[:, 2])) != 0)[0]
    if not len(i): return False
    c = p[i[0]]
    return abs(c[0] - SLICE) < 1.6 and 1.2 < c[1] < 2.9   # anywhere along the callosal body near the section
call = [q for p in np.load('callosal.npy', allow_pickle=True) for q in pieces(p)]
desc = [q for p in np.load('descending.npy', allow_pickle=True) for q in pieces(p)]
near = [p for p in call if through_callosum(p)]
far = [p for p in call if not through_callosum(p)]
print('clean callosal', len(call), 'through the callosum near the slice', len(near), 'descending', len(desc))
pick = lambda a, n: [a[i] for i in rng.choice(len(a), min(n, len(a)), replace=False)]
# kind 2: crosses in the callosum near the section (the coronal view's paths), 1: other callosal, 0: descending
# Equal numbers each way across the midline, so the arch is not lopsided by
# which hemisphere happened to get more injections.
fromright = [p for p in near if p[0][2] > 0]; fromleft = [p for p in near if p[0][2] < 0]
n = min(len(fromright), len(fromleft), 200)
print('near from right', len(fromright), 'from left', len(fromleft), 'kept each', n)
paths = [(smooth(p), 1) for p in pick(fromright, n) + pick(fromleft, n)] + [(smooth(p), 1) for p in pick(far, 260)] + [(smooth(p), 0) for p in pick(desc, 560)]
ix = int(round((SLICE - LO[0]) / RES - 0.5))
outline = []
for kind, f in [(0, '997'), (1, '776'), (2, '81')]:
    for dx in (-1, 0, 1):
        m = np.load(f'mask_{f}.npy')[ix + dx]
        edge = m & ~ndimage.binary_erosion(m)
        yz = np.argwhere(edge) * RES + LO[1:] + RES / 2
        for y, z in yz:
            outline.append((SLICE + dx * RES, y + (rng.random() - 0.5) * RES, z + (rng.random() - 0.5) * RES, kind))
outline = np.zeros((0, 4))  # the map view needs no section outline (pack_coronal.py keeps it)
print('paths', len(paths), 'points', sum(len(p) for p, _ in paths))

U = 80
OUT = str(OUT_DIR / 'tracts.bin')
with open(OUT, 'wb') as f:
    pts = np.concatenate([p for p, _ in paths])
    f.write(struct.pack('<4I', len(paths), len(pts), len(outline), U))
    f.write(np.array([[len(p), k] for p, k in paths], '<u2').tobytes())
    f.write(np.round(pts * U).astype('<i2').tobytes())
    f.write(np.round(outline[:, :3] * U).astype('<i2').tobytes())
    f.write(outline[:, 3].astype(np.uint8).tobytes())
b = open(OUT, 'rb').read(); print('bytes', len(b), 'gz', len(zlib.compress(b, 9)))
