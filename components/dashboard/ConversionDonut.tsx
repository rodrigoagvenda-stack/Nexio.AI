'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { motion } from 'framer-motion';

interface ConversionData {
  name: string;
  value: number;
  color: string;
}

interface ConversionDonutProps {
  data: ConversionData[];
}

// Renderizador customizado para fatia ativa (interactive)
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export function ConversionDonut({ data }: ConversionDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  // Calculate total percentage (should be close to 100)
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  // Tratar divisão por zero - se totalValue é 0, retornar 0%
  const mainPercentage = totalValue > 0 && data[0] ? Math.round((data[0].value / totalValue) * 100) : 0;

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Taxa de conversão geral</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col justify-center">
          <div className="relative h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="86%"
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                  animationDuration={1000}
                  animationBegin={300}
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  style={{ cursor: 'pointer' }}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  itemStyle={{
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  labelStyle={{
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center percentage text */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <div className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">{mainPercentage}%</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">Taxa geral</div>
              </div>
            </motion.div>
          </div>
          {/* Legend below chart with circular icons */}
          <div className="mt-6 flex justify-center gap-6">
            {data.map((entry, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-foreground">{entry.name}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
