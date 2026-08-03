"""灵伴世界 · 本地服务器（静态 + 防伪激活 + 云存档）
用法: python server.py  →  http://localhost:8080/web2d/
"""

import hashlib, hmac, json, os, sqlite3, time
from flask import Flask, request, jsonify, send_from_directory

ROOT = os.path.dirname(os.path.abspath(__file__))
SECRET = (
    "yaya-demo-secret-2026"  # 与 tools/make_qr.py 保持一致；上线必须更换并放入环境变量
)
PETS = {
    "yaya",
    "pangda",
    "maotouying",
    "long",
    "linghu",
    "jingyu",
    "zhangyu",
    "xiongmao",
}

app = Flask(__name__, static_folder=None)
db = sqlite3.connect(os.path.join(ROOT, "data.db"), check_same_thread=False)
db.execute(
    "CREATE TABLE IF NOT EXISTS activations (serial TEXT PRIMARY KEY, pet TEXT, device TEXT, ts REAL)"
)
db.execute(
    "CREATE TABLE IF NOT EXISTS saves (device TEXT, pet TEXT, state TEXT, ts REAL, PRIMARY KEY (device, pet))"
)
db.commit()


def sign(payload: str) -> str:
    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:12]


# ---------- 静态 ----------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def static_files(path):
    if not path:
        path = "web2d/index.html"
    elif path.endswith("/"):
        path += "index.html"
    return send_from_directory(ROOT, path)


# ---------- 防伪激活 ----------
@app.post("/api/activate")
def activate():
    body = request.get_json(force=True)
    code = (body.get("code") or "").strip()
    device = (body.get("device") or "")[:64]
    parts = code.split(".")
    if len(parts) != 3:
        return jsonify(ok=False, error="无效的二维码")
    pet, serial, sig = parts
    if pet not in PETS or not hmac.compare_digest(sign(f"{pet}.{serial}"), sig):
        return jsonify(ok=False, error="二维码校验失败（非官方签发）")
    row = db.execute(
        "SELECT device FROM activations WHERE serial=?", (serial,)
    ).fetchone()
    if row:
        if row[0] == device:
            return jsonify(ok=True, pet=pet, again=True)
        return jsonify(ok=False, error="这只宠物已被其他人唤醒了")
    db.execute(
        "INSERT INTO activations VALUES (?,?,?,?)", (serial, pet, device, time.time())
    )
    db.commit()
    return jsonify(ok=True, pet=pet, again=False)


# ---------- 云存档 ----------
@app.post("/api/save")
def save():
    body = request.get_json(force=True)
    device, pet = (body.get("device") or "")[:64], body.get("pet") or ""
    if pet not in PETS or not device:
        return jsonify(ok=False)
    db.execute(
        "REPLACE INTO saves VALUES (?,?,?,?)",
        (
            device,
            pet,
            json.dumps(body.get("state") or {}, ensure_ascii=False),
            time.time(),
        ),
    )
    db.commit()
    return jsonify(ok=True)


@app.get("/api/load")
def load():
    device, pet = request.args.get("device", ""), request.args.get("pet", "")
    row = db.execute(
        "SELECT state FROM saves WHERE device=? AND pet=?", (device, pet)
    ).fetchone()
    return jsonify(ok=True, state=json.loads(row[0]) if row else None)


# ---------- 演示用：清空激活 ----------
@app.post("/api/reset")
def reset():
    if request.get_json(force=True).get("key") != SECRET:
        return jsonify(ok=False), 403
    db.execute("DELETE FROM activations")
    db.commit()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, threaded=True)
