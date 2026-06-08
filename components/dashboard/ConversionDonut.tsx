'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

interface ConversionRadialProps {
  fechados: number;
  emAndamento: number;
  delta?: number | null;
  periodo: string;
}

const chartConfig = {
  fechados: {
    label: 'Fechados',
    color: 'var(--primary)',
  },
  em_andamento: {
    label: 'Em andamento',
    color: 'hsl(var(--primary) / 0.15)',
  },
} satisfies ChartConfig;

export function ConversionDonut({ fechados, emAndamento, delta, periodo }: ConversionRadialProps) {
  const total = fechados + emAndamento;
  const pct = total > 0 ? Math.round((fechados / total) * 100) : 0;
  const chartData = [{ fechados, em_andamento: emAndamento }];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="items-center pb-0 flex-shrink-0">
        <CardTitle>Taxa de conversão</CardTitle>
        <CardDescription>{periodo}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[220px]">
          <RadialBarChart data={chartData} endAngle={180} innerRadius={75} outerRadius={108}>
            <PolarGrid gridType="circle" radialLines={false} stroke="none" className="first:fill-muted last:fill-background" />
            <RadialBar
              dataKey="em_andamento"
              fill="var(--color-em_andamento)"
              stackId="a"
              cornerRadius={5}
              className="stroke-transparent stroke-2"
            />
            <RadialBar
              dataKey="fechados"
              fill="var(--color-fechados)"
              stackId="a"
              cornerRadius={5}
              className="stroke-transparent stroke-2"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 14}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {pct}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 6}
                          className="fill-muted-foreground text-xs"
                        >
                          conversão
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1.5 text-sm pb-4 flex-shrink-0">
        {delta !== null && delta !== undefined && (
          <div className={`flex items-center gap-1.5 font-medium text-sm ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {delta >= 0 ? '+' : ''}{delta}% vs período anterior
          </div>
        )}
        <div className="flex items-center gap-6 text-sm text-foreground">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary inline-block" />
            {fechados} fechados
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30 inline-block" />
            {emAndamento} em andamento
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
