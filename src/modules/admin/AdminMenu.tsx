import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { MenuItem, MenuCategory, KitchenStation } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../utils/currency';
import { VegNonVegBadge } from '../../components/ui/Badge';
import {
  Utensils,
  Plus,
  Edit,
  Trash2,
  Clock,
  Flame,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react';

export const AdminMenu: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stationId, setStationId] = useState('');
  const [basePrice, setBasePrice] = useState(250);
  const [isVeg, setIsVeg] = useState(true);
  const [spicyLevel, setSpicyLevel] = useState(0);
  const [prepTime, setPrepTime] = useState(15);
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const update = () => {
      setItems([...dbAdapter.getMenuItems()]);
      setCategories([...dbAdapter.getCategories()]);
      setStations([...dbAdapter.getKitchenStations()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  const filteredItems = items.filter(i => {
    if (selectedCat !== 'all' && i.category_id !== selectedCat) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setStationId(stations[0]?.id || '');
    setBasePrice(250);
    setIsVeg(true);
    setSpicyLevel(0);
    setPrepTime(15);
    setImageUrl('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategoryId(item.category_id);
    setStationId(item.kitchen_station_id || stations[0]?.id || '');
    setBasePrice(item.base_price);
    setIsVeg(item.is_veg);
    setSpicyLevel(item.spicy_level);
    setPrepTime(item.prep_time_minutes);
    setImageUrl(item.image_url || '');
    setDescription(item.description || '');
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (editingItem) {
      dbAdapter.updateMenuItem(editingItem.id, {
        name,
        category_id: categoryId,
        kitchen_station_id: stationId,
        base_price: basePrice,
        is_veg: isVeg,
        spicy_level: spicyLevel,
        prep_time_minutes: prepTime,
        image_url: imageUrl,
        description,
      });
    } else {
      dbAdapter.addMenuItem({
        category_id: categoryId,
        kitchen_station_id: stationId,
        name,
        base_price: basePrice,
        is_veg: isVeg,
        spicy_level: spicyLevel,
        prep_time_minutes: prepTime,
        image_url: imageUrl,
        description,
        is_available: true,
      });
    }

    setIsModalOpen(false);
  };

  const handleToggleAvailability = (id: string, current: boolean) => {
    dbAdapter.updateMenuItem(id, { is_available: !current });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Menu & Food Items</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage food pricing, categories, kitchen routing and availability</p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add New Dish
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm ${
              selectedCat === 'all'
                ? 'bg-brand-purple text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Dishes ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm ${
                selectedCat === c.id
                  ? 'bg-brand-purple text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.name} ({items.filter(i => i.category_id === c.id).length})
            </button>
          ))}
        </div>

        {/* Dishes Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Photo & Dish</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Kitchen Station</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Prep Time</th>
                  <th className="py-2.5 px-3">In Stock</th>
                  <th className="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const cat = categories.find(c => c.id === item.category_id);
                  const stn = stations.find(s => s.id === item.kitchen_station_id);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <VegNonVegBadge isVeg={item.is_veg} />
                              <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1">{item.description}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {cat?.name || 'Uncategorized'}
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                        {stn?.name || 'Main Kitchen'}
                      </td>

                      <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">
                        {formatCurrency(item.base_price)}
                      </td>

                      <td className="py-3 px-3 text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {item.prep_time_minutes} min
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggleAvailability(item.id, item.is_available)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.is_available
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.is_available ? 'Available' : 'Out of Stock'}
                        </button>
                      </td>

                      <td className="py-3 px-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs py-1"
                          onClick={() => handleOpenEdit(item)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Dish Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Dish' : 'Add New Dish'}
      >
        <form onSubmit={handleSaveItem} className="space-y-3.5">
          <Input
            label="Dish Name"
            placeholder="e.g. Saffron Dum Biryani"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kitchen Station Route</label>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Base Price (₹)"
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
              required
            />
            <Input
              label="Prep Time (Min)"
              type="number"
              value={prepTime}
              onChange={(e) => setPrepTime(parseInt(e.target.value) || 10)}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary</label>
              <select
                value={isVeg ? 'veg' : 'nonveg'}
                onChange={(e) => setIsVeg(e.target.value === 'veg')}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
              >
                <option value="veg">Vegetarian</option>
                <option value="nonveg">Non-Vegetarian</option>
              </select>
            </div>
          </div>

          <Input
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Ingredients</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">{editingItem ? 'Save Updates' : 'Add Dish'}</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};
