"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type TimePickerProps = {
  value: string; // "HH:mm" format
  onChange: (value: string) => void;
  className?: string;
};

const HOUR_PRESETS = [
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
];

const MINUTE_PRESETS = ["00", "15", "30", "45"];

export default function TimePicker({
  value,
  onChange,
  className = "",
}: TimePickerProps) {
  const [hours, minutes] = value ? value.split(":") : ["09", "00"];

  const [hourInput, setHourInput] = useState(hours || "09");
  const [minuteInput, setMinuteInput] = useState(minutes || "00");
  const [showHourDropdown, setShowHourDropdown] = useState(false);
  const [showMinuteDropdown, setShowMinuteDropdown] = useState(false);

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Sync with external value changes
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      if (h && h !== hourInput) setHourInput(h);
      if (m && m !== minuteInput) setMinuteInput(m);
    }
  }, [value]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hourRef.current && !hourRef.current.contains(e.target as Node)) {
        setShowHourDropdown(false);
      }
      if (minuteRef.current && !minuteRef.current.contains(e.target as Node)) {
        setShowMinuteDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatAndEmit = (h: string, m: string) => {
    // Pad with leading zeros
    const formattedHour = h.padStart(2, "0").slice(0, 2);
    const formattedMinute = m.padStart(2, "0").slice(0, 2);

    // Clamp values
    let hourNum = parseInt(formattedHour, 10);
    let minuteNum = parseInt(formattedMinute, 10);

    if (isNaN(hourNum)) hourNum = 9;
    if (isNaN(minuteNum)) minuteNum = 0;

    hourNum = Math.max(0, Math.min(23, hourNum));
    minuteNum = Math.max(0, Math.min(59, minuteNum));

    const finalHour = hourNum.toString().padStart(2, "0");
    const finalMinute = minuteNum.toString().padStart(2, "0");

    setHourInput(finalHour);
    setMinuteInput(finalMinute);
    onChange(`${finalHour}:${finalMinute}`);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHourInput(val);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinuteInput(val);
  };

  const handleHourBlur = () => {
    formatAndEmit(hourInput, minuteInput);
  };

  const handleMinuteBlur = () => {
    formatAndEmit(hourInput, minuteInput);
  };

  const selectHour = (h: string) => {
    setHourInput(h);
    setShowHourDropdown(false);
    formatAndEmit(h, minuteInput);
  };

  const selectMinute = (m: string) => {
    setMinuteInput(m);
    setShowMinuteDropdown(false);
    formatAndEmit(hourInput, m);
  };

  return (
    <div
      className={`inline-flex items-center gap-0.5 border border-slate-200 rounded-lg bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 ${className}`}
    >
      {/* Hour segment */}
      <div ref={hourRef} className="relative">
        <div className="flex items-center">
          <input
            type="text"
            inputMode="numeric"
            value={hourInput}
            onChange={handleHourChange}
            onBlur={handleHourBlur}
            onFocus={(e) => e.target.select()}
            className="w-8 text-center text-sm font-medium bg-transparent outline-none"
            maxLength={2}
            placeholder="09"
          />
          <button
            type="button"
            onClick={() => {
              setShowHourDropdown(!showHourDropdown);
              setShowMinuteDropdown(false);
            }}
            className="p-0.5 hover:bg-slate-100 rounded transition-colors"
          >
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>

        {/* Hour dropdown */}
        {showHourDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-[60px]">
            {Array.from({ length: 24 }, (_, i) =>
              i.toString().padStart(2, "0")
            ).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => selectHour(h)}
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-indigo-50 transition-colors ${
                  h === hourInput
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "text-slate-700"
                } ${HOUR_PRESETS.includes(h) ? "font-medium" : "text-slate-400"}`}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Colon separator */}
      <span className="text-slate-400 font-medium">:</span>

      {/* Minute segment */}
      <div ref={minuteRef} className="relative">
        <div className="flex items-center">
          <input
            type="text"
            inputMode="numeric"
            value={minuteInput}
            onChange={handleMinuteChange}
            onBlur={handleMinuteBlur}
            onFocus={(e) => e.target.select()}
            className="w-8 text-center text-sm font-medium bg-transparent outline-none"
            maxLength={2}
            placeholder="00"
          />
          <button
            type="button"
            onClick={() => {
              setShowMinuteDropdown(!showMinuteDropdown);
              setShowHourDropdown(false);
            }}
            className="p-0.5 hover:bg-slate-100 rounded transition-colors"
          >
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>

        {/* Minute dropdown */}
        {showMinuteDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-[60px]">
            {MINUTE_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMinute(m)}
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-indigo-50 transition-colors ${
                  m === minuteInput
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "text-slate-700"
                }`}
              >
                {m}
              </button>
            ))}
            <div className="border-t border-slate-100 my-1" />
            {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))
              .filter((m) => !MINUTE_PRESETS.includes(m))
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={`w-full px-3 py-1.5 text-sm text-left hover:bg-indigo-50 transition-colors text-slate-500 ${
                    m === minuteInput
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : ""
                  }`}
                >
                  {m}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
