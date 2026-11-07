// Planilha "Contas" atualizada pelo Eduardo em 07/11/2026 (tabela principal = o que se paga).
// Faturas por cartão e mês. Meses de 2027 vêm da tabela "Gastos Anuais 2027".
export default {
  versao: '2026-11-07',
  faturas: {
    bancopan:  { '2026-11': 628.28, '2026-12': 451.40, '2027-01': 231.14, '2027-02': 125, '2027-03': 125, '2027-04': 125, '2027-05': 125, '2027-06': 125, '2027-07': 125, '2027-08': 125, '2027-09': 125 },
    santander: { '2026-11': 1824.18, '2026-12': 733.45, '2027-01': 568.22, '2027-02': 495.12, '2027-03': 495.12, '2027-04': 413.81, '2027-05': 413.81, '2027-06': 187.61, '2027-07': 187.61, '2027-08': 187.61, '2027-09': 187.61 },
    picpay:    { '2026-11': 1014.78, '2026-12': 56.14, '2027-01': 56.14, '2027-02': 56.14, '2027-03': 56.14 },
    sansclub:  { '2026-11': 226.04, '2026-12': 101.74, '2027-01': 101.74, '2027-02': 101.74 },
    condor:    { '2026-11': 453.99, '2026-12': 78.41 },
    shopee:    { '2026-11': 304.53, '2026-12': 260.20, '2027-01': 260.19, '2027-02': 60.38, '2027-03': 60.38, '2027-04': 60.38, '2027-05': 27.64, '2027-09': 94.61 },
  },
  // meses cobertos pela planilha: fora deles, o app estima pelas compras
  ate: '2027-09',
  // contas que saíram da planilha a partir deste mês
  encerrar: { pan: '2026-10' },
  // valores previstos de contas variáveis
  ajustes: [{ recorrenteId: 'luz', competencia: '2026-11', valor: 817.70 }, { recorrenteId: 'luz', competencia: '2026-12', valor: 817.70 }],
};
