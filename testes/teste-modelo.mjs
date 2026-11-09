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

console.log('\nParcelamentos');
const tv = { id: 'tv', nome: 'TV', valorTotal: 2000, parcelas: 10, formaId: 'cs', categoriaId: 'lazer', primeiraData: '2026-11-15' };
let pt = M.gerarParcelas(tv, { diaVencimento: 15 });
pt = pt.map((l, i) => i < 3 ? M.pagar(l, { pagoPor: 'Eduardo', data: l.data }, eu, 'p') : l);
let r = M.resumoCompra(tv, pt);
ok(r.pagas === 3 && r.falta === 1400 && r.proxima.origem.parcela === 4 && r.termina === '2027-08-15', 'resumo: 3 de 10 pagas, falta R$ 1.400, termina em ago/27');
const ed = M.editarCompra(tv, pt, { valorTotal: 2000, parcelas: 12 }, { diaVencimento: 15 }, eu, 'e');
const pend = ed.salvar.filter(l => l.status !== 'pago');
ok(pend.length === 9 && pend.reduce((s, l) => s + M.cent(l.valor), 0) === 140000 && pend.at(-1).data === '2027-10-15', 'mudar para 12x: os R$ 1.400 restantes viram 9 parcelas, a última em out/27');
ok(ed.salvar.filter(l => l.status === 'pago').every(l => l.valor === 200 && l.descricao.endsWith('/12)')), 'parcelas pagas não mudam de valor, só o rótulo (x/12)');
const ed2 = M.editarCompra(tv, pt, { parcelas: 8 }, { diaVencimento: 15 }, eu, 'e');
ok(ed2.apagar.join() === 'tv_9,tv_10' && ed2.salvar.filter(l => l.status !== 'pago').length === 5, 'mudar para 8x apaga as parcelas 9 e 10 e redistribui');
let erro = ''; try { M.editarCompra(tv, pt, { parcelas: 2 }, null, eu, 'e'); } catch (e) { erro = e.message; }
ok(erro.includes('3 parcelas pagas'), 'não deixa ter menos parcelas do que as já pagas');
const ed3 = M.editarCompra(tv, pt, { nome: 'TV Sala', formaId: 'nub' }, { tipo: 'cartao', diaVencimento: 8 }, eu, 'e');
ok(ed3.salvar.find(l => l.id === 'tv_4').data === '2027-02-08' && ed3.salvar.find(l => l.id === 'tv_4').descricao === 'TV Sala (4/10)', 'trocar de cartão leva as pendentes para o vencimento do novo cartão');
const an = M.anteciparCompra(tv, pt, { valorPago: 1300, data: '2026-12-20', pagoPor: 'Amanda' }, eu, 'a');
ok(an.length === 7 && an.every(l => l.status === 'pago' && l.competencia === '2026-12' && l.quinzena === 2) && an.reduce((s, l) => s + M.cent(l.valor), 0) === 130000,
  'quitar antes por R$ 1.300: as 7 restantes saem da 2ª quinzena de dezembro');
ok(an[0].valorOriginal === 200, 'quitação guarda o valor original de cada parcela');

console.log('\nFaturas de cartão');
const fm = [{ id: 'cd', nome: 'Condor', tipo: 'cartao', diaVencimento: 15 }, { id: 'px', nome: 'Pix', tipo: 'pix' }];
const cel = M.gerarParcelas({ id: 'cel', nome: 'Celular', valorTotal: 120, parcelas: 3, formaId: 'cd', primeiraData: '2026-11-15' }, fm[0]);
const alug = { ...M.gerarParcelas({ id: 'al', nome: 'Aluguel', valorTotal: 900, parcelas: 1, formaId: 'px', primeiraData: '2026-11-01' }, fm[1])[0] };
let cx = M.doCaixa([...cel, alug], fm);
ok(cx.length === 4 && cx.filter(M.ehFatura).every(f => f.estimada && f.valor === 40), 'sem valor informado: fatura estimada pela soma das compras');
ok(!cx.some(l => l.origem?.id === 'cel'), 'compras do cartão não somam de novo nas quinzenas');
const inf = M.faturasInformadas({ cd: { '2026-11': 403 } }, fm, '2026-11');
cx = M.doCaixa([...cel.map(l => ({ ...l, naBase: true })), alug, ...inf], fm);
ok(cx.find(l => l.id === 'fatura_cd_2026-11').valor === 403 && cx.filter(M.ehFatura).length === 3, 'fatura informada (R$ 403) vale no lugar da soma');
ok(M.resumoFormas(fm, cx)[0].falta === 483, 'cartão: falta = faturas pendentes (403 + 40 + 40)');

