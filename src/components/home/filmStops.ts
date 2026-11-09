/**
 * Where the film slows down in front of a building and its popup opens, as fractions of the scroll.
 * Shared by the camera (homeFilm.ts) and the popups (SearchSection.tsx). No three.js in here.
 */
export type FilmStopId = 'skin' | 'market' | 'compete' | 'create' | 'live';

export const FILM_STOPS: { id: FilmStopId; from: number; to: number }[] = [
  { id: 'skin', from: 0.112, to: 0.165 },
  { id: 'market', from: 0.287, to: 0.34 },
  { id: 'compete', from: 0.427, to: 0.48 },
  { id: 'create', from: 0.547, to: 0.6 },
  { id: 'live', from: 0.677, to: 0.73 },
];
