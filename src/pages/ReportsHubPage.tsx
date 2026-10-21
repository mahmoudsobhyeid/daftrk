/**
 * Reports Hub Page
 *
 * Central dashboard for all reports with KPI widgets
 */

import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCompany } from '../contexts/CompanyContext';
import * as XLSX from 'xlsx';
import {
  BarChart3, TrendingUp, Users, Building2, Package, FileText,
  ShieldCheck, DollarSign, Calendar, ArrowRight, Download,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { KPICard } from '../components/reports/KPICard';
import {
  getSalesSummary,
  getCustomerAging,
  getRentalOccupancy,
  getInventorySummary,
  getZatcaClearanceSummary,
  getProfitLossSummary,
  type DateRange,
} from '../lib/analytics';

export function ReportsHubPage() {
  const { t } = useLanguage();
  const { company } = useCompany();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({});

  // KPI Data
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [customerAging, setCustomerAging] = useState<any[]>([]);
  const [rentalOccupancy, setRentalOccupancy] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [zatcaSummary, setZatcaSummary] = useState<any>(null);
  const [profitLoss, setProfitLoss] = useState<any>(null);

  useEffect(() => {
    if (company?.id) {
      loadReports();
    }
  }, [company?.id, dateRange]);

  const loadReports = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const [sales, aging, occupancy, inventory, zatca, pl] = await Promise.all([
        getSalesSummary(company.id, dateRange),
        getCustomerAging(company.id),
        getRentalOccupancy(company.id),
        getInventorySummary(company.id),
        getZatcaClearanceSummary(company.id, dateRange),
        getProfitLossSummary(company.id, dateRange),
      ]);

      setSalesSummary(sales);
      setCustomerAging(aging);
      setRentalOccupancy(occupancy);
      setInventorySummary(inventory);
      setZatcaSummary(zatca);
      setProfitLoss(pl);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalOccupancy = () => {
    if (!rentalOccupancy.length) return 0;
    const totalUnits = rentalOccupancy.reduce((sum, r) => sum + r.total_units, 0);
    const occupiedUnits = rentalOccupancy.reduce((sum, r) => sum + r.occupied_units, 0);
    return totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;
  };

  const calculateTotalInventoryValue = () => {
    if (!inventorySummary.length) return 0;
    return inventorySummary.reduce((sum, i) => sum + (i.total_value || 0), 0);
  };

  const calculateTotalOutstanding = () => {
    if (!customerAging.length) return 0;
    return customerAging.reduce((sum, c) => sum + (c.total_outstanding || 0), 0);
  };

  const downloadReportExcel = (reportId: string, reportTitle: string) => {
    let data: any[] = [];
    let filename = `${reportId}-report.xlsx`;

    switch (reportId) {
      case 'sales':
        data = [
          { Metric: 'Total Sales', Value: salesSummary?.total_sales || 0 },
          { Metric: 'Total Invoices', Value: salesSummary?.total_invoices || 0 },
          { Metric: 'Paid Invoices', Value: salesSummary?.paid_invoices || 0 },
          { Metric: 'Pending Invoices', Value: salesSummary?.pending_invoices || 0 },
        ];
        filename = 'sales-report.xlsx';
        break;
      case 'customers':
        data = customerAging.map((c: any) => ({
          Customer: c.customer_name || 'Unknown',
          Outstanding: c.total_outstanding || 0,
          'Days Overdue': c.days_overdue || 0,
        }));
        filename = 'customers-report.xlsx';
        break;
      case 'rental':
        data = rentalOccupancy.map((r: any) => ({
          Property: r.property_name || 'Unknown',
          'Total Units': r.total_units || 0,
          'Occupied Units': r.occupied_units || 0,
          'Occupancy %': r.occupancy_rate || 0,
        }));
        filename = 'rental-report.xlsx';
        break;
      case 'inventory':
        data = inventorySummary.map((i: any) => ({
          Product: i.product_name || 'Unknown',
          Quantity: i.quantity || 0,
          'Total Value': i.total_value || 0,
        }));
        filename = 'inventory-report.xlsx';
        break;
      case 'zatca':
        data = [
          { Metric: 'Cleared Invoices', Value: zatcaSummary?.cleared_invoices || 0 },
          { Metric: 'Pending Clearance', Value: zatcaSummary?.pending_clearance || 0 },
          { Metric: 'Failed Clearance', Value: zatcaSummary?.failed_clearance || 0 },
        ];
        filename = 'zatca-report.xlsx';
        break;
      case 'financial':
        data = [
          { Metric: 'Total Revenue', Value: profitLoss?.total_revenue || 0 },
          { Metric: 'Total Expenses', Value: profitLoss?.total_expenses || 0 },
          { Metric: 'Net Profit', Value: profitLoss?.net_profit || 0 },
          { Metric: 'Gross Profit', Value: profitLoss?.gross_profit || 0 },
        ];
        filename = 'financial-report.xlsx';
        break;
      default:
        return;
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle);

    // Download file
    XLSX.writeFile(workbook, filename);
  };

  const reportSections = [
    {
      id: 'sales',
      title: t('reports.salesInvoicing') || 'Sales & Invoicing',
      icon: <BarChart3 size={24} />,
      description: t('reports.salesDesc') || 'Total sales, invoice status, revenue tracking',
      kpi: salesSummary?.total_sales || 0,
      kpiLabel: 'Total Sales',
      color: 'bg-primary-50 dark:bg-primary-900/20',
    },
    {
      id: 'customers',
      title: t('reports.customersTenants') || 'Customers & Tenants',
      icon: <Users size={24} />,
      description: t('reports.customersDesc') || 'Customer statements, aging receivables',
      kpi: calculateTotalOutstanding(),
      kpiLabel: 'Outstanding',
      color: 'bg-accent-50 dark:bg-accent-900/20',
    },
    {
      id: 'rental',
      title: t('reports.rentalOperations') || 'Rental Operations',
      icon: <Building2 size={24} />,
      description: t('reports.rentalDesc') || 'Occupancy rates, unit availability',
      kpi: calculateTotalOccupancy(),
      kpiLabel: 'Occupancy %',
      color: 'bg-success-50 dark:bg-success-900/20',
    },
    {
      id: 'inventory',
      title: t('reports.inventoryWarehouse') || 'Inventory & Warehouse',
      icon: <Package size={24} />,
      description: t('reports.inventoryDesc') || 'Stock levels, valuation, movements',
      kpi: calculateTotalInventoryValue(),
      kpiLabel: 'Total Value',
      color: 'bg-warning-50 dark:bg-warning-900/20',
    },
    {
      id: 'zatca',
      title: t('reports.zatcaTax') || 'ZATCA & Tax',
      icon: <ShieldCheck size={24} />,
      description: t('reports.zatcaDesc') || 'Clearance status, tax returns',
      kpi: zatcaSummary?.cleared_invoices || 0,
      kpiLabel: 'Cleared',
      color: 'bg-error-50 dark:bg-error-900/20',
    },
    {
      id: 'financial',
      title: t('reports.financialJournal') || 'Financial & Journal',
      icon: <DollarSign size={24} />,
      description: t('reports.financialDesc') || 'General ledger, P&L, cash flow',
      kpi: profitLoss?.net_profit || 0,
      kpiLabel: 'Net Profit',
      color: 'bg-secondary-50 dark:bg-secondary-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          {t('reports.title') || 'Reports & Analytics'}
        </h1>
        <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
          {t('reports.subtitle') || 'Comprehensive business insights and reporting'}
        </p>
      </div>

      {/* Quick KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('reports.totalSales') || 'Total Sales'}
          value={salesSummary?.total_sales || 0}
          icon={<DollarSign size={20} />}
          loading={loading}
        />
        <KPICard
          title={t('reports.totalInvoices') || 'Total Invoices'}
          value={salesSummary?.total_invoices || 0}
          icon={<FileText size={20} />}
          loading={loading}
        />
        <KPICard
          title={t('reports.occupancyRate') || 'Occupancy Rate'}
          value={`${calculateTotalOccupancy()}%`}
          icon={<Building2 size={20} />}
          loading={loading}
        />
        <KPICard
          title={t('reports.netProfit') || 'Net Profit'}
          value={profitLoss?.net_profit || 0}
          icon={<TrendingUp size={20} />}
          loading={loading}
        />
      </div>

      {/* Report Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportSections.map((section) => (
          <Card key={section.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${section.color}`}>
                <div className="text-primary-600 dark:text-primary-400">{section.icon}</div>
                <div className="flex-1">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-5">
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                {section.description}
              </p>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-secondary-500">{section.kpiLabel}</p>
                  <p className="text-lg font-bold text-secondary-900 dark:text-secondary-100">
                    {typeof section.kpi === 'number' ? section.kpi.toLocaleString() : section.kpi}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => downloadReportExcel(section.id, section.title)}
              >
                <Download size={14} />
                {t('reports.downloadExcel') || 'Download Excel'}
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Quick Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle icon={<Calendar size={18} />}>
            {t('reports.dateRange') || 'Date Range'}
          </CardTitle>
        </CardHeader>
        <CardBody className="p-5">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!dateRange.startDate ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDateRange({})}
            >
              {t('reports.allTime') || 'All Time'}
            </Button>
            <Button
              variant={dateRange.startDate === new Date().toISOString().split('T')[0] ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setDateRange({ startDate: today, endDate: today });
              }}
            >
              {t('reports.today') || 'Today'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const today = now.toISOString().split('T')[0];
                setDateRange({ startDate: monthStart, endDate: today });
              }}
            >
              {t('reports.thisMonth') || 'This Month'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                setDateRange({ startDate: monthStart, endDate: monthEnd });
              }}
            >
              {t('reports.lastMonth') || 'Last Month'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
