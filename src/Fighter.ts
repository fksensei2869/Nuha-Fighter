import { PlayerState, Vector, FighterConfig, AttackPhase, InputRecord } from './types';
import { Sprite } from './Sprite';

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

  // SF3 Mechanics
  attackPhase: AttackPhase = AttackPhase.NONE;
  attackFrame: number = 0;
  inputBuffer: InputRecord[] = [];
  hitStop: number = 0;
  
  // Animation frames/timers
  attackTimer: number = 0;
  hitTimer: number = 0;
  stunTimer: number = 0;
  invincibilityTimer: number = 0;
  smMeter: number = 0;
  
  // Feedback
  impactFlash: number = 0;
  
  // Combo tracking
  comboCount: number = 0;
  lastHitTime: number = 0;
  comboTimer: number = 0;

  // Sprite handling
  sprite: Sprite;

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

    this.sprite = new Sprite({
      image: config.spriteImage,
      framesMax: 5,
      scale: 1.0,
      offset: { x: 50, y: 180 }, 
      frameWidth: config.frameWidth,
      frameHeight: config.frameHeight,
      targetHeight: config.targetHeight || 300
    });
  }

  getGroundLevel(canvasHeight: number) {
    return canvasHeight - 120;
  }

  getCollisionBox() {
    const isDucking = this.state === PlayerState.DUCKING;
    const isJumping = this.state === PlayerState.JUMPING || this.state === PlayerState.FALLING;
    
    if (isDucking) {
      return {
        x: this.position.x,
        y: this.position.y + this.height * 0.6,
        width: this.width,
        height: this.height * 0.4
      };
    }
    
    if (isJumping) {
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
    if (this.hitStop > 0) {
      this.hitStop--;
      return;
    }

    if (this.impactFlash > 0) {
      this.impactFlash--;
    }

    // Reset attack box position and size
    if (this.state === PlayerState.PUNCHING) {
      this.attackBox.width = 120;
      this.attackBox.height = 50;
    } else if (this.state === PlayerState.KICKING) {
      this.attackBox.width = 150;
      this.attackBox.height = 60;
    } else if (this.state === PlayerState.SPECIAL) {
      this.attackBox.width = 200;
      this.attackBox.height = 100;
    } else {
      this.attackBox.width = 100;
      this.attackBox.height = 50;
    }

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
    
    // Boundary check (Screen Borders)
    const STAGE_WIDTH = 1024;
    const GROUND_LEVEL = canvasHeight - 120; // Lifted up slightly more
    const isGrounded = this.position.y + this.height >= GROUND_LEVEL - 5;

    if (this.position.x < 0) {
      this.position.x = 0;
      this.velocity.x = 0;
    }
    if (this.position.x + this.width > STAGE_WIDTH) {
      this.position.x = STAGE_WIDTH - this.width;
      this.velocity.x = 0;
    }

    this.position.y += this.velocity.y;
    
    // Horizontal friction & Stop self-movement
    if (isGrounded && this.state !== PlayerState.WALKING) {
      this.velocity.x *= FRICTION;
      if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
    } else if (!isGrounded) {
      this.velocity.x *= 0.98;
    }

    // Gravity
    if (this.position.y + this.height + this.velocity.y >= GROUND_LEVEL) {
      this.velocity.y = 0;
      this.position.y = GROUND_LEVEL - this.height;
      if (this.state === PlayerState.JUMPING || this.state === PlayerState.FALLING) {
        this.state = PlayerState.IDLE;
      }
    } else {
      this.velocity.y += GRAVITY;
      if (this.velocity.y > 0 && this.state !== PlayerState.HIT && this.state !== PlayerState.DEAD) {
        this.state = PlayerState.FALLING;
      }
    }

    // Update facing direction
    if (!this.isAttacking && this.state !== PlayerState.DEAD) {
      this.facing = this.position.x < opponent.position.x ? 'right' : 'left';
    }

    // Attack Phases Logic
    if (this.isAttacking) {
      this.attackFrame++;
      
      const startup = this.state === PlayerState.SPECIAL ? 15 : 4;
      const active = this.state === PlayerState.SPECIAL ? 10 : 4;
      const recovery = this.state === PlayerState.SPECIAL ? 15 : 4;

      if (this.attackFrame <= startup) {
        this.attackPhase = AttackPhase.STARTUP;
      } else if (this.attackFrame <= startup + active) {
        this.attackPhase = AttackPhase.ACTIVE;
        // Velocity shift for Silat Kick
        if (this.state === PlayerState.KICKING && this.attackFrame === startup + 1) {
          this.velocity.x = this.facing === 'right' ? 10 : -10;
        }
      } else if (this.attackFrame <= startup + active + recovery) {
        this.attackPhase = AttackPhase.RECOVERY;
      } else {
        this.isAttacking = false;
        this.attackPhase = AttackPhase.NONE;
        this.attackFrame = 0;
        this.state = PlayerState.IDLE;
      }
    }

    // SM meter regeneration
    if (this.smMeter < 100) {
      this.smMeter += 0.1;
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) {
        this.comboCount = 0;
      }
    }

    // Update Sprite
    const animationMap: Record<string, { frames: number; hold: number }> = {
      [PlayerState.IDLE]: { frames: 5, hold: 8 },
      [PlayerState.WALKING]: { frames: 5, hold: 5 },
      [PlayerState.PUNCHING]: { frames: 5, hold: 4 },
      [PlayerState.KICKING]: { frames: 5, hold: 4 },
      [PlayerState.SPECIAL]: { frames: 5, hold: 3 },
      [PlayerState.HIT]: { frames: 5, hold: 10 },
      [PlayerState.DEAD]: { frames: 5, hold: 10 },
      [PlayerState.WIN]: { frames: 5, hold: 8 },
    };

    const currentAnim = animationMap[this.state] || { frames: 1, hold: 5 };
    this.sprite.setAnimation(currentAnim.frames, currentAnim.hold);
    this.sprite.update();
  }

  handleInput(pressedKeys: Set<string>) {
    if (this.hitTimer > 0 || this.state === PlayerState.DEAD || this.stunTimer > 0) return;

    // Record input for buffer
    const now = Date.now();
    pressedKeys.forEach(key => {
      if (key === this.keys.up || key === this.keys.down || key === this.keys.left || key === this.keys.right || key === this.keys.punch) {
        if (this.inputBuffer.length === 0 || this.inputBuffer[this.inputBuffer.length - 1].key !== key) {
          this.inputBuffer.push({ key, timestamp: now });
          if (this.inputBuffer.length > 5) this.inputBuffer.shift();
          this.checkSpecialCombo();
        }
      }
    });

    // Cancel basic punch into special
    const canCancel = this.state === PlayerState.PUNCHING && this.attackPhase === AttackPhase.ACTIVE;
    
    if (this.isAttacking && !canCancel) return;
    
    this.isBlocking = false;
    const GROUND_LEVEL = 576 - 120; // Match Game.tsx CANVAS_HEIGHT
    const isGrounded = this.position.y + this.height >= GROUND_LEVEL - 5;

    if (pressedKeys.has(this.keys.block) && isGrounded) {
      this.state = PlayerState.BLOCKING;
      this.isBlocking = true;
      this.velocity.x = 0;
    } else if (pressedKeys.has(this.keys.up) && isGrounded) {
      this.velocity.y = JUMP_FORCE;
      this.state = PlayerState.JUMPING;
    } else if (pressedKeys.has(this.keys.down) && isGrounded) {
      this.state = PlayerState.DUCKING;
      this.velocity.x = 0;
    } else {
      if (pressedKeys.has(this.keys.left)) {
        this.velocity.x = -MOVE_SPEED;
        if (isGrounded) this.state = PlayerState.WALKING;
      } else if (pressedKeys.has(this.keys.right)) {
        this.velocity.x = MOVE_SPEED;
        if (isGrounded) this.state = PlayerState.WALKING;
      } else if (isGrounded) {
        this.velocity.x = 0;
        this.state = PlayerState.IDLE;
      }
    }

    if (pressedKeys.has(this.keys.punch)) {
      this.attack('punch');
    } else if (pressedKeys.has(this.keys.kick)) {
      this.attack('kick');
    } else if (pressedKeys.has(this.keys.special) && this.smMeter >= 100) {
      this.attack('sm');
    }
  }

  checkSpecialCombo() {
    if (this.inputBuffer.length < 3) return;
    
    const last3 = this.inputBuffer.slice(-3);
    const timeDiff = last3[2].timestamp - last3[0].timestamp;
    
    if (timeDiff < 500) {
      const keys = last3.map(i => i.key);
      const forward = this.facing === 'right' ? this.keys.right : this.keys.left;
      
      if (keys[0] === this.keys.down && keys[1] === forward && keys[2] === this.keys.punch) {
        if (this.smMeter >= 50) { // Allow Keris Strike if meter > 50
           this.attack('sm');
        }
      }
    }
  }

  attack(type: 'punch' | 'kick' | 'sm') {
    this.isAttacking = true;
    this.attackFrame = 0;
    this.attackPhase = AttackPhase.STARTUP;
    
    if (type === 'sm') {
      this.state = PlayerState.SPECIAL;
      this.smMeter = Math.max(0, this.smMeter - 50);
      this.attackBox.width = 150;
      this.playSound(440, 'sawtooth', 0.3, 0.4);
    } else if (type === 'punch') {
      this.state = PlayerState.PUNCHING;
      this.attackBox.width = 100;
      this.playSound(600, 'sine', 0.1, 0.1);
    } else if (type === 'kick') {
      this.state = PlayerState.KICKING;
      this.attackBox.width = 100;
      this.playSound(300, 'square', 0.1, 0.15);
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
    } catch (e) {}
  }

  registerHit() {
    this.comboCount++;
    this.comboTimer = 60;
    this.hitStop = 2; // Impact Freeze
    this.playSound(100, 'sine', 0.2, 0.1);
  }

  takeHit(damage: number, attackerX: number) {
    if (this.invincibilityTimer > 0) return;

    this.impactFlash = 3; // 0.05s impact flash at 60fps

    if (this.isBlocking) {
      damage *= 0.2;
      this.health -= damage;
      if (this.health < 0) this.health = 0;
      this.playSound(200, 'sine', 0.1, 0.05);
    } else {
      this.health -= damage;
      this.hitTimer = 15;
      this.stunTimer = 30;
      this.invincibilityTimer = 60;
      this.hitStop = 4; // Impact Freeze
      
      const direction = this.position.x < attackerX ? -1 : 1;
      this.velocity.x = direction * 15; // Knockback
      this.velocity.y = -5;
      
      if (this.health < 0) this.health = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D, canvasHeight: number) {
    const groundLevel = this.getGroundLevel(canvasHeight);
    
    // Draw Shadow
    const shadowY = groundLevel;
    const distFromGround = groundLevel - (this.position.y + this.height);
    const shadowScale = Math.max(0.4, 1 - distFromGround / 300);
    
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      this.position.x + this.width / 2,
      shadowY,
      this.width * 0.8 * shadowScale,
      10 * shadowScale,
      0, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.restore();

    // Draw Sprite
    this.sprite.draw(ctx, this.position, this.facing, this.width, this.height);

    // Impact Flash
    if (this.impactFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
      ctx.restore();
    }

    // Hit effect
    if (this.state === PlayerState.HIT) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
      ctx.restore();
    }
  }
}
