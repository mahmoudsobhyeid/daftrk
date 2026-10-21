import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Search, X, MessageCircle, ChevronDown } from 'lucide-react';

const FAQ = [
  { q: 'How do I add a property?', a: 'Navigate to Properties in the sidebar, click "Add Property", fill in the name, type (building/apartment/commercial), and address.' },
  { q: 'How do I create a unit under a property?', a: 'Open a property, click "Units" to expand, then "Add Unit". Enter the unit number, rent amount, and vacancy status.' },
  { q: 'How does ZATCA compliance work?', a: 'Every invoice is automatically encoded with TLV Base64 QR data containing seller name, VAT number, timestamp, total with VAT, and VAT total — meeting ZATCA Phase 1/2 requirements.' },
  { q: 'How do I send an invoice via WhatsApp?', a: 'Open any invoice, click the WhatsApp button. A pre-filled message with invoice details is sent to the tenant\'s phone number via wa.me.' },
  { q: 'How do I manage my team?', a: 'Go to Team in the sidebar. Invite members by email, assign roles (owner/admin/agent), and remove members as needed.' },
  { q: 'What are the subscription plans?', a: 'A single Pro plan is available at $70/month or $300/year. Cancel anytime through the Manage Subscription button.' },
  { q: 'How do lease payment schedules work?', a: 'When creating a lease, choose monthly, quarterly, or yearly frequency. The system auto-generates a full payment schedule preview from start to end date.' },
];

const SUPPORT_WHATSAPP = '966500000000';

export function SupportHub() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = FAQ.filter((f) =>
    f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="fixed bottom-5 end-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 sm:w-96 max-h-[480px] flex flex-col rounded-2xl bg-white dark:bg-secondary-900 shadow-2xl border border-secondary-200 dark:border-secondary-800 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} />
              <span className="font-bold text-sm">Help & Support</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-800">
            <div className="relative">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-secondary-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search FAQ..."
                className="input ps-9 text-sm py-2"
              />
            </div>
          </div>

          {/* FAQ List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-secondary-400">No results found</div>
            ) : (
              filtered.map((f, i) => (
                <div key={i} className="rounded-lg mb-1">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-start text-sm font-medium text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-800 rounded-lg transition-colors"
                  >
                    <span>{f.q}</span>
                    <ChevronDown size={14} className={`shrink-0 text-secondary-400 transition-transform ${expandedIdx === i ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedIdx === i && (
                    <p className="px-3 pb-3 text-xs text-secondary-500 dark:text-secondary-400 leading-relaxed">{f.a}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* WhatsApp Support */}
          <div className="px-4 py-3 border-t border-secondary-200 dark:border-secondary-800">
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hi, I need help with the Real Estate ERP.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-success-500 hover:bg-success-600 text-white text-sm font-bold py-2.5 transition-colors"
            >
              <MessageCircle size={16} /> Contact WhatsApp Support
            </a>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/30 transition-all hover:scale-105 active:scale-95"
        aria-label="Help & Support"
      >
        {open ? <X size={22} /> : <HelpCircle size={22} />}
      </button>
    </div>
  );
}
