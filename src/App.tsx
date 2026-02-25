/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Game from './components/Game';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-0 sm:p-4 overflow-hidden relative">
      {/* Background City Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <img 
          src="https://picsum.photos/seed/cyberpunk-city/1920/1080?blur=2" 
          alt="City Background" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Header - Hidden or shrunken in mobile landscape to save space */}
      <div className="mb-4 sm:mb-8 text-center relative group landscape:hidden sm:landscape:block">
        {/* Blue Glow Line */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-1 bg-cyan-400 blur-md opacity-50 shadow-[0_0_20px_rgba(34,211,238,0.8)] z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[2px] bg-white opacity-80 z-0" />

        <div className="relative z-10">
          <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black italic uppercase tracking-tighter leading-none select-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-yellow-700 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              Nuha
            </span>
            <span className="mx-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-yellow-700 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              Fighter
            </span>
          </h1>
          
          {/* 2D Label */}
          <div className="mt-1 sm:mt-2">
            <span className="text-2xl sm:text-4xl lg:text-5xl font-black text-red-600 italic uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              2D
            </span>
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-full flex items-center justify-center overflow-hidden">
        <Game />
      </div>

      {/* Rotation Prompt for Mobile Phones in Portrait ONLY */}
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center sm:portrait:flex hidden landscape:hidden pointer-events-auto">
        <div className="w-24 h-24 mb-6 animate-bounce">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <path d="M12 18h.01" />
            <path d="M17 2l3 3-3 3" />
            <path d="M20 5H9a4 4 0 0 0-4 4v5" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Rotate for Battle</h2>
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Landscape mode recommended for phones</p>
      </div>
      
      <footer className="mt-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em]">
        Built with Precision & Passion
      </footer>
    </div>
  );
}
