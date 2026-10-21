/**
 * Inventory Service - Stock Movement & Accounting Integration
 *
 * Handles all inventory operations with automatic double-entry accounting:
 * - Stock movements (purchases, sales, transfers, adjustments)
 * - Automatic GL journal entry creation
 * - FIFO/LIFO cost calculation
 * - Multi-warehouse support
 * - Stocktaking and adjustments
 */

import { supabase } from '../supabase';

export interface StockMovementInput {
  companyId: string;
  warehouseId: string;
  productId: string;
  movementType: 'purchase_receipt' | 'sale_dispatch' | 'sale_return' | 'purchase_return' 
                | 'transfer_out' | 'transfer_in' | 'adjustment_positive' | 'adjustment_negative'
                | 'damage' | 'expiry' | 'production' | 'consumption';
  quantityChange: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  performedBy?: string;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface StockMovementResult {
  success: boolean;
  movementId?: string;
  error?: string;
}

export interface StockTransferInput {
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  transferDate: string;
  expectedDeliveryDate?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    batchNumber?: string;
    lotNumber?: string;
    expiryDate?: string;
  }>;
  notes?: string;
  createdBy?: string;
}

export interface StockAdjustmentInput {
  companyId: string;
  warehouseId: string;
  adjustmentType: 'physical_count' | 'write_off' | 'correction' | 'loss' | 'gain';
  adjustmentDate: string;
  items: Array<{
    productId: string;
    systemQuantity: number;
    physicalQuantity: number;
    unitCost: number;
    batchNumber?: string;
    lotNumber?: string;
    expiryDate?: string;
    notes?: string;
  }>;
  notes?: string;
  reasonCode?: string;
  reasonDescription?: string;
  createdBy?: string;
}

/**
 * Record a stock movement with automatic GL accounting
 */
export async function recordStockMovement(input: StockMovementInput): Promise<StockMovementResult> {
  try {
    const { data, error } = await supabase.rpc('record_stock_movement', {
      p_company_id: input.companyId,
      p_warehouse_id: input.warehouseId,
      p_product_id: input.productId,
      p_movement_type: input.movementType,
      p_quantity_change: input.quantityChange,
      p_unit_cost: input.unitCost || 0,
      p_reference_type: input.referenceType,
      p_reference_id: input.referenceId,
      p_reference_number: input.referenceNumber,
      p_performed_by: input.performedBy,
      p_batch_number: input.batchNumber,
      p_lot_number: input.lotNumber,
      p_expiry_date: input.expiryDate,
      p_notes: input.notes,
    });

    if (error) throw error;

    return {
      success: true,
      movementId: data as string,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record stock movement',
    };
  }
}

/**
 * Process a sales invoice - deduct stock from warehouse
 */
