#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
芽芽 (Yaya) 单用户经济模型 —— 可运行、可当场改参数重算

对应 Yaya.md 第二 / 三 / 五部分的全部数字。
参数出处标记：[文档] = 来自 Yaya.md；[假设] = 新增假设，需 MVP 验证；[推导] = 算出来的。
路演被追问「这数怎么来的」时，改参数重跑即可。

用法:
    python finance_model.py                 # 基准：¥299 / 500台 / 中性娃衣
    python finance_model.py --price 99      # 复现 v1.0 的结构性亏损
    python finance_model.py --batch 10000   # 量产到底能降到哪
    python finance_model.py --volume-table  # 批量 → 落地成本曲线
    python finance_model.py --breakeven     # 保本售价 / 保本娃衣附加率
    python finance_model.py --scenario optimistic
    python finance_model.py --json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import unicodedata
from dataclasses import dataclass, field

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_BATCH = 500  # 文档里 BOM 的基准批量


# ==========================================================================
# 一、硬件落地成本   [Yaya.md 第二部分 ①]
# ==========================================================================

@dataclass
class Hardware:
    """所有单价均为「¥ / 台」，基准批量 500 台。"""

    price: float = 299.0          # [文档] 修正后售价（v1.0 是 99）
    batch: int = BASE_BATCH       # [文档] 小批量 500 台

    components: float = 48.0      # [文档] 元器件小计（已剔除淘宝散件零售溢价）
    pcb_smt: float = 6.0          # [文档] PCB 打样 + 贴片，摊薄
    tooling: float = 5.0          # [文档] 结构件 / 开模，摊薄
    assembly_labor: float = 18.0  # [文档] 组装人工（塞进毛绒壳 = 纯手工）
    test_flash: float = 3.0       # [文档] 测试 + 烧录
    packaging: float = 8.0        # [文档] 包装
    logistics: float = 10.0       # [文档] 物流
    defect_rate: float = 0.05     # [文档] 不良率
    return_rate: float = 0.05     # [文档] 退换率
    cellular: float = 0.0         # [文档] 4G Cat.1 模组 +¥30-40（MVP 走 WiFi 故为 0）

    # 规模效应指数（负数 = 批量翻倍时单位成本下降）[假设]
    component_curve: float = -0.06   # 元器件：采购议价，降幅温和
    labor_curve: float = -0.12       # 人工：治具 + 熟练度，学习曲线更陡

    def _scale(self, base: float, curve: float) -> float:
        """按批量缩放变动成本。batch=500 时返回 base 本身。"""
        return base * (self.batch / BASE_BATCH) ** curve

    @property
    def amortized_fixed(self) -> float:
        """开模 + 打样是一次性投入，总额固定，批量越大摊得越薄。"""
        total_fixed = (self.pcb_smt + self.tooling) * BASE_BATCH
        return total_fixed / self.batch

    @property
    def manufacturing(self) -> float:
        """[推导] 制造成本 = 元器件 + 摊薄固定成本 + 人工 + 测试烧录 + 蜂窝模组"""
        return (
            self._scale(self.components, self.component_curve)
            + self.amortized_fixed
            + self._scale(self.assembly_labor, self.labor_curve)
            + self.test_flash
            + self.cellular
        )

    @property
    def shrinkage(self) -> float:
        """[推导] 不良 + 退换摊销，按制造成本计提。"""
        return (self.defect_rate + self.return_rate) * self.manufacturing

    @property
    def landed(self) -> float:
        """[推导] 落地成本：出厂到用户手上的全部成本。"""
        return self.manufacturing + self.packaging + self.logistics + self.shrinkage

    @property
    def gross_profit(self) -> float:
        return self.price - self.landed

    @property
    def gross_margin(self) -> float:
        return self.gross_profit / self.price if self.price else 0.0

# ==========================================================================
# 二、云端成本   [Yaya.md 第三部分]
# ==========================================================================

