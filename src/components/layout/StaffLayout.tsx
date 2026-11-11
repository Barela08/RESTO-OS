import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, LogOut, ArrowLeft, RefreshCw, Mic, Sparkles } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { voiceAnnouncementService } from '../../services/voiceAnnouncementService';
import { dbAdapter } from '../../services/databaseAdapter';
import { useAuthStore } from '../../store/authStore';

interface StaffLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  activeRole: 'waiter' | 'kitchen' | 'counter';
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  title,
  subtitle,
  children,
  actions,
  activeRole,
}) => {
  const navigate = useNavigate();
  const { currentProfile, logout } = useAuthStore();
  const [isMuted, setIsMuted] = useState(audioService.getIsMuted());
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(voiceAnnouncementService.getIsAudioUnlocked());
  const [voiceSettings, setVoiceSettings] = useState(dbAdapter.getVoiceSettings());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('resto_active_role', activeRole);
    }
    const updateVoice = () => {
      setVoiceSettings(dbAdapter.getVoiceSettings());
    };
    return dbAdapter.subscribe(updateVoice);
  }, [activeRole]);

  const toggleSound = () => {
    const next = !isMuted;
    audioService.setMuted(next);
    setIsMuted(next);
  };

  const handleUnlockAudio = () => {
    voiceAnnouncementService.unlockAudio();
    setIsAudioUnlocked(true);
    // Play test announcement
    voiceAnnouncementService.testSpeech(
      voiceSettings.language === 'hi'
        ? `Audio active ho gaya hai. ${activeRole} station ready hai.`
        : `Audio activated. ${activeRole} station is ready.`,
      voiceSettings.language
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col font-sans">
      {/* Autoplay Audio Activation Banner */}
      {!isAudioUnlocked && (
        <div
          onClick={handleUnlockAudio}
          className="bg-gradient-to-r from-brand-purple via-indigo-600 to-brand-orange text-white px-4 py-2.5 text-xs flex items-center justify-between cursor-pointer hover:opacity-95 transition-opacity shadow-md sticky top-0 z-40"
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <Volume2 className="w-4 h-4 animate-bounce text-amber-300 shrink-0" />
            <span className="font-extrabold tracking-wide">
              Browser Autoplay Restriction: Click here to activate Real-Time Voice Announcements on this {activeRole} device.
            </span>
          </div>
          <button className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold shrink-0">
            Enable Voice Alerts
          </button>
        </div>
      )}

      {/* Top Bar for Staff Operations */}
      <header className="h-16 bg-[#111827] border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-wide">{title}</h1>
              <span className="px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple text-[10px] font-bold uppercase tracking-wider">
                {activeRole}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
                {voiceSettings.voice_enabled ? `Voice: ${voiceSettings.language.toUpperCase()}` : 'Voice OFF'}
              </span>
            </div>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions}

          <button
            onClick={() => {
              if (!isAudioUnlocked) handleUnlockAudio();
              else voiceAnnouncementService.testSpeech(undefined, voiceSettings.language);
            }}
            title="Test Voice Announcement"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Mic className="w-3.5 h-3.5 text-brand-orange" />
            <span className="hidden sm:inline font-semibold text-[11px]">Test Voice</span>
          </button>

          <button
            onClick={() => window.location.reload()}
            title="Refresh State"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleSound}
            title={isMuted ? 'Unmute Audio Chimes' : 'Mute Audio Chimes'}
            className={`p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors ${
              isMuted
                ? 'bg-red-950/80 text-red-400 border border-red-800'
                : 'bg-slate-800 text-green-400 border border-slate-700'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline font-semibold text-[11px]">{isMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <span className="text-slate-300 font-semibold">{currentProfile?.full_name || 'Staff User'}</span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/staff/login');
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 transition-colors"
            title="Staff Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Staff Interactive Display */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
};
