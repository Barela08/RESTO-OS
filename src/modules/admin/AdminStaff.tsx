import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Profile, Staff, StaffRoleType } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Users, UserCheck, Shield, Clock } from 'lucide-react';

export const AdminStaff: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  useEffect(() => {
    const update = () => {
      setProfiles([...dbAdapter.getProfiles()]);
      setStaffList([...dbAdapter.getStaff()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff & Roles Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Control employee accounts, shift duties and role permissions</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Duty Status</th>
                  <th className="py-2.5 px-3">Account Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((prof) => (
                  <tr key={prof.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{prof.full_name}</p>
                        <p className="text-[11px] text-slate-400">{prof.email}</p>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-purple-50 text-brand-purple border border-purple-200">
                        {prof.role_id}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-600">
                      {prof.phone || '—'}
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        On Shift
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-slate-600 font-medium">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
