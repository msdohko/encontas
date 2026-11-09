// Relatórios: para onde vai o dinheiro (categoria, cartão, pessoa) e como os meses evoluem
import * as M from '../modelo.js';
import { brl, esc, ICONES, seletorMes, nomeMesCurto, nomeMes, dataCurta } from '../ui.js';
import { painelDoMes, receitasDe, competenciasAte } from './inicio.js';

export function titulo() { return 'Relatórios'; }

const reaisCurto = v => brl(v).replace(/,\d\d$/, '');

function barras(itens, total, { variacao } = {}) {
  return `<ul class="barras">${itens.map(({ nome, valor, cor, antes }) => {
    const v = variacao && antes != null ? valor - antes : null;
    return `<li>
    <span class="barras__nome">${cor ? `<i style="background:${esc(cor)}"></i>` : ''}${esc(nome)}</span>
    <span class="barras__valor">${brl(valor)}${v != null && Math.abs(v) >= 1 ? ` <small class="var ${v > 0 ? 'var--sobe' : 'var--desce'}" title="Comparado ao mês anterior">${v > 0 ? '▲' : '▼'} ${reaisCurto(Math.abs(v))}</small>` : variacao === 'novo' ? ' <small class="var var--novo">novo</small>' : ''}</span>
    <span class="barra" aria-hidden="true"><span style="width:${total ? Math.max(2, (valor / total) * 100) : 0}%;${cor ? `background:${esc(cor)}` : ''}"></span></span>
  </li>`; }).join('')}</ul>`;
}

/** Entradas x saídas dos 6 meses até o mês escolhido (do caixa: o que pesa nas quinzenas) */
function evolucao(ctx) {
  const d = ctx.dados, fim = ctx.comp;
  const comps = competenciasAte(d, fim);
  const meses = []; for (let i = 5; i >= 0; i--) { const c = M.somarMesesComp(fim, -i); if (c >= comps[0]) meses.push(c); }
  const todos = [...new Set([...comps, ...meses])].sort();
  const painel = M.painelQuinzenas(receitasDe(ctx, todos), M.doCaixa(d.lancamentos, d.formas), todos);
  const linhas = meses.map(c => {
    const [a, b] = painel.filter(p => p.comp === c);
    return { comp: c, entra: (a?.receita || 0) + (b?.receita || 0), sai: (a?.gastos || 0) + (b?.gastos || 0), prev: a?.temPrevisao || b?.temPrevisao, futuro: c > ctx.hoje.slice(0, 7) };
  });
  const max = Math.max(1, ...linhas.flatMap(l => [l.entra, l.sai]));
  const h = v => Math.max(v > 0 ? 2 : 0, (v / max) * 100);
  return `<section class="bloco">
    <h2 class="bloco__titulo">Entradas e saídas${meses.length > 1 ? `, últimos ${meses.length} meses` : ''}</h2>
    <p class="legenda"><span><i class="leg-entra"></i>Entrou</span><span><i class="leg-sai"></i>Saiu</span></p>
    <div class="evol" style="grid-template-columns:repeat(${meses.length},1fr)" role="img" aria-label="${linhas.map(l => `${nomeMes(l.comp)}: entrou ${brl(l.entra)}, saiu ${brl(l.sai)}`).join('; ')}">
      ${linhas.map(l => `<div class="evol__mes ${l.comp === fim ? 'evol__mes--atual' : ''} ${l.futuro ? 'evol__mes--futuro' : ''}">
        <div class="evol__barras">
          <span class="evol__b evol__b--entra" style="height:${h(l.entra)}%" title="Entrou ${brl(l.entra)}"></span>
          <span class="evol__b evol__b--sai" style="height:${h(l.sai)}%" title="Saiu ${brl(l.sai)}"></span>
        </div>
        <span class="evol__rot">${nomeMesCurto(l.comp)}${l.futuro ? '*' : ''}</span>
        <span class="evol__saldo ${l.entra - l.sai < 0 ? 'negativo' : 'positivo'}">${l.entra - l.sai < 0 ? '−' : '+'}${brl(Math.abs(l.entra - l.sai)).replace('R$ ', '').replace(/,\d\d$/, '')}</span>
      </div>`).join('')}
    </div>
    ${linhas.some(l => l.futuro) ? '<p class="nota">* Mês que ainda não chegou: entradas e contas previstas.</p>' : ''}
  </section>`;
}

