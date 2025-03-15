import { useToken } from '@chakra-ui/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Analysis {
  createdAt: string;
  status: string;
  insights: Array<{ type: string }>;
  vulnerabilities: Array<{ severity: string }>;
}

interface DashboardChartProps {
  data: Analysis[];
}

export function DashboardChart({ data }: DashboardChartProps) {
  const [brand500, brand200] = useToken('colors', ['brand.500', 'brand.200']);

  // Process data for chart
  const chartData = data.reduce((acc: any[], analysis) => {
    const date = new Date(analysis.createdAt);
    const formattedDate = date.toLocaleDateString();
    
    const existingEntry = acc.find((entry) => entry.date === formattedDate);
    
    if (existingEntry) {
      existingEntry.analyses += 1;
      existingEntry.insights += analysis.insights?.length || 0;
      existingEntry.vulnerabilities += analysis.vulnerabilities?.length || 0;
    } else {
      acc.push({
        date: formattedDate,
        analyses: 1,
        insights: analysis.insights?.length || 0,
        vulnerabilities: analysis.vulnerabilities?.length || 0,
      });
    }
    
    return acc;
  }, []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorAnalyses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={brand500} stopOpacity={0.8} />
            <stop offset="95%" stopColor={brand500} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorInsights" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={brand200} stopOpacity={0.8} />
            <stop offset="95%" stopColor={brand200} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="analyses"
          stroke={brand500}
          fillOpacity={1}
          fill="url(#colorAnalyses)"
        />
        <Area
          type="monotone"
          dataKey="insights"
          stroke={brand200}
          fillOpacity={1}
          fill="url(#colorInsights)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
