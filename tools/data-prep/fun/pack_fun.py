"""Pack the side-projects data into public/data/fun.json (read-only on both source databases)."""
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))))
import paths  # noqa: F401  (sets the working directory)
import csv, json, sqlite3, gzip, random
from datetime import date

draws = list(csv.reader(open('draws.csv')))
cur = [r for r in draws if int(r[2]) == 37]
# The 6-of-37 era has run continuously since 28/02/2009 and its draw ids are consecutive.
ids = [int(r[9]) for r in cur]
assert ids == list(range(ids[0], ids[0] + len(ids))), 'draw ids not consecutive'
epoch = date(2009, 1, 1)
lotto = {
    'pool': 37,
    'firstId': ids[0],
    'days': [(date.fromisoformat(r[1]) - epoch).days for r in cur],
    'numbers': [int(x) for r in cur for x in r[3:9]],
}

con = sqlite3.connect(f'file:{paths.NEXTPREDICTOR}/data/football.db?mode=ro', uri=True)
team = dict(con.execute('select id, name from teams'))
side = {mid: (h, a) for mid, h, a in con.execute('select id, home_id, away_id from matches')}
COMP = {'EPL': 'Premier League', 'ISR1': 'Ligat HaAl', 'UCL': 'Champions League', 'UEL': 'Europa League',
        'UECL': 'Conference League', 'WCQ': 'World Cup qualifier', 'ECQ': 'Euro qualifier', 'EURO': 'Euro',
        'WC': 'World Cup', 'UNL': 'Nations League', 'FRI': 'Friendly', 'INTQ': 'Qualifier', 'CONT': 'Continental cup', 'INT': 'International'}
rows = [r for r in csv.DictReader(open('football_backtest.csv')) if r['comp'] in ('EPL', 'ISR1', 'UCL')]
names, index = [], {}
def ni(tid):
    n = team.get(tid, tid)
    if n not in index:
        index[n] = len(names); names.append(n)
    return index[n]
comps = sorted({r['comp'] for r in rows})
fixtures = []
for r in rows:
    h, a = side[r['id']]
    fixtures.append([ni(h), ni(a), comps.index(r['comp']), float(r['lam_home']), float(r['lam_away']), float(r['rho']), int(r['hg']), int(r['ag'])])

# The site's own published simulations: every club's chance of each finishing position.
LEAGUE = str(paths.NEXTPREDICTOR / 'web/public/data/league') + '/'
seasons = []
for code in ('EPL', 'ISR1'):
    d = json.load(open(LEAGUE + code + '.json'))
    seasons.append({'comp': code, 'name': d['name'], 'simulated': d['simulated'], 'generated': d['generated_at'][:10],
                    'teams': [{'name': t['name'], 'short': t.get('short'), 'exp_pts': round(t['exp_pts'], 2), 'pos_dist': t['pos_dist'],
                               'p_title': t['p_title'], 'p_top4': t.get('p_top4'), 'p_relegation': t.get('p_relegation', 0)} for t in d['teams']]})
football = {'seasons': seasons}  # Scorelines (kept aside) also needs names, comps and fixtures

out = str(paths.OUT / 'fun.json')
raw = json.dumps({'lotto': lotto, 'football': football}, separators=(',', ':'), ensure_ascii=False)
open(out, 'w').write(raw)
print('draws', len(cur), 'fixtures', len(fixtures), 'teams', len(names), 'leagues', [(x['comp'], len(x['teams'])) for x in seasons], 'bytes', len(raw), 'gz', len(gzip.compress(raw.encode())))
