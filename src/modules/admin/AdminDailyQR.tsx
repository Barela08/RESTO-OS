import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { RestaurantTable, TableQRToken, RepeatScanRequest } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { QRCard } from '../../components/common/QRCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { QRService } from '../../services/qrService';
import { formatDate, formatTime } from '../../utils/date';
import {
  QrCode,
  Printer,
  RefreshCw,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const AdminDailyQR: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [qrTokens, setQrTokens] = useState<TableQRToken[]>([]);
  const [repeatScans, setRepeatScans] = useState<RepeatScanRequest[]>([]);
  const [revokingToken, setRevokingToken] = useState<TableQRToken | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const restaurant = dbAdapter.getRestaurant();
  const timeRemaining = QRService.getTimeUntilMidnight();

  useEffect(() => {
    const update = () => {
      setTables([...dbAdapter.getTables()]);
      setQrTokens([...dbAdapter.getQRTokens()]);
      setRepeatScans([...dbAdapter.getRepeatScanRequests()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  const handleBulkPrint = () => {
    window.print();
  };

  const handleForceRegenerateDailyQRs = () => {
    setIsGenerating(true);
    dbAdapter.ensureTodayQRs();
    setTimeout(() => {
      setIsGenerating(false);
      alert('Today’s daily cryptographic QR tokens validated and generated for all active tables.');
    }, 600);
  };

  const handleConfirmRevoke = () => {
    if (!revokingToken || !revokeReason.trim()) return;
    dbAdapter.revokeQRToken(revokingToken.id, revokeReason);
    setRevokingToken(null);
    setRevokeReason('');
  };

  const activeTokens = qrTokens.filter(t => !t.is_revoked);
  const revokedTokens = qrTokens.filter(t => t.is_revoked);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Daily Dynamic QR System</h1>
            <p className="text-xs text-slate-500 mt-0.5">Automated SHA-256 tokens expiring nightly at 11:59:59 PM</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handleBulkPrint}
            >
              Bulk Print Table Cards
            </Button>
            <Button
              variant="primary"
              isLoading={isGenerating}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleForceRegenerateDailyQRs}
            >
              Regenerate Today's QRs
            </Button>
          </div>
        </div>

        {/* Daily Schedule Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-[#111827] text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-purple/20 border border-brand-purple/40 text-brand-purple flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 bg-green-900/60 text-green-300 text-[10px] font-bold uppercase rounded-full">
                Scheduler Active • Idempotent
              </span>
              <h3 className="font-extrabold text-base text-white mt-0.5">
                Daily Expiry Countdown: <span className="text-amber-400 font-mono">{timeRemaining}</span>
              </h3>
              <p className="text-xs text-slate-400">Tokens refresh automatically every day at 00:00:01 local time.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700">
              <span className="text-slate-400 block text-[10px]">Active Tables:</span>
              <strong className="text-white text-sm">{tables.length} Active</strong>
            </div>
            <div className="px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700">
              <span className="text-slate-400 block text-[10px]">Tokens Issued Today:</span>
              <strong className="text-brand-purple text-sm">{activeTokens.length} Issued</strong>
            </div>
          </div>
        </div>

        {/* Repeat Scan Alert Section */}
        {repeatScans.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 no-print">
            <h3 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Repeat QR Scan Logs & Activity</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Scan Time</th>
                    <th className="py-2.5 px-3">Device Reference</th>
                    <th className="py-2.5 px-3">Counter Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {repeatScans.slice(0, 6).map((req) => (
                    <tr key={req.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">Table {req.table?.table_number}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{formatTime(req.new_scan_time)}</td>
                      <td className="py-2.5 px-3 text-slate-500">{req.customer_identifier || 'Mobile Browser'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Printable All Table QR Cards Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between no-print">
            <h3 className="font-extrabold text-slate-900 text-sm">Today’s Table QR Standees</h3>
            <span className="text-xs text-slate-500">{tables.length} Dining Tables</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((table) => {
              const token = activeTokens.find(t => t.table_id === table.id);

              return (
                <div key={table.id} className="print-break-inside-avoid">
                  <QRCard
                    table={table}
                    token={token}
                    restaurantName={restaurant.name}
                    onRevoke={() => token && setRevokingToken(token)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revoke Token Modal */}
      <Modal
        isOpen={Boolean(revokingToken)}
        onClose={() => setRevokingToken(null)}
        title="Revoke Compromised Daily QR Token"
        description="Immediate invalidation preventing further table session creation"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Revoking will reject any future scans with this token hash. The system will prompt you to generate a replacement token for this table.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Reason for Revocation:</label>
            <input
              type="text"
              placeholder="e.g. Compromised photo shared online / table relocated"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="sm" variant="outline" onClick={() => setRevokingToken(null)}>Cancel</Button>
            <Button size="sm" variant="danger" disabled={!revokeReason.trim()} onClick={handleConfirmRevoke}>
              Confirm Invalidation
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};
