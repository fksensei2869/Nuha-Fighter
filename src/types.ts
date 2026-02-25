/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector {
  x: number;
  y: number;
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
  DEAD = 'DEAD'
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
}
