import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plane,
  Bot,
  IndianRupee,
  CalendarCheck,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface Slide {
  title: string;
  description: string;
  icon: any;
  color: string;
  feature: string;
  imgUrl?: string; // Fallback representation if local assets load asynchronously
}

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      title: 'Agentic Swarm Orchestration',
      description: 'VoyageFlow deploys a multi-agent swarm led by a supervisor. Specialist sub-agents concurrently fetch climate reports, accommodation options, transit routes, and local maps.',
      icon: Bot,
      color: 'from-blue-500/20 to-indigo-500/20 border-indigo-500/30',
      feature: 'Coordinator Swarm',
    },
    {
      title: 'Deterministic Budget safety checks',
      description: 'The Budget Agent evaluates overall costs against traveler thresholds. If estimates exceed the cap, planning halts to recommend actionable and cost-effective alternatives.',
      icon: IndianRupee,
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
      feature: 'Real-time Budget Enforcement',
    },
    {
      title: 'Google Calendar & Confirmation Sync',
      description: 'Human-in-the-loop (HITL) gates enable travelers to confirm booking references and auto-sync itineraries with Google Calendar for offline tracking.',
      icon: CalendarCheck,
      color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
      feature: 'Secure Booking Synced Integration',
    },
  ];

  // Auto scroll effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-dark-bg text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 select-none">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        
        {/* LEFT COLUMN: BRANDING AND USE CASES */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
              VoyageFlow AI Swarm v2.0
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1] sm:leading-none">
              Plan Travel Seamlessly via{' '}
              <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
                Collaborative Swarms
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl">
              VoyageFlow AI distributes planning variables to specialized autonomous agents. Enforce dynamic budgets, check weather, search transit routes, review interactive timelines, and confirm itineraries instantly.
            </p>
          </div>

          {/* PORTAL ENTRIES: TRAVELER VS ADMIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-205 flex items-center gap-1.5 mb-2">
                  <Plane className="h-4 w-4 text-primary" /> Traveler Workspace
                </h3>
                <p className="text-xs text-slate-450 leading-relaxed mb-4">
                  Define budget constraints, request dynamic destinations, inspect sub-agent reports, and auto-sync itineraries.
                </p>
              </div>
              <Link
                to="/login?role=traveler"
                className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-opacity-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition active:scale-98"
              >
                Launch Traveler Planner <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-indigo-405 flex items-center gap-1.5 mb-2">
                  <Shield className="h-4 w-4 text-indigo-400" /> Admin Console
                </h3>
                <p className="text-xs text-slate-450 leading-relaxed mb-4">
                  Review system parameters, analyze conversion rates, inspect agent performance metrics, and filter raw log records.
                </p>
              </div>
              <Link
                to="/login?role=admin"
                className="inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition active:scale-98"
              >
                Access Admin Portal <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* USE CASES ACCORDION ROW */}
          <div className="border-t border-slate-805 pt-6 grid grid-cols-3 gap-4 max-w-xl">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-[#7a80b0] uppercase">Integrations</span>
              <p className="text-xs font-semibold text-slate-200">AviationStack & OpenWeather</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-[#7a80b0] uppercase">Memory Cache</span>
              <p className="text-xs font-semibold text-slate-200">Redis & Long-term summary</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-[#7a80b0] uppercase">Security</span>
              <p className="text-xs font-semibold text-slate-200">JWT Sessions & httpOnly cookies</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AUTO-SLIDING FEATURE CAROUSEL */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center">
          <div className="w-full max-w-md premium-card rounded-3xl p-6 relative overflow-hidden shadow-2xl space-y-4">
            
            {/* Slide Header Indicator */}
            <div className="flex justify-between items-center text-xs border-b border-card-border pb-3.5">
              <span className="font-mono text-slate-500 font-bold uppercase">PREVIEWING FLOW</span>
              <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20">
                {currentSlide + 1} / {slides.length}
              </span>
            </div>

            {/* Slider Content */}
            <div className="h-64 flex flex-col justify-center relative overflow-hidden">
              {slides.map((slide, idx) => {
                const IconComponent = slide.icon;
                const isActive = idx === currentSlide;

                return (
                  <div
                    key={idx}
                    className={`absolute inset-0 flex flex-col justify-center text-center transition-all duration-700 ease-in-out ${
                      isActive
                        ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto'
                        : 'opacity-0 translate-x-12 scale-95 pointer-events-none'
                    }`}
                  >
                    {/* Visual Showcase Graphic Container */}
                    <div className={`mx-auto h-24 w-24 rounded-2xl bg-gradient-to-br ${slide.color} border flex items-center justify-center shadow-lg mb-4 glow-border`}>
                      <IconComponent className="h-10 w-10 text-slate-100" />
                    </div>

                    <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase mb-1">
                      {slide.feature}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                      {slide.title}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      {slide.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Slide Dots Selection */}
            <div className="flex justify-center gap-2 pt-2 border-t border-card-border">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide ? 'w-6 bg-primary' : 'w-2 bg-slate-800'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
