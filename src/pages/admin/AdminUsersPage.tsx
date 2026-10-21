import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Feedback';
import {
  Users, Search, RefreshCw, ShieldCheck, ShieldOff,
  User, Mail, Calendar, Building2, CheckCircle,
  XCircle, UserPlus, Eye, EyeOff, Pencil, Trash2, Phone,
} from 'lucide-react';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_path: string | null;
  is_platform_admin: boolean;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  companies: { id: string; name: string; role: string }[] | null;
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'' | 'admin' | 'regular'>('');

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [inviteShowPwd, setInviteShowPwd] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Toggle admin confirm
  const [toggleRow, setToggleRow] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState(false);

  // Edit modal
  const [editRow, setEditRow] = useState<AdminUser | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editing, setEditing] = useState(false);

  // Delete confirm
  const [deleteRow, setDeleteRow] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_users');
    if (error) toast(error.message, 'error');
    else setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || (u.email ?? '').toLowerCase().includes(q)
      || (u.full_name ?? '').toLowerCase().includes(q);
    const matchAdmin =
      adminFilter === '' ? true :
      adminFilter === 'admin' ? u.is_platform_admin :
      !u.is_platform_admin;
    return matchSearch && matchAdmin;
  });

  const handleToggleAdmin = async () => {
    if (!toggleRow) return;
    setToggling(true);
    const { error } = await supabase.rpc('set_platform_admin', {
      p_user_id: toggleRow.id,
      p_is_admin: !toggleRow.is_platform_admin,
    });
    if (error) {
      toast(error.message, 'error');
    } else {
      toast(
        toggleRow.is_platform_admin
          ? `${toggleRow.email} is no longer an admin`
          : `${toggleRow.email} is now a platform admin`,
        'success'
      );
      await supabase.from('admin_audit_logs').insert({
        performed_by: currentUser!.id,
        action: toggleRow.is_platform_admin ? 'revoke_admin' : 'grant_admin',
        details: { user_id: toggleRow.id, user_email: toggleRow.email },
      });
      await load();
    }
    setToggling(false);
    setToggleRow(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !invitePassword) return;
    setInviting(true);
    const { data: newUserId, error } = await supabase.rpc('admin_invite_user', {
      p_email: inviteEmail,
      p_full_name: inviteFullName || '',
      p_password: invitePassword,
    });
    if (error) {
      toast(error.message, 'error');
      setInviting(false);
      return;
    }
    if (inviteIsAdmin && newUserId) {
      await supabase.rpc('set_platform_admin', {
        p_user_id: newUserId as string,
        p_is_admin: true,
      });
    }
    await supabase.from('admin_audit_logs').insert({
      performed_by: currentUser!.id,
      action: 'create_user',
      details: { email: inviteEmail, is_admin: inviteIsAdmin },
    });
    toast(`User ${inviteEmail} created successfully`, 'success');
    setInviteOpen(false);
    setInviteEmail('');
    setInviteFullName('');
    setInvitePassword('');
    setInviteIsAdmin(false);
    setInviting(false);
    await load();
  };

  const openEdit = (u: AdminUser) => {
    setEditRow(u);
    setEditEmail(u.email);
    setEditFullName(u.full_name ?? '');
    setEditPhone(u.phone ?? '');
  };

  const handleEdit = async () => {
    if (!editRow) return;
    setEditing(true);
    const { error } = await supabase.rpc('admin_update_user', {
      p_user_id: editRow.id,
      p_email: editEmail,
      p_full_name: editFullName || null,
      p_phone: editPhone || null,
    });
    if (error) {
      toast(error.message, 'error');
    } else {
      toast(`User ${editRow.email} updated successfully`, 'success');
      await supabase.from('admin_audit_logs').insert({
        performed_by: currentUser!.id,
        action: 'update_user',
        details: { user_id: editRow.id, user_email: editRow.email, new_email: editEmail },
      });
      setEditRow(null);
      await load();
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: deleteRow.id,
    });
    if (error) {
      toast(error.message, 'error');
    } else {
      toast(`User ${deleteRow.email} has been deleted`, 'success');
      await supabase.from('admin_audit_logs').insert({
        performed_by: currentUser!.id,
        action: 'delete_user',
        details: { user_id: deleteRow.id, user_email: deleteRow.email },
      });
      setDeleteRow(null);
      await load();
    }
    setDeleting(false);
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const adminCount = users.filter((u) => u.is_platform_admin).length;
  const confirmedCount = users.filter((u) => u.email_confirmed).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">Users</h1>
            <p className="text-xs text-secondary-400 mt-0.5">
              {users.length} total · {adminCount} admins · {confirmedCount} confirmed
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
          { label: 'Platform Admins', value: adminCount, color: 'text-warning-600 bg-warning-50 dark:bg-warning-900/20' },
          { label: 'Email Confirmed', value: confirmedCount, color: 'text-success-600 bg-success-50 dark:bg-success-900/20' },
          { label: 'With Companies', value: users.filter((u) => (u.companies?.length ?? 0) > 0).length, color: 'text-accent-600 bg-accent-50 dark:bg-accent-900/20' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-4">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${s.color}`}>
              <Users size={17} />
            </div>
            <p className="text-2xl font-black text-secondary-800 dark:text-secondary-100">{s.value}</p>
            <p className="text-xs text-secondary-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-52">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={15} />}
            />
          </div>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value as typeof adminFilter)}
            className="input w-40"
          >
            <option value="">All Roles</option>
            <option value="admin">Admins Only</option>
            <option value="regular">Regular Users</option>
          </select>
          <p className="text-xs text-secondary-400 self-center">{filtered.length} of {users.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-secondary-400 gap-3">
            <Users size={32} className="opacity-30" />
            <p className="text-sm font-medium">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50 text-[11px] font-bold text-secondary-500 uppercase tracking-wide">
                  <th className="text-start px-4 py-3">User</th>
                  <th className="text-start px-4 py-3">Role</th>
                  <th className="text-start px-4 py-3">Companies</th>
                  <th className="text-start px-4 py-3">Joined</th>
                  <th className="text-start px-4 py-3">Last Sign In</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          u.is_platform_admin
                            ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                            : 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                        }`}>
                          {(u.email?.[0] ?? 'U').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-secondary-800 dark:text-secondary-100 truncate max-w-[160px]">
                              {u.full_name || u.email?.split('@')[0]}
                            </p>
                            {u.is_platform_admin && (
                              <ShieldCheck size={13} className="text-warning-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs text-secondary-400 truncate max-w-[160px]">{u.email}</p>
                            {u.email_confirmed ? (
                              <CheckCircle size={11} className="text-success-500 shrink-0" />
                            ) : (
                              <XCircle size={11} className="text-danger-400 shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_platform_admin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400 border border-warning-100 dark:border-warning-900/30">
                          <ShieldCheck size={10} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400">
                          <User size={10} /> User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(u.companies?.length ?? 0) === 0 ? (
                        <span className="text-xs text-secondary-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {u.companies!.slice(0, 2).map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300">
                              <Building2 size={9} /> {c.name}
                            </span>
                          ))}
                          {u.companies!.length > 2 && (
                            <span className="text-xs text-secondary-400">+{u.companies!.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                        <Calendar size={11} />
                        {fmtDate(u.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-secondary-400">{fmtDate(u.last_sign_in_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.id !== currentUser?.id && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(u)}
                              title="Edit User"
                            >
                              <Pencil size={13} /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={u.is_platform_admin ? 'danger' : 'outline'}
                              onClick={() => setToggleRow(u)}
                              title={u.is_platform_admin ? 'Revoke Admin' : 'Grant Admin'}
                            >
                              {u.is_platform_admin
                                ? <><ShieldOff size={13} /> Revoke</>
                                : <><ShieldCheck size={13} /> Make Admin</>
                              }
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteRow(u)}
                              title="Delete User"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-secondary-400 px-2">You</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add New User" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Email Address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                icon={<Mail size={15} />}
              />
            </div>
            <div className="col-span-2">
              <Input
                label="Full Name (optional)"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="John Doe"
                icon={<User size={15} />}
              />
            </div>
            <div className="col-span-2 relative">
              <Input
                label="Password"
                type={inviteShowPwd ? 'text' : 'password'}
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setInviteShowPwd(!inviteShowPwd)}
                className="absolute end-3 top-[34px] text-secondary-400 hover:text-secondary-600 transition-colors"
              >
                {inviteShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-secondary-200 dark:border-secondary-700 cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors">
            <input
              type="checkbox"
              checked={inviteIsAdmin}
              onChange={(e) => setInviteIsAdmin(e.target.checked)}
              className="h-4 w-4 rounded accent-warning-500"
            />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                <ShieldCheck size={14} className="text-warning-500" />
                Grant Platform Admin Access
              </div>
              <p className="text-xs text-secondary-400 mt-0.5">
                This user will have full access to the admin panel and all platform data.
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleInvite}
              loading={inviting}
              disabled={!inviteEmail || !invitePassword}
            >
              <UserPlus size={14} /> Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Admin Confirm Modal */}
      <Modal
        open={!!toggleRow}
        onClose={() => setToggleRow(null)}
        title={toggleRow?.is_platform_admin ? 'Revoke Admin Access' : 'Grant Admin Access'}
        size="sm"
      >
        {toggleRow && (
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              toggleRow.is_platform_admin
                ? 'bg-danger-50 dark:bg-danger-900/10 border-danger-100 dark:border-danger-900/30'
                : 'bg-warning-50 dark:bg-warning-900/10 border-warning-100 dark:border-warning-900/30'
            }`}>
              <ShieldCheck size={16} className={`shrink-0 mt-0.5 ${toggleRow.is_platform_admin ? 'text-danger-600' : 'text-warning-600'}`} />
              <p className={`text-sm ${toggleRow.is_platform_admin ? 'text-danger-700 dark:text-danger-400' : 'text-warning-700 dark:text-warning-400'}`}>
                {toggleRow.is_platform_admin
                  ? `Remove admin access from ${toggleRow.email}? They will lose access to this admin panel.`
                  : `Grant full admin access to ${toggleRow.email}? They will have access to all platform data and controls.`
                }
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setToggleRow(null)}>Cancel</Button>
              <Button
                variant={toggleRow.is_platform_admin ? 'danger' : 'primary'}
                onClick={handleToggleAdmin}
                loading={toggling}
              >
                {toggleRow.is_platform_admin
                  ? <><ShieldOff size={14} /> Revoke Admin</>
                  : <><ShieldCheck size={14} /> Grant Admin</>
                }
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit User"
        size="md"
      >
        {editRow && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                editRow.is_platform_admin
                  ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                  : 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
              }`}>
                {(editRow.email?.[0] ?? 'U').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-secondary-800 dark:text-secondary-100 truncate">
                  {editRow.full_name || editRow.email?.split('@')[0]}
                </p>
                <p className="text-xs text-secondary-400 truncate">{editRow.email}</p>
              </div>
            </div>

            <Input
              label="Email Address"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="user@example.com"
              icon={<Mail size={15} />}
            />

            <Input
              label="Full Name"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="John Doe"
              icon={<User size={15} />}
            />

            <Input
              label="Phone Number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="+1 234 567 890"
              icon={<Phone size={15} />}
            />

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button>
              <Button
                onClick={handleEdit}
                loading={editing}
                disabled={!editEmail}
              >
                <Pencil size={14} /> Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete User Confirm Modal */}
      <Modal
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete User"
        size="sm"
      >
        {deleteRow && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-danger-50 dark:bg-danger-900/10 border-danger-100 dark:border-danger-900/30">
              <Trash2 size={16} className="shrink-0 mt-0.5 text-danger-600" />
              <div>
                <p className="text-sm font-semibold text-danger-700 dark:text-danger-400">
                  Delete {deleteRow.email}?
                </p>
                <p className="text-xs text-danger-600 dark:text-danger-500 mt-1">
                  This action cannot be undone. The user's account, profile, and all associated data will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteRow(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={deleting}
              >
                <Trash2 size={14} /> Delete User
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
