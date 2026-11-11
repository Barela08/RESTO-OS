import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { InventoryItem, Supplier } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { formatCurrency } from '../../utils/currency';
import { Package, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';

export const AdminInventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    setItems([...dbAdapter.getInventoryItems()]);
    setSuppliers([...dbAdapter.getSuppliers()]);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventory & Stock Tracking</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ingredient quantities, stock thresholds and supplier relationships</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Item / SKU</th>
                  <th className="py-2.5 px-3">Current Stock</th>
                  <th className="py-2.5 px-3">Min Alert Threshold</th>
                  <th className="py-2.5 px-3">Cost / Unit</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isLow = item.current_stock <= item.min_stock_alert;
                  const sup = suppliers.find(s => s.id === item.supplier_id);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{item.sku}</p>
                      </td>

                      <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">
                        {item.current_stock.toFixed(2)} {item.unit}
                      </td>

                      <td className="py-3 px-3 text-slate-500">
                        {item.min_stock_alert.toFixed(2)} {item.unit}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {formatCurrency(item.cost_per_unit)} / {item.unit}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {sup?.name || 'Local APMC'}
                      </td>

                      <td className="py-3 px-3">
                        {isLow ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Low Stock Alert
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-800 flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3 text-green-600" /> Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
