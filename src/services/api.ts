import { authService, supabase } from '../lib/supabase';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  const token = await authService.getValidAccessToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// API service class
export class ApiService {
  
  // Fetch user statistics for dashboard cards
  // Backend field mapping:
  //   average_overall_score   → average_score
  //   total_time_spent_seconds → total_practice_time_hours
  static async getUserStatistics(allSessions?: RecentInterview[]): Promise<UserStatistics> {
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
      const raw = data.statistics || {};

      // Backend stores different field names — map them here
      const avgScore = raw.average_score ?? raw.average_overall_score ?? 0;
      const practiceHours = raw.total_practice_time_hours ??
        (raw.total_time_spent_seconds ? Math.round(raw.total_time_spent_seconds / 3600 * 10) / 10 : 0);

      // Derive completed_this_month and score_change from sessions if provided
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      let completedThisMonth = raw.completed_this_month ?? 0;
      let scoreChange = raw.score_change ?? 0;

      if (allSessions && allSessions.length > 0) {
        // Compute this month count from sessions
        const thisMonthSessions = allSessions.filter(s => {
          if (!s.completed_at) return false;
          const d = new Date(s.completed_at);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });
        completedThisMonth = thisMonthSessions.length;

        // Last month scores vs this month scores
        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
        const lastMonthSessions = allSessions.filter(s => {
          if (!s.completed_at) return false;
          const d = new Date(s.completed_at);
          return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });
        const thisMonthAvg = thisMonthSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
          (thisMonthSessions.length || 1);
        const lastMonthAvg = lastMonthSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
          (lastMonthSessions.length || 1);
        scoreChange = lastMonthSessions.length > 0 ? Math.round((thisMonthAvg - lastMonthAvg) * 10) / 10 : 0;
      }

      return {
        total_interviews: raw.total_interviews || allSessions?.length || 0,
        average_score: typeof avgScore === 'number' ? avgScore : Number(avgScore) || 0,
        total_practice_time_hours: practiceHours,
        improvement_areas: raw.improvement_areas ?? 0,
        completed_this_month: completedThisMonth,
        score_change: scoreChange
      };
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      return this.getDefaultStatistics();
    }
  }

  // Fetch ALL interview sessions (no limit) for accurate stats
  static async getAllSessions(): Promise<RecentInterview[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/db/sessions?limit=500`, {
        method: 'GET',
        headers
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.sessions || []).map((s: any) => ({
        id: s.id,
        job_role: s.target_role,
        score: s.average_score || 0,
        completed_at: s.completed_at,
        duration: Math.round((s.duration_seconds || 0) / 60),
        status: s.performance_tier || 'completed'
      }));
    } catch {
      return [];
    }
  }

  // Fetch recent interview sessions (for display)
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
      // Fetch all sessions first so we can derive accurate statistics
      const [allSessions, recentInterviews] = await Promise.all([
        this.getAllSessions(),
        this.getRecentInterviews(5)
      ]);

      const statistics = await this.getUserStatistics(allSessions);

      // Generate chart data from all sessions for accuracy
      const chartData = this.generateChartData(allSessions);

      return {
        statistics,
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

export async function getSessionEvaluations(session_id: string) {
  const { data, error } = await supabase
    .from('answer_evaluations')
    .select('question_index, question_text, score, reasoning, strengths, gaps, llm_used, difficulty, evaluation_metadata')
    .eq('session_id', session_id)
    .order('question_index', { ascending: true });
  if (error) throw error;
  return data;
}