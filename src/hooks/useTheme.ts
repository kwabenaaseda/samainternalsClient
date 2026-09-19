/**
 * Theme Hook — dark mode for the SAMS shell.
 *
 * Stores only a UI preference under `sams-theme`. This is deliberately NOT the
 * same kind of storage the auth layer forbids: the Google access token is never
 * persisted anywhere, while a light/dark choice is harmless, non-identifying
 * local state that should survive a reload.
 *
 * The `<html class="dark">` flag is also set by a tiny inline script in
 * index.html so the first paint is already in the right theme (no white flash).
 */

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'sams-theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Read the stored preference, tolerating private-mode / disabled storage. */
function readStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return prefersDark() ? 'dark' : 'light';
  return preference;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Lets native form controls and scrollbars follow the theme too.
  root.style.colorScheme = theme;
}

// --- tiny module store so every consumer stays in sync -----------------------
let preference: ThemePreference = 'system';
let resolved: ResolvedTheme = 'light';
let initialised = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setPreferenceValue(next: ThemePreference) {
  preference = next;
  resolved = resolveTheme(next);
  applyTheme(resolved);

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage unavailable — the theme still applies for this session.
  }

  notify();
}

function initOnce() {
  if (initialised) return;
  initialised = true;

  preference = readStoredPreference();
  resolved = resolveTheme(preference);
  applyTheme(resolved);
}

export function useTheme() {
  initOnce();

  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Follow the OS while the preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return;

    let media: MediaQueryList;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }

    const onChange = () => {
      resolved = resolveTheme('system');
      applyTheme(resolved);
      notify();
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreferenceValue(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceValue(resolved === 'dark' ? 'light' : 'dark');
  }, []);

  return {
    /** What the user chose: light, dark, or follow the system. */
    preference,
    /** What is actually on screen right now. */
    theme: resolved,
    isDark: resolved === 'dark',
    setTheme,
    toggleTheme,
  };
}

export default useTheme;
