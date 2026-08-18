import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hsm_templates')
    .select('*')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ data: [], migration_pending: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

const VALID_KINDS = ['simple', 'buttons', 'carousel'] as const
type Kind = (typeof VALID_KINDS)[number]

interface ButtonInput { type: 'quick_reply' | 'url'; text: string; url?: string }
interface CarouselCardInput { header_type: 'image' | 'video'; media_url: string; body_text: string; buttons: ButtonInput[] }

function validateButtons(buttons: unknown): string | null {
  if (!Array.isArray(buttons) || buttons.length === 0) return 'buttons é obrigatório e precisa ter ao menos 1 item'
  if (buttons.length > 3) return 'Máximo de 3 botões por template'
  for (const b of buttons as ButtonInput[]) {
    if (!b.text || b.text.length > 25) return 'Cada botão precisa de texto com até 25 caracteres'
    if (b.type === 'url' && !b.url) return 'Botão do tipo url precisa de uma URL'
  }
  return null
}

function validateCarouselCards(cards: unknown): string | null {
  if (!Array.isArray(cards) || cards.length < 2 || cards.length > 10) return 'Carrossel precisa de 2 a 10 cards'
  for (const c of cards as CarouselCardInput[]) {
    if (!c.media_url) return 'Todo card precisa de uma imagem/vídeo'
    if (!c.body_text || c.body_text.length > 160) return 'Corpo do card precisa ter até 160 caracteres'
    const btnErr = validateButtons(c.buttons)
    if (btnErr) return btnErr
  }
  return null
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const {
    name, category, language, body: templateBody,
    kind, header_type, header_media_url, buttons, carousel_cards,
  } = body

  if (!name || !category || !templateBody) {
    return NextResponse.json({ error: 'name, category e body são obrigatórios' }, { status: 400 })
  }

  const templateKind: Kind = VALID_KINDS.includes(kind) ? kind : 'simple'

  if (templateKind === 'buttons') {
    const err = validateButtons(buttons)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }
  if (templateKind === 'carousel') {
    const err = validateCarouselCards(carousel_cards)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }
  if (templateKind === 'simple' && header_type && header_type !== 'none' && !header_media_url) {
    return NextResponse.json({ error: 'Header com mídia precisa de header_media_url' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hsm_templates')
    .insert({
      company_id: context.companyId,
      name,
      category,
      language: language ?? 'pt_BR',
      body: templateBody,
      status: 'pendente',
      kind: templateKind,
      header_type: templateKind === 'simple' ? (header_type ?? 'none') : null,
      header_media_url: templateKind === 'simple' ? (header_media_url ?? null) : null,
      buttons: templateKind === 'buttons' ? buttons : null,
      carousel_cards: templateKind === 'carousel' ? carousel_cards : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
