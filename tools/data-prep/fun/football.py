"""Read-only: re-run NextPredictor's out-of-sample walk with its saved params and dump per-match 1X2 probabilities."""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import csv, sqlite3, sys
import numpy as np
sys.path.insert(0, str(paths.NEXTPREDICTOR / 'pipeline'))
from predictor.engine import Engine
from predictor import backtest as bt
from predictor.models.scoreline import rps

con = sqlite3.connect(f'file:{paths.NEXTPREDICTOR}/data/football.db?mode=ro', uri=True)
con.row_factory = sqlite3.Row
E = Engine(con)
rows = []
for kind in ('club', 'nation'):
    P = bt.PERIODS[kind]
    recs = bt.walk(E, kind, *P['test'], P['step'], log=lambda *a: None)
    for r in recs:
        lh, la = bt.combine(r['comps'], E.params['weights'][r['domain']])
        p = bt.probs(lh, la, r['rho'])
        rows.append((r['id'], r['comp'], r['kickoff'][:10], *[round(float(x), 4) for x in p], r['o'], r['hg'], r['ag'], round(float(lh), 3), round(float(la), 3), round(float(r['rho']), 4), rps(p, r['o'])))
    print(kind, len(recs), flush=True)
with open('football_backtest.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['id', 'comp', 'date', 'p_home', 'p_draw', 'p_away', 'outcome', 'hg', 'ag', 'lam_home', 'lam_away', 'rho', 'rps']); w.writerows(rows)
for comp in ('EPL', 'ISR1', 'UCL'):
    rs = [r[-1] for r in rows if r[1] == comp]
    print(comp, len(rs), round(float(np.mean(rs)), 4))
print('total', len(rows))
