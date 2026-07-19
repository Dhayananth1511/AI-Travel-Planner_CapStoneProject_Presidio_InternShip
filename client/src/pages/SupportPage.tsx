import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { useSubmitQueryMutation, useMyQueriesQuery } from '../hooks/useQueries';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  AlertCircle,
  Phone,
  Mail,
  RefreshCw,
  CreditCard,
  Layers,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function SupportPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { user } = useAuthStore();
  const { data: myQueriesData, isLoading: queriesLoading, refetch: refetchMyQueries } = useMyQueriesQuery();
  const submitQueryMutation = useSubmitQueryMutation();

  // State
  const [supportCategory, setSupportCategory] = useState<'PAYMENT' | 'BOOKING' | 'CALENDAR' | 'OTHER' | ''>('');
  const [supportTripId, setSupportTripId] = useState('');
  const [supportPaymentId, setSupportPaymentId] = useState('');
  const [supportAmount, setSupportAmount] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  
  // Expanded FAQ accordion index
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Set email if logged in
  useEffect(() => {
    if (user?.email) {
      setSupportEmail(user.email);
    }
  }, [user]);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportEmail) {
      toast.error('Please enter your email address');
      return;
    }
    if (!supportCategory) {
      toast.error('Please select an issue category');
      return;
    }
    if (!supportMessage.trim()) {
      toast.error('Please describe your issue');
      return;
    }

    try {
      await submitQueryMutation.mutateAsync({
        email: supportEmail,
        category: supportCategory,
        tripId: supportTripId || undefined,
        paymentId: supportCategory === 'PAYMENT' ? (supportPaymentId || undefined) : undefined,
        amount: supportCategory === 'PAYMENT' && supportAmount ? Number(supportAmount) : undefined,
        message: supportMessage,
      });

      toast.success('Support ticket submitted successfully!');
      
      // Reset non-persisted input fields
      setSupportTripId('');
      setSupportPaymentId('');
      setSupportAmount('');
      setSupportMessage('');
      setSupportCategory('');
      
      // Refetch history
      refetchMyQueries();
    } catch {
      toast.error('Failed to submit support ticket.');
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'PAYMENT':
        return 'bg-rose-500/10 text-rose-450 border border-rose-500/20';
      case 'BOOKING':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'CALENDAR':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-550/25';
    }
  };

  const faqs = [
    {
      q: "Why is my payment showing confirmed but my trip is still 'Planned'?",
      a: "This sometimes happens if the payment portal verification webhook takes a few minutes to handshake. Submit a ticket with your Trip ID and Razorpay Payment ID, and our administrator will instantly flag the reservation as confirmed."
    },
    {
      q: "Where do I retrieve my Razorpay Payment ID?",
      a: "Your Razorpay transaction ID (starting with 'pay_') is sent via SMS/Email from Razorpay at the time of payment. It is also visible in your credit card/bank statement."
    },
    {
      q: "How do I sync my confirmed itineraries to Google Calendar?",
      a: "Once a booking changes to CONFIRMED, the calendar integration automatically synchronizes details to the Google account associated with the passenger email profile. If sync is delayed, register a support request below."
    }
  ];

  return (
    <div className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 min-h-[calc(100vh-4rem)] transition-colors duration-300 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      
      {/* Title Header */}
      <div>
        <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight glow-text mb-2 flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <HelpCircle className="h-7 w-7 text-primary" />
          Support & Troubleshooter Center
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Did payment references disappear or are you facing synchronization issues? Lodge an inquiry below, and administrators will inspect your booking details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Submit Ticket */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`premium-card rounded-2xl p-6 border shadow-lg space-y-6 transition-all ${
            isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div>
              <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <MessageSquare className="h-4.5 w-4.5 text-primary" />
                Submit a Support Query
              </h2>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-450' : 'text-slate-500'}`}>
                Complete this form and the admin team will research and reply directly within your portal.
              </p>
            </div>

            <form onSubmit={handleSupportSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Contact Email */}
                <div className="space-y-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Your Contact Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    disabled={!!user?.email}
                    placeholder="traveler@example.com"
                    className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary border transition-all ${
                      isDark
                        ? 'bg-slate-950/70 border-slate-800 text-slate-100 disabled:opacity-50'
                        : 'bg-slate-50 border-slate-200 text-slate-800 disabled:opacity-55 disabled:bg-slate-100 shadow-sm'
                    }`}
                    required
                  />
                </div>

                {/* Optional Trip Session ID */}
                <div className="space-y-1">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Trip Session ID <span className="text-[9px] lowercase font-normal text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={supportTripId}
                    onChange={(e) => setSupportTripId(e.target.value)}
                    placeholder="e.g. 248f0602..."
                    className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary border transition-all ${
                      isDark
                        ? 'bg-slate-950/70 border-slate-800 text-slate-100'
                        : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
                    }`}
                  />
                </div>
              </div>

              {/* Category picker */}
              <div className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Help Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['PAYMENT', 'BOOKING', 'CALENDAR', 'OTHER'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSupportCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                        supportCategory === cat
                          ? 'bg-indigo-500 border-indigo-500 text-white font-bold'
                          : isDark
                          ? 'bg-slate-952/70 border-slate-800 text-slate-400 hover:text-slate-200'
                          : 'bg-slate-50 border-slate-202 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {cat === 'PAYMENT' && '💳 Payment ID Verification'}
                      {cat === 'BOOKING' && '🏨 Booking Mismatch'}
                      {cat === 'CALENDAR' && '📅 Calendar Sync'}
                      {cat === 'OTHER' && '❓ Other Inquiry'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Payment ID & Amount details fields */}
              {supportCategory === 'PAYMENT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  <div className="space-y-1">
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                      Razorpay Payment ID
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-550">
                        <CreditCard className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="text"
                        value={supportPaymentId}
                        onChange={(e) => setSupportPaymentId(e.target.value)}
                        placeholder="e.g., pay_PkC8P41fPjQv1P"
                        className={`w-full rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary border transition-all ${
                          isDark
                            ? 'bg-slate-950/70 border-rose-500/30 text-slate-100'
                            : 'bg-slate-50 border-rose-200 text-slate-809 shadow-sm'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                      Amount Paid (INR / ₹)
                    </label>
                    <input
                      type="number"
                      value={supportAmount}
                      onChange={(e) => setSupportAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary border transition-all ${
                        isDark
                          ? 'bg-slate-950/70 border-rose-500/30 text-slate-100'
                          : 'bg-slate-50 border-rose-200 text-slate-809 shadow-sm'
                      }`}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Description Body */}
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Description of Problem / Request
                </label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Describe your request in detail. Provide any transaction data, booking descriptions, or error feedback received."
                  rows={4}
                  className={`w-full rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary border transition-all ${
                    isDark
                      ? 'bg-slate-950/70 border-slate-800 text-slate-100'
                      : 'bg-slate-50 border-slate-205 text-slate-800 shadow-sm'
                  }`}
                  required
                />
              </div>

              {/* Submit Action */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitQueryMutation.isPending}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    submitQueryMutation.isPending
                      ? 'bg-slate-650 cursor-not-allowed opacity-60'
                      : 'bg-indigo-650 hover:bg-opacity-95 shadow-md shadow-indigo-500/20'
                  }`}
                >
                  {submitQueryMutation.isPending && (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  )}
                  {submitQueryMutation.isPending ? 'Filing query...' : 'Lodge support ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Info Helpline & FAQ */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Customer Hotline Contact Info */}
          <div className={`premium-card rounded-2xl p-6 border shadow-lg space-y-5 transition-all text-left ${
            isDark ? 'bg-gradient-to-br from-indigo-950/20 to-slate-900/30 border-indigo-500/10' : 'bg-gradient-to-br from-indigo-50/50 to-white border-slate-200'
          }`}>
            <div>
              <h2 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 uppercase tracking-wider">
                Direct Customer Helpline
              </h2>
              <p className={`text-[11px] mt-1 leading-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Have urgent verification questions? Reach our verification agents directly via hotlines.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Phone className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>Telephone Helpline</span>
                  <a href="tel:1***-***-**0" className="text-xs font-bold text-primary hover:underline">1***-***-**0</a>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-450">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>Email Support</span>
                  <a href="mailto:ad***@tripplanner.ai" className="text-xs font-bold text-emerald-450 hover:underline">ad***@tripplanner.ai</a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick FAQ Component */}
          <div className={`premium-card rounded-2xl p-6 border shadow-lg space-y-4 transition-all ${
            isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-202'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-350' : 'text-slate-600'}`}>
              Frequently Asked Questions
            </h3>
            <div className="space-y-3.5">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-slate-800/40 last:border-b-0 pb-3 last:pb-0">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className="w-full flex justify-between items-center text-left py-1 text-xs font-bold text-slate-300 hover:text-slate-100 transition focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    {expandedFaq === idx ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                  </button>
                  {expandedFaq === idx && (
                    <p className="mt-2 text-xs leading-normal text-slate-400 pl-1 animate-fadeIn">
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket History Section */}
      <div className={`premium-card rounded-2xl border shadow-xl overflow-hidden transition-all ${
        isDark ? 'bg-slate-900/10 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
        }`}>
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <Layers className="h-4.5 w-4.5 text-primary" />
              Lodge Requests History & Resolutions
            </h3>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Check the status and administrator responses to your queries
            </p>
          </div>
          
          {user && (
            <button
              onClick={() => refetchMyQueries()}
              className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-750 transition active:scale-95 cursor-pointer ${
                isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${queriesLoading ? 'animate-spin' : ''}`} />
              Refresh History
            </button>
          )}
        </div>

        <div className="p-6">
          {!user ? (
            <div className="text-center py-8 text-slate-400 italic">
              Please <a href="/login" className="text-primary underline font-semibold">Sign In</a> to view your past troubleshooting tickets and replies.
            </div>
          ) : queriesLoading ? (
            <div className="text-center py-8 text-slate-550 animate-pulse font-medium">
              Retrieving your support history...
            </div>
          ) : myQueriesData?.queries && myQueriesData.queries.length > 0 ? (
            <div className="space-y-4">
              {myQueriesData.queries.map((q: any) => (
                <div
                  key={q._id}
                  className={`border rounded-xl p-4 transition-all opacity-100 flex flex-col gap-3.5 ${
                    isDark ? 'bg-slate-950/20 border-slate-800/80 hover:border-slate-700/60' : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top info and status line */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-extrabold uppercase ${getCategoryBadgeClass(q.category)}`}>
                        {q.category === 'PAYMENT' && '💳 PAYMENT'}
                        {q.category === 'BOOKING' && '🏨 BOOKING'}
                        {q.category === 'CALENDAR' && '📅 CALENDAR'}
                        {q.category === 'OTHER' && '❓ OTHER'}
                      </span>
                      {q.tripId && (
                        <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>
                          Trip ID: #{q.tripId.slice(0, 10)}...
                        </span>
                      )}
                      {q.paymentId && (
                        <span className="text-[10.5px] font-mono bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded px-1.5 py-0.5 font-bold">
                          Transact: {q.paymentId}
                        </span>
                      )}
                      {q.amount !== undefined && (
                        <span className="text-[10.5px] font-mono bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 rounded px-1.5 py-0.5 font-bold">
                          Amount: ₹{q.amount}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-550' : 'text-slate-500'}`}>
                        {new Date(q.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        q.status === 'RESOLVED'
                          ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/35'
                          : 'bg-amber-500/10 text-amber-550 border border-amber-550/35 animate-pulse'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                  </div>

                  {/* Body description */}
                  <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="font-semibold block text-[10px] uppercase text-slate-500 mb-1">Issue Details</span>
                    <p className="leading-relaxed bg-slate-950/10 p-3 rounded-lg border border-slate-800/20">{q.message}</p>
                  </div>

                  {/* Admin Reply resolution block */}
                  {q.status === 'RESOLVED' && (
                    <div className={`text-xs p-3.5 rounded-xl border flex flex-col gap-1.5 ${
                      isDark ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50/40 border-indigo-100/50'
                    }`}>
                      <span className="font-bold flex items-center gap-1 text-[10px] uppercase text-indigo-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Administrator Resolution Response
                      </span>
                      <p className={`leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {q.adminReply || 'This issue has been marked resolved by our verification operations team.'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 italic bg-slate-950/10 rounded-xl border border-slate-800/10">
              You haven't filed any support queries yet.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
