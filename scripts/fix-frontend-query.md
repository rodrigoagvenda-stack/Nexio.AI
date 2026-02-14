# 🔧 Possível Fix para Erro 400 no Frontend

## Problema
A query do Supabase está retornando erro 400:
```
mensagens_do_whatsapp?select=*,user:users!mensagens_do_whatsapp_sender_user_id_fkey(name)
```

## Possíveis Causas

### 1. Foreign Key não existe ou está com nome diferente
Execute no SQL:
```sql
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'mensagens_do_whatsapp'
  AND constraint_type = 'FOREIGN KEY';
```

### 2. A coluna referenciada está errada
A foreign key pode estar referenciando `users(id)` ao invés de `users(user_id)` ou vice-versa.

## Soluções

### Solução 1: Usar LEFT JOIN ao invés de foreign key notation
Arquivo: `app/(dashboard)/atendimento/page.tsx` linha 181-197

**ANTES:**
```typescript
async function fetchMessages(conversationId: number) {
  try {
    const { data, error } = await supabase
      .from('mensagens_do_whatsapp')
      .select(`
        *,
        user:users!mensagens_do_whatsapp_sender_user_id_fkey(name)
      `)
      .eq('id_da_conversacao', conversationId)
      .eq('company_id', company!.id)
      .order('carimbo_de_data_e_hora', { ascending: true });

    if (error) throw error;
    setMessages(data || []);
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}
```

**DEPOIS (Opção 1 - Se a FK existe):**
```typescript
async function fetchMessages(conversationId: number) {
  try {
    const { data, error } = await supabase
      .from('mensagens_do_whatsapp')
      .select(`
        *,
        user:users(name)
      `)
      .eq('id_da_conversacao', conversationId)
      .eq('company_id', company!.id)
      .order('carimbo_de_data_e_hora', { ascending: true });

    if (error) throw error;
    setMessages(data || []);
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}
```

**DEPOIS (Opção 2 - Buscar usuário separadamente):**
```typescript
async function fetchMessages(conversationId: number) {
  try {
    // 1. Buscar mensagens
    const { data: messagesData, error: messagesError } = await supabase
      .from('mensagens_do_whatsapp')
      .select('*')
      .eq('id_da_conversacao', conversationId)
      .eq('company_id', company!.id)
      .order('carimbo_de_data_e_hora', { ascending: true });

    if (messagesError) throw messagesError;

    // 2. Buscar IDs únicos de usuários
    const userIds = [...new Set(
      messagesData
        ?.filter(m => m.sender_user_id)
        .map(m => m.sender_user_id)
    )];

    // 3. Buscar dados dos usuários
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('user_id, name')  // ou 'id, name' se a PK for 'id'
      .in('user_id', userIds);   // ou 'id' se a PK for 'id'

    if (usersError) console.error('Error fetching users:', usersError);

    // 4. Mapear usuários para mensagens
    const usersMap = new Map(usersData?.map(u => [u.user_id, u]) || []);
    const messagesWithUsers = messagesData?.map(msg => ({
      ...msg,
      user: msg.sender_user_id ? usersMap.get(msg.sender_user_id) : null
    })) || [];

    setMessages(messagesWithUsers);
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}
```

### Solução 2: Verificar se company_id está undefined
Adicione logs para debugar:

```typescript
async function fetchMessages(conversationId: number) {
  console.log('🔍 DEBUG fetchMessages:', {
    conversationId,
    companyId: company?.id,
    companyObject: company
  });

  if (!company?.id) {
    console.error('❌ company.id está undefined!');
    toast.error('Erro: Company ID não encontrado');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('mensagens_do_whatsapp')
      .select('*')
      .eq('id_da_conversacao', conversationId)
      .eq('company_id', company.id)
      .order('carimbo_de_data_e_hora', { ascending: true });

    console.log('📊 Resultado:', { data, error });

    if (error) throw error;
    setMessages(data || []);
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}
```

## Teste
1. Execute o script `diagnostico-completo.sql` primeiro
2. Identifique qual é o problema (webhook, company_id ou foreign key)
3. Aplique a solução correspondente
4. Teste no frontend
