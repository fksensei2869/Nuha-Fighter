import { Vector } from './types';

export interface AnimationState {
  start: number;
  length: number;
  hold: number;
}

export interface SpriteConfig {
  image: HTMLImageElement;
  framesMax: number;
  scale?: number;
  offset?: Vector;
  frameWidth?: number;
  frameHeight?: number;
  targetHeight?: number;
  animations?: Record<string, AnimationState>;
}

export class Sprite {
  image: HTMLImageElement;
  processedImage: HTMLCanvasElement | null = null;
  framesMax: number;
  framesCurrent: number;
  framesElapsed: number;
  framesHold: number;
  scale: number;
  offset: Vector;
  frameWidth?: number;
  frameHeight?: number;
  targetHeight?: number;
  animations?: Record<string, AnimationState>;
  currentAnimation?: string;
  
  // Special effects
  isSpecialMove: boolean = false;

  constructor({ image, framesMax = 1, scale = 1, offset = { x: 0, y: 0 }, frameWidth, frameHeight, targetHeight, animations }: SpriteConfig) {
    this.image = image;
    this.framesMax = framesMax;
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 5;
    this.scale = scale;
    this.offset = offset;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.targetHeight = targetHeight;
    this.animations = animations;
  }

  private processingAttempted = false;

  private processImage() {
    if (this.processingAttempted) return;
    if (!this.image.complete || this.image.naturalWidth === 0) return;
    
    this.processingAttempted = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.image.naturalWidth;
      canvas.height = this.image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(this.image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Remove white background (RGB: 255, 255, 255)
      const threshold = 240; 
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      this.processedImage = canvas;
    } catch (e) {
      console.warn('Sprite processing failed (likely CORS):', e);
    }
  }

  draw(ctx: CanvasRenderingContext2D, position: Vector, facing: 'left' | 'right', width: number, height: number) {
    if (!this.image || !this.image.complete || this.image.naturalWidth === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(position.x, position.y, width, height);
      return;
    }

    if (!this.processedImage) {
      this.processImage();
    }

    const drawSource = this.processedImage || this.image;

    ctx.save();
    
    if (facing === 'left') {
      ctx.translate(position.x + width, position.y);
      ctx.scale(-1, 1);
      ctx.translate(-position.x, -position.y);
    }

    const sWidth = this.frameWidth || (drawSource.width / this.framesMax);
    const sHeight = this.frameHeight || drawSource.height;
    
    // Calculate scale to match targetHeight if provided
    let currentScale = this.scale;
    if (this.targetHeight) {
      currentScale = this.targetHeight / sHeight;
    }

    // Special Move Scale Increase
    if (this.isSpecialMove) {
      currentScale *= 1.1;
    }

    const dx = position.x - this.offset.x;
    const dy = position.y - this.offset.y;
    const dWidth = sWidth * currentScale;
    const dHeight = sHeight * currentScale;

    // Apply Special Move Flash
    if (this.isSpecialMove) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    }

    // Calculate source X based on animation
    let sourceX = this.framesCurrent * sWidth;
    if (this.animations && this.currentAnimation) {
      const anim = this.animations[this.currentAnimation];
      sourceX = (anim.start + this.framesCurrent) * sWidth;
    }

    // Apply Sunset Tint and Rim Light
    ctx.drawImage(
      drawSource,
      sourceX,
      0,
      sWidth,
      sHeight,
      dx,
      dy,
      dWidth,
      dHeight
    );

    if (this.isSpecialMove) {
      ctx.restore();
    }

    // Apply lighting effects using a temporary canvas if needed, 
    // but for performance we can use globalCompositeOperation
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    
    // Sunset Tint (Warm orange/yellow)
    ctx.fillStyle = 'rgba(255, 150, 50, 0.08)';
    ctx.fillRect(dx, dy, dWidth, dHeight);

    // Rim Light (Orange glow on one side)
    const gradient = ctx.createLinearGradient(dx, dy, dx + dWidth, dy);
    if (facing === 'right') {
      gradient.addColorStop(0, 'rgba(255, 120, 0, 0.3)');
      gradient.addColorStop(0.2, 'rgba(255, 120, 0, 0)');
    } else {
      gradient.addColorStop(1, 'rgba(255, 120, 0, 0.3)');
      gradient.addColorStop(0.8, 'rgba(255, 120, 0, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(dx, dy, dWidth, dHeight);
    
    ctx.restore();

    ctx.restore();
  }

  update() {
    this.framesElapsed++;
    
    let maxFrames = this.framesMax;
    if (this.animations && this.currentAnimation) {
      maxFrames = this.animations[this.currentAnimation].length;
    }

    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < maxFrames - 1) {
        this.framesCurrent++;
      } else {
        this.framesCurrent = 0;
      }
    }
  }

  setAnimation(name: string) {
    if (this.currentAnimation !== name) {
      this.currentAnimation = name;
      this.framesCurrent = 0;
      this.framesElapsed = 0;
      
      if (this.animations && this.animations[name]) {
        this.framesHold = this.animations[name].hold;
      }
    }
  }
}
