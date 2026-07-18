// RazorpayModal — Multi-step booking confirmation modal with Razorpay Test Mode integration.
// Steps:
//   1. cost-summary  : Show hotel cost + transit cost + total, with two booking options
//   2. processing    : Loader while Razorpay checkout is open / payment verifying
//   3. confirmed     : Success card with booking refs, payment ID, and auto-calendar status

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  X,
  CreditCard,
  User,
  Hotel,
  Plane,
  Calendar,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tripService } from '../../services/tripService';

// Extend window for Razorpay script
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayModalProps {
  context: any;
  tripId: string;
  isDark: boolean;
  onSelfBook: () => void;           // User chose "I'll book myself"
  onRazorpaySuccess: (data: any) => void;  // Called after successful payment + server approval
  onClose: () => void;
}

type Step = 'cost-summary' | 'processing' | 'confirmed';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const RazorpayModal: React.FC<RazorpayModalProps> = ({
  context,
  tripId,
  isDark,
  onSelfBook,
  onRazorpaySuccess,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('cost-summary');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedRefs, setConfirmedRefs] = useState<any>(null);
  const [calendarSynced, setCalendarSynced] = useState<string | null>(null);
  const [calendarPending, setCalendarPending] = useState(false);

  // ─── Derived cost breakdowns from context ───────────────────────────────────
  const hotelName = (() => {
    if (context?.accommodation?.selected_category === 'skipped' ||
        context?.accommodation?.selected_hotel?.name === 'Self Arranged') {
      return 'Self Arranged';
    }
    return context?.accommodation?.selected_hotel?.name ||
           context?.accommodation?.recommended ||
           'Self Arranged';
  })();

  const hotelNights = (() => {
    const start = context?.input?.start_date;
    const end   = context?.input?.end_date;
    if (!start || !end) return 0;
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(1, diff);
  })();

  const hotelPricePerNight = context?.accommodation?.selected_hotel?.price_per_night_inr ||
                              context?.accommodation?.price_per_night || 0;
  const hotelTotal = context?.budget?.accommodation || hotelPricePerNight * hotelNights;

  const selectedTransport = context?.transport?.selected_option || context?.transport?.options?.[0];
  const transportName = selectedTransport
    ? `${selectedTransport.operator} (${selectedTransport.mode})`
    : 'Self Arranged';
  const transportTotal = context?.budget?.transport || selectedTransport?.cost_inr || 0;

  const totalAmount = context?.budget?.total_cost_inr || (hotelTotal + transportTotal);
  const isHotelSkipped = hotelName === 'Self Arranged';
  const isTransportSkipped = selectedTransport?.operator === 'Self Arranged' || !selectedTransport;

  // ─── Auto-sync calendar whenever confirmed refs arrive ───────────────────────
  useEffect(() => {
    if (step !== 'confirmed' || !tripId) return;

    const doCalendarSync = async () => {
      setCalendarPending(true);
      try {
        const syncRes = await tripService.syncCalendar(tripId);
        if (syncRes.success && syncRes.calendarEventId) {
          setCalendarSynced(syncRes.calendarEventId);
          toast.success('📅 Trip synced to Google Calendar!', { id: 'cal-sync' });
        }
      } catch {
        // Graceful — calendar may not be connected
      } finally {
        setCalendarPending(false);
      }
    };
    doCalendarSync();
  }, [step, tripId]);

  // ─── Handle Razorpay payment ─────────────────────────────────────────────────
  const handleRazorpayPayment = async () => {
    setIsProcessing(true);
    setStep('processing');

    try {
      // 1. Load Razorpay JS script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Razorpay checkout failed to load. Please check your internet connection.');
        setStep('cost-summary');
        setIsProcessing(false);
        return;
      }

      // 2. Create order on server — returns ONLY accommodation + transport amount
      const orderRes = await tripService.createRazorpayOrder(tripId);
      if (!orderRes.success || !orderRes.orderId) {
        const errMsg = orderRes.error || 'Failed to create payment order.';
        toast.error(errMsg);
        setStep('cost-summary');
        setIsProcessing(false);
        return;
      }

      // Store the server-computed bookable amount for display
      const billableAmount = orderRes.amount_inr || 0;

      // 3. Open Razorpay checkout widget — amount = bookable costs only
      const options = {
        key: orderRes.keyId,
        amount: Math.round(billableAmount * 100),  // paise (accommodation + transport only)
        currency: 'INR',
        name: 'TripPlanner AI',
        description: `Trip to ${context?.input?.destination || 'India'} — ${context?.input?.start_date} → ${context?.input?.end_date}`,
        image: 'https://razorpay.com/assets/razorpay-glyph.svg',
        order_id: orderRes.orderId,
        theme: { color: '#6366f1' },
        prefill: {
          name: 'Traveler',
          email: 'traveler@tripplanner.ai',
          contact: '9999999999',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'UPI / Google Pay / PhonePe',
                instruments: [
                  {
                    method: 'upi',
                  },
                ],
              },
            },
            sequence: ['block.upi', 'block.other'],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        // ── Success callback: verify signature server-side then approve trip ──
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            toast.loading('Verifying payment & confirming trip...', { id: 'rzp-verify' });
            const verifyRes = await tripService.verifyPaymentAndApprove(tripId, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('✅ Payment verified! Trip confirmed.', { id: 'rzp-verify' });

            // Store refs for the confirmed card
            const refs = verifyRes.bookingRefs || {};
            refs.razorpay_payment_id = response.razorpay_payment_id;
            setConfirmedRefs(refs);
            setStep('confirmed');
            onRazorpaySuccess(verifyRes);
          } catch (verifyErr: any) {
            toast.error(verifyErr?.response?.data?.message || 'Payment verification failed.', { id: 'rzp-verify' });
            setStep('cost-summary');
          }
          setIsProcessing(false);
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled.', { icon: '❌' });
            setStep('cost-summary');
            setIsProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Payment failed.');
      setStep('cost-summary');
      setIsProcessing(false);
    }
  };

  // ─── Handle self-booking (no payment) ────────────────────────────────────────
  const handleSelfBook = () => {
    onSelfBook();
    onClose();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn p-4">
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
        isDark
          ? 'bg-[#0d1117] border-slate-700/60'
          : 'bg-white border-slate-200'
      }`}>

        {/* Close button — only on cost-summary step */}
        {step === 'cost-summary' && (
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-1.5 rounded-lg transition hover:scale-110 cursor-pointer z-10 ${
              isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* ── STEP 1: Cost Summary & Booking Choice ─────────────────────────── */}
        {step === 'cost-summary' && (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
              }`}>
                <CreditCard className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  Confirm Booking Details
                </h3>
                <p className={`text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Review your choices before confirming
                </p>
              </div>
            </div>

            {/* Cost Breakdown: BOOKABLE section */}
            <div className={`rounded-xl border overflow-hidden ${
              isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              {/* Section header — what Razorpay charges */}
              <div className={`px-4 py-2 border-b flex items-center gap-2 ${
                isDark ? 'bg-indigo-950/40 border-slate-800' : 'bg-indigo-50/80 border-indigo-100'
              }`}>
                <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                  Charged via Razorpay
                </span>
              </div>

              {/* Hotel Row */}
              <div className={`flex items-start justify-between px-4 py-3 border-b ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  <Hotel className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <div>
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      🏨 Hotel / Accommodation
                    </p>
                    <p className={`text-[10.5px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isHotelSkipped ? 'Self Arranged (no charge)' : `${hotelName} · ${hotelNights} night${hotelNights !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isHotelSkipped ? (
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Self Arranged
                    </span>
                  ) : (
                    <span className={`text-xs font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      ₹{hotelTotal.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Transport Row */}
              <div className={`flex items-start justify-between px-4 py-3`}>
                <div className="flex items-start gap-2.5">
                  <Plane className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                  <div>
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      ✈️ Transit / Transport
                    </p>
                    <p className={`text-[10.5px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isTransportSkipped ? 'Self Arranged (no charge)' : `${transportName} — Round trip`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isTransportSkipped ? (
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Self Arranged
                    </span>
                  ) : (
                    <span className={`text-xs font-extrabold ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>
                      ₹{transportTotal.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Bookable subtotal */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-t ${
                isDark ? 'bg-indigo-950/30 border-slate-800' : 'bg-indigo-50/40 border-indigo-100'
              }`}>
                <span className={`text-[10.5px] font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  💳 Razorpay Charges (Hotel + Transport)
                </span>
                <span className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-indigo-900'}`}>
                  ₹{(hotelTotal + transportTotal).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Cost Breakdown: SELF-PAY section */}
            {context?.budget && (
              <div className={`rounded-xl border overflow-hidden ${
                isDark ? 'bg-slate-900/30 border-slate-800/60' : 'bg-slate-50/60 border-slate-200'
              }`}>
                <div className={`px-4 py-2 border-b flex items-center gap-2 ${
                  isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-100/80 border-slate-200'
                }`}>
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    You Pay Yourself (On Trip)
                  </span>
                </div>
                <div className={`px-4 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5`}>
                  <span className={`text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>🍜 Food & Dining</span>
                  <span className={`text-[10.5px] font-semibold text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    ₹{(context.budget.food || 0).toLocaleString()}
                  </span>
                  <span className={`text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>🎟️ Sightseeing</span>
                  <span className={`text-[10.5px] font-semibold text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    ₹{(context.budget.activities || 0).toLocaleString()}
                  </span>
                  <span className={`text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>🛺 Local Cabs</span>
                  <span className={`text-[10.5px] font-semibold text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    ₹{(context.budget.local_transport || 0).toLocaleString()}
                  </span>
                  <span className={`text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>🚨 Emergency Reserve</span>
                  <span className={`text-[10.5px] font-semibold text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    ₹{(context.budget.emergency_fund || 0).toLocaleString()}
                  </span>
                </div>
                <div className={`flex items-center justify-between px-4 py-2 border-t ${
                  isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-slate-100/40'
                }`}>
                  <span className={`text-[10.5px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Total Trip Estimate (all-in)
                  </span>
                  <span className={`text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    ₹{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Test mode notice */}
            <div className={`flex items-start gap-2 p-3 rounded-lg border text-[10.5px] ${
              isDark
                ? 'bg-amber-950/20 border-amber-700/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <span className="font-bold">Razorpay Test Mode — </span>
                No real money will be charged. Use test card{' '}
                <code className={`font-mono px-1 py-0.5 rounded text-[10px] ${
                  isDark ? 'bg-amber-900/40 text-amber-200' : 'bg-amber-100 text-amber-800'
                }`}>4111 1111 1111 1111</code>{' '}
                with CVV <code className={`font-mono px-1 py-0.5 rounded text-[10px] ${
                  isDark ? 'bg-amber-900/40 text-amber-200' : 'bg-amber-100 text-amber-800'
                }`}>123</code> and OTP <code className={`font-mono px-1 py-0.5 rounded text-[10px] ${
                  isDark ? 'bg-amber-900/40 text-amber-200' : 'bg-amber-100 text-amber-800'
                }`}>1234</code>.
              </div>
            </div>

            {/* Action Buttons — the key choice */}
            <div className="space-y-2.5 pt-1">
              {/* PRIMARY: Pay via Razorpay */}
              <button
                onClick={handleRazorpayPayment}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm transition active:scale-[0.98] shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50 select-none"
              >
                <CreditCard className="h-4.5 w-4.5" />
                <span>
                  Book Hotel + Transport — Pay ₹{(hotelTotal + transportTotal).toLocaleString()} via Razorpay
                </span>
              </button>

              {/* SECONDARY: Self-book */}
              <button
                onClick={handleSelfBook}
                disabled={isProcessing}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition active:scale-[0.98] cursor-pointer disabled:opacity-50 select-none ${
                  isDark
                    ? 'bg-slate-900/60 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                I'll book by myself (No payment — just confirm)
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Processing ────────────────────────────────────────────── */}
        {step === 'processing' && (
          <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[280px]">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center border animate-pulse ${
              isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
            }`}>
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Opening Razorpay Checkout...
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Complete your payment in the Razorpay window. Do not close this tab.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 3: Booking Confirmed ─────────────────────────────────────── */}
        {step === 'confirmed' && confirmedRefs && (
          <div className="p-6 space-y-5">
            {/* Success Header */}
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center border shadow-lg ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10'
                    : 'bg-emerald-50 border-emerald-200 shadow-emerald-100'
                }`}>
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                </div>
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  🎉 Booking Confirmed!
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Your trip to {context?.input?.destination || 'India'} is all set.
                </p>
              </div>
            </div>

            {/* Booking References */}
            <div className={`rounded-xl border space-y-0 overflow-hidden ${
              isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-1.5 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Booking References
              </p>

              {/* Hotel Ref */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Hotel className="h-3 w-3" /> Hotel
                </span>
                <code className={`text-[10.5px] font-bold font-mono px-2 py-0.5 rounded ${
                  isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {confirmedRefs.hotel || '—'}
                </code>
              </div>

              {/* Transport Ref */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Plane className="h-3 w-3" /> Transport
                </span>
                <code className={`text-[10.5px] font-bold font-mono px-2 py-0.5 rounded ${
                  isDark ? 'bg-slate-800 text-sky-400' : 'bg-sky-100 text-sky-800'
                }`}>
                  {confirmedRefs.transport || '—'}
                </code>
              </div>

              {/* Payment Ref */}
              {confirmedRefs.payment && confirmedRefs.payment !== 'SELF_BOOKED' && (
                <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <CreditCard className="h-3 w-3" /> Payment ID
                  </span>
                  <code className={`text-[10.5px] font-bold font-mono px-2 py-0.5 rounded max-w-[55%] truncate ${
                    isDark ? 'bg-slate-800 text-violet-400' : 'bg-violet-100 text-violet-800'
                  }`} title={confirmedRefs.razorpay_payment_id}>
                    {confirmedRefs.razorpay_payment_id || confirmedRefs.payment}
                  </code>
                </div>
              )}

              {/* Calendar Ref */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Calendar className="h-3 w-3" /> Google Calendar
                </span>
                <div className="flex items-center gap-1.5">
                  {calendarPending ? (
                    <span className={`text-[10.5px] flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
                    </span>
                  ) : calendarSynced ? (
                    <code className={`text-[10.5px] font-bold font-mono px-2 py-0.5 rounded max-w-[130px] truncate ${
                      isDark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-100 text-indigo-800'
                    }`} title={calendarSynced}>
                      ✅ Synced
                    </code>
                  ) : (
                    <span className={`text-[10.5px] px-2 py-0.5 rounded ${
                      isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'
                    }`}>
                      Pending (connect Google)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Security badge */}
            <div className={`flex items-center justify-center gap-1.5 text-[10px] ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Payment verified by Razorpay · HMAC-SHA256 secured
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              Done — View My Trip
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
