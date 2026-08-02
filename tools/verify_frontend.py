# 前端优化验证脚本：加载 / 移动 / 边界 / 收集反馈 / 触屏摇杆
import sys

sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080/web2d/index.html?pet=yaya"
ok, fail = [], []


def check(name, cond, extra=""):
    (ok if cond else fail).append(f"{name}{' | ' + str(extra) if extra else ''}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__dbg && window.__dbg.petLoaded", timeout=15000)
    page.wait_for_timeout(500)

    # 1. 加载与 HUD
    dbg = page.evaluate("window.__dbg")
    check("dbg 元数据", dbg["orbCount"] == 14 and dbg["zoneCount"] == 7, dbg)
    check(
        "loading 已隐藏",
        page.evaluate("document.getElementById('loading').style.display") == "none",
    )
    check("标题含宠物名", "牙牙" in page.evaluate("document.title"))
    cnt0 = page.evaluate("document.getElementById('orbs').textContent")
    check("计数初始文本", "0 / 14" in cnt0, cnt0)

    # 2. 键盘移动
    x0 = page.evaluate("window.__pet.x")
    page.keyboard.down("d")
    page.wait_for_timeout(600)
    page.keyboard.up("d")
    x1 = page.evaluate("window.__pet.x")
    check("键盘右移", x1 > x0 + 50, f"{x0:.0f} -> {x1:.0f}")

    # 3. 边界限制
    page.evaluate("window.__pet.x = 5; window.__pet.y = 500")
    page.keyboard.down("a")
    page.wait_for_timeout(500)
    page.keyboard.up("a")
    xb = page.evaluate("window.__pet.x")
    check("左边界限制", xb >= 0, f"x={xb:.1f}")

    # 4. 收集反馈：传送到某个 orb 上（此前移动测试可能已收集，取动态基线）
    page.evaluate("window.__pet.x = 960; window.__pet.y = 700")
    page.wait_for_timeout(300)
    baseline = page.evaluate("""() => {
      const m = document.getElementById('orbs').textContent.match(/(\\d+) \\/ 14/);
      return m ? +m[1] : -1;
    }""")
    page.evaluate("""() => {
      const alive = window.__orbs.getChildren().filter(o => o.active);
      if (alive.length) { window.__pet.x = alive[0].x; window.__pet.y = alive[0].y; }
    }""")
    page.wait_for_timeout(400)
    cnt1 = page.evaluate("document.getElementById('orbs').textContent")
    check(
        "收集计数 +1", f"{baseline + 1} / 14" in cnt1, f"base={baseline} cnt={cnt1!r}"
    )

    # 5. 触屏摇杆（CDP 触摸拖动）
    page.evaluate("window.__pet.x = 960; window.__pet.y = 700")
    page.wait_for_timeout(300)
    x2 = page.evaluate("window.__pet.x")
    cdp = ctx.new_cdp_session(page)
    cdp.send(
        "Input.dispatchTouchEvent",
        {"type": "touchStart", "touchPoints": [{"x": 300, "y": 500, "id": 1}]},
    )
    page.wait_for_timeout(100)
    cdp.send(
        "Input.dispatchTouchEvent",
        {"type": "touchMove", "touchPoints": [{"x": 356, "y": 500, "id": 1}]},
    )
    page.wait_for_timeout(700)
    joy_op = page.evaluate(
        "getComputedStyle(document.getElementById('joy-base')).opacity"
    )
    x3 = page.evaluate("window.__pet.x")
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(600)
    x4 = page.evaluate("window.__pet.x")
    page.wait_for_timeout(300)
    x5 = page.evaluate("window.__pet.x")
    check("摇杆显示", float(joy_op) > 0.5, f"opacity={joy_op}")
    check("摇杆右移", x3 > x2 + 50, f"{x2:.0f} -> {x3:.0f}")
    check("松手即停", abs(x5 - x4) < 5, f"{x4:.0f} -> {x5:.0f}")

    # 6. 无 JS 异常
    check("无 JS 异常", not errors, errors[:2])

    page.screenshot(path="web2d/shot_verify.png")
    browser.close()

print("PASS:")
for s in ok:
    print("  +", s)
if fail:
    print("FAIL:")
    for s in fail:
        print("  -", s)
    sys.exit(1)
print(f"{len(ok)}/{len(ok) + len(fail)} 项通过")
