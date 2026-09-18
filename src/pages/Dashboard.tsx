import { useState, useEffect } from 'react';
import { getDashboardSummary } from '../api/dashboard';
import { StatCard, Card, CardHeader, CardBody, DataTable, LoadingState, EmptyState } from '../components/ui';
import type { Column } from '../components/ui';
import type { DashboardSummary, RecentPayment } from '../types';
import { useToast } from '../contexts';

export function Dashboard() {
  const { addToast } = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const summary = await getDashboardSummary();
        setData(summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        addToast('error', 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [addToast]);

  const columns: Column<RecentPayment>[] = [
    { key: 'Payment_ID', header: 'Payment ID', sortable: true },
    { key: 'Student_ID', header: 'Student ID', sortable: true },
    { key: 'Amount_Paid', header: 'Amount', sortable: true },
    { key: 'Payment_Date', header: 'Date', sortable: true },
    {
      key: 'type',
      header: 'Type',
      render: (row: RecentPayment) => (
        <span className={`badge ${row.type === 'schoolFees' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
          {row.type === 'schoolFees' ? 'School Fees' : 'Feeding Fees'}
        </span>
      ),
    },
  ];

  if (loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Unable to load dashboard</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Overview of your school management system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Students"
          value={data.activeStudents}
          subtitle="Currently enrolled"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          title="Active Staff"
          value={data.activeStaff}
          subtitle="Teaching & support staff"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          title="School Fees Collected"
          value={`GHS ${data.schoolFeesCollected.toLocaleString()}`}
          subtitle="Total payments received"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="Feeding Fees Collected"
          value={`GHS ${data.feedingFeesCollected.toLocaleString()}`}
          subtitle="Total feeding payments"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Low Stock Items"
          value={data.lowStockItems}
          subtitle="Items needing restock"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
        />
        <Card className="col-span-2">
          <CardHeader title="Recent Payments" />
          <CardBody>
            {data.recentPayments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                description="Start recording payments to see them here"
              />
            ) : (
              <DataTable
                columns={columns}
                data={data.recentPayments}
                keyField="Payment_ID"
                rowKey={(row) => row.Payment_ID}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
