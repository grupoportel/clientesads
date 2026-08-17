# Segurança — o que precisa da sua mão

Duas coisas desta fase não dá para o código fazer sozinho. Ambas levam poucos minutos.

## 1. Publicar as regras do banco

O arquivo `database.rules.json` agora está versionado no projeto, mas **ele só vale
depois de ser publicado no Firebase**. Enquanto isso não for feito, valem as regras
que estiverem hoje no console — e se elas estiverem abertas, a base inteira de
clientes está pública.

**Conferir o que está valendo agora:**
console.firebase.google.com → projeto `crm---grupo-portel` → Realtime Database → aba **Regras**.

Se aparecer `".read": true` ou `".write": true` na raiz, publique as novas o quanto antes.

**Publicar pelo terminal:**

```bash
npx firebase-tools deploy --only database --project crm---grupo-portel
```

Ou copie o conteúdo de `database.rules.json` e cole direto no editor de regras do console.

### Como as regras funcionam

- Ninguém lê nada sem estar autenticado. Não há mais acesso anônimo.
- Quem tem papel `Viewer` só lê; não grava em lugar nenhum.
- `config`, `usuarios` e `automacoes` só aceitam escrita de quem tem papel `Admin`.
- **Modo de transição:** enquanto não existir um registro em
  `crm_data/usuarios/{seu-uid}`, o sistema trata você como Admin. Isso evita que
  você fique trancado para fora ao publicar as regras hoje. Assim que a tela de
  Usuários passar a gravar por `uid` (Fase 3), esse atalho deixa de valer sozinho.
- `atividades` é somente-acréscimo: dá para criar registro novo, não dá para
  alterar nem apagar histórico já gravado.

## 2. Conferir as variáveis de ambiente no Vercel

Os endpoints de envio agora exigem token de sessão e usam o Firebase Admin.
Confirme que estas variáveis existem no painel do Vercel (Settings → Environment Variables):

| Variável | Usada por | Já está no `.env.local`? |
|---|---|---|
| `FIREBASE_PROJECT_ID` | validação de token, gravação | sim |
| `FIREBASE_CLIENT_EMAIL` | validação de token, gravação | sim |
| `FIREBASE_PRIVATE_KEY` | validação de token, gravação | sim |
| `FIREBASE_DATABASE_URL` | gravação | sim |
| `WHATSAPP_PHONE_ID` | envio de WhatsApp | sim |
| `WHATSAPP_ACCESS_TOKEN` | envio de WhatsApp | sim |
| `WHATSAPP_VERIFY_TOKEN` | webhook da Meta | sim |
| `GMAIL_USER` | envio de e-mail | **não — falta** |
| `GMAIL_APP_PASSWORD` | envio de e-mail | **não — falta** |
| `EMAIL_WEBHOOK_SECRET` | webhook de e-mail | **não — falta** |
| `SMTP_HOST` | envio de e-mail | sim |
| `SMTP_PORT` | envio de e-mail — 465 (SSL) ou 587 (STARTTLS) | não, cai em 465 |
| `SMTP_USER` | envio de e-mail | sim |
| `SMTP_PASS` | envio de e-mail | sim |
| `SMTP_REMETENTE` | endereço que aparece no "de" | não, cai em `SMTP_USER` |
| `SMTP_NOME` | nome que aparece no "de" | não, cai em `Grupo Portel` |
| `GEMINI_API_KEY` | análise de lead por IA | sim, para a IA funcionar |
| `GEMINI_MODELO` | modelo do Gemini | não, cai em `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | alternativa ao Gemini | não |
| `GOOGLE_CALENDAR_ID` | eventos no Google Agenda | sim, para a agenda funcionar |
| `AGENDA_FUSO` | fuso dos eventos | não, cai em `America/Cuiaba` |

As três últimas não estão no `.env.local`, então o envio de e-mail não funciona em
desenvolvimento. Se já estiverem configuradas no Vercel, produção segue normal —
só o ambiente local fica sem.

> `EMAIL_WEBHOOK_SECRET` tem um valor padrão no código (`portelcrm_email_secret`).
> Como ele é público neste repositório, defina um valor próprio no Vercel e no
> Apps Script do Gmail.

---

## 3. Entrada automática de leads (`/api/lead-in`)

Endpoint para o formulário do site, Meta Ads, Google Ads, Zapier ou Make
criarem leads direto no CRM.

**Antes de usar, defina no Vercel:**

| Variável | Para quê |
|---|---|
| `LEAD_IN_SECRET` | Segredo que autoriza a chamada. Sem ele o endpoint recusa tudo. |

Gere um valor longo e aleatório. Sem esse segredo, qualquer um que descobrisse
a URL poderia encher a sua base de lixo.

### Como chamar

```bash
curl -X POST https://SEU-DOMINIO/api/lead-in \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SEGREDO" \
  -d '{"nome":"Clínica Sorriso","email":"contato@sorriso.com","telefone":"66999991234","origem":"site"}'
