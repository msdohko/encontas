import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { novoId } from '../store.js';
import { brl, esc, abrirFolha, formHTML, ligarForm, toast, pessoasDaCasa, ICONES } from '../ui.js';

export const TIPOS_FORMA = [['cartao', 'Cartão de crédito'], ['boleto', 'Boleto'], ['pix', 'Pix/Débito'], ['carne', 'Carnê'],
  ['crediario', 'Crediário'], ['emprestimo', 'Empréstimo'], ['consignado', 'Consignado'], ['dinheiro', 'Dinheiro']];
const TIPO_FONTE = { fixa: 'Valor fixo', variavel: 'Varia todo mês', eventual: 'Sem data certa' };
const mesAtual = ctx => ctx.hoje.slice(0, 7);
const opFormas = d => d.formas.filter(f => f.ativo !== false).map(f => [f.id, f.nome]);
const opCats = d => [...d.categorias].sort((a, b) => a.ordem - b.ordem).map(c => [c.id, c.nome]);

/** Definição de cada cadastro: campos do formulário, como listar e como salvar */
export const CADASTROS = {
  fontes: {
    titulo: 'Fontes de renda', item: 'fonte de renda', colecao: 'fontes',
    intro: 'De onde vem o dinheiro da casa. O salário que varia é estimado pela média dos últimos 3 meses até você confirmar o valor real.',
    campos: ctx => [
      { n: 'nome', r: 'Nome', obrig: true, ph: 'Ex.: Salário, Vendas da Amanda' },
      { n: 'pessoa', r: 'De quem é', sugestoes: pessoasDaCasa(ctx.dados), ph: 'Ex.: Eduardo' },
      { n: 'tipo', r: 'Como entra', t: 'opcoes', obrig: true, padrao: 'variavel', op: Object.entries(TIPO_FONTE) },
      { n: 'valor', r: 'Valor', t: 'dinheiro', se: v => v.tipo === 'fixa', obrig: true },
      { n: 'valorEst', r: 'Valor estimado', t: 'dinheiro', se: v => v.tipo === 'variavel', ajuda: 'Usado só até existirem valores confirmados.' },
      { n: 'dia', r: 'Dia em que cai', t: 'dia', se: v => v.tipo !== 'eventual', obrig: true,
        ajuda: 'Do dia 25 em diante, o dinheiro paga a 1ª quinzena do mês seguinte.' },
      { n: 'ativo', r: 'Ativa', t: 'check', padrao: true },
    ],
    valores: f => ({ ...f, valorEst: f.tipo === 'variavel' ? f.valor : null }),
    salvar: (ctx, obj, v) => {
      const o = { ...obj, ...v, valor: v.tipo === 'variavel' ? (v.valorEst || 0) : v.tipo === 'fixa' ? v.valor : 0,
        dia: v.tipo === 'eventual' ? null : v.dia, inicio: obj.inicio || mesAtual(ctx), id: obj.id || novoId() };
      delete o.valorEst;
      return A.salvarSimples(ctx, 'fontes', o);
    },
    excluir: (ctx, o) => A.excluirSimples(ctx, 'fontes', o.id),
    linha: (ctx, f) => ({
      nome: f.nome, sub: [f.pessoa, TIPO_FONTE[f.tipo], f.dia ? `dia ${f.dia}` : null, f.ativo === false ? 'inativa' : null].filter(Boolean).join(', '),
      valor: f.tipo === 'eventual' ? 'quando entrar' : (f.tipo === 'variavel' ? '≈ ' : '') + brl(M.estimativaFonte(f, ctx.dados.entradas)),
    }),
    lista: d => d.fontes,
  },

  contas: {
    titulo: 'Contas fixas', item: 'conta fixa', colecao: 'recorrentes',
    intro: 'Contas que se repetem todo mês. O app lança sozinho os próximos 12 meses; se o valor muda (luz, água), ele pergunta quando a conta chegar.',
    campos: ctx => [
      { n: 'nome', r: 'Nome', obrig: true, ph: 'Ex.: Aluguel, Luz' },
      { n: 'valor', r: 'Valor', t: 'dinheiro', obrig: true },
      { n: 'valorVariavel', r: 'O valor muda todo mês', t: 'check' },
      { n: 'diaVencimento', r: 'Dia do vencimento', t: 'dia', obrig: true },
      { n: 'formaId', r: 'Como paga', t: 'lista', op: opFormas(ctx.dados) },
      { n: 'categoriaId', r: 'Categoria', t: 'lista', op: opCats(ctx.dados) },
      { n: 'inicio', r: 'Começa em', t: 'mes', padrao: mesAtual(ctx), obrig: true },
      { n: 'fim', r: 'Termina em (opcional)', t: 'mes' },
    ],
    salvar: (ctx, obj, v) => A.salvarRecorrente(ctx, { ...obj, ...v, assinatura: false }),
    excluir: (ctx, o) => A.excluirRecorrente(ctx, o),
    linha: (ctx, r) => ({
      nome: r.nome, sub: [`dia ${r.diaVencimento}`, ctx.dados.formas.find(f => f.id === r.formaId)?.nome, r.valorVariavel ? 'valor variável' : null,
        r.fim ? (r.fim < mesAtual(ctx) ? `encerrada em ${r.fim.slice(5)}/${r.fim.slice(0, 4)}` : `até ${r.fim.slice(5)}/${r.fim.slice(0, 4)}`) : null].filter(Boolean).join(', '),
      valor: (r.valorVariavel ? '≈ ' : '') + brl(r.valor),
    }),
    lista: d => d.recorrentes.filter(r => !r.assinatura),
  },

  assinaturas: {
    titulo: 'Assinaturas', item: 'assinatura', colecao: 'recorrentes',
    campos: ctx => [
      { n: 'nome', r: 'Nome', obrig: true, ph: 'Ex.: Spotify', sugestoes: ['Spotify', 'PS Plus', 'Netflix', 'Vivo Controle', 'TIM Controle', 'Amazon Prime', 'YouTube Premium', 'iCloud', 'Disney+', 'Max'] },
      { n: 'valor', r: 'Valor', t: 'dinheiro', obrig: true },
      { n: 'ciclo', r: 'Cobrança', t: 'opcoes', padrao: 'mensal', op: [['mensal', 'Mensal'], ['anual', 'Anual']] },
      { n: 'mesRenovacao', r: 'Mês da renovação', t: 'lista', se: v => v.ciclo === 'anual', obrig: true,
        op: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].map((m, i) => [i + 1, m]) },
      { n: 'diaVencimento', r: 'Dia da cobrança', t: 'dia', obrig: true },
      { n: 'formaId', r: 'Onde cai', t: 'lista', op: opFormas(ctx.dados), ajuda: 'No cartão, ela entra na fatura daquele cartão.' },
      { n: 'pessoa', r: 'Quem usa', sugestoes: pessoasDaCasa(ctx.dados), ph: 'Ex.: Eduardo, Amanda, Casa' },
      { n: 'inicio', r: 'Desde', t: 'mes', padrao: mesAtual(ctx), obrig: true },
    ],
    salvar: (ctx, obj, v) => A.salvarRecorrente(ctx, { ...obj, ...v, assinatura: true, categoriaId: obj.categoriaId || 'assinaturas',
      mesRenovacao: v.ciclo === 'anual' ? Number(v.mesRenovacao) : null, ultimaRevisao: obj.ultimaRevisao || ctx.hoje }),
    excluir: (ctx, o) => A.excluirRecorrente(ctx, o),
    lista: d => d.recorrentes.filter(r => r.assinatura),
  },

  formas: {
    titulo: 'Cartões e formas de pagamento', item: 'forma de pagamento', colecao: 'formas',
    intro: 'Onde cada gasto é descontado. O dia de vencimento decide em qual quinzena caem as parcelas.',
    campos: () => [
      { n: 'nome', r: 'Nome', obrig: true, ph: 'Ex.: Cartão Santander' },
      { n: 'tipo', r: 'Tipo', t: 'lista', obrig: true, op: TIPOS_FORMA },
      { n: 'diaVencimento', r: 'Dia de vencimento', t: 'dia', obrig: true, ajuda: 'No cartão, o dia em que a fatura vence.' },
      { n: 'limite', r: 'Limite', t: 'dinheiro', se: v => v.tipo === 'cartao' || v.tipo === 'crediario' },
      { n: 'ativo', r: 'Ativa', t: 'check', padrao: true },
    ],
    salvar: (ctx, obj, v) => A.salvarSimples(ctx, 'formas', { ...obj, ...v, limite: Number.isNaN(v.limite) ? null : v.limite, id: obj.id || novoId() }),
    excluir: (ctx, o) => {
      if (ctx.dados.lancamentos.some(l => l.formaId === o.id)) throw new Error('Essa forma tem lançamentos. Desative em vez de excluir.');
      return A.excluirSimples(ctx, 'formas', o.id);
    },
    linha: (ctx, f) => ({ nome: f.nome, sub: [TIPOS_FORMA.find(t => t[0] === f.tipo)?.[1], `vence dia ${f.diaVencimento}`, f.ativo === false ? 'inativa' : null].filter(Boolean).join(', '),
      valor: f.limite ? `limite ${brl(f.limite)}` : '' }),
    lista: d => d.formas,
  },

  categorias: {
    titulo: 'Categorias', item: 'categoria', colecao: 'categorias',
    campos: () => [{ n: 'nome', r: 'Nome', obrig: true }, { n: 'cor', r: 'Cor', t: 'cor' }],
    salvar: (ctx, obj, v) => A.salvarSimples(ctx, 'categorias', { ...obj, ...v, ordem: obj.ordem ?? ctx.dados.categorias.length + 1, id: obj.id || novoId() }),
    excluir: (ctx, o) => {
      if (ctx.dados.lancamentos.some(l => l.categoriaId === o.id)) throw new Error('Essa categoria está em uso.');
      return A.excluirSimples(ctx, 'categorias', o.id);
    },
    linha: (ctx, c) => ({ nome: c.nome, cor: c.cor, sub: `${ctx.dados.lancamentos.filter(l => l.categoriaId === c.id).length} lançamentos`, valor: '' }),
    lista: d => [...d.categorias].sort((a, b) => a.ordem - b.ordem),
  },
};

