"""Fit the VesSAP vessel nodes onto the Allen root mask (model mm frame)."""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import itertools
import numpy as np
from scipy import ndimage, optimize
from voxelize import LO, RES

nodes = np.load('nodes.npy')
p = nodes[:, :3].astype(np.float64) * 0.003  # voxels (3 um) -> mm
rng = np.random.default_rng(0)
sub = p[rng.choice(len(p), 200000, replace=False)]

root = np.load('mask_997.npy')
COARSE = 4  # 0.2 mm
rc = root[:root.shape[0] // COARSE * COARSE, :root.shape[1] // COARSE * COARSE, :root.shape[2] // COARSE * COARSE]
rc = rc.reshape(rc.shape[0] // COARSE, COARSE, rc.shape[1] // COARSE, COARSE, rc.shape[2] // COARSE, COARSE).mean((1, 3, 5)) > 0.5
CR = RES * COARSE

# Allen extents along model axes, and its centre
idx = np.argwhere(root) * RES + LO
amin, amax = idx.min(0), idx.max(0)
acen = idx.mean(0)


def transform(q, perm, sign, params):
    s = params[:3]; t = params[3:6]; ang = params[6:9]
    c = q[:, perm] * sign
    c = c - c.mean(0)
    cx, cy, cz = np.cos(ang); sx, sy, sz = np.sin(ang)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return (c * s) @ (Rz @ Ry @ Rx).T + acen + t


def dice(m):
    g = np.floor((m - LO) / CR).astype(int)
    ok = np.all((g >= 0) & (g < rc.shape), 1)
    occ = np.zeros(rc.shape, bool)
    occ[tuple(g[ok].T)] = True
    occ = ndimage.binary_closing(occ, iterations=1)
    inter = (occ & rc).sum()
    return 2 * inter / (occ.sum() + rc.sum())


best = None
for perm in itertools.permutations(range(3)):
    c = sub[:, perm]
    ext = c.max(0) - c.min(0)
    s0 = (amax - amin) / ext
    for sign in itertools.product([1, -1], repeat=3):
        sign = np.array(sign)
        params = np.r_[s0, 0, 0, 0, 0, 0, 0]
        d = dice(transform(sub, perm, sign, params))
        if best is None or d > best[0]:
            best = (d, perm, sign, params)
print('coarse best', best[0], best[1], best[2], best[3][:3])

d0, perm, sign, params = best
res = optimize.minimize(lambda x: -dice(transform(sub, perm, sign, x)), params, method='Nelder-Mead',
                        options={'maxiter': 1500, 'xatol': 1e-3, 'fatol': 1e-5, 'initial_simplex': None})
print('refined', -res.fun, res.x.round(3))
np.save('registration.npy', np.r_[list(perm), sign, res.x])

# Report whether the asymmetric features (olfactory bulb, cerebellum) landed right
m = transform(sub, perm, sign, res.x)
print('mapped extents', m.min(0).round(2), m.max(0).round(2), 'allen', amin.round(2), amax.round(2))
