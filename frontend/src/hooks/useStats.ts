import { useState, useEffect } from 'react';

interface Stats {
  totalSubscribers: number;
  totalNotificationsSent: number;
}

interface UseStatsReturn {
  stats: Stats | null;
  loading: boolean;
  error: string | null;
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFirebaseFunctionUrl = (functionName: string) => {
    return process.env.NODE_ENV === 'development'
      ? `http://127.0.0.1:5001/thecannonmonitor/us-central1/${functionName}`
      : `https://us-central1-thecannonmonitor.cloudfunctions.net/${functionName}`;
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(getFirebaseFunctionUrl('get_stats'));

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status}`);
        }

        const data = await response.json();
        setStats({
          totalSubscribers: data.total_subscribers || 0,
          totalNotificationsSent: data.total_notifications_sent || 0,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
        setStats({
          totalSubscribers: 0,
          totalNotificationsSent: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}
