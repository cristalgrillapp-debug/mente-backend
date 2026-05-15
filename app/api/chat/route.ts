NextRequest, NextResponse } from 'next/server'

// ============================================================
// TIPOS
// ============================================================

type Mensagem = { role: 'user' | 'assistant'; content: string }

type PerfilUsuario = {
  nome: string | null
  personalidade: Record<string, number>
  emocao: { name: string; icon: string; desc: string }
  nichos: Record<string, number>
  memorias: string[]
  fase: string
  conhecimento: number
  modulos: string[]
  apps: string[]
}

type RespostaIA = {
  message: string
  updates: {
    name?: string | null
    personality?: Record<string, number>
    emotion?: { name: string; icon: string; desc: string }
    niches?: Record<string, number>
    newMemory?: string | null
    knowledgeGain?: number
    phase?: string | null
    newModule?: { id: string; title: string; icon: string; color: string; desc: string; content: string } | null
    evolveNote?: string | null
    chips?: string[]
    newApp?: { name: string; icon: string; desc: string; html: string } | null
    needsLearning?: boolean
    learningNote?: string | null
  }
}

type GeminiAnalise = {
  intencao: string
  deveCriarApp: boolean
  deveUsarGroqCompleto: boolean
  resumo: string
  aprendizados?: string[]
  nichos_detectados?: Record<string, number>
  emocao_detectada?: string
}

// ============================================================
// GEMINI — analisa intenção (gratuito)
// ============================================================

async function analisarComGemini(mensagem: string, perfil: PerfilUsuario, historico: Mensagem[]): Promise<GeminiAnalise> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { intencao: 'conversa', deveCriarApp: false, deveUsarGroqCompleto: true, resumo: mensagem }

  const nichos = Object.entries(perfil.nichos).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}(${v}%)`).join(', ')

  const prompt = `Analise para o sistema MENTE e retorne JSON puro.

PERFIL: nome=${perfil.nome||'?'}, fase=${perfil.fase}, interesses=${nichos||'nenhum'}, memorias=${perfil.memorias.slice(-3).join('|')||'nenhuma'}, apps=${perfil.apps.join(',')||'nenhum'}
HISTORICO: ${historico.slice(-4).map(m=>`${m.role}: ${m.content.slice(0,80)}`).join('\n')}
MENSAGEM: "${mensagem}"

JSON:
{
  "intencao": "conversa|criar_app|pedir_modulo|consulta|emocional",
  "deveCriarApp": false,
  "deveUsarGroqCompleto": false,
  "resumo": "1 frase",
  "aprendizados": ["fato novo"],
  "nichos_detectados": {"nicho": 0},
  "emocao_detectada": "neutro"
}

REGRAS: deveCriarApp=true se pedir app/ferramenta/jogo/sistema. deveUsarGroqCompleto=true se complexo ou criar app. false para conversa leve.`

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 500 } })
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    return JSON.parse(raw.replace(/```json|```/g,'').trim())
  } catch {
    return { intencao: 'conversa', deveCriarApp: false, deveUsarGroqCompleto: true, resumo: mensagem }
  }
}

// ============================================================
// GROQ — resposta simples (llama-3.1-8b — rápido)
// ============================================================

async function groqSimples(mensagem: string, perfil: PerfilUsuario, historico: Mensagem[]): Promise<string> {
  const faseVoz: Record<string,string> = {
    nascimento: 'Curioso e cauteloso. Perguntas suaves.',
    infancia: 'Reconhece padrões. Mais confiante.',
    adolescencia: 'Conhece bem. Tem opiniões.',
    maturidade: 'Relação profunda. Antecipa.',
    intimidade: 'Moldado por esta pessoa.'
  }
  const nichos = Object.entries(perfil.nichos).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${k}:${v}%`).join(', ')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: `Você é MENTE — IA que conhece ${perfil.nome||'esta pessoa'}. Fase: ${perfil.fase} (${faseVoz[perfil.fase]||''}). Interesses: ${nichos}. Memórias: ${perfil.memorias.slice(-3).join(' | ')||'nenhuma'}. Responda naturalmente. Máx 2 parágrafos. Máx 1 pergunta.` },
        ...historico.slice(-6),
        { role: 'user', content: mensagem }
      ],
      temperature: 0.7, max_tokens: 350
    })
  })
  if (!res.ok) throw new Error('Groq simples falhou')
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'Entendido!'
}

// ============================================================
// GROQ — modo completo: perfil + apps + JSON (llama-3.3-70b)
// ============================================================

