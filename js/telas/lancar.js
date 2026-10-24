import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, lerValor, toast, dataCurta, nomeMes, pessoasDaCasa } from '../ui.js';

const PARCELA_NO_VENCIMENTO = ['cartao', 'crediario', 'carne', 'boleto', 'emprestimo', 'consignado'];
const lembrar = (k, v) => { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); } catch {} return v; };

/** Sugestão de data da 1ª parcela: no cartão/boleto é o próximo vencimento; no Pix/dinheiro é hoje */
function dataSugerida(forma, hoje) {
  if (!forma || !PARCELA_NO_VENCIMENTO.includes(forma.tipo)) return hoje;
  const comp = hoje.slice(0, 7), d = M.dataNoMes(comp, forma.diaVencimento);
  return d > hoje ? d : M.dataNoMes(M.somarMesesComp(comp, 1), forma.diaVencimento);
}
const nomeQ = (comp, q) => `${q}ª quinzena de ${nomeMes(comp).split(' ')[0]}`;
const chips = (nome, itens, marcado) => itens.map(([v, r, cor]) => `<label class="chip">
  <input type="radio" name="${nome}" value="${esc(v)}" ${String(v) === String(marcado) ? 'checked' : ''}>
  <span>${cor ? `<i style="background:${esc(cor)}"></i>` : ''}${esc(r)}</span></label>`).join('');

export function render(ctx) {
  const d = ctx.dados, modo = ctx.lancarModo || 'saida';
  // formas mais usadas primeiro
  const uso = {}; d.compras.forEach(c => { uso[c.formaId] = (uso[c.formaId] || 0) + 1; });
  const formas = d.formas.filter(f => f.ativo !== false).sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0));
  const formaPadrao = formas.find(f => f.id === lembrar('ultimaForma')) || formas[0];
  const quem = ctx.usuario.nome.split(' ')[0];
  const nomesUsados = [...new Set(d.compras.map(c => c.nome))].slice(-40);
  const aba = (v, r) => `<button role="tab" class="abas__aba" data-modo="${v}" aria-selected="${modo === v}">${r}</button>`;

  const saida = `<form class="lancar" data-form="saida" novalidate>
    <label class="lancar__valor"><span>Valor total</span>
      <input name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" required aria-label="Valor total em reais"></label>
    <div class="campo"><label for="l-nome">O que foi</label>
      <input id="l-nome" name="nome" required placeholder="Ex.: Mercado, Tênis, Farmácia" list="l-nomes" autocomplete="off">
      <datalist id="l-nomes">${nomesUsados.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
    <fieldset class="campo"><legend>Onde desconta</legend><div class="chips">${chips('formaId', formas.map(f => [f.id, f.nome]), formaPadrao?.id)}</div></fieldset>
    <div class="lancar__linha">
      <fieldset class="campo"><legend>Parcelas</legend>
        <div class="passo"><button type="button" class="icone-btn" data-passo="-1" aria-label="Menos parcelas">−</button>
        <input name="parcelas" type="number" inputmode="numeric" min="1" max="48" value="1" aria-label="Número de parcelas">
        <button type="button" class="icone-btn" data-passo="1" aria-label="Mais parcelas">+</button></div></fieldset>
      <div class="campo"><label for="l-data" data-rot-data>Data</label><input id="l-data" name="data" type="date" value="${dataSugerida(formaPadrao, ctx.hoje)}" required></div>
    </div>
    <fieldset class="campo"><legend>Categoria</legend><div class="chips">${chips('categoriaId', [...d.categorias].sort((a, b) => a.ordem - b.ordem).map(c => [c.id, c.nome, c.cor]))}</div></fieldset>
    <fieldset class="campo"><legend>Quem gastou</legend><div class="chips">${chips('pessoa', pessoasDaCasa(d).map(p => [p, p]), quem)}</div></fieldset>
    <p class="previa" aria-live="polite"></p>
    <p class="form__erro" role="alert" hidden></p>
    <button class="btn btn--grande">Lançar gasto</button>
  </form>`;

  const fontes = d.fontes.filter(f => f.ativo !== false);
  const entrada = fontes.length ? `<form class="lancar" data-form="entrada" novalidate>
    <label class="lancar__valor lancar__valor--entrada"><span>Valor que entrou</span>
      <input name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" required aria-label="Valor em reais"></label>
    <fieldset class="campo"><legend>De onde veio</legend><div class="chips">${chips('fonteId', fontes.map(f => [f.id, f.nome]), fontes[0].id)}</div></fieldset>
    <div class="lancar__linha">
      <div class="campo"><label for="e-data">Data</label><input id="e-data" name="data" type="date" value="${ctx.hoje}" required></div>
      <div class="campo"><label for="e-desc">Descrição (opcional)</label><input id="e-desc" name="descricao" placeholder="Ex.: venda de chaveiros"></div>
    </div>
    <p class="previa" aria-live="polite"></p>
    <p class="form__erro" role="alert" hidden></p>
    <button class="btn btn--grande">Lançar entrada</button>
  </form>` : `<div class="vazio"><p class="vazio__titulo">Nenhuma fonte de renda cadastrada.</p><p><a href="#/cadastros/fontes">Cadastrar fontes de renda</a></p></div>`;

  return `<div class="abas" role="tablist" aria-label="Tipo de lançamento">${aba('saida', 'Gasto')}${aba('entrada', 'Entrada')}</div>
    ${modo === 'saida' ? saida : entrada}`;
}

