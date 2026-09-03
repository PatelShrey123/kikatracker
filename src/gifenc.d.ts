declare module 'gifenc' {
  export function GIFEncoder(options?: any): any;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: any): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], options?: any): Uint8Array;
  const pkg: any;
  export default pkg;
}
