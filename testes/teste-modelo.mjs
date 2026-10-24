// Testes das regras do app. Rodar na pasta do app:  node testes/teste-modelo.mjs
import * as M from '../js/modelo.js';
let falhas = 0;
const ok = (c, msg) => { console.log((c ? '  ✔ ' : '  ✘ ') + msg); if (!c) falhas++; };

console.log('\nDatas e parcelas');
ok(M.quinzenaDe('2026-10-14') === 1 && M.quinzenaDe('2026-10-15') === 2, 'dia 1–14 → 1ª, 15–31 → 2ª');
ok(M.somarMeses('2027-01-31', 1) === '2027-02-28', '31/jan + 1 mês = 28/fev');
ok(M.somarMesesComp('2026-01', -1) === '2025-12' && M.somarMesesComp('2026-12', 1) === '2027-01', 'virada de ano nos dois sentidos');
ok(M.dividirParcelas(100, 3).join() === '33.33,33.33,33.34', 'R$100 em 3x = 33,33+33,33+33,34');
const ps = M.gerarParcelas({ id: 'c', nome: 'TV', valorTotal: 2000, parcelas: 10, primeiraData: '2026-11-15' }, { diaVencimento: 15 });
ok(ps.length === 10 && ps[9].data === '2027-08-15' && ps[0].id === 'c_1', '10x: última em 15/08/2027, ids fixos');

console.log('\nEntradas (salário no dia 30)');
ok(JSON.stringify(M.destinoEntrada('2026-10-30')) === '{"competencia":"2026-11","quinzena":1}', 'salário de 30/10 paga a 1ª quinzena de novembro');
ok(M.destinoEntrada('2026-10-15').quinzena === 2 && M.destinoEntrada('2026-10-05').quinzena === 1, 'dia 15 → 2ª, dia 5 → 1ª');
const sal = { id: 's', tipo: 'variavel', valor: 1330, dia: 30, inicio: '2026-07' };
const vale = { id: 'v', tipo: 'fixa', valor: 2381.6, dia: 15, inicio: '2026-07' };
const ent = [1800, 1630, 1330].map((v, i) => ({ fonteId: 's', valor: v, data: `2026-0${7 + i}-30`, ref: `2026-0${7 + i}`, ...M.destinoEntrada(`2026-0${7 + i}-30`) }));
ok(M.estimativaFonte(sal, ent) === 1586.67, 'previsto = média de 1800, 1630 e 1330 = R$ 1.586,67');
ok(M.estimativaFonte(sal, []) === 1330, 'sem histórico usa o valor estimado');
const rec = M.receitasNoPeriodo([sal, vale], ent, ['2026-10', '2026-11']);
const nov1 = rec.filter(r => r.competencia === '2026-11' && r.quinzena === 1);
ok(nov1.length === 1 && nov1[0].previsto && nov1[0].valor === 1586.67 && nov1[0].ref === '2026-10', 'nov/1ª: salário previsto (ref out)');
ok(rec.filter(r => r.competencia === '2026-10' && r.quinzena === 1).map(r => r.valor).join() === '1330', 'out/1ª: salário recebido, sem duplicar previsão');
ok(rec.filter(r => r.quinzena === 2).every(r => r.valor === 2381.6 && !r.aConfirmar), 'vale fixo entra sozinho, sem pedir confirmação');
ok(M.receitasNoPeriodo([{ id: 'a', tipo: 'eventual', dia: null }], [], ['2026-11']).length === 0, 'renda eventual não é prevista');