const nova = M.gerarParcelas({ id: 'tv2', nome: 'Fone', valorTotal: 90, parcelas: 1, formaId: 'cd', primeiraData: '2026-11-15' }, fm[0]);
const base2 = cel.map(l => ({ ...l, naBase: true }));
cx = M.doCaixa([...base2, ...nova, ...inf], fm);
ok(cx.find(l => l.id === 'fatura_cd_2026-11').valor === 493, 'compra nova soma no valor informado (403 + 90)');
const marcada = nova.map(l => ({ ...l, naBase: true }));
ok(M.doCaixa([...base2, ...marcada, ...inf], fm).find(l => l.id === 'fatura_cd_2026-11').valor === 403, '"já está na fatura": não soma de novo');
const fin = { ...inf[0], valor: 450, valorFinal: true };
ok(M.doCaixa([...base2, ...nova, fin], fm).find(l => l.id === 'fatura_cd_2026-11').valor === 450, 'valor confirmado da fatura é o final');
const est = M.faturas([...cel.map(l => ({ ...l, naBase: true })), ...nova], fm).find(x => x.fatura.id === 'fatura_cd_2026-11').fatura;
ok(est.valor === 130 && est.valorInformado === 40, 'estimada guarda a base para não somar duas vezes ao salvar');
const psn = { ...M.gerarRecorrentes({ id: 'psn', nome: 'PSN', valor: 50, diaVencimento: 15, formaId: 'cd', inicio: '2026-11', assinatura: true }, '2026-11')[0] };
const infPlan = inf.map(f => M.comEvento(f, M.evento('importou', eu, 'x')));
ok(M.doCaixa([psn, ...infPlan], fm).find(l => l.id === 'fatura_cd_2026-11').valor === 403, 'assinatura no cartão: já incluída nas faturas da planilha');
ok(M.doCaixa([psn], fm).find(l => l.id === 'fatura_cd_2026-11').valor === 50, 'assinatura no cartão: soma na fatura estimada');
const out = M.gerarParcelas({ id: 'ou', nome: 'Antiga', valorTotal: 90, parcelas: 1, formaId: 'cd', primeiraData: '2026-10-15' }, fm[0]);
ok(!M.doCaixa([...out, ...inf], fm).some(l => l.id === 'fatura_cd_2026-10'), 'sem fatura estimada antes da primeira fatura informada do cartão');
const st = { diaVencimento: 15 };
ok(M.vencimentoDaCompra(st, '2026-11-06') === '2026-11-15' && M.vencimentoDaCompra(st, '2026-11-08') === '2026-12-15', 'sem fechamento: compra até 7 dias antes do vencimento entra no mês');
ok(M.vencimentoDaCompra({ diaVencimento: 5, diaFechamento: 28 }, '2026-11-27') === '2026-12-05' && M.vencimentoDaCompra({ diaVencimento: 5, diaFechamento: 28 }, '2026-11-28') === '2027-01-05', 'fecha 28 e vence 5: compra no dia 28 vai para a fatura seguinte');

const finC3 = M.gerarParcelas({ id: 'c3', nome: 'C3', valorTotal: 148633.80, parcelas: 60, formaId: 'bol', primeiraData: '2026-04-23' }, { tipo: 'boleto', diaVencimento: 15 });
ok(finC3[8].data === '2026-12-23' && finC3[59].data === '2031-03-23' && finC3[0].valor === 2477.23, 'financiamento no boleto: todas no dia 23, como a 1ª parcela');

const fc = finC3.map((l, i) => i < 8 ? { ...l, status: 'pago' } : l);
const ant = M.anteciparCompra({ id: 'c3' }, fc, { data: '2026-12-20', pagoPor: 'Eduardo', ids: ['c3_9', 'c3_10', 'c3_11'],
  valores: { c3_9: 2477.23, c3_10: 2390.10, c3_11: 2301.55 } }, eu, 'x');
ok(ant.map(l => l.valor).join() === '2477.23,2390.1,2301.55' && ant.every(l => l.competencia === '2026-12' && l.valorOriginal === 2477.23), 'antecipar com desconto diferente em cada parcela');

const dd = M.distribuirDesconto(finC3.slice(8, 12), 9700, '2026-12-20');
const vv = finC3.slice(8, 12).map(l => dd[l.id]);
ok(Math.round(vv.reduce((a, b) => a + b, 0) * 100) === 970000 && vv[0] > vv[1] && vv[1] > vv[2] && vv[2] > vv[3], 'só o total: desconto maior nas parcelas mais distantes, soma exata');