@dataclass
class Cloud:
    asr: float = 0.004            # [文档] 流式 ASR，约 5 秒
    llm: float = 0.012            # [文档] 输入 ~800 token(含上下文) + 输出 ~100 token
    tts: float = 0.010            # [文档] ~30 字，含情感音色溢价

    horizon_months: int = 24      # [文档] 24 个月周期
    turns_per_day: float = 3.0    # [文档] 基准：日均 3 次对话

    # 留存曲线 [文档] 首月 40% → 12 个月 15%，之后沿同一衰减率外推到 floor
    retention_m1: float = 0.40
    retention_m12: float = 0.15
    retention_floor: float = 0.05  # [假设] 死忠不再流失的地板

    # 重度用户 [文档] 日均 10 次以上且不流失
    heavy_turns_per_day: float = 10.0
    heavy_share: float = 0.0       # [文档口径] 默认 0，以复现文档 LTV ¥205

    @property
    def cost_per_turn(self) -> float:
        """[推导] 单次对话成本，文档值 ¥0.026"""
        return self.asr + self.llm + self.tts

    @property
    def monthly_decay(self) -> float:
        """[推导] 由 m1→m12 两点反解出的月衰减率。"""
        return (self.retention_m12 / self.retention_m1) ** (1.0 / 11.0)

    def retention(self, month: int) -> float:
        """month=1 为购买当月（视作 100% 活跃），之后按曲线衰减。"""
        if month <= 1:
            return 1.0
        decayed = self.retention_m1 * self.monthly_decay ** (month - 2)
        return max(decayed, self.retention_floor)

    @property
    def active_user_months(self) -> float:
        """[推导] 折算后的「有效活跃月数」——留存衰减省下来的钱就体现在这。"""
        return sum(self.retention(m) for m in range(1, self.horizon_months + 1))

    @property
    def baseline_cost(self) -> float:
        """[推导] 基准用户 24 个月云成本，文档值 ≈¥12"""
        return self.active_user_months * 30.0 * self.turns_per_day * self.cost_per_turn

    @property
    def heavy_cost(self) -> float:
        """[推导] 重度用户：满活跃不流失，文档值 ¥150-190"""
        return (
            self.horizon_months * 30.0 * self.heavy_turns_per_day * self.cost_per_turn
        )

    @property
    def blended_cost(self) -> float:
        """[推导] 按重度用户占比加权的期望云成本。"""
        return (
            1 - self.heavy_share
        ) * self.baseline_cost + self.heavy_share * self.heavy_cost

# ==========================================================================
# 三、实体娃衣 + 虚拟同款   [Yaya.md 第四部分]
# ==========================================================================

@dataclass
class Apparel:
    """三档情形直接对应文档第四部分那张表。attach_rate 是最需要 MVP 验证的假设。"""

    attach_rate: float = 0.30     # [假设] 附加购买率（买过 ≥1 套），行业 10-40%
    sets_per_buyer: float = 2.5   # [假设] 人均套数（24 个月）
    price_per_set: float = 49.0   # [文档] 单套均价，参考淘宝棉花娃娃衣服
    margin: float = 0.65          # [假设] 毛利率

    # 虚实联动：买实体扫码解锁虚拟同款，一次收费两处兑现 → 无额外收入，但提升 attach_rate
    virtual_only_rate: float = 0.0   # [假设] 只买虚拟皮肤的用户占比（转化率仅 2-5%）
    virtual_price: float = 12.0      # [文档] ¥6-18
    virtual_margin: float = 0.95     # [推导] 纯数字商品，仅渠道手续费

    @property
    def physical_per_user(self) -> float:
        """[推导] 实体娃衣毛利，摊到每个硬件用户。中性情形文档值 ¥24"""
        return self.attach_rate * self.sets_per_buyer * self.price_per_set * self.margin

    @property
    def virtual_per_user(self) -> float:
        return self.virtual_only_rate * self.virtual_price * self.virtual_margin

    @property
    def per_user(self) -> float:
        return self.physical_per_user + self.virtual_per_user


APPAREL_SCENARIOS = {
    # [Yaya.md 第四部分] 保守 / 中性 / 乐观 三档
    "conservative": Apparel(attach_rate=0.20, sets_per_buyer=1.5, price_per_set=45.0, margin=0.60),
    "neutral":      Apparel(attach_rate=0.30, sets_per_buyer=2.5, price_per_set=49.0, margin=0.65),
    "optimistic":   Apparel(attach_rate=0.45, sets_per_buyer=4.0, price_per_set=55.0, margin=0.68),
}


# ==========================================================================
# 四、「芽芽能量」消耗包   [Yaya.md 第五部分 ③]
# ==========================================================================