console.log('\nContas fixas e assinaturas');
const luz = { id: 'luz', nome: 'Luz', valor: 700, valorVariavel: true, diaVencimento: 15, inicio: '2026-10' };
let lancs = M.gerarRecorrentes(luz, '2027-01');
ok(lancs.length === 4 && lancs.every(l => l.confirmado === false), 'conta variável gera meses com valor a confirmar');
lancs[1] = { ...lancs[1], valor: 812.5, confirmado: true };
lancs[0] = M.marcarPago(lancs[0], '2026-10-15');
let s = M.sincronizarRecorrente({ ...luz, valor: 750, fim: '2026-12' }, lancs, '2026-11', '2027-10');
ok(s.apagar.join() === 'luz_2027-01', 'encerrar em dez apaga jan em diante');
ok(s.atualizar.find(l => l.id === 'luz_2026-11').valor === 812.5, 'não desfaz valor já confirmado');
ok(s.atualizar.find(l => l.id === 'luz_2026-12').valor === 750, 'atualiza meses ainda estimados');
ok(!s.atualizar.some(l => l.id === 'luz_2026-10'), 'mês pago não é tocado');
const ps5 = { id: 'ps', nome: 'PS Plus', valor: 300, ciclo: 'anual', mesRenovacao: 3, diaVencimento: 10, inicio: '2026-01', assinatura: true };
ok(M.mesesDaRecorrente(ps5, '2026-01', '2027-12').join() === '2026-03,2027-03', 'anual: cobra só no mês da renovação');
ok(M.custoMensal(ps5) === 25, 'anual de R$ 300 = R$ 25 por mês no total');
ok(M.precisaRevisar({ ultimaRevisao: '2026-07-01' }, '2026-10-23') && !M.precisaRevisar({ ultimaRevisao: '2026-10-01' }, '2026-10-23'), 'revisão "ainda usa?" a cada 90 dias');
ok(!M.assinaturaAtiva({ inicio: '2026-01', fim: '2026-10' }, '2026-11'), 'cancelada em out não conta em nov');

console.log('\nPainel');
const p = M.painelQuinzenas(rec, [...ps, ...lancs], ['2026-11']);
ok(p[0].temPrevisao && p[0].receita === 1586.67, 'painel marca quinzena com valor previsto');
ok(p[1].gastos === 200 + 812.5 && p[1].acumulado === M.reais(M.cent(p[0].saldo) + M.cent(p[1].saldo)), 'saldo acumulado carrega da 1ª para a 2ª');

console.log('\nPagar, adiar e histórico');
const eu = { uid: 'u1', nome: 'Eduardo' };
const base = M.gerarParcelas({ id: 'k', nome: 'Luz', valorTotal: 700, parcelas: 1, primeiraData: '2026-11-15' }, null)[0];
const pg = M.pagar(base, { pagoPor: 'Amanda', data: '2026-11-14' }, eu, '2026-11-14T10:00:00Z');
ok(pg.status === 'pago' && pg.pagoPor === 'Amanda' && pg.historico.at(-1).nome === 'Eduardo', 'pago por Amanda, marcado por Eduardo (fica registrado)');
const pj = M.pagar(base, { pagoPor: 'Eduardo', data: '2026-11-20', valorPago: 721.4 }, eu, 'x');
ok(pj.valor === 721.4 && pj.valorOriginal === 700, 'pagou com juros: valor muda e o original fica guardado');
const df = M.desfazerPagamento(pg, eu, 'y');
ok(df.status === 'pendente' && !df.pagoPor && df.historico.length === 2, 'desfazer volta a pendente e entra no histórico');
const ad = M.adiar(base, '2026-12-03', 'Sem dinheiro agora', eu, 'z');
ok(ad.competencia === '2026-12' && ad.quinzena === 1 && M.foiAdiado(ad), 'adiar de 15/11 para 03/12 muda para a 1ª quinzena de dezembro');
const rn = M.adiar(base, '2026-11-25', 'Renegociei', eu, 'w', 650);
ok(rn.valor === 650 && rn.valorOriginal === 700 && rn.historico.at(-1).valorPara === 650, 'renegociar com novo valor guarda o antigo');
ok(!M.foiAdiado(pg), 'só pagar não conta como adiamento');
const rec2 = { id: 'agua', nome: 'Água', valor: 90, diaVencimento: 10, inicio: '2026-11' };
const la = M.gerarRecorrentes(rec2, '2026-12'); la[1] = M.adiar(la[1], '2026-12-20', null, eu, 'q');
const sy = M.sincronizarRecorrente({ ...rec2, valor: 95 }, la, '2026-11', '2026-12');
ok(sy.atualizar.find(l => l.id === 'agua_2026-12').data === '2026-12-20' && sy.atualizar.find(l => l.id === 'agua_2026-12').valor === 95, 'mudar a conta fixa não desfaz o adiamento');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
