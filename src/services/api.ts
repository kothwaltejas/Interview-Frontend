import { supabase } from '../lib/supabase';

// Base API configuration
const API_BASE_URL = 'http://localhost:8000'; // Backend FastAPI server

// Types for API responses
export interface UserStatistics {
  total_interviews: number;
  average_score: number;  // Will be 0 if no interviews
  total_practice_time_hours: number;
  improvement_areas: number;
  completed_this_month: number;
  score_change: number;  // Will be 0 if no previous data
}

export interface RecentInterview {
  id: string;
  target_role: string;  // Database field
  average_score: number | null;  // Database field - can be null
  completed_at: string;
  duration_seconds: number;  // Database field - duration in seconds
  status: string;
  // Computed fields for UI
  job_role?: string;
  score?: number;
  duration?: number;
}

export interface DashboardData {
  statistics: UserStatistics;
  recentInterviews: RecentInterview[];
  chartData: {
    monthly_trends: Array<{
      month: string;
      interviews: number;
      average_score: number;
    }>;
    role_distribution: Array<{
      role: string;
      count: number;
    }>;
  };
}

// Get authenticated headers with JWT token
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

// API service class
export class ApiService {
  
  // Fetch user statistics for dashboard cards
  static async getUserStatistics(): Promise<UserStatistics> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/db/statistics`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Ensure we handle null/undefined values from backend
      const stats = data.statistics || {};
      return {
        total_interviews: stats.total_interviews || 0,
        average_score: stats.average_score || 0,
        total_practice_time_hours: stats.total_practice_time_hours || 0,
        improvement_areas: stats.improvement_areas || 0,
        completed_this_month: stats.completed_this_month || 0,
        score_change: stats.score_change || 0
      };
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      return this.getDefaultStatistics();
    }
  }

  // Fetch recent interview sessions
  static async getRecentInterviews(limit = 5): Promise<RecentInterview[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/db/sessions?limit=${limit}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform backend data to match frontend interface
      const transformedSessions = (data.sessions || []).map((session: any) => ({
        id: session.id,
        job_role: session.target_role,  // Map target_role to job_role
        score: session.average_score || 0,  // Handle null scores
        completed_at: session.completed_at,
        duration: Math.round((session.duration_seconds || 0) / 60),  // Convert seconds to minutes
        status: session.performance_tier || 'completed'
      }));
      
      return transformedSessions;
    } catch (error) {
      console.error('Error fetching recent interviews:', error);
      return [];
    }
  }

  // Fetch dashboard data (all data needed for dashboard)
  static async getDashboardData(): Promise<DashboardData> {
    try {
      const [statistics, recentInterviews] = await Promise.all([
        this.getUserStatistics(),
        this.getRecentInterviews()
      ]);

      // Generate chart data from recent interviews
      const chartData = this.generateChartData(recentInterviews);

      // Fix total_interviews count by using actual interview data
      const correctedStatistics = {
        ...statistics,
        total_interviews: recentInterviews.length  // Use actual count from database records
      };

      return {
        statistics: correctedStatistics,
        recentInterviews,
        chartData
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return this.getDefaultDashboardData();
    }
  }

  // Generate chart data from recent interviews
  private static generateChartData(interviews: RecentInterview[]) {
    // Group by month for trend chart
    const monthlyData: { [key: string]: { interviews: number; totalScore: number } } = {};
    const roleData: { [key: string]: number } = {};

    interviews.forEach(interview => {
      const date = new Date(interview.completed_at);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' }); // Only month name for consistency
      
      // Monthly trends
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { interviews: 0, totalScore: 0 };
      }
      monthlyData[monthKey].interviews += 1;
      monthlyData[monthKey].totalScore += interview.score || 0;

      // Role distribution
      const role = interview.job_role || 'Unknown';
      roleData[role] = (roleData[role] || 0) + 1;
    });

    const monthly_trends = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      interviews: data.interviews,
      average_score: data.interviews > 0 ? Number((data.totalScore / data.interviews).toFixed(1)) : 0
    }));

    const role_distribution = Object.entries(roleData).map(([role, count]) => ({
      role,
      count
    }));

    return { monthly_trends, role_distribution };
  }

  // Default statistics when no data is available
  private static getDefaultStatistics(): UserStatistics {
    return {
      total_interviews: 0,
      average_score: 0,
      total_practice_time_hours: 0,
      improvement_areas: 0,
      completed_this_month: 0,
      score_change: 0
    };
  }

  // Default dashboard data
  private static getDefaultDashboardData(): DashboardData {
    return {
      statistics: this.getDefaultStatistics(),
      recentInterviews: [],
      chartData: {
        monthly_trends: [],
        role_distribution: []
      }
    };
  }

  // Fetch user profile
  static async getUserProfile() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/db/profile`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }
}