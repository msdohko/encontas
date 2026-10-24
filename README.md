# encontas

**Por dentro das contas da casa.** Controle dividido do jeito que o dinheiro chega: **1ª quinzena** (salário) e **2ª quinzena** (vale).

- Lançamento rápido pelo celular: gasto, compra parcelada ou entrada
- Contas fixas e assinaturas lançadas sozinhas todo mês
- Salário variável previsto pela média dos últimos 3 meses, confirmado quando cai
- Saldo acumulado de uma quinzena para a outra, dívidas e limite livre dos cartões
- Uma "casa" compartilhada entre duas ou mais pessoas, com login Google e convite por código

Feito em HTML, CSS e JavaScript puro, com Firebase (Auth + Firestore) e hospedado no GitHub Pages.

## Rodar
Sem configurar nada, o app abre em **modo demonstração**. Para usar de verdade, siga o [COMO-CONFIGURAR.md](COMO-CONFIGURAR.md).

```
python3 -m http.server 8000      # abrir http://localhost:8000
node testes/teste-modelo.mjs     # testes das regras (quinzenas, parcelas, salário, assinaturas)
```

## Etapas
- [x] 1. Modelo de dados
- [x] 2. Base: login, casa compartilhada, navegação celular/PC
- [x] 3. Cadastros, assinaturas e lançamento rápido
- [ ] 4. Pagar, adiar e renegociar
- [ ] 5. Parcelamentos (editar, quitar antes)
- [ ] 6. Gastos do dia a dia
- [ ] 7. Importar a planilha
- [ ] 8. Relatórios
- [ ] 9. Simulador de compra e plano de quitação
- [ ] 10. Alertas e notificações
- [ ] 11. App instalável, offline e publicação
