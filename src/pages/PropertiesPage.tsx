import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Building2, Home, Store, Trash2, Pencil, DoorOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../contexts/ToastContext';
import type { Property, PropertyType, Unit, UnitStatus } from '../lib/types';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableHead, TableBody, TableRow, Th, Td } from '../components/ui/Table';
import { EmptyState } from '../components/ui/Feedback';

const typeIcon: Record<PropertyType, typeof Building2> = { building: Building2, apartment: Home, commercial: Store };

interface PropertyForm { name: string; type: PropertyType; address: string; }
interface UnitForm { unit_number: string; rent_amount: string; status: UnitStatus; }

const emptyProp: PropertyForm = { name: '', type: 'building', address: '' };
const emptyUnit: UnitForm = { unit_number: '', rent_amount: '', status: 'vacant' };

function PropertyFormModal({ open, onClose, onSaved, editing, companyId }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing: Property | null; companyId: string;
}) {
  const [form, setForm] = useState<PropertyForm>(emptyProp);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) setForm(editing ? { name: editing.name, type: editing.type, address: editing.address ?? '' } : emptyProp); }, [open, editing]);

  const update = useCallback(<K extends keyof PropertyForm>(key: K, val: PropertyForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const save = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), type: form.type, address: form.address.trim() || null };
    const { error } = editing
      ? await supabase.from('properties').update(payload).eq('id', editing.id)
      : await supabase.from('properties').insert({ ...payload, tenant_id: companyId });
    if (error) toast(error.message, 'error'); else { toast('Property saved'); onSaved(); }
    setSaving(false);
  }, [form, editing, companyId, toast, onSaved]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Property' : 'Add Property'} size="md">
      <form onSubmit={save} className="space-y-4">
        <Input label="Property Name *" value={form.name} onChange={e => update('name', e.target.value)} required />
        <Select label="Type" value={form.type} onChange={e => update('type', e.target.value as PropertyType)}>
          <option value="building">Building</option>
          <option value="apartment">Apartment</option>
          <option value="commercial">Commercial</option>
        </Select>
        <Input label="Address" value={form.address} onChange={e => update('address', e.target.value)} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function UnitFormModal({ open, onClose, onSaved, editing, companyId, propertyId }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing: Unit | null; companyId: string; propertyId: string;
}) {
  const [form, setForm] = useState<UnitForm>(emptyUnit);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) setForm(editing ? { unit_number: editing.unit_number, rent_amount: String(editing.rent_amount), status: editing.status } : emptyUnit); }, [open, editing]);

  const update = useCallback(<K extends keyof UnitForm>(key: K, val: UnitForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const save = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_number.trim()) return;
    setSaving(true);
    const payload = { unit_number: form.unit_number.trim(), rent_amount: parseFloat(form.rent_amount) || 0, status: form.status };
    const { error } = editing
      ? await supabase.from('units').update(payload).eq('id', editing.id)
      : await supabase.from('units').insert({ ...payload, tenant_id: companyId, property_id: propertyId });
    if (error) toast(error.message, 'error'); else { toast('Unit saved'); onSaved(); }
    setSaving(false);
  }, [form, editing, companyId, propertyId, toast, onSaved]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Unit' : 'Add Unit'} size="sm">
      <form onSubmit={save} className="space-y-4">
        <Input label="Unit Number *" value={form.unit_number} onChange={e => update('unit_number', e.target.value)} required />
        <Input label="Rent Amount" type="number" step="0.01" value={form.rent_amount} onChange={e => update('rent_amount', e.target.value)} />
        <Select label="Status" value={form.status} onChange={e => update('status', e.target.value as UnitStatus)}>
          <option value="vacant">Vacant</option>
          <option value="rented">Rented</option>
        </Select>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export function PropertiesPage() {
  const { company } = useCompany();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [propModal, setPropModal] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [unitModal, setUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitPropertyId, setUnitPropertyId] = useState<string | null>(null);
  const [expandedProp, setExpandedProp] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const [propRes, unitRes] = await Promise.all([
      supabase.from('properties').select('*').eq('tenant_id', company.id).order('created_at', { ascending: true }),
      supabase.from('units').select('*').eq('tenant_id', company.id).order('created_at', { ascending: true }),
    ]);
    setProperties(propRes.data as Property[] ?? []);
    setUnits(unitRes.data as Unit[] ?? []);
    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const deleteProperty = useCallback(async (p: Property) => {
    const { error } = await supabase.from('properties').delete().eq('id', p.id);
    if (error) toast(error.message, 'error'); else { toast('Property deleted'); load(); }
  }, [toast, load]);

  const deleteUnit = useCallback(async (u: Unit) => {
    const { error } = await supabase.from('units').delete().eq('id', u.id);
    if (error) toast(error.message, 'error'); else { toast('Unit deleted'); load(); }
  }, [toast, load]);

  const openAddUnit = useCallback((propertyId: string) => { setEditingUnit(null); setUnitPropertyId(propertyId); setUnitModal(true); }, []);
  const openEditUnit = useCallback((u: Unit) => { setEditingUnit(u); setUnitPropertyId(u.property_id); setUnitModal(true); }, []);
  const openAddProp = useCallback(() => { setEditingProp(null); setPropModal(true); }, []);
  const openEditProp = useCallback((p: Property) => { setEditingProp(p); setPropModal(true); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">Properties</h1>
          <p className="text-sm text-secondary-500 mt-1">Manage your properties and units</p>
        </div>
        <Button onClick={openAddProp}><Plus size={16} /> Add Property</Button>
      </div>

      {properties.length === 0 ? (
        <Card><CardBody><EmptyState icon={<Building2 size={28} />} title="No properties yet" description="Add your first property to get started." action={<Button onClick={openAddProp}><Plus size={16} /> Add Property</Button>} /></CardBody></Card>
      ) : (
        <div className="space-y-4">
          {properties.map((p) => {
            const Icon = typeIcon[p.type];
            const propUnits = units.filter((u) => u.property_id === p.id);
            const vacantCount = propUnits.filter((u) => u.status === 'vacant').length;
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                      <Icon size={20} />
                    </div>
                    <div>
                      <CardTitle>{p.name}</CardTitle>
                      <p className="text-xs text-secondary-500 mt-0.5 capitalize">{p.type} {p.address ? `· ${p.address}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary-500">{propUnits.length} units · {vacantCount} vacant</span>
                    <button onClick={() => setExpandedProp(expandedProp === p.id ? null : p.id)} className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-semibold">
                      {expandedProp === p.id ? 'Hide' : 'Units'}
                    </button>
                    <button onClick={() => openEditProp(p)} className="p-2 rounded-lg text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800"><Pencil size={15} /></button>
                    <button onClick={() => deleteProperty(p)} className="p-2 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20"><Trash2 size={15} /></button>
                  </div>
                </CardHeader>
                {expandedProp === p.id && (
                  <CardBody className="p-0">
                    {propUnits.length === 0 ? (
                      <div className="p-6 text-center">
                        <DoorOpen size={24} className="mx-auto text-secondary-300 mb-2" />
                        <p className="text-sm text-secondary-500 mb-4">No units in this property yet</p>
                        <Button size="sm" onClick={() => openAddUnit(p.id)}><Plus size={14} /> Add Unit</Button>
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHead>
                            <TableRow><Th>Unit #</Th><Th>Rent</Th><Th>Status</Th><Th className="text-end">Actions</Th></TableRow>
                          </TableHead>
                          <TableBody>
                            {propUnits.map((u) => (
                              <TableRow key={u.id}>
                                <Td className="font-medium">{u.unit_number}</Td>
                                <Td>${u.rent_amount.toFixed(2)}</Td>
                                <Td><span className={`badge ${u.status === 'vacant' ? 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300' : 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'}`}><span className={`badge-dot ${u.status === 'vacant' ? 'bg-secondary-400' : 'bg-success-500'}`} />{u.status}</span></Td>
                                <Td className="text-end">
                                  <button onClick={() => openEditUnit(u)} className="p-2 rounded-lg text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800"><Pencil size={15} /></button>
                                  <button onClick={() => deleteUnit(u)} className="p-2 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20"><Trash2 size={15} /></button>
                                </Td>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="p-4 border-t border-secondary-200 dark:border-secondary-800">
                          <Button size="sm" variant="outline" onClick={() => openAddUnit(p.id)}><Plus size={14} /> Add Unit</Button>
                        </div>
                      </>
                    )}
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <PropertyFormModal open={propModal} onClose={() => setPropModal(false)} onSaved={() => { setPropModal(false); load(); }} editing={editingProp} companyId={company?.id ?? ''} />
      <UnitFormModal open={unitModal} onClose={() => setUnitModal(false)} onSaved={() => { setUnitModal(false); load(); }} editing={editingUnit} companyId={company?.id ?? ''} propertyId={unitPropertyId ?? ''} />
    </div>
  );
}
