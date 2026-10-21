import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { Network } from '@capacitor/network';
import { useLanguage } from '../contexts/LanguageContext';

export function OfflineNotice() {
  const { lang } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    // Check initial network state
    Network.getStatus().then((status) => {
      setIsOnline(status.connected);
    }).catch(() => {
      setIsOnline(navigator.onLine);
    });

    // Listen to network state changes via Capacitor Network
    const listenerPromise = Network.addListener('networkStatusChange', (status) => {
      if (!status.connected && isOnline) {
        setIsOnline(false);
      } else if (status.connected && !isOnline) {
        setIsOnline(true);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 3000);
      }
    });

    // Fallback standard browser events
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  if (isOnline && !justReconnected) return null;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold text-white shadow-md transition-all duration-300 ${
        justReconnected
          ? 'bg-emerald-600 animate-fade-in'
          : 'bg-amber-600 animate-slide-down'
      }`}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.5rem)' }}
    >
      {justReconnected ? (
        <>
          <Wifi size={14} className="animate-pulse" />
          <span>{lang === 'ar' ? 'تمت استعادة الاتصال بالإنترنت' : 'Back online! Reconnected'}</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="animate-bounce" />
          <span>
            {lang === 'ar'
              ? 'لا يوجد اتصال بالإنترنت — وضع عدم الاتصال نشط'
              : 'No internet connection — Offline mode active'}
          </span>
        </>
      )}
    </div>
  );
}