/** Abre o formulário de criar/editar de qualquer cadastro */
export function abrirEdicao(ctx, tipo, obj = {}) {
  const cfg = CADASTROS[tipo], campos = cfg.campos(ctx), novo = !obj.id;
  abrirFolha({
    titulo: novo ? `Nova ${cfg.item}` : `Editar ${cfg.item}`,
    corpo: formHTML(campos, cfg.valores ? cfg.valores(obj) : obj, novo ? 'Adicionar' : 'Salvar',
      novo ? '' : `<button type="button" class="btn btn--perigo" data-excluir>Excluir</button>`),
    ligar: (el, fechar) => {
      ligarForm(el.querySelector('form'), campos, async v => {
        await cfg.salvar(ctx, obj, v); fechar(); toast(novo ? 'Adicionado' : 'Salvo'); ctx.render();
      });
      el.querySelector('[data-excluir]')?.addEventListener('click', async () => {
        if (!confirmarDuasVezes(el.querySelector('[data-excluir]'))) return;
        try { await cfg.excluir(ctx, obj); fechar(); toast('Excluído'); ctx.render(); } catch (e) { toast(e.message); }
      });
    },
  });
}

// Excluir pede um segundo toque (sem alert do navegador)
function confirmarDuasVezes(btn) {
  if (btn.dataset.certeza) return true;
  btn.dataset.certeza = '1'; btn.textContent = 'Toque de novo para excluir';
  setTimeout(() => { delete btn.dataset.certeza; btn.textContent = 'Excluir'; }, 3000);
  return false;
}

