"""Compact final table for the thread; refuses incomplete measurements."""
from html import escape
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def main():
    data=json.loads((ROOT/'experiments/summary.json').read_text())
    assert len(data['pilot'])==36 and len(data['main'])==180
    rows=[]
    for model,label in [('old','gpt-6-sol'),('new','gpt-6.1-sol')]:
        for spec in ('full','terse','none'):
            cells=[]
            for phase,n in [('pilot',6),('main',30)]:
                values=[t for t in data[phase] if t['model']==model and t['spec']==spec]
                assert len(values)==n
                cells.extend(f'<td>{sum(t[key] for t in values)}/{n}</td>' for key in ('at1','accepted'))
            rows.append(f'<tr><th scope="row">{escape(label)}</th><td>{spec}</td>'+''.join(cells)+'</tr>')
    page='''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;background:transparent;color:var(--foreground);font-family:var(--font-sans,system-ui);font-size:14px}
p{margin:0 0 14px;line-height:1.5}table{border-collapse:collapse;width:100%;table-layout:fixed;font-variant-numeric:tabular-nums}
caption{text-align:left;font-weight:500;margin-bottom:10px}th,td{padding:10px 3px;border-bottom:1px solid var(--border);text-align:right;overflow-wrap:anywhere}
th{font-weight:500}th:first-child,td:nth-child(2){text-align:left}thead th{text-align:center}thead th:first-child{width:25%;text-align:left}thead th:nth-child(2){width:12%;text-align:left}
.note{color:var(--muted-foreground);margin-top:12px;font-size:12px}
</style></head><body>
<p>E0: <strong>4/5</strong> complete live runs accepted. Existing mutants: <strong>13/13</strong> rejected.</p>
<table aria-label="Pilot and main acceptance by model and spec, pooling ppoll fstat and pread64">
<caption>E1 acceptance · ppoll, fstat and pread64 pooled</caption>
<thead><tr><th rowspan="2" scope="col">Model</th><th rowspan="2" scope="col">Spec</th><th colspan="2" scope="colgroup">Pilot</th><th colspan="2" scope="colgroup">Main</th></tr>
<tr><th scope="col">@1</th><th scope="col">@3</th><th scope="col">@1</th><th scope="col">@3</th></tr></thead>
<tbody>'''+''.join(rows)+'''</tbody></table>
<p class="note">@1: first attempt. @3: within three attempts, including all gates and held-out Linux cases. N=2 per pilot cell; N=10 per main cell. Functional runs only.</p>
</body></html>'''
    (ROOT/'experiments/summary.html').write_text(page)


if __name__=='__main__':
    main()
