import React, { useEffect, useState } from 'react';
import { RestaurantTable, TableQRToken } from '../../types';
import { QRService } from '../../services/qrService';
import { Button } from '../ui/Button';
import { Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../utils/date';

interface QRCardProps {
  table: RestaurantTable;
  token?: TableQRToken;
  restaurantName: string;
  onRegenerate?: () => void;
  onRevoke?: () => void;
}

export const QRCard: React.FC<QRCardProps> = ({
  table,
  token,
  restaurantName,
  onRegenerate,
  onRevoke,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (token) {
      const orderUrl = `${window.location.origin}/order?token=${token.token_hash}`;
      QRService.generateQRCodeDataUrl(orderUrl).then(setQrDataUrl);
    }
  }, [token]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-${table.table_number}-${token?.valid_date || 'today'}.png`;
    a.click();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex flex-col items-center text-center relative overflow-hidden transition-all hover:shadow-card-hover print:border-none print:shadow-none">
      {/* Table Badge */}
      <div className="w-full flex items-center justify-between mb-3">
        <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold tracking-wider">
          TABLE {table.table_number}
        </span>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {table.floor_area} • {table.seating_capacity} Seats
        </span>
      </div>

      {/* QR Display */}
      <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-sm my-2">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR for Table ${table.table_number}`} className="w-40 h-40 object-contain" />
        ) : (
          <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl">
            Generating Daily QR...
          </div>
        )}
      </div>

      <h4 className="font-bold text-slate-900 text-sm mt-1">{restaurantName}</h4>
      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Scan with phone camera to order</p>

      {/* Validity Meta */}
      <div className="w-full my-3 py-2 px-3 bg-slate-50 rounded-xl text-left border border-slate-100 text-[11px] space-y-1 font-mono">
        <div className="flex justify-between text-slate-600">
          <span>Date:</span>
          <strong>{token ? formatDate(token.valid_date) : 'Today'}</strong>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Expires:</span>
          <span className="text-amber-600 font-bold">11:59:59 PM Local</span>
        </div>
        <div className="flex justify-between text-slate-500 truncate">
          <span>Token:</span>
          <span className="truncate max-w-[120px]">{token?.token_hash.substring(0, 14)}...</span>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full flex gap-2 no-print mt-auto">
        <Button size="sm" variant="outline" className="flex-1 text-xs" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={handleDownload}>
          PNG
        </Button>
        {onRegenerate && (
          <Button size="sm" variant="secondary" className="px-2" title="Regenerate Token" onClick={onRegenerate}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        )}
        {onRevoke && (
          <Button size="sm" variant="danger" className="px-2" title="Revoke Compromised QR" onClick={onRevoke}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
