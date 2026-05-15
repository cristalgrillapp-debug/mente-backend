# MENTE — Backend

API segura para o sistema MENTE. Chaves protegidas no servidor.

## Estrutura

```
app/
  api/
    chat/
      route.ts   ← API principal (Gemini + Claude)
  layout.tsx
  page.tsx
package.json
next.config.js
tsconfig.json
.gitignore
.env.example
```

## Como funciona

Cada mensagem passa por 2 etapas:

1. **Gemini** analisa a intenção (gratuito)
   - O que a pessoa quer?
   - Precisa criar app?
   - Conversa simples ou complexa?

2. **Roteamento inteligente**
   - Conversa simples → Gemini responde (gratuito)
   - Complexo ou app → Claude responde

## Deploy na Vercel

### Passo a passo pelo celular:

**1. Crie o repositório no GitHub**
- Acesse github.com
- Clique em "+" → "New repository"
- Nome: `mente-backend`
- Marque "Private"
- Clique "Create repository"

**2. Suba os arquivos**
- No repositório criado, clique "uploading an existing file"
- Faça upload de todos os arquivos desta pasta
- Mantenha a estrutura de pastas (app/api/chat/route.ts)
- Clique "Commit changes"

**3. Conecte na Vercel**
- Acesse vercel.com
- "Add New Project"
- Selecione o repositório `mente-backend`
- Clique "Deploy"

**4. Adicione as variáveis de ambiente**
- No projeto na Vercel, vá em "Settings" → "Environment Variables"
- Adicione:
  - `ANTHROPIC_API_KEY` = sua chave do Claude
  - `GEMINI_API_KEY` = sua chave do Gemini
- Clique "Save"
- Vá em "Deployments" → "Redeploy"

**5. Pegue a URL**
- Sua API estará em: `https://mente-backend-xxx.vercel.app/api/chat`
- Guarde essa URL — o frontend vai usar ela

## Variáveis de ambiente necessárias

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

## Endpoint

**POST** `/api/chat`

Body:
```json
{
  "mensagem": "texto do usuário",
  "perfil": {
    "nome": null,
    "personalidade": {},
    "emocao": {},
    "nichos": {},
    "memorias": [],
    "fase": "nascimento",
    "conhecimento": 0,
    "modulos": [],
    "apps": []
  },
  "historico": []
}
```

Resposta:
```json
{
  "texto": "resposta da IA",
  "updates": { ... },
  "engine": "claude|gemini"
}
```