const vm = { id: 'vm', tipo: 'beneficio', saldoMensal: 1700, diaCredito: 20, ajusteDiaUtil: 'antes' };
ok(M.dataCredito(vm, '2026-11') === '2026-11-20' && M.dataCredito(vm, '2026-12') === '2026-12-18', 'vale renova dia 20; caindo no domingo (dez) vai para sexta 18');
const pv = M.periodoBeneficio(vm, '2026-12-10');
ok(pv.inicio === '2026-11-20' && pv.proxima === '2026-12-18', 'período do vale: de 20/11 até a véspera de 18/12');

const fs = [{ id: 'cg', tipo: 'consignado', descontaNoSalario: true }, { id: 'ep', tipo: 'emprestimo' }];
const emp = [{ id: 'a', formaId: 'cg', status: 'pendente', data: '2026-11-30', valor: 300, competencia: '2026-12', quinzena: 1 },
  { id: 'b', formaId: 'cg', status: 'pendente', data: '2026-12-30', valor: 300, competencia: '2027-01', quinzena: 1 },
  { id: 'c', formaId: 'ep', status: 'pendente', data: '2026-11-30', valor: 200, competencia: '2026-12', quinzena: 1 }];
ok(M.doCaixa(emp, fs).map(l => l.id).join() === 'c' && M.paraDividas(emp, fs).length === 3, 'desconto no salário: fora das quinzenas, dentro de Dívidas');
const bx = M.baixasNoSalario(emp, fs, '2026-12-01', 'x');
ok(bx.length === 1 && bx[0].id === 'a' && bx[0].status === 'pago', 'parcela descontada no salário dá baixa sozinha no dia');

const qx = [{ id: 'car', competencia: '2026-11', quinzena: 2, valor: 2477.23, status: 'pago', pagoCom: 'Abono' },
  { id: 'luz', competencia: '2026-11', quinzena: 2, valor: 817.70, status: 'pendente' }];
const pq = M.painelQuinzenas([{ competencia: '2026-11', quinzena: 2, valor: 2381.60 }], qx, ['2026-11'])[1];
ok(pq.gastos === 817.7 && pq.extras === 2477.23 && Math.abs(pq.saldo - 1563.9) < 0.001, 'pago com dinheiro extra (abono) não pesa no Sai/Falta da quinzena');
const pgx = M.pagar({ id: 'x', valor: 10, status: 'pendente' }, { pagoPor: 'Eduardo', data: '2026-11-09', pagoCom: 'PLR' }, eu, 'x');
ok(pgx.pagoCom === 'PLR' && M.desfazerPagamento(pgx, eu, 'x').pagoCom === null, 'pagar com PLR guarda a origem; desfazer limpa');

const dvs = [
  { compra: { id: 'a', nome: 'Sofá' }, falta: 500, parcela: 500, restantes: 1, pendentes: [{ valor: 500, data: '2026-12-01', competencia: '2026-12' }], termina: '2026-12-01' },
  { compra: { id: 'b', nome: 'Celular' }, falta: 1200, parcela: 200, restantes: 6,
    pendentes: Array.from({ length: 6 }, (_, i) => ({ valor: 200, data: `2027-0${i + 1}-10`, competencia: `2027-0${i + 1}` })), termina: '2027-06-10' },
  { compra: { id: 'c', nome: 'Carro' }, falta: 9000, parcela: 3000, restantes: 3,
    pendentes: Array.from({ length: 3 }, (_, i) => ({ valor: 3000, data: `2027-0${i + 1}-23`, competencia: `2027-0${i + 1}` })), termina: '2027-03-23' }];
const pl = M.planoQuitacao(dvs, 1300, 'alivio');
ok(pl.passos[0].compra.id === 'a' && pl.passos[0].acao === 'quita' && pl.passos[1].compra.id === 'c' && !pl.passos[1].acao
  && pl.passos[2].acao === 'antecipa' && pl.passos[2].n === 4 && pl.alivioMensal === 0 && pl.sobra === 0, 'plano: quita a que termina antes, antecipa as últimas da próxima que couber');
const pm = M.planoQuitacao(dvs, 1700, 'menor');
ok(pm.passos.map(x => x.acao).join() === 'quita,quita,' && pm.alivioMensal === 200, 'plano bola de neve: menor valor primeiro');
const sim = M.parcelasSimuladas({ valorTotal: 1200, parcelas: 3, formaId: 'b1', data: '2026-11-10' }, { id: 'b1', tipo: 'boleto', diaVencimento: 10 });
ok(sim.length === 3 && sim[0].valor === 400 && sim[2].competencia === '2027-01', 'simular 3x no boleto');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
