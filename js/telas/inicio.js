import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { linhaConta, ligarContas } from './conta.js';
import { brl, esc, seletorMes, dataCurta, nomeMesCurto, ROTULO_SITUACAO, lerValor, valorParaCampo, toast } from '../ui.js';

/** Competências do início do controle até `ate` (o saldo acumulado começa no início do controle) */
export function competenciasAte(dados, ate) {
  const ini = dados.casa?.inicioControle || ate, out = [];
  for (let c = ini < ate ? ini : ate; c <= ate; c = M.somarMesesComp(c, 1)) out.push(c);
  return out;
}

export const receitasDe = (ctx, comps) => M.receitasNoPeriodo(ctx.dados.fontes, ctx.dados.entradas, comps);

export function painelDoMes(ctx) {
  const comps = competenciasAte(ctx.dados, ctx.comp);
  return M.painelQuinzenas(receitasDe(ctx, comps), ctx.dados.lancamentos, comps).slice(-2);
}

/** O que precisa de uma resposta rápida: salário que caiu, conta de valor variável que chegou */
export function paraConfirmar(ctx) {
  const hoje = ctx.hoje, comp = hoje.slice(0, 7), limite = M.somarMeses(hoje, 0) ;
  const daqui10 = new Date(new Date(hoje).getTime() + 10 * 864e5).toISOString().slice(0, 10);
  const entradas = receitasDe(ctx, [M.somarMesesComp(comp, -1), comp, M.somarMesesComp(comp, 1)])
    .filter(r => r.aConfirmar && r.data <= limite)
    .map(r => ({ tipo: 'entrada', r, fonte: ctx.dados.fontes.find(f => f.id === r.fonteId) }));
  const contas = ctx.dados.lancamentos.filter(l => l.confirmado === false && l.status === 'pendente' && l.data <= daqui10)
    .sort((a, b) => a.data.localeCompare(b.data)).map(l => ({ tipo: 'conta', l }));
  return [...entradas, ...contas];
}

const sinal = v => (v < 0 ? 'negativo' : 'positivo');

function metade(p, rotulo, fonte) {
  return `<section class="envelope__metade envelope__metade--q${p.quinzena}" aria-label="${rotulo}">
    <header class="envelope__cab"><span class="envelope__q">${rotulo}</span><span class="envelope__fonte">${fonte}</span></header>
    <dl class="envelope__linhas">
      <div><dt>Entra${p.temPrevisao ? '<sup title="Inclui valor previsto">*</sup>' : ''}</dt><dd>${brl(p.receita)}</dd></div>
      <div><dt>Sai</dt><dd>${brl(p.gastos)}</dd></div>
      <div><dt>A pagar</dt><dd>${brl(p.aPagar)}</dd></div>
    </dl>
    <p class="envelope__sobra ${sinal(p.saldo)}"><span>${p.saldo < 0 ? 'Falta' : 'Sobra'}</span><strong>${brl(Math.abs(p.saldo))}</strong></p>
  </section>`;
}

function cartaoConfirmar(x, i) {
  if (x.tipo === 'entrada') return `<li class="confirmar__item" data-i="${i}">
    <p><strong>Caiu o ${esc(x.fonte?.nome?.toLowerCase() || 'dinheiro')} de ${dataCurta(x.r.data)}?</strong><small>Previsto: ${brl(x.r.valor)} (média dos últimos meses)</small></p>
    <form class="confirmar__form"><input name="valor" inputmode="decimal" value="${valorParaCampo(x.r.valor)}" aria-label="Valor que caiu">
    <button class="btn btn--peq">Confirmar</button></form></li>`;
  return `<li class="confirmar__item" data-i="${i}">
    <p><strong>Chegou a conta de ${esc(x.l.descricao)}?</strong><small>Vence ${dataCurta(x.l.data)}. Estimado: ${brl(x.l.valor)}</small></p>
    <form class="confirmar__form"><input name="valor" inputmode="decimal" value="${valorParaCampo(x.l.valor)}" aria-label="Valor da conta">
    <button class="btn btn--peq">Confirmar</button></form></li>`;
}

