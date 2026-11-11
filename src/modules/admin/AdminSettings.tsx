import React, { useState } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { voiceAnnouncementService } from '../../services/voiceAnnouncementService';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Settings,
  Save,
  CheckCircle2,
  Volume2,
  VolumeX,
  CreditCard,
  QrCode,
  Mic,
  Sliders,
  Bell,
  Building,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { VoiceLanguage, VoiceEventType } from '../../types';

export const AdminSettings: React.FC = () => {
  const restaurant = dbAdapter.getRestaurant();
  const settings = dbAdapter.getSettings();
  const voice = dbAdapter.getVoiceSettings();
  const payment = dbAdapter.getPaymentSettings();

  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VOICE' | 'PAYMENT'>('GENERAL');

  // General Settings State
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

  // Voice Settings State
  const [voiceEnabled, setVoiceEnabled] = useState(voice.voice_enabled);
  const [soundEnabled, setSoundEnabled] = useState(voice.sound_enabled);
  const [language, setLanguage] = useState<VoiceLanguage>(voice.language || 'hi');
  const [volume, setVolume] = useState(voice.volume);
  const [speechRate, setSpeechRate] = useState(voice.speech_rate);
  const [repeatCount, setRepeatCount] = useState(voice.repeat_count || 1);
  const [enabledEvents, setEnabledEvents] = useState<Record<VoiceEventType, boolean>>(
    voice.enabled_events || {
      NEW_ORDER: true,
      NEW_TABLE_ORDER: true,
      CALL_WAITER: true,
      REQUEST_BILL: true,
      ORDER_READY: true,
      PAYMENT_RECEIVED: true,
      REPEAT_SCAN: true,
      REPEAT_SCAN_APPROVAL: true,
      URGENT_ASSISTANCE: true,
      ORDER_CANCELLED: true,
    }
  );

  // Payment Settings State (Manual UPI QR)
  const [upiId, setUpiId] = useState(payment.upi_id);
  const [merchantName, setMerchantName] = useState(payment.merchant_name);
  const [qrImageUrl, setQrImageUrl] = useState(payment.qr_image_url || '');
  const [upiEnabled, setUpiEnabled] = useState(payment.upi_enabled);
  const [cashEnabled, setCashEnabled] = useState(payment.cash_enabled);
  const [manualVerificationEnabled, setManualVerificationEnabled] = useState(
    payment.manual_verification_enabled
  );
  const [requireTransactionRef, setRequireTransactionRef] = useState(
    payment.require_transaction_ref
  );
  const [paymentInstructions, setPaymentInstructions] = useState(payment.payment_instructions);
  const [upiDisplayName, setUpiDisplayName] = useState(payment.upi_display_name);

  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('Settings Saved Successfully');

  const handleSaveGeneral = (e: React.FormEvent) => {
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
    triggerSaved('General settings updated.');
  };

  const handleSaveVoice = (e: React.FormEvent) => {
    e.preventDefault();
    dbAdapter.updateVoiceSettings({
      voice_enabled: voiceEnabled,
      sound_enabled: soundEnabled,
      language,
      volume,
      speech_rate: speechRate,
      repeat_count: repeatCount,
      enabled_events: enabledEvents,
    });
    triggerSaved('Voice announcement settings updated.');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (upiEnabled && (!upiId.includes('@') || upiId.trim().length < 5)) {
      alert('Please enter a valid Merchant UPI ID / VPA (e.g. restaurant@okaxis).');
      return;
    }
    dbAdapter.updatePaymentSettings({
      upi_id: upiId.trim(),
      merchant_name: merchantName.trim(),
      qr_image_url: qrImageUrl.trim(),
      upi_enabled: upiEnabled,
      cash_enabled: cashEnabled,
      manual_verification_enabled: manualVerificationEnabled,
      require_transaction_ref: requireTransactionRef,
      payment_instructions: paymentInstructions.trim(),
      upi_display_name: upiDisplayName.trim(),
    });
    triggerSaved('UPI & Payment settings updated.');
  };

  const triggerSaved = (msg: string) => {
    setSaveMessage(msg);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleQRFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG/JPG).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setQrImageUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleEvent = (evt: VoiceEventType) => {
    setEnabledEvents((prev) => ({
      ...prev,
      [evt]: !prev[evt],
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Establishment info, Smart Voice Announcement Engine & UPI QR Configuration
            </p>
          </div>
          {isSaved && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> {saveMessage}
            </span>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('GENERAL')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'GENERAL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Establishment & Tax</span>
          </button>

          <button
            onClick={() => setActiveTab('VOICE')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'VOICE'
                ? 'bg-brand-purple text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Voice & Notification Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('PAYMENT')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'PAYMENT'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment & UPI Configuration</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: GENERAL ESTABLISHMENT PROFILE & TAX                     */}
        {/* ============================================================== */}
        {activeTab === 'GENERAL' && (
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                <Building className="w-4 h-4 text-brand-purple" />
                <span>Establishment Profile</span>
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
                Save Establishment Details
              </Button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SMART VOICE ANNOUNCEMENT SYSTEM SETTINGS               */}
        {/* ============================================================== */}
        {activeTab === 'VOICE' && (
          <form onSubmit={handleSaveVoice} className="space-y-6">
            {/* Core Audio & Voice Toggles */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-brand-purple" />
                    <span>Smart Voice Announcement System</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Centralized speech announcements automatically spoken through staff terminals
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<Mic className="w-3.5 h-3.5 text-brand-orange" />}
                    onClick={() => {
                      voiceAnnouncementService.unlockAudio();
                      voiceAnnouncementService.testSpeech(undefined, language, volume, speechRate);
                    }}
                  >
                    Test Voice ({language.toUpperCase()})
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Bell className="w-3.5 h-3.5" />}
                    onClick={() => {
                      voiceAnnouncementService.unlockAudio();
                      voiceAnnouncementService.testSpeakerSound();
                    }}
                  >
                    Test Speaker Chimes
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50/60">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Enable Voice Announcements</p>
                    <p className="text-[11px] text-slate-500">Synthesize spoken audio on staff devices</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceEnabled}
                      onChange={(e) => setVoiceEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple" />
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50/60">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Notification Sound Chimes</p>
                    <p className="text-[11px] text-slate-500">Play pleasant alerts before speech</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange" />
                  </label>
                </div>
              </div>

              {/* Language Selection */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Announcement Language
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLanguage('hi')}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      language === 'hi'
                        ? 'border-brand-purple bg-purple-50/60 ring-2 ring-brand-purple/20 font-bold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-xs text-slate-900">Hindi (हिंदी)</p>
                      <p className="text-[11px] text-slate-500">
                        "Dhyan dijiye! Table number 5 se naya order aaya hai."
                      </p>
                    </div>
                    {language === 'hi' && <CheckCircle2 className="w-4 h-4 text-brand-purple shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      language === 'en'
                        ? 'border-brand-purple bg-purple-50/60 ring-2 ring-brand-purple/20 font-bold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-xs text-slate-900">English</p>
                      <p className="text-[11px] text-slate-500">
                        "Attention! A new order has been received from Table Number 5."
                      </p>
                    </div>
                    {language === 'en' && <CheckCircle2 className="w-4 h-4 text-brand-purple shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Volume, Speed & Repeat Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">Volume</span>
                    <span className="text-brand-purple font-mono">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-brand-purple"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">Voice Speed (Rate)</span>
                    <span className="text-brand-purple font-mono">{speechRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full accent-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Repeat Announcement Count
                  </label>
                  <select
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(parseInt(e.target.value, 10))}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value={1}>1 Time (Standard)</option>
                    <option value={2}>2 Times (Important Alerts)</option>
                    <option value={3}>3 Times (Noisy Environments)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Event-Specific Voice Controls */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Event-Specific Voice Controls</span>
                <span className="text-[11px] text-slate-400 font-normal">Toggle individual voice triggers</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { key: 'NEW_ORDER', label: '1. New Order Received', desc: 'Alerts counter & assigned waiter' },
                  { key: 'NEW_TABLE_ORDER', label: '2. New Table Session Order', desc: 'First table order of dining session' },
                  { key: 'CALL_WAITER', label: '3. Waiter Called', desc: 'Direct assistance summon on waiter device' },
                  { key: 'REQUEST_BILL', label: '4. Bill Requested', desc: 'Customer requests invoice settlement' },
                  { key: 'ORDER_READY', label: '5. Food Ready', desc: 'Kitchen tickets ready for table pickup' },
                  { key: 'PAYMENT_RECEIVED', label: '6. Payment Received', desc: 'Approved UPI or verified cash settlement' },
                  { key: 'REPEAT_SCAN', label: '7. Repeat QR Scan Detected', desc: 'Requires cash counter session verification' },
                  { key: 'REPEAT_SCAN_APPROVAL', label: '8. Repeat QR Approved', desc: 'Confirmation when session is continued/split' },
                  { key: 'URGENT_ASSISTANCE', label: '9. Urgent Customer Assistance', desc: 'High priority customer calls' },
                  { key: 'ORDER_CANCELLED', label: '10. Order Cancellation', desc: 'Kitchen / Counter cancellation alerts' },
                ].map((item) => (
                  <div
                    key={item.key}
                    onClick={() => toggleEvent(item.key as VoiceEventType)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      enabledEvents[item.key as VoiceEventType]
                        ? 'border-purple-200 bg-purple-50/40 text-slate-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                    }`}
                  >
                    <div>
                      <p className="text-xs">{item.label}</p>
                      <p className="text-[10px] text-slate-500 font-normal">{item.desc}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        enabledEvents[item.key as VoiceEventType]
                          ? 'bg-purple-100 text-brand-purple'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {enabledEvents[item.key as VoiceEventType] ? 'Active' : 'Muted'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="lg" leftIcon={<Save className="w-4 h-4" />}>
                Save Voice Announcement Settings
              </Button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PAYMENT SETTINGS – MANUAL UPI ID + QR CONFIGURATION     */}
        {/* ============================================================== */}
        {activeTab === 'PAYMENT' && (
          <form onSubmit={handleSavePayment} className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand-orange" />
                  <span>Manual Merchant UPI & QR Configuration</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct peer-to-merchant UPI payment without gateway intermediaries. Supports Google Pay, PhonePe, Paytm, and BHIM.
                </p>
              </div>

              {/* UPI & Cash Channel Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50/60">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Enable Direct UPI Payment</p>
                    <p className="text-[11px] text-slate-500">Allow customers to pay via UPI QR & URI</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={upiEnabled}
                      onChange={(e) => setUpiEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50/60">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Enable Cash at Register</p>
                    <p className="text-[11px] text-slate-500">Allow customers to settle cash at counter</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashEnabled}
                      onChange={(e) => setCashEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange" />
                  </label>
                </div>
              </div>

              {/* Merchant Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Input
                  label="Merchant UPI ID (VPA)"
                  placeholder="e.g. grandbistro@okaxis or your-resto@icici"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required={upiEnabled}
                />
                <Input
                  label="Merchant Legal / Display Name"
                  placeholder="e.g. The Grand Bistro Indiranagar"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  required={upiEnabled}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="UPI Payment Display Label (on customer bill)"
                  value={upiDisplayName}
                  onChange={(e) => setUpiDisplayName(e.target.value)}
                  placeholder="e.g. Direct UPI (Zero Extra Charge)"
                />
                <Input
                  label="Static Merchant QR Code Image URL"
                  value={qrImageUrl}
                  onChange={(e) => setQrImageUrl(e.target.value)}
                  placeholder="https://... or upload image below"
                />
              </div>

              {/* QR Upload and Preview Box */}
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col sm:flex-row items-center gap-6">
                <div className="w-32 h-32 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-2 shadow-sm shrink-0 overflow-hidden">
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt="Merchant UPI QR" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-12 h-12 text-slate-300" />
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <span className="font-bold text-slate-900 block">Upload Official Merchant UPI QR Code</span>
                  <p className="text-slate-500">
                    Upload your physical merchant standee QR (from BharatPe, PhonePe, Paytm, or your bank).
                    Customers will see this along with dynamically generated bill QR.
                  </p>
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer font-bold text-slate-700 shadow-sm transition-colors">
                    <Upload className="w-3.5 h-3.5 text-brand-orange" />
                    <span>Upload QR Image File</span>
                    <input type="file" accept="image/*" onChange={handleQRFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Payment Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-brand-purple"
                  placeholder="Instructions displayed on customer payment page"
                />
              </div>

              {/* Security & Verification Constraints */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">Require Transaction Reference (UTR)</p>
                    <p className="text-[11px] text-slate-500">Mandate customer to enter 12-digit bank reference</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireTransactionRef}
                    onChange={(e) => setRequireTransactionRef(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">Require Cash Counter Verification</p>
                    <p className="text-[11px] text-slate-500">Only verified UTR marks order as PAID</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={manualVerificationEnabled}
                    onChange={(e) => setManualVerificationEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="orange" size="lg" leftIcon={<Save className="w-4 h-4" />}>
                Save Payment & UPI Configuration
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};
