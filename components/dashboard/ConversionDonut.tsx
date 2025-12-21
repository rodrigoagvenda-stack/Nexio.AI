'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ConversionData {
  name: string;
  value: number;
  color: string;
}

interface ConversionDonutProps {
  data: ConversionData[];
}

export function ConversionDonut({ data }: ConversionDonutProps) {
  // Calculate total percentage (should be close to 100)
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const mainPercentage = data[0] ? Math.round((data[0].value / totalValue) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxa de conversão geral</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                fill="#8884d8"
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center percentage text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-5xl font-bold text-foreground">{mainPercentage}%</div>
              <div className="text-sm text-muted-foreground mt-1">Taxa geral</div>
            </div>
          </div>
        </div>
        {/* Legend below chart */}
        <div className="mt-6 flex justify-center gap-6">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">{entry.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
