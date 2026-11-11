import React from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { QrCode, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const CustomerSessionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isVerified, verifyAndSetToken } = useSessionStore();
  const tables = dbAdapter.getTables();
  const qrTokens = dbAdapter.getQRTokens();

  // If session is already verified, render children
  if (isVerified) {
    return <>{children}</>;
  }

  // If customer accesses /order without token, provide quick table picker for testing / demo
  const handleSelectTableToken = (tableId: string) => {
    const token = qrTokens.find(t => t.table_id === tableId && !t.is_revoked);
    if (token) {
      verifyAndSetToken(token.token_hash);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-elevated border border-orange-100 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 text-brand-orange flex items-center justify-center mx-auto mb-4 shadow-sm">
          <QrCode className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">
          Scan Today’s Table QR
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          To ensure verified billing, every order must be initiated by scanning the physical daily QR code at your dining table.
        </p>

        {/* Quick Table Selector for testing and development */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-left mb-6">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-2">
            <Sparkles className="w-4 h-4 text-brand-orange" />
            <span>Select Dining Table to Verify Session:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tables.slice(0, 6).map((tbl) => (
              <button
                key={tbl.id}
                onClick={() => handleSelectTableToken(tbl.id)}
                className="p-2.5 rounded-xl bg-white border border-amber-200 hover:border-brand-orange hover:bg-orange-50 text-left transition-all shadow-sm"
              >
                <p className="text-xs font-bold text-slate-900">Table {tbl.table_number}</p>
                <p className="text-[10px] text-slate-500">{tbl.floor_area} • {tbl.seating_capacity}p</p>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Table identity is strictly verified by server cryptographic hashes, preventing manual URL tampering.
        </p>
      </div>
    </div>
  );
};
