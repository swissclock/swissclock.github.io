"""Where the data-prep scripts read and write. Every script imports this first.

WORK holds downloads and intermediates (git-ignored); the site's data files are
written straight into public/data. The two sibling projects are read, never
written: their databases are opened read-only.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
OUT = REPO / 'public' / 'data'
WORK = Path(os.environ.get('DATA_PREP_WORK', HERE / 'work'))
NEXTPREDICTOR = Path(os.environ.get('NEXTPREDICTOR', Path.home() / 'Dev' / 'NextPredictor'))
LOTTERY = Path(os.environ.get('LOTTERY', Path.home() / 'Dev' / 'Lottery'))

WORK.mkdir(parents=True, exist_ok=True)
os.chdir(WORK)
sys.path.insert(0, str(HERE / 'allen'))