```

O segredo também pode ir na query (`?secret=...`) para plataformas que não
deixam configurar cabeçalho.

### O que ele entende

- **Nomes de campo variados.** `nome`, `name`, `full_name`, `empresa`,
  `razao_social` — todos viram o nome. O mesmo vale para telefone, e-mail,
  cidade e os demais.
- **Formato do Meta Ads**, que manda `field_data: [{ name, values }]`.
- **Objetos aninhados.** `{ contato: { nome } }` também é encontrado.
- **UTMs.** `utm_source`, `utm_campaign` etc. são guardados no lead, e
  `utm_source` vira a origem quando nenhuma for informada.

### Deduplicação

Se o e-mail ou o telefone já existirem na base, **não cria um lead novo**:
completa os campos que estavam vazios e anota na linha do tempo que a pessoa
preencheu o formulário de novo. Um telefone com menos de 10 dígitos não é usado
para comparar, porque não identifica ninguém com segurança.

### Resposta

- `201` — lead criado, devolve `leadId`
- `200` com `duplicado: true` — lead já existia e foi completado
- `400` — não achou nome, e-mail nem telefone no payload (a resposta lista as
  chaves recebidas, para ajudar a mapear)
- `403` — segredo errado

---

## Trava de versão do `jose`

O `package.json` tem um `overrides` fixando `jose` na faixa `^5.10.0`. **Não
remova sem testar em produção.**

O `firebase-admin` puxa `jwks-rsa`, que é CommonJS e faz `require('jose')`, mas
declara `jose ^6.1.3` — e o jose 6 passou a ser ESM puro. O Node 22.12+ aceita
`require()` de módulo ESM, o carregador da Vercel não. O resultado é que o
build passa, os testes passam, o `npm run dev` funciona, e só em produção os
três endpoints que validam token respondem `500 FUNCTION_INVOCATION_FAILED`:

```
ERR_REQUIRE_ESM: require() of ES Module .../jose/dist/webapi/index.js
from .../jwks-rsa/src/utils.js not supported
```

O `jwks-rsa` usa exatamente duas funções do jose, `exportSPKI` e `importJWK`,
e as duas existem no 5.x, que ainda publica CommonJS.

Para conferir que a trava está valendo:

```bash
node -e "console.log(require.resolve('jose',{paths:['./node_modules/jwks-rsa/src']}))"
```

Tem que terminar em `jose/dist/node/cjs/index.js`. Se aparecer `webapi`, o
override caiu e os endpoints autenticados vão quebrar no próximo deploy.

---

## Envio de e-mail (SMTP)

O provedor é configuração, não código — `api/_email.js` monta o transporte a
partir das variáveis. Para a Hostinger:

| Variável | Valor |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | o endereço completo, ex. `contato@grupoportel.com` |
| `SMTP_PASS` | a senha da caixa de e-mail (a mesma do webmail) |
| `SMTP_REMETENTE` | opcional, se o "de" for diferente do usuário |

**Porta 465 ou 587, não misture:** a 465 fala TLS desde o primeiro byte
(`secure: true`); a 587 começa em texto puro e sobe com STARTTLS
(`secure: false`). O código decide isso pela porta. Configurar 587 esperando
SSL trava a conexão sem erro legível — é o engano mais comum aqui.

Enquanto `SMTP_HOST` não estiver definido, o envio continua usando
`GMAIL_USER` / `GMAIL_APP_PASSWORD`, para a troca não derrubar o envio no meio
do caminho. Depois que a Hostinger estiver funcionando, essas duas podem sair.

---

## Análise de lead por IA

`GEMINI_API_KEY` vem do Google AI Studio (`aistudio.google.com`), que tem cota
gratuita sem cadastro de cartão. **Na cota gratuita o Google pode usar o
conteúdo enviado para melhorar os produtos dele.** Aqui vai dado público de
empresa — nome, nicho, site — mas é bom saber antes de mandar qualquer coisa
mais sensível. Ativar faturamento no mesmo projeto remove essa cláusula.

Trocar de provedor é configuração: definir `ANTHROPIC_API_KEY` em vez da do
Gemini já muda o destino, sem tocar no código.

### Duas decisões que valem manter

**A IA sugere, não grava.** O endpoint devolve os campos e quem aceita é quem
está na tela, um a um. Campo vazio a pessoa vê; campo errado ela acredita.

**A resposta é filtrada contra uma lista de campos permitidos**
(`CAMPOS_ANALISE`). Sem isso, um modelo que resolvesse devolver
`{"status": "venda", "valor": 999999}` conseguiria escrever no cadastro do lead
o que ninguém pediu. Coberto por teste.

**O endereço do site é validado antes de o servidor buscá-lo.** Só http e
https, e nada de `localhost`, rede interna ou `169.254.169.254` — sem isso, o
campo "site" de um lead viraria uma requisição do servidor para dentro da
própria infraestrutura.

---

## Google Agenda

Mão única: o CRM cria o evento no Google, e não o contrário. Sincronizar os
dois lados exigiria webhook, token de atualização e uma regra de conflito para
quando a mesma reunião mudar nos dois lugares — trabalho grande para um
problema que ainda não existe.

**Não precisa de OAuth.** A autenticação reaproveita a conta de serviço que já
existe para o Firebase, o que evita tela de consentimento e guarda de refresh
token. Dois passos, uma vez só:

1. No Google Cloud do projeto, ative a **Google Calendar API**.
2. No Google Agenda, abra as configurações da agenda → **Compartilhar com
   pessoas específicas** → adicione o e-mail da conta de serviço (o mesmo de
   `FIREBASE_CLIENT_EMAIL`) com permissão **"Fazer alterações nos eventos"**.

Depois defina `GOOGLE_CALENDAR_ID` com o endereço da agenda — normalmente o seu
próprio e-mail do Google.

### Por que o evento não tem convidados

Uma conta de serviço não consegue convidar ninguém sem *domain-wide delegation*,
que só existe no Google Workspace. Tentar incluir `attendees` faria o Google
recusar o evento inteiro. Quem avisa o lead é o e-mail de confirmação que o
próprio CRM envia por SMTP.

### Falha parcial é resultado, não erro

Marcar reunião faz três coisas independentes: evento, e-mail e tarefa. Se o
Google recusar, o e-mail ainda sai; se o e-mail falhar, a tarefa ainda é criada.
O endpoint responde `200` com o estado de cada etapa em vez de um erro só —
devolver `500` faria a tela descartar o que funcionou, e a pessoa remarcaria
tudo achando que nada aconteceu.
