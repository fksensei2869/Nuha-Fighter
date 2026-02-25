import React, { useEffect, useRef, useState } from 'react';
import { Fighter } from '../Fighter';
import { PlayerState } from '../types';
import { Trophy, RotateCcw, Zap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Shield } from 'lucide-react';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

const speak = (text: string, onEnd?: () => void) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 0.8;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  } else if (onEnd) {
    onEnd();
  }
};

class MusicPlayer {
  private audioCtx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private notes = [196, 220, 233, 293, 311]; // G3, A3, Bb3, D4, Eb4 (Hirajoshi)
  private interval: any;
  private beatCount: number = 0;

  start() {
    if (this.isPlaying) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.isPlaying = true;
    this.nextNoteTime = this.audioCtx.currentTime;
    this.beatCount = 0;
    
    this.interval = setInterval(() => {
      if (this.audioCtx && this.audioCtx.currentTime > this.nextNoteTime - 0.1) {
        this.playStep();
      }
    }, 50);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this.interval);
    if (this.audioCtx) {
      if (this.audioCtx.state !== 'closed') {
        this.audioCtx.close().catch(console.error);
      }
      this.audioCtx = null;
    }
  }

  private playStep() {
    if (!this.audioCtx) return;
    
    // Play melody on every 4th step (approx 120 BPM)
    if (this.beatCount % 4 === 0) {
      this.playNote();
    }
    
    // Play drum on every step
    this.playDrum();
    
    this.beatCount++;
    this.nextNoteTime += 0.125; // 120 BPM (0.5s per beat, 0.125s per 16th note)
  }

  private playNote() {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    const note = this.notes[Math.floor(Math.random() * this.notes.length)];
    osc.frequency.setValueAtTime(note, this.nextNoteTime);
    osc.type = 'triangle';
    
    gain.gain.setValueAtTime(0.04, this.nextNoteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.nextNoteTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start(this.nextNoteTime);
    osc.stop(this.nextNoteTime + 0.4);
  }

  private playDrum() {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.beatCount % 4 === 0 ? 80 : 50, this.nextNoteTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.nextNoteTime + 0.1);
    
    gain.gain.setValueAtTime(this.beatCount % 4 === 0 ? 0.1 : 0.03, this.nextNoteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.nextNoteTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start(this.nextNoteTime);
    osc.stop(this.nextNoteTime + 0.1);
  }
}

