/**
 * Helpers for trip information extraction and city name normalization.
 */

export const cleanCityName = (value?: string): string | undefined => {
  if (!value) return undefined;
  const city = value
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\b(?:from|and|with|for|on|before|after|please|replan)\b.*$/i, '')
    .trim();

  if (!/[a-zA-Z]{2,}/.test(city)) return undefined;
  return city
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

export const extractExplicitReplanInput = (reason: string): { destination?: string; origin?: string } => {
  const destinationPatterns = [
    /\bdestination\s+(?:from\s+)?[a-zA-Z][a-zA-Z\s.'-]{1,50}?\s+to\s+([a-zA-Z][a-zA-Z\s.'-]{1,50})/i,
    /\b(?:change|update|set|switch)\s+(?:the\s+)?destination\s+(?:from\s+)?[a-zA-Z][a-zA-Z\s.'-]{1,50}?\s+to\s+([a-zA-Z][a-zA-Z\s.'-]{1,50})/i,
    /\b(?:change|update|set|switch)\s+(?:the\s+)?destination\s+(?:to|as|is)?\s+([a-zA-Z][a-zA-Z\s.'-]{1,50})/i,
    /\bdestination\s+(?:is|to|as)\s+([a-zA-Z][a-zA-Z\s.'-]{1,50})/i,
    /\b(?:go|travel|trip|plan)(?:ing)?\s+(?:to|for)\s+([a-zA-Z][a-zA-Z\s.'-]{1,50})/i,
  ];
  const originPatterns = [
    /\b(?:departure|depature|origin|from|starting\s+from|start\s+from)\s+(?:city\s+)?(?:is|to|as)?\s+([a-zA-Z][a-zA-Z\s.'-]{1,50})/i,
  ];

  const destination = cleanCityName(destinationPatterns.map((pattern) => reason.match(pattern)?.[1]).find(Boolean));
  const origin = cleanCityName(originPatterns.map((pattern) => reason.match(pattern)?.[1]).find(Boolean));

  return { destination, origin };
};

export const parseAndAdjustDates = (
  message: string,
  startDateStr?: string,
  endDateStr?: string
): { start_date?: string; end_date?: string; duration_days?: number } | null => {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const lower = message.toLowerCase();

  // Helper to format date
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. Matches absolute duration targets, e.g., "make it 5 days", "increase days to 6", "change duration to 4 days"
  const absoluteMatch = lower.match(/(?:increase|extend|change|reduce|modify|set)\s+(?:days?|duration|trip)\s+to\s+(\d+)\s*days?/i) ||
                        lower.match(/(?:make it|change to|want|plan a|for)\s+(\d+)\s+days?/i);
  if (absoluteMatch) {
    const x = parseInt(absoluteMatch[1], 10);
    if (x >= 1 && x <= 30) {
      const newEnd = new Date(start);
      newEnd.setDate(start.getDate() + (x - 1));
      return { start_date: startDateStr, end_date: formatDate(newEnd), duration_days: x };
    }
  }

  // 2. Matches relative duration increase, e.g., "increase 2 days", "add 3 days", "extend by 2 days"
  const increaseMatch = lower.match(/(?:increase|add|extend|prolong)\s*(?:by|the|duration\s+by|trip\s+by|for)?\s*(\d+)\s+days?/i);
  if (increaseMatch) {
    const y = parseInt(increaseMatch[1], 10);
    if (y > 0 && y <= 30) {
      const newEnd = new Date(end);
      newEnd.setDate(end.getDate() + y);
      const newDuration = Math.round((newEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return { start_date: startDateStr, end_date: formatDate(newEnd), duration_days: newDuration };
    }
  }

  // 3. Matches relative duration decrease, e.g., "reduce 1 day", "shorten by 2 days", "decrease 2 days"
  const reduceMatch = lower.match(/(?:reduce|shorten|decrease|subtract|less)\s*(?:by|the|duration\s+by|trip\s+by|for)?\s*(\d+)\s+days?/i);
  if (reduceMatch) {
    const z = parseInt(reduceMatch[1], 10);
    if (z > 0) {
      const newEnd = new Date(end);
      newEnd.setDate(end.getDate() - z);
      if (newEnd > start) {
        const newDuration = Math.round((newEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return { start_date: startDateStr, end_date: formatDate(newEnd), duration_days: newDuration };
      }
    }
  }

  return null;
};