export function render(ctx) {
  const d = ctx.dados, comp = ctx.comp, antes = M.somarMesesComp(comp, -1);
  const cats = Object.fromEntries(d.categorias.map(c => [c.id, c]));
  const formas = Object.fromEntries(d.formas.map(f => [f.id, f]));
  const itens = M.gastosDetalhados(d.lancamentos, d.formas, comp);
  const itensAntes = M.gastosDetalhados(d.lancamentos, d.formas, antes);
  const [q1, q2] = painelDoMes(ctx);
  const entrou = q1.receita + q2.receita, saiu = q1.gastos + q2.gastos, extras = q1.extras + q2.extras;
  const total = itens.reduce((t, l) => t + l.valor, 0);

  // fora do caixa: vale mercado e descontos no salário (gasto de verdade, mas não pesa nas quinzenas)
  const vales = new Set(d.formas.filter(M.ehBeneficio).map(f => f.id));
  const doVale = d.lancamentos.filter(l => vales.has(l.formaId) && l.competencia === comp).reduce((t, l) => t + l.valor, 0);

  const nomeCat = k => (k === 'sem-detalhe' ? 'Faturas: parte sem compras lançadas' : k === '—' ? 'Sem categoria' : cats[k]?.nome || 'Sem categoria');
  const catDe = l => (l.semDetalhe ? 'sem-detalhe' : l.categoriaId);
  const antesPorCat = Object.fromEntries(M.somarPor(itensAntes, catDe));
  const temAntes = itensAntes.length > 0 && antes >= competenciasAte(d, comp)[0];
  const porCat = M.somarPor(itens, catDe).map(([k, v]) => ({ nome: nomeCat(k), valor: v, cor: k === 'sem-detalhe' ? 'var(--pendente)' : cats[k]?.cor, antes: temAntes ? (antesPorCat[k] ?? 0) : null }));
  const porForma = M.somarPor(M.doCaixa(d.lancamentos, d.formas).filter(l => l.competencia === comp), l => l.formaId)
    .map(([k, v]) => ({ nome: formas[k]?.nome || 'Não informado', valor: v }));
  const pagos = M.doCaixa(d.lancamentos, d.formas).filter(l => l.competencia === comp && l.status === 'pago');
  const porPessoa = M.somarPor(pagos.filter(l => l.pagoPor), l => l.pagoPor).map(([k, v]) => ({ nome: k === '—' ? 'Sem registro' : k, valor: v }));
  const maiores = [...itens].filter(l => !l.semDetalhe).sort((a, b) => b.valor - a.valor).slice(0, 8);
  const totalPagos = pagos.reduce((t, l) => t + l.valor, 0);
  const fixas = itens.filter(l => l.origem?.tipo === 'recorrente').reduce((t, l) => t + l.valor, 0);
  const parcelas = itens.filter(l => l.origem?.tipo === 'compra' && l.origem.de > 1).reduce((t, l) => t + l.valor, 0);
  const avulsos = Math.max(0, total - fixas - parcelas);

  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  ${seletorMes(comp)}
  <dl class="resumo-q">
    <div><dt>Entrou</dt><dd>${brl(entrou)}</dd></div>
    <div><dt>Saiu</dt><dd>${brl(saiu)}</dd></div>
    <div class="${entrou - saiu < 0 ? 'negativo' : 'positivo'}"><dt>${entrou - saiu < 0 ? 'Faltou' : 'Sobrou'}</dt><dd>${brl(Math.abs(entrou - saiu))}</dd></div>
    <div><dt>Vale mercado</dt><dd>${brl(doVale)}</dd></div>
  </dl>
  ${extras > 0.004 ? `<p class="nota">Além disso, ${brl(extras)} foram pagos com dinheiro extra (abono, PLR, férias…).</p>` : ''}

  ${evolucao(ctx)}

  ${itens.length ? `<div class="diaadia-grade">
    <section class="bloco"><h2 class="bloco__titulo">Por categoria</h2>
      <p class="intro">As faturas de cartão aparecem abertas pelas compras de cada categoria.${temAntes ? ` Setas: diferença para ${nomeMes(antes).split(' ')[0]}.` : ''}</p>
      ${barras(porCat, total, { variacao: temAntes })}</section>
    <section class="bloco"><h2 class="bloco__titulo">Tipo de gasto</h2>
      ${barras([{ nome: 'Contas fixas e assinaturas', valor: fixas, cor: 'var(--q1)' }, { nome: 'Parcelas', valor: parcelas, cor: 'var(--q2)' }, { nome: 'Gastos avulsos', valor: avulsos, cor: 'var(--pinho)' }].filter(x => x.valor > 0.004), total)}
      <h2 class="bloco__titulo dividas__sub">Por cartão e forma de pagamento</h2>
      ${barras(porForma, saiu)}
      ${porPessoa.length ? `<h2 class="bloco__titulo dividas__sub">Quem pagou</h2>${barras(porPessoa, totalPagos)}` : ''}</section>
  </div>
  <section class="bloco"><h2 class="bloco__titulo">Maiores gastos do mês</h2>
    <ol class="maiores">${maiores.map(l => `<li><span>${esc(l.descricao)}<small>${esc([formas[l.formaId]?.nome, nomeCat(l.categoriaId ?? '—'), dataCurta(l.data)].filter(Boolean).join(', '))}</small></span><strong>${brl(l.valor)}</strong></li>`).join('')}</ol>
  </section>`
  : `<div class="vazio"><p class="vazio__titulo">Nenhum gasto em ${nomeMes(comp)}.</p></div>`}`;
}

export function ligar() {}
