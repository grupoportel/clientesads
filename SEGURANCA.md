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

As três últimas não estão no `.env.local`, então o envio de e-mail não funciona em
desenvolvimento. Se já estiverem configuradas no Vercel, produção segue normal —
só o ambiente local fica sem.

> `EMAIL_WEBHOOK_SECRET` tem um valor padrão no código (`portelcrm_email_secret`).
> Como ele é público neste repositório, defina um valor próprio no Vercel e no
> Apps Script do Gmail.
