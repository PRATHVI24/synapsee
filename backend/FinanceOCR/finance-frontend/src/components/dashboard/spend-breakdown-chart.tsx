import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from '@/types/invoice';

interface SpendBreakdownChartProps {
  invoices: Invoice[];
}

export function SpendBreakdownChart({ invoices }: SpendBreakdownChartProps) {
  const approvedInvoices = invoices.filter(invoice => invoice.status === 'approved');

  const vendorSpend = approvedInvoices.reduce((acc, invoice) => {
    if (!acc[invoice.vendor]) {
      acc[invoice.vendor] = 0;
    }
    acc[invoice.vendor] += invoice.total;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(vendorSpend)
    .map(([vendor, total]) => ({
      vendor,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5); // Top 5 vendors

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Spend Breakdown</CardTitle>
        <CardDescription>
          Total approved spend per vendor for the current period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="horizontal"
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="vendor" type="category" width={100} />
              <Tooltip
                formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Total Spend']}
                labelStyle={{ color: 'black' }}
              />
              <Bar
                dataKey="total"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}