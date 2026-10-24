// Utilidades de interface
export const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlCurto = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeMes = comp => { const [a, m] = comp.split('-').map(Number); return `${MESES[m - 1]} ${a}`; };
export const nomeMesCurto = comp => MESES[Number(comp.slice(5, 7)) - 1].slice(0, 3);
export const dataCurta = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const mesSeguinte = (comp, n = 1) => { let [a, m] = comp.split('-').map(Number); m += n; while (m > 12) { m -= 12; a++; } while (m < 1) { m += 12; a--; } return `${a}-${String(m).padStart(2, '0')}`; };

export const ROTULO_SITUACAO = { pago: 'Pago', atrasado: 'Atrasado', 'vence-logo': 'Vence logo', pendente: 'A pagar' };

/** Aviso rápido na parte de baixo. Com `acao`, mostra um botão (ex.: Desfazer) por 6 segundos. */
export function toast(msg, acao) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button type="button">${esc(acao.rotulo)}</button>` : ''}`;
  if (acao) t.querySelector('button').addEventListener('click', () => { t.remove(); acao.fn(); });
  document.body.append(t);
  const dura = acao ? 6000 : 2600;
  setTimeout(() => t.classList.add('sai'), dura);
  setTimeout(() => t.remove(), dura + 400);
}

/** Data e hora curtas para o histórico: "24/10 13:28" */
export const quando = iso => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Seletor de mês: ‹ outubro 2026 › */
export function seletorMes(comp) {
  return `<div class="seletor-mes" role="group" aria-label="Mês">
    <button class="icone-btn" data-mes="-1" aria-label="Mês anterior">${ICONES.esq}</button>
    <span class="seletor-mes__nome">${nomeMes(comp)}</span>
    <button class="icone-btn" data-mes="1" aria-label="Próximo mês">${ICONES.dir}</button>
  </div>`;
}

const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONES = {
  inicio: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>'),
  quinzenas: svg('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M12 5v15M3 10h18"/>'),
  mais: svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  dividas: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18M7 15h4"/>'),
  lancar: svg('<path d="M12 5v14M5 12h14"/>'),
  esq: svg('<path d="m15 6-6 6 6 6"/>'),
  dir: svg('<path d="m9 6 6 6-6 6"/>'),
  sair: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>'),
  copiar: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
};

ICONES.fechar = svg('<path d="M6 6l12 12M18 6 6 18"/>');
ICONES.editar = svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>');
ICONES.dir2 = svg('<path d="m9 6 6 6-6 6"/>');
ICONES.check = svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>');
ICONES.relogio = svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');

// ── Valores em reais digitados ("1.234,56", "1234.56", "R$ 80") ──────
export function lerValor(txt) {
  let s = String(txt ?? '').replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Math.round(Number(s) * 100) / 100;
}
export const valorParaCampo = v => (v || v === 0) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

// ── Folha: painel que sobe de baixo no celular e abre ao lado no PC ──
export function abrirFolha({ titulo, corpo, ligar }) {
  const d = document.createElement('dialog');
  d.className = 'folha';
  d.innerHTML = `<div class="folha__topo"><h2>${titulo}</h2>
    <button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ICONES.fechar}</button></div>
    <div class="folha__corpo">${corpo}</div>`;
  document.body.append(d);
  d.showModal();
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
  ligar?.(d.querySelector('.folha__corpo'), () => d.close());
  return d;
}

