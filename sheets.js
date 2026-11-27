/* 캐릭터 시트 (Roll20 2024 시트 데이터를 Foundry VTT 시트처럼 보여 줘요)
   데이터: data/sheets.json (Roll20 GM 화면에서 내보낸 시트 store 그대로) */
(function () {
  'use strict';
  const AB = [['Strength', 'STR', '근력'], ['Dexterity', 'DEX', '민첩'], ['Constitution', 'CON', '건강'], ['Intelligence', 'INT', '지능'], ['Wisdom', 'WIS', '지혜'], ['Charisma', 'CHA', '매력']];
  const SKILL_KO = { Acrobatics: '곡예', 'Animal Handling': '동물 조련', Arcana: '비전학', Athletics: '운동', Deception: '기만', History: '역사', Insight: '통찰', Intimidation: '위협', Investigation: '수사', Medicine: '의학', Nature: '자연', Perception: '감지', Performance: '공연', Persuasion: '설득', Religion: '종교', 'Sleight of Hand': '손재주', Stealth: '은신', Survival: '생존' };
  const SKILL_AB = { Acrobatics: 'Dexterity', 'Animal Handling': 'Wisdom', Arcana: 'Intelligence', Athletics: 'Strength', Deception: 'Charisma', History: 'Intelligence', Insight: 'Wisdom', Intimidation: 'Charisma', Investigation: 'Intelligence', Medicine: 'Wisdom', Nature: 'Intelligence', Perception: 'Wisdom', Performance: 'Charisma', Persuasion: 'Charisma', Religion: 'Intelligence', 'Sleight of Hand': 'Dexterity', Stealth: 'Dexterity', Survival: 'Wisdom' };
  const LV = ['CANTRIP', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH'];
  const SCHOOL_KO = { Abjuration: '방호', Conjuration: '조형', Divination: '예지', Enchantment: '환혹', Evocation: '방출', Illusion: '환영', Necromancy: '사령', Transmutation: '변환' };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const txt = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  const sg = n => (n >= 0 ? '+' : '') + n;
  const md = s => Math.floor((s - 10) / 2);
  let DATA = null, HIST = null, cur = 0, tab = 'main', ver = -1;

  // ---- 시트 계산 (2024 시트 integrants에서) ----
  function calc(p) {
    if (!p.store) return null;
    const I = Object.values(((p.store.integrants || {}).integrants) || {}).filter(v => v._enabled !== false);
    const on = v => !v.cascades;   // 상태이상·주문으로 켜지는 효과(cascades)는 기본으로 꺼진 것으로 봐요
    const T = t => I.filter(v => v.type === t);
    const fv = v => (v.valueFormula && +v.valueFormula.flatValue) || 0;
    const ab = {};
    AB.forEach(([k]) => {
      const L = T('Ability Score').filter(v => v.ability === k && on(v));
      const base = L.filter(v => v.calculation === 'Set Base').reduce((m, v) => Math.max(m, fv(v)), 0) || 10;
      ab[k] = base + L.filter(v => v.calculation === 'Modify').reduce((a, v) => a + fv(v), 0);
    });
    const CL = T('Class Level');
    const classes = {};
    CL.forEach(v => { if (v.name) classes[v.name] = Math.max(classes[v.name] || 0, +v.level || 0); });
    const lvl = Math.max(CL.reduce((m, v) => Math.max(m, +v.totalLevel || 0), 0), Object.values(classes).reduce((a, x) => a + x, 0)) || 1;
    const pb = 2 + Math.floor((lvl - 1) / 4);
    const prof = T('Proficiency');
    const profOf = (cat, name) => { const x = prof.filter(v => v.category === cat && v.proficiency === name).map(v => v.proficiencyLevel); return x.includes('Expertise') ? 2 : x.length ? 1 : 0; };
    const conM = md(ab.Constitution);
    let hpMax = 0;
    T('Hit Points').filter(v => v.hitpointType === 'Maximum' && on(v)).forEach(v => { hpMax += fv(v) + (v.valueFormula && v.valueFormula.ability && v.valueFormula.ability.add ? md(ab[v.valueFormula.ability.name] || 10) : 0); });
    const acL = T('Armor Class').filter(on);
    const acBase = acL.filter(v => v.calculation === 'Set Base').reduce((m, v) => Math.max(m, fv(v)), 0);
    const ac = (acBase || 10 + md(ab.Dexterity)) + acL.filter(v => v.calculation === 'Modify').reduce((a, v) => a + fv(v), 0);
    const speed = T('Speed').filter(v => on(v) && v.calculation !== 'Set Value').reduce((m, v) => Math.max(m, fv(v)), 0) || 30;
    const byId = {}; I.forEach(v => { byId[v._id] = v; });
    const kids = v => { try { return JSON.parse(v.childIDs || '[]').map(id => byId[id]).filter(Boolean); } catch (e) { return []; } };
    const slots = {};
    T('Spell Slot').forEach(v => { const l = +v.spellLevel || 0; if (l) slots[l] = (slots[l] || 0) + fv(v); });
    const curSlots = ((p.store.spellSlots || {}).currentByLevel) || {};
    const cast = T('Spellcasting').find(v => v.casterType !== 'other') || T('Spellcasting')[0];
    const castM = cast ? md(ab[cast.ability] || 10) : 0;
    return {
      I, T, ab, lvl, classes, pb, profOf, hpMax, ac, speed, kids, slots, curSlots, cast, castM,
      hp: p.store.hitpoints || {}, cur: Object.fromEntries(T('Currency').map(v => [v.name, +v.value || 0])),
      species: (T('Species')[0] || {}).name || '', background: T('Background')[0] || null, sub: (T('Subclass')[0] || {}).name || '',
      senses: T('Sense').filter(v => fv(v) > 0).map(v => v.name + ' ' + fv(v) + 'ft'), langs: T('Language').map(v => v.name)
    };
  }

  // ---- 그리기 ----
  const box = (h, b, cls) => `<section class="vs-box ${cls || ''}"><h3>${h}</h3>${b}</section>`;
  function head(p, c) {
    const cls = Object.entries(c.classes).map(([n, l]) => `${n} ${l}`).join(' / ') || '';
    return `<header class="vs-head"><img class="vs-por" src="${esc(p.avatar || '')}" alt="" onerror="this.style.visibility='hidden'">
      <div class="vs-id"><h2>${esc(p.name)}</h2><div class="vs-sub">${esc([cls + (c.sub ? ' (' + c.sub + ')' : ''), c.species, c.background && c.background.name].filter(Boolean).join(' · '))}</div>
      <div class="vs-stats">${stat('레벨', c.lvl)}${stat('숙련', sg(c.pb))}${stat('AC', c.ac)}${stat('HP', `${c.hp.currentHP != null ? c.hp.currentHP : c.hpMax}<small>/${c.hpMax}</small>${c.hp.tempHP ? `<small> +${c.hp.tempHP}</small>` : ''}`)}${stat('이동', c.speed + 'ft')}${stat('선제', sg(md(c.ab.Dexterity)))}</div></div></header>`;
  }
  const stat = (l, v) => `<div class="vs-stat"><span>${l}</span><b>${v}</b></div>`;
  function main(c) {
    const abs = `<div class="vs-abs">${AB.map(([k, s, ko]) => { const m = md(c.ab[k]), sp = c.profOf('Saving Throw', k); return `<div class="vs-ab"><span class="vs-abn">${ko}</span><b class="vs-abm">${sg(m)}</b><span class="vs-abs2">${c.ab[k]}</span><span class="vs-sv${sp ? ' on' : ''}" title="내성">내성 ${sg(m + (sp ? c.pb : 0))}</span></div>`; }).join('')}</div>`;
    const sk = Object.keys(SKILL_KO).map(n => { const lv = c.profOf('Skill', n), a = SKILL_AB[n], v = md(c.ab[a]) + lv * c.pb; return `<li class="${lv ? 'on' : ''}"><i class="vs-dot l${lv}"></i><span>${SKILL_KO[n]}</span><em>${AB.find(x => x[0] === a)[2]}</em><b>${sg(v)}</b></li>`; }).join('');
    const pp = 10 + md(c.ab.Wisdom) + c.profOf('Skill', 'Perception') * c.pb;
    const pr = cat => [...new Set(c.T('Proficiency').filter(v => v.category === cat).map(v => v.proficiency))].join(', ');
    const res = c.T('Resource').map(v => `<li><span>${esc(v.name)}</span><b>${v.value != null ? v.value : ''}${v.maxValueFormula ? '/' + (v.maxValueFormula.customFormula === '@{pb}' ? c.pb : v.maxValueFormula.flatValue) : ''}</b></li>`).join('');
    return abs + `<div class="vs-cols"><div>${box('기술', `<ul class="vs-skills">${sk}</ul>`)}</div><div>`
      + box('감각 · 언어', `<p>수동 감지 <b>${pp}</b>${c.senses.length ? ' · ' + esc(c.senses.join(', ')) : ''}</p><p>${esc(c.langs.join(', ') || '-')}</p>`)
      + box('숙련', `<p><b>갑옷</b> ${esc(pr('Armor') || '-')}</p><p><b>무기</b> ${esc(pr('Weapon') || '-')}</p><p><b>도구</b> ${esc(pr('Tool') || '-')}</p>`)
      + (res ? box('자원', `<ul class="vs-list">${res}</ul>`) : '')
      + box('공격', attacks(c)) + `</div></div>`;
  }
  function attacks(c) {
    const A = c.T('Attack');
    if (!A.length) return '<p class="vs-mut">없음</p>';
    return `<ul class="vs-atk">${A.map(a => { const d = c.kids(a).filter(k => k.type === 'Damage').map(k => `${k._diceCount || ''}${k.diceSize || ''} ${k.damageType || ''}`.trim()).join(' + ');
      return `<li><details><summary><b>${esc(a.name)}</b><span>${esc([a.attack && a.attack.type, a.range].filter(Boolean).join(' · '))}</span><em>${esc(d)}</em></summary>${a.description ? `<div class="vs-desc">${txt(a.description)}</div>` : ''}</details></li>`; }).join('')}</ul>`;
  }
  function inventory(c) {
    const it = c.T('Item');
    const cur = ['Platinum', 'Gold', 'Electrum', 'Silver', 'Copper'].map(k => `<span class="vs-coin"><b>${c.cur[k] || 0}</b>${{ Platinum: 'pp', Gold: 'gp', Electrum: 'ep', Silver: 'sp', Copper: 'cp' }[k]}</span>`).join('');
    const w = it.reduce((a, v) => a + (+v.weight || 0) * (+v.quantity || 1), 0);
    return `<div class="vs-coins">${cur}<span class="vs-mut">무게 합계 ${Math.round(w * 10) / 10} lb</span></div><ul class="vs-items">${it.map(v => `<li><details><summary><b>${esc(v.name)}</b>${v.equipData && v.equipData.equipped ? '<i class="vs-eq">장착</i>' : ''}<span>×${v.quantity || 1}</span><em>${v.weight ? v.weight + ' lb' : ''}</em></summary>${v.description ? `<div class="vs-desc">${txt(v.description)}</div>` : '<div class="vs-desc vs-mut">설명 없음</div>'}</details></li>`).join('') || '<li class="vs-mut">없음</li>'}</ul>`;
  }
  function features(c) {
    const F = c.T('Features').concat(c.T('Action'));
    const by = {}; F.forEach(v => { const s = v.source || '기타'; (by[s] = by[s] || []).push(v); });
    const SRC = { Class: '클래스', Subclass: '하위 클래스', Species: '종족', Background: '배경', Feat: '재주', Spell: '주문', Item: '아이템', Other: '기타', Custom: '직접 추가' };
    const seen = new Set();
    return Object.keys(by).map(s => box(SRC[s] || s, `<ul class="vs-items">${by[s].filter(v => { const k = v.name + '|' + (v.description || '').slice(0, 30); if (seen.has(k)) return false; seen.add(k); return true; }).map(v => `<li><details><summary><b>${esc(v.name)}</b>${v.actionType ? `<span>${esc(v.actionType)}</span>` : ''}</summary><div class="vs-desc">${txt(v.description || '')}</div></details></li>`).join('')}</ul>`)).join('') || '<p class="vs-mut">없음</p>';
  }
  function spells(c) {
    const S = c.T('Spell');
    if (!S.length) return '<p class="vs-mut">주문 없음</p>';
    const dc = c.cast ? 8 + c.pb + c.castM : null;
    const head = c.cast ? `<div class="vs-coins"><span>주문 능력 <b>${esc(AB.find(x => x[0] === c.cast.ability)[2])}</b></span><span>내성 DC <b>${dc}</b></span><span>주문 공격 <b>${sg(c.pb + c.castM)}</b></span></div>` : '';
    const lv = {}; S.forEach(v => { (lv[+v.level || 0] = lv[+v.level || 0] || []).push(v); });
    return head + Object.keys(lv).sort((a, b) => a - b).map(l => { const mx = c.slots[l] || 0, cu = c.curSlots[LV[l]]; const pips = mx ? `<span class="vs-pips">${Array.from({ length: mx }, (_, i) => `<i class="${i < (cu != null ? cu : mx) ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return box((+l ? l + '레벨' : '소마법') + pips, `<ul class="vs-items">${lv[l].sort((a, b) => a.name.localeCompare(b.name)).map(v => { const co = v.components || {}; return `<li><details><summary><b>${esc(v.name)}</b><span>${esc(SCHOOL_KO[String(v.school || '').replace(/^./, x => x.toUpperCase())] || v.school || '')}</span><em>${esc([v.castingTime, v.range, v.duration].filter(Boolean).join(' · '))}</em></summary><div class="vs-desc"><p class="vs-mut">${[co.verbal && 'V', co.somatic && 'S', co.material && 'M'].filter(Boolean).join(' ')}${co.materialDescription ? ' (' + esc(co.materialDescription) + ')' : ''}${v.concentration ? ' · 집중' : ''}${v.ritual ? ' · 의식' : ''}</p>${txt(v.description || '')}${v.upcastText ? `<p><b>더 높은 레벨로</b> ${txt(v.upcastText)}</p>` : ''}</div></details></li>`; }).join('')}</ul>`); }).join('');
  }
  function about(p, c) {
    const ch = ((p.store.about || {}).characteristics) || {};
    const K = { age: '나이', height: '키', weight: '몸무게', eyeColor: '눈', hairColor: '머리', skinColor: '피부', size: '크기', gender: '성별', alignment: '성향', faith: '신앙' };
    const bg = c.background;
    const notes = ((p.store.notes || {}).notes) || {};
    return box('외모', `<ul class="vs-list">${Object.keys(ch).map(k => `<li><span>${esc(K[k] || k)}</span><b>${esc(ch[k])}</b></li>`).join('') || '<li class="vs-mut">없음</li>'}</ul>`)
      + (bg ? box('배경 · ' + esc(bg.name), `<div class="vs-desc">${txt(bg.description || '')}</div>`) : '')
      + (Object.keys(notes).length ? box('메모', Object.values(notes).map(n => `<div class="vs-desc">${txt(typeof n === 'string' ? n : (n.title ? n.title + '\n' : '') + (n.content || n.text || ''))}</div>`).join('')) : '');
  }
  function histBar(p0) {
    const H = (HIST && HIST.pcs && HIST.pcs[p0.id]) || [];
    if (!H.length) return '';
    const opt = (v, l) => `<option value="${v}"${ver === v ? ' selected' : ''}>${l}</option>`;
    return `<div class="vs-hist"><label>레벨 기록 <select data-vh>${opt(-1, '지금')}${H.map((h, i) => [h, i]).reverse().map(([h, i]) => opt(i, 'Lv ' + h.level + ' (' + esc((h.saved || '').slice(0, 10)) + ')')).join('')}</select></label>${ver >= 0 ? '<span>예전 기록을 보고 있어요</span>' : ''}</div>`;
  }

  // ---- 예전 시트 (OGL 5e) ----
  function ogl(p) {
    const a = p.attrs || {}, v = k => (a[k] ? a[k][0] : ''), mx = k => (a[k] ? a[k][1] : '');
    const R = {};
    Object.keys(a).forEach(k => { const m = k.match(/^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/); if (!m) return; const g = R[m[1]] = R[m[1]] || {}; (g[m[2]] = g[m[2]] || {})[m[3]] = a[k][0]; });
    const rows = sec => Object.values(R[sec] || {});
    const num = x => +String(x).replace(/[^\d-]/g, '') || 0;
    const AK = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const SK = { acrobatics: 'Acrobatics', animal_handling: 'Animal Handling', arcana: 'Arcana', athletics: 'Athletics', deception: 'Deception', history: 'History', insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation', medicine: 'Medicine', nature: 'Nature', perception: 'Perception', performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion', sleight_of_hand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival' };
    const pb = num(v('pb')) || 2;
    const headH = `<header class="vs-head"><img class="vs-por" src="${esc(p.avatar || '')}" alt="" onerror="this.style.visibility='hidden'"><div class="vs-id"><h2>${esc(p.name)}</h2><div class="vs-sub">${esc([v('class_display'), v('race_display') || v('race'), v('background')].filter(Boolean).join(' · '))} · 예전 시트</div>
      <div class="vs-stats">${stat('레벨', v('level') || '-')}${stat('숙련', sg(pb))}${stat('AC', v('ac') || '-')}${stat('HP', `${v('hp') || 0}<small>/${mx('hp') || '-'}</small>${num(v('hp_temp')) ? `<small> +${v('hp_temp')}</small>` : ''}`)}${stat('이동', (v('speed') || 30) + 'ft')}${stat('선제', sg(num(v('initiative_bonus'))))}</div></div></header>`;
    let page = '';
    if (tab === 'main') {
      page = `<div class="vs-abs">${AK.map((k, i) => { const sp = !!v(k + '_save_prof'); return `<div class="vs-ab"><span class="vs-abn">${AB[i][2]}</span><b class="vs-abm">${sg(num(v(k + '_mod')))}</b><span class="vs-abs2">${v(k) || 10}</span><span class="vs-sv${sp ? ' on' : ''}">내성 ${sg(num(v(k + '_save_bonus')))}</span></div>`; }).join('')}</div>`
        + `<div class="vs-cols"><div>${box('기술', `<ul class="vs-skills">${Object.keys(SK).map(k => { const on = !!v(k + '_prof'); const ab = SKILL_AB[SK[k]]; return `<li class="${on ? 'on' : ''}"><i class="vs-dot l${on ? 1 : 0}"></i><span>${SKILL_KO[SK[k]]}</span><em>${AB.find(x => x[0] === ab)[2]}</em><b>${sg(num(v(k + '_bonus')))}</b></li>`; }).join('')}</ul>`)}</div><div>`
        + box('감각 · 언어', `<p>수동 감지 <b>${v('passive_wisdom') || '-'}</b></p><p>${esc(rows('proficiencies').filter(r => r.prof_type === 'LANGUAGE').map(r => r.name).join(', ') || '-')}</p>`)
        + box('숙련', `<p>${esc(rows('proficiencies').filter(r => r.prof_type !== 'LANGUAGE').map(r => r.name).join(', ') || '-')}</p>${rows('tool').length ? `<p><b>도구</b> ${esc(rows('tool').map(r => r.toolname).join(', '))}</p>` : ''}`)
        + box('공격', rows('attack').length ? `<ul class="vs-atk">${rows('attack').map(r => `<li><details><summary><b>${esc(r.atkname)}</b><span>${esc(r.atkrange || '')}</span><em>${esc([r.atkbonus, r.dmgbase && !/[@\[]/.test(r.dmgbase) && r.dmgbase + ' ' + (r.dmgtype || '')].filter(Boolean).join(' · '))}</em></summary>${r.atk_desc || r.desc ? `<div class="vs-desc">${txt(r.atk_desc || r.desc)}</div>` : ''}</details></li>`).join('')}</ul>` : '<p class="vs-mut">없음</p>') + `</div></div>`;
    } else if (tab === 'inv') {
      const coins = ['pp', 'gp', 'ep', 'sp', 'cp'].map(k => `<span class="vs-coin"><b>${num(v(k))}</b>${k}</span>`).join('');
      page = `<div class="vs-coins">${coins}</div><ul class="vs-items">${rows('inventory').map(r => `<li><details><summary><b>${esc(r.itemname)}</b>${r.equipped === '1' ? '<i class="vs-eq">장착</i>' : ''}<span>×${esc(r.itemcount || 1)}</span><em>${r.itemweight ? esc(r.itemweight) + ' lb' : ''}</em></summary>${r.itemcontent ? `<div class="vs-desc">${txt(r.itemcontent)}</div>` : '<div class="vs-desc vs-mut">설명 없음</div>'}</details></li>`).join('') || '<li class="vs-mut">없음</li>'}</ul>`;
    } else if (tab === 'feat') {
      const by = {}; rows('traits').forEach(r => { (by[r.source || '기타'] = by[r.source || '기타'] || []).push(r); });
      const SRC = { Class: '클래스', Racial: '종족', Background: '배경', Feat: '재주', Item: '아이템', Other: '기타' };
      page = Object.keys(by).map(s => box(SRC[s] || s, `<ul class="vs-items">${by[s].map(r => `<li><details><summary><b>${esc(r.name)}</b>${r.source_type ? `<span>${esc(r.source_type)}</span>` : ''}</summary><div class="vs-desc">${txt(r.description || '')}</div></details></li>`).join('')}</ul>`)).join('') || '<p class="vs-mut">없음</p>';
    } else if (tab === 'spell') {
      const secs = ['cantrip', 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => rows('spell-' + l).length);
      page = !secs.length ? '<p class="vs-mut">주문 없음</p>' : (num(v('spell_save_dc')) ? `<div class="vs-coins"><span>내성 DC <b>${v('spell_save_dc')}</b></span><span>주문 공격 <b>${sg(num(v('spell_attack_bonus')))}</b></span></div>` : '')
        + secs.map(l => { const tot = l === 'cantrip' ? 0 : num(v('lvl' + l + '_slots_total')), used = l === 'cantrip' ? 0 : num(v('lvl' + l + '_slots_expended')); const pips = tot ? `<span class="vs-pips">${Array.from({ length: tot }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('')}</span>` : '';
          return box((l === 'cantrip' ? '소마법' : l + '레벨') + pips, `<ul class="vs-items">${rows('spell-' + l).map(r => `<li><details><summary><b>${esc(r.spellname)}</b><span>${esc(SCHOOL_KO[String(r.spellschool || '').replace(/^./, x => x.toUpperCase())] || r.spellschool || '')}</span><em>${esc([r.spellcastingtime, r.spellrange, r.spellduration].filter(Boolean).join(' · '))}</em></summary><div class="vs-desc">${txt(r.spelldescription || '')}${r.spellathigherlevels ? `<p><b>더 높은 레벨로</b> ${txt(r.spellathigherlevels)}</p>` : ''}</div></details></li>`).join('')}</ul>`); }).join('');
    } else {
      const K = [['age', '나이'], ['height', '키'], ['weight', '몸무게'], ['eyes', '눈'], ['hair', '머리'], ['skin', '피부'], ['alignment', '성향']];
      const T = [['personality_traits', '성격'], ['ideals', '이상'], ['bonds', '유대'], ['flaws', '단점']];
      page = box('외모', `<ul class="vs-list">${K.filter(([k]) => v(k)).map(([k, l]) => `<li><span>${l}</span><b>${esc(v(k))}</b></li>`).join('') || '<li class="vs-mut">없음</li>'}</ul>`)
        + T.filter(([k]) => v(k)).map(([k, l]) => box(l, `<div class="vs-desc">${txt(v(k))}</div>`)).join('');
    }
    return headH + page;
  }
  function sheet() {
    const p0 = DATA.pcs[cur], el = document.getElementById('vs-body');
    const H = p0 && HIST && HIST.pcs && HIST.pcs[p0.id];
    const p = p0 && ver >= 0 && H && H[ver] ? Object.assign({}, p0, H[ver]) : p0;
    if (!p) { el.innerHTML = ''; return; }
    const T = [['main', '능력치'], ['inv', '소지품'], ['feat', '특성'], ['spell', '주문'], ['about', '소개']];
    const nav = `<nav class="vs-tabs">${T.map(([k, l]) => `<button data-vt="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
    if (!p.store) { const h = ogl(p), i = h.indexOf('</header>') + 9; el.innerHTML = histBar(p0) + h.slice(0, i) + nav + '<div class="vs-page">' + h.slice(i) + '</div>'; return; }
    const c = calc(p);
    el.innerHTML = histBar(p0) + head(p, c) + nav + `<div class="vs-page">${tab === 'main' ? main(c) : tab === 'inv' ? inventory(c) : tab === 'feat' ? features(c) : tab === 'spell' ? spells(c) : about(p, c)}</div>`;
  }
  function list() {
    document.getElementById('vs-list').innerHTML = DATA.pcs.map((p, i) => `<button data-vi="${i}" class="${i === cur ? 'on' : ''}"><img src="${esc(p.avatar || '')}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(p.name)}</span></button>`).join('')
      + `<p class="vs-mut vs-when">${esc(DATA.game)} · ${esc((DATA.exported || '').slice(0, 10))} 기준</p>`;
  }
  function open() {
    let m = document.getElementById('vs-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'vs-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', '캐릭터 시트');
      m.innerHTML = `<div class="vs-win"><aside id="vs-list"></aside><div class="vs-main"><button class="vs-x" aria-label="닫기">×</button><div id="vs-body"><p class="vs-mut">불러오는 중…</p></div></div></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => {
        if (e.target === m || e.target.closest('.vs-x')) { m.style.display = 'none'; return; }
        const b = e.target.closest('[data-vi]'); if (b) { cur = +b.dataset.vi; tab = 'main'; ver = -1; list(); sheet(); return; }
        const t = e.target.closest('[data-vt]'); if (t) { tab = t.dataset.vt; sheet(); }
      });
      m.addEventListener('change', e => { const s = e.target.closest('[data-vh]'); if (s) { ver = +s.value; sheet(); } });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.style.display !== 'none') m.style.display = 'none'; });
    }
    m.style.display = 'flex';
    if (DATA) { list(); sheet(); return; }
    fetch('data/sheets.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
      d.pcs = d.pcs.filter(p => p.store || (p.attrs && p.attrs.strength));
      DATA = d; list(); sheet();
      fetch('data/sheets_history.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(h => { if (h) { HIST = h; sheet(); } }).catch(() => {});
    }).catch(e => { document.getElementById('vs-body').innerHTML = `<p class="vs-mut">시트 데이터를 못 불러왔어요 (${esc(e.message)})</p>`; });
  }
  window.vsOpen = open;

  const css = `
  #vs-modal{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(10,8,6,.62);font-family:'Signika','Noto Sans KR',sans-serif}
  .vs-win{display:grid;grid-template-columns:200px minmax(0,1fr);width:min(1080px,96vw);height:min(860px,92vh);background:#f3eee1 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");border:1px solid #7a6a53;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.6);overflow:hidden;color:#191813}
  #vs-list{background:#23221d;color:#e7e1d4;overflow:auto;padding:8px}
  #vs-list button{display:flex;align-items:center;gap:8px;width:100%;padding:6px;margin:0 0 4px;border:1px solid transparent;border-radius:4px;background:none;color:inherit;font:inherit;font-size:14px;text-align:left;cursor:pointer;min-height:44px}
  #vs-list button.on,#vs-list button:hover{background:#3d3a31;border-color:#7a6a53}
  #vs-list img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #7a6a53;flex:none;background:#444}
  .vs-when{font-size:12px;padding:8px 4px}
  .vs-main{position:relative;overflow:auto;padding:16px 20px}
  .vs-x{position:absolute;right:10px;top:8px;width:36px;height:36px;border:0;background:none;font-size:26px;color:#7a1f1f;cursor:pointer}
  .vs-head{display:flex;gap:16px;align-items:center;padding-bottom:10px;border-bottom:2px groove #c9c7b8}
  .vs-por{width:104px;height:104px;object-fit:cover;border:2px solid #7a6a53;border-radius:4px;background:#ddd;flex:none}
  .vs-id h2{margin:0;font-family:'Modesto Condensed','Cinzel',Georgia,serif;font-size:30px;color:#4b0000;line-height:1.1}
  .vs-sub{color:#4f4b43;font-size:14px;margin:2px 0 8px}
  .vs-stats{display:flex;flex-wrap:wrap;gap:6px}
  .vs-stat{min-width:64px;padding:3px 8px;border:1px solid #c9c7b8;border-radius:3px;background:rgba(255,255,255,.45);text-align:center}
  .vs-stat span{display:block;font-size:11px;color:#7a6a53;text-transform:uppercase;letter-spacing:.5px}
  .vs-stat b{font-size:18px}.vs-stat small{font-size:12px;color:#7a6a53}
  .vs-tabs{display:flex;gap:2px;margin:12px 0 10px;border-bottom:1px solid #c9c7b8;flex-wrap:wrap}
  .vs-tabs button{font:inherit;font-size:15px;padding:6px 14px;border:0;border-bottom:3px solid transparent;background:none;color:#4f4b43;cursor:pointer;min-height:40px}
  .vs-tabs button.on{color:#4b0000;border-bottom-color:#7a1f1f;font-weight:700}
  .vs-abs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:12px}
  .vs-ab{display:flex;flex-direction:column;align-items:center;padding:6px 4px 8px;border:1px solid #c9c7b8;border-radius:6px;background:rgba(255,255,255,.5)}
  .vs-abn{font-size:13px;color:#7a6a53}.vs-abm{font-size:26px;line-height:1.1}.vs-abs2{font-size:13px;padding:0 8px;border:1px solid #c9c7b8;border-radius:10px;background:#fff}
  .vs-sv{font-size:12px;margin-top:4px;color:#7a6a53}.vs-sv.on{color:#4b0000;font-weight:700}
  .vs-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:12px}
  .vs-box{border:1px solid #c9c7b8;border-radius:4px;background:rgba(255,255,255,.35);margin:0 0 10px;padding:6px 10px 8px}
  .vs-box h3{margin:0 0 6px;padding-bottom:3px;border-bottom:1px solid #c9c7b8;font-family:'Modesto Condensed','Cinzel',Georgia,serif;font-size:17px;color:#4b0000;display:flex;align-items:center;gap:8px}
  .vs-box p{margin:3px 0;font-size:14px}
  .vs-skills,.vs-list,.vs-items,.vs-atk{list-style:none;margin:0;padding:0}
  .vs-skills li{display:grid;grid-template-columns:14px 1fr auto 36px;gap:6px;align-items:center;font-size:14px;padding:2px 0;border-bottom:1px dotted #d8d4c5}
  .vs-skills li.on{font-weight:700}.vs-skills em{font-style:normal;font-size:11px;color:#7a6a53}.vs-skills b{text-align:right}
  .vs-dot{width:10px;height:10px;border-radius:50%;border:1px solid #7a6a53;display:inline-block}.vs-dot.l1{background:#7a1f1f}.vs-dot.l2{background:#7a1f1f;box-shadow:0 0 0 2px #f3eee1,0 0 0 3px #7a1f1f}
  .vs-list li{display:flex;justify-content:space-between;font-size:14px;padding:2px 0;border-bottom:1px dotted #d8d4c5}
  .vs-items li,.vs-atk li{border-bottom:1px solid #ddd8c8}
  .vs-items summary,.vs-atk summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:5px 2px;cursor:pointer;font-size:14px;list-style:none}
  .vs-items summary::-webkit-details-marker,.vs-atk summary::-webkit-details-marker{display:none}
  .vs-items summary span,.vs-atk summary span{font-size:12px;color:#7a6a53}.vs-items summary em,.vs-atk summary em{font-style:normal;font-size:12px;color:#4f4b43;text-align:right}
  .vs-eq{font-style:normal;font-size:11px;background:#7a1f1f;color:#fff;border-radius:8px;padding:0 6px;margin-left:6px}
  .vs-desc{font-size:14px;line-height:1.6;padding:4px 6px 10px;color:#2b2a24}
  .vs-mut{color:#7a6a53}
  .vs-hist{display:flex;gap:10px;align-items:center;margin:0 44px 8px 0;font-size:13px;color:#4f4b43}.vs-hist select{font:inherit;padding:3px 6px;border:1px solid #c9c7b8;border-radius:3px;background:#fff;min-height:30px}.vs-hist span{color:#7a1f1f}
  .vs-coins{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 10px;font-size:14px}
  .vs-coin{padding:2px 10px;border:1px solid #c9c7b8;border-radius:12px;background:#fff}.vs-coin b{margin-right:3px}
  .vs-pips{display:inline-flex;gap:3px;margin-left:auto}.vs-pips i{width:12px;height:12px;border:1px solid #7a1f1f;transform:rotate(45deg);display:inline-block}.vs-pips i.on{background:#7a1f1f}
  @media(max-width:760px){.vs-win{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}#vs-list{display:flex;overflow-x:auto}#vs-list button{width:auto;flex:none}.vs-abs{grid-template-columns:repeat(3,minmax(0,1fr))}.vs-cols{grid-template-columns:1fr}.vs-head{flex-wrap:wrap}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=Signika:wght@400;600;700&family=Cinzel:wght@600&display=swap'; document.head.appendChild(lk);
  // 상단 바에 버튼
  function addBtn() {
    const g = document.querySelector('.top-bar .tab-group'); if (!g || document.getElementById('tab-sheets')) return;
    const b = document.createElement('button'); b.className = 'btn btn-tab'; b.id = 'tab-sheets'; b.title = '캐릭터 시트'; b.setAttribute('aria-label', '캐릭터 시트');
    b.innerHTML = `<img class="ico-img tab-ico" alt="" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M14 6h28l10 10v42H14z" fill="#efe3c4" stroke="#5a3a1e" stroke-width="3"/><path d="M42 6v10h10" fill="#d9c79b" stroke="#5a3a1e" stroke-width="3"/><path d="M33 22l11 4v8c0 7-5 11-11 13-6-2-11-6-11-13v-8z" fill="#8a2a1a" stroke="#5a3a1e" stroke-width="2.5"/><path d="M20 52h24" stroke="#5a3a1e" stroke-width="3"/></svg>')}">`;
    b.addEventListener('click', open);
    const map = document.getElementById('tab-map'); g.insertBefore(b, map ? map.nextSibling : null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
  setTimeout(addBtn, 1500);
})();
