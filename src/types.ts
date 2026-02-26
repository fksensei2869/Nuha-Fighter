/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface DamagePopUp {
  x: number;
  y: number;
  damage: number;
  life: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export enum PlayerState {
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  JUMPING = 'JUMPING',
  FALLING = 'FALLING',
  DUCKING = 'DUCKING',
  PUNCHING = 'PUNCHING',
  KICKING = 'KICKING',
  SPECIAL = 'SPECIAL',
  BLOCKING = 'BLOCKING',
  HIT = 'HIT',
  DEAD = 'DEAD',
  WIN = 'WIN'
}

export enum AttackPhase {
  STARTUP = 'STARTUP',
  ACTIVE = 'ACTIVE',
  RECOVERY = 'RECOVERY',
  NONE = 'NONE'
}

export interface InputRecord {
  key: string;
  timestamp: number;
}

export interface FighterConfig {
  id: number;
  position: Vector;
  color: string;
  keys: {
    up: string;
    down: string;
    left: string;
    right: string;
    punch: string;
    kick: string;
    block: string;
    special: string;
  };
  facing: 'left' | 'right';
  spriteImage: HTMLImageElement;
  frameWidth?: number;
  frameHeight?: number;
  targetHeight?: number;
}
