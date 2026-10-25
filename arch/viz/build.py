"""Inline engine.js + a scene file into shell.html. Usage: python3 build.py scenes-idea.js idea.html [--debug]"""
import pathlib, sys
here = pathlib.Path(__file__).parent
scenes, out = sys.argv[1], sys.argv[2]
debug = '--debug' in sys.argv
html = (here / 'shell.html').read_text()
aria = {'scenes-idea.js': 'Explainer: jitk purpose-built computers, layer by layer',
        'scenes-demo.js': 'Explainer: the Sofort demo for Cloudflare code mode'}.get(scenes, 'Explainer')
html = (html.replace('__ENGINE__', (here / 'engine.js').read_text())
            .replace('__SCENES__', (here / scenes).read_text())
            .replace('__DEBUG__', '1' if debug else '')
            .replace('__ARIA__', aria))
(here / out).write_text(html)
print(out, len(html))
