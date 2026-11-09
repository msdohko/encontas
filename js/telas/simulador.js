// Simulador de compra: "se eu comprar isso, como ficam as próximas quinzenas?" Nada é salvo.
import * as M from '../modelo.js';
import { brl, esc, ICONES, lerValor, nomeMes, nomeMesCurto, dataCurta } from '../ui.js';
import { receitasDe, competenciasAte } from './inicio.js';

export function titulo() { return 'Simulador de compra'; }

const nomeQ = (comp, q) => `${q}ª de ${nomeMesCurto(comp)}/${comp.slice(2, 4)}`;
const qCurta = (comp, q) => `${q}ª ${nomeMesCurto(comp)}/${comp.slice(2, 4)}`;
const sinal = v => (v < 0 ? '−' : '+') + brl(Math.abs(v));
const OPCOES = [1, 2, 3, 6, 10, 12];

/** Saldo de cada quinzena (só a quinzena: entra − sai), sem e com a compra */
function calcular(ctx, sim) {
  const d = ctx.dados, forma = d.formas.find(f => f.id === sim.formaId);
  const parcelas = M.parcelasSimuladas(sim, forma);
  const ultima = parcelas.at(-1).competencia;
  const comps = competenciasAte(d, ultima > ctx.hoje.slice(0, 7) ? ultima : ctx.hoje.slice(0, 7));
  const receitas = receitasDe(ctx, comps);
  const antes = M.painelQuinzenas(receitas, M.doCaixa(d.lancamentos, d.formas), comps);
  const depois = M.painelQuinzenas(receitas, M.doCaixa([...d.lancamentos, ...parcelas], d.formas), comps);
  const afetadas = depois.map((p, i) => ({ comp: p.comp, q: p.quinzena, antes: antes[i].saldo, depois: p.saldo, diff: Math.round((antes[i].saldo - p.saldo) * 100) / 100 }))
    .filter(x => x.diff > 0.004);
  return { parcelas, afetadas, forma,
    vermelho: afetadas.filter(x => x.depois < 0).length,
    novas: afetadas.filter(x => x.depois < 0 && x.antes >= 0).length,
    pior: afetadas.reduce((m, x) => (m == null || x.depois < m.depois ? x : m), null) };
}

function veredito(r) {
  if (!r.afetadas.length) return '';
  if (!r.vermelho) return `<p class="aviso-bom"><strong>Cabe.</strong> Em todas as quinzenas com parcela ainda sobra dinheiro. A mais apertada fica com ${brl(r.pior.depois)} na ${nomeQ(r.pior.comp, r.pior.q)}.</p>`;
  if (r.novas) return `<p class="aviso-ruim"><strong>Aperta.</strong> ${r.novas === 1 ? 'Uma quinzena que fechava passa' : `${r.novas} quinzenas que fechavam passam`} a ficar no vermelho. A pior: faltam ${brl(-r.pior.depois)} na ${nomeQ(r.pior.comp, r.pior.q)}.</p>`;
  return `<p class="aviso-ruim"><strong>Essas quinzenas já estavam no vermelho.</strong> A compra aumenta a falta. A pior fica faltando ${brl(-r.pior.depois)} na ${nomeQ(r.pior.comp, r.pior.q)}.</p>`;
}

function resultado(ctx, sim) {
  if (!(sim.valorTotal > 0) || !sim.formaId || !sim.data) return '<p class="nota">Digite o valor para ver como ficam as quinzenas.</p>';
  const r = calcular(ctx, sim), ps = r.parcelas, ult = ps.at(-1);
  const cartao = M.temFatura(r.forma);
  const resumo = ps.length === 1
    ? `<strong>${brl(ps[0].valor)}</strong> ${cartao ? `na fatura de ${nomeMes(ps[0].competencia).split(' ')[0]}` : `em ${dataCurta(ps[0].data)}`}, na ${nomeQ(ps[0].competencia, ps[0].quinzena)}.`
    : `<strong>${ps.length}x de ${brl(ps[0].valor)}</strong>, de ${nomeMesCurto(ps[0].competencia)}/${ps[0].competencia.slice(2, 4)} a ${nomeMesCurto(ult.competencia)}/${ult.competencia.slice(2, 4)}${cartao ? ` nas faturas do ${esc(r.forma.nome)}` : ''}.`;
  const comparar = OPCOES.filter(n => n !== sim.parcelas).concat(sim.parcelas).sort((a, b) => a - b).map(n => {
    const x = n === sim.parcelas ? r : calcular(ctx, { ...sim, parcelas: n });
    return `<tr class="${n === sim.parcelas ? 'atual' : ''}" data-usar="${n}" tabindex="0">
      <td>${n}x</td><td>${brl(x.parcelas[0].valor)}</td>
      <td class="${x.pior && x.pior.depois < 0 ? 'negativo' : 'positivo'}">${x.pior ? sinal(x.pior.depois) : '—'}</td>
      <td>${x.vermelho ? `<span class="negativo">${x.vermelho}</span>` : '0'}</td></tr>`;
  }).join('');
  const mostrar = r.afetadas.slice(0, 24);
  return `<p class="previa">${resumo}</p>
    ${veredito(r)}
    <h2 class="bloco__titulo dividas__sub">Como ficam as quinzenas</h2>
    <p class="nota">Quanto sobra (+) ou falta (−) em cada quinzena que tem parcela.</p>
    <table class="sim-tabela"><thead><tr><th>Quinzena</th><th>Hoje</th><th>Com a compra</th></tr></thead><tbody>
      ${mostrar.map(x => `<tr><td>${qCurta(x.comp, x.q)}</td>
        <td class="${x.antes < 0 ? 'negativo' : ''}">${sinal(x.antes)}</td>
        <td class="${x.depois < 0 ? 'negativo' : 'positivo'}"><strong>${sinal(x.depois)}</strong></td></tr>`).join('')}
    </tbody></table>
    ${r.afetadas.length > mostrar.length ? `<p class="nota">E mais ${r.afetadas.length - mostrar.length} quinzenas com parcela.</p>` : ''}
    <h2 class="bloco__titulo dividas__sub">E se parcelar diferente?</h2>
    <table class="sim-tabela sim-tabela--comparar"><thead><tr><th>Vezes</th><th>Parcela</th><th>Pior quinzena</th><th>No vermelho</th></tr></thead><tbody>${comparar}</tbody></table>
    <p class="nota">Toque numa linha para simular com esse número de parcelas. Juros não entram: se a loja cobra juros no parcelado, digite o valor total com juros.</p>
    <button type="button" class="btn" data-lancar-sim>Vou comprar: lançar esta compra</button>`;
}