export async function processSalesInvoiceStock(
  invoiceId: string,
  companyId: string,
  warehouseId: string,
  items: Array<{
    productId: string;
    quantity: number;
    unitCost?: number;
  }>,
  userId?: string
): Promise<{ success: boolean; deducted: number; errors: string[] }> {
  const errors: string[] = [];
  let deducted = 0;

  for (const item of items) {
    // Check stock availability
    const { data: inventory } = await supabase
      .from('warehouse_inventory')
      .select('quantity_available')
      .eq('company_id', companyId)
      .eq('warehouse_id', warehouseId)
      .eq('product_id', item.productId)
      .single();

    if (!inventory) {
      errors.push(`Product ${item.productId} not found in warehouse inventory`);
      continue;
    }

    if (inventory.quantity_available < item.quantity) {
      errors.push(`Insufficient stock for product ${item.productId}. Available: ${inventory.quantity_available}, Required: ${item.quantity}`);
      // Continue anyway if system allows negative inventory
    }

    // Record stock movement
    const result = await recordStockMovement({
      companyId,
      warehouseId,
      productId: item.productId,
      movementType: 'sale_dispatch',
      quantityChange: -item.quantity,
      unitCost: item.unitCost || 0,
      referenceType: 'invoice',
      referenceId: invoiceId,
      performedBy: userId,
    });

    if (result.success) {
      deducted++;
    } else {
      errors.push(`Failed to deduct stock for product ${item.productId}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    deducted,
    errors,
  };
}

/**
 * Process a return invoice - add stock back to warehouse
 */
export async function processReturnInvoiceStock(
  invoiceId: string,
  companyId: string,
  warehouseId: string,
  items: Array<{
    productId: string;
    quantity: number;
    unitCost?: number;
  }>,
  userId?: string
): Promise<{ success: boolean; added: number; errors: string[] }> {
  const errors: string[] = [];
  let added = 0;

  for (const item of items) {
    const result = await recordStockMovement({
      companyId,
      warehouseId,
      productId: item.productId,
      movementType: 'sale_return',
      quantityChange: item.quantity,
      unitCost: item.unitCost || 0,
      referenceType: 'invoice',
      referenceId: invoiceId,
      performedBy: userId,
    });

    if (result.success) {
      added++;
    } else {
      errors.push(`Failed to add stock for product ${item.productId}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    added,
    errors,
  };
}

/**
 * Create a stock transfer request
 */
export async function createStockTransfer(input: StockTransferInput): Promise<{ success: boolean; transferId?: string; error?: string }> {
  try {
    // Generate transfer number
    const { data: transferNumData } = await supabase
      .rpc('generate_transfer_number');

    const transferNumber = transferNumData || `TRF-${Date.now()}`;

    // Create transfer header
    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .insert({
        company_id: input.companyId,
        transfer_number: transferNumber,
        source_warehouse_id: input.sourceWarehouseId,
        destination_warehouse_id: input.destinationWarehouseId,
        transfer_date: input.transferDate,
        expected_delivery_date: input.expectedDeliveryDate,
        notes: input.notes,
        created_by: input.createdBy,
        status: 'draft',
      })
      .select()
      .single();

    if (transferError) throw transferError;

    // Create transfer lines
    const lines = input.items.map(item => ({
      stock_transfer_id: transfer.id,
      product_id: item.productId,
      quantity_requested: item.quantity,
      unit_cost: item.unitCost,
      batch_number: item.batchNumber,
      lot_number: item.lotNumber,
      expiry_date: item.expiryDate,
    }));

    const { error: linesError } = await supabase
      .from('stock_transfer_lines')
      .insert(lines);

    if (linesError) throw linesError;

    return {
      success: true,
      transferId: transfer.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create stock transfer',
    };
  }
}

/**
 * Dispatch stock transfer (move items to in-transit)
 */
export async function dispatchStockTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('process_stock_transfer_dispatch', {
      p_stock_transfer_id: transferId,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dispatch stock transfer',
    };
  }
}

/**
 * Receive stock transfer (move items from in-transit to destination)
 */
export async function receiveStockTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('process_stock_transfer_receive', {
      p_stock_transfer_id: transferId,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to receive stock transfer',
    };
  }
}

/**
 * Create a stock adjustment (physical count)
 */
export async function createStockAdjustment(input: StockAdjustmentInput): Promise<{ success: boolean; adjustmentId?: string; error?: string }> {
  try {
    // Generate adjustment number
    const { data: adjNumData } = await supabase
      .rpc('generate_adjustment_number');

    const adjustmentNumber = adjNumData || `ADJ-${Date.now()}`;

    // Create adjustment header
    const { data: adjustment, error: adjustmentError } = await supabase
      .from('stock_adjustments')
      .insert({
        company_id: input.companyId,
        warehouse_id: input.warehouseId,
        adjustment_number: adjustmentNumber,
        adjustment_type: input.adjustmentType,
        adjustment_date: input.adjustmentDate,
        notes: input.notes,
        reason_code: input.reasonCode,
        reason_description: input.reasonDescription,
        created_by: input.createdBy,
        status: 'draft',
      })
      .select()
      .single();

    if (adjustmentError) throw adjustmentError;

    // Create adjustment lines
    const lines = input.items.map(item => ({
      stock_adjustment_id: adjustment.id,
      product_id: item.productId,
      system_quantity: item.systemQuantity,
      physical_quantity: item.physicalQuantity,
      unit_cost: item.unitCost,
      batch_number: item.batchNumber,
      lot_number: item.lotNumber,
      expiry_date: item.expiryDate,
      notes: item.notes,
    }));

    const { error: linesError } = await supabase
      .from('stock_adjustment_lines')
      .insert(lines);

    if (linesError) throw linesError;

    return {
      success: true,
      adjustmentId: adjustment.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create stock adjustment',
    };
  }
}

