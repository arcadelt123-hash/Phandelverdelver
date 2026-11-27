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

  function sxPick(chars, names) {   // 저널에 PC로 등록한 이름 → Roll20 캐릭터 하나씩 (이름이 조금 달라도: '바를로니카야 루벡' → '바를로')
    const nm = s => String(s || '').replace(/[?*？]+/g, '').replace(/\s+/g, ' ').trim();
    const out = [];
    names.forEach(J => { const j = nm(J); if (!j) return; let best = null, bs = -1;
      chars.forEach(c => { const n = nm(c.name); if (!n) return; const exact = n === j; if (!exact && !(n.length >= 2 && (j.startsWith(n) || n.startsWith(j)))) return;
        const sc = (exact ? 100 : 0) + (c.sheet === 'dnd2024byroll20' ? 10 : 0) + (/[?*？]/.test(c.name) ? 0 : 5) + (n.length / 100); if (sc > bs) { bs = sc; best = c; } });
      if (best && !out.some(o => o.c.id === best.id)) out.push({ c: best, j: J }); });
    return out;
  }

  // ---- 아이콘 (Tidy5e처럼): 주문 = 주문 아이콘 짝 맞추기 페이지, 무기·아이템 = 상점 데이터, 특성 = 출처별 그림 ----
  let ICO = null, icoLoading = null;
  const inorm = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9가-힣]+/g, ' ').trim();
  function icons() {
    if (ICO) return Promise.resolve(ICO); if (icoLoading) return icoLoading;
    const sp = fetch('/Phandelverdelver/spell_icons.html').then(r => r.ok ? r.text() : '').then(t => { const m = {}; if (!t) return m; const d = new DOMParser().parseFromString(t, 'text/html');
      d.querySelectorAll('.pr').forEach(p => { const im = p.querySelector('img'), sn = p.querySelector('span'); if (!im || !sn) return; sn.textContent.split('·').forEach(n => { const k = inorm(n.replace(/\./g, ' ')); if (k && !m[k]) m[k] = im.getAttribute('src'); }); }); return m; }).catch(() => ({}));
    const it = fetch('shop_data/items.json').then(r => r.ok ? r.json() : []).then(L => { const m = {}; L.forEach(x => { const k = inorm(x.n); if (x.img && !m[k]) m[k] = x.img; }); return m; }).catch(() => ({}));
    icoLoading = Promise.all([sp, it]).then(([s2, i2]) => { ICO = { sp: s2, it: i2 }; try { window.dispatchEvent(new Event('vs-icons')); } catch (e) {} return ICO; });
    return icoLoading;
  }
  const SVG = (p, c) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${c}"/>${p}</svg>`);
  const FICO = { Class: SVG('<path d="M9 7h11l3 3v15H9z" fill="none" stroke="#f3e6c4" stroke-width="2"/><path d="M12 14h8M12 18h8M12 22h5" stroke="#f3e6c4" stroke-width="2"/>', '#6a3b2a'), Subclass: SVG('<path d="M16 6l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#f3e6c4"/>', '#4a3b6a'),
    Species: SVG('<path d="M16 26c-6-4-8-9-6-15 3 2 5 2 6 0 1 2 3 2 6 0 2 6 0 11-6 15z" fill="#f3e6c4"/>', '#3b5a3a'), Background: SVG('<path d="M8 24V9l8-3 8 3v15l-8-3z" fill="none" stroke="#f3e6c4" stroke-width="2"/>', '#5a4a2a'),
    Feat: SVG('<circle cx="16" cy="16" r="7" fill="none" stroke="#f3e6c4" stroke-width="2.5"/><circle cx="16" cy="16" r="2.5" fill="#f3e6c4"/>', '#2a4a6a'), def: SVG('<circle cx="16" cy="16" r="5" fill="#f3e6c4"/>', '#5a5a5a') };
  const ic = u => u ? `<img class="vs-ic" src="${esc(u)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
  const spIc = n => ICO && ICO.sp[inorm(n)] || '';
  const itIc = n => ICO && ICO.it[inorm(n)] || '';

  // ---- 그리기 ----
  const box = (h, b, cls) => `<section class="vs-box ${cls || ''}"><h3>${h}</h3>${b}</section>`;
  function head(p, c) {
    const cls = Object.entries(c.classes).map(([n, l]) => `${n} ${l}`).join(' / ') || '';
    return `<header class="vs-head"><img class="vs-por" src="${esc(p.avatar || '')}" alt="" onerror="this.style.visibility='hidden'">
      <div class="vs-id"><h2>${esc(p.name)}</h2><div class="vs-sub">${esc([cls + (c.sub ? ' (' + c.sub + ')' : ''), c.species, c.background && c.background.name].filter(Boolean).join(' · '))}</div>
      <div class="vs-stats">${stat('레벨', c.lvl)}${stat('숙련', sg(c.pb))}${stat('AC', c.ac)}${stat('최대 HP', c.hpMax)}${stat('속도', c.speed + 'ft')}${stat('선제권', sg(md(c.ab.Dexterity)))}</div></div></header>`;
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
      return `<li><details><summary><b>${ic(itIc(a.name) || spIc(a.name))}${esc(a.name)}</b><span>${esc([a.attack && a.attack.type, a.range].filter(Boolean).join(' · '))}</span><em>${esc(d)}</em></summary>${a.description ? `<div class="vs-desc">${txt(a.description)}</div>` : ''}</details></li>`; }).join('')}</ul>`;
  }
  function inventory(c) {
    const it = c.T('Item');
    const cur = ['Platinum', 'Gold', 'Electrum', 'Silver', 'Copper'].map(k => `<span class="vs-coin"><b>${c.cur[k] || 0}</b>${{ Platinum: 'pp', Gold: 'gp', Electrum: 'ep', Silver: 'sp', Copper: 'cp' }[k]}</span>`).join('');
    const w = it.reduce((a, v) => a + (+v.weight || 0) * (+v.quantity || 1), 0);
    return `<div class="vs-coins">${cur}<span class="vs-mut">무게 합계 ${Math.round(w * 10) / 10} lb</span></div><ul class="vs-items">${it.map(v => `<li><details><summary><b>${ic(itIc(v.name))}${esc(v.name)}</b>${v.equipData && v.equipData.equipped ? '<i class="vs-eq">장착</i>' : ''}<span>×${v.quantity || 1}</span><em>${v.weight ? v.weight + ' lb' : ''}</em></summary>${v.description ? `<div class="vs-desc">${txt(v.description)}</div>` : '<div class="vs-desc vs-mut">설명 없음</div>'}</details></li>`).join('') || '<li class="vs-mut">없음</li>'}</ul>`;
  }
  function features(c) {
    const F = c.T('Features').concat(c.T('Action'));
    const by = {}; F.forEach(v => { const s = v.source || '기타'; (by[s] = by[s] || []).push(v); });
    const SRC = { Class: '클래스', Subclass: '하위 클래스', Species: '종족', Background: '배경', Feat: '재주', Spell: '주문', Item: '아이템', Other: '기타', Custom: '직접 추가' };
    const seen = new Set();
    return Object.keys(by).map(s => box(SRC[s] || s, `<ul class="vs-items">${by[s].filter(v => { const k = v.name + '|' + (v.description || '').slice(0, 30); if (seen.has(k)) return false; seen.add(k); return true; }).map(v => `<li><details><summary><b>${ic(spIc(v.name) || FICO[v.source] || FICO.def)}${esc(v.name)}</b>${v.actionType ? `<span>${esc(v.actionType)}</span>` : ''}</summary><div class="vs-desc">${txt(v.description || '')}</div></details></li>`).join('')}</ul>`)).join('') || '<p class="vs-mut">없음</p>';
  }
  function spells(c) {
    const S = c.T('Spell');
    if (!S.length) return '<p class="vs-mut">주문 없음</p>';
    const dc = c.cast ? 8 + c.pb + c.castM : null;
    const head = c.cast ? `<div class="vs-coins"><span>주문 능력 <b>${esc(AB.find(x => x[0] === c.cast.ability)[2])}</b></span><span>내성 DC <b>${dc}</b></span><span>주문 공격 <b>${sg(c.pb + c.castM)}</b></span></div>` : '';
    const lv = {}; S.forEach(v => { (lv[+v.level || 0] = lv[+v.level || 0] || []).push(v); });
    return head + Object.keys(lv).sort((a, b) => a - b).map(l => { const mx = c.slots[l] || 0, cu = c.curSlots[LV[l]]; const pips = mx ? `<span class="vs-pips">${Array.from({ length: mx }, (_, i) => `<i class="${i < (cu != null ? cu : mx) ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return box((+l ? l + '레벨' : '소마법') + pips, `<ul class="vs-items">${lv[l].sort((a, b) => a.name.localeCompare(b.name)).map(v => { const co = v.components || {}; return `<li><details><summary><b>${ic(spIc(v.name))}${esc(v.name)}</b><span>${esc(SCHOOL_KO[String(v.school || '').replace(/^./, x => x.toUpperCase())] || v.school || '')}</span><em>${esc([v.castingTime, v.range, v.duration].filter(Boolean).join(' · '))}</em></summary><div class="vs-desc"><p class="vs-mut">${[co.verbal && 'V', co.somatic && 'S', co.material && 'M'].filter(Boolean).join(' ')}${co.materialDescription ? ' (' + esc(co.materialDescription) + ')' : ''}${v.concentration ? ' · 집중' : ''}${v.ritual ? ' · 의식' : ''}</p>${txt(v.description || '')}${v.upcastText ? `<p><b>더 높은 레벨로</b> ${txt(v.upcastText)}</p>` : ''}</div></details></li>`; }).join('')}</ul>`); }).join('');
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
    const headH = `<header class="vs-head"><img class="vs-por" src="${esc(p.avatar || '')}" alt="" onerror="this.style.visibility='hidden'"><div class="vs-id"><h2>${esc(p.name)}</h2><div class="vs-sub">${esc([v('class_display'), v('race_display') || v('race'), v('background')].filter(Boolean).join(' · '))}</div>
      <div class="vs-stats">${stat('레벨', v('level') || '-')}${stat('숙련', sg(pb))}${stat('AC', v('ac') || '-')}${stat('최대 HP', mx('hp') || v('hp') || '-')}${stat('속도', (v('speed') || 30) + 'ft')}${stat('선제권', sg(num(v('initiative_bonus'))))}</div></div></header>`;
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
  // 동행 크리처: 내보낼 때 주인(PC)의 저널 이름이 comp에 들어 있어요
  const compsOf = p => ((DATA && DATA.comps) || []).filter(x => x.comp && (x.comp === p.name || x.comp === p.jname || x.comp === p.id));
  function compHtml(p) {
    const L = compsOf(p);
    if (!L.length) return '<p class="vs-mut">동행 크리처가 없어요. (다음 시트 내보내기 때 같은 플레이어가 조종하는 크리처가 들어와요)</p>';
    return L.map(k => { const c = k.store ? calc(k) : null;
      const stats = c ? `<div class="vs-stats">${stat('AC', c.ac)}${stat('최대 HP', c.hpMax)}${stat('속도', c.speed + 'ft')}</div>` : '';
      const abl = c ? `<div class="vs-abs">${AB.map(([q, s2, ko]) => `<div class="vs-ab"><span class="vs-abn">${ko}</span><b class="vs-abm">${sg(md(c.ab[q]))}</b><span class="vs-abs2">${c.ab[q]}</span></div>`).join('')}</div>` : '';
      return `<details class="vs-comp"><summary><img src="${esc(k.avatar || '')}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(k.name)}</b>${stats}</summary><div class="vs-compb">${abl}${c ? box('공격', attacks(c)) + features(c) : ''}</div></details>`; }).join('');
  }
  // 시트 본문 (머리 + 탭 + 내용). opt: { tabs, art, extra: { 탭키: html } }
  function bodyHtml(p, t, opt) {
    opt = opt || {};
    const T = opt.tabs || [['main', '능력치'], ['inv', '소지품'], ['feat', '특성'], ['spell', '주문'], ['about', '소개'], ['comp', '동행']];
    if (!T.some(x => x[0] === t)) t = T[0][0];
    const prevTab = tab; tab = t;
    try {
      const q = Object.assign({}, p, opt.art ? { avatar: opt.art } : {});
      const nav = `<nav class="vs-tabs">${T.map(([k, l]) => `<button data-vt="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
      const ex = opt.extra && opt.extra[t] != null ? opt.extra[t] : null;
      if (!q.store) { const h = ogl(q), i = h.indexOf('</header>') + 9; const pg = ex != null ? ex : t === 'comp' ? compHtml(p) : h.slice(i); return h.slice(0, i) + nav + '<div class="vs-page">' + (opt.pre && opt.pre[t] || '') + pg + '</div>'; }
      const c = calc(q);
      const pg = ex != null ? ex : t === 'main' ? main(c) : t === 'inv' ? inventory(c) : t === 'feat' ? features(c) : t === 'spell' ? spells(c) : t === 'comp' ? compHtml(p) : about(q, c);
      return head(q, c) + nav + `<div class="vs-page">${opt.pre && opt.pre[t] || ''}${pg}</div>`;
    } finally { tab = prevTab; }
  }
  function sheet() {
    const p0 = DATA.pcs[cur], el = document.getElementById('vs-body');
    const H = p0 && HIST && HIST.pcs && HIST.pcs[p0.id];
    const p = p0 && ver >= 0 && H && H[ver] ? Object.assign({}, p0, H[ver]) : p0;
    if (!p) { el.innerHTML = ''; return; }
    el.innerHTML = histBar(p0) + bodyHtml(p, tab);
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
    load().then(() => { list(); sheet(); }).catch(e => { document.getElementById('vs-body').innerHTML = `<p class="vs-mut">시트 데이터를 못 불러왔어요 (${esc(e.message)})</p>`; });
  }
  let loading = null;
  function load() {
    if (loading) return loading;
    loading = fetch('data/sheets.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
      const all = d.pcs.filter(p => p.store || (p.attrs && p.attrs.strength));
      d.comps = all.filter(p => p.comp);
      d.pcs = all.filter(p => !p.comp);
      // 저널에 PC로 등록한 캐릭터만 (이름은 저널에 등록한 이름으로)
      // 저널 PC에 'r20'(Roll20 캐릭터 이름)을 따로 정해 두면 그 이름으로 찾아요 (예: 저널 '림데어 페이-브랑슈' ↔ Roll20 '올시람 페어워터')
      // 별명 목록(aliases)에 있는 이름으로도 찾아요 (예: 저널 '림데어 페이-브랑슈' 별명 '올시람 페어워터' = Roll20 이름)
      let reg = []; try { reg = ((state.boardTex && state.boardTex.pcs) || []).filter(p => p && p.name).map(p => ({ j: p.name, rs: [p.r20, p.name].concat(Array.isArray(p.aliases) ? p.aliases : []).filter(Boolean) })); } catch (e) {}
      d.all = all.filter(p => !p.comp);
      if (reg.length) { const used = new Set(); d.pcs = reg.map(x => { const free = d.all.filter(p => !used.has(p.id)); let c = free.find(p => p.jname === x.j) || null;
        if (!c) for (const r of x.rs) { const m = sxPick(free, [r])[0]; if (m) { c = m.c; break; } }
        if (!c) return null; used.add(c.id); return Object.assign({}, c, { name: x.j, r20name: c.name }); }).filter(Boolean); }
      else d.pcs.forEach(p => { if (p.jname) p.name = p.jname; });
      DATA = d; icons();
      fetch('data/sheets_history.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(h => { if (h) { HIST = h; if (document.getElementById('vs-body')) try { sheet(); } catch (e) {} } }).catch(() => {});
      return d;
    });
    loading.catch(() => { loading = null; });
    return loading;
  }
  // 저널 캐릭터 시트(안쪽 창)에서 쓰는 통로: 이름으로 시트를 찾아 그려 줘요
  window.vsApi = {
    load, ready: () => !!DATA, icons,
    find: name => { if (!DATA || !name) return null; return DATA.pcs.find(p => p.name === name || p.jname === name) || (sxPick(DATA.pcs, [name])[0] || {}).c || null; },
    html: (p, t, opt) => bodyHtml(p, t, opt),
    // 이름이 달라서 못 찾은 Roll20 캐릭터들 + 저널 PC에 연결하기
    unmatched: () => { if (!DATA) return []; const used = new Set(DATA.pcs.map(p => p.id)); return (DATA.all || []).filter(p => !used.has(p.id)).map(p => p.name); },
    link: (jname, r20) => { try { const c = ((state.boardTex && state.boardTex.pcs) || []).find(p => p && p.name === jname); if (!c) return Promise.reject(); if (r20) c.r20 = r20; else delete c.r20; if (typeof persistState === 'function') persistState(); } catch (e) { return Promise.reject(e); } DATA = null; loading = null; return load(); },
    css: () => css
  };
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
  .vs-comp{border:1px solid #c9c7b8;border-radius:6px;background:rgba(255,255,255,.4);margin:0 0 8px}.vs-comp summary{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;list-style:none;flex-wrap:wrap}.vs-comp summary::-webkit-details-marker{display:none}.vs-comp summary img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:1px solid #7a6a53;background:#ddd}.vs-comp summary b{font-size:16px;color:#4b0000;margin-right:auto}.vs-compb{padding:0 10px 8px}
  .vs-ic{width:26px;height:26px;object-fit:cover;border-radius:5px;border:1px solid #7a6a53;background:#2a2622;flex:none}
  .vs-items summary b,.vs-atk summary b{display:flex;align-items:center;gap:7px;min-width:0}
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
  // 위쪽 바 버튼은 뺐어요 (저널 캐릭터 시트의 '상세' 모드로 봐요). 예전 버튼이 남아 있으면 지워요
  const rmBtn = () => { const b = document.getElementById('tab-sheets'); if (b) b.remove(); }; rmBtn(); setTimeout(rmBtn, 1500);
})();
