'use client'

import { useState } from 'react';
import { Menu, X, Calendar, Home, Award, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'Dagen i dag', icon: <Home size={20} /> },
    { name: 'Timeplan', icon: <Calendar size={20} /> },
    { name: 'Ukebrev', icon: <FileText size={20} /> },
    { name: 'Belønninger', icon: <Award size={20} /> },
  ];

  return (
    <>
      {/* Hamburger Ikon */}
      <button 
        onClick={() => setIsOpen(true)} 
        className="fixed top-4 left-4 z-40 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-800"
      >
        <Menu size={24} />
      </button>

      {/* Mørk bakgrunn (Overlay) når menyen er åpen */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Selve menyen (Drawer) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-64 z-50 bg-white shadow-xl p-6"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-blue-600">Klar</h2>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={24} />
              </button>
            </div>

            <nav className="space-y-4">
              {menuItems.map((item) => (
                <div 
                  key={item.name} 
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors text-gray-700 hover:text-blue-700"
                >
                  {item.icon}
                  <span className="font-medium">{item.name}</span>
                </div>
              ))}
            </nav>
            
            <div className="absolute bottom-8 left-6 right-6">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                 <span className="text-2xl">🐎</span>
                 <p className="text-sm text-gray-500 mt-2">Nivå 3</p>
                 {/* Her skal progressbaren komme senere */}
                 <div className="w-full bg-gray-200 h-2 rounded-full mt-1">
                    <div className="bg-blue-500 h-2 rounded-full w-1/3"></div>
                 </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}