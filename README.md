# 📋 Gerência Prof — Gestão de Professores

Web app **100% gratuito** para coordenadores de curso gerenciarem professores,
suas matérias e o controle de entrega de tarefas (inclusive tarefas **mensais**).

Feito para **uso interno de um único usuário**: não precisa de servidor, banco de
dados, login ou mensalidade. Tudo funciona dentro do navegador e **offline**.

---

## ✨ O que dá para fazer

- **Cadastrar professores** e as **matérias** que cada um leciona.
- **Criar tarefas** (mensais ou avulsas) e atribuí-las aos professores responsáveis.
  Há a opção de **entrega sempre na 1ª sexta-feira do mês** (a data é calculada
  automaticamente para cada mês de referência).
- **Marcar quem entregou** e quem ainda não entregou, com data e hora da entrega.
- **Compartilhar a tarefa no WhatsApp** com uma mensagem profissional (sem emojis),
  com saudação conforme o horário (bom dia / boa tarde / boa noite), o nome da
  tarefa e o prazo final — para todos ou direto para cada professor.
- **Gerar relatório** dos professores que **não entregaram** a tarefa de um determinado mês.
- **Observação de aula:** preencher o protocolo oficial (critérios + feedback) e
  **exportar em `.docx`** no mesmo template do modelo (com o timbre oficial).
- **Imprimir / salvar em PDF** e **exportar CSV** do relatório de pendências.
- **Backup e restauração** dos dados em arquivo `.json`.
- **Envio das exportações para o Google Drive** (opcional): `.docx`, CSV e backup
  vão direto para uma pasta no seu Drive, com acesso mínimo (`drive.file`).
- Instalável como **app** no celular ou computador (PWA) e pronto para virar **APK** com Cordova.

---

## 🚀 Como usar

