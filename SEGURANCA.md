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
