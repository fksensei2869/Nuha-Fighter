/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Game from './components/Game';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background City Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <img 
          src="https://picsum.photos/seed/cyberpunk-city/1920/1080?blur=2" 
          alt="City Background" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mb-12 text-center relative group">
        {/* Blue Glow Line */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-1 bg-cyan-400 blur-md opacity-50 shadow-[0_0_20px_rgba(34,211,238,0.8)] z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[2px] bg-white opacity-80 z-0" />

        <div className="relative z-10">
          <h1 className="text-7xl sm:text-9xl font-black italic uppercase tracking-tighter leading-none select-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-yellow-700 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              Nuha
            </span>
            <span className="mx-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-yellow-700 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              Fighter
            </span>
          </h1>
          
          {/* 2D Label */}
          <div className="mt-2">
            <span className="text-4xl sm:text-6xl font-black text-red-600 italic uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              2D
            </span>
          </div>
        </div>

        {/* Character Illustration Placeholder (Subtle) */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-48 opacity-10 pointer-events-none">
          <img 
            src="https://picsum.photos/seed/warrior/400/400" 
            alt="Warrior" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
      
      <Game />
      
      <footer className="mt-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em]">
        Built with Precision & Passion
      </footer>
    </div>
  );
}
