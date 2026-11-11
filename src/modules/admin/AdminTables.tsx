import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { RestaurantTable, TableStatus } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { TableStatusBadge } from '../../components/ui/Badge';
import { QRCard } from '../../components/common/QRCard';
import { TableDetailModal } from '../../components/common/TableDetailModal';
import {
  UtensilsCrossed,
  Plus,
  QrCode,
  Users,
  Sparkles,
  Edit,
  Trash2,
  CheckCircle2,
  Filter,
  Eye,
} from 'lucide-react';

export const AdminTables: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [qrTokens, setQrTokens] = useState(dbAdapter.getQRTokens());
  const [staff, setStaff] = useState(dbAdapter.getStaff());
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDetailTable, setSelectedDetailTable] = useState<RestaurantTable | null>(null);

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [floorArea, setFloorArea] = useState('Main Dining');
  const [description, setDescription] = useState('');

  // QR Preview Modal
  const [previewingTable, setPreviewingTable] = useState<RestaurantTable | null>(null);
  const [qrTypeView, setQrTypeView] = useState<'permanent' | 'daily'>('permanent');

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const update = () => {
      setTables([...dbAdapter.getTables()]);
      setQrTokens([...dbAdapter.getQRTokens()]);
      setStaff([...dbAdapter.getStaff()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  const floorAreas = ['Main Dining', 'Patio Garden', 'First Floor Lounge', 'Terrace Deck'];

  const filteredTables = tables.filter(t => {
    if (selectedArea !== 'all' && t.floor_area !== selectedArea) return false;
    return true;
  });

  const availableCount = tables.filter(t => t.status === 'AVAILABLE').length;
  const occupiedCount = tables.filter(t => t.status === 'OCCUPIED').length;
  const pendingCount = tables.filter(t => t.status === 'PAYMENT_PENDING').length;
  const cleaningCount = tables.filter(t => t.status === 'CLEANING').length;

  const handleOpenAdd = () => {
    setEditingTable(null);
    setTableNumber(`T-0${tables.length + 1}`);
    setCapacity(4);
    setFloorArea('Main Dining');
    setDescription('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (t: RestaurantTable) => {
    setEditingTable(t);
    setTableNumber(t.table_number);
    setCapacity(t.seating_capacity);
    setFloorArea(t.floor_area);
    setDescription(t.description || '');
    setIsAddModalOpen(true);
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber) return;

    if (editingTable) {
      dbAdapter.updateTable(editingTable.id, {
        table_number: tableNumber,
        seating_capacity: capacity,
        floor_area: floorArea,
        description,
      });
    } else {
      dbAdapter.addTable({
        table_number: tableNumber,
        seating_capacity: capacity,
        floor_area: floorArea,
        description,
        status: 'AVAILABLE',
        is_active: true,
      });
    }

    setIsAddModalOpen(false);
  };

  const handleStatusChange = (tableId: string, newStatus: TableStatus) => {
    dbAdapter.updateTable(tableId, { status: newStatus });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Table Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">Floor layout, seating capacities and daily QR token status</p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add New Table
          </Button>
        </div>

        {/* Floor KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tables</span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{tables.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available</span>
            <p className="text-xl font-extrabold text-green-600 mt-0.5">{availableCount}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Occupied</span>
            <p className="text-xl font-extrabold text-brand-purple mt-0.5">{occupiedCount}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Needs Cleaning</span>
            <p className="text-xl font-extrabold text-orange-500 mt-0.5">{cleaningCount}</p>
          </div>
        </div>

        {/* Floor Area Filter */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <button
            onClick={() => setSelectedArea('all')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm ${
              selectedArea === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Floor Areas ({tables.length})
          </button>
          {floorAreas.map(area => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm ${
                selectedArea === area
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {area} ({tables.filter(t => t.floor_area === area).length})
            </button>
          ))}
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map((tbl) => {
            const token = qrTokens.find(q => q.table_id === tbl.id && !q.is_revoked);

            return (
              <div
                key={tbl.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex flex-col justify-between hover:shadow-card-hover transition-all"
              >
                <div
                  onClick={() => setSelectedDetailTable(tbl)}
                  className="cursor-pointer group"
                  title="Click to view full table details, orders and menu"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-slate-900 text-lg group-hover:text-brand-orange transition-colors">
                      {tbl.table_number}
                    </span>
                    <TableStatusBadge status={tbl.status} />
                  </div>

                  <div className="text-xs text-slate-500 space-y-1 mb-3">
                    <p className="font-semibold text-slate-700">{tbl.floor_area}</p>
                    <p>{tbl.seating_capacity} Seater Capacity</p>
                    {tbl.description && <p className="text-[11px] text-slate-400 italic">{tbl.description}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-orange mb-2">
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Orders & Menu</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  {/* Status Quick Modifier */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Status:</span>
                    <select
                      value={tbl.status}
                      onChange={(e) => handleStatusChange(tbl.id, e.target.value as TableStatus)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-semibold focus:outline-none"
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="OCCUPIED">OCCUPIED</option>
                      <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
                      <option value="CLEANING">CLEANING</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 text-xs py-1"
                      leftIcon={<QrCode className="w-3.5 h-3.5" />}
                      onClick={() => setPreviewingTable(tbl)}
                    >
                      View QR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2.5 py-1"
                      onClick={() => handleOpenEdit(tbl)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Table Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingTable ? 'Edit Restaurant Table' : 'Add New Restaurant Table'}
      >
        <form onSubmit={handleSaveTable} className="space-y-4">
          <Input
            label="Table Number / Code"
            placeholder="e.g. T-09, VIP-01"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Seating Capacity</label>
            <select
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value))}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm"
            >
              <option value={2}>2 Guests (Couple Table)</option>
              <option value={4}>4 Guests (Standard Dining)</option>
              <option value={6}>6 Guests (Family Table)</option>
              <option value={8}>8 Guests (Banquet / Group)</option>
              <option value={12}>12+ Guests (Party Table)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Floor / Dining Area</label>
            <select
              value={floorArea}
              onChange={(e) => setFloorArea(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm"
            >
              {floorAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Location Notes</label>
            <input
              type="text"
              placeholder="e.g. Shaded window seat overlooking lawn"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingTable ? 'Save Changes' : 'Create Table & Generate QR'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Preview Modal */}
      <Modal
        isOpen={Boolean(previewingTable)}
        onClose={() => setPreviewingTable(null)}
        title={previewingTable ? `Table QR Code: ${previewingTable.table_number}` : ''}
      >
        {previewingTable && (
          <div className="max-w-sm mx-auto space-y-3">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQrTypeView('permanent')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  qrTypeView === 'permanent'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Permanent QR (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setQrTypeView('daily')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  qrTypeView === 'daily'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Daily QR
              </button>
            </div>

            <QRCard
              table={previewingTable}
              token={
                qrTypeView === 'permanent'
                  ? dbAdapter.getPermanentQRForTable(previewingTable.id) || qrTokens.find(q => q.table_id === previewingTable.id && q.is_permanent && !q.is_revoked)
                  : qrTokens.find(q => q.table_id === previewingTable.id && !q.is_permanent && !q.is_revoked)
              }
              restaurantName={restaurant.name}
            />
          </div>
        )}
      </Modal>

      {/* Full Table Details & Menu Viewer Modal */}
      <TableDetailModal
        table={selectedDetailTable}
        isOpen={Boolean(selectedDetailTable)}
        onClose={() => setSelectedDetailTable(null)}
        onStatusChange={handleStatusChange}
      />
    </AdminLayout>
  );
};
