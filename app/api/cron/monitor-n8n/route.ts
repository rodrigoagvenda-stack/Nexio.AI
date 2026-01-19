import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';

// POST /api/cron/monitor-n8n
export async function POST(request: Request) {
  try {
    // Verifica se é uma chamada do cron (pode usar um secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const supabase = await createClient();

    // Busca instâncias ativas
    const { data: instances, error: instancesError } = await supabase
      .from('n8n_instances')
      .select('*')
      .eq('active', true);

    if (instancesError) {
      throw instancesError;
    }

    if (!instances || instances.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma instância ativa para monitorar',
      });
    }

    // Busca configs da IA e Uazapi
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: uazapiConfig } = await supabase
      .from('uazapi_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const results = [];

    // Para cada instância, busca erros
    for (const instance of instances) {
      try {
        const apiKey = decrypt(instance.api_key);

        // Busca execuções com erro
        const n8nUrl = `${instance.url}/api/v1/executions?status=error&limit=10`;

        const response = await fetch(n8nUrl, {
          headers: {
            'X-N8N-API-KEY': apiKey,
          },
        });

        if (!response.ok) {
          results.push({
            instance: instance.name,
            status: 'error',
            message: `Erro ao conectar: ${response.status}`,
          });
          continue;
        }

        const data = await response.json();
        const executions = data.data || [];

        // Para cada execução com erro
        for (const execution of executions) {
          // Verifica se já existe no banco
          const { data: existingError } = await supabase
            .from('n8n_errors')
            .select('*')
            .eq('execution_id', execution.id)
            .single();

          if (existingError) {
            continue; // Já processado
          }

          // Busca detalhes da execução
          const executionDetailUrl = `${instance.url}/api/v1/executions/${execution.id}`;
          const executionDetailResponse = await fetch(executionDetailUrl, {
            headers: {
              'X-N8N-API-KEY': apiKey,
            },
          });

          if (!executionDetailResponse.ok) {
            continue;
          }

          const executionDetail = await executionDetailResponse.json();

          // Extrai informações do erro
          const errorNode = executionDetail.data?.resultData?.error?.node || 'Unknown';
          const errorMessage =
            executionDetail.data?.resultData?.error?.message || 'Erro desconhecido';
          const errorDetails = JSON.stringify(
            executionDetail.data?.resultData?.error || {}
          );

          // Determina severidade (exemplo simples)
          let severity = 'medium';
          if (errorMessage.toLowerCase().includes('critical')) {
            severity = 'critical';
          } else if (errorMessage.toLowerCase().includes('warning')) {
            severity = 'low';
          } else if (errorMessage.toLowerCase().includes('timeout')) {
            severity = 'high';
          }

          // Analisa erro com IA (se configurado)
          let aiAnalysis = null;
          if (aiConfig) {
            try {
              aiAnalysis = await analyzeErrorWithAI(
                errorMessage,
                errorDetails,
                aiConfig
              );
            } catch (aiError) {
              console.error('Erro ao analisar com IA:', aiError);
            }
          }

          // Insere erro no banco
          const { data: newError, error: insertError } = await supabase
            .from('n8n_errors')
            .insert({
              instance_id: instance.id,
              execution_id: execution.id,
              workflow_id: execution.workflowId,
              workflow_name: executionDetail.data?.workflowData?.name || 'Unknown',
              error_node: errorNode,
              error_message: errorMessage,
              error_details: errorDetails,
              ai_analysis: aiAnalysis,
              severity,
              notified: false,
              resolved: false,
              timestamp: execution.stoppedAt || new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            console.error('Erro ao inserir erro:', insertError);
            continue;
          }

          // Envia notificação WhatsApp (se configurado)
          if (uazapiConfig && newError) {
            try {
              await sendWhatsAppNotification(
                newError,
                instance,
                uazapiConfig
              );

              // Marca como notificado
              await supabase
                .from('n8n_errors')
                .update({ notified: true })
                .eq('id', newError.id);
            } catch (whatsappError) {
              console.error('Erro ao enviar WhatsApp:', whatsappError);
            }
          }

          results.push({
            instance: instance.name,
            status: 'error_detected',
            execution_id: execution.id,
          });
        }

        results.push({
          instance: instance.name,
          status: 'success',
          errors_found: executions.length,
        });
      } catch (error: any) {
        results.push({
          instance: instance.name,
          status: 'error',
          message: error.message,
        });
      }
    }

    return NextResponse.json({
      message: 'Monitoramento concluído',
      results,
    });
  } catch (error: any) {
    console.error('Erro no cron de monitoramento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro no monitoramento' },
      { status: 500 }
    );
  }
}

// Função auxiliar para analisar erro com IA
async function analyzeErrorWithAI(
  errorMessage: string,
  errorDetails: string,
  aiConfig: any
): Promise<string> {
  const apiKey = decrypt(aiConfig.api_key);

  let apiUrl = '';
  let requestBody: any = {};

  if (aiConfig.provider === 'openai') {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    requestBody = {
      model: aiConfig.model,
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em n8n. Analise o erro e forneça uma solução concisa em português.',
        },
        {
          role: 'user',
          content: `Erro: ${errorMessage}\n\nDetalhes: ${errorDetails}`,
        },
      ],
      max_tokens: 200,
    };
  } else if (aiConfig.provider === 'anthropic') {
    apiUrl = 'https://api.anthropic.com/v1/messages';
    requestBody = {
      model: aiConfig.model,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Você é um especialista em n8n. Analise o erro e forneça uma solução concisa em português.\n\nErro: ${errorMessage}\n\nDetalhes: ${errorDetails}`,
        },
      ],
    };
  }

  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (aiConfig.provider === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (aiConfig.provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Erro na API da IA: ${response.status}`);
  }

  const data = await response.json();

  if (aiConfig.provider === 'openai') {
    return data.choices[0].message.content;
  } else if (aiConfig.provider === 'anthropic') {
    return data.content[0].text;
  }

  return 'Análise não disponível';
}

// Função auxiliar para enviar WhatsApp
async function sendWhatsAppNotification(
  error: any,
  instance: any,
  uazapiConfig: any
): Promise<void> {
  const apiToken = decrypt(uazapiConfig.api_token);

  const message = `🚨 *Erro detectado no n8n*\n\n*Instância:* ${instance.name}\n*Workflow:* ${error.workflow_name}\n*Nó:* ${error.error_node}\n*Erro:* ${error.error_message}\n*Severidade:* ${error.severity}\n\n${error.ai_analysis ? `*Análise IA:*\n${error.ai_analysis}` : ''}`;

  const uazapiUrl = `https://api.uazapi.com/v1/instances/${uazapiConfig.instance}/messages/text`;

  await fetch(uazapiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      phone: uazapiConfig.phone,
      message,
    }),
  });
}
