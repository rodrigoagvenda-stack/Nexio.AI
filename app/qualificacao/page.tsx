'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import {
  VOLUME_ATENDIMENTOS_OPTIONS,
  GARGALO_OPTIONS,
  PROCESSO_VENDAS_OPTIONS,
  URGENCIA_OPTIONS,
  BUDGET_OPTIONS,
  SEGMENTO_OPTIONS,
} from '@/types/lead-qualification';

const formSchema = z.object({
  nome_completo: z.string().min(3, 'Nome completo é obrigatório'),
  whatsapp: z.string().min(10, 'WhatsApp com DDD é obrigatório'),
  country_code: z.string().default('+55'),
  email: z.string().email('E-mail inválido'),
  nome_empresa: z.string().min(2, 'Nome da empresa é obrigatório'),
  segmento_negocio: z.string().min(1, 'Segmento é obrigatório'),
  volume_atendimentos: z.string().min(1, 'Selecione o volume de atendimentos'),
  principal_gargalo: z.string().min(1, 'Selecione o principal gargalo'),
  dor_principal: z.string().optional(),
  processo_vendas: z.string().min(1, 'Selecione uma opção'),
  ticket_medio: z.string().optional(),
  pessoas_comercial: z.string().optional(),
  urgencia: z.string().min(1, 'Selecione a urgência'),
  budget: z.string().min(1, 'Selecione o budget'),
});

type FormData = z.infer<typeof formSchema>;

export default function LeadQualificationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_completo: '',
      whatsapp: '',
      country_code: '+55',
      email: '',
      nome_empresa: '',
      segmento_negocio: '',
      volume_atendimentos: '',
      principal_gargalo: '',
      dor_principal: '',
      processo_vendas: '',
      ticket_medio: '',
      pessoas_comercial: '',
      urgencia: '',
      budget: '',
    },
  });

  const watchGargalo = form.watch('principal_gargalo');

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/lead-qualification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao enviar formulário');
      }

      setIsSuccess(true);
      toast.success('Formulário enviado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar formulário');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-10">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 rounded-full blur-xl opacity-30"></div>
                <div className="relative bg-gradient-to-r from-primary to-purple-600 p-4 rounded-full">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">Obrigado pelo seu interesse!</h2>
            <p className="text-muted-foreground mb-6">
              Recebemos suas informações e em breve um de nossos especialistas entrará em contato
              para apresentar a melhor solução para o seu negócio.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Nexio AI - Automação Inteligente</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            <span className="text-foreground">nexio</span>
            <span className="text-primary">.</span>
            <span className="text-foreground">ai</span>
          </h1>
          <p className="text-muted-foreground">
            Vamos entender seu negócio para oferecer a melhor solução
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Básicas</CardTitle>
                <CardDescription>Seus dados de contato</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome_completo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp (com DDD) *</FormLabel>
                        <FormControl>
                          <Input placeholder="11999999999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="nome_empresa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da empresa *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da sua empresa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Qualificação do Negócio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Qualificação do Negócio</CardTitle>
                <CardDescription>Informações sobre sua operação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="segmento_negocio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segmento do negócio *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o segmento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SEGMENTO_OPTIONS.map((segmento) => (
                            <SelectItem key={segmento} value={segmento}>
                              {segmento}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="volume_atendimentos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantas conversas/atendimentos vocês fazem por dia no WhatsApp? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VOLUME_ATENDIMENTOS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Identificação do Gargalo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Identificação do Gargalo</CardTitle>
                <CardDescription>Entenda suas principais dificuldades</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="principal_gargalo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qual o principal gargalo no seu atendimento/vendas hoje? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GARGALO_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchGargalo === 'outro' && (
                  <FormField
                    control={form.control}
                    name="dor_principal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descreva brevemente sua dor principal</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Conte-nos mais sobre o seu principal desafio..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Maturidade Comercial */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Maturidade Comercial</CardTitle>
                <CardDescription>Estrutura do seu time de vendas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="processo_vendas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Você já tem um processo de vendas estruturado? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROCESSO_VENDAS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ticket_medio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qual seu ticket médio aproximado?</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: R$ 500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pessoas_comercial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantas pessoas no comercial/atendimento?</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Urgência e Budget */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Urgência e Budget</CardTitle>
                <CardDescription>Seu momento e investimento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="urgencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quando você precisa resolver isso? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {URGENCIA_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qual seu budget disponível para investir em uma solução completa? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BUDGET_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enviar e receber proposta
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
