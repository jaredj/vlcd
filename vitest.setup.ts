import '@testing-library/jest-dom/vitest';

const arrayBufferDescriptor = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable');
if (!arrayBufferDescriptor) {
  Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
    configurable: true,
    enumerable: false,
    get() {
      return false;
    }
  });
}

if (typeof SharedArrayBuffer !== 'undefined') {
  const sharedDescriptor = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'growable');
  if (!sharedDescriptor) {
    Object.defineProperty(SharedArrayBuffer.prototype, 'growable', {
      configurable: true,
      enumerable: false,
      get() {
        return false;
      }
    });
  }
}

if (typeof HTMLCanvasElement !== 'undefined') {
  const getContextOverride = function getContext(this: HTMLCanvasElement, type: string) {
    if (type !== '2d') {
      return null;
    }

    const noop = () => undefined;

    const context = {
      canvas: this,
      fillRect: noop,
      clearRect: noop,
      getImageData: () => ({ data: [] }),
      putImageData: noop,
      createImageData: () => ({ data: [] }),
      setTransform: noop,
      drawImage: noop,
      save: noop,
      fillText: noop,
      restore: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      clip: noop,
      stroke: noop,
      translate: noop,
      scale: noop,
      rotate: noop,
      arc: noop,
      quadraticCurveTo: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      setLineDash: noop,
      measureText: () => ({ width: 0 }),
      transform: noop,
      rect: noop,
      bezierCurveTo: noop,
      isPointInPath: () => false,
      isPointInStroke: () => false,
      strokeRect: noop,
      strokeText: noop,
      fill: noop,
      strokeStyle: '#000',
      fillStyle: '#000',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      globalCompositeOperation: 'source-over',
      shadowBlur: 0,
      shadowColor: 'rgba(0,0,0,0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic'
    } as unknown as CanvasRenderingContext2D;

    return context;
  } as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = getContextOverride;
}