O projeto usa **webpack** e organização **package-by-feature**. O código-fonte
fica em `src/`; o build gera a pasta `www/` (consumida pelo navegador e pelo
Cordova). Você precisa do [Node.js](https://nodejs.org) instalado (gratuito).

Primeiro, instale as dependências (uma vez):

```bash
npm install
```

### Opção 1 — Desenvolvimento (recomendado)

```bash
npm run dev
```

Sobe o `webpack-dev-server` em **http://localhost:8080** com recarga automática.
Modo offline (service worker) e instalação como app (PWA) ficam habilitados.

### Opção 2 — Build de produção + pré-visualização

```bash
npm run build      # gera a pasta www/
npm run preview    # servidor estático simples em http://localhost:8080
```

### Opção 3 — Publicar grátis no GitHub Pages

1. Rode `npm run build` para gerar `www/`.
2. Publique o **conteúdo de `www/`** no GitHub Pages (por exemplo, via GitHub
   Actions no push, ou empurrando `www/` para uma branch `gh-pages`).

> Scripts disponíveis: `npm run build` (produção), `npm run build:dev`,
> `npm run watch`, `npm run dev`, `npm run preview`, `npm run prepare-app`
> (build + `cordova prepare`), `npm run android`, `npm run ios`.

---

## 📱 Instalar no celular (PWA)

Com o app aberto pelo servidor local ou pelo GitHub Pages:

- **Android (Chrome):** menu ⋮ → **Instalar aplicativo / Adicionar à tela inicial**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

Ele passa a abrir como um aplicativo, em tela cheia e funcionando offline.

---

## 📦 Gerar um APK com Cordova (opcional)

O `config.xml` aponta para a pasta `www/`, que é **gerada pelo build**.
Sempre rode o build antes de empacotar:

```bash
# Instale o Cordova (gratuito)
npm install -g cordova

# Na pasta do projeto:
npm run build            # gera www/ com o webpack
cordova platform add android
npm run android          # = npm run build && cordova run android
# ou, manualmente:
cordova build android
```

O APK gerado fica em `platforms/android/app/build/outputs/apk/`.
(É necessário ter o Android SDK / Android Studio instalados.)

> **Cores no `config.xml`:** o `cordova-android` 15+ exige cores no formato
> Android (`#AARRGGBB`, ex.: `#fff1f5f9`). O formato antigo `0xAARRGGBB` causa o
> erro de build *"expected color but got (raw string)"*. Após alterar o
> `config.xml`, rode novamente `cordova build android` (o `prepare` regenera os
> arquivos nativos). Se persistir algum cache, use `cordova clean android` antes.

---

## 👁️ Observação de aula (exportação em .docx)

Na aba **Observação de aula** você:

1. Clica em **Nova observação** e preenche a **identificação** (professor, disciplina,
   série/turma, data e horário). O cabeçalho (escola, etapa, modalidade, coordenação)
   já vem preenchido e é **lembrado** para as próximas observações.
2. Para cada um dos **10 critérios**, marca **Sim / Não / Não foi possível observar**
   e registra as **evidências** (há frases-guia como sugestão).
3. Preenche o **Protocolo do Feedback** (registro de evidências, sugestões, data e
   assinaturas).
4. Clica em **Salvar e exportar .docx** — o documento é gerado **no mesmo template do
   modelo oficial**, com o **timbre** (Governo do ES / Secretaria de Educação / EEEM
   Nossa Senhora de Lourdes), as tabelas do protocolo e o bloco de feedback.

O `.docx` é montado inteiramente no navegador (sem enviar nada para servidores) e abre
no Word, LibreOffice ou Google Docs. O modelo oficial usado como referência está em
[`docs/template-observacao-aula.docx`](docs/template-observacao-aula.docx).

---

## 💾 Sobre os dados e backup (importante!)

Os dados são salvos no **armazenamento local do próprio navegador**
(`localStorage`) — não vão para nenhum servidor. Isso mantém o app gratuito e
privado, mas significa que:

- Os dados ficam **apenas neste dispositivo/navegador**.
- Limpar os dados do navegador, trocar de aparelho ou reinstalar **apaga as informações**.

➡️ Por isso, use a tela **💾 Backup** para **exportar um arquivo `.json`** com
frequência. Para restaurar (ou migrar para outro aparelho), use **Importar**.

Na tela de Backup também é possível **carregar dados de exemplo** para testar e
**apagar todos os dados**.

---

## ☁️ Enviar as exportações para o Google Drive (opcional)

Dá para fazer o app **enviar automaticamente** as exportações (o `.docx` das
observações, o CSV de pendências e o backup `.json`) para o **seu Google Drive**,
sem backend e sem custo. O app usa o acesso **mínimo** (`drive.file`): ele só
enxerga e gerencia **os arquivos que ele mesmo cria** — nunca o resto do seu Drive.

> Requisitos: o app precisa ser aberto por **http/https** (via `npm run dev`,
> `npm run preview` ou GitHub Pages). Não funciona abrindo o `index.html` como
> arquivo (`file://`).

### Passo 1 — Criar as credenciais no Google Cloud (uma vez)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um
   **projeto** (gratuito).
2. Em **APIs e serviços → Biblioteca**, ative a **Google Drive API**.
3. Em **APIs e serviços → Tela de permissão OAuth**:
   - Tipo de usuário: **Externo**; preencha o nome do app e seu e-mail.
   - Deixe em modo **Testes** e, em **Usuários de teste**, adicione **o seu
     próprio e-mail** (assim funciona sem precisar de verificação do Google).
4. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione o endereço onde você abre o
     app, por exemplo `http://localhost:8080` e/ou a URL do seu GitHub Pages
     (ex.: `https://seu-usuario.github.io`).
   - Salve e **copie o Client ID** (algo como `123-abc.apps.googleusercontent.com`).

### Passo 2 — Configurar no app

Abra a tela **💾 Backup → ☁️ Google Drive** e:

1. Cole o **Client ID**.
2. Escolha a **pasta** de destino (padrão: `Gerência Prof`).
3. Marque **“Enviar as exportações para o Google Drive”**.
4. Clique em **Salvar configuração** e depois em **Conectar / testar** para
   autorizar sua conta (abre a janela do Google).

Pronto: a partir daí, ao exportar, o arquivo vai para a pasta escolhida no seu
Drive. Se o envio falhar (sem internet, sessão expirada), o app **baixa o arquivo
localmente** automaticamente, para você não perder nada. Há também a opção de
**manter uma cópia local** junto com o envio.

> Observação (APK/Cordova): o login do Google em WebView tem restrições. Essa
> integração é pensada para o uso via **navegador/PWA** (localhost ou GitHub
> Pages). Para APK, o fluxo de OAuth precisa de configuração adicional.

---

## 🗂️ Estrutura do projeto (package-by-feature)

O código-fonte fica em `src/`, organizado **por feature** (cada pasta reúne a
tela, os dados e a lógica daquela funcionalidade). O `www/` é **gerado pelo
build** (não versionado).

```
gerencia-prof/
├── src/
│   ├── index.js                 ← entry (estilos, casca, roteador)
│   ├── index.html               ← template (webpack injeta JS/CSS)
│   ├── core/                    ← infraestrutura compartilhada
│   │   ├── db.js                ← persistência (localStorage) + configurações
│   │   └── ui/                  ← escape, format, modal, toast, files
│   ├── app/                     ← casca do app
│   │   ├── router.js  routes.js  shell.js  deliver.js  facade.js  sampleData.js
│   ├── features/                ← uma pasta por funcionalidade
│   │   ├── dashboard/           ← painel (view + store)
│   │   ├── teachers/            ← professores (view + store)
│   │   ├── tasks/               ← tarefas (view + store + share WhatsApp)
│   │   ├── observations/        ← observação de aula (view, store, docx,
│   │   │                          critérios, timbre, scss)
│   │   ├── reports/             ← relatórios (view + store)
│   │   └── backup/              ← backup + Google Drive (view + drive.js)
│   ├── styles/global.scss       ← estilos globais (SCSS)
│   └── assets/                  ← manifest.json, sw.js, img/ (copiados no build)
├── www/                         ← SAÍDA do build (gerada; não versionada)
├── docs/template-observacao-aula.docx  ← modelo oficial de referência
├── webpack.config.js  .babelrc
├── config.xml                   ← configuração do Cordova (aponta p/ www/)
├── server.js                    ← servidor estático simples (npm run preview)
├── package.json
└── README.md
```

---

## 🧰 Tecnologias

HTML, SCSS e JavaScript (ES Modules) empacotados com **webpack** + **Babel**,
organização **package-by-feature**. O app não usa frameworks de UI nem
dependências em tempo de execução — apenas ferramentas de build.

## 📄 Licença

MIT — uso livre.
