"use client";

import Link from "next/link";
import { ArrowLeft, Flower2, Ticket } from "lucide-react";

export default function RewardsHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-32">
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Tilbake til hjem"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <div className="text-right">
            <p className="text-sm text-gray-500">Belønninger</p>
            <h1 className="text-2xl font-bold text-gray-900">
              Mine Premier 🏆
            </h1>
          </div>
        </div>

        {/* Rewards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Garden Card */}
          <Link href="/belonninger/hage">
            <div className="group bg-gradient-to-br from-pink-50 via-white to-green-50 border-2 border-pink-200 hover:border-pink-300 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-pink-100 to-green-100 rounded-xl group-hover:scale-110 transition-transform">
                  <Flower2 className="h-8 w-8 text-pink-600" />
                </div>
                <span className="text-xs font-semibold text-pink-700 bg-pink-100 px-3 py-1 rounded-full">
                  Aktiv
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Min Blomsterhage 🌸
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Se samlingen din og fargelegg nye blomster. Fullfør oppgaver for
                å samle kronblader.
              </p>
              <div className="mt-6 flex items-center text-sm font-semibold text-pink-600 group-hover:text-pink-700">
                Gå til hagen
                <svg
                  className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>

          {/* Coupons Card - Coming Soon */}
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 shadow-md opacity-60 cursor-not-allowed">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gray-200 rounded-xl">
                <Ticket className="h-8 w-8 text-gray-400" />
              </div>
              <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                Kommer snart
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">
              Mine Kuponger 🎫
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Her kommer belønninger som Utetime og Uno. Få kuponger ved å
              fullføre oppgaver og samlinger.
            </p>
            <div className="mt-6 flex items-center text-sm font-semibold text-gray-400">
              Kommer snart
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
