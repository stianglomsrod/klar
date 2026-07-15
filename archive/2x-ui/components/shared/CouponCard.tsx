"use client";

import { motion } from "framer-motion";
import { Calendar, Lock } from "lucide-react";

type CouponCardProps = {
  title: string;
  description?: string;
  emoji?: string;
  isRedeemed: boolean;
  isLocked?: boolean;
  lockedLevel?: number;
  dateEarned: string;
  onRedeem?: () => void;
};

export default function CouponCard({
  title,
  description,
  emoji = "🎁",
  isRedeemed,
  isLocked = false,
  lockedLevel,
  dateEarned,
  onRedeem,
}: CouponCardProps) {
  const formattedDate = new Date(dateEarned).toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl overflow-hidden transition-all ${
        isLocked
          ? "bg-gray-200 opacity-70 shadow-lg"
          : isRedeemed
            ? "bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 opacity-90"
            : "bg-gradient-to-br from-yellow-100 via-orange-100 to-pink-100 shadow-lg hover:shadow-xl hover:scale-[1.02]"
      }`}
    >
      {/* Ticket perforations - top and bottom */}
      <div className="absolute inset-x-0 top-0 h-4 flex justify-around items-center">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={`top-${i}`}
            className={`w-2 h-2 rounded-full ${
              isLocked
                ? "bg-gray-300"
                : isRedeemed
                  ? "bg-white/30"
                  : "bg-white/40"
            }`}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-4 flex justify-around items-center">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={`bottom-${i}`}
            className={`w-2 h-2 rounded-full ${
              isLocked
                ? "bg-gray-300"
                : isRedeemed
                  ? "bg-white/30"
                  : "bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* Locked overlay */}
      {isLocked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2">
          <div className="bg-white/90 rounded-2xl px-5 py-3 shadow-md flex flex-col items-center gap-1">
            <Lock className="w-8 h-8 text-gray-500" />
            <p className="text-sm font-bold text-gray-600">Låst</p>
            {lockedLevel && (
              <p className="text-xs text-gray-500">
                Krever level {lockedLevel}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Redeemed — no stamp, just a subtle ribbon */}

      {/* Card content */}
      <div className="p-6 pt-8 pb-8 relative">
        {/* Emoji */}
        <div className="text-5xl mb-3 text-center">{emoji}</div>

        {/* Title */}
        <h3
          className={`text-xl font-bold text-center mb-2 ${
            isLocked ? "text-gray-600" : "text-gray-900"
          }`}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p
            className={`text-sm text-center mb-4 ${
              isLocked ? "text-gray-500" : "text-gray-700"
            }`}
          >
            {description}
          </p>
        )}

        {/* Date */}
        <div
          className={`flex items-center justify-center gap-2 text-xs ${
            isLocked ? "text-gray-500" : "text-gray-600"
          } mb-4`}
        >
          <Calendar className="w-3 h-3" />
          <span>Oppnådd: {formattedDate}</span>
        </div>

        {/* Action button or redeemed/locked indicator */}
        {isLocked ? (
          <div className="w-full bg-gray-300 text-gray-500 font-bold py-3 px-6 rounded-xl text-center cursor-not-allowed">
            Låst
          </div>
        ) : !isRedeemed ? (
          <button
            onClick={onRedeem}
            className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            Bruk kupong
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-base">✅</span>
            <span className="text-sm font-semibold text-emerald-700">
              Innløst
            </span>
          </div>
        )}
      </div>

      {/* Dashed border effect */}
      <div
        className={`absolute inset-0 border-2 border-dashed rounded-2xl pointer-events-none ${
          isLocked
            ? "border-gray-400"
            : isRedeemed
              ? "border-orange-200"
              : "border-orange-300"
        }`}
        style={{ margin: "4px" }}
      />
    </motion.div>
  );
}