@dataclass
class EnergyPack:
    """经济上等价于订阅，心理上是买道具。只有重度用户付费，而重度用户正是云成本来源。"""

    free_turns_per_day: float = 5.0   # [假设] 每天免费 N 次对话
    pack_price: float = 9.0           # [文档] ¥9 / 100 次
    pack_turns: float = 100.0         # [文档]
    payer_share: float = 0.08         # [假设] 超出免费额度且愿意付费的用户占比
    channel_fee: float = 0.06         # [假设] 微信支付 + 渠道手续费

    def per_user(self, cloud: Cloud) -> float:
        """[推导] 只对超出免费额度的部分收费，摊到每个硬件用户。"""
        overflow = max(0.0, cloud.heavy_turns_per_day - self.free_turns_per_day)
        if overflow <= 0:
            return 0.0
        billable_turns = overflow * 30.0 * cloud.horizon_months
        packs = billable_turns / self.pack_turns
        revenue = packs * self.pack_price * (1 - self.channel_fee)
        return self.payer_share * revenue

# ==========================================================================
# 五、单用户 LTV 汇总   [Yaya.md 第五部分]
# ==========================================================================

@dataclass
class Model:
    hardware: Hardware = field(default_factory=Hardware)
    cloud: Cloud = field(default_factory=Cloud)
    apparel: Apparel = field(default_factory=lambda: APPAREL_SCENARIOS["neutral"])
    energy: EnergyPack = field(default_factory=EnergyPack)

    @property
    def energy_per_user(self) -> float:
        return self.energy.per_user(self.cloud)

    @property
    def ltv(self) -> float:
        """[推导] 硬件毛利 + 娃衣 + 能量包 − 云成本。文档基准值 ¥205"""
        return (
            self.hardware.gross_profit
            + self.apparel.per_user
            + self.energy_per_user
            - self.cloud.blended_cost
        )

    def as_dict(self) -> dict:
        hw, cl, ap = self.hardware, self.cloud, self.apparel
        return {
            "hardware": {
                "price": round(hw.price, 2),
                "batch": hw.batch,
                "manufacturing": round(hw.manufacturing, 2),
                "landed": round(hw.landed, 2),
                "gross_profit": round(hw.gross_profit, 2),
                "gross_margin": round(hw.gross_margin, 4),
            },
            "cloud": {
                "cost_per_turn": round(cl.cost_per_turn, 4),
                "active_user_months": round(cl.active_user_months, 2),
                "baseline_cost": round(cl.baseline_cost, 2),
                "heavy_cost": round(cl.heavy_cost, 2),
                "blended_cost": round(cl.blended_cost, 2),
            },
            "apparel_per_user": round(ap.per_user, 2),
            "energy_per_user": round(self.energy_per_user, 2),
            "ltv": round(self.ltv, 2),
        }

# ==========================================================================
# 六、保本点反解
# ==========================================================================

def breakeven_price(model: Model) -> float:
    """[推导] 让 LTV = 0 的售价。低于这个价，卖一台亏一台。"""
    non_hardware = model.apparel.per_user + model.energy_per_user - model.cloud.blended_cost
    return model.hardware.landed - non_hardware


def breakeven_attach_rate(model: Model) -> float | None:
    """[推导] 若坚持当前售价，娃衣附加购买率至少要多少才能保本。None = 无论多少都保不了。"""
    ap = model.apparel
    unit = ap.sets_per_buyer * ap.price_per_set * ap.margin
    if unit <= 0:
        return None
    gap = (
        model.cloud.blended_cost
        - model.hardware.gross_profit
        - model.energy_per_user
        - ap.virtual_per_user
    )
    if gap <= 0:
        return 0.0
    return gap / unit


def breakeven_batch(model: Model, lo: int = 100, hi: int = 200_000) -> int | None:
    """[推导] 若坚持当前售价，要量产到多少台才能把 LTV 拉正。"""
    probe = Model(
        hardware=Hardware(**{**model.hardware.__dict__, "batch": hi}),
        cloud=model.cloud, apparel=model.apparel, energy=model.energy,
    )
    if probe.ltv <= 0:
        return None  # 规模效应救不回来 —— 这就是「不是量产能解决的问题」
    while lo < hi:
        mid = (lo + hi) // 2
        probe.hardware.batch = mid
        if probe.ltv > 0:
            hi = mid
        else:
            lo = mid + 1
    return lo


# ==========================================================================
# 七、输出
# ==========================================================================

