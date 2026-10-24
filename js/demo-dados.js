// Dados de exemplo (planilha Contas) usados só no modo demonstração
export default {
 "_sobre": "Dados de exemplo tirados da planilha Contas.numbers (ago–dez/2026). Itens com 'confirmar' precisam da sua revisão.",
 "casa": {
  "id": "casa-eduardo-amanda",
  "nome": "Casa Eduardo & Amanda",
  "membros": [
   "UID_EDUARDO",
   "UID_AMANDA"
  ]
 },
 "categorias": [
  {
   "id": "moradia",
   "nome": "Moradia",
   "cor": "#5b7cfa",
   "ordem": 1
  },
  {
   "id": "contas",
   "nome": "Contas da casa",
   "cor": "#2bb3c0",
   "ordem": 2
  },
  {
   "id": "cartoes",
   "nome": "Cartões",
   "cor": "#9b5de5",
   "ordem": 3
  },
  {
   "id": "transporte",
   "nome": "Transporte/Carro",
   "cor": "#f18f01",
   "ordem": 4
  },
  {
   "id": "mercado",
   "nome": "Mercado",
   "cor": "#43aa8b",
   "ordem": 5
  },
  {
   "id": "familia",
   "nome": "Família",
   "cor": "#f15bb5",
   "ordem": 6
  },
  {
   "id": "lazer",
   "nome": "Lazer",
   "cor": "#fee440",
   "ordem": 7
  },
  {
   "id": "dividas",
   "nome": "Dívidas/Empréstimos",
   "cor": "#d64545",
   "ordem": 8
  }
 ],
 "formas": [
  {
   "id": "santander",
   "nome": "Cartão Santander",
   "tipo": "cartao",
   "limite": 5300,
   "diaVencimento": 15,
   "confirmar": "dia de vencimento real"
  },
  {
   "id": "picpay",
   "nome": "Cartão PicPay",
   "tipo": "cartao",
   "limite": 1700,
   "diaVencimento": 15,
   "confirmar": "dia de vencimento real"
  },
  {
   "id": "sansclub",
   "nome": "Cartão SansClub",
   "tipo": "cartao",
   "limite": 850,
   "diaVencimento": 15,
   "confirmar": "dia de vencimento real"
  },
  {
   "id": "condor",
   "nome": "Cartão Condor",
   "tipo": "cartao",
   "limite": 1850,
   "diaVencimento": 15,
   "confirmar": "dia de vencimento real"
  },
  {
   "id": "bancopan",
   "nome": "Cartão BancoPan",
   "tipo": "cartao",
   "limite": 2500,
   "diaVencimento": 15,
   "confirmar": "dia de vencimento real"
  },
  {
   "id": "shopee",
   "nome": "Shopee",
   "tipo": "crediario",
   "limite": 2285,
   "diaVencimento": 15
  },
  {
   "id": "boleto",
   "nome": "Boleto",
   "tipo": "boleto",
   "limite": null,
   "diaVencimento": 15
  },
  {
   "id": "pix",
   "nome": "Pix/Débito",
   "tipo": "pix",
   "limite": null,
   "diaVencimento": 1
  },
  {
   "id": "carne",
   "nome": "Carnê",
   "tipo": "carne",
   "limite": null,
   "diaVencimento": 1
  },
  {
   "id": "emprestimo",
   "nome": "Empréstimo Pan",
   "tipo": "emprestimo",
   "limite": null,
   "diaVencimento": 1
  },
  {
   "id": "consignado",
   "nome": "Consignado",
   "tipo": "consignado",
   "limite": null,
   "diaVencimento": 1
  }
 ],
 "recorrentes": [
  {
   "id": "aluguel",
   "nome": "Aluguel",
   "valor": 955.75,
   "valorVariavel": false,
   "diaVencimento": 1,
   "formaId": "boleto",
   "categoriaId": "moradia",
   "inicio": "2026-08",
   "fim": null
  },
  {
   "id": "condominio",
   "nome": "Condomínio",
   "valor": 450.0,
   "valorVariavel": false,
   "diaVencimento": 15,
   "formaId": "boleto",
   "categoriaId": "moradia",
   "inicio": "2026-09",
   "fim": null
  },
  {
   "id": "luz",
   "nome": "Luz",
   "valor": 702.89,
   "valorVariavel": true,
   "diaVencimento": 15,
   "formaId": "boleto",
   "categoriaId": "contas",
   "inicio": "2026-09",
   "fim": null
  },
  {
   "id": "ciprov",
   "nome": "Ciprov",
   "valor": 212.43,
   "valorVariavel": false,
   "diaVencimento": 15,
   "formaId": "boleto",
   "categoriaId": "contas",
   "inicio": "2026-08",
   "fim": null,
   "confirmar": "categoria certa?"
  },
  {
   "id": "internet",
   "nome": "Internet",
   "valor": 160.0,
   "valorVariavel": false,
   "diaVencimento": 15,
   "formaId": "boleto",
   "categoriaId": "contas",
   "inicio": "2026-08",
   "fim": null
  },
  {
   "id": "recarga",
   "nome": "Recarga Celular",
   "valor": 75.0,
   "valorVariavel": false,
   "diaVencimento": 15,
   "formaId": "pix",
   "categoriaId": "contas",
   "inicio": "2026-08",
   "fim": null,
   "assinatura": true,
   "ciclo": "mensal",
   "pessoa": "Eduardo",
   "ultimaRevisao": null,
   "confirmar": "é o Vivo Controle?"
  },
  {
   "id": "pan",
   "nome": "Empréstimo Pan",
   "valor": 402.0,
   "valorVariavel": false,
   "diaVencimento": 1,
   "formaId": "emprestimo",
   "categoriaId": "dividas",
   "inicio": "2026-09",
   "fim": null,
   "confirmar": "quantas parcelas faltam? vira compra parcelada"
  }
 ],
 "compras": [
  {
   "id": "superpro",
   "nome": "SuperPro",
   "valorTotal": 610.68,
   "parcelas": 6,
   "formaId": "sansclub",
   "categoriaId": "cartoes",
   "primeiraData": "2026-09-15"
  },
  {
   "id": "guitarra",
   "nome": "Guitarra Davi",
   "valorTotal": 2262.0,
   "parcelas": 10,
   "formaId": "santander",
   "categoriaId": "familia",
   "primeiraData": "2026-09-15"
  },
  {
   "id": "havan",
   "nome": "Havan Mãe",
   "valorTotal": 519.9,
   "parcelas": 5,
   "formaId": "santander",
   "categoriaId": "familia",
   "primeiraData": "2026-09-15",
   "confirmar": "planilha diz última em 12/2026 (5x a partir de set acaba em jan)"
  },
  {
   "id": "renner",
   "nome": "Renner",
   "valorTotal": 975.72,
   "parcelas": 12,
   "formaId": "santander",
   "categoriaId": "familia",
   "primeiraData": "2026-10-15",
   "confirmar": "planilha diz última em 03/2027, mas 12x acaba em 09/2027"
  },
  {
   "id": "lara12",
   "nome": "Celular Lara",
   "valorTotal": 462.12,
   "parcelas": 12,
   "formaId": "condor",
   "categoriaId": "familia",
   "primeiraData": "2026-09-15"
  },
  {
   "id": "lara6",
   "nome": "Celular Lara",
   "valorTotal": 348.0,
   "parcelas": 6,
   "formaId": "condor",
   "categoriaId": "familia",
   "primeiraData": "2026-09-15"
  },
  {
   "id": "amanda",
   "nome": "Celular Amanda",
   "valorTotal": 798.0,
   "parcelas": 20,
   "formaId": "condor",
   "categoriaId": "familia",
   "primeiraData": "2026-04-15"
  },
  {
   "id": "sofa",
   "nome": "Sofá",
   "valorTotal": 2000.0,
   "parcelas": 4,
   "formaId": "carne",
   "categoriaId": "moradia",
   "primeiraData": "2026-08-01"
  },
  {
   "id": "c3-ago",
   "nome": "Parcela C3",
   "valorTotal": 2277.91,
   "parcelas": 1,
   "formaId": "boleto",
   "categoriaId": "transporte",
   "primeiraData": "2026-08-15"
  },
  {
   "id": "c3-out",
   "nome": "Parcela C3",
   "valorTotal": 2344.93,
   "parcelas": 1,
   "formaId": "boleto",
   "categoriaId": "transporte",
   "primeiraData": "2026-10-01"
  },
  {
   "id": "licenc",
   "nome": "Licenciamento",
   "valorTotal": 94.61,
   "parcelas": 1,
   "formaId": "boleto",
   "categoriaId": "transporte",
   "primeiraData": "2026-09-15"
  }
 ],
 "ajustes": [
  {"recorrenteId": "recarga", "competencia": "2026-08", "valor": 60},
  {"recorrenteId": "recarga", "competencia": "2026-09", "valor": 60},
  {"recorrenteId": "recarga", "competencia": "2026-10", "valor": 60},
  {
   "recorrenteId": "luz",
   "competencia": "2026-11",
   "valor": 817.7
  },
  {
   "recorrenteId": "luz",
   "competencia": "2026-12",
   "valor": 817.7
  }
 ],
 "planilhaFaturas": {
  "_sobre": "Faturas digitadas na planilha (out–dez). A diferença para as parcelas detalhadas = compras que ainda não estão cadastradas.",
  "santander": {
   "2026-10": 1043.43,
   "2026-11": 733.45,
   "2026-12": 733.45
  },
  "picpay": {
   "2026-10": 56.14,
   "2026-11": 477.93,
   "2026-12": 56.18
  },
  "sansclub": {
   "2026-10": 101.74,
   "2026-11": 226.04,
   "2026-12": 101.74
  },
  "condor": {
   "2026-10": 528.23,
   "2026-11": 403.0,
   "2026-12": 78.41
  },
  "bancopan": {
   "2026-10": 513.09,
   "2026-11": 308.44,
   "2026-12": 131.56
  },
  "shopee": {
   "2026-10": 250.43,
   "2026-11": 60.76,
   "2026-12": 27.61
  }
 },
 "fontes": [
  {
   "id": "salario",
   "nome": "Salário",
   "pessoa": "Eduardo",
   "tipo": "variavel",
   "valor": 1330,
   "dia": 30,
   "inicio": "2026-07",
   "fim": null,
   "ativo": true
  },
  {
   "id": "vale",
   "nome": "Vale",
   "pessoa": "Eduardo",
   "tipo": "fixa",
   "valor": 2381.6,
   "dia": 15,
   "inicio": "2026-08",
   "fim": null,
   "ativo": true
  },
  {
   "id": "vendas-amanda",
   "nome": "Vendas da Amanda",
   "pessoa": "Amanda",
   "tipo": "eventual",
   "valor": 0,
   "dia": null,
   "ativo": true
  },
  {
   "id": "pedacinho",
   "nome": "Pedacinho 3D (retiradas)",
   "pessoa": "Casa",
   "tipo": "eventual",
   "valor": 0,
   "dia": null,
   "ativo": true
  },
  {
   "id": "extras",
   "nome": "Extras e abonos",
   "pessoa": "Eduardo",
   "tipo": "eventual",
   "valor": 0,
   "dia": null,
   "ativo": true
  }
 ],
 "entradas": [
  {
   "id": "e1",
   "fonteId": "salario",
   "valor": 1800,
   "data": "2026-07-30",
   "ref": "2026-07",
   "competencia": "2026-08",
   "quinzena": 1,
   "pessoa": "Eduardo"
  },
  {
   "id": "e2",
   "fonteId": "salario",
   "valor": 1630,
   "data": "2026-08-30",
   "ref": "2026-08",
   "competencia": "2026-09",
   "quinzena": 1,
   "pessoa": "Eduardo"
  },
  {
   "id": "e3",
   "fonteId": "salario",
   "valor": 1330,
   "data": "2026-09-30",
   "ref": "2026-09",
   "competencia": "2026-10",
   "quinzena": 1,
   "pessoa": "Eduardo"
  },
  {
   "id": "e4",
   "fonteId": "extras",
   "valor": 2700,
   "data": "2026-10-01",
   "ref": null,
   "competencia": "2026-10",
   "quinzena": 1,
   "pessoa": "Eduardo",
   "descricao": "Abono Volvo"
  }
 ]
};