// ── Tela de um cadastro (#/cadastros/<tipo>) ─────────────────────────
export function titulo(ctx) { return CADASTROS[ctx.param]?.titulo || 'Cadastros'; }

export function render(ctx) {
  const cfg = CADASTROS[ctx.param];
  if (!cfg) return `<p>Cadastro não encontrado. <a href="#/mais">Voltar</a></p>`;
  const itens = cfg.lista(ctx.dados);
  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  ${cfg.intro ? `<p class="intro">${cfg.intro}</p>` : ''}
  <button class="btn" data-novo>Adicionar ${cfg.item}</button>
  ${itens.length ? `<ul class="cadastro">${itens.map(o => { const l = cfg.linha(ctx, o); return `
    <li><button class="cadastro__item" data-id="${esc(o.id)}">
      ${l.cor ? `<i class="cadastro__cor" style="background:${esc(l.cor)}"></i>` : ''}
      <span class="cadastro__nome">${esc(l.nome)}<small>${esc(l.sub || '')}</small></span>
      <span class="cadastro__valor">${esc(l.valor || '')}</span>${ICONES.editar}</button></li>`; }).join('')}</ul>`
  : `<div class="vazio"><p class="vazio__titulo">Nada cadastrado ainda.</p></div>`}`;
}

export function ligar(el, ctx) {
  const cfg = CADASTROS[ctx.param]; if (!cfg) return;
  el.querySelector('[data-novo]')?.addEventListener('click', () => abrirEdicao(ctx, ctx.param));
  el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () =>
    abrirEdicao(ctx, ctx.param, cfg.lista(ctx.dados).find(o => o.id === b.dataset.id))));
}
