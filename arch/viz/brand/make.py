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
    # roadmap: the loop's boxes in a row, joined by arrows; today in orange
    b = f'<rect width="900" height="170" rx="16" fill="{BG}"/>'
    bw, gap, y = 140, 32, 85
    x = (900 - (5*bw + 4*gap)) / 2
    for i, s in enumerate(ROAD):
        col = A if i == 0 else '#3a4266'
        b += f'<rect x="{x}" y="{y-18}" width="{bw}" height="36" rx="6" fill="{BG}" stroke="{col}" stroke-width="1.5"/>'
        b += f'<text x="{x+bw/2}" y="{y+5}" text-anchor="middle" fill="{A if i==0 else (FG if i==1 else M)}" font-family="{MONO}" font-size="13">{s.lower()}</text>'
        if i < 4:
            ax = x + bw + gap/2
            b += f'<line x1="{x+bw+6}" y1="{y}" x2="{x+bw+gap-6}" y2="{y}" stroke="#2a3150" stroke-width="1.5"/>'
            b += f'<path d="M-4,-5 L4,0 L-4,5" fill="none" stroke="{M}" stroke-width="1.6" transform="translate({ax+4},{y})"/>'
        if i == 0:
            b += f'<text x="{x+bw/2}" y="{y-34}" text-anchor="middle" fill="{A}" font-family="{MONO}" font-size="12">we are here</text>'
        x += bw + gap
    write('.', 'roadmap.svg', svg(900, 170, b))

c()
print('ok')
