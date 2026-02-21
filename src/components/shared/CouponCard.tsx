"use client";

import { motion } from "framer-motion";
import { Calendar, Check, Lock } from "lucide-react";

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
      className={`relative rounded-2xl overflow-hidden shadow-lg transition-all ${
        isLocked
          ? "bg-gray-200 opacity-70"
          : isRedeemed
            ? "bg-gray-200 opacity-75"
            : "bg-gradient-to-br from-yellow-100 via-orange-100 to-pink-100 hover:shadow-xl hover:scale-[1.02]"
      }`}
    >
      {/* Ticket perforations - top and bottom */}
      <div className="absolute inset-x-0 top-0 h-4 flex justify-around items-center">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={`top-${i}`}
            className={`w-2 h-2 rounded-full ${
              isLocked || isRedeemed ? "bg-gray-300" : "bg-white/40"
            }`}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-4 flex justify-around items-center">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={`bottom-${i}`}
            className={`w-2 h-2 rounded-full ${
              isLocked || isRedeemed ? "bg-gray-300" : "bg-white/40"
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

      {/* Redeemed stamp */}
      {isRedeemed && !isLocked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] z-10">
          <div className="border-4 border-red-600 rounded-lg px-6 py-3 bg-white/80">
            <p className="text-3xl font-black text-red-600 tracking-wider">
              BRUKT
            </p>
          </div>
        </div>
      )}

      {/* Card content */}
      <div className="p-6 pt-8 pb-8 relative">
        {/* Emoji */}
        <div className="text-5xl mb-3 text-center">{emoji}</div>

        {/* Title */}
        <h3
          className={`text-xl font-bold text-center mb-2 ${
            isLocked || isRedeemed ? "text-gray-600" : "text-gray-900"
          }`}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p
            className={`text-sm text-center mb-4 ${
              isLocked || isRedeemed ? "text-gray-500" : "text-gray-700"
            }`}
          >
            {description}
          </p>
        )}

        {/* Date */}
        <div
          className={`flex items-center justify-center gap-2 text-xs ${
            isLocked || isRedeemed ? "text-gray-500" : "text-gray-600"
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
          <div className="flex items-center justify-center gap-2 text-gray-500 font-semibold">
            <Check className="w-5 h-5" />
            <span>Brukt</span>
          </div>
        )}
      </div>

      {/* Dashed border effect */}
      <div
        className={`absolute inset-0 border-2 border-dashed rounded-2xl pointer-events-none ${
          isLocked || isRedeemed ? "border-gray-400" : "border-orange-300"
        }`}
        style={{ margin: "4px" }}
      />
    </motion.div>
  );
}