export function render(ctx) {
  const d = ctx.dados, s = ctx.simulacao || {};
  const formas = d.formas.filter(f => f.ativo !== false && !M.ehBeneficio(f));
  const forma = s.formaId || formas.find(f => M.temFatura(f))?.id || formas[0]?.id;
  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  <p class="intro">Veja como uma compra mexe nas próximas quinzenas antes de comprar. Nada é salvo.</p>
  <form class="lancar" data-form="sim" novalidate>
    <label class="lancar__valor"><span>Valor total</span>
      <input name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${s.valorTotal ? String(s.valorTotal).replace('.', ',') : ''}" aria-label="Valor total em reais"></label>
    <div class="campo"><label for="s-nome">O que é (opcional)</label><input id="s-nome" name="nome" placeholder="Ex.: Geladeira, Celular" value="${esc(s.nome || '')}"></div>
    <fieldset class="campo"><legend>Como vai pagar</legend><div class="chips">${formas.map(f => `<label class="chip"><input type="radio" name="formaId" value="${esc(f.id)}" ${f.id === forma ? 'checked' : ''}><span>${esc(f.nome)}</span></label>`).join('')}</div></fieldset>
    <div class="lancar__linha">
      <fieldset class="campo"><legend>Parcelas</legend>
        <div class="passo"><button type="button" class="icone-btn" data-passo="-1" aria-label="Menos parcelas">−</button>
        <input name="parcelas" type="number" inputmode="numeric" min="1" max="120" value="${s.parcelas || 1}" aria-label="Número de parcelas">
        <button type="button" class="icone-btn" data-passo="1" aria-label="Mais parcelas">+</button></div></fieldset>
      <div class="campo"><label for="s-data">Data da compra</label><input id="s-data" name="data" type="date" value="${s.data || ctx.hoje}"></div>
    </div>
  </form>
  <section class="bloco sim-resultado" data-resultado aria-live="polite"></section>`;
}

export function ligar(el, ctx) {
  const f = el.querySelector('[data-form=sim]'), out = el.querySelector('[data-resultado]');
  const ler = () => ({ valorTotal: lerValor(f.valor.value), nome: f.nome.value.trim() || 'Simulação', formaId: f.formaId.value,
    parcelas: Math.min(120, Math.max(1, Number(f.parcelas.value) || 1)), data: f.data.value });
  const atualizar = () => {
    const sim = ler(); ctx.simulacao = sim;
    el.querySelector('label[for=s-data]').textContent = M.temFatura(ctx.dados.formas.find(x => x.id === sim.formaId)) ? 'Data da compra' : (sim.parcelas > 1 ? '1ª parcela vence em' : 'Vence em');
    out.innerHTML = resultado(ctx, sim);
    out.querySelectorAll('[data-usar]').forEach(tr => {
      const usar = () => { f.parcelas.value = tr.dataset.usar; atualizar(); };
      tr.addEventListener('click', usar); tr.addEventListener('keydown', e => { if (e.key === 'Enter') usar(); });
    });
    out.querySelector('[data-lancar-sim]')?.addEventListener('click', () => {
      ctx.prefill = { ...sim, nome: sim.nome === 'Simulação' ? '' : sim.nome }; ctx.lancarModo = 'saida'; location.hash = '#/lancar';
    });
  };
  f.querySelectorAll('[data-passo]').forEach(b => b.addEventListener('click', () => {
    f.parcelas.value = Math.min(120, Math.max(1, (Number(f.parcelas.value) || 1) + Number(b.dataset.passo))); atualizar();
  }));
  // 'change' de campo de texto dispara ao sair dele: refazer a tabela aí engoliria o toque numa linha
  f.addEventListener('input', atualizar); f.addEventListener('change', e => { if (e.target.type === 'radio') atualizar(); });
  f.addEventListener('submit', e => e.preventDefault());
  atualizar();
}
