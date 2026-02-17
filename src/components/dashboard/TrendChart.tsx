import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './TrendChart.module.css';

interface TrendData {
  month: string;
  interviews: number;
  average_score: number;
}

interface TrendChartProps {
  data: TrendData[];
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  // Generate consistent 4-month timeline (2 past + current + 1 future)
  const generateTimelineData = () => {
    const months: TrendData[] = [];
    const now = new Date();
    
    // Generate 4 months: 2 past, current, 1 future
    for (let i = -2; i <= 1; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = monthDate.toLocaleDateString('en-US', { month: 'short' });
      
      // Find matching data for this month or default to 0
      const existingData = data.find(item => 
        item.month.toLowerCase() === monthKey.toLowerCase()
      );
      
      months.push({
        month: monthKey,
        interviews: existingData?.interviews || 0,
        average_score: existingData?.average_score || 0
      });
    }
    
    return months;
  };

  // Use generated timeline data
  const chartData = generateTimelineData();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const interviewCount = payload[0].value;
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
      const isFutureMonth = label !== currentMonth && new Date().getMonth() < new Date(`${label} 1, 2026`).getMonth();
      
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-100">
          <p className="text-sm text-gray-600">{`${label} 2026`}</p>
          <p className="text-sm font-semibold text-blue-600">
            {isFutureMonth 
              ? "Upcoming month" 
              : interviewCount === 0 
                ? "No interviews yet"
                : `${interviewCount} interviews`
            }
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Monthly Interview Trend</h3>
        <p className={styles.chartSubtitle}>Your practice session frequency over time</p>
      </div>
      
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              domain={[0, 'dataMax']}
              allowDataOverflow={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="interviews" 
              stroke="#2563EB" 
              strokeWidth={3}
              dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#2563EB', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;