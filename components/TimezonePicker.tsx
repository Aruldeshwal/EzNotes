'use client';

import React from 'react';

interface TimezonePickerProps {
  value: string; // UTC ISO string or empty
  onChange: (utcIso: string) => void;
}

/**
 * Expiration picker per architecture.md §8 and ADR-006:
 * Displays and accepts IST (UTC+5:30); converts to UTC ISO string before updating state/submitting.
 */
export const TimezonePicker: React.FC<TimezonePickerProps> = ({ value, onChange }) => {
  // Convert UTC ISO string to IST local datetime-local string (YYYY-MM-DDTHH:mm)
  const getIstString = (utcString: string): string => {
    if (!utcString) return '';
    const date = new Date(utcString);
    if (isNaN(date.getTime())) return '';
    // IST is UTC + 5 hours 30 mins (330 mins)
    const istDate = new Date(date.getTime() + 330 * 60 * 1000);
    return istDate.toISOString().slice(0, 16);
  };

  const handleIstChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const istVal = e.target.value;
    if (!istVal) {
      onChange('');
      return;
    }
    // Parse IST input and convert to UTC
    const istDate = new Date(istVal);
    const utcDate = new Date(istDate.getTime() - 330 * 60 * 1000);
    onChange(utcDate.toISOString());
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Expiry Date & Time (IST — UTC+5:30)
      </label>
      <input
        type="datetime-local"
        value={getIstString(value)}
        onChange={handleIstChange}
        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
      />
      <p className="text-xs text-slate-400">
        Displayed in Indian Standard Time (IST). Stored in UTC.
      </p>
    </div>
  );
};
