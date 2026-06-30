# 📋 Gerência Prof — Gestão de Professores

Web app **100% gratuito** para coordenadores de curso gerenciarem professores,
suas matérias e o controle de entrega de tarefas (inclusive tarefas **mensais**).

Feito para **uso interno de um único usuário**: não precisa de servidor, banco de
dados, login ou mensalidade. Tudo funciona dentro do navegador e **offline**.

---

## ✨ O que dá para fazer

- **Cadastrar professores** e as **matérias** que cada um leciona.
- **Criar tarefas** (mensais ou avulsas) e atribuí-las aos professores responsáveis.
- **Marcar quem entregou** e quem ainda não entregou, com data e hora da entrega.
- **Gerar relatório** dos professores que **não entregaram** a tarefa de um determinado mês.
- **Observação de aula:** preencher o protocolo oficial (critérios + feedback) e
  **exportar em `.docx`** no mesmo template do modelo (com o timbre oficial).
- **Imprimir / salvar em PDF** e **exportar CSV** do relatório de pendências.
- **Backup e restauração** dos dados em arquivo `.json`.
- Instalável como **app** no celular ou computador (PWA) e pronto para virar **APK** com Cordova.

---

## 🚀 Como usar

Escolha **uma** das opções abaixo. Não há custo em nenhuma delas.

### Opção 1 — Abrir direto no navegador (mais simples)

Abra o arquivo [`www/index.html`](www/index.html) com um duplo clique.
Funciona em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).

> Observação: nesse modo o recurso offline (service worker) fica desativado,
> mas **todas as funções principais funcionam normalmente**.

### Opção 2 — Servidor local (recomendado p/ usar como app instalável)

Precisa apenas do [Node.js](https://nodejs.org) instalado (gratuito):

```bash
npm start
```

Depois abra **http://localhost:8080** no navegador. Assim o modo offline e a
instalação como aplicativo (PWA) ficam habilitados.

### Opção 3 — Publicar grátis no GitHub Pages

1. Faça o push deste repositório para o GitHub.
2. Em **Settings → Pages**, selecione a branch e a pasta `/www` (ou mova o conteúdo
   de `www/` para a raiz, se preferir publicar a partir da raiz).
3. Acesse o endereço gerado pelo GitHub Pages — hospedagem gratuita.

---

## 📱 Instalar no celular (PWA)

Com o app aberto pelo servidor local ou pelo GitHub Pages:

- **Android (Chrome):** menu ⋮ → **Instalar aplicativo / Adicionar à tela inicial**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

Ele passa a abrir como um aplicativo, em tela cheia e funcionando offline.

---

## 📦 Gerar um APK com Cordova (opcional)

O projeto já segue a estrutura do Cordova (pasta `www/` + `config.xml`).
Para empacotar como aplicativo Android:

```bash
# Instale o Cordova (gratuito)
npm install -g cordova

# Na pasta do projeto:
cordova platform add android
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

## 🗂️ Estrutura do projeto

```
gerencia-prof/
├── www/                    ← raiz do app (compatível com Cordova)
│   ├── index.html          ← página principal (SPA)
│   ├── css/styles.css      ← estilos (responsivo, modo de impressão, mobile)
│   ├── js/
│   │   ├── store.js        ← dados e regras (localStorage, relatórios, observações)
│   │   ├── ui.js           ← utilitários de interface (modal, toast, formatação)
│   │   ├── docx.js         ← gerador de .docx (ZIP + OOXML, sem dependências)
│   │   ├── letterhead.js   ← timbre oficial (imagem em base64) p/ o .docx
│   │   └── app.js          ← telas e navegação
│   ├── img/                ← ícones do app
│   ├── manifest.json       ← configuração PWA
│   └── sw.js               ← service worker (uso offline)
├── docs/
│   └── template-observacao-aula.docx  ← modelo oficial de referência
├── config.xml              ← configuração do Cordova
├── server.js               ← servidor estático local (sem dependências)
├── package.json
└── README.md
```

---

## 🧰 Tecnologias

HTML, CSS e JavaScript puro (sem frameworks e **sem dependências**). Isso garante
que o app seja leve, gratuito e fácil de manter por muitos anos.

## 📄 Licença

MIT — uso livre.
