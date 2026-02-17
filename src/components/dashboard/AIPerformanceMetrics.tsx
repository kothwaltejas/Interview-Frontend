import React from 'react';
import styles from './AIPerformanceMetrics.module.css';

interface PerformanceMetric {
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
  icon: React.ReactNode;
  color: string;
}

const AIPerformanceMetrics: React.FC = () => {
  // Sample performance metrics
  const metrics: PerformanceMetric[] = [
    {
      name: 'Communication',
      score: 8.2,
      trend: 'up',
      description: 'Clarity and articulation',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      ),
      color: 'cardBlue'
    },
    {
      name: 'Technical Knowledge',
      score: 7.8,
      trend: 'up',
      description: 'Domain expertise',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
        </svg>
      ),
      color: 'cardGreen'
    },
    {
      name: 'Problem Solving',
      score: 7.5,
      trend: 'stable',
      description: 'Analytical thinking',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
      ),
      color: 'cardPurple'
    },
    {
      name: 'Confidence',
      score: 8.0,
      trend: 'up',
      description: 'Professional presence',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      color: 'cardYellow'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 8.0) return styles.scoreHigh;
    if (score >= 7.0) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return styles.trendUp;
      case 'down': return styles.trendDown;
      case 'stable': return styles.trendStable;
      default: return styles.trendStable;
    }
  };

  return (
    <div className={styles.metricsGrid}>
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className={`${styles.metricCard} ${styles[metric.color]}`}
        >
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.metricIcon}>{metric.icon}</div>
            <div className={`${styles.trendIcon} ${getTrendColor(metric.trend)}`}>
              <span>{getTrendIcon(metric.trend)}</span>
            </div>
          </div>

          {/* Title and Description */}
          <div className={styles.cardContent}>
            <h4 className={styles.metricName}>
              {metric.name}
            </h4>
            <p className={styles.metricDescription}>
              {metric.description}
            </p>
          </div>

          {/* Score and Progress */}
          <div className={styles.scoreSection}>
            <div className={styles.scoreRow}>
              <span className={`${styles.scoreValue} ${getScoreColor(metric.score)}`}>
                {metric.score}/10
              </span>
              <span className={styles.scorePercentage}>
                {Math.round((metric.score / 10) * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${(metric.score / 10) * 100}%` }}
              />
            </div>

            {/* Additional Info */}
            <div className={styles.scoreDetails}>
              <span>Last 30 days</span>
              <span className={getTrendColor(metric.trend)}>
                {metric.trend === 'up' ? '+0.3' : metric.trend === 'down' ? '-0.1' : '±0.0'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AIPerformanceMetrics;