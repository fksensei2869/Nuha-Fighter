import { PlayerState, Vector, FighterConfig } from './types';

const GRAVITY = 0.8;
const JUMP_FORCE = -20;
const MOVE_SPEED = 7;
const FRICTION = 0.9;

export class Fighter {
  id: number;
  position: Vector;
  velocity: Vector;
  width: number = 60;
  height: number = 150;
  color: string;
  health: number = 100;
  state: PlayerState = PlayerState.IDLE;
  facing: 'left' | 'right';
  keys: FighterConfig['keys'];
  
  isAttacking: boolean = false;
  isBlocking: boolean = false;
  attackBox: { position: Vector; width: number; height: number };
  
  private audioCtx: AudioContext | null = null;

  // Animation frames/timers
  attackTimer: number = 0;
  hitTimer: number = 0;
  stunTimer: number = 0;
  invincibilityTimer: number = 0;
  specialMeter: number = 0;
  
  // Combo tracking
  comboCount: number = 0;
  lastHitTime: number = 0;
  comboTimer: number = 0;

  constructor(config: FighterConfig) {
    this.id = config.id;
    this.position = { ...config.position };
    this.velocity = { x: 0, y: 0 };
    this.color = config.color;
    this.keys = config.keys;
    this.facing = config.facing;
    
    this.attackBox = {
      position: { x: this.position.x, y: this.position.y },
      width: 100,
      height: 50
    };

    if (typeof window !== 'undefined') {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  getCollisionBox() {
    const isDucking = this.state === PlayerState.DUCKING;
    const isJumping = this.state === PlayerState.JUMPING || this.state === PlayerState.FALLING;
    
    if (isDucking) {
      // Ducking: Shrink hurtbox by 60% from the top
      return {
        x: this.position.x,
        y: this.position.y + this.height * 0.6,
        width: this.width,
        height: this.height * 0.4
      };
    }
    
    if (isJumping) {
      // Jumping: Reduce hurtbox height from lower body to avoid low attacks
      return {
        x: this.position.x,
        y: this.position.y,
        width: this.width,
        height: this.height * 0.7
      };
    }

    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height
    };
  }

  update(canvasHeight: number, pressedKeys: Set<string>, opponent: Fighter) {
    // Reset attack box position
    this.attackBox.position.x = this.facing === 'right' ? this.position.x + this.width : this.position.x - this.attackBox.width;
    this.attackBox.position.y = this.position.y + 30;

    // Handle Timers
    if (this.stunTimer > 0) {
      this.stunTimer--;
      if (this.stunTimer === 0 && this.health > 0) {
        this.state = PlayerState.IDLE;
      }
    }

    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer--;
    }

    // Handle Hit State Visuals
    if (this.hitTimer > 0) {
      this.hitTimer--;
      this.state = PlayerState.HIT;
    } else if (this.health <= 0) {
      this.state = PlayerState.DEAD;
    } else if (this.stunTimer <= 0) {
      this.handleInput(pressedKeys);
    }

    // Apply Physics
    this.position.x += this.velocity.x;
    
    // Boundary check
    if (this.position.x < 0) this.position.x = 0;
    if (this.position.x + this.width > 1024) this.position.x = 1024 - this.width;

    this.position.y += this.velocity.y;
    
    // Horizontal friction (only when not actively moving)
    const isGrounded = this.position.y + this.height >= 550;
    if (isGrounded && this.state !== PlayerState.WALKING) {
      this.velocity.x *= FRICTION;
    } else if (!isGrounded) {
      this.velocity.x *= 0.98; // Less friction in air
    }

    // Gravity
    if (this.position.y + this.height + this.velocity.y >= canvasHeight - 50) {
      this.velocity.y = 0;
      this.position.y = canvasHeight - 50 - this.height;
      if (this.state === PlayerState.JUMPING || this.state === PlayerState.FALLING) {
        this.state = PlayerState.IDLE;
      }
    } else {
      this.velocity.y += GRAVITY;
      if (this.velocity.y > 0 && this.state !== PlayerState.HIT && this.state !== PlayerState.DEAD) {
        this.state = PlayerState.FALLING;
      }
    }

    // Update facing direction based on opponent (unless attacking or dead)
    if (!this.isAttacking && this.state !== PlayerState.DEAD) {
      this.facing = this.position.x < opponent.position.x ? 'right' : 'left';
    }

    // Attack cooldowns
    if (this.attackTimer > 0) {
      this.attackTimer--;
      if (this.attackTimer === 0) {
        this.isAttacking = false;
        this.state = PlayerState.IDLE;
      }
    }

    // Special meter regeneration
    if (this.specialMeter < 100) {
      this.specialMeter += 0.1;
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) {
        this.comboCount = 0;
      }
    }
  }

  handleInput(pressedKeys: Set<string>) {
    if (this.isAttacking || this.state === PlayerState.HIT || this.state === PlayerState.DEAD || this.stunTimer > 0) return;
    
    this.isBlocking = false;
    const isGrounded = this.position.y + this.height >= 550;

    // ACTION PRIORITY SYSTEM
    if (pressedKeys.has(this.keys.block) && isGrounded) {
      // 1. Blocking (Highest Priority when grounded)
      this.state = PlayerState.BLOCKING;
      this.isBlocking = true;
      this.velocity.x = 0;
    } else if (pressedKeys.has(this.keys.up) && isGrounded) {
      // 2. Jumping
      this.velocity.y = JUMP_FORCE;
      this.state = PlayerState.JUMPING;
    } else if (pressedKeys.has(this.keys.down) && isGrounded) {
      // 3. Ducking (Only if grounded and not moving)
      this.state = PlayerState.DUCKING;
      this.velocity.x = 0;
    } else {
      // 4. Movement & Idle
      if (pressedKeys.has(this.keys.left)) {
        this.velocity.x = -MOVE_SPEED; // Instantaneous direction change
        if (isGrounded) this.state = PlayerState.WALKING;
      } else if (pressedKeys.has(this.keys.right)) {
        this.velocity.x = MOVE_SPEED; // Instantaneous direction change
        if (isGrounded) this.state = PlayerState.WALKING;
      } else if (isGrounded) {
        this.velocity.x = 0;
        this.state = PlayerState.IDLE;
      }
    }

    // Attacks can be triggered from most states except hit/dead
    if (pressedKeys.has(this.keys.punch)) {
      this.attack('punch');
    } else if (pressedKeys.has(this.keys.kick)) {
      this.attack('kick');
    } else if (pressedKeys.has(this.keys.special) && this.specialMeter >= 100) {
      this.attack('special');
    }
  }

  attack(type: 'punch' | 'kick' | 'special') {
    this.isAttacking = true;
    this.attackTimer = type === 'special' ? 40 : 12; // 0.2s for basic, 0.66s for special
    
    const isJumping = this.position.y + this.height < 550;
    
    if (type === 'special') {
      this.state = PlayerState.SPECIAL;
      this.specialMeter = 0;
      this.attackBox.width = 150;
      this.playSound(440, 'sawtooth', 0.3, 0.4); // Special sound
    } else if (type === 'punch') {
      this.state = PlayerState.PUNCHING;
      this.attackBox.width = 100;
      this.playSound(600, 'sine', 0.1, 0.1); // Punch sound
    } else if (type === 'kick') {
      this.state = PlayerState.KICKING;
      this.attackBox.width = 100;
      this.playSound(300, 'square', 0.1, 0.15); // Kick sound
    }
  }

  private playSound(freq: number, type: OscillatorType, volume: number, duration: number) {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq / 2, this.audioCtx.currentTime + duration);
      
      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.error('Audio error:', e);
    }
  }

  registerHit() {
    this.comboCount++;
    this.comboTimer = 60; // 1 second at 60fps
    this.playSound(100, 'sine', 0.2, 0.1); // Hit sound
  }

  takeHit(damage: number, attackerX: number) {
    if (this.invincibilityTimer > 0) return;

    if (this.isBlocking) {
      damage *= 0.2; // 80% damage reduction
      this.health -= damage;
      if (this.health < 0) this.health = 0;
      this.playSound(200, 'sine', 0.1, 0.05);
      // No knockback or stun when blocking
    } else {
      this.health -= damage;
      this.hitTimer = 15;
      this.stunTimer = 30; // 0.5s stun
      this.invincibilityTimer = 90; // 1.5s invincibility
      
      // Knockback away from attacker
      const direction = this.position.x < attackerX ? -1 : 1;
      this.velocity.x = direction * 12;
      this.velocity.y = -8; // Small vertical pop
      
      if (this.health < 0) this.health = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // I-Frame Flickering
    if (this.invincibilityTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Draw Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(this.position.x + this.width/2, 550, this.width/2, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Character Body
    const isP1 = this.id === 1;
    
    // Draw Gi (Body)
    ctx.fillStyle = this.color;
    let drawHeight = this.height;
    let drawY = this.position.y;
    
    if (this.state === PlayerState.DUCKING) {
      drawHeight = this.height * 0.4;
      drawY = this.position.y + (this.height * 0.6);
    }

    // Gi Top
    ctx.fillRect(this.position.x, drawY, this.width, drawHeight * 0.6);
    // Gi Pants
    ctx.fillRect(this.position.x + 5, drawY + drawHeight * 0.6, this.width - 10, drawHeight * 0.4);
    
    // Belt (White)
    ctx.fillStyle = 'white';
    ctx.fillRect(this.position.x - 2, drawY + drawHeight * 0.55, this.width + 4, 8);

    // Head
    ctx.fillStyle = '#f3e5ab'; // Skin tone
    const headY = drawY - 35;
    ctx.fillRect(this.position.x + 10, headY, 40, 40);

    // Hair
    ctx.fillStyle = isP1 ? '#5d4037' : '#212121'; // Brown for P1, Black for P2
    ctx.beginPath();
    if (isP1) {
      // Spiky brown hair
      ctx.moveTo(this.position.x + 10, headY);
      ctx.lineTo(this.position.x + 5, headY - 15);
      ctx.lineTo(this.position.x + 20, headY - 5);
      ctx.lineTo(this.position.x + 30, headY - 20);
      ctx.lineTo(this.position.x + 40, headY - 5);
      ctx.lineTo(this.position.x + 55, headY - 15);
      ctx.lineTo(this.position.x + 50, headY + 10);
    } else {
      // Slick black hair
      ctx.moveTo(this.position.x + 10, headY + 5);
      ctx.lineTo(this.position.x + 15, headY - 15);
      ctx.lineTo(this.position.x + 35, headY - 20);
      ctx.lineTo(this.position.x + 50, headY - 10);
      ctx.lineTo(this.position.x + 50, headY + 10);
    }
    ctx.fill();

    // Headband for P1
    if (isP1) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(this.position.x + 10, headY + 10, 40, 8);
      // Headband tails
      ctx.beginPath();
      const tailX = this.facing === 'right' ? this.position.x + 10 : this.position.x + 50;
      ctx.moveTo(tailX, headY + 14);
      ctx.lineTo(tailX + (this.facing === 'right' ? -20 : 20), headY + 10);
      ctx.lineTo(tailX + (this.facing === 'right' ? -15 : 15), headY + 20);
      ctx.fill();
    }

    // Eyes
    ctx.fillStyle = 'black';
    const eyeX = this.facing === 'right' ? this.position.x + 40 : this.position.x + 15;
    ctx.fillRect(eyeX, headY + 15, 6, 6);

    // Blocking visual
    if (this.isBlocking) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      const shieldX = this.facing === 'right' ? this.position.x + 30 : this.position.x - 10;
      ctx.fillRect(shieldX, drawY + 10, 40, drawHeight - 20);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(shieldX, drawY + 10, 40, drawHeight - 20);
    }

    // Attack Visuals
    if (this.isAttacking) {
      if (this.state === PlayerState.PUNCHING) {
        // Arm
        ctx.fillStyle = '#f3e5ab';
        const armX = this.facing === 'right' ? this.position.x + this.width : this.position.x - 45;
        
        // Draw arm as a rounded path
        ctx.beginPath();
        ctx.roundRect(armX, drawY + 25, 45, 18, 5);
        ctx.fill();

        // Glove
        ctx.fillStyle = isP1 ? '#1e40af' : '#b91c1c';
        const gloveX = this.facing === 'right' ? armX + 30 : armX;
        ctx.beginPath();
        ctx.roundRect(gloveX, drawY + 22, 18, 24, 8);
        ctx.fill();
        
        // Punch Aura (Blue Bolt)
        if (isP1) {
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(gloveX + 9, drawY + 34, 22, 0, Math.PI * 2);
          ctx.stroke();
          
          // Add some "bolt" lines
          ctx.beginPath();
          ctx.moveTo(gloveX + 9, drawY + 14);
          ctx.lineTo(gloveX + 15, drawY + 2);
          ctx.stroke();
        }
      } else if (this.state === PlayerState.KICKING) {
        // Leg
        ctx.fillStyle = this.color;
        const legX = this.facing === 'right' ? this.position.x + this.width : this.position.x - 55;
        ctx.beginPath();
        ctx.roundRect(legX, drawY + 40, 55, 25, 10);
        ctx.fill();

        // Shoe
        ctx.fillStyle = 'white';
        const shoeX = this.facing === 'right' ? legX + 40 : legX;
        ctx.beginPath();
        ctx.roundRect(shoeX, drawY + 38, 20, 29, 5);
        ctx.fill();
        
        // Kick trail
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(shoeX + 10, drawY + 52, 30, 0, Math.PI, this.facing === 'right');
        ctx.stroke();
      } else if (this.state === PlayerState.SPECIAL) {
        if (isP1) {
          // Blue Bolt Super Move: Thunder God Strike
          ctx.fillStyle = '#f3e5ab';
          const armX = this.facing === 'right' ? this.position.x + this.width : this.position.x - 80;
          ctx.beginPath();
          ctx.roundRect(armX, drawY + 10, 80, 40, 15);
          ctx.fill();
          
          // Enhanced Energy Sphere
          const sphereX = this.facing === 'right' ? armX + 50 : armX;
          const grad = ctx.createRadialGradient(sphereX + 15, drawY + 30, 5, sphereX + 15, drawY + 30, 70);
          grad.addColorStop(0, 'white');
          grad.addColorStop(0.2, '#60a5fa');
          grad.addColorStop(0.5, '#1e40af');
          grad.addColorStop(0.8, 'rgba(0, 255, 255, 0.4)');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sphereX + 15, drawY + 30, 70, 0, Math.PI * 2);
          ctx.fill();
          
          // Intense Lightning bolts
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 3;
          for(let i=0; i<8; i++) {
            ctx.beginPath();
            const angle = (Math.PI * 2 / 8) * i + (Date.now() / 50);
            ctx.moveTo(sphereX + 15, drawY + 30);
            const len = 60 + Math.random() * 40;
            ctx.lineTo(sphereX + 15 + Math.cos(angle) * len, drawY + 30 + Math.sin(angle) * len);
            ctx.stroke();
          }
        } else {
          // Scarlet Strike Super Move: Infernal Phoenix Kick
          ctx.fillStyle = this.color;
          const legX = this.facing === 'right' ? this.position.x + this.width : this.position.x - 100;
          ctx.beginPath();
          ctx.roundRect(legX, drawY + 20, 100, 50, 20);
          ctx.fill();
          
          // Enhanced Flame Ring
          const ringX = this.facing === 'right' ? legX + 80 : legX + 20;
          const time = Date.now() / 30;
          
          for(let i=0; i<5; i++) {
            ctx.strokeStyle = i % 2 === 0 ? '#f97316' : '#fbbf24';
            ctx.lineWidth = 12 - i * 2;
            ctx.beginPath();
            ctx.arc(ringX, drawY + 45, 45 + Math.sin(time + i) * 10, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Fire particles explosion
          ctx.fillStyle = '#ff4400';
          for(let i=0; i<15; i++) {
            const px = ringX + (Math.random() - 0.5) * 120;
            const py = drawY + 45 + (Math.random() - 0.5) * 120;
            ctx.beginPath();
            ctx.arc(px, py, 3 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Hit effect
    if (this.state === PlayerState.HIT) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(this.position.x - 5, drawY - 5, this.width + 10, drawHeight + 10);
    }

    ctx.restore();
  }
}
