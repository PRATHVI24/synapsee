import { DollarSign, FileText, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from '@/types/invoice';

interface StatsCardsProps {
  invoices: Invoice[];
}

export function StatsCards({ invoices }: StatsCardsProps) {
  const approvedInvoices = invoices.filter(invoice => invoice.status === 'approved');
  const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending');

  const totalSpend = approvedInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalProcessed = invoices.length;
  const pendingReview = pendingInvoices.length;

  const stats = [
    {
      title: 'Total Spend (Approved)',
      value: `$${totalSpend.toLocaleString()}`,
      icon: DollarSign,
      description: 'From approved invoices',
    },
    {
      title: 'Invoices Processed',
      value: totalProcessed.toString(),
      icon: FileText,
      description: 'Total count of all invoices',
    },
    {
      title: 'Pending Review',
      value: pendingReview.toString(),
      icon: Clock,
      description: 'Awaiting approval',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}