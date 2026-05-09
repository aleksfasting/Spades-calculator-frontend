import { getLocalStorage } from './helperFunctions';
import { normalizeNames } from './constants';
import type { Names, NilSetting } from '../../types';

export function getNames(): Names | null {
  const raw = getLocalStorage<Names>('names');
  return raw ? normalizeNames(raw) : null;
}

export function getNilSetting(): NilSetting | null {
  return getLocalStorage<NilSetting>('nilScoringRule');
}
