import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit } from '@/lib/rate-limit';

const scheduleSchema = z.object({
  chatId: z.string().uuid(),
  leadId: z.string().uuid().optional().nullable(),
  content: z.string().min(1).max(4096),
  type: z.enum(['text', 'image', 'audio', 'document', 'video']).optional().default('text'),
  mediaUrl: z.string().url().optional().nullable(),
  scheduledFor: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const rl = rateLimit({ key: `messages:schedule:${context.userId}`, limit: 20, windowMs: 60 * 60_000 });
  if (!rl.success) return NextResponse.json({ success: false, message: 'Limite de agendamentos atingido. Tente novamente em 1 hora.' }, { status: 429 });

  try {
    const parsed = scheduleSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.flatten() }, { status: 422 });
    const { chatId, leadId, content, type, mediaUrl, scheduledFor } = parsed.data;

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ success: false, message: 'A data deve ser futura' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: scheduledMessage, error } = await supabase
      .from('scheduled_messages')
      .insert({
        chat_id: chatId,
        lead_id: leadId,
        company_id: context.companyId,
        content: content.trim(),
        type,
        media_url: mediaUrl,
        scheduled_for: scheduledFor,
        status: 'pending',
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Mensagem agendada com sucesso', data: scheduledMessage });
  } catch (error) {
    console.error('Error in schedule message endpoint:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}