export function render(ctx) {
  const d = ctx.dados;
  if (!d.lancamentos.length && !d.fontes.length) return `${seletorMes(ctx.comp)}
    <div class="vazio"><p class="vazio__titulo">Sua casa está pronta.</p>
    <p>Comece pelas <a href="#/cadastros/fontes">fontes de renda</a> (salário, vale) e pelas <a href="#/cadastros/contas">contas fixas</a>. Depois, o botão <strong>Lançar</strong> fica sempre à mão.</p></div>`;

  const [q1, q2] = painelDoMes(ctx);
  const nomes = Object.fromEntries(d.formas.map(f => [f.id, f.nome]));
  const pendentes = d.lancamentos.filter(l => l.status === 'pendente')
    .map(l => ({ ...l, sit: M.situacao(l, ctx.hoje) })).sort((a, b) => a.data.localeCompare(b.data));
  const atrasados = pendentes.filter(l => l.sit === 'atrasado');
  const proximos = pendentes.filter(l => l.sit !== 'atrasado').slice(0, 6);
  const recMes = receitasDe(ctx, [ctx.comp]);
  const fonteQ = q => [...new Set(recMes.filter(r => r.quinzena === q).map(r => d.fontes.find(f => f.id === r.fonteId)?.nome).filter(Boolean))].join(' + ') || 'Sem entrada';
  const confirmar = paraConfirmar(ctx);
  ctx._confirmar = confirmar;

  const item = l => linhaConta(ctx, l);

  return `${confirmar.length ? `<section class="confirmar" aria-label="Para confirmar">
      <h2 class="bloco__titulo">Para confirmar <span class="contador contador--info">${confirmar.length}</span></h2>
      <ul>${confirmar.map(cartaoConfirmar).join('')}</ul></section>` : ''}
  ${seletorMes(ctx.comp)}
  <div class="inicio-grade">
    <div class="envelope">
      ${metade(q1, '1ª quinzena', fonteQ(1))}
      <div class="envelope__corte" aria-hidden="true"></div>
      ${metade(q2, '2ª quinzena', fonteQ(2))}
      <footer class="envelope__acumulado ${sinal(q2.acumulado)}">
        <span>Saldo acumulado no fim de ${nomeMesCurto(ctx.comp)}</span><strong>${brl(q2.acumulado)}</strong>
      </footer>
      ${q1.temPrevisao || q2.temPrevisao ? '<p class="envelope__nota">* inclui salário previsto pela média dos últimos 3 meses</p>' : ''}
    </div>
    <div class="inicio-listas">
      ${atrasados.length ? `<section class="bloco bloco--alerta"><h2 class="bloco__titulo">Atrasadas <span class="contador">${atrasados.length}</span></h2>
        <ul class="contas">${atrasados.map(item).join('')}</ul></section>` : ''}
      <section class="bloco"><h2 class="bloco__titulo">Próximos vencimentos</h2>
        ${proximos.length ? `<ul class="contas">${proximos.map(item).join('')}</ul>` : '<p class="nada">Nada a pagar por enquanto.</p>'}
        <a class="link-mais" href="#/quinzenas">Ver todas as contas do mês</a></section>
    </div>
  </div>`;
}

export function ligar(el, ctx) {
  ligarContas(el, ctx);
  el.querySelectorAll('.confirmar__item').forEach(li => li.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const x = ctx._confirmar[Number(li.dataset.i)], valor = lerValor(e.target.valor.value);
    if (!(valor >= 0)) return toast('Digite o valor.');
    e.target.querySelector('button').disabled = true;
    if (x.tipo === 'entrada') {
      await A.lancarEntrada(ctx, { fonteId: x.r.fonteId, valor, data: x.r.data, ref: x.r.ref });
      toast(`${x.fonte.nome}: ${brl(valor)} confirmado`);
    } else {
      await A.confirmarValor(ctx, x.l.id, valor);
      toast(`${x.l.descricao}: ${brl(valor)} confirmado`);
    }
    ctx.render();
  }));
}
