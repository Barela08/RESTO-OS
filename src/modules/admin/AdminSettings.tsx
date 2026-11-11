import React, { useState } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const restaurant = dbAdapter.getRestaurant();
  const settings = dbAdapter.getSettings();

  const [name, setName] = useState(restaurant.name);
  const [tagline, setTagline] = useState(restaurant.tagline || '');
  const [address, setAddress] = useState(restaurant.address);
  const [city, setCity] = useState(restaurant.city);
  const [phone, setPhone] = useState(restaurant.phone);
  const [email, setEmail] = useState(restaurant.email || '');
  const [gstin, setGstin] = useState(restaurant.gstin || '');
  const [fssai, setFssai] = useState(restaurant.fssai_license || '');

  const [cgstRate, setCgstRate] = useState(settings.cgst_rate);
  const [sgstRate, setSgstRate] = useState(settings.sgst_rate);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState(settings.loyalty_min_order_amount);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    dbAdapter.updateRestaurant({
      name,
      tagline,
      address,
      city,
      phone,
      email,
      gstin,
      fssai_license: fssai,
    });
    dbAdapter.updateSettings({
      cgst_rate: cgstRate,
      sgst_rate: sgstRate,
      loyalty_min_order_amount: loyaltyThreshold,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Restaurant Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Establishment information, tax rates and loyalty policy</p>
          </div>
          {isSaved && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved Successfully
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Business Profile */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
              Establishment Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Restaurant Legal Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
              <Input
                label="Primary Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Input
                label="Contact Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="GSTIN Number"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
              />
              <Input
                label="FSSAI License"
                value={fssai}
                onChange={(e) => setFssai(e.target.value)}
              />
            </div>

            <Input
              label="Physical Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Indian GST Tax Rates */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
              Taxation & Digital Stamps
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="CGST Rate (%)"
                type="number"
                step="0.01"
                value={cgstRate}
                onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
              />
              <Input
                label="SGST Rate (%)"
                type="number"
                step="0.01"
                value={sgstRate}
                onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
              />
              <Input
                label="Min Order for Stamp (₹)"
                type="number"
                value={loyaltyThreshold}
                onChange={(e) => setLoyaltyThreshold(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="lg" leftIcon={<Save className="w-4 h-4" />}>
              Save Restaurant Configuration
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};
