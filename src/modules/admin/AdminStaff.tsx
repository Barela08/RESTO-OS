import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Profile, Staff, StaffRoleType, SecurityAuditEvent } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Users,
  UserCheck,
  Shield,
  Clock,
  Plus,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserX,
  History,
  CheckCircle2,
  Lock,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/date';

export const AdminStaff: React.FC = () => {
  const { role: currentRole, currentProfile } = useAuthStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'staff' | 'audit'>('staff');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // New staff form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<StaffRoleType>('waiter');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [newRoleSelection, setNewRoleSelection] = useState<StaffRoleType>('waiter');
  const [newPassword, setNewPassword] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setProfiles([...dbAdapter.getProfiles()]);
      setStaffList([...dbAdapter.getStaff()]);
      setAuditLogs([...dbAdapter.getSecurityAuditEvents()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionMessage(null);

    try {
      dbAdapter.createStaffAccount(currentRole || 'admin', {
        fullName,
        loginId: username,
        password,
        role: selectedRole,
        email,
        phone,
        designation,
      });

      setActionMessage(`Staff account created successfully for ${fullName} (${selectedRole}).`);
      setIsAddModalOpen(false);
      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setPhone('');
      setDesignation('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to create staff account.');
    }
  };

  const handleUpdateRole = () => {
    if (!selectedProfile) return;
    setActionError(null);
    try {
      dbAdapter.updateStaffRole(currentRole || 'admin', selectedProfile.id, newRoleSelection);
      setActionMessage(`Role for ${selectedProfile.full_name} updated to ${newRoleSelection}.`);
      setIsRoleModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update role.');
    }
  };

  const handleResetPassword = () => {
    if (!selectedProfile || !currentProfile) return;
    setActionError(null);
    try {
      dbAdapter.adminResetStaffPassword(currentProfile.id, selectedProfile.id, newPassword);
      setActionMessage(`Password reset successfully for ${selectedProfile.full_name}.`);
      setIsResetPassModalOpen(false);
      setNewPassword('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to reset password.');
    }
  };

  const handleToggleActive = (profile: Profile) => {
    setActionError(null);
    try {
      const updated = dbAdapter.updateStaffStatus(
        currentRole || 'admin',
        profile.id,
        !profile.is_active,
        profile.is_active ? 'Deactivated by administrator' : 'Reactivated by administrator'
      );
      setActionMessage(`Account ${profile.full_name} is now ${updated.is_active ? 'ACTIVE' : 'DEACTIVATED'}.`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle account status.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff & Roles Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual staff identities, role-based terminal access, password resets & security audit log
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="orange"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Staff Member
            </Button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {actionMessage && (
          <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-2xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-green-600 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-600 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Directory ({profiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Security Audit & Activity Logs ({auditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: STAFF DIRECTORY */}
        {activeTab === 'staff' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Staff Member & Login ID</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Last Login</th>
                    <th className="py-2.5 px-3">Account Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map((prof) => (
                    <tr key={prof.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-3">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{prof.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            ID: {prof.username || prof.email} • {prof.employee_id || 'Staff'}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          prof.role_id === 'owner'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : prof.role_id === 'admin'
                            ? 'bg-purple-50 text-brand-purple border-purple-200'
                            : prof.role_id === 'counter'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : prof.role_id === 'kitchen'
                            ? 'bg-orange-50 text-brand-orange border-orange-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {prof.role_id}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {prof.phone || prof.email}
                      </td>

                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                        {prof.last_login_at ? formatDateTime(prof.last_login_at) : 'Never logged in'}
                      </td>

                      <td className="py-3.5 px-3">
                        {prof.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProfile(prof);
                              setNewRoleSelection(prof.role_id);
                              setIsRoleModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            Change Role
                          </button>

                          <button
                            onClick={() => {
                              setSelectedProfile(prof);
                              setIsResetPassModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            Reset Password
                          </button>

                          {prof.role_id !== 'owner' && (
                            <button
                              onClick={() => handleToggleActive(prof)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                prof.is_active
                                  ? 'bg-red-50 hover:bg-red-100 text-red-700'
                                  : 'bg-green-50 hover:bg-green-100 text-green-700'
                              }`}
                            >
                              {prof.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY AUDIT & ACTIVITY LOGS */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Security Audit Trail</h3>
                <p className="text-xs text-slate-500">Live immutable log of authentication events, rate-limiting & role changes</p>
              </div>
              <span className="text-xs font-mono text-slate-400">Total: {auditLogs.length} Events</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">User / Identity</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {auditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {formatDateTime(log.timestamp)}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {log.event_type}
                      </td>

                      <td className="py-2.5 px-3 text-slate-700 font-semibold">
                        {log.username || 'System / Anonymous'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 uppercase text-[10px] font-bold">
                        {log.role || '—'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.result === 'SUCCESS'
                            ? 'bg-green-100 text-green-700'
                            : log.result === 'BLOCKED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {log.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: ADD STAFF ACCOUNT */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Create New Staff Account"
          description="Provision individual credentials with role authorization"
        >
          <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs text-left">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Full Name:</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Login Username:</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. waiter2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Role:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as StaffRoleType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange font-bold text-slate-800"
                >
                  <option value="waiter">Waiter (Floor Terminal)</option>
                  <option value="kitchen">Kitchen Staff (KDS)</option>
                  <option value="counter">Cash Counter (POS)</option>
                  <option value="admin">Administrator (Operations)</option>
                  {currentRole === 'owner' && <option value="owner">Owner (Executive)</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@resto.os"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Phone:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98888 12345"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Designation Title:</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Floor Captain"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange"
                />
              </div>
            </div>

            <Button type="submit" variant="orange" className="w-full mt-2 font-bold">
              Create Staff Account
            </Button>
          </form>
        </Modal>

        {/* MODAL 2: CHANGE ROLE */}
        <Modal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          title="Change Staff Role"
          description={`Reassign terminal authorization for ${selectedProfile?.full_name}`}
        >
          <div className="space-y-4 text-xs text-left">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Select New Role:</label>
              <select
                value={newRoleSelection}
                onChange={(e) => setNewRoleSelection(e.target.value as StaffRoleType)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange font-bold text-slate-800 text-sm"
              >
                <option value="waiter">Waiter (Floor Terminal)</option>
                <option value="kitchen">Kitchen Staff (KDS)</option>
                <option value="counter">Cash Counter (POS)</option>
                <option value="admin">Administrator (Operations)</option>
                {currentRole === 'owner' && <option value="owner">Owner (Executive)</option>}
              </select>
            </div>

            <Button variant="orange" className="w-full font-bold" onClick={handleUpdateRole}>
              Confirm Role Change
            </Button>
          </div>
        </Modal>

        {/* MODAL 3: RESET PASSWORD */}
        <Modal
          isOpen={isResetPassModalOpen}
          onClose={() => setIsResetPassModalOpen(false)}
          title="Reset Staff Password"
          description={`Set a new secure password for ${selectedProfile?.full_name}`}
        >
          <div className="space-y-4 text-xs text-left">
            <div>
              <label className="font-bold text-slate-700 block mb-1">New Password (min 6 chars):</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-orange font-mono"
              />
            </div>

            <Button variant="orange" className="w-full font-bold" onClick={handleResetPassword}>
              Apply New Password
            </Button>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};
