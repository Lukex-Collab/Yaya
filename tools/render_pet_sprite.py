"""批量把带贴图的宠物 GLB 预渲染成 512x512 透明精灵图
用法: python tools/render_pet_sprite.py
输出: assets/2d/pets/<id>.png
"""

import os
from playwright.sync_api import sync_playwright

PETS = [
    "yaya",
    "pixiu",
    "pangda",
    "maotouying",
    "long",
    "linghu",
    "jingyu",
    "zhangyu",
    "xiongmao",
]
OUT = r"C:/Users/hbusl/lingpal-world/assets/2d/pets"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=["--window-position=2000,100"])
    page = b.new_page(viewport={"width": 512, "height": 512})
    for pet in PETS:
        out = os.path.join(OUT, f"{pet}.png")
        if os.path.exists(out):
            print("skip", pet)
            continue
        try:
            page.goto(f"http://localhost:8080/web/render_pet.html?pet={pet}")
            page.wait_for_function("window.__done === true", timeout=60000)
            e = page.evaluate("window.__error || null")
            if e:
                print("ERROR", pet, e)
                continue
            page.wait_for_timeout(400)
            page.locator("canvas").screenshot(
                path=out, omit_background=True, timeout=30000
            )
            print("saved", pet)
        except Exception as ex:
            print("FAIL", pet, str(ex)[:80])
    b.close()
