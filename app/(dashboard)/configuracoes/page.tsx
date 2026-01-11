import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Church, Users, Bell, Shield } from "lucide-react"

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*, igreja:igreja_id(*)")
    .eq("id", user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Church className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Igreja</CardTitle>
                <CardDescription>Configurações da igreja</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{profile?.igreja?.nome || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium capitalize">{profile?.igreja?.tipo || 'N/A'}</span>
              </div>
            </div>
            <Button className="w-full mt-4" variant="outline">
              Editar Dados da Igreja
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>Suas informações</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{profile?.nome || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{profile?.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Função:</span>
                <span className="font-medium capitalize">{profile?.role || 'N/A'}</span>
              </div>
            </div>
            <Button className="w-full mt-4" variant="outline">
              Editar Perfil
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Bell className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Preferências de notificação</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Email</span>
                <input type="checkbox" className="h-4 w-4" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Push</span>
                <input type="checkbox" className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">SMS</span>
                <input type="checkbox" className="h-4 w-4" />
              </div>
            </div>
            <Button className="w-full mt-4" variant="outline">
              Salvar Preferências
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>Alterar senha e segurança</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm mb-4">
              <p className="text-muted-foreground">
                Última alteração de senha: Nunca
              </p>
              <p className="text-muted-foreground">
                Autenticação em duas etapas: Desativada
              </p>
            </div>
            <Button className="w-full" variant="outline">
              Alterar Senha
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
