"""Voxelize Allen meshes (root 997, isocortex 315) into boolean masks in model mm space."""
import numpy as np

C = np.array([7829.74, 4296.03, 5694.50])
RES = 0.05  # mm
LO = np.array([-5.6, -3.5, -5.5])
SHAPE = np.ceil((np.array([8.1, 4.4, 5.5]) - LO) / RES).astype(int)


def load(f):
    v, t = [], []
    for l in open(f):
        if l.startswith('v '):
            v.append(l.split()[1:4])
        elif l.startswith('f '):
            t.append([int(x.split('/')[0]) - 1 for x in l.split()[1:4]])
    v = np.array(v, float)
    m = np.stack([C[0] - v[:, 0], C[1] - v[:, 1], v[:, 2] - C[2]], 1) / 1000
    return m, np.array(t)


def voxelize(f):
    v, t = load(f)
    g = (v - LO) / RES - 0.5  # voxel-centre coordinates
    crossings = {}
    a, b, c = g[t[:, 0]], g[t[:, 1]], g[t[:, 2]]
    for i in range(len(t)):
        A, B, Cc = a[i], b[i], c[i]
        ys = np.arange(np.ceil(min(A[1], B[1], Cc[1])), np.floor(max(A[1], B[1], Cc[1])) + 1)
        zs = np.arange(np.ceil(min(A[2], B[2], Cc[2])), np.floor(max(A[2], B[2], Cc[2])) + 1)
        if not len(ys) or not len(zs):
            continue
        Y, Z = np.meshgrid(ys, zs, indexing='ij')
        Y, Z = Y.ravel(), Z.ravel()
        # barycentric in the yz projection
        d = (B[1] - A[1]) * (Cc[2] - A[2]) - (Cc[1] - A[1]) * (B[2] - A[2])
        if abs(d) < 1e-12:
            continue
        u = ((Y - A[1]) * (Cc[2] - A[2]) - (Cc[1] - A[1]) * (Z - A[2])) / d
        w = ((B[1] - A[1]) * (Z - A[2]) - (Y - A[1]) * (B[2] - A[2])) / d
        ok = (u >= 0) & (w >= 0) & (u + w <= 1)
        X = A[0] + u * (B[0] - A[0]) + w * (Cc[0] - A[0])
        for y, z, x in zip(Y[ok].astype(int), Z[ok].astype(int), X[ok]):
            crossings.setdefault((y, z), []).append(x)
    mask = np.zeros(SHAPE, bool)
    xs = np.arange(SHAPE[0])
    for (y, z), xl in crossings.items():
        if not (0 <= y < SHAPE[1] and 0 <= z < SHAPE[2]):
            continue
        xl = np.sort(xl)
        for k in range(0, len(xl) - 1, 2):
            mask[(xs >= xl[k]) & (xs <= xl[k + 1]), y, z] = True
    return mask


if __name__ == '__main__':
    for f in ['997', '315', '329']:
        m = voxelize(f + '.obj')
        np.save(f'mask_{f}.npy', m)
        print(f, m.sum() * RES ** 3, 'mm3')
