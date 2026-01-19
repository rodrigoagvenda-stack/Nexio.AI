'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface TransacaoData {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria: string;
  valor: number;
  descricao: string;
  company_id?: string;
  company?: { name: string };
  data_transacao: string;
  created_at: string;
  metodo_pagamento?: string;
  status: 'pendente' | 'concluida' | 'cancelada';
}

interface FinanceiroContentProps {
  transacoes: TransacaoData[];
  stats: {
    receitas: number;
    despesas: number;
    saldo: number;
    total: number;
  };
}

export function FinanceiroContent({ transacoes: initialTransacoes, stats }: FinanceiroContentProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>('todas');

  // Form state
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataTransacao, setDataTransacao] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPagamento, setMetodoPagamento] = useState('');

  const categorias = {
    receita: ['Assinatura', 'Consultoria', 'Venda', 'Outro'],
    despesa: ['Servidor', 'Marketing', 'Salários', 'Infraestrutura', 'Outro'],
  };

  const handleCreateTransacao = async () => {
    if (!categoria || !valor || !descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      await supabase.from('transacoes_financeiras').insert({
        tipo,
        categoria,
        valor: parseFloat(valor),
        descricao,
        data_transacao: dataTransacao,
        metodo_pagamento: metodoPagamento || null,
        status: 'concluida',
      });

      toast.success('Transação criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error('Erro ao criar transação');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTipo('receita');
    setCategoria('');
    setValor('');
    setDescricao('');
    setDataTransacao(new Date().toISOString().split('T')[0]);
    setMetodoPagamento('');
  };

  const filteredTransacoes = filter === 'todas'
    ? initialTransacoes
    : initialTransacoes.filter(t => t.tipo === filter);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">
            Gerencie receitas e despesas da plataforma
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
              <DialogDescription>
                Adicione uma nova receita ou despesa
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(value: 'receita' | 'despesa') => {
                  setTipo(value);
                  setCategoria('');
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias[tipo].map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="data">Data da Transação</Label>
                <Input
                  id="data"
                  type="date"
                  value={dataTransacao}
                  onChange={(e) => setDataTransacao(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="metodo">Método de Pagamento</Label>
                <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva a transação..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateTransacao} disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : 'Criar Transação'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-2xl font-bold text-green-500">
                {formatCurrency(stats.receitas)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-2xl font-bold text-red-500">
                {formatCurrency(stats.despesas)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-2xl font-bold ${stats.saldo >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(stats.saldo)}
              </p>
            </div>
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Transações</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'todas' ? 'default' : 'outline'}
          onClick={() => setFilter('todas')}
        >
          Todas
        </Button>
        <Button
          variant={filter === 'receita' ? 'default' : 'outline'}
          onClick={() => setFilter('receita')}
        >
          Receitas
        </Button>
        <Button
          variant={filter === 'despesa' ? 'default' : 'outline'}
          onClick={() => setFilter('despesa')}
        >
          Despesas
        </Button>
      </div>

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredTransacoes.map((transacao) => (
                <TableRow key={transacao.id}>
                  <TableCell>
                    {new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        transacao.tipo === 'receita'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }
                    >
                      {transacao.tipo === 'receita' ? 'Receita' : 'Despesa'}
                    </Badge>
                  </TableCell>
                  <TableCell>{transacao.categoria}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {transacao.descricao}
                  </TableCell>
                  <TableCell>{transacao.company?.name || '-'}</TableCell>
                  <TableCell>{transacao.metodo_pagamento || '-'}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      transacao.tipo === 'receita'
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`}
                  >
                    {transacao.tipo === 'receita' ? '+' : '-'}
                    {formatCurrency(transacao.valor)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
