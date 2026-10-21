import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Keyboard } from '@capacitor/keyboard';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/**
 * Initializes native Capacitor features for mobile Android & iOS apps.
 */
export async function initializeCapacitor(options?: {
  isDark?: boolean;
  onBackButton?: () => boolean; // return true if handled
  onNetworkChange?: (connected: boolean) => void;
}) {
  if (!isNative) return;

  try {
    // 1. Hide Splash Screen after React app mount
    await SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});

    // 2. Configure Status Bar
    await updateNativeStatusBar(options?.isDark ?? false).catch(() => {});

    // 3. Android Hardware Back Button
    if (platform === 'android') {
      App.addListener('backButton', ({ canGoBack }) => {
        // If caller provided a back button handler (e.g. closing a modal or drawer)
        if (options?.onBackButton && options.onBackButton()) {
          return;
        }

        if (canGoBack) {
          window.history.back();
        } else {
          // Confirm before exiting app or exit
          App.exitApp();
        }
      });
    }

    // 4. Network status listener
    Network.addListener('networkStatusChange', (status) => {
      if (options?.onNetworkChange) {
        options.onNetworkChange(status.connected);
      }
    });

    // 5. Keyboard adjustments
    if (platform === 'ios' || platform === 'android') {
      Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Capacitor] Initialization note:', err);
  }
}

/**
 * Updates the native status bar to match theme (dark/light)
 */
export async function updateNativeStatusBar(isDark: boolean) {
  if (!isNative) return;
  try {
    if (isDark) {
      await StatusBar.setStyle({ style: Style.Dark });
      if (platform === 'android') {
        await StatusBar.setBackgroundColor({ color: '#090d16' });
      }
    } else {
      await StatusBar.setStyle({ style: Style.Light });
      if (platform === 'android') {
        await StatusBar.setBackgroundColor({ color: '#1d4ed8' });
      }
    }
  } catch (err) {
    // ignore in browser
  }
}
