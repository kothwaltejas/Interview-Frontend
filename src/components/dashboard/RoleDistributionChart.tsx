import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './RoleDistributionChart.module.css';

interface RoleData {
  role: string;
  count: number;
}

interface RoleDistributionChartProps {
  data: RoleData[];
}

const RoleDistributionChart: React.FC<RoleDistributionChartProps> = ({ data }) => {
  // Color palette for different roles
  const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];
  
  // Transform data and add colors
  const chartData = data.length > 0 ? data.map((item, index) => ({
    name: item.role,
    value: item.count,
    color: colors[index % colors.length]
  })) : [
    { name: 'Backend', value: 8, color: '#2563EB' },
    { name: 'Frontend', value: 6, color: '#10B981' },
    { name: 'Fullstack', value: 4, color: '#F59E0B' },
    { name: 'Machine Learning', value: 3, color: '#EF4444' },
    { name: 'DevOps', value: 2, color: '#8B5CF6' },
  ];
  
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-100">
          <p className="text-sm text-gray-900 font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">
            {data.value} interviews ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Role Distribution</h3>
        <p className={styles.chartSubtitle}>Breakdown by interview specialization</p>
      </div>

      <div className={styles.chartLayout}>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className={styles.centerTotal}>
            <div className={styles.totalNumber}>{total}</div>
            <div className={styles.totalLabel}>Total</div>
          </div>
        </div>

        <div className={styles.legend}>
          {chartData.map((entry, index) => (
            <div key={index} className={styles.legendItem}>
              <div 
                className={styles.legendColor}
                style={{ backgroundColor: entry.color }}
              />
              <span className={styles.legendText}>{entry.name}</span>
              <span className={styles.legendValue}>
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoleDistributionChart;