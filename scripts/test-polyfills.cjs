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
