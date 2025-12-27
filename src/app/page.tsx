import WelcomeOverlay from '@/components/WelcomeOverlay';
import Sidebar from '@/components/Sidebar';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* 1. Velkomst-ritualet (Overlay) */}
      <WelcomeOverlay />

      {/* 2. Navigasjon */}
      <Sidebar />

      {/* 3. Innholdet på siden */}
      <div className="pt-20 px-4 max-w-md mx-auto space-y-6">
        
        {/* Overskrift */}
        <header>
          <h1 className="text-3xl font-bold text-gray-800">Dagen i dag</h1>
          <p className="text-gray-500">Tirsdag 27. desember</p>
        </header>

        {/* Timeplan-kort (Placeholder for neste steg) */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div>
               <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Akkurat nå</h3>
               <h2 className="text-2xl font-bold text-blue-600">2. Time: Matte</h2>
            </div>
            {/* Her skal Time-Timeren (Sirkelen) komme */}
            <div className="w-12 h-12 rounded-full border-4 border-red-500 flex items-center justify-center font-bold text-red-500">
              15m
            </div>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-red-500 h-full w-3/4"></div>
          </div>
        </section>

        {/* Oppgaver (Placeholder) */}
        <section>
          <h3 className="font-bold text-lg mb-3 ml-1">Mine Gjøremål</h3>
          <div className="space-y-3">
            {/* Eksempel oppgavekort */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                 <div>
                   <p className="font-medium">Gjør ferdig matteark</p>
                   <div className="flex items-center text-xs text-gray-400 mt-1 space-x-2">
                     <span>⏱️ 15 min</span>
                     <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">10 poeng</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}