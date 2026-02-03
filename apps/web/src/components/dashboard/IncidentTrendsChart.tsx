import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { IncidentTrend } from '@/types/api'
import { TrendingUp } from 'lucide-react'

interface IncidentTrendsChartProps {
  data: IncidentTrend[]
}

export function IncidentTrendsChart({ data }: IncidentTrendsChartProps) {
  // Format dates for display
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent-primary" />
          <CardTitle>Incident Trends (Last 30 Days)</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis
              dataKey="date"
              stroke="#a0aec0"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#a0aec0" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a202c',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="critical"
              stroke="#ef4444"
              strokeWidth={2}
              name="Critical"
              dot={{ fill: '#ef4444', r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke="#f97316"
              strokeWidth={2}
              name="High"
              dot={{ fill: '#f97316', r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="medium"
              stroke="#eab308"
              strokeWidth={2}
              name="Medium"
              dot={{ fill: '#eab308', r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="low"
              stroke="#22c55e"
              strokeWidth={2}
              name="Low"
              dot={{ fill: '#22c55e', r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