export function ligar(el, ctx) {
  el.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => { ctx.lancarModo = b.dataset.modo; ctx.render(); }));
  const fs = el.querySelector('[data-form=saida]'), fe = el.querySelector('[data-form=entrada]');
  if (fs) ligarSaida(fs, ctx);
  if (fe) ligarEntrada(fe, ctx);
  el.querySelectorAll('.lancar__valor input').forEach(i => i.addEventListener('blur', () => {
    const v = lerValor(i.value); if (v > 0) i.value = v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }));
  el.querySelector('input[name=valor]')?.focus({ preventScroll: true });
}

function erro(form, msg) { const p = form.querySelector('.form__erro'); p.textContent = msg; p.hidden = !msg; }

function ligarSaida(f, ctx) {
  const formaDe = () => ctx.dados.formas.find(x => x.id === f.formaId.value);
  let dataMexida = false;
  f.data.addEventListener('input', () => { dataMexida = true; });
  f.querySelectorAll('[data-passo]').forEach(b => b.addEventListener('click', () => {
    f.parcelas.value = Math.min(48, Math.max(1, (Number(f.parcelas.value) || 1) + Number(b.dataset.passo))); previa();
  }));
  f.addEventListener('change', e => { if (e.target.name === 'formaId' && !dataMexida) f.data.value = dataSugerida(formaDe(), ctx.hoje); previa(); });
  f.addEventListener('input', previa);

  function previa() {
    const v = lerValor(f.valor.value), n = Math.max(1, Number(f.parcelas.value) || 1), data = f.data.value;
    f.querySelector('[data-rot-data]').textContent = n > 1 ? '1ª parcela em' : 'Data';
    const p = f.querySelector('.previa');
    if (!(v > 0) || !data) { p.textContent = ''; return; }
    const ps = M.gerarParcelas({ id: 'x', nome: '', valorTotal: v, parcelas: n, primeiraData: data }, formaDe());
    const ult = ps.at(-1);
    p.innerHTML = n === 1
      ? `Sai da <strong>${nomeQ(ps[0].competencia, ps[0].quinzena)}</strong>.`
      : `<strong>${n}x de ${brl(ps[0].valor)}</strong>. A 1ª em ${dataCurta(ps[0].data)} (${nomeQ(ps[0].competencia, ps[0].quinzena)}), a última em ${dataCurta(ult.data)}/${ult.data.slice(0, 4)}.`;
  }
  previa();

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const valor = lerValor(f.valor.value), nome = f.nome.value.trim(), parcelas = Math.max(1, Number(f.parcelas.value) || 1);
    if (!(valor > 0)) return erro(f, 'Digite o valor.'), f.valor.focus();
    if (!nome) return erro(f, 'Diga o que foi.'), f.nome.focus();
    if (!f.formaId.value) return erro(f, 'Escolha onde desconta.');
    erro(f, ''); const btn = f.querySelector('.btn'); btn.disabled = true;
    try {
      await A.lancarCompra(ctx, { nome, valorTotal: valor, parcelas, formaId: f.formaId.value,
        categoriaId: f.categoriaId.value || null, data: f.data.value, pessoa: f.pessoa.value || null });
      lembrar('ultimaForma', f.formaId.value);
      toast(parcelas > 1 ? `Lançado: ${nome}, ${parcelas}x` : `Lançado: ${nome}, ${brl(valor)}`);
      ctx.render();
    } catch (err) { erro(f, 'Não foi possível salvar: ' + err.message); btn.disabled = false; }
  });
}

function ligarEntrada(f, ctx) {
  const previa = () => {
    const p = f.querySelector('.previa'); if (!f.data.value) return;
    const dest = M.destinoEntrada(f.data.value);
    p.innerHTML = `Entra na <strong>${nomeQ(dest.competencia, dest.quinzena)}</strong>.`;
  };
  f.addEventListener('input', previa); f.addEventListener('change', previa); previa();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const valor = lerValor(f.valor.value);
    if (!(valor > 0)) return erro(f, 'Digite o valor.'), f.valor.focus();
    const fonte = ctx.dados.fontes.find(x => x.id === f.fonteId.value);
    erro(f, ''); const btn = f.querySelector('.btn'); btn.disabled = true;
    try {
      await A.lancarEntrada(ctx, { fonteId: fonte.id, valor, data: f.data.value, descricao: f.descricao.value.trim(),
        ref: fonte.dia && fonte.tipo !== 'eventual' ? f.data.value.slice(0, 7) : null });
      toast(`Entrada lançada: ${brl(valor)}`); ctx.render();
    } catch (err) { erro(f, 'Não foi possível salvar: ' + err.message); btn.disabled = false; }
  });
}
