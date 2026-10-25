#!/usr/bin/env python3
"""Validate shipped payloads; preparation never depends on another checkout."""
from runtime import ROOT, CANONICAL, sha, source

def prepare():
    source()
    lua=ROOT/'payload/lua-static'; qjs=CANONICAL/'payload/qjs'
    assert sha(lua)=='6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929'
    assert qjs.is_file(), 'canonical kernel/payload/qjs is required'
    return qjs,lua

if __name__=='__main__':
    import json
    print(json.dumps({p.name:sha(p) for p in prepare()},indent=2))