const music = new MusicPlayer();

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1Special, setP1Special] = useState(0);
  const [p2Special, setP2Special] = useState(0);
  const [p1Combo, setP1Combo] = useState(0);
  const [p2Combo, setP2Combo] = useState(0);
  const [timer, setTimer] = useState(99);
  const [sparks, setSparks] = useState<{x: number, y: number, life: number}[]>([]);

  // Joystick state
  const [joystick1, setJoystick1] = useState<{ base: { x: number, y: number }, knob: { x: number, y: number } } | null>(null);
  const [joystick2, setJoystick2] = useState<{ base: { x: number, y: number }, knob: { x: number, y: number } } | null>(null);
  const joystick1TouchId = useRef<number | null>(null);
  const joystick2TouchId = useRef<number | null>(null);

  const fightersRef = useRef<{ p1: Fighter; p2: Fighter } | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const p1 = new Fighter({
      id: 1,
      position: { x: 150, y: 0 },
      color: '#3b82f6', // Blue
      facing: 'right',
      keys: {
        up: 'w',
        down: 's',
        left: 'a',
        right: 'd',
        punch: 'f',
        kick: 'g',
        block: 'v',
        special: 'r'
      }
    });

    const p2 = new Fighter({
      id: 2,
      position: { x: 800, y: 0 },
      color: '#ef4444', // Red
      facing: 'left',
      keys: {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
        punch: 'k',
        kick: 'l',
        block: 'm',
        special: 'p'
      }
    });

    fightersRef.current = { p1, p2 };
    speak("Fight!", () => music.start());

    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key);

    const handleTouchStart = (e: TouchEvent) => {
      if (gameOver) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        {/* P1 Joystick Zone (Left-Center) */}
        if (x > rect.width * 0.1 && x < rect.width * 0.4 && joystick1TouchId.current === null) {
          joystick1TouchId.current = touch.identifier;
          setJoystick1({ base: { x, y }, knob: { x, y } });
        }
        // P2 Joystick Zone (Right-Center)
        else if (x > rect.width * 0.6 && x < rect.width * 0.9 && joystick2TouchId.current === null) {
          joystick2TouchId.current = touch.identifier;
          setJoystick2({ base: { x, y }, knob: { x, y } });
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (gameOver) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        if (touch.identifier === joystick1TouchId.current) {
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;

          setJoystick1(prev => {
            if (!prev) return null;
            const dx = x - prev.base.x;
            const dy = y - prev.base.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 40;
            let knobX = x;
            let knobY = y;
            if (dist > maxDist) {
              knobX = prev.base.x + (dx / dist) * maxDist;
              knobY = prev.base.y + (dy / dist) * maxDist;
            }
            const threshold = 15;
            if (dx > threshold) { keysPressed.current.add('d'); keysPressed.current.delete('a'); }
            else if (dx < -threshold) { keysPressed.current.add('a'); keysPressed.current.delete('d'); }
            else { keysPressed.current.delete('a'); keysPressed.current.delete('d'); }
            if (dy < -threshold) { keysPressed.current.add('w'); keysPressed.current.delete('s'); }
            else if (dy > threshold) { keysPressed.current.add('s'); keysPressed.current.delete('w'); }
            else { keysPressed.current.delete('w'); keysPressed.current.delete('s'); }
            return { ...prev, knob: { x: knobX, y: knobY } };
          });
        }

        if (touch.identifier === joystick2TouchId.current) {
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;

          setJoystick2(prev => {
            if (!prev) return null;
            const dx = x - prev.base.x;
            const dy = y - prev.base.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 40;
            let knobX = x;
            let knobY = y;
            if (dist > maxDist) {
              knobX = prev.base.x + (dx / dist) * maxDist;
              knobY = prev.base.y + (dy / dist) * maxDist;
            }
            const threshold = 15;
            if (dx > threshold) { keysPressed.current.add('ArrowRight'); keysPressed.current.delete('ArrowLeft'); }
            else if (dx < -threshold) { keysPressed.current.add('ArrowLeft'); keysPressed.current.delete('ArrowRight'); }
            else { keysPressed.current.delete('ArrowLeft'); keysPressed.current.delete('ArrowRight'); }
            if (dy < -threshold) { keysPressed.current.add('ArrowUp'); keysPressed.current.delete('ArrowDown'); }
            else if (dy > threshold) { keysPressed.current.add('ArrowDown'); keysPressed.current.delete('ArrowUp'); }
            else { keysPressed.current.delete('ArrowUp'); keysPressed.current.delete('ArrowDown'); }
            return { ...prev, knob: { x: knobX, y: knobY } };
          });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (gameOver) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystick1TouchId.current) {
          joystick1TouchId.current = null;
          setJoystick1(null);
          keysPressed.current.delete('a'); keysPressed.current.delete('d');
          keysPressed.current.delete('w'); keysPressed.current.delete('s');
        }
        if (touch.identifier === joystick2TouchId.current) {
          joystick2TouchId.current = null;
          setJoystick2(null);
          keysPressed.current.delete('ArrowLeft'); keysPressed.current.delete('ArrowRight');
          keysPressed.current.delete('ArrowUp'); keysPressed.current.delete('ArrowDown');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: false });
      container.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    let animationFrameId: number;
    let lastTime = 0;
    let timerInterval: any;

    const gameLoop = (time: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !fightersRef.current) return;

      const { p1, p2 } = fightersRef.current;

      // Update
      if (!gameOver) {
        p1.update(CANVAS_HEIGHT, keysPressed.current, p2);
        p2.update(CANVAS_HEIGHT, keysPressed.current, p1);

        // Collision Detection
        if (p1.isAttacking && rectangularCollision(p1, p2)) {
          p1.isAttacking = false;
          const isJumping = p1.position.y + p1.height < 550;
          let damage = 0;
          
          if (p1.state === PlayerState.SPECIAL) damage = 40; // Super Move Damage
          else if (p1.state === PlayerState.PUNCHING) damage = isJumping ? 7 : 5;
          else if (p1.state === PlayerState.KICKING) damage = isJumping ? 10 : 8;
          
          // Combo bonus
          p1.registerHit();
          if (p1.comboCount > 1) {
            damage += p1.comboCount * 2;
          }
          
          p2.takeHit(damage, p1.position.x);
          setP2Health(p2.health);
          setP1Combo(p1.comboCount);
          createSparks(p2.position.x + p2.width/2, p2.position.y + p2.height/2);
        }

        if (p2.isAttacking && rectangularCollision(p2, p1)) {
          p2.isAttacking = false;
          const isJumping = p2.position.y + p2.height < 550;
          let damage = 0;
          
          if (p2.state === PlayerState.SPECIAL) damage = 40; // Super Move Damage
          else if (p2.state === PlayerState.PUNCHING) damage = isJumping ? 7 : 5;
          else if (p2.state === PlayerState.KICKING) damage = isJumping ? 10 : 8;
          
          // Combo bonus
          p2.registerHit();
          if (p2.comboCount > 1) {
            damage += p2.comboCount * 2;
          }
          
          p1.takeHit(damage, p2.position.x);
          setP1Health(p1.health);
          setP2Combo(p2.comboCount);
          createSparks(p1.position.x + p1.width/2, p1.position.y + p1.height/2);
        }

        setP1Special(p1.specialMeter);
        setP2Special(p2.specialMeter);
        setP1Combo(p1.comboCount);
        setP2Combo(p2.comboCount);

        // Win Condition
        if (p1.health <= 0) {
          setGameOver('Scarlet Strike Wins!');
          speak('Scarlet Strike Wins!');
          music.stop();
        }
        if (p2.health <= 0) {
          setGameOver('Blue Bolt Wins!');
          speak('Blue Bolt Wins!');
          music.stop();
        }
      } else {
        // Still update physics but with no input after game over
        p1.update(CANVAS_HEIGHT, new Set(), p2);
        p2.update(CANVAS_HEIGHT, new Set(), p1);
      }

      // Update sparks (always animate)
      setSparks(prev => prev.map(s => ({ ...s, life: s.life - 1 })).filter(s => s.life > 0));

      // Draw
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw Background (Simple Stage)
      drawBackground(ctx);

      p1.draw(ctx);
      p2.draw(ctx);
      
      // Draw Sparks
      ctx.fillStyle = 'white';
      sparks.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    timerInterval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          determineWinner();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      }
      cancelAnimationFrame(animationFrameId);
      clearInterval(timerInterval);
      music.stop();
    };
  }, [gameOver]);

  const createSparks = (x: number, y: number) => {
    const newSparks = Array.from({ length: 10 }).map(() => ({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      life: 10 + Math.random() * 10
    }));
    setSparks(prev => [...prev, ...newSparks]);
  };

  const determineWinner = () => {
    if (!fightersRef.current) return;
    const { p1, p2 } = fightersRef.current;
    music.stop();
    if (p1.health === p2.health) setGameOver('Draw!');
    else if (p1.health > p2.health) {
      setGameOver('Blue Bolt Wins!');
      speak('Blue Bolt Wins!');
    }
    else {
      setGameOver('Scarlet Strike Wins!');
      speak('Scarlet Strike Wins!');
    }
  };

  const rectangularCollision = (f1: Fighter, f2: Fighter) => {
    const box2 = f2.getCollisionBox();
    return (
      f1.attackBox.position.x + f1.attackBox.width >= box2.x &&
      f1.attackBox.position.x <= box2.x + box2.width &&
      f1.attackBox.position.y + f1.attackBox.height >= box2.y &&
      f1.attackBox.position.y <= box2.y + box2.height
    );
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB'); // Sky blue
    skyGradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Mount Fuji
    ctx.fillStyle = '#4A5D7E';
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.2, CANVAS_HEIGHT - 50);
    ctx.lineTo(CANVAS_WIDTH * 0.5, 150);
    ctx.lineTo(CANVAS_WIDTH * 0.8, CANVAS_HEIGHT - 50);
    ctx.fill();

    // Snow cap
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.43, 220);
    ctx.lineTo(CANVAS_WIDTH * 0.5, 150);
    ctx.lineTo(CANVAS_WIDTH * 0.57, 220);
    ctx.bezierCurveTo(CANVAS_WIDTH * 0.5, 250, CANVAS_WIDTH * 0.45, 230, CANVAS_WIDTH * 0.43, 220);
    ctx.fill();

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const drawCloud = (x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.arc(x + size * 0.6, y - size * 0.2, size * 0.8, 0, Math.PI * 2);
      ctx.arc(x + size * 1.2, y, size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(100, 100, 30);
    drawCloud(700, 120, 40);
    drawCloud(400, 80, 25);

    // Ground (Dojo Floor)
    ctx.fillStyle = '#8B4513'; // Brown wood
    ctx.fillRect(0, CANVAS_HEIGHT - 50, CANVAS_WIDTH, 50);
    
    // Wood grain lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 0; i < CANVAS_HEIGHT; i += 10) {
      if (i > CANVAS_HEIGHT - 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_WIDTH, i);
        ctx.stroke();
      }
    }
    
    // Distant Pagoda
    ctx.fillStyle = '#2D3436';
    const pagodaX = 850;
    const pagodaY = CANVAS_HEIGHT - 50;
    for(let i=0; i<3; i++) {
      ctx.fillRect(pagodaX - 20 + i*5, pagodaY - 40 - i*30, 40 - i*10, 10);
      ctx.beginPath();
      ctx.moveTo(pagodaX - 30 + i*5, pagodaY - 30 - i*30);
      ctx.lineTo(pagodaX + 30 - i*5, pagodaY - 30 - i*30);
      ctx.lineTo(pagodaX, pagodaY - 50 - i*30);
      ctx.fill();
    }
  };

  const resetGame = () => {
    setGameOver(null);
    setP1Health(100);
    setP2Health(100);
    setP1Special(0);
    setP2Special(0);
    setP1Combo(0);
    setP2Combo(0);
    setTimer(99);
    speak("Fight!", () => music.start());
  };

  const handleTouch = (key: string, active: boolean) => {
    if (active) keysPressed.current.add(key);
    else keysPressed.current.delete(key);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-auto max-w-5xl mx-auto bg-black sm:rounded-2xl overflow-hidden shadow-2xl sm:border-4 border-zinc-800 touch-none select-none aspect-video max-h-[90vh]"
    >
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 sm:p-6 flex justify-between items-start pointer-events-none z-10">
        {/* P1 Health */}
        <div className="w-1/3">
          <div className="flex justify-between mb-1">
            <span className="text-blue-400 font-bold tracking-tighter uppercase italic text-xs sm:text-base">Blue Bolt</span>
            <span className="text-white font-mono text-xs sm:text-base">{Math.ceil(p1Health)}%</span>
          </div>
          <div className="h-4 sm:h-6 bg-zinc-900 border border-zinc-700 rounded-sm overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-200" 
              style={{ width: `${p1Health}%` }}
            />
          </div>
          {/* Special Meter */}
          <div className="mt-2 h-1.5 sm:h-2 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden w-1/2">
            <div 
              className={`h-full transition-all duration-200 ${p1Special >= 100 ? 'bg-yellow-400 animate-pulse' : 'bg-blue-300'}`}
              style={{ width: `${p1Special}%` }}
            />
          </div>
          {p1Combo > 1 && (
            <div className="mt-2 text-blue-400 font-black italic text-xl sm:text-3xl animate-bounce">
              {p1Combo} HIT COMBO!
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="bg-zinc-900 border-2 border-zinc-700 px-2 sm:px-4 py-1 sm:py-2 rounded-lg">
          <span className="text-2xl sm:text-4xl font-mono font-bold text-yellow-500 tabular-nums">
            {timer.toString().padStart(2, '0')}
          </span>
        </div>

        {/* P2 Health */}
        <div className="w-1/3 flex flex-col items-end">
          <div className="flex justify-between w-full mb-1">
            <span className="text-white font-mono text-xs sm:text-base">{Math.ceil(p2Health)}%</span>
            <span className="text-red-400 font-bold tracking-tighter uppercase italic text-xs sm:text-base">Scarlet Strike</span>
          </div>
          <div className="h-4 sm:h-6 bg-zinc-900 border border-zinc-700 rounded-sm overflow-hidden w-full">
            <div 
              className="h-full bg-red-500 transition-all duration-200 ml-auto" 
              style={{ width: `${p2Health}%` }}
            />
          </div>
          {/* Special Meter */}
          <div className="mt-2 h-1.5 sm:h-2 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden w-1/2">
            <div 
              className={`h-full transition-all duration-200 ml-auto ${p2Special >= 100 ? 'bg-yellow-400 animate-pulse' : 'bg-red-300'}`}
              style={{ width: `${p2Special}%` }}
            />
          </div>
          {p2Combo > 1 && (
            <div className="mt-2 text-red-400 font-black italic text-xl sm:text-3xl animate-bounce text-right">
              {p2Combo} HIT COMBO!
            </div>
          )}
        </div>
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-auto block bg-zinc-900"
      />

      {/* Touch Controls - Visible on touch devices (mobile/tablet), hidden on desktop */}
      <div className="absolute inset-0 pointer-events-none z-30 [@media(hover:hover)]:hidden block">
        {/* Floating Joystick Visual P1 */}
        {joystick1 && (
          <div className="absolute pointer-events-none" style={{ left: joystick1.base.x - 40, top: joystick1.base.y - 40 }}>
            <div className="w-[80px] h-[80px] rounded-full border-2 border-blue-500/20 bg-blue-500/5 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-blue-400/40 shadow-lg" style={{ transform: `translate(${joystick1.knob.x - joystick1.base.x}px, ${joystick1.knob.y - joystick1.base.y}px)` }} />
            </div>
          </div>
        )}

        {/* Floating Joystick Visual P2 */}
        {joystick2 && (
          <div className="absolute pointer-events-none" style={{ left: joystick2.base.x - 40, top: joystick2.base.y - 40 }}>
            <div className="w-[80px] h-[80px] rounded-full border-2 border-red-500/20 bg-red-500/5 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-red-400/40 shadow-lg" style={{ transform: `translate(${joystick2.knob.x - joystick2.base.x}px, ${joystick2.knob.y - joystick2.base.y}px)` }} />
            </div>
          </div>
        )}

        {/* Action Buttons P1 (Bottom Far Left) */}
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex gap-2 pointer-events-auto">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('f', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('f', false); } }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 backdrop-blur-md border-2 border-blue-500/40 rounded-full flex items-center justify-center text-blue-200 active:bg-blue-500 font-black text-lg sm:text-xl shadow-lg"
            >P</button>
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('g', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('g', false); } }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 backdrop-blur-md border-2 border-blue-500/40 rounded-full flex items-center justify-center text-blue-200 active:bg-blue-500 font-black text-lg sm:text-xl shadow-lg"
            >K</button>
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('v', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('v', false); } }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 backdrop-blur-md border-2 border-blue-500/40 rounded-full flex items-center justify-center text-blue-200 active:bg-blue-500 font-black text-lg sm:text-xl shadow-lg"
            >B</button>
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('r', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('r', false); } }}
              className={`w-12 h-12 sm:w-14 sm:h-14 backdrop-blur-md border-2 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs shadow-lg ${p1Special >= 100 ? 'bg-yellow-500/40 border-yellow-400 text-yellow-100 animate-pulse' : 'bg-white/5 border-white/10 text-white/20'}`}
            >SP</button>
          </div>
        </div>

        {/* Action Buttons P2 (Bottom Far Right) */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex gap-2 pointer-events-auto">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('k', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('k', false); } }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 backdrop-blur-md border-2 border-red-500/40 rounded-full flex items-center justify-center text-red-200 active:bg-red-500 font-black text-lg sm:text-xl shadow-lg"
            >P</button>
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('l', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('l', false); } }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 backdrop-blur-md border-2 border-red-500/40 rounded-full flex items-center justify-center text-red-200 active:bg-red-500 font-black text-lg sm:text-xl shadow-lg"
            >K</button>
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('m', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('m', false); } }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 backdrop-blur-md border-2 border-red-500/40 rounded-full flex items-center justify-center text-red-200 active:bg-red-500 font-black text-lg sm:text-xl shadow-lg"
            >B</button>
            <button 
              onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('p', true); } }} 
              onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('p', false); } }}
              className={`w-12 h-12 sm:w-14 sm:h-14 backdrop-blur-md border-2 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs shadow-lg ${p2Special >= 100 ? 'bg-yellow-500/40 border-yellow-400 text-yellow-100 animate-pulse' : 'bg-white/5 border-white/10 text-white/20'}`}
            >SP</button>
          </div>
        </div>
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] backdrop-blur-md pointer-events-auto">
          <Trophy className="text-yellow-500 w-16 h-16 sm:w-20 sm:h-20 mb-4 animate-bounce" />
          <h2 className="text-3xl sm:text-6xl font-black text-white italic uppercase tracking-tighter mb-8 text-center px-4">
            {gameOver}
          </h2>
          <button
            onClick={resetGame}
            className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-widest rounded-full transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center gap-3"
          >
            <RotateCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
            Rematch
          </button>
        </div>
      )}

      {/* Controls Legend */}
      <div className="bg-zinc-900 p-4 border-t border-zinc-800 grid grid-cols-2 gap-8">
        <div className="space-y-1">
          <h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Blue Bolt Controls</h3>
          <div className="flex gap-4 text-[10px] text-zinc-400">
            <span><strong className="text-white">WASD</strong> Move/Jump</span>
            <span><strong className="text-white">F</strong> Punch</span>
            <span><strong className="text-white">G</strong> Kick</span>
            <span><strong className="text-white">V</strong> Block</span>
            <span><strong className="text-white">R</strong> Special</span>
          </div>
        </div>
        <div className="space-y-1 text-right">
          <h3 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">Scarlet Strike Controls</h3>
          <div className="flex gap-4 justify-end text-[10px] text-zinc-400">
            <span><strong className="text-white">Arrows</strong> Move/Jump</span>
            <span><strong className="text-white">K</strong> Punch</span>
            <span><strong className="text-white">L</strong> Kick</span>
            <span><strong className="text-white">M</strong> Block</span>
            <span><strong className="text-white">P</strong> Special</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
