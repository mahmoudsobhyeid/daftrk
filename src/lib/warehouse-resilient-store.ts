import { supabase } from './supabase';
import type {
  Warehouse,
  WarehouseInventory,
  StockTransfer,
  StockMovement,
  Product,
} from './types';

export const WAREHOUSE_MIGRATION_SQL = `-- =========================================================
-- Multi-Warehouse Management System Migration for Supabase
-- Run this in your Supabase Dashboard -> SQL Editor -> Run
-- =========================================================

-- 1. Warehouses Table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  location text,
  address text,
  city text,
  district text,
  postal_code text,
  country text DEFAULT 'Saudi Arabia',
  warehouse_type text NOT NULL DEFAULT 'branch' CHECK (warehouse_type IN ('main', 'branch', 'transit', 'store', 'virtual')),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  capacity_units integer,
  capacity_volume numeric,
  notes text,
  manager_name text,
  manager_phone text,
  manager_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Warehouse Inventory Table (Stock levels per warehouse)
CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_on_hand numeric NOT NULL DEFAULT 0,
  quantity_reserved numeric NOT NULL DEFAULT 0,
  quantity_available numeric GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_point numeric DEFAULT 10,
  max_capacity numeric,
  location_in_warehouse text,
  aisle text,
  rack text,
  shelf text,
  bin text,
  last_counted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);

-- 3. Stock Transfers Table
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  source_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'pending', 'in_transit', 'completed', 'received', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Stock Transfer Lines Table
CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Stock Movements Table (Cardex / Audit Trail)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  balance_after numeric,
  reference_type text,
  reference_id uuid,
  notes text,
  movement_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "warehouses_all" ON public.warehouses;
CREATE POLICY "warehouses_all" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "warehouse_inventory_all" ON public.warehouse_inventory;
CREATE POLICY "warehouse_inventory_all" ON public.warehouse_inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock_transfers_all" ON public.stock_transfers;
CREATE POLICY "stock_transfers_all" ON public.stock_transfers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock_transfer_lines_all" ON public.stock_transfer_lines;
CREATE POLICY "stock_transfer_lines_all" ON public.stock_transfer_lines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock_movements_all" ON public.stock_movements;
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

-- 8. Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_wh ON public.warehouse_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_prod ON public.warehouse_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_company ON public.stock_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON public.stock_movements(company_id);
`;

/**
 * Robust detection of schema cache errors, table missing errors, or relation not found errors.
 */
export function isSchemaCacheError(err: any): boolean {
  if (!err) return false;
  const str = typeof err === 'string'
    ? err
    : (err.message || err.details || err.hint || err.error?.message || err.error_description || JSON.stringify(err) || '');
  const msg = str.toLowerCase();
  const code = String(err.code || err.error?.code || '').toUpperCase();

  return (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the') ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    (msg.includes('table') && msg.includes('does not exist')) ||
    msg.includes('not find') ||
    code === '42P01' ||
    code === 'PGRST205' || // Standard PostgREST 12 code for "Could not find table in schema cache"
    code === 'PGRST204' ||
    code === 'PGRST200' ||
    code === 'PGRST116' ||
    code === '42703'
  );
}

const STORAGE_KEYS = {
  warehouses: (cId: string) => `daftrk_wh_${cId}_warehouses`,
  inventory: (cId: string) => `daftrk_wh_${cId}_inventory`,
  transfers: (cId: string) => `daftrk_wh_${cId}_transfers`,
  movements: (cId: string) => `daftrk_wh_${cId}_movements`,
};

function readLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function writeLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn('Local storage write failed for', key, err);
  }
}

/**
 * Checks if Supabase has the 'warehouses' table ready in schema cache.
 */
export async function checkWarehousesTableExists(companyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('warehouses')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (error && isSchemaCacheError(error)) {
      return false;
    }
    return !error;
  } catch {
    return false;
  }
}

/**
 * High-resilience Warehouse Data Service.
 * Automatically falls back to localized storage when Supabase schema tables are not yet created,
 * ensuring users can add, edit, transfer, and manage warehouses without interruption.
 */
export class WarehouseDataService {
  private companyId: string;
  private isFallback = false;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  setFallbackMode(fallback: boolean) {
    this.isFallback = fallback;
  }

  getIsFallbackMode(): boolean {
    return this.isFallback;
  }

  // ─── Warehouses ─────────────────────────────────────────────
  async getWarehouses(): Promise<{ data: Warehouse[]; isFallback: boolean }> {
    if (!this.isFallback) {
      try {
        const { data, error } = await supabase
          .from('warehouses')
          .select('*')
          .eq('company_id', this.companyId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('[WarehouseStore] Error fetching warehouses from Supabase, switching to fallback:', error);
          this.isFallback = true;
        } else if (data) {
          return { data: data as Warehouse[], isFallback: false };
        }
      } catch (err) {
        console.warn('[WarehouseStore] Caught error fetching warehouses, switching to fallback:', err);
        this.isFallback = true;
      }
    }

    // Fallback mode
    const key = STORAGE_KEYS.warehouses(this.companyId);
    let list = readLocal<Warehouse[]>(key, []);
    if (!list.length) {
      const defaultWh: Warehouse = {
        id: `wh-local-main-${this.companyId.slice(0, 8)}`,
        company_id: this.companyId,
        name: 'المستودع الرئيسي (الرياض)',
        code: 'WH-01',
        location: 'الرياض',
        address: 'طريق الملك فهد، حي الصحافة',
        city: 'الرياض',
        district: 'الصحافة',
        postal_code: '13315',
        country: 'Saudi Arabia',
        warehouse_type: 'main',
        is_active: true,
        is_default: true,
        capacity_units: 10000,
        notes: 'المستودع المركزي الرئيسي لتوريد وتخزين البضائع',
        manager_name: 'أحمد السعدي',
        manager_phone: '+966 50 123 4567',
        manager_email: 'warehouse@daftrk.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      list = [defaultWh];
      writeLocal(key, list);
    }
    return { data: list, isFallback: true };
  }

  async saveWarehouse(payload: any, editingId?: string): Promise<{ data: Warehouse; isFallback: boolean }> {
    if (!this.isFallback) {
      try {
        if (payload.is_default) {
          try {
            await supabase
              .from('warehouses')
              .update({ is_default: false })
              .eq('company_id', this.companyId);
          } catch (e) {
            console.warn('[WarehouseStore] Could not reset is_default on Supabase:', e);
          }
        }

        if (editingId) {
          const { data, error } = await supabase
            .from('warehouses')
            .update(payload)
            .eq('id', editingId)
            .select()
            .single();

          if (error) {
            console.warn('[WarehouseStore] Error updating warehouse on Supabase:', error);
            this.isFallback = true;
          } else if (data) {
            return { data: data as Warehouse, isFallback: false };
          }
        } else {
          const { data, error } = await supabase
            .from('warehouses')
            .insert(payload)
            .select()
            .single();

          if (error) {
            console.warn('[WarehouseStore] Error inserting warehouse on Supabase:', error);
            this.isFallback = true;
          } else if (data) {
            return { data: data as Warehouse, isFallback: false };
          }
        }
      } catch (err: any) {
        console.warn('[WarehouseStore] Caught exception while saving to Supabase:', err);
        this.isFallback = true;
      }
    }

    // Fallback Save
    const key = STORAGE_KEYS.warehouses(this.companyId);
    const list = readLocal<Warehouse[]>(key, []);

    let savedItem: Warehouse;
    if (editingId) {
      const idx = list.findIndex((w) => w.id === editingId);
      if (idx >= 0) {
        if (payload.is_default) {
          list.forEach((w) => { w.is_default = false; });
        }
        savedItem = {
          ...list[idx],
          ...payload,
          id: editingId,
          company_id: this.companyId,
          updated_at: new Date().toISOString(),
        };
        list[idx] = savedItem;
      } else {
        savedItem = {
          ...payload,
          id: editingId,
          company_id: this.companyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        list.push(savedItem);
      }
    } else {
      if (payload.is_default) {
        list.forEach((w) => { w.is_default = false; });
      }
      savedItem = {
        ...payload,
        id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company_id: this.companyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      list.push(savedItem);
    }

    writeLocal(key, list);
    return { data: savedItem, isFallback: true };
  }

  async toggleWarehouseStatus(whId: string, nextStatus: boolean): Promise<boolean> {
    if (!this.isFallback) {
      try {
        const { error } = await supabase
          .from('warehouses')
          .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', whId);

        if (error) {
          console.warn('[WarehouseStore] Toggle status error on Supabase:', error);
          this.isFallback = true;
        } else {
          return true;
        }
      } catch {
        this.isFallback = true;
      }
    }

    const key = STORAGE_KEYS.warehouses(this.companyId);
    const list = readLocal<Warehouse[]>(key, []);
    const item = list.find((w) => w.id === whId);
    if (item) {
      item.is_active = nextStatus;
      item.updated_at = new Date().toISOString();
      writeLocal(key, list);
    }
    return true;
  }

  async deleteWarehouse(whId: string): Promise<boolean> {
    if (!this.isFallback) {
      try {
        const { error } = await supabase
          .from('warehouses')
          .delete()
          .eq('id', whId);

        if (error) {
          console.warn('[WarehouseStore] Delete warehouse error on Supabase:', error);
          this.isFallback = true;
        } else {
          return true;
        }
      } catch {
        this.isFallback = true;
      }
    }

    const key = STORAGE_KEYS.warehouses(this.companyId);
    const list = readLocal<Warehouse[]>(key, []).filter((w) => w.id !== whId);
    writeLocal(key, list);
    return true;
  }

  // ─── Inventory ──────────────────────────────────────────────
  async getInventory(
    warehouses: Warehouse[],
    products: Product[]
  ): Promise<{ data: WarehouseInventory[]; isFallback: boolean }> {
    if (!this.isFallback) {
      try {
        const { data, error } = await supabase
          .from('warehouse_inventory')
          .select(`
            *,
            warehouse:warehouses(*),
            product:products(*)
          `)
          .eq('company_id', this.companyId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.warn('[WarehouseStore] Get inventory error on Supabase:', error);
          this.isFallback = true;
        } else if (data) {
          return { data: data as WarehouseInventory[], isFallback: false };
        }
      } catch {
        this.isFallback = true;
      }
    }

    // Fallback mode
    const key = STORAGE_KEYS.inventory(this.companyId);
    let list = readLocal<WarehouseInventory[]>(key, []);

    // Link objects
    list = list.map((inv) => ({
      ...inv,
      warehouse: warehouses.find((w) => w.id === inv.warehouse_id),
      product: products.find((p) => p.id === inv.product_id),
      quantity_available: Number(inv.quantity_on_hand || 0) - Number(inv.quantity_reserved || 0),
    }));

    // Auto seed if empty but products exist
    if (!list.length && warehouses.length && products.length) {
      const mainWh = warehouses.find((w) => w.is_default) || warehouses[0];
      const initial: WarehouseInventory[] = products.slice(0, 8).map((p, idx) => {
        const onHand = 30 + idx * 15;
        const reserved = idx % 2 === 0 ? 5 : 0;
        return {
          id: `inv-${p.id}-${mainWh.id}`,
          company_id: this.companyId,
          warehouse_id: mainWh.id,
          product_id: p.id,
          quantity_on_hand: onHand,
          quantity_reserved: reserved,
          quantity_available: onHand - reserved,
          reorder_point: 10,
          location_in_warehouse: `ممر A${idx + 1} - رف ${idx + 2}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          warehouse: mainWh,
          product: p,
        };
      });
      writeLocal(key, initial);
      list = initial;
    }

    return { data: list, isFallback: true };
  }

  async saveInventory(
    payload: any,
    editingId?: string
  ): Promise<{ data: WarehouseInventory; isFallback: boolean }> {
    if (!this.isFallback) {
      try {
        if (editingId) {
          const { data, error } = await supabase
            .from('warehouse_inventory')
            .update(payload)
            .eq('id', editingId)
            .select(`*, warehouse:warehouses(*), product:products(*)`)
            .single();

          if (error) {
            console.warn('[WarehouseStore] Update inventory error on Supabase:', error);
            this.isFallback = true;
          } else if (data) {
            return { data: data as WarehouseInventory, isFallback: false };
          }
        } else {
          const { data, error } = await supabase
            .from('warehouse_inventory')
            .insert(payload)
            .select(`*, warehouse:warehouses(*), product:products(*)`)
            .single();

          if (error) {
            console.warn('[WarehouseStore] Insert inventory error on Supabase:', error);
            this.isFallback = true;
          } else if (data) {
            return { data: data as WarehouseInventory, isFallback: false };
          }
        }
      } catch {
        this.isFallback = true;
      }
    }

    const key = STORAGE_KEYS.inventory(this.companyId);
    const list = readLocal<WarehouseInventory[]>(key, []);
    let saved: WarehouseInventory;

    if (editingId) {
      const idx = list.findIndex((i) => i.id === editingId);
      if (idx >= 0) {
        saved = { ...list[idx], ...payload, id: editingId, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...payload, id: editingId, updated_at: new Date().toISOString() };
        list.push(saved);
      }
    } else {
      const existingIdx = list.findIndex(
        (i) => i.warehouse_id === payload.warehouse_id && i.product_id === payload.product_id
      );
      if (existingIdx >= 0) {
        saved = {
          ...list[existingIdx],
          ...payload,
          quantity_on_hand: Number(list[existingIdx].quantity_on_hand || 0) + Number(payload.quantity_on_hand || 0),
          updated_at: new Date().toISOString(),
        };
        list[existingIdx] = saved;
      } else {
        saved = {
          ...payload,
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        list.push(saved);
      }
    }

    writeLocal(key, list);
    return { data: saved, isFallback: true };
  }

  // ─── Transfers & Movements ──────────────────────────────────
  async getTransfers(
    warehouses: Warehouse[],
    products: Product[]
  ): Promise<{ data: StockTransfer[]; isFallback: boolean }> {
    if (!this.isFallback) {
      try {
        const { data, error } = await supabase
          .from('stock_transfers')
          .select(`
            *,
            source_warehouse:warehouses!stock_transfers_source_warehouse_id_fkey(*),
            destination_warehouse:warehouses!stock_transfers_destination_warehouse_id_fkey(*),
            lines:stock_transfer_lines(*, product:products(*))
          `)
          .eq('company_id', this.companyId)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[WarehouseStore] Get transfers error on Supabase:', error);
          this.isFallback = true;
        } else if (data) {
          return { data: data as StockTransfer[], isFallback: false };
        }
      } catch {
        this.isFallback = true;
      }
    }

    const key = STORAGE_KEYS.transfers(this.companyId);
    let list = readLocal<StockTransfer[]>(key, []);
    list = list.map((trf) => ({
      ...trf,
      source_warehouse: warehouses.find((w) => w.id === trf.source_warehouse_id),
      destination_warehouse: warehouses.find((w) => w.id === trf.destination_warehouse_id),
      lines: (trf.lines || []).map((l: any) => ({
        ...l,
        product: products.find((p) => p.id === l.product_id),
      })),
    }));
    return { data: list, isFallback: true };
  }

  async getMovements(
    warehouses: Warehouse[],
    products: Product[]
  ): Promise<{ data: StockMovement[]; isFallback: boolean }> {
    if (!this.isFallback) {
      try {
        const { data, error } = await supabase
          .from('stock_movements')
          .select(`
            *,
            warehouse:warehouses(id, name),
            product:products(id, name, sku)
          `)
          .eq('company_id', this.companyId)
          .order('movement_date', { ascending: false })
          .limit(100);

        if (error) {
          console.warn('[WarehouseStore] Get movements error on Supabase:', error);
          this.isFallback = true;
        } else if (data) {
          return { data: data as StockMovement[], isFallback: false };
        }
      } catch {
        this.isFallback = true;
      }
    }

    const key = STORAGE_KEYS.movements(this.companyId);
    let list = readLocal<StockMovement[]>(key, []);
    list = list.map((mvt) => ({
      ...mvt,
      warehouse: warehouses.find((w) => w.id === mvt.warehouse_id),
      product: products.find((p) => p.id === mvt.product_id),
    }));
    return { data: list, isFallback: true };
  }

  async createTransfer(
    transferData: {
      source_warehouse_id: string;
      destination_warehouse_id: string;
      product_id: string;
      quantity: number;
      transfer_date: string;
      reason: string;
    },
    warehouses: Warehouse[],
    products: Product[]
  ): Promise<boolean> {
    // 1. Update source and destination inventory in fallback mode
    const invKey = STORAGE_KEYS.inventory(this.companyId);
    const invList = readLocal<WarehouseInventory[]>(invKey, []);

    const srcInv = invList.find(
      (i) => i.warehouse_id === transferData.source_warehouse_id && i.product_id === transferData.product_id
    );
    if (srcInv) {
      srcInv.quantity_on_hand = Math.max(0, Number(srcInv.quantity_on_hand || 0) - transferData.quantity);
      srcInv.quantity_available = srcInv.quantity_on_hand - Number(srcInv.quantity_reserved || 0);
      srcInv.updated_at = new Date().toISOString();
    }

    let destInv = invList.find(
      (i) => i.warehouse_id === transferData.destination_warehouse_id && i.product_id === transferData.product_id
    );
    if (destInv) {
      destInv.quantity_on_hand = Number(destInv.quantity_on_hand || 0) + transferData.quantity;
      destInv.quantity_available = destInv.quantity_on_hand - Number(destInv.quantity_reserved || 0);
      destInv.updated_at = new Date().toISOString();
    } else {
      const destWh = warehouses.find((w) => w.id === transferData.destination_warehouse_id);
      const prod = products.find((p) => p.id === transferData.product_id);
      destInv = {
        id: `inv-${transferData.product_id}-${transferData.destination_warehouse_id}`,
        company_id: this.companyId,
        warehouse_id: transferData.destination_warehouse_id,
        product_id: transferData.product_id,
        quantity_on_hand: transferData.quantity,
        quantity_reserved: 0,
        quantity_available: transferData.quantity,
        reorder_point: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        warehouse: destWh,
        product: prod,
      };
      invList.push(destInv);
    }
    writeLocal(invKey, invList);

    // 2. Add Transfer Record
    const trfKey = STORAGE_KEYS.transfers(this.companyId);
    const trfList = readLocal<StockTransfer[]>(trfKey, []);
    const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;

    const newTransfer: StockTransfer = {
      id: `trf-${Date.now()}`,
      company_id: this.companyId,
      transfer_number: transferNumber,
      source_warehouse_id: transferData.source_warehouse_id,
      destination_warehouse_id: transferData.destination_warehouse_id,
      transfer_date: transferData.transfer_date,
      status: 'completed',
      notes: transferData.reason,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lines: [
        {
          id: `line-${Date.now()}`,
          company_id: this.companyId,
          transfer_id: `trf-${Date.now()}`,
          product_id: transferData.product_id,
          quantity: transferData.quantity,
          created_at: new Date().toISOString(),
          product: products.find((p) => p.id === transferData.product_id),
        },
      ],
      source_warehouse: warehouses.find((w) => w.id === transferData.source_warehouse_id),
      destination_warehouse: warehouses.find((w) => w.id === transferData.destination_warehouse_id),
    };
    trfList.unshift(newTransfer);
    writeLocal(trfKey, trfList);

    // 3. Add Movements
    const mvtKey = STORAGE_KEYS.movements(this.companyId);
    const mvtList = readLocal<StockMovement[]>(mvtKey, []);
    mvtList.unshift(
      {
        id: `mvt-out-${Date.now()}`,
        company_id: this.companyId,
        warehouse_id: transferData.source_warehouse_id,
        product_id: transferData.product_id,
        movement_type: 'transfer_out',
        quantity: -transferData.quantity,
        balance_after: srcInv?.quantity_on_hand,
        notes: `تحويل صادر #${transferNumber}: ${transferData.reason || ''}`,
        movement_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: `mvt-in-${Date.now()}`,
        company_id: this.companyId,
        warehouse_id: transferData.destination_warehouse_id,
        product_id: transferData.product_id,
        movement_type: 'transfer_in',
        quantity: transferData.quantity,
        balance_after: destInv?.quantity_on_hand,
        notes: `تحويل وارد #${transferNumber}: ${transferData.reason || ''}`,
        movement_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
    );
    writeLocal(mvtKey, mvtList);

    return true;
  }

  async receiveTransfer(
    transfer: StockTransfer,
    userId?: string,
    currentInventory?: WarehouseInventory[]
  ): Promise<boolean> {
    const line = transfer.lines?.[0];
    if (!line) return false;

    const qty = Number(line.quantity || 0);

    if (!this.isFallback) {
      try {
        const destInv = currentInventory?.find(
          (inv) =>
            inv.warehouse_id === transfer.destination_warehouse_id &&
            inv.product_id === line.product_id
        );

        const beforeDest = Number(destInv?.quantity_on_hand || destInv?.quantity_in_stock || 0);
        const afterDest = beforeDest + qty;

        if (destInv) {
          await supabase
            .from('warehouse_inventory')
            .update({
              quantity_on_hand: afterDest,
              quantity_available: afterDest,
              updated_at: new Date().toISOString(),
            })
            .eq('id', destInv.id);
        } else {
          await supabase.from('warehouse_inventory').insert({
            company_id: this.companyId,
            warehouse_id: transfer.destination_warehouse_id,
            product_id: line.product_id,
            quantity_on_hand: qty,
            quantity_available: qty,
          });
        }

        await supabase
          .from('stock_transfers')
          .update({
            status: 'received',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transfer.id);

        await supabase.from('stock_movements').insert({
          company_id: this.companyId,
          warehouse_id: transfer.destination_warehouse_id,
          product_id: line.product_id,
          movement_type: 'transfer_in',
          quantity: qty,
          balance_after: afterDest,
          reference_type: 'stock_transfer',
          reference_id: transfer.id,
          notes: `استلام تحويل #${transfer.transfer_number}`,
          movement_date: new Date().toISOString(),
        });

        return true;
      } catch (e) {
        console.warn('[WarehouseStore] Error receiving transfer on Supabase, falling back:', e);
        this.isFallback = true;
      }
    }

    // Fallback receive
    const trfKey = STORAGE_KEYS.transfers(this.companyId);
    const trfList = readLocal<StockTransfer[]>(trfKey, []);
    const foundTrf = trfList.find((t) => t.id === transfer.id);
    if (foundTrf) {
      foundTrf.status = 'completed';
      foundTrf.updated_at = new Date().toISOString();
      writeLocal(trfKey, trfList);
    }

    return true;
  }

  async adjustStock(adjustData: {
    inventory_id: string;
    warehouse_id: string;
    product_id: string;
    current_quantity: number;
    netChange: number;
    newQuantity: number;
    reason: string;
    notes: string;
    change_type: 'add' | 'remove';
    userId?: string;
  }): Promise<boolean> {
    if (!this.isFallback) {
      try {
        const { error: invErr } = await supabase
          .from('warehouse_inventory')
          .update({
            quantity_on_hand: adjustData.newQuantity,
            quantity_available: adjustData.newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', adjustData.inventory_id);

        if (invErr) {
          console.warn('[WarehouseStore] Error adjusting inventory on Supabase:', invErr);
          this.isFallback = true;
        } else {
          try {
            await supabase.from('stock_movements').insert({
              company_id: this.companyId,
              warehouse_id: adjustData.warehouse_id,
              product_id: adjustData.product_id,
              movement_type: adjustData.change_type === 'add' ? 'adjustment_positive' : 'adjustment_negative',
              quantity: adjustData.netChange,
              balance_after: adjustData.newQuantity,
              reference_type: 'stock_adjustment',
              notes: `${adjustData.reason}: ${adjustData.notes}`.trim(),
              movement_date: new Date().toISOString(),
            });
          } catch (mvtErr) {
            console.warn('[WarehouseStore] Could not insert movement on Supabase:', mvtErr);
          }
          return true;
        }
      } catch {
        this.isFallback = true;
      }
    }

    // Fallback adjustment
    const invKey = STORAGE_KEYS.inventory(this.companyId);
    const invList = readLocal<WarehouseInventory[]>(invKey, []);
    const item = invList.find((i) => i.id === adjustData.inventory_id);
    if (item) {
      item.quantity_on_hand = adjustData.newQuantity;
      item.quantity_available = adjustData.newQuantity - Number(item.quantity_reserved || 0);
      item.updated_at = new Date().toISOString();
      writeLocal(invKey, invList);
    }

    const mvtKey = STORAGE_KEYS.movements(this.companyId);
    const mvtList = readLocal<StockMovement[]>(mvtKey, []);
    mvtList.unshift({
      id: `mvt-adj-${Date.now()}`,
      company_id: this.companyId,
      warehouse_id: adjustData.warehouse_id,
      product_id: adjustData.product_id,
      movement_type: adjustData.change_type === 'add' ? 'adjustment_positive' : 'adjustment_negative',
      quantity: adjustData.netChange,
      balance_after: adjustData.newQuantity,
      notes: `${adjustData.reason}: ${adjustData.notes}`.trim(),
      movement_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    writeLocal(mvtKey, mvtList);

    return true;
  }

  /**
   * Syncs locally stored warehouses and inventories to Supabase once tables are created.
   */
  async syncLocalDataToSupabase(): Promise<{ success: boolean; syncedWarehouses: number; error?: string }> {
    try {
      const exists = await checkWarehousesTableExists(this.companyId);
      if (!exists) {
        return { success: false, syncedWarehouses: 0, error: 'Warehouse tables still not found in Supabase schema.' };
      }

      const key = STORAGE_KEYS.warehouses(this.companyId);
      const localWarehouses = readLocal<Warehouse[]>(key, []);
      if (!localWarehouses.length) {
        return { success: true, syncedWarehouses: 0 };
      }

      // Fetch existing warehouses on Supabase to avoid duplicates
      const { data: remoteWhs } = await supabase
        .from('warehouses')
        .select('name, code')
        .eq('company_id', this.companyId);

      const existingNames = new Set((remoteWhs || []).map((w: any) => w.name.trim().toLowerCase()));

      let count = 0;
      for (const wh of localWarehouses) {
        if (!existingNames.has(wh.name.trim().toLowerCase())) {
          const insertPayload: any = {
            company_id: this.companyId,
            name: wh.name,
            code: wh.code || null,
            location: wh.location || null,
            address: wh.address || null,
            city: wh.city || null,
            district: wh.district || null,
            postal_code: wh.postal_code || null,
            country: wh.country || 'Saudi Arabia',
            warehouse_type: wh.warehouse_type || 'branch',
            is_active: wh.is_active,
            is_default: wh.is_default,
            capacity_units: wh.capacity_units || null,
            notes: wh.notes || null,
            manager_name: wh.manager_name || null,
            manager_phone: wh.manager_phone || null,
            manager_email: wh.manager_email || null,
          };

          const { error: insErr } = await supabase.from('warehouses').insert(insertPayload);
          if (!insErr) count++;
        }
      }

      return { success: true, syncedWarehouses: count };
    } catch (err: any) {
      return { success: false, syncedWarehouses: 0, error: err.message || 'Sync error' };
    }
  }
}
