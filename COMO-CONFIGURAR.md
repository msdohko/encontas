# encontas: como colocar no ar

Enquanto `js/config.js` estiver com `apiKey: 'COLE_AQUI'`, o app abre em **modo demonstração** com os dados da planilha (nada é salvo). Siga os passos abaixo para usar de verdade.

## 1. Criar o projeto no Firebase
1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**. Nome sugerido: `encontas`. O Google Analytics pode ficar desligado.
2. No menu **Criação → Authentication → Começar**, abra a aba **Método de login** e ative **Google**. Escolha o e-mail de suporte e salve.
3. No menu **Criação → Firestore Database → Criar banco de dados**, escolha a região `southamerica-east1 (São Paulo)` e comece em **modo de produção**.
4. Ainda no Firestore, abra a aba **Regras**, apague tudo, cole o conteúdo de `firestore.rules` e clique em **Publicar**.

## 2. Conectar o app
1. Clique na engrenagem → **Configurações do projeto** → **Seus apps** → ícone **</>** (Web). Apelido: `encontas-web`. Não precisa de Hosting.
2. Copie o objeto `firebaseConfig` que aparecer e cole no lugar do que está em `js/config.js`.

## 3. Publicar no GitHub Pages
1. Crie um repositório (`encontas`) e suba todos os arquivos desta pasta.
2. Vá em **Settings → Pages → Branch: main / root** e salve. O endereço será `https://SEU-USUARIO.github.io/encontas/`.
3. No Firebase, abra **Authentication → Configurações → Domínios autorizados**, clique em **Adicionar domínio** e informe `SEU-USUARIO.github.io`. Sem isso, o login do Google é bloqueado.

## 4. Primeiro uso
1. Entre com o Google e crie a casa (ex.: "Casa Eduardo e Amanda").
2. Em **Mais**, toque em **Gerar código de convite** e mande o código para a Amanda no WhatsApp.
3. A Amanda abre o mesmo endereço, entra com o Google dela e escolhe **Entrar com código**.

## Testar no computador sem publicar
Na pasta do app, rode `python3 -m http.server 8000` e abra http://localhost:8000. O app não funciona abrindo o `index.html` direto com dois cliques, porque os módulos JS precisam de um servidor. O `localhost` já vem autorizado no Firebase.

## Estrutura
```
index.html            casca da página
css/app.css           visual (claro/escuro, celular e PC)
js/config.js          ← sua configuração do Firebase
js/firebase.js        conexão com Auth e Firestore (com cache offline)
js/store.js           leitura e escrita dos dados (demo ou Firebase)
js/modelo.js          regras de quinzena, parcelas e status (Etapa 1)
js/app.js             login, navegação e rotas
js/telas/*.js         uma tela por arquivo
firestore.rules       segurança: cada casa só é vista pelos membros dela
```
