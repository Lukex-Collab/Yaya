// engine.js - 预制条件选择引擎（"预制为脊柱"的大脑）
// 输入 trigger + 世界状态 -> 按 when 过滤候选 -> seed+计数轮换 -> 输出 {text, emo, side_effects}
// 确定性：同 (seed, count) 同输入必得同结果；连续选句避免重复。
var _last = {};  // speciesId -> lineId

function matchWhen(when, ctx) {
  if (!when) return true;
  ctx = ctx || {};
  if (when.emotion_any && ctx.emotion && when.emotion_any.indexOf(ctx.emotion) < 0) return false;
  if (when.emotion_in && (!ctx.emotion || when.emotion_in.indexOf(ctx.emotion) < 0)) return false;
  if (when.has_slot) {
    var slots = ctx.slots || {};
    for (var i = 0; i < when.has_slot.length; i++) {
      if (slots[when.has_slot[i]] == null) return false;
    }
  }
  if (when.hour_in) {
    var okHour = false;
    var hours = when.hour_in;
    for (var j = 0; j < hours.length; j++) {
      var h = hours[j];
      if (typeof h === 'number') { if (ctx.hour === h) okHour = true; }
      else if (Array.isArray(h) && ctx.hour >= h[0] && ctx.hour <= h[1]) okHour = true;
    }
    if (!okHour) return false;
  }
  if (when.zone_in && when.zone_in.indexOf(ctx.zone) < 0) return false;
  if (when.interact_in && when.interact_in.indexOf(ctx.interactType) < 0) return false;
  return true;
}

// packs: content/packs.js 导出的数组；speciesId: 物种 id
// ctx: {trigger, emotion, hour, zone, slots, interactType}
// opts: {seed, count}
function select(packs, speciesId, ctx, opts) {
  opts = opts || {};
  var seed = (opts.seed == null ? 1 : opts.seed);
  var count = (opts.count == null ? 0 : opts.count);
  var trigger = (ctx && ctx.trigger) || 'idle_chat';
  if (!packs || !speciesId) return null;

  var cands = [];
  var fallbacks = [];
  var found = false;
  for (var i = 0; i < packs.length; i++) {
    var p = packs[i];
    if (!(p.speciesIds === '*' || (Array.isArray(p.speciesIds) && p.speciesIds.indexOf(speciesId) >= 0))) continue;
    found = true;
    for (var j = 0; j < p.lines.length; j++) {
      var line = p.lines[j];
      var w = line.when || {};
      if (w.trigger === 'fallback') { fallbacks.push(line); continue; }
      if (w.trigger && w.trigger !== '*' && w.trigger !== trigger) continue;
      if (matchWhen(w, ctx)) cands.push(line);
    }
  }
  if (!found) return null;

  var chosen = null;
  if (cands.length > 0) {
    var idx = (seed + count) % cands.length;
    var lastId = _last[speciesId];
    if (cands.length > 1 && cands[idx].id === lastId) idx = (idx + 1) % cands.length;
    chosen = cands[idx];
  } else if (fallbacks.length > 0) {
    chosen = fallbacks[0];  // fallbacks 按包序聚合，物种包优先 -> 固定取第一条
  }
  if (!chosen) return null;

  _last[speciesId] = chosen.id;
  var v = chosen.variants[(seed + count) % chosen.variants.length];
  var text = v.text;
  // 槽位模板填充：{favorite} -> ctx.slots.favorite；缺失则保留原样
  if (ctx && ctx.slots) {
    text = text.replace(/\{(\w+)\}/g, function (m, k) {
      return ctx.slots[k] != null ? String(ctx.slots[k]) : m;
    });
  }
  return {
    lineId: chosen.id,
    trigger: trigger,
    text: text,
    emo: v.emo || 'default',
    side_effects: v.side_effects || null,
    audio_ref: v.audio_ref || null
  };
}

module.exports = { select: select, matchWhen: matchWhen };
