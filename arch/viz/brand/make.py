#!/usr/bin/env python3
"""README graphics: hero.svg (logo + the loop) and roadmap.svg. Pure SVG, system fonts.

  python3 arch/viz/brand/make.py   (run from anywhere; writes next to this file)"""
import math, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
STEPS = ['Run', 'Measure', 'Grow', 'Prove']
SUBS = ['agents run code', 'see what works', 'add what is missing', 'Linux checks it']
ROAD = ['Today', 'Teaches itself', 'Runs whole jobs', 'Dense and used', 'Runs everything']

def svg(w, h, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{extra}{body}</svg>\n'

def write(d, name, text):
    os.makedirs(d, exist_ok=True); open(os.path.join(d, name), 'w').write(text)

# ---------- C: Night (dark, monospace, one orange accent) ----------
def c():
    BG, FG, M, A = '#0b1020', '#e6e9f2', '#6b7390', '#ff8a3d'
    b = f'<rect width="900" height="320" rx="16" fill="{BG}"/>'
    # logo: bracket + cursor
    b += f'<text x="70" y="150" fill="{FG}" font-family="{MONO}" font-size="56" font-weight="700">[s]</text>'
    b += f'<rect x="196" y="108" width="20" height="44" fill="{A}"/>'
    b += f'<text x="72" y="200" fill="{FG}" font-family="{MONO}" font-size="26">sofort</text>'
    b += f'<text x="72" y="228" fill="{M}" font-family="{MONO}" font-size="14">a sandbox that grows itself</text>'
    # loop: square track
    x0, y0, w, h = 440, 70, 380, 180
    b += f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="28" fill="none" stroke="#2a3150" stroke-width="2"/>'
    corners = [(x0, y0), (x0+w, y0), (x0+w, y0+h), (x0, y0+h)]
    for i, ((x, y), s) in enumerate(zip(corners, STEPS)):
        b += f'<rect x="{x-58}" y="{y-18}" width="116" height="36" rx="6" fill="{BG}" stroke="{A if i==2 else "#3a4266"}" stroke-width="1.5"/>'
        b += f'<text x="{x}" y="{y+6}" text-anchor="middle" fill="{A if i==2 else FG}" font-family="{MONO}" font-size="16">{s.lower()}</text>'
    b += f'<text x="{x0+w/2}" y="{y0+h/2-4}" text-anchor="middle" fill="{M}" font-family="{MONO}" font-size="13">misses become</text>'
    b += f'<text x="{x0+w/2}" y="{y0+h/2+16}" text-anchor="middle" fill="{M}" font-family="{MONO}" font-size="13">verified features</text>'
    for (x, y, rot) in [(x0+w/2, y0, 0), (x0+w, y0+h/2, 90), (x0+w/2, y0+h, 180), (x0, y0+h/2, 270)]:
        b += f'<path d="M-5,-6 L5,0 L-5,6" fill="none" stroke="{M}" stroke-width="1.6" transform="translate({x},{y}) rotate({rot})"/>'
    write('.', 'hero.svg', svg(900, 320, b))
    # roadmap: a staircase of what share of real agent commands runs inside
    b = f'<rect width="900" height="320" rx="16" fill="{BG}"/>'
    steps = [('20%', 'today', 'grep sed jq cat', 0.20),
             ('25%', 'teaches itself', '+ ripgrep', 0.25),
             ('~45%', 'whole jobs', '+ files, pipes', 0.45),
             ('most', 'everything', '+ git node python', 0.90)]
    base, top, x, w, g = 250, 70, 70, 170, 20
    for i, (big, name, tools, share) in enumerate(steps):
        h = 30 + share * (base - top - 30)
        on = i == 0
        b += f'<rect x="{x}" y="{base-h}" width="{w}" height="{h}" rx="8" fill="{A if on else "#1a2038"}" stroke="{A if on else "#2a3150"}" stroke-width="1.5"/>'
        b += f'<text x="{x+14}" y="{base-h+30}" fill="{BG if on else FG}" font-family="{MONO}" font-size="22" font-weight="700">{big}</text>'
        b += f'<text x="{x}" y="{base+24}" fill="{A if on else FG}" font-family="{MONO}" font-size="14">{name}</text>'
        b += f'<text x="{x}" y="{base+42}" fill="{M}" font-family="{MONO}" font-size="12">{tools}</text>'
        x += w + g
    b += f'<text x="70" y="40" fill="{M}" font-family="{MONO}" font-size="13">share of real agent commands that run inside</text>'
    write('.', 'roadmap.svg', svg(900, 320, b))
    # logo: [s] with the cursor, on its own
    def mark(x, y, k):
        return (f'<text x="{x}" y="{y}" fill="{FG}" font-family="{MONO}" font-size="{56*k}" font-weight="700">[s]</text>'
                f'<rect x="{x+126*k}" y="{y-42*k}" width="{20*k}" height="{44*k}" fill="{A}"/>')
    write('.', 'logo.svg', svg(256, 256, f'<rect width="256" height="256" rx="48" fill="{BG}"/>' + mark(40, 152, 1.18)))
    # social preview (1280x640): logo, name, one line, the loop words
    b = f'<rect width="1280" height="640" fill="{BG}"/>' + mark(120, 300, 2.2)
    b += f'<text x="124" y="400" fill="{FG}" font-family="{MONO}" font-size="64">sofort</text>'
    b += f'<text x="126" y="456" fill="{M}" font-family="{MONO}" font-size="28">tiny, fast computers for AI agents</text>'
    b += f'<text x="126" y="496" fill="{M}" font-family="{MONO}" font-size="28">that grow themselves</text>'
    wx = 820
    for k, w in enumerate(['run', 'measure', 'grow', 'prove']):
        y = 220 + k*70
        b += f'<rect x="{wx}" y="{y-34}" width="240" height="52" rx="8" fill="{BG}" stroke="{A if w=="grow" else "#3a4266"}" stroke-width="2"/>'
        b += f'<text x="{wx+120}" y="{y}" text-anchor="middle" fill="{A if w=="grow" else FG}" font-family="{MONO}" font-size="26">{w}</text>'
    write('.', 'og.svg', svg(1280, 640, b))
    # providers: one table, sorted by tasks per GiB, from bench v1 (memory-s5b, fit-matrix2/9)
    rows = [('tanstack isolated-vm', 'V8 isolate', False, 212, 100), ('node:vm', 'none', False, 78, 100),
            ('sofort', 'hardware VM', True, 48, 100), ('tanstack quickjs', 'Wasm', False, 41, 99),
            ('hyperlight-js', 'hardware VM', True, 16, 88), ('cloudflare worker', 'V8 isolate', False, 9, 100)]
    b = f'<rect width="900" height="400" rx="16" fill="{BG}"/>'
    b += f'<text x="50" y="46" fill="{FG}" font-family="{MONO}" font-size="17">real agent tasks per GiB of memory</text>'
    b += f'<text x="50" y="68" fill="{M}" font-family="{MONO}" font-size="12">same 25 programs on the same Mac</text>'
    cols = [(50, 'sandbox', 'start'), (280, 'isolation', 'start'), (430, 'tasks per GiB', 'start'), (850, 'solved', 'end')]
    for x, h, anchor in cols:
        b += f'<text x="{x}" y="110" text-anchor="{anchor}" fill="{M}" font-family="{MONO}" font-size="11" letter-spacing="1">{h.upper()}</text>'
    b += f'<line x1="50" y1="122" x2="850" y2="122" stroke="#2a3150" stroke-width="1"/>'
    y, bx, bw = 154, 430, 290
    for name, iso, hw, gib, ok in rows:
        me = name == 'sofort'
        if me:
            b += f'<rect x="38" y="{y-21}" width="824" height="38" rx="8" fill="#151b33"/>'
        b += f'<text x="50" y="{y+4}" fill="{A if me else FG}" font-family="{MONO}" font-size="14" font-weight="{700 if me else 400}">{name}</text>'
        b += f'<text x="280" y="{y+4}" fill="{A if hw else M}" font-family="{MONO}" font-size="13">{iso}</text>'
        w = max(gib/212*bw, 6)
        b += f'<rect x="{bx}" y="{y-8}" width="{w:.0f}" height="14" rx="5" fill="{A if hw else "#3a4266"}"/>'
        b += f'<text x="{bx+w+10:.0f}" y="{y+4}" fill="{A if me else FG}" font-family="{MONO}" font-size="13">{gib}</text>'
        b += f'<text x="850" y="{y+4}" text-anchor="end" fill="{FG if ok == 100 else M}" font-family="{MONO}" font-size="13">{ok}/100</text>'
        y += 40
    write('.', 'providers.svg', svg(900, 400, b))

c()
print('ok')
