import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Building2, DoorOpen, Receipt, Users } from 'lucide-react';

const TOUR_KEY = 're_erp_has_seen_tour';

const steps = [
  {
    element: '[data-tour="nav-properties"]',
    popover: {
      title: '1. Add Properties',
      description: 'Start by adding your buildings, apartments, or commercial spaces here.',
      side: 'right' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="nav-properties"]',
    popover: {
      title: '2. Create Units',
      description: 'Inside each property, add units with rent amounts and vacancy status.',
      side: 'right' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="nav-re-invoices"]',
    popover: {
      title: '3. Issue ZATCA Invoices',
      description: 'Generate rent invoices with automatic 15% VAT and ZATCA QR codes.',
      side: 'right' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="nav-team"]',
    popover: {
      title: '4. Manage Your Team',
      description: 'Invite agents and admins, and control who can do what.',
      side: 'right' as const,
      align: 'center' as const,
    },
  },
];

export function OnboardingTour() {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const d = driver({
        showProgress: true,
        steps,
        progressText: '{{current}} of {{total}}',
        doneBtnText: 'Got it!',
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        onDestroyed: () => localStorage.setItem(TOUR_KEY, 'true'),
      });
      driverRef.current = d;
      const timer = setTimeout(() => d.drive(), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}

export function startTour() {
  localStorage.removeItem(TOUR_KEY);
  const d = driver({
    showProgress: true,
    steps,
    progressText: '{{current}} of {{total}}',
    doneBtnText: 'Got it!',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    onDestroyed: () => localStorage.setItem(TOUR_KEY, 'true'),
  });
  d.drive();
}
