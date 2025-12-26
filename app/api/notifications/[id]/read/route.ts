import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Marcar notificação como lida
    const { error } = await supabase
      .from('activity_logs')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error marking notification as read:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao marcar notificação como lida' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in mark notification as read:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno' },
      { status: 500 }
    );
  }
}
