"""新增功能验证：每日签到 / 喂食 / 图鉴 / 成就 / 聊天 / 派遣 / 灵光收集
用法: python tools/verify_features.py   （需先启动 python server.py）
"""
import sys

sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080/web2d/index.html?pet=yaya"
ok, fail = [], []


def check(name, cond, extra=""):
    (ok if cond else fail).append(f"{name}{' | ' + str(extra) if extra else ''}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 430, "height": 900})
    ctx.add_init_script("localStorage.clear()")  # 全新存档
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__dbg && window.__dbg.petLoaded", timeout=20000)
    page.wait_for_timeout(600)

    mem = lambda: page.evaluate("window.YAYA_AI.Memory.data")
    inv = lambda: page.evaluate("window.YAYA_PLAY.inventory")
    toast = lambda: page.evaluate("document.getElementById('toast').textContent")

    # ---------- 每日签到 ----------
    page.click("#btnCheckin")
    page.wait_for_timeout(400)
    m1 = mem()
    check("签到: lastCheckin 已记录", m1["lastCheckin"] == page.evaluate("new Date().toISOString().slice(0,10)"), m1["lastCheckin"])
    check("签到: checkinDays=1", m1["checkinDays"] == 1, m1["checkinDays"])
    check("签到: 浆果 +2", inv().get("浆果") == 2, inv())
    check("签到: 亲密 +2", m1["intimacy"] == 2, m1["intimacy"])
    check("签到: 成就 checkin1", "checkin1" in (m1.get("achievements") or {}))
    check("签到: toast（解锁成就今日之约）", "今日之约" in toast(), toast())
    page.click("#btnCheckin")
    page.wait_for_timeout(300)
    check("签到: 重复点击不加浆果", inv().get("浆果") == 2, inv())
    check("签到: 重复点击提示已签到", "已经签到过" in toast(), toast())

    # ---------- 喂食 ----------
    page.click("#btnFeed")
    page.wait_for_timeout(400)
    m2 = mem()
    check("喂食: 浆果 -1", inv().get("浆果") == 1, inv())
    check("喂食: 亲密 +2", m2["intimacy"] == 4, m2["intimacy"])
    check("喂食: feedCount=1", m2["feedCount"] == 1, m2["feedCount"])
    check("喂食: 成就 feed1", "feed1" in (m2.get("achievements") or {}))
    check("喂食: toast（解锁成就投喂初体验）", "投喂初体验" in toast(), toast())
    page.click("#btnFeed")
    page.wait_for_timeout(300)
    check("喂食: 第二颗浆果", inv().get("浆果") == 0, inv())
    page.click("#btnFeed")
    page.wait_for_timeout(300)
    check("喂食: 无浆果提示", "没有浆果" in toast(), toast())
    check("喂食: 无浆果不加亲密", mem()["intimacy"] == 6, mem()["intimacy"])
    check("喂食: 亲密 Lv.2 成就 inti2", "inti2" in (mem().get("achievements") or {}))

    # ---------- 图鉴 ----------
    page.click("#btnCodex")
    page.wait_for_timeout(500)
    check("图鉴: 面板打开", page.evaluate("document.getElementById('codex').classList.contains('open')"))
    check("图鉴: 8 张宠物卡", page.evaluate("document.querySelectorAll('#codexPets .cx-card').length") == 8)
    check("图鉴: 当前伙伴标记", "当前伙伴" in page.evaluate("document.getElementById('codexPets').textContent"))
    check("图鉴: 14 条成就条目", page.evaluate("document.querySelectorAll('#codexAch .cx-ach').length") == 14)
    done = page.evaluate("document.querySelectorAll('#codexAch .cx-ach.done').length")
    check("图鉴: 已解锁成就数>=3", done >= 3, done)
    page.click("#codexClose")
    page.wait_for_timeout(300)
    check("图鉴: 面板关闭", not page.evaluate("document.getElementById('codex').classList.contains('open')"))

    # ---------- 成就: 灵光收集 ----------
    page.evaluate("""() => {
      const alive = window.__orbs.getChildren().filter(o => o.active);
      if (alive.length) { window.__pet.x = alive[0].x; window.__pet.y = alive[0].y; }
    }""")
    page.wait_for_timeout(700)
    m3 = mem()
    check("灵光: orbsCollected>=1", (m3.get("orbsCollected") or 0) >= 1, m3.get("orbsCollected"))
    check("成就: orb1 解锁", "orb1" in (m3.get("achievements") or {}))

    # ---------- 成就: 派遣（缩短为 1 秒） ----------
    page.evaluate("window.YAYA_PLAY.dispatchSecs = 1")
    page.click("#btnDispatch")
    page.wait_for_timeout(2200)
    m4 = mem()
    check("派遣: dispatchCount=1", m4["dispatchCount"] == 1, m4["dispatchCount"])
    check("成就: dispatch1 解锁", "dispatch1" in (m4.get("achievements") or {}))
    check("派遣: 获得纪念品", inv().get("纪念品") == 1, inv())

    # ---------- 成就: 聊天 ----------
    page.click("#btnChat")
    page.fill("#chatInput", "你好")
    page.click("#chatSend")
    page.wait_for_timeout(700)
    m5 = mem()
    check("聊天: chatCount>=1", (m5.get("chatCount") or 0) >= 1, m5.get("chatCount"))
    check("成就: chat1 解锁", "chat1" in (m5.get("achievements") or {}))

    # ---------- 成就: 手动触发高亲密 ----------
    page.evaluate("() => { const m = window.YAYA_AI.Memory.data; m.intimacy = 30; window.__unlockAwards(); }")
    page.wait_for_timeout(400)
    m6 = mem()
    check("成就: inti6（亲密 Lv.6）", "inti6" in (m6.get("achievements") or {}))
    check("成就: 解锁 toast", "解锁成就" in toast(), toast())

    # ---------- 无 JS 异常 ----------
    check("无 JS 异常", not errors, errors[:3])
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