def _w(text: str) -> int:
    """CJK 字符占两列，用于对齐。"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)


def _pad(text: str, width: int) -> str:
    return text + " " * max(0, width - _w(text))


def _row(label: str, value: str, width: int = 30) -> str:
    return f"  {_pad(label, width)}{value:>12}"


def report(model: Model, scenario_name: str = "neutral") -> None:
    hw, cl, ap = model.hardware, model.cloud, model.apparel
    line = "─" * 46

    print("\n芽芽 (Yaya) 单用户经济模型")
    print(f"售价 ¥{hw.price:.0f} · 批量 {hw.batch} 台 · 娃衣情形 {scenario_name}")

    print("\n【硬件落地成本】")
    print(_row("元器件", f"¥{hw._scale(hw.components, hw.component_curve):.2f}"))
    print(_row("PCB 打样 + 贴片 + 开模（摊薄）", f"¥{hw.amortized_fixed:.2f}"))
    print(_row("组装人工", f"¥{hw._scale(hw.assembly_labor, hw.labor_curve):.2f}"))
    print(_row("测试 + 烧录", f"¥{hw.test_flash:.2f}"))
    if hw.cellular:
        print(_row("4G Cat.1 模组", f"¥{hw.cellular:.2f}"))
    print(_row("= 制造成本", f"¥{hw.manufacturing:.2f}"))
    print(_row("+ 包装", f"¥{hw.packaging:.2f}"))
    print(_row("+ 物流", f"¥{hw.logistics:.2f}"))
    print(_row(
        f"+ 不良{hw.defect_rate:.0%} + 退换{hw.return_rate:.0%} 摊销",
        f"¥{hw.shrinkage:.2f}",
    ))
    print("  " + line)
    print(_row("= 落地成本", f"¥{hw.landed:.2f}"))
    print(_row("售价", f"¥{hw.price:.2f}"))
    verdict = "赚" if hw.gross_profit >= 0 else "亏"
    print(_row(
        f"★ 每台{verdict} (毛利率 {hw.gross_margin:.0%})",
        f"¥{abs(hw.gross_profit):.2f}",
    ))

    print("\n【云端成本 · 24 个月】")
    print(_row("单次对话成本", f"¥{cl.cost_per_turn:.3f}"))
    print(_row(
        f"月衰减率 {cl.monthly_decay:.3f} → 有效活跃月",
        f"{cl.active_user_months:.1f} 月",
    ))
    print(_row(f"基准用户（日均 {cl.turns_per_day:.0f} 次）", f"¥{cl.baseline_cost:.2f}"))
    print(_row(f"重度用户（日均 {cl.heavy_turns_per_day:.0f} 次不流失）", f"¥{cl.heavy_cost:.2f}"))
    if cl.heavy_share:
        print(_row(f"加权（重度占比 {cl.heavy_share:.0%}）", f"¥{cl.blended_cost:.2f}"))

    print("\n【第二曲线】")
    print(_row(
        f"实体娃衣（附加率 {ap.attach_rate:.0%} × {ap.sets_per_buyer} 套 × ¥{ap.price_per_set:.0f}）",
        f"¥{ap.physical_per_user:.2f}",
    ))
    if ap.virtual_per_user:
        print(_row("虚拟装扮", f"¥{ap.virtual_per_user:.2f}"))
    print(_row("芽芽能量包", f"¥{model.energy_per_user:.2f}"))

    print("\n【单用户 LTV】")
    print(_row("硬件毛利", f"¥{hw.gross_profit:.2f}"))
    print(_row("+ 娃衣", f"¥{ap.per_user:.2f}"))
    print(_row("+ 能量包", f"¥{model.energy_per_user:.2f}"))
    print(_row("- 云成本", f"¥{cl.blended_cost:.2f}"))
    print("  " + line)
    print(_row("= LTV", f"¥{model.ltv:.2f}"))

    print("\n【保本点】")
    print(_row("保本售价", f"¥{breakeven_price(model):.2f}"))
    ber = breakeven_attach_rate(model)
    print(_row(
        "保本娃衣附加率",
        "已达成" if ber == 0.0 else ("不可达" if ber is None or ber > 1 else f"{ber:.0%}"),
    ))
    bb = breakeven_batch(model)
    print(_row(
        "保本批量",
        "已达成" if hw.gross_profit >= 0 and model.ltv > 0 else
        ("量产救不回来" if bb is None else f"{bb:,} 台"),
    ))
    print()


def volume_table(model: Model) -> None:
    """批量 → 落地成本曲线。回答「量产后能不能优化到 ¥99」。"""
    print(f"\n批量规模效应（售价 ¥{model.hardware.price:.0f}）")
    print(f"  {_pad('批量', 12)}{'落地成本':>12}{'毛利':>10}{'毛利率':>10}{'LTV':>10}")
    print("  " + "─" * 54)
    for batch in (100, 500, 1_000, 2_000, 5_000, 10_000, 50_000, 100_000):
        probe = Model(
            hardware=Hardware(**{**model.hardware.__dict__, "batch": batch}),
            cloud=model.cloud, apparel=model.apparel, energy=model.energy,
        )
        hw = probe.hardware
        print(
            f"  {_pad(f'{batch:,}', 12)}"
            f"{f'¥{hw.landed:.2f}':>12}"
            f"{f'¥{hw.gross_profit:.2f}':>10}"
            f"{f'{hw.gross_margin:.0%}':>10}"
            f"{f'¥{probe.ltv:.0f}':>10}"
        )
    print()


def scenario_table(model: Model) -> None:
    """娃衣三档情形对比 —— 对应文档第四部分那张表。"""
    print(f"\n娃衣情形对比（售价 ¥{model.hardware.price:.0f} · 批量 {model.hardware.batch} 台）")
    print(f"  {_pad('情形', 14)}{'附加率':>8}{'套数':>8}{'均价':>8}{'摊到每用户':>14}{'LTV':>10}")
    print("  " + "─" * 62)
    labels = {"conservative": "保守", "neutral": "中性", "optimistic": "乐观"}
    for key, ap in APPAREL_SCENARIOS.items():
        probe = Model(hardware=model.hardware, cloud=model.cloud, apparel=ap, energy=model.energy)
        print(
            f"  {_pad(labels[key], 14)}"
            f"{f'{ap.attach_rate:.0%}':>8}"
            f"{ap.sets_per_buyer:>8}"
            f"{f'¥{ap.price_per_set:.0f}':>8}"
            f"{f'¥{ap.per_user:.2f}':>14}"
            f"{f'¥{probe.ltv:.0f}':>10}"
        )
    print()

# ==========================================================================
# 八、CLI
# ==========================================================================

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="芽芽单用户经济模型 —— 改参数即重算",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--price", type=float, default=299.0, help="硬件售价")
    p.add_argument("--batch", type=int, default=BASE_BATCH, help="生产批量（台）")
    p.add_argument("--cellular", type=float, default=0.0, help="4G Cat.1 模组成本（随身版 30-40）")
    p.add_argument("--scenario", choices=list(APPAREL_SCENARIOS), default="neutral", help="娃衣情形")
    p.add_argument("--attach-rate", type=float, help="覆盖娃衣附加购买率，如 0.30")
    p.add_argument("--turns", type=float, default=3.0, help="基准用户日均对话次数")
    p.add_argument("--heavy-share", type=float, default=0.0, help="重度用户占比，如 0.10")
    p.add_argument("--free-turns", type=float, default=5.0, help="每天免费对话次数")
    p.add_argument("--volume-table", action="store_true", help="输出批量 → 成本曲线")
    p.add_argument("--scenario-table", action="store_true", help="输出娃衣三档对比")
    p.add_argument("--breakeven", action="store_true", help="只输出保本点")
    p.add_argument("--json", action="store_true", help="机器可读输出")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    apparel = APPAREL_SCENARIOS[args.scenario]
    if args.attach_rate is not None:
        apparel = Apparel(**{**apparel.__dict__, "attach_rate": args.attach_rate})

    model = Model(
        hardware=Hardware(price=args.price, batch=args.batch, cellular=args.cellular),
        cloud=Cloud(turns_per_day=args.turns, heavy_share=args.heavy_share),
        apparel=apparel,
        energy=EnergyPack(free_turns_per_day=args.free_turns),
    )

    if args.json:
        out = model.as_dict()
        out["scenario"] = args.scenario
        out["breakeven"] = {
            "price": round(breakeven_price(model), 2),
            "attach_rate": breakeven_attach_rate(model),
            "batch": breakeven_batch(model),
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    if args.breakeven:
        print(f"\n售价 ¥{model.hardware.price:.0f} · 批量 {model.hardware.batch} 台")
        print(_row("落地成本", f"¥{model.hardware.landed:.2f}"))
        print(_row("LTV", f"¥{model.ltv:.2f}"))
        print(_row("保本售价", f"¥{breakeven_price(model):.2f}"))
        ber = breakeven_attach_rate(model)
        print(_row("保本娃衣附加率",
                   "已达成" if ber == 0.0 else
                   ("不可达" if ber is None or ber > 1 else f"{ber:.0%}")))
        bb = breakeven_batch(model)
        print(_row("保本批量", "量产救不回来" if bb is None else f"{bb:,} 台"))
        print()
        return 0

    report(model, args.scenario)
    if args.volume_table:
        volume_table(model)
    if args.scenario_table:
        scenario_table(model)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