/**
 * Approve and post a stock adjustment
 */
export async function approveStockAdjustment(
  adjustmentId: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get adjustment details
    const { data: adjustment, error: fetchError } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('id', adjustmentId)
      .single();

    if (fetchError || !adjustment) throw fetchError;

    // Process each line
    const { data: lines } = await supabase
      .from('stock_adjustment_lines')
      .select('*')
      .eq('stock_adjustment_id', adjustmentId);

    if (!lines) throw new Error('No adjustment lines found');

    for (const line of lines) {
      const adjustmentQuantity = line.physical_quantity - line.system_quantity;
      const movementType = adjustmentQuantity > 0 ? 'adjustment_positive' : 'adjustment_negative';

      await recordStockMovement({
        companyId: adjustment.company_id,
        warehouseId: adjustment.warehouse_id,
        productId: line.product_id,
        movementType,
        quantityChange: adjustmentQuantity,
        unitCost: line.unit_cost,
        referenceType: 'stock_adjustment',
        referenceId: adjustmentId,
        referenceNumber: adjustment.adjustment_number,
        performedBy: approvedBy,
        batchNumber: line.batch_number,
        lotNumber: line.lotNumber,
        expiryDate: line.expiryDate,
        notes: `Stock adjustment: ${adjustment.reason_description}`,
      });
    }

    // Update adjustment status
    const { error: updateError } = await supabase
      .from('stock_adjustments')
      .update({
        status: 'posted',
        approved_by,
        approved_at: new Date().toISOString(),
        posted_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', adjustmentId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve stock adjustment',
    };
  }
}

/**
 * Get inventory valuation report
 */
export async function getInventoryValuation(
  companyId: string,
  warehouseId?: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('get_inventory_valuation', {
      p_company_id: companyId,
      p_warehouse_id: warehouseId || null,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get inventory valuation:', error);
    return [];
  }
}

/**
 * Get stock movement history (Cardex)
 */
export async function getStockMovementHistory(
  companyId: string,
  productId?: string,
  warehouseId?: string,
  movementType?: string,
  limit = 100
): Promise<any[]> {
  try {
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        warehouse:warehouses(id, name, code),
        product:products(id, name, sku),
        performed_by_user:auth.users(id, email, full_name)
      `)
      .eq('company_id', companyId)
      .order('movement_date', { ascending: false })
      .limit(limit);

    if (productId) query = query.eq('product_id', productId);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    if (movementType) query = query.eq('movement_type', movementType);

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get stock movement history:', error);
    return [];
  }
}

/**
 * Get stock level report
 */
export async function getStockLevelReport(
  companyId: string,
  warehouseId?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('warehouse_inventory')
      .select(`
        *,
        warehouse:warehouses(id, name, code, location),
        product:products(id, name, sku, price)
      `)
      .eq('company_id', companyId)
      .order('quantity_available', { ascending: true });

    if (warehouseId) query = query.eq('warehouse_id', warehouseId);

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get stock level report:', error);
    return [];
  }
}

/**
 * Check if stock is available for sale
 */
export async function checkStockAvailability(
  companyId: string,
  warehouseId: string,
  productId: string,
  quantity: number
): Promise<{ available: boolean; quantityAvailable: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('warehouse_inventory')
      .select('quantity_available')
      .eq('company_id', companyId)
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .single();

    if (error) throw error;

    if (!data) {
      return {
        available: false,
        quantityAvailable: 0,
        error: 'Product not found in warehouse inventory',
      };
    }

    return {
      available: data.quantity_available >= quantity,
      quantityAvailable: data.quantity_available,
    };
  } catch (error) {
    return {
      available: false,
      quantityAvailable: 0,
      error: error instanceof Error ? error.message : 'Failed to check stock availability',
    };
  }
}
