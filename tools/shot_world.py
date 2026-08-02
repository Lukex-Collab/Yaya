"""把 .spz 场景预渲染成 2D 背景图
用法: python tools/shot_world.py
输出: assets/2d/worlds/<scene>_d<dist>.jpg (每场景 3 个机位)
"""

import os
from playwright.sync_api import sync_playwright

SCENES = ["world1", "world2", "world3", "world4", "world5", "world6"]
DISTS = [2.5, 5, 9]
OUT = r"C:/Users/hbusl/lingpal-world/assets/2d/worlds"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    for s in SCENES:
        b = p.chromium.launch(headless=False, args=["--window-position=2000,100"])
        page = b.new_page(viewport={"width": 1920, "height": 1120})
        for d in DISTS:
            out = os.path.join(OUT, f"{s}_d{d}.jpg")
            if os.path.exists(out):
                print("skip", out)
                continue
            url = f"http://localhost:8080/web/render_world.html?scene={s}&dist={d}"
            try:
                page.goto(url)
                page.wait_for_function("window.__done === true", timeout=45000)
                e = page.evaluate("window.__error || null")
                if e:
                    print(f"ERROR {s} d{d}: {e}")
                    continue
                page.screenshot(path=out, type="jpeg", quality=82, timeout=30000)
                print("saved", out)
            except Exception as ex:
                print(f"FAIL {s} d{d}: {str(ex)[:80]}")
        b.close()
