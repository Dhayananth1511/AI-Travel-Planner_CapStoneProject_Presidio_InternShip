import React from 'react';
import { Send, Clock, Car, Check, Loader2 } from 'lucide-react';

interface TransportOption {
  mode: string;
  operator: string;
  cost_inr: number;
  cost_per_traveler: number;
  duration_hrs: number;
  departure?: string;
  arrival?: string;
  data_source?: string;
  amenities?: string[];
}

interface TransportData {
  options?: TransportOption[];
  best_option?: string;
  estimated_cost_inr?: number;
  selected_option?: {
    operator: string;
    mode: string;
  };
  reasoning?: string;
}

interface TransportOptionsCardProps {
  transport: TransportData;
  status: string;
  isDark: boolean;
  isSaving: boolean;
  handleSelectTransport: (operator: string, mode: string) => void;
}

export const TransportOptionsCard: React.FC<TransportOptionsCardProps> = ({
  transport,
  status,
  isDark,
  isSaving,
  handleSelectTransport,
}) => {
  return (
    <div className={`p-3 rounded-lg border text-xs space-y-3 transition-colors ${
      isDark ? 'bg-indigo-950/20 border-slate-800' : 'bg-slate-50 border-slate-205'
    }`}>
      {status !== 'CONFIRMED' && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSelectTransport('Self Arranged', 'skipped')}
          className={`w-full mb-2.5 py-1.5 rounded-lg text-[10.5px] font-bold border transition text-center flex items-center justify-center gap-1 select-none cursor-pointer ${
            transport.selected_option?.operator === 'Self Arranged'
              ? isDark
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-800'
              : isDark
                ? 'bg-slate-900/55 hover:bg-amber-500/10 border-slate-800 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
                : 'bg-white hover:bg-amber-50/55 border-slate-205 text-slate-505 hover:text-amber-850 hover:border-amber-250'
          }`}
        >
          {transport.selected_option?.operator === 'Self Arranged' ? (
            <>
              <Check className="h-3 w-3 text-amber-500 animate-fadeIn" /> Skipped: Arranging Transit Myself
            </>
          ) : (
            'Skip Transit (Arrange commuter travel myself)'
          )}
        </button>
      )}

      {Array.isArray(transport.options) && transport.options.length > 0 ? (
        <div className="space-y-3">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            ✈️ Transit Options & Comparisons
          </p>
          <div className="flex flex-col gap-2.5">
            {transport.options.map((option, idx) => {
              const optionsList = transport.options || [];
              const cheapestOption = optionsList.reduce((lowest, curr) => curr.cost_inr < lowest.cost_inr ? curr : lowest, optionsList[0]);
              const fastestOption = optionsList.reduce((fastest, curr) => curr.duration_hrs < fastest.duration_hrs ? curr : fastest, optionsList[0]);

              const isCheapest = option.cost_inr === cheapestOption.cost_inr;
              const isFastest = option.duration_hrs === fastestOption.duration_hrs;

              const renderModeIcon = (mode: string) => {
                const icStyle = "h-4 w-4 shrink-0 mt-0.5";
                if (mode.toLowerCase() === 'flight') return <Send className={`${icStyle} text-sky-400`} />;
                if (mode.toLowerCase() === 'train') return <Clock className={`${icStyle} text-teal-400`} />;
                if (mode.toLowerCase() === 'transfer') return <Car className={`${icStyle} text-emerald-450`} />;
                return <Car className={`${icStyle} text-amber-500`} />;
              };

              const getModeLabelPrefix = (mode: string) => {
                if (mode.toLowerCase() === 'flight') return '🛫 Flight';
                if (mode.toLowerCase() === 'train') return '🚆 Train';
                if (mode.toLowerCase() === 'transfer') return '🚗 Private Transfer';
                return '🚌 Intercity Bus';
              };

              const isSelected = transport.selected_option && 
                transport.selected_option.operator === option.operator && 
                transport.selected_option.mode === option.mode;
              const isCurrentlyActive = isSelected || (!transport.selected_option && idx === 0);
              const isLiveFlightSchedule = option.data_source === 'live_schedule_estimated_fare';
              const isEstimatedFlight = option.data_source === 'estimated_fallback';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition flex flex-col gap-2.5 ${
                    isCurrentlyActive
                      ? isDark
                        ? 'bg-indigo-955/20 border-primary shadow-md shadow-primary/5'
                        : 'bg-indigo-50/40 border-indigo-400 shadow-md shadow-indigo-100/30'
                      : isDark
                      ? 'bg-slate-900/40 border-slate-850 hover:border-slate-700'
                      : 'bg-white border-slate-205 hover:border-slate-350'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                      {renderModeIcon(option.mode)}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 font-sans">
                          <span className={`font-bold text-xs ${isDark ? 'text-slate-205' : 'text-slate-900'}`}>
                            {getModeLabelPrefix(option.mode)}: {option.operator}
                          </span>

                          {/* Badges */}
                          {isCurrentlyActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white leading-none flex items-center gap-0.5 animate-fadeIn">
                              <Check className="h-2.5 w-2.5" /> Selected
                            </span>
                          )}
                          {isCheapest && !isCurrentlyActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 leading-none">
                              Cheapest
                            </span>
                          )}
                          {isFastest && !isCurrentlyActive && (!isCheapest || optionsList.length > 1) && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 leading-none">
                              Fastest
                            </span>
                          )}
                          {option.mode?.toLowerCase() === 'flight' && isLiveFlightSchedule && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 leading-none">
                              Live schedule
                            </span>
                          )}
                          {option.mode?.toLowerCase() === 'flight' && isEstimatedFlight && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 leading-none">
                              Estimated
                            </span>
                          )}
                        </div>

                        <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Schedule: <span className="font-bold">{option.departure || 'N/A'}</span> ➔ <span className="font-bold">{option.arrival || 'N/A'}</span>
                        </div>
                        
                        <div className={`text-[9.5px] ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                          Duration: <span className="font-bold">{option.duration_hrs} hrs</span>
                        </div>
                        {option.mode?.toLowerCase() === 'flight' && (
                          <div className={`text-[9.5px] ${isDark ? 'text-slate-400' : 'text-slate-505'}`}>
                            Source: <span className="font-bold">{isLiveFlightSchedule ? 'Live schedule + estimated fare' : 'Estimated fallback data'}</span>
                          </div>
                        )}
                        {Array.isArray(option.amenities) && option.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {option.amenities.slice(0, 3).map((am, amIdx) => (
                              <span key={amIdx} className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${isDark ? 'bg-slate-955/40 border-slate-805 text-slate-405' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                {am}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <p className="text-xs font-bold text-emerald-500">
                        ₹{(option.cost_inr || 0).toLocaleString()}
                      </p>
                      <p className={`text-[9px] font-normal ${isDark ? 'text-slate-450' : 'text-slate-400'}`}>
                        ₹{(option.cost_per_traveler || 0).toLocaleString()} each
                      </p>
                    </div>
                  </div>

                  {/* Choose Option Button */}
                  {!isCurrentlyActive && status !== 'CONFIRMED' && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSelectTransport(option.operator, option.mode)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold border transition text-center flex items-center justify-center gap-1 cursor-pointer select-none ${
                        isDark
                          ? 'bg-indigo-950/40 hover:bg-primary/20 border-indigo-900/40 text-indigo-300 hover:text-white'
                          : 'bg-indigo-50/50 hover:bg-primary/10 border-indigo-200 text-indigo-700 hover:text-indigo-805'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Selecting Transit...
                        </>
                      ) : (
                        'Choose Option'
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {transport.best_option && (
            <p className={isDark ? 'text-slate-350' : 'text-slate-700'}>
              🛫 **Best Option**: {transport.best_option}
            </p>
          )}
          {transport.estimated_cost_inr && (
            <p className={isDark ? 'text-emerald-440 font-semibold' : 'text-emerald-700 font-bold'}>
              Estimated Price: ₹{(transport.estimated_cost_inr || 0).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
};
