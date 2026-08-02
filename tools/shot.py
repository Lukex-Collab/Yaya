"""打开 demo 页截图并收集控制台报错"""

import sys, time
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], sys.argv[2]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 800})
    page.on(
        "console",
        lambda m: errors.append(m.text) if m.type in ("error", "warning") else None,
    )
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_timeout(9000)
    page.screenshot(path=out)
    dbg = page.evaluate("window.__dbg || null")
    get_pos = """window.__pet ? (
      window.__pet.position ? window.__pet.position.toArray()
      : [window.__pet.x, window.__pet.y]
    ) : null"""
    p0 = page.evaluate(get_pos)
    page.keyboard.down("w")
    page.wait_for_timeout(1000)
    page.keyboard.up("w")
    page.wait_for_timeout(300)
    p1 = page.evaluate(get_pos)
    page.screenshot(path=out.replace(".png", "_moved.png"))
    b.close()
print("CONSOLE:", errors[:10] if errors else "clean")
print("DBG:", dbg)
print("MOVED:", p0, "->", p1)
