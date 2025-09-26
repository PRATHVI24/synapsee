"use client"

import { useQuery } from '@tanstack/react-query'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentInvoices } from '@/components/dashboard/recent-invoices'
import { SpendBreakdownChart } from '@/components/dashboard/spend-breakdown-chart'
import { FinancialQuery } from '@/components/dashboard/financial-query'
import { getInvoices } from '@/api/invoices'

export default function DashboardPage() {
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => getInvoices(1, 100),
  })

  const invoices = invoicesData?.invoices || []

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your finance dashboard overview.
          </p>
        </div>

        <div className="animate-pulse space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your finance dashboard overview.
        </p>
      </div>

      <StatsCards invoices={invoices} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentInvoices invoices={invoices} />
        <SpendBreakdownChart invoices={invoices} />
      </div>

      <FinancialQuery />
    </div>
  )
}