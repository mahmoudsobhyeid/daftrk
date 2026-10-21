import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCompany } from '../contexts/CompanyContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, Bell, X } from 'lucide-react';

interface LowStockAlert {
  id: string;
  product_id: string;
  product: { name: string };
  current_quantity: number;
  threshold_quantity: number;
  is_acknowledged: boolean;
}

export function LowStockNotificationBell() {
  const { t } = useLanguage();
  const { company } = useCompany();
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company?.id) {
      fetchAlerts();
      // Poll for alerts every 30 seconds
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [company?.id]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('low_stock_alerts')
        .select(`
          id,
          product_id,
          current_quantity,
          threshold_quantity,
          is_acknowledged,
          product:products(name)
        `)
        .eq('company_id', company?.id)
        .eq('is_active', true)
        .eq('is_acknowledged', false)
        .order('triggered_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('low_stock_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const unacknowledgedCount = alerts.filter((a) => !a.is_acknowledged).length;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-secondary-100 dark:hover:bg-secondary-800 rounded-lg transition-colors"
        title={t('common.notifications') || 'الإشعارات'}
      >
        <Bell size={20} className="text-secondary-600 dark:text-secondary-400" />
        {unacknowledgedCount > 0 && (
          <span className="absolute top-0 end-0 h-5 w-5 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute end-0 mt-2 w-80 bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-700 shadow-lg z-50">
          <div className="p-4 border-b border-secondary-200 dark:border-secondary-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-secondary-800 dark:text-secondary-100">
                إشعارات نقص المخزون
              </h3>
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1 hover:bg-secondary-100 dark:hover:bg-secondary-800 rounded transition-colors"
              >
                <X size={16} className="text-secondary-500" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="mx-auto mb-2 text-secondary-300 dark:text-secondary-700" />
                <p className="text-sm text-secondary-500 dark:text-secondary-400">
                  لا توجد إشعارات حالياً
                </p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-200 dark:divide-secondary-700">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <AlertCircle size={18} className="text-warning-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-secondary-800 dark:text-secondary-100 truncate">
                          {alert.product.name}
                        </p>
                        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-0.5">
                          المتوفر: <span className="font-semibold">{alert.current_quantity}</span> | الحد الأدنى: <span className="font-semibold">{alert.threshold_quantity}</span>
                        </p>
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="mt-2 text-xs px-3 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                        >
                          تأكيد
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-secondary-200 dark:border-secondary-700 text-center">
            <a
              href="/warehouse"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              اذهب إلى المستودع →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
