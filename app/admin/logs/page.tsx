'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/utils/format';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: 'all', severity: 'all' });

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  async function fetchLogs() {
    try {
      const params = new URLSearchParams();
      if (filter.type !== 'all') params.append('type', filter.type);
      if (filter.severity !== 'all') params.append('severity', filter.severity);

      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();

      setLogs(data.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'error': return 'bg-red-400';
      case 'warning': return 'bg-primary';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Sistema de Logs</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="user_action">User Action</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter.severity} onValueChange={(v) => setFilter({ ...filter, severity: v })}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas severidades</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum log encontrado</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 md:p-4 hover:bg-accent">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${getSeverityColor(log.severity)} text-xs`}>
                        {log.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{log.type}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm">{log.message}</p>
                  {log.payload && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Ver payload
                      </summary>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
