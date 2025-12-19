'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { User, Lock } from 'lucide-react';

export default function ConfiguracoesPage() {
  const { user, authUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    description: '',
    department: '',
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        description: user.description || '',
        department: user.department || '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({
          name: profileData.name,
          description: profileData.description,
          department: profileData.department,
        })
        .eq('auth_user_id', authUser?.id);

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil do Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profileData.email} disabled />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Cargo/Função</Label>
              <Input
                id="department"
                value={profileData.department}
                onChange={(e) =>
                  setProfileData({ ...profileData, department: e.target.value })
                }
                placeholder="Ex: Gerente de Vendas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografia</Label>
              <Textarea
                id="bio"
                value={profileData.description}
                onChange={(e) =>
                  setProfileData({ ...profileData, description: e.target.value })
                }
                placeholder="Conte um pouco sobre você..."
                rows={4}
              />
            </div>

            <Button onClick={handleSaveProfile} disabled={loading} className="w-full">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input id="current-password" type="password" placeholder="••••••••" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input id="new-password" type="password" placeholder="••••••••" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input id="confirm-password" type="password" placeholder="••••••••" />
            </div>

            <Button variant="outline" className="w-full" disabled>
              Alterar Senha
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Funcionalidade de alteração de senha será implementada em breve
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
