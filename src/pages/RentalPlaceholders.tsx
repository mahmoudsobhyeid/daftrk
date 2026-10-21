import { ClipboardList, Settings as SettingsIcon } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/Feedback';
import { useLanguage } from '../contexts/LanguageContext';

interface PlaceholderProps {
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
}

export function RentalPlaceholder({ titleKey, descKey, icon }: PlaceholderProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">{t(titleKey)}</h1>
        <p className="text-sm text-secondary-500 mt-1">{t(descKey)}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t(titleKey)}</CardTitle></CardHeader>
        <CardBody>
          <EmptyState
            icon={icon}
            title={t('rental.comingSoon')}
            description={t('rental.comingSoonDesc')}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export function BookingOrdersPage() {
  return <RentalPlaceholder titleKey="rental.bookingOrders" descKey="rental.bookingOrdersDesc" icon={<ClipboardList size={28} />} />;
}

export function RentalSettingsPage() {
  return <RentalPlaceholder titleKey="rental.settings" descKey="rental.rentalSettingsDesc" icon={<SettingsIcon size={28} />} />;
}
