import React, { useEffect, useRef, useState } from 'react';
import { Fighter } from '../Fighter';
import { PlayerState, AttackPhase, Particle, DamagePopUp } from '../types';
import { Trophy, RotateCcw, Zap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Shield, User, Users, Home } from 'lucide-react';
import { GameState, GameMode, Difficulty, DIFFICULTY_SETTINGS } from '../gameConstants';

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
  const [gameState, setGameState] = useState<GameState>('modeSelect');
  const [gameMode, setGameMode] = useState<GameMode>('2P');
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('Medium');
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1SM, setP1SM] = useState(0);
  const [p2SM, setP2SM] = useState(0);
  const [p1Combo, setP1Combo] = useState(0);
  const [p2Combo, setP2Combo] = useState(0);
  const [p1SpecialActive, setP1SpecialActive] = useState(false);
  const [p2SpecialActive, setP2SpecialActive] = useState(false);
  const [p1DamageTrail, setP1DamageTrail] = useState(100);
  const [p2DamageTrail, setP2DamageTrail] = useState(100);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [damagePopUps, setDamagePopUps] = useState<DamagePopUp[]>([]);
  const [screenShake, setScreenShake] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [roundIntro, setRoundIntro] = useState<string | null>(null);
  const [fightSplash, setFightSplash] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [parallaxX, setParallaxX] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [timer, setTimer] = useState(99);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const images = useRef<{ p1: HTMLImageElement; p2: HTMLImageElement; bg: HTMLImageElement } | null>(null);

  useEffect(() => {
    const p1Img = new Image();
    const p2Img = new Image();
    const bgImg = new Image();

    let loadedCount = 0;
    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === 3) {
        images.current = { p1: p1Img, p2: p2Img, bg: bgImg };
        setImagesLoaded(true);
      }
    };

    const onImageError = (e: any) => {
      console.error('Failed to load image, using fallback', e);
      // Even if it fails, we want to proceed with whatever we have or just set it to true to allow play
      // In a real app, you'd have local fallbacks
      loadedCount++;
      if (loadedCount === 3) {
        images.current = { p1: p1Img, p2: p2Img, bg: bgImg };
        setImagesLoaded(true);
      }
    };

    p1Img.crossOrigin = 'anonymous';
    p2Img.crossOrigin = 'anonymous';
    bgImg.crossOrigin = 'anonymous';

    p1Img.onload = onImageLoad;
    p1Img.onerror = onImageError;
    p2Img.onload = onImageLoad;
    p2Img.onerror = onImageError;
    bgImg.onload = onImageLoad;
    bgImg.onerror = onImageError;

    // Using high-quality placeholders for now. 
    // User should replace these with their actual sprite URLs.
    p1Img.src = 'https://raw.githubusercontent.com/fksensei2869/Nuha-Fighter/refs/heads/main/Public/HangTuahfixed1.png';
    p2Img.src = 'https://raw.githubusercontent.com/fksensei2869/Nuha-Fighter/refs/heads/main/Public/HangJebatfixed1.png';
    bgImg.src = 'https://raw.githubusercontent.com/fksensei2869/Nuha-Fighter/refs/heads/main/Public/Kampong.png';
  }, []);

  useEffect(() => {
    const detectTouch = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      setIsTouchDevice(hasTouch || isSmallScreen || isCoarse);
    };
    detectTouch();
    window.addEventListener('resize', detectTouch);
    return () => window.removeEventListener('resize', detectTouch);
  }, []);
  const [sparks, setSparks] = useState<{x: number, y: number, life: number}[]>([]);

  // Joystick state
  const [joystick1, setJoystick1] = useState<{ base: { x: number, y: number }, knob: { x: number, y: number } } | null>(null);
  const [joystick2, setJoystick2] = useState<{ base: { x: number, y: number }, knob: { x: number, y: number } } | null>(null);
  const joystick1TouchId = useRef<number | null>(null);
  const joystick2TouchId = useRef<number | null>(null);

  const fightersRef = useRef<{ p1: Fighter; p2: Fighter } | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!imagesLoaded || !images.current) return;

    const p1 = new Fighter({
      id: 1,
      position: { x: 150, y: 0 },
      color: '#3b82f6', // Blue
      facing: 'right',
      spriteImage: images.current.p1,
      targetHeight: 300,
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
      spriteImage: images.current.p2,
      targetHeight: 300,
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
    
    if (gameState === 'playing' && !gameOver) {
      setRoundIntro('ROUND 1');
      setTimeout(() => {
        setRoundIntro(null);
        setFightSplash(true);
        speak("Fight!", () => music.start());
        setTimeout(() => setFightSplash(false), 1000);
      }, 2000);
    }

    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key);

    const handleTouchStart = (e: TouchEvent) => {
      if (gameState !== 'playing' || gameOver) return;
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
      if (gameState !== 'playing' || gameOver) return;
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
      if (gameState !== 'playing' || gameOver) return;
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

  const createParticles = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 20 + Math.random() * 20,
        color
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const createDamagePopUp = (x: number, y: number, damage: number) => {
    setDamagePopUps(prev => [...prev, { x, y: y - 50, damage, life: 40 }]);
  };

  const gameLoop = (time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !fightersRef.current || isPaused) {
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    const { p1, p2 } = fightersRef.current;

    // AI Logic for P2 in 1P mode
    if (gameMode === '1P' && !gameOver && gameState === 'playing' && !roundIntro) {
      updateAI(p2, p1);
    }

    // Update
    if (!gameOver && gameState === 'playing' && !roundIntro) {
      p1.update(CANVAS_HEIGHT, keysPressed.current, p2);
      p2.update(CANVAS_HEIGHT, keysPressed.current, p1);

      // Parallax effect based on player average position
      const avgX = (p1.position.x + p2.position.x) / 2;
      setParallaxX((avgX - CANVAS_WIDTH / 2) * 0.05);

      // Collision Detection
      if (p1.attackPhase === AttackPhase.ACTIVE && rectangularCollision(p1, p2)) {
        if (p1.attackFrame === (p1.state === PlayerState.SPECIAL ? 16 : 5)) {
          const isJumping = p1.position.y + p1.height < CANVAS_HEIGHT - 120;
          let damage = 0;
          
          if (p1.state === PlayerState.SPECIAL) {
            damage = 40;
            setScreenShake(10);
            setCameraZoom(1.1);
            setTimeout(() => setCameraZoom(1), 200);
          }
          else if (p1.state === PlayerState.PUNCHING) damage = isJumping ? 7 : 5;
          else if (p1.state === PlayerState.KICKING) damage = isJumping ? 10 : 8;
          
          p1.registerHit();
          if (p1.comboCount > 1) damage += Math.min(p1.comboCount * 0.5, 10);
          damage = Math.round(damage);
          
          p2.takeHit(damage, p1.position.x);
          setP2Health(p2.health);
          setP1Combo(p1.comboCount);
          createParticles(p2.position.x + p2.width/2, p2.position.y + p2.height/2, '#fff');
          createDamagePopUp(p2.position.x + p2.width/2, p2.position.y, damage);
          if (damage > 10) setScreenShake(5);
        }
      }

      if (p2.attackPhase === AttackPhase.ACTIVE && rectangularCollision(p2, p1)) {
        if (p2.attackFrame === (p2.state === PlayerState.SPECIAL ? 16 : 5)) {
          const isJumping = p2.position.y + p2.height < CANVAS_HEIGHT - 120;
          let damage = 0;
          
          if (p2.state === PlayerState.SPECIAL) {
            damage = 40;
            setScreenShake(10);
            setCameraZoom(1.1);
            setTimeout(() => setCameraZoom(1), 200);
          }
          else if (p2.state === PlayerState.PUNCHING) damage = isJumping ? 7 : 5;
          else if (p2.state === PlayerState.KICKING) damage = isJumping ? 10 : 8;
          
          p2.registerHit();
          if (p2.comboCount > 1) damage += Math.min(p2.comboCount * 0.5, 10);
          damage = Math.round(damage);
          
          p1.takeHit(damage, p2.position.x);
          setP1Health(p1.health);
          setP2Combo(p2.comboCount);
          createParticles(p1.position.x + p1.width/2, p1.position.y + p1.height/2, '#fff');
          createDamagePopUp(p1.position.x + p1.width/2, p1.position.y, damage);
          if (damage > 10) setScreenShake(5);
        }
      }

      if (p1.state === PlayerState.SPECIAL && p1.attackFrame === 1) {
        setP1SpecialActive(true);
        setTimeout(() => setP1SpecialActive(false), 1000);
      }
      if (p2.state === PlayerState.SPECIAL && p2.attackFrame === 1) {
        setP2SpecialActive(true);
        setTimeout(() => setP2SpecialActive(false), 1000);
      }

      setP1SM(p1.smMeter);
      setP2SM(p2.smMeter);
      setP1Combo(p1.comboCount);
      setP2Combo(p2.comboCount);

      // Win Condition
      if (p1.health <= 0 || p2.health <= 0) {
        if (p1.health <= 0) {
          setGameOver('KO! Hang Jebat Wins!');
          p2.state = PlayerState.WIN;
        } else {
          setGameOver('KO! Hang Tuah Wins!');
          p1.state = PlayerState.WIN;
        }
        music.stop();
      }
    } else if (gameOver) {
      p1.update(CANVAS_HEIGHT, new Set(), p2);
      p2.update(CANVAS_HEIGHT, new Set(), p1);
    }

    // Update Particles & Popups
    setParticles(prev => prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 })).filter(p => p.life > 0));
    setDamagePopUps(prev => prev.map(d => ({ ...d, y: d.y - 1, life: d.life - 1 })).filter(d => d.life > 0));
    if (screenShake > 0) setScreenShake(prev => prev * 0.9);

    // Draw
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.save();
    // Screen Shake & Camera Zoom
    const shakeX = (Math.random() - 0.5) * screenShake;
    const shakeY = (Math.random() - 0.5) * screenShake;
    ctx.translate(CANVAS_WIDTH/2 + shakeX, CANVAS_HEIGHT/2 + shakeY);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-CANVAS_WIDTH/2, -CANVAS_HEIGHT/2);

    // Draw Background
    drawBackground(ctx, parallaxX);

    p1.draw(ctx, CANVAS_HEIGHT);
    p2.draw(ctx, CANVAS_HEIGHT);
    
    // Draw Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 40;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Damage Popups
    damagePopUps.forEach(d => {
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Inter';
      ctx.globalAlpha = d.life / 40;
      ctx.fillText(`-${d.damage}`, d.x, d.y);
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    animationFrameId = requestAnimationFrame(gameLoop);
  };

    timerInterval = setInterval(() => {
      if (gameState === 'playing' && !gameOver) {
        setTimer((prev) => {
          if (prev <= 0) {
            determineWinner();
            return 0;
          }
          return prev - 1;
        });
      }
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
  }, [gameOver, gameState, imagesLoaded]);

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
      setGameOver('KO! Hang Tuah Wins!');
      speak('K O. Hang Tuah Wins!');
    }
    else {
      setGameOver('KO! Hang Jebat Wins!');
      speak('K O. Hang Jebat Wins!');
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

  const drawBackground = (ctx: CanvasRenderingContext2D, parallaxX: number) => {
    ctx.save();
    
    // Distant Background (Sky/Mountains) - Slowest parallax
    ctx.translate(parallaxX * 0.2, 0);
    if (images.current?.bg && images.current.bg.complete && images.current.bg.naturalWidth !== 0) {
      ctx.drawImage(images.current.bg, -50, 0, CANVAS_WIDTH + 100, CANVAS_HEIGHT);
    } else {
      // Sky
      const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGradient.addColorStop(0, '#FF7E5F'); // Sunset orange
      skyGradient.addColorStop(1, '#FEB47B');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(-50, 0, CANVAS_WIDTH + 100, CANVAS_HEIGHT);

      // Distant Mountains (Blurred)
      ctx.filter = 'blur(4px)';
      ctx.fillStyle = '#4A5D7E';
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH * 0.1, CANVAS_HEIGHT - 120);
      ctx.lineTo(CANVAS_WIDTH * 0.4, 200);
      ctx.lineTo(CANVAS_WIDTH * 0.7, CANVAS_HEIGHT - 120);
      ctx.fill();
      ctx.filter = 'none';
    }
    ctx.restore();

    // Foreground (Ground) - No parallax for grounding
    const groundGradient = ctx.createLinearGradient(0, CANVAS_HEIGHT - 120, 0, CANVAS_HEIGHT);
    groundGradient.addColorStop(0, '#8B4513'); // Dark brown
    groundGradient.addColorStop(1, '#5D2E0C'); // Even darker for depth
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, CANVAS_HEIGHT - 120, CANVAS_WIDTH, 120);
    
    // Ground Texture Variation
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < CANVAS_HEIGHT; i += 12) {
      if (i > CANVAS_HEIGHT - 120) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_WIDTH, i);
        ctx.stroke();
      }
    }

    // Foreground Darkening
    const foreGradient = ctx.createLinearGradient(0, CANVAS_HEIGHT - 60, 0, CANVAS_HEIGHT);
    foreGradient.addColorStop(0, 'rgba(0,0,0,0)');
    foreGradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = foreGradient;
    ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60);
  };

  const resetGame = () => {
    setGameOver(null);
    setP1Health(100);
    setP2Health(100);
    setP1DamageTrail(100);
    setP2DamageTrail(100);
    setP1SM(0);
    setP2SM(0);
    setP1Combo(0);
    setP2Combo(0);
    setTimer(99);
    setRoundIntro('ROUND 1');
    setTimeout(() => {
      setRoundIntro(null);
      setFightSplash(true);
      speak("Fight!", () => music.start());
      setTimeout(() => setFightSplash(false), 1000);
    }, 2000);
    
    if (fightersRef.current) {
      const { p1, p2 } = fightersRef.current;
      p1.health = 100;
      p2.health = 100;
      p1.smMeter = 0;
      p2.smMeter = 0;
      p1.position = { x: 100, y: 0 };
      p2.position = { x: 800, y: 0 };
      p1.state = PlayerState.IDLE;
      p2.state = PlayerState.IDLE;
    }
  };

  const goToMainMenu = () => {
    setGameState('modeSelect');
    setGameOver(null);
    music.stop();
  };

  const aiActionBuffer = useRef<{key: string, timer: number}[]>([]);

  const updateAI = (ai: Fighter, player: Fighter) => {
    const config = DIFFICULTY_SETTINGS[aiDifficulty];
    const dist = Math.abs(ai.position.x - player.position.x);
    const aiCenter = ai.position.x + ai.width / 2;
    const playerCenter = player.position.x + player.width / 2;

    // Clear previous AI keys
    const aiKeys = ai.keys;
    const keysToClear = [aiKeys.left, aiKeys.right, aiKeys.up, aiKeys.down, aiKeys.punch, aiKeys.kick, aiKeys.block, aiKeys.special];
    keysToClear.forEach(k => keysPressed.current.delete(k));

    // Process action buffer
    aiActionBuffer.current = aiActionBuffer.current.filter(action => {
      action.timer--;
      if (action.timer <= 0) {
        keysPressed.current.add(action.key);
        return false;
      }
      return true;
    });

    const queueAction = (key: string) => {
      // Don't queue if already in buffer or if AI is already attacking
      if (aiActionBuffer.current.some(a => a.key === key) || ai.isAttacking) return;
      aiActionBuffer.current.push({ key, timer: config.reactionTime });
    };

    // Movement & Aggression
    if (!ai.isAttacking && ai.hitTimer <= 0) {
      if (Math.random() < config.aggression) {
        if (aiCenter < playerCenter - 80) {
          keysPressed.current.add(aiKeys.right);
        } else if (aiCenter > playerCenter + 80) {
          keysPressed.current.add(aiKeys.left);
        }
      }
    }

    // Defense: Block if player is attacking and close
    if (player.isAttacking && dist < 200) {
      if (Math.random() < config.defenseTiming) {
        queueAction(aiKeys.block);
      }
    }

    // Attack
    if (dist < 160 && !ai.isAttacking && ai.hitTimer <= 0) {
      if (Math.random() < config.attackFrequency) {
        // SM usage
        if (ai.smMeter >= 100 && Math.random() < config.specialUsage) {
          queueAction(aiKeys.special);
        } else {
          // Random punch or kick
          if (Math.random() > 0.4) {
            queueAction(aiKeys.punch);
          } else {
            queueAction(aiKeys.kick);
          }
        }
      }
    }

    // Random Jump
    if (dist < 300 && Math.random() < 0.015) {
      queueAction(aiKeys.up);
    }

    // Difficulty-based SM meter boost for AI
    if (ai.smMeter < 100) {
      ai.smMeter += (config.aggression * 0.25); 
    }
  };

  const selectMode = (mode: GameMode) => {
    setGameMode(mode);
    if (mode === '2P') {
      setGameState('playing');
      speak("Fight!", () => music.start());
    } else {
      setGameState('levelSelect');
    }
  };

  const selectLevel = (level: Difficulty) => {
    setAiDifficulty(level);
    setGameState('playing');
    speak("Fight!", () => music.start());
  };

  const handleTouch = (key: string, active: boolean) => {
    if (active) keysPressed.current.add(key);
    else keysPressed.current.delete(key);
  };

  if (!imagesLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white font-black italic uppercase tracking-widest">
        Loading Warriors...
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-auto max-w-5xl mx-auto bg-black sm:rounded-2xl overflow-hidden shadow-2xl sm:border-4 border-zinc-800 touch-none select-none aspect-video max-h-[85vh] landscape:max-h-[95vh] sm:landscape:max-h-none"
    >
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 sm:p-8 flex justify-between items-start pointer-events-none z-10 mt-6">
        {/* P1 Health */}
        <div className="w-[40%]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-blue-900/50 border-2 border-blue-400 overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.5)]">
               <User className="w-full h-full text-blue-400 p-1" />
            </div>
            <div className="flex flex-col">
              <span className="text-blue-400 font-black tracking-tighter uppercase italic text-sm sm:text-lg drop-shadow-lg">Hang Tuah</span>
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`w-3 h-3 rounded-full border border-yellow-500/50 ${i <= 2 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-zinc-800'}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="relative h-5 sm:h-7 bg-zinc-800 border-2 border-zinc-700 rounded-sm overflow-hidden shadow-2xl">
            {/* Damage Trail */}
            <div 
              className="absolute top-0 left-0 h-full bg-white transition-all duration-500" 
              style={{ width: `${p1DamageTrail}%` }}
            />
            {/* Health Fill */}
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-200 ${p1Health < 20 ? 'bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`} 
              style={{ width: `${p1Health}%` }}
            />
          </div>
          {/* SM Meter */}
          <div className="mt-2 h-2 sm:h-3 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden w-2/3 shadow-inner">
            <div 
              className={`h-full transition-all duration-200 ${p1SM >= 100 ? 'bg-yellow-400 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'bg-blue-400'}`}
              style={{ width: `${p1SM}%` }}
            />
          </div>
          {p1Combo > 1 && (
            <div className="mt-4 flex flex-col items-start animate-in zoom-in duration-200">
              <span className="text-blue-400 font-black italic text-4xl sm:text-6xl tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">
                {Math.min(p1Combo, 99)}+
              </span>
              <span className="text-white font-black italic text-xl sm:text-2xl uppercase tracking-widest -mt-2">Hits</span>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-zinc-900 border-4 border-yellow-600 flex items-center justify-center shadow-[0_0_30px_rgba(202,138,4,0.4)] overflow-hidden">
            {/* Malay Ornamental Border (Simplified) */}
            <div className="absolute inset-0 border-4 border-yellow-500/20 rounded-full animate-spin-slow" />
            <span className={`text-3xl sm:text-5xl font-black text-yellow-500 tabular-nums z-10 ${timer < 10 ? 'text-red-500 animate-ping' : ''}`}>
              {timer}
            </span>
          </div>
        </div>

        {/* P2 Health */}
        <div className="w-[40%] flex flex-col items-end">
          <div className="flex items-center gap-3 mb-2 flex-row-reverse">
            <div className="w-12 h-12 rounded-lg bg-red-900/50 border-2 border-red-400 overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.5)]">
               <User className="w-full h-full text-red-400 p-1" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-red-400 font-black tracking-tighter uppercase italic text-sm sm:text-lg drop-shadow-lg">Hang Jebat</span>
              <div className="flex gap-1 flex-row-reverse">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`w-3 h-3 rounded-full border border-yellow-500/50 ${i <= 2 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-zinc-800'}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="relative h-5 sm:h-7 bg-zinc-800 border-2 border-zinc-700 rounded-sm overflow-hidden w-full shadow-2xl">
             {/* Damage Trail */}
             <div 
              className="absolute top-0 right-0 h-full bg-white transition-all duration-500" 
              style={{ width: `${p2DamageTrail}%` }}
            />
            {/* Health Fill */}
            <div 
              className={`absolute top-0 right-0 h-full transition-all duration-200 ${p2Health < 20 ? 'bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-gradient-to-l from-red-600 to-red-400'}`} 
              style={{ width: `${p2Health}%` }}
            />
          </div>
          {/* SM Meter */}
          <div className="mt-2 h-2 sm:h-3 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden w-2/3 shadow-inner">
            <div 
              className={`h-full transition-all duration-200 ml-auto ${p2SM >= 100 ? 'bg-yellow-400 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'bg-red-400'}`}
              style={{ width: `${p2SM}%` }}
            />
          </div>
          {p2Combo > 1 && (
            <div className="mt-4 flex flex-col items-end animate-in zoom-in duration-200">
              <span className="text-red-400 font-black italic text-4xl sm:text-6xl tracking-tighter drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
                {Math.min(p2Combo, 99)}+
              </span>
              <span className="text-white font-black italic text-xl sm:text-2xl uppercase tracking-widest -mt-2">Hits</span>
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

      {/* Mode Select Screen */}
      {gameState === 'modeSelect' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] backdrop-blur-xl pointer-events-auto animate-in fade-in duration-500">
          <div className="flex items-center justify-center gap-4 mb-6 animate-pulse">
            <svg className="text-yellow-500 w-16 h-16 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
            <svg className="text-yellow-500 w-16 h-16 -rotate-90 scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </div>
          <h2 className="text-5xl sm:text-7xl font-black text-white italic uppercase tracking-tighter mb-12 text-center drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Select Mode
          </h2>
          <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl px-8">
            <button
              onClick={() => selectMode('1P')}
              className="flex-1 group relative px-8 py-6 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase italic tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(37,99,235,0.3)] flex flex-col items-center gap-4 border-b-4 border-blue-800"
            >
              <User className="w-12 h-12" />
              <span className="text-2xl">1 Player</span>
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] px-2 py-1 rounded-full font-bold animate-bounce">VS AI</div>
            </button>
            <button
              onClick={() => selectMode('2P')}
              className="flex-1 group relative px-8 py-6 bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(220,38,38,0.3)] flex flex-col items-center gap-4 border-b-4 border-red-800"
            >
              <Users className="w-12 h-12" />
              <span className="text-2xl">2 Player</span>
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] px-2 py-1 rounded-full font-bold animate-bounce">LOCAL</div>
            </button>
          </div>
        </div>
      )}

      {/* Level Select Screen */}
      {gameState === 'levelSelect' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] backdrop-blur-xl pointer-events-auto animate-in fade-in duration-500 overflow-y-auto py-12">
          <Zap className="text-yellow-500 w-16 h-16 mb-4 animate-pulse" />
          <h2 className="text-4xl sm:text-6xl font-black text-white italic uppercase tracking-tighter mb-8 text-center drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Select Level
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl px-8">
            {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((level) => (
              <button
                key={level}
                onClick={() => selectLevel(level)}
                className={`group relative px-6 py-4 font-black uppercase italic tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95 border-b-4 flex flex-col items-center gap-2
                  ${level === 'Beginner' ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-800 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : ''}
                  ${level === 'Easy' ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-800 shadow-[0_0_30px_rgba(6,182,212,0.2)]' : ''}
                  ${level === 'Medium' ? 'bg-blue-600 hover:bg-blue-500 border-blue-800 shadow-[0_0_30px_rgba(37,99,235,0.2)]' : ''}
                  ${level === 'Hard' ? 'bg-orange-600 hover:bg-orange-500 border-orange-800 shadow-[0_0_30px_rgba(249,115,22,0.2)]' : ''}
                  ${level === 'Extreme' ? 'bg-red-600 hover:bg-red-500 border-red-800 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : ''}
                  ${level === 'Insane' ? 'bg-purple-600 hover:bg-purple-500 border-purple-800 shadow-[0_0_30px_rgba(147,51,234,0.2)]' : ''}
                  ${level === 'Impossible' ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-950 shadow-[0_0_30px_rgba(0,0,0,0.5)]' : ''}
                `}
              >
                <span className="text-xl text-white">{level}</span>
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-white transition-all duration-500" 
                    style={{ width: `${((Object.keys(DIFFICULTY_SETTINGS).indexOf(level) + 1) / Object.keys(DIFFICULTY_SETTINGS).length) * 100}%` }} 
                  />
                </div>
              </button>
            ))}
          </div>
          <button 
            onClick={() => setGameState('modeSelect')}
            className="mt-12 text-zinc-500 hover:text-white uppercase tracking-widest text-sm transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Mode Select
          </button>
        </div>
      )}

      {/* Touch Controls - Visible on touch devices (mobile/tablet), hidden on non-touch desktop */}
      {isTouchDevice && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {/* Floating Joystick Visual P1 */}
          {joystick1 && (
            <div className="absolute pointer-events-none" style={{ left: joystick1.base.x - 40, top: joystick1.base.y - 40 }}>
              <div className="w-[80px] h-[80px] rounded-full border-2 border-blue-500/40 bg-blue-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <div className="w-10 h-10 rounded-full bg-blue-400/60 shadow-lg" style={{ transform: `translate(${joystick1.knob.x - joystick1.base.x}px, ${joystick1.knob.y - joystick1.base.y}px)` }} />
              </div>
            </div>
          )}

          {/* Floating Joystick Visual P2 */}
          {joystick2 && (
            <div className="absolute pointer-events-none" style={{ left: joystick2.base.x - 40, top: joystick2.base.y - 40 }}>
              <div className="w-[80px] h-[80px] rounded-full border-2 border-red-500/40 bg-red-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <div className="w-10 h-10 rounded-full bg-red-400/60 shadow-lg" style={{ transform: `translate(${joystick2.knob.x - joystick2.base.x}px, ${joystick2.knob.y - joystick2.base.y}px)` }} />
              </div>
            </div>
          )}

          {/* Action Buttons P1 (Bottom Far Left) */}
          <div className="absolute bottom-[18%] left-8 sm:bottom-[20%] sm:left-12 flex gap-2 pointer-events-auto">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('f', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('f', false); } }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600/40 backdrop-blur-md border-2 border-blue-400 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform font-black text-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >P</button>
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('g', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('g', false); } }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600/40 backdrop-blur-md border-2 border-blue-400 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform font-black text-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >K</button>
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('v', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('v', false); } }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600/40 backdrop-blur-md border-2 border-blue-400 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform font-black text-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >B</button>
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('r', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('r', false); } }}
                className={`w-16 h-16 sm:w-20 sm:h-20 backdrop-blur-md border-2 rounded-full flex items-center justify-center font-black text-sm shadow-2xl transition-all active:scale-90 ${p1SM >= 100 ? 'bg-blue-800 border-blue-400 text-white animate-pulse shadow-[0_0_30px_rgba(37,99,235,0.6)]' : 'bg-white/10 border-white/20 text-white/40'}`}
              >SM</button>
            </div>
          </div>

          {/* Action Buttons P2 (Bottom Far Right) */}
          <div className="absolute bottom-[18%] right-8 sm:bottom-[20%] sm:right-12 flex gap-2 pointer-events-auto">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('k', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('k', false); } }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600/40 backdrop-blur-md border-2 border-red-400 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform font-black text-2xl shadow-[0_0_20px_rgba(220,38,38,0.3)]"
              >P</button>
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('l', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('l', false); } }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600/40 backdrop-blur-md border-2 border-red-400 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform font-black text-2xl shadow-[0_0_20px_rgba(220,38,38,0.3)]"
              >K</button>
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('m', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('m', false); } }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600/40 backdrop-blur-md border-2 border-red-400 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform font-black text-2xl shadow-[0_0_20px_rgba(220,38,38,0.3)]"
              >B</button>
              <button 
                onTouchStart={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('p', true); } }} 
                onTouchEnd={(e) => { if(!gameOver) { e.preventDefault(); handleTouch('p', false); } }}
                className={`w-16 h-16 sm:w-20 sm:h-20 backdrop-blur-md border-2 rounded-full flex items-center justify-center font-black text-sm shadow-2xl transition-all active:scale-90 ${p2SM >= 100 ? 'bg-red-800 border-red-400 text-white animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.6)]' : 'bg-white/10 border-white/20 text-white/40'}`}
              >SM</button>
            </div>
          </div>
        </div>
      )}

      {/* Round Intro / Fight Splash */}
      {roundIntro && (
        <div className="absolute inset-0 flex items-center justify-center z-[110] pointer-events-none">
          <h1 className="text-8xl sm:text-9xl font-black text-white italic uppercase tracking-tighter animate-in zoom-in duration-300 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
            {roundIntro}
          </h1>
        </div>
      )}
      {fightSplash && (
        <div className="absolute inset-0 flex items-center justify-center z-[110] pointer-events-none">
          <h1 className="text-9xl sm:text-[12rem] font-black text-red-600 italic uppercase tracking-tighter animate-bounce drop-shadow-[0_0_50px_rgba(220,38,38,0.8)]">
            FIGHT!
          </h1>
        </div>
      )}

      {/* Special Move Overlays */}
      {p1SpecialActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="animate-bounce bg-blue-600/80 text-white px-8 py-4 rounded-xl border-4 border-blue-400 text-4xl font-black italic tracking-tighter shadow-[0_0_50px_rgba(37,99,235,0.8)]">
            SILAT STRIKE
          </div>
        </div>
      )}
      {p2SpecialActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="animate-bounce bg-red-600/80 text-white px-8 py-4 rounded-xl border-4 border-red-400 text-4xl font-black italic tracking-tighter shadow-[0_0_50px_rgba(220,38,38,0.8)]">
            KERIS WRATH
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] backdrop-blur-xl pointer-events-auto animate-in zoom-in duration-300">
          <div className="relative mb-6">
            <Trophy className="text-yellow-500 w-20 h-20 sm:w-28 sm:h-28 animate-bounce" />
            <div className="absolute -top-4 -right-4 bg-red-600 text-white font-black italic text-3xl px-6 py-2 rounded-lg shadow-[0_0_30px_rgba(220,38,38,0.8)] rotate-12 animate-pulse">
              KO
            </div>
          </div>
          
          <h2 className="text-4xl sm:text-7xl font-black text-white italic uppercase tracking-tighter mb-4 text-center px-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            {gameOver}
          </h2>

          {/* Match Stats */}
          <div className="grid grid-cols-2 gap-8 mb-12 w-full max-w-md px-8">
            <div className="flex flex-col items-center p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <span className="text-zinc-500 text-xs uppercase font-bold">Max Combo</span>
              <span className="text-blue-400 text-3xl font-black italic">{Math.max(p1Combo, 0)}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <span className="text-zinc-500 text-xs uppercase font-bold">Max Combo</span>
              <span className="text-red-400 text-3xl font-black italic">{Math.max(p2Combo, 0)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={resetGame}
              className="group relative px-10 py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-widest rounded-full transition-all hover:scale-110 active:scale-95 shadow-[0_0_40px_rgba(220,38,38,0.5)] flex items-center gap-3 border-b-4 border-red-800"
            >
              <RotateCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
              Rematch
            </button>
            <button
              onClick={goToMainMenu}
              className="group relative px-10 py-5 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase italic tracking-widest rounded-full transition-all hover:scale-110 active:scale-95 shadow-2xl flex items-center gap-3 border-b-4 border-zinc-950"
            >
              <Home className="w-6 h-6" />
              Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Controls Legend */}
      <div className="bg-zinc-900 p-4 border-t border-zinc-800 grid grid-cols-2 gap-8">
        <div className="space-y-1">
          <h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Hang Tuah Controls</h3>
          <div className="flex gap-4 text-[10px] text-zinc-400">
            <span><strong className="text-white">WASD</strong> Move/Jump</span>
            <span><strong className="text-white">F</strong> Punch</span>
            <span><strong className="text-white">G</strong> Kick</span>
            <span><strong className="text-white">V</strong> Block</span>
            <span><strong className="text-white">R</strong> SM</span>
          </div>
        </div>
        <div className="space-y-1 text-right">
          <h3 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">Hang Jebat Controls</h3>
          <div className="flex gap-4 justify-end text-[10px] text-zinc-400">
            <span><strong className="text-white">Arrows</strong> Move/Jump</span>
            <span><strong className="text-white">K</strong> Punch</span>
            <span><strong className="text-white">L</strong> Kick</span>
            <span><strong className="text-white">M</strong> Block</span>
            <span><strong className="text-white">P</strong> SM</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
