"""生成签名防伪二维码（每只宠物一个，含随机序列号）
用法: python tools/make_qr.py [基础URL]
      基础URL 示例: https://yaya-lingpal-demo.loca.lt （公网隧道）
                    192.168.1.5                    （局域网 IP，自动补 http:// 与 :8080）
"""

import hashlib, hmac, os, random, string, sys
import qrcode

SECRET = "yaya-demo-secret-2026"  # 与 server.py 保持一致
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://yaya-lingpal-demo.loca.lt"
if "://" not in BASE:
    BASE = f"http://{BASE}:8080"
PETS = {
    "yaya": "牙牙",
    "pixiu": "貔貅",
    "pangda": "胖达",
    "maotouying": "猫头鹰",
    "long": "龙",
    "linghu": "灵狐",
    "jingyu": "鲸鱼",
    "zhangyu": "章鱼",
    "xiongmao": "熊猫",
}
OUT = r"C:/Users/hbusl/lingpal-world/assets/qr"
os.makedirs(OUT, exist_ok=True)


def sign(payload: str) -> str:
    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:12]


for pid, name in PETS.items():
    serial = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    code = f"{pid}.{serial}.{sign(f'{pid}.{serial}')}"
    url = f"{BASE}/web2d/bind.html?code={code}"
    qrcode.make(url, box_size=10, border=2).save(os.path.join(OUT, f"{pid}.png"))
    print(name, code)