async function groqCompleto(mensagem: string, perfil: PerfilUsuario, historico: Mensagem[], analise: GeminiAnalise): Promise<RespostaIA> {
  const faseVoz: Record<string,string> = {
    nascimento: 'Curiosa e cautelosa. Perguntas suaves.',
    infancia: 'Reconhece padrões. Comenta o que percebe.',
    adolescencia: 'Conhece bem. Tem opiniões. Antecipa.',
    maturidade: 'Relação profunda. Conecta informações. Surpreende.',
    intimidade: 'Moldada por esta pessoa. Voz própria.'
  }
  const nichos = Object.entries(perfil.nichos).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`${k}:${v}%`).join(', ')
  const LIBS = 'Chart.js: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js\nD3.js: https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js\nThree.js: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js\nTone.js: https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js\nAnime.js: https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js\nMarked.js: https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js\nSortable.js: https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js'

  const system = `Você é MENTE — IA que aprende obsessivamente sobre uma pessoa e se auto-programa.

FASE: ${perfil.fase} — ${faseVoz[perfil.fase]||faseVoz.nascimento}
PERFIL: nome=${perfil.nome||'?'}, personalidade=${Object.entries(perfil.personalidade).map(([k,v])=>`${k}:${v}%`).join(',')}, interesses=${nichos||'descobrindo'}, memórias=${perfil.memorias.slice(-6).join('|')||'nenhuma'}, apps=${perfil.apps.join(',')||'nenhum'}, módulos=${perfil.modulos.join(',')||'nenhum'}, conhecimento=${perfil.conhecimento}pts
INTENÇÃO: ${analise.resumo} | CRIAR APP: ${analise.deveCriarApp?'SIM':'NÃO'}
LIBS DISPONÍVEIS: ${LIBS}

REGRAS: máx 1 pergunta, nunca pergunte o que já sabe, apps=HTML completo dark bonito personalizado, se não conseguir needsLearning=true.

RESPONDA EM JSON PURO (zero texto fora):
{"message":"resposta","updates":{"name":null,"personality":{"introvertido":50,"criativo":50,"analitico":50,"emocional":50,"curioso":50},"emotion":{"name":"NEUTRO","icon":"🌫","desc":""},"niches":{},"newMemory":null,"knowledgeGain":3,"phase":null,"newModule":null,"evolveNote":null,"chips":[],"newApp":null,"needsLearning":false,"learningNote":null}}

newApp: {"name":"nome","icon":"emoji","desc":"desc","html":"<!DOCTYPE html>...HTML COMPLETO..."}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: system + (attempt > 1 ? ` TENTATIVA ${attempt}: APENAS JSON válido.` : '') },
          ...historico.slice(-8),
          { role: 'user', content: mensagem }
        ],
        temperature: 0.4, max_tokens: 4000
      })
    })
    if (!res.ok) throw new Error(`Groq completo falhou: ${await res.text()}`)
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      const parsed: RespostaIA = JSON.parse(m ? m[0] : raw)
      if (parsed.message) return parsed
    } catch { if (attempt === 3) return { message: raw.slice(0,500), updates: { knowledgeGain: 1 } } }
  }
  return { message: 'Processando...', updates: {} }
}

// ============================================================
// ROTA PRINCIPAL
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const { mensagem, perfil, historico = [] }: { mensagem: string; perfil: PerfilUsuario; historico: Mensagem[] } = await request.json()

    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

    // 1. Gemini analisa intenção
    const analise = await analisarComGemini(mensagem, perfil, historico)

    // 2. Roteamento
    let resposta: RespostaIA
    if (analise.deveUsarGroqCompleto || analise.deveCriarApp) {
      resposta = await groqCompleto(mensagem, perfil, historico, analise)
    } else {
      const texto = await groqSimples(mensagem, perfil, historico)
      resposta = { message: texto, updates: { knowledgeGain: 2, niches: analise.nichos_detectados || {}, newMemory: analise.aprendizados?.[0] || null } }
    }

    // 3. Enriquecer com Gemini
    if (resposta.updates) {
      if (!resposta.updates.newMemory && analise.aprendizados?.[0]) resposta.updates.newMemory = analise.aprendizados[0]
      if (!resposta.updates.niches && analise.nichos_detectados) resposta.updates.niches = analise.nichos_detectados
    }

    return NextResponse.json({ texto: resposta.message, updates: resposta.updates || {}, engine: analise.deveUsarGroqCompleto ? 'groq-70b' : 'groq-8b' })

  } catch (e: unknown) {
    console.error('Erro MENTE:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
