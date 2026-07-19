import { useState, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import {
  BarChart3,
  Users,
  Compass,
  IndianRupee,
  Filter,
  TrendingUp,
  Terminal,
  AlertCircle,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useAdminQueriesQuery, useResolveQueryMutation } from '../hooks/useQueries';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useThemeStore } from '../store/themeStore';
import { TripDetailModal } from '../components/admin/TripDetailModal';
import type { TripItem } from '../types';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { LogConsoleItem } from '../components/admin/LogConsoleItem';
import { useAdminLogsQuery, useAdminAnalyticsQuery, useAdminTripsQuery } from '../hooks/useAdmin';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);



export default function AdminDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchDestination, setSearchDestination] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const limit = 6;
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'queries'>('overview');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [queryStatusFilter, setQueryStatusFilter] = useState<string>('');

  const [resolvingQuery, setResolvingQuery] = useState<{ 
    id: string; 
    email: string; 
    message: string; 
    amount?: number; 
    paymentId?: string; 
    category?: string;
  } | null>(null);
  const [adminReplyText, setAdminReplyText] = useState<string>('');


  // React Query to fetch system logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useAdminLogsQuery(activeTab === 'logs');

  // React Query to fetch analytics dashboard summary data
  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useAdminAnalyticsQuery();

  // React Query to fetch the list of trips
  const { data: tripsData, isLoading: tripsLoading, refetch: refetchTrips } = useAdminTripsQuery({
    status: statusFilter || undefined,
    destination: searchDestination || undefined,
    page: currentPage,
    limit,
  });

  // Hot polling database records every 20 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      refetchTrips();
    }, 20000);
    return () => clearInterval(timer);
  }, [refetchTrips]);

  // React Query to fetch user troubleshooting tickets
  const { data: queriesData, isLoading: queriesLoading, refetch: refetchQueries } = useAdminQueriesQuery(queryStatusFilter || undefined);
  const resolveQueryMutation = useResolveQueryMutation();

  const handleQueryTripClick = async (tripId: string) => {
    try {
      const res = await api.get(`/admin/trips/${tripId}`);
      if (res.data?.trip) {
        setSelectedTrip(res.data.trip);
      } else {
        toast.error('Trip details not found.');
      }
    } catch (error: any) {
      toast.error('Failed to load trip details.');
    }
  };

  // Format status count lists into Chart labels
  const statusData = {
    labels: analytics?.statusCounts?.map((s: any) => s._id) || [],
    datasets: [
      {
        data: analytics?.statusCounts?.map((s: any) => s.count) || [],
        backgroundColor: [
          'rgba(251, 191, 36, 0.75)', // Amber -> Draft
          'rgba(129, 140, 248, 0.75)', // Indigo -> Planned
          'rgba(16, 185, 129, 0.75)', // Emerald -> Confirmed
          'rgba(239, 68, 68, 0.75)', // Red -> Cancelled
        ],
        borderColor: '#121824',
        borderWidth: 2,
      },
    ],
  };

  const topDestNames = analytics?.topDestinations?.map((d: any) => d._id) || [];
  const topDestCounts = analytics?.topDestinations?.map((d: any) => d.count) || [];

  const destinationData = {
    labels: topDestNames,
    datasets: [
      {
        label: 'Trip count',
        data: topDestCounts,
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(79, 70, 229, 0.95)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11 },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.03)' },
      },
      y: {
        ticks: { color: '#94a3b8', precision: 0 },
        grid: { color: 'rgba(255,255,255,0.03)' },
      },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11 },
        },
      },
    },
  };

  // Stats calculation
  const totalTripsCount = analytics?.totalTrips || 0;
  const confirmedTripsCount = analytics?.statusCounts?.find((s: any) => s._id === 'CONFIRMED')?.count || 0;
  const cancelledTripsCount = analytics?.statusCounts?.find((s: any) => s._id === 'CANCELLED')?.count || 0;
  // Plan Completion Rate = Confirmed ÷ (Total − Cancelled) × 100
  // Excludes cancelled trips from the denominator so the metric reflects
  // how many active plans were successfully confirmed.
  const activeTripsCount = totalTripsCount - cancelledTripsCount;
  const completionRate = activeTripsCount > 0 ? ((confirmedTripsCount / activeTripsCount) * 100).toFixed(1) : '0';

  const totalPages = Math.ceil((tripsData?.total || 0) / limit);

  // Loading & Error states
  const showOverviewLoader = activeTab === 'overview' && (analyticsLoading || tripsLoading);
  const showLogsLoader = activeTab === 'logs' && logsLoading && !logsData;

  if (showOverviewLoader || showLogsLoader) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[60vh] gap-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        <Compass className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm font-medium">
          {showLogsLoader ? 'Streaming system logs...' : 'Loading real-time dashboard data...'}
        </p>
      </div>
    );
  }

  // Error state
  if (activeTab === 'overview' && analyticsError) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[60vh] gap-4 ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
        <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl font-bold">!</div>
        <p className="text-sm font-semibold text-red-400">Failed to load dashboard data</p>
        <p className="text-xs">Check that the server is running and your session is valid.</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 min-h-[calc(100vh-4rem)] transition-colors duration-300 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight glow-text mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            System Operations Dashboard
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Swarm lifecycle orchestrator diagnostics &amp; payment metrics in real-time
          </p>
        </div>
        <div className={`flex items-center gap-2 text-xs border rounded-lg px-3.5 py-2 font-medium transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-705'
        }`}>
          <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
          Live Metrics Polling Enabled (20s)
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-b border-slate-800 pb-px mb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition duration-300 cursor-pointer ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="h-4.5 w-4.5" />
          Overview & Diagnostics
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition duration-300 cursor-pointer ${
            activeTab === 'logs'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="h-4.5 w-4.5" />
          Live AWS System Logs
        </button>
        <button
          onClick={() => setActiveTab('queries')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition duration-300 cursor-pointer ${
            activeTab === 'queries'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertCircle className="h-4.5 w-4.5" />
          User Troubleshooter Tickets
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* METRICS STATS GRID */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatCard
              title="Total Trip Plans"
              value={totalTripsCount}
              icon={Compass}
              iconBgClass="bg-primary/10 border-primary/20"
              iconTextClass="text-primary"
              isDark={isDark}
            />
            <AdminStatCard
              title="Active Users"
              value={analytics?.totalUsers || 0}
              icon={Users}
              iconBgClass="bg-accent-teal/10 border-accent-teal/20"
              iconTextClass="text-accent-teal"
              isDark={isDark}
            />
            <AdminStatCard
              title="Avg Budget Cap"
              value={`₹${analytics?.avgBudget ? Math.round(analytics.avgBudget).toLocaleString() : 0}`}
              icon={IndianRupee}
              iconBgClass="bg-pink-500/10 border-pink-500/20"
              iconTextClass="text-pink-400"
              isDark={isDark}
            />
            <AdminStatCard
              title="Plan Completion Rate"
              value={`${completionRate}%`}
              icon={TrendingUp}
              iconBgClass="bg-emerald-500/10 border-emerald-500/20"
              iconTextClass="text-emerald-450"
              subtextContent="Confirmed / Active trips"
              isDark={isDark}
            />
          </div>

      {/* CHARTS CONTAINER CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: STATUS COUNTS */}
        <div className="premium-card rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className={`text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? 'text-slate-305' : 'text-slate-700'}`}>
              Trip Status Distributions
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 border rounded transition-colors ${
              isDark ? 'text-slate-500 bg-slate-900 border-slate-800' : 'text-slate-600 bg-slate-100 border-slate-200'
            }`}>
              Doughnut Ratio
            </span>
          </div>
          <div className="h-64 relative flex items-center justify-center">
            {analytics?.statusCounts && analytics.statusCounts.length > 0 ? (
              <Doughnut data={statusData} options={donutOptions} />
            ) : (
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No statistics available</span>
            )}
          </div>
        </div>

        {/* CHART 2: POPULAR DESTINATIONS */}
        <div className="premium-card rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className={`text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Top Destination Swarm Queries
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 border rounded transition-colors ${
              isDark ? 'text-slate-500 bg-slate-900 border-slate-800' : 'text-slate-600 bg-slate-100 border-slate-200'
            }`}>
              Bar Frequency
            </span>
          </div>
          <div className="h-64 relative">
            {analytics?.topDestinations && analytics.topDestinations.length > 0 ? (
              <Bar data={destinationData} options={chartOptions} />
            ) : (
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No statistics available</span>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & DATA TABLE CONTROLS */}
      <div className={`premium-card rounded-xl overflow-hidden shadow-xl border ${
        isDark ? 'border-card-border/80' : 'border-slate-200'
      }`}>
        {/* Table header with filters */}
        <div className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
          isDark ? 'border-card-border bg-slate-900/40' : 'border-slate-200 bg-slate-50'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
            isDark ? 'text-slate-300' : 'text-slate-800'
          }`}>
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
            Global Trip Operations Log
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search filter destination */}
            <div className="relative">
              <input
                type="text"
                value={searchDestination}
                onChange={(e) => {
                  setSearchDestination(e.target.value);
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs placeholder-slate-500 focus:outline-none focus:border-primary w-40 border transition-all ${
                  isDark ? 'bg-slate-850 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                }`}
                placeholder="Search Destination..."
              />
            </div>

            {/* Selection status */}
            <div className="flex items-center gap-1">
              <Filter className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={`border rounded-lg px-2 w-32 py-1.5 text-xs focus:outline-none focus:border-primary transition ${
                  isDark ? 'bg-slate-850 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PLANNED">Planned</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>        {/* Global Trip Records Table */}
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y text-left text-xs transition-colors ${
            isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'
          }`}>
            <thead className={`font-bold uppercase text-[10px] tracking-wider transition-colors ${
              isDark ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              <tr>
                <th className="px-6 py-4">Trip Session ID</th>
                <th className="px-6 py-4">Traveler Profile</th>
                <th className="px-6 py-4">Destination</th>
                <th className="px-6 py-4">Budget Cap</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Created At</th>
              </tr>
            </thead>
            <tbody className={`divide-y transition-colors ${
              isDark ? 'divide-slate-850 bg-slate-950/10' : 'divide-slate-200 bg-white'
            }`}>
              {tripsData?.trips && tripsData.trips.length > 0 ? (
                tripsData.trips.map((trip: TripItem) => {
                  const input = trip.input || {};
                  return (
                    <tr
                      key={trip.sessionId}
                      onClick={() => setSelectedTrip(trip)}
                      className={`transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/50'
                      }`}
                    >
                      <td className="px-6 py-4.5 font-mono text-slate-400 font-medium">
                        #{trip.sessionId.substring(0, 10)}
                      </td>
                      <td className="px-6 py-4.5">
                        <div className={`font-semibold transition-colors ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                          {trip.userId?.name || 'Anonymous Agent'}
                        </div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{trip.userId?.email || 'no-email'}</div>
                      </td>
                      <td className={`px-6 py-4.5 font-semibold transition-colors ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                        {input.destination || 'Not determined'}
                      </td>
                      <td className="px-6 py-4.5 font-semibold">
                        <div className={`font-bold transition-colors ${isDark ? 'text-slate-200' : 'text-slate-955'}`}>
                          ₹{input.budget_inr ? input.budget_inr.toLocaleString() : 'N/A'}
                        </div>
                        <div className={`text-[10px] mt-0.5 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          Est: {trip.budget?.total_cost_inr || trip.budget?.total_estimated_cost
                            ? `₹${(trip.budget?.total_cost_inr || trip.budget?.total_estimated_cost || 0).toLocaleString()}`
                            : 'N/A'}
                        </div>
                        {trip.booking?.refs?.amountPaid !== undefined && (
                          <div className="text-[10px] mt-0.5 font-bold text-indigo-400">
                            Paid: ₹{trip.booking.refs.amountPaid.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${trip.status === 'CONFIRMED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                              : trip.status === 'PLANNED'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                                : trip.status === 'CANCELLED'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/25'
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                            }`}
                        >
                          {trip.status}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right font-mono text-slate-550">
                        {new Date(trip.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No matching trip plans found for target query parameters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar controls */}
        {totalPages > 1 && (
          <div className={`p-4 border-t flex items-center justify-between transition-colors ${
            isDark ? 'bg-slate-900/30 border-card-border' : 'bg-slate-50 border-slate-205'
          }`}>
            <span className="text-xs text-slate-500">
              Showing Page {currentPage} of {totalPages} ({tripsData?.total || 0} items)
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                className={`border disabled:opacity-40 rounded px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                }`}
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                className={`border disabled:opacity-40 rounded px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Logs summary cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Terminal className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cached Logs</span>
                <span className="text-2xl font-extrabold">{logsData?.logs?.length || 0}</span>
              </div>
            </div>
            
            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Exceptions / Errors</span>
                <span className="text-2xl font-extrabold text-red-500">
                  {(logsData?.logs || []).filter((l: any) => (l.level || '').toLowerCase() === 'error').length}
                </span>
              </div>
            </div>

            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Filter className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Warnings</span>
                <span className="text-2xl font-extrabold text-amber-500">
                  {(logsData?.logs || []).filter((l: any) => ['warn', 'warning'].includes((l.level || '').toLowerCase())).length}
                </span>
              </div>
            </div>

            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450">
                <RefreshCw className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Normal Operations</span>
                <span className="text-2xl font-extrabold text-emerald-450">
                  {(logsData?.logs || []).filter((l: any) => (l.level || '').toLowerCase() === 'info').length}
                </span>
              </div>
            </div>
          </div>

          {/* Logs control filter bar */}
          <div className={`premium-card rounded-xl overflow-hidden shadow-xl border ${isDark ? 'border-card-border/80' : 'border-slate-200'}`}>
            <div className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
              isDark ? 'border-card-border bg-slate-900/40' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-primary animate-pulse" />
                <h3 className={`text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  Live AWS Swarm Console Pipe
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search query logs */}
                <div className="relative">
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs placeholder-slate-500 focus:outline-none focus:border-primary w-48 border transition-all ${
                      isDark ? 'bg-slate-850 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                    }`}
                    placeholder="Search logs metadata..."
                  />
                </div>

                {/* Selection level */}
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value)}
                  className={`border rounded-lg px-2 w-32 py-1.5 text-xs focus:outline-none focus:border-primary transition ${
                    isDark ? 'bg-slate-850 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  <option value="">All Log Levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="debug">Debug</option>
                </select>

                {/* Manual flush/reload */}
                <button
                  onClick={() => refetchLogs()}
                  className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-700/25 transition active:scale-95 cursor-pointer ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700 shadow-sm'
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* List logs screen console style layout */}
            <div className={`p-4 font-mono text-xs overflow-y-auto max-h-[550px] space-y-2 border-collapse transition-colors ${
              isDark ? 'bg-black/90 text-slate-300' : 'bg-slate-900 text-slate-200'
            }`}>
              {(() => {
                const filteredLogs = (logsData?.logs || []).filter((log: any) => {
                  const matchesLevel = logLevelFilter ? (log.level || '').toLowerCase() === logLevelFilter.toLowerCase() : true;
                  const matchesSearch = logSearchQuery
                    ? JSON.stringify(log).toLowerCase().includes(logSearchQuery.toLowerCase())
                    : true;
                  return matchesLevel && matchesSearch;
                });

                if (filteredLogs.length > 0) {
                  return filteredLogs.map((log: any, idx: number) => (
                    <LogConsoleItem
                      key={idx}
                      log={log}
                      isDark={isDark}
                    />
                  ));
                } else {
                  return (
                    <div className="text-center py-12 text-slate-500 font-semibold italic">
                      Console stream empty or no logs matching filter parameters
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queries' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Stats summary row for queries */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tickets</span>
                <span className="text-2xl font-extrabold">{queriesData?.queries?.length || 0}</span>
              </div>
            </div>

            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-550">
                <AlertCircle className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
                <span className="text-2xl font-extrabold text-amber-550">
                  {(queriesData?.queries || []).filter((q: any) => q.status === 'PENDING').length}
                </span>
              </div>
            </div>

            <div className="premium-card rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Resolved Tickets</span>
                <span className="text-2xl font-extrabold text-emerald-450">
                  {(queriesData?.queries || []).filter((q: any) => q.status === 'RESOLVED').length}
                </span>
              </div>
            </div>
          </div>

          {/* Ticket Table Card */}
          <div className={`premium-card rounded-xl overflow-hidden shadow-xl border ${isDark ? 'border-card-border/80' : 'border-slate-200'}`}>
            {/* Header section with filters */}
            <div className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
              isDark ? 'border-card-border bg-slate-900/40' : 'border-slate-200 bg-slate-50'
            }`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                isDark ? 'text-slate-350' : 'text-slate-800'
              }`}>
                <AlertCircle className="h-4.5 w-4.5 text-primary" />
                User Troubleshooting Operations Log
              </h3>

              <div className="flex items-center gap-3">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Filter by Status:</span>
                <select
                  value={queryStatusFilter}
                  onChange={(e) => setQueryStatusFilter(e.target.value)}
                  className={`border rounded-lg px-2 w-32 py-1.5 text-xs focus:outline-none focus:border-primary transition ${
                    isDark ? 'bg-slate-800 border-slate-750 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                
                <button
                  onClick={() => refetchQueries()}
                  className={`flex items-center gap-1 border rounded px-2.5 py-1 text-xs transition ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${queriesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Queries logs Table */}
            <div className="overflow-x-auto">
              <table className={`min-w-full divide-y text-left text-xs transition-colors ${
                isDark ? 'divide-slate-800/80 text-slate-300' : 'divide-slate-200 text-slate-700'
              }`}>
                <thead className={`font-bold uppercase text-[10px] tracking-wider transition-colors ${
                  isDark ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  <tr>
                    <th className="px-6 py-4">Ticket details</th>
                    <th className="px-6 py-4 flex items-center gap-1">Trip Session ID</th>
                    <th className="px-6 py-4">Message / Description</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Submitted At</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${
                  isDark ? 'divide-slate-850 bg-slate-950/10' : 'divide-slate-200 bg-white'
                }`}>
                  {queriesLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 font-medium animate-pulse">
                        Loading client queries...
                      </td>
                    </tr>
                  ) : queriesData?.queries && queriesData.queries.length > 0 ? (
                    queriesData.queries.map((q: any) => (
                      <tr key={q._id} className={isDark ? 'hover:bg-slate-800/15' : 'hover:bg-indigo-50/20'}>
                        <td className="px-6 py-4.5">
                          <div className="font-semibold text-slate-205">{q.email}</div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              q.category === 'PAYMENT'
                                ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                                : q.category === 'BOOKING'
                                ? 'bg-amber-500/10 text-amber-550 border border-amber-550/20'
                                : q.category === 'CALENDAR'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/25'
                            }`}>
                              {q.category === 'PAYMENT' && '💳 PAYMENT'}
                              {q.category === 'BOOKING' && '🏨 BOOKING'}
                              {q.category === 'CALENDAR' && '📅 CALENDAR'}
                              {q.category === 'OTHER' && '❓ OTHER'}
                            </span>
                            {q.paymentId && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-bold bg-rose-500/10 text-rose-450 border border-rose-500/20">
                                Transact: {q.paymentId}
                              </span>
                            )}
                            {q.amount !== undefined && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                                Amount: ₹{q.amount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4.5 font-mono">
                          {q.tripId ? (
                            <button
                              onClick={() => handleQueryTripClick(q.tripId)}
                              className="text-primary hover:underline hover:text-indigo-400 font-bold transition focus:outline-none cursor-pointer"
                            >
                              #{q.tripId.substring(0, 8)}...
                            </button>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">No ID</span>
                          )}
                        </td>
                        <td className="px-6 py-4.5 text-xs max-w-sm break-words whitespace-normal text-slate-400">
                          <p className={`font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q.message}</p>
                          {q.adminReply && (
                            <div className={`p-2.5 rounded-lg border text-[10.5px] mt-1.5 space-y-0.5 ${
                              isDark ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-805'
                            }`}>
                              <span className="font-bold block uppercase text-[8.5px] text-indigo-400">Resolution Reply:</span>
                              <p className="italic leading-normal">{q.adminReply}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            q.status === 'RESOLVED'
                              ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/25'
                              : 'bg-amber-500/10 text-amber-550 border border-amber-550/25 animate-pulse'
                          }`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-right font-mono text-slate-500">
                          {new Date(q.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          {q.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                setResolvingQuery({ 
                                  id: q._id, 
                                  email: q.email, 
                                  message: q.message,
                                  amount: q.amount,
                                  paymentId: q.paymentId,
                                  category: q.category
                                });
                                setAdminReplyText('');
                              }}
                              disabled={resolveQueryMutation.isPending}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-555 text-white font-bold text-[10.5px] cursor-pointer focus:outline-none hover:shadow active:scale-95 transition"
                            >
                              Resolve
                            </button>
                          ) : (
                            <span className="text-emerald-450 font-bold flex items-center justify-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Resolved
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 font-medium italic">
                        No troubleshoot tickets found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION REPLY MODAL */}
      {resolvingQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolveQueryMutation.mutate(
                { queryId: resolvingQuery.id, adminReply: adminReplyText },
                {
                  onSuccess: () => {
                    setResolvingQuery(null);
                    toast.success('Query resolved and passenger notification logged!');
                  }
                }
              );
            }}
            className={`rounded-2xl max-w-lg w-full p-6 mx-4 border shadow-2xl space-y-4 ${
              isDark ? 'bg-[#121824]/95 border-slate-800 text-slate-100' : 'bg-white border-slate-205 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Resolve Troubleshooter Request
                </h3>
                <p className="text-[10px] text-slate-450">Provide response resolution parameters for traveler</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-xs">
                  <span className="font-bold text-[9px] uppercase tracking-wider block text-slate-500 mb-0.5">Traveler Email</span>
                  <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{resolvingQuery.email}</p>
                </div>
                {resolvingQuery.category && (
                  <div className="text-xs">
                    <span className="font-bold text-[9px] uppercase tracking-wider block text-slate-500 mb-0.5">Category</span>
                    <span className="font-bold text-[10px] text-indigo-400 font-semibold">{resolvingQuery.category}</span>
                  </div>
                )}
              </div>

              {resolvingQuery.category === 'PAYMENT' && (
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800/40 pt-2.5">
                  {resolvingQuery.paymentId && (
                    <div className="text-xs">
                      <span className="font-bold text-[9px] uppercase tracking-wider block text-slate-500 mb-0.5">Razorpay Payment ID</span>
                      <p className="font-mono text-[10.5px] font-bold text-rose-400">{resolvingQuery.paymentId}</p>
                    </div>
                  )}
                  {resolvingQuery.amount !== undefined && (
                    <div className="text-xs">
                      <span className="font-bold text-[9px] uppercase tracking-wider block text-slate-500 mb-0.5">Amount Paid</span>
                      <p className="font-bold text-[11px] text-emerald-450">₹{resolvingQuery.amount}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs border-t border-slate-800/40 pt-2.5">
                <span className="font-bold text-[9px] uppercase tracking-wider block text-slate-500 mb-0.5">Issue Context</span>
                <blockquote className={`p-2.5 rounded-lg border italic max-h-24 overflow-y-auto leading-normal ${
                  isDark ? 'bg-slate-950/40 border-slate-800/80 text-slate-400' : 'bg-slate-50 border-slate-202 text-slate-650'
                }`}>
                  "{resolvingQuery.message}"
                </blockquote>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Resolution Reply / Notes
                </label>
                <textarea
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  placeholder="e.g., Verified payments. Trip status successfully updated to CONFIRMED. Google Calendar sync triggered."
                  rows={4}
                  className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary border transition-all ${
                    isDark
                      ? 'bg-slate-950/70 border-slate-800 text-slate-100'
                      : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
                  }`}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setResolvingQuery(null)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer border ${
                  isDark
                    ? 'bg-slate-850 hover:bg-slate-700 text-slate-300 border-transparent'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-250'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resolveQueryMutation.isPending}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {resolveQueryMutation.isPending && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                {resolveQueryMutation.isPending ? 'Saving...' : 'Confirm Resolution'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAILED TRIP PLAN DIALOG/MODAL (READONLY) */}
      {selectedTrip && (
        <TripDetailModal
          selectedTrip={selectedTrip}
          isDark={isDark}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}
