/**
 * First-run onboarding tour persistence. Bump the KEY suffix to re-show the
 * tour to everyone after a major UI overhaul.
 */
import * as SecureStore from 'expo-secure-store';
import logger from '../../utils/logger';

const KEY = 'onboardingTourDone_v1';

export async function hasSeenTour() {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch (e) {
    logger.error('tourStorage: read failed', e);
    // Fail closed — better to never show the tour than to loop it.
    return true;
  }
}

export async function markTourSeen() {
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch (e) {
    logger.error('tourStorage: write failed', e);
  }
}

/** For a future "Replay tour" entry in settings/profile. */
export async function resetTour() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch (e) {
    logger.error('tourStorage: reset failed', e);
  }
}
