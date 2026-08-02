// schema.js - 预制数据校验器（Node 测试与运行时通用）
// 校验规则：line 有 id/variants、when 条件键合法、每包必有 fallback 兜底。
var TRIGGERS = [
  'greet_return', 'idle_chat', 'sad_comfort', 'morning_greeting',
  'night_greeting', 'zone_first', 'pet_tap', 'interact', 'fallback', '*'
];
var WHEN_KEYS = ['trigger', 'emotion_any', 'emotion_in', 'has_slot', 'hour_in', 'zone_in', 'interact_in'];

function validateSpecies(s) {
  var errs = [];
  if (!s || !s.id) errs.push('species: missing id');
  if (!s || !s.name) errs.push('species ' + (s && s.id) + ': missing name');
  if (!s || !Array.isArray(s.traits) || s.traits.length === 0) errs.push('species ' + (s && s.id) + ': traits must be non-empty array');
  if (!s || !Array.isArray(s.habitats) || s.habitats.length === 0) errs.push('species ' + (s && s.id) + ': habitats must be non-empty array');
  return errs;
}

function validateLine(line, idx, errs) {
  if (!line || !line.id) errs.push('line#' + idx + ': missing id');
  var id = line && line.id;
  if (!line.when || typeof line.when !== 'object') errs.push('line ' + id + ': missing when');
  else {
    for (var k in line.when) {
      if (WHEN_KEYS.indexOf(k) < 0) errs.push('line ' + id + ': unknown when key "' + k + '"');
    }
    var trig = line.when.trigger;
    if (trig && TRIGGERS.indexOf(trig) < 0) errs.push('line ' + id + ': unknown trigger "' + trig + '"');
  }
  if (!line.variants || !Array.isArray(line.variants) || line.variants.length === 0) {
    errs.push('line ' + id + ': variants must be non-empty');
  } else {
    for (var v = 0; v < line.variants.length; v++) {
      var vt = line.variants[v];
      if (!vt || typeof vt.text !== 'string' || !vt.text.trim()) {
        errs.push('line ' + id + ': variant#' + v + ' missing text');
      }
    }
  }
}

function validatePack(pack, errs) {
  if (!pack || !pack.id) errs.push('pack: missing id');
  var id = pack && pack.id;
  if (!pack.speciesIds || !(pack.speciesIds === '*' || Array.isArray(pack.speciesIds))) {
    errs.push('pack ' + id + ': speciesIds must be "*" or array');
  }
  if (!pack.lines || !Array.isArray(pack.lines) || pack.lines.length === 0) {
    errs.push('pack ' + id + ': lines must be non-empty');
    return;
  }
  var hasFallback = false;
  for (var i = 0; i < pack.lines.length; i++) {
    validateLine(pack.lines[i], i, errs);
    if (pack.lines[i].when && pack.lines[i].when.trigger === 'fallback') hasFallback = true;
  }
  if (!hasFallback) errs.push('pack ' + id + ': missing fallback line (when.trigger="fallback")');
}

function validateAll(species, packs) {
  var errs = [];
  for (var i = 0; i < species.length; i++) {
    errs = errs.concat(validateSpecies(species[i]));
  }
  for (var j = 0; j < packs.length; j++) {
    validatePack(packs[j], errs);
  }
  return { valid: errs.length === 0, errors: errs };
}

module.exports = {
  TRIGGERS: TRIGGERS,
  WHEN_KEYS: WHEN_KEYS,
  validateSpecies: validateSpecies,
  validateLine: validateLine,
  validatePack: validatePack,
  validateAll: validateAll
};
