import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { DashboardMetrics } from '@/types/api'
import { Activity } from 'lucide-react'

interface StatusDistributionChartProps {
  data: DashboardMetrics['statusBreakdown']
}

const COLORS = {
  triggered: '#ef4444', // red
  acknowledged: '#eab308', // yellow
  resolved: '#22c55e', // green
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const chartData = [
    { name: 'Triggered', value: data.triggered, color: COLORS.triggered },
    { name: 'Acknowledged', value: data.acknowledged, color: COLORS.acknowledged },
    { name: 'Resolved', value: data.resolved, color: COLORS.resolved },
  ].filter((item) => item.value > 0)

  const total = data.triggered + data.acknowledged + data.resolved

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent-primary" />
            <CardTitle>Status Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-dark-400">
            No incidents to display
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent-primary" />
          <CardTitle>Status Distribution</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
              labelLine={{ stroke: '#a0aec0' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a202c',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