// ── Formulários a partir de uma lista de campos ──────────────────────
// campo: { n, r (rótulo), t: texto|dinheiro|inteiro|dia|data|mes|cor|opcoes|lista|check, op: [[valor, rótulo]],
//          obrig, ph, ajuda, se: valores => bool, sugestoes: [] }
let seqCampo = 0;
export function campoHTML(c, v) {
  const id = `c${++seqCampo}`, val = v ?? c.padrao ?? '';
  const aj = c.ajuda ? `<small class="campo__ajuda">${c.ajuda}</small>` : '';
  const req = c.obrig ? 'required' : '';
  let ctrl;
  switch (c.t) {
    case 'dinheiro': ctrl = `<input id="${id}" name="${c.n}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(valorParaCampo(val))}" ${req}>`; break;
    case 'inteiro': case 'dia': ctrl = `<input id="${id}" name="${c.n}" type="number" inputmode="numeric" min="${c.t === 'dia' ? 1 : 0}" max="${c.t === 'dia' ? 31 : 999}" value="${esc(val)}" ${req}>`; break;
    case 'data': ctrl = `<input id="${id}" name="${c.n}" type="date" value="${esc(val)}" ${req}>`; break;
    case 'mes': ctrl = `<input id="${id}" name="${c.n}" type="month" value="${esc(val)}" ${req}>`; break;
    case 'cor': ctrl = `<input id="${id}" name="${c.n}" type="color" value="${esc(val || '#4C6FD6')}">`; break;
    case 'check': return `<label class="campo campo--check" data-campo="${c.n}"><input type="checkbox" name="${c.n}" ${val ? 'checked' : ''}><span>${c.r}</span>${aj}</label>`;
    case 'lista': ctrl = `<select id="${id}" name="${c.n}" ${req}>${c.obrig ? '' : '<option value="">(nenhum)</option>'}${c.op.map(([k, r]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`; break;
    case 'opcoes': return `<fieldset class="campo" data-campo="${c.n}"><legend>${c.r}</legend><div class="chips">${c.op.map(([k, r]) =>
      `<label class="chip"><input type="radio" name="${c.n}" value="${esc(k)}" ${String(k) === String(val) ? 'checked' : ''} ${req}><span>${esc(r)}</span></label>`).join('')}</div>${aj}</fieldset>`;
    default: ctrl = `<input id="${id}" name="${c.n}" value="${esc(val)}" placeholder="${esc(c.ph || '')}" autocomplete="off" ${req} ${c.sugestoes ? `list="${id}l"` : ''}>
      ${c.sugestoes ? `<datalist id="${id}l">${c.sugestoes.map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : ''}`;
  }
  return `<div class="campo" data-campo="${c.n}"><label for="${id}">${c.r}</label>${ctrl}${aj}</div>`;
}

export function formHTML(campos, valores = {}, rotuloBotao = 'Salvar', extra = '') {
  return `<form class="form" novalidate>${campos.map(c => campoHTML(c, valores[c.n])).join('')}
    <p class="form__erro" role="alert" hidden></p>
    <div class="form__acoes"><button class="btn">${rotuloBotao}</button>${extra}</div></form>`;
}

export function lerForm(form, campos) {
  const o = {};
  for (const c of campos) {
    const el = form.elements[c.n];
    if (!el) continue;
    if (c.t === 'check') o[c.n] = el.checked;
    else if (c.t === 'dinheiro') o[c.n] = lerValor(el.value);
    else if (c.t === 'inteiro' || c.t === 'dia') o[c.n] = el.value === '' ? null : Number(el.value);
    else o[c.n] = el.value === '' ? null : el.value;
  }
  return o;
}

/** Mostra/esconde campos com `se`, valida e chama aoSalvar(valores) */
export function ligarForm(form, campos, aoSalvar) {
  const atualizar = () => {
    const v = lerForm(form, campos);
    for (const c of campos) if (c.se) {
      const caixa = form.querySelector(`[data-campo="${c.n}"]`), ok = c.se(v);
      caixa.hidden = !ok; caixa.querySelectorAll('input,select').forEach(i => { i.disabled = !ok; });
    }
  };
  form.addEventListener('input', atualizar); form.addEventListener('change', atualizar); atualizar();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const erro = form.querySelector('.form__erro'), v = lerForm(form, campos);
    const falta = campos.find(c => c.obrig && !form.querySelector(`[data-campo="${c.n}"]`)?.hidden &&
      (v[c.n] == null || v[c.n] === '' || Number.isNaN(v[c.n])));
    if (falta) { erro.textContent = `Preencha: ${falta.r}.`; erro.hidden = false; return; }
    const btn = form.querySelector('.form__acoes .btn'); btn.disabled = true; erro.hidden = true;
    try { await aoSalvar(v); } catch (err) { console.error(err); erro.textContent = 'Não foi possível salvar: ' + err.message; erro.hidden = false; btn.disabled = false; }
  });
}

/** Nomes de quem gasta/recebe na casa (membros + nomes já usados) */
export function pessoasDaCasa(d) {
  const nomes = Object.values(d.casa.membrosInfo || {}).map(m => (m.nome || '').split(' ')[0]);
  return [...new Set([...nomes, ...d.fontes.map(f => f.pessoa), ...d.recorrentes.map(r => r.pessoa), 'Casa'].filter(Boolean))];
}
