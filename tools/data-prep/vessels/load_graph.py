"""Convert the VesselGraph CSVs (C57BL_6_no1_raw) in WORK to nodes.npy / edges.npy."""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import numpy as np
import pandas as pd

d = 'C57BL_6_no1_raw/BL6J-no1_iso3um_stitched_segmentation_bulge_size_3.0_'
n = pd.read_csv(d + 'nodes.csv', sep=';', usecols=['pos_x', 'pos_y', 'pos_z', 'degree']).to_numpy(np.float32)
e = pd.read_csv(d + 'edges.csv', sep=';', usecols=['node1id', 'node2id', 'length', 'avgRadiusAvg', 'hasNodeAtSampleBorder']).to_numpy(np.float32)
np.save('nodes.npy', n)
np.save('edges.npy', e)
print(len(n), 'nodes', len(e), 'edges')
