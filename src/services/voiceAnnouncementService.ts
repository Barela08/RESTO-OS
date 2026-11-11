// ====================================================================
// RESTO OS - Smart Voice Announcement Engine (SpeechSynthesis + Queue)
// Role-filtered, Hindi/English, Autoplay-safe & Non-overlapping
// ====================================================================

import { VoiceLanguage, VoiceEventType, StaffRoleType, NotificationEvent, VoiceSettings } from '../types';
import { audioService } from './audioService';

interface QueuedAnnouncement {
  id: string;
  text: string;
  language: VoiceLanguage;
  volume: number;
  rate: number;
  repeatCount: number;
}

class VoiceAnnouncementService {
  private queue: QueuedAnnouncement[] = [];
  private isSpeaking: boolean = false;
  private isAudioUnlocked: boolean = false;
  private announcedEventIds: Set<string> = new Set();
  private sessionStartTime: number = Date.now();
  private availableVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initVoices();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.initVoices();
        };
      }
      // Check if previously unlocked in this session
      const unlocked = sessionStorage.getItem('resto_audio_unlocked');
      if (unlocked === 'true') {
        this.isAudioUnlocked = true;
      }
    }
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        this.availableVoices = window.speechSynthesis.getVoices() || [];
        if (this.availableVoices.length > 0) {
          this.voicesLoaded = true;
        }
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Browser autoplay policy compliance:
   * Requires explicit user activation before playing speech
   */
  public unlockAudio(): boolean {
    this.isAudioUnlocked = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('resto_audio_unlocked', 'true');
      // Play brief synth sound to prime the audio pipeline
      audioService.playNewOrderChime();
      // Resume speechSynthesis if pending/paused
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    }
    return true;
  }

  public getIsAudioUnlocked(): boolean {
    return this.isAudioUnlocked;
  }

  /**
   * Determine if an event type is relevant to a staff role
   */
  public isEventRelevantToRole(
    eventType: VoiceEventType,
    role: StaffRoleType,
    payload: Record<string, any>,
    currentStaffId?: string
  ): boolean {
    // Admin receives all critical events
    if (role === 'admin' || role === 'owner') {
      return true;
    }

    if (role === 'counter') {
      return [
        'NEW_ORDER',
        'NEW_TABLE_ORDER',
        'REQUEST_BILL',
        'PAYMENT_RECEIVED',
        'REPEAT_SCAN',
        'REPEAT_SCAN_APPROVAL',
        'URGENT_ASSISTANCE',
      ].includes(eventType);
    }

    if (role === 'waiter') {
      // If table is assigned to this waiter, or unassigned broadcast
      if (payload.waiter_id && currentStaffId && payload.waiter_id !== currentStaffId) {
        return false;
      }
      return [
        'NEW_ORDER',
        'NEW_TABLE_ORDER',
        'CALL_WAITER',
        'ORDER_READY',
        'URGENT_ASSISTANCE',
      ].includes(eventType);
    }

    if (role === 'kitchen') {
      return [
        'NEW_ORDER',
        'NEW_TABLE_ORDER',
        'ORDER_CANCELLED',
        'URGENT_ASSISTANCE',
      ].includes(eventType);
    }

    return false;
  }

  /**
   * Generate phrasing in Hindi or English according to specs
   */
  public formatAnnouncementText(
    eventType: VoiceEventType,
    payload: Record<string, any>,
    language: VoiceLanguage = 'hi',
    targetRole?: StaffRoleType
  ): string {
    const tableNum = payload.table_number || (payload.table_id ? `T-${payload.table_id.slice(-2)}` : 'Table');
    const waiterName = payload.waiter_name;

    if (language === 'hi') {
      switch (eventType) {
        case 'NEW_ORDER':
        case 'NEW_TABLE_ORDER':
          if (targetRole === 'waiter' && waiterName) {
            return `Waiter ${waiterName}, Table number ${tableNum} se naya order aaya hai. Please check your dashboard.`;
          }
          return `Dhyan dijiye! Table number ${tableNum} se naya order aaya hai. Kripya order check karein.`;

        case 'CALL_WAITER':
          return `Dhyan dijiye! Table number ${tableNum} se waiter ko bulaya ja raha hai. Kripya Table Number ${tableNum} par jaiye.`;

        case 'ORDER_READY':
          return `Table number ${tableNum} ka order ready hai. Assigned waiter kripya food collect karein.`;

        case 'REQUEST_BILL':
          return `Table number ${tableNum} se bill request aayi hai.`;

        case 'PAYMENT_RECEIVED':
          return `Table number ${tableNum} ka payment receive ho gaya hai.`;

        case 'REPEAT_SCAN':
          return `Table number ${tableNum} ka repeat QR scan detect hua hai. Counter confirmation required.`;

        case 'REPEAT_SCAN_APPROVAL':
          return `Table number ${tableNum} ka repeat scan approve ho gaya hai.`;

        case 'URGENT_ASSISTANCE':
          return `Dhyan dijiye! Table number ${tableNum} par tatkaal sahayata ki aavashyakta hai.`;

        case 'ORDER_CANCELLED':
          return `Table number ${tableNum} ka order cancel kar diya gaya hai.`;

        default:
          return `Dhyan dijiye! Table number ${tableNum} se notification praapt hui hai.`;
      }
    } else {
      // English phrasing
      switch (eventType) {
        case 'NEW_ORDER':
        case 'NEW_TABLE_ORDER':
          if (targetRole === 'waiter' && waiterName) {
            return `Waiter ${waiterName}, a new order has been placed from Table Number ${tableNum}. Please check your dashboard.`;
          }
          return `Attention! A new order has been received from Table Number ${tableNum}. Please check the order.`;

        case 'CALL_WAITER':
          return `Attention! A waiter has been requested from Table Number ${tableNum}. Please attend the table.`;

        case 'ORDER_READY':
          return `Order for Table Number ${tableNum} is ready. Assigned waiter please collect the food.`;

        case 'REQUEST_BILL':
          return `A bill has been requested from Table Number ${tableNum}.`;

        case 'PAYMENT_RECEIVED':
          return `Payment received for Table Number ${tableNum}.`;

        case 'REPEAT_SCAN':
          return `Repeat QR scan detected for Table Number ${tableNum}. Counter confirmation required.`;

        case 'REPEAT_SCAN_APPROVAL':
          return `Repeat QR scan has been approved for Table Number ${tableNum}.`;

        case 'URGENT_ASSISTANCE':
          return `Urgent attention required at Table Number ${tableNum}.`;

        case 'ORDER_CANCELLED':
          return `Order for Table Number ${tableNum} has been cancelled.`;

        default:
          return `Attention! New notification for Table Number ${tableNum}.`;
      }
    }
  }

  /**
   * Process a notification event and announce if eligible
   */
  public processNotificationEvent(
    event: NotificationEvent,
    settings: VoiceSettings,
    currentRole: StaffRoleType,
    currentStaffId?: string
  ): boolean {
    // 1. Prevent duplicate announcements of the same event ID
    if (this.announcedEventIds.has(event.id)) {
      return false;
    }

    // 2. Prevent announcing stale historical events that occurred prior to current session mount
    const eventTime = new Date(event.created_at).getTime();
    if (eventTime < this.sessionStartTime - 5000) {
      this.announcedEventIds.add(event.id);
      return false;
    }

    // 3. Check if voice and event type are enabled in settings
    if (!settings.voice_enabled) {
      if (settings.sound_enabled) {
        this.playFallbackSound(event.event_type);
      }
      this.announcedEventIds.add(event.id);
      return false;
    }

    if (settings.enabled_events && settings.enabled_events[event.event_type] === false) {
      this.announcedEventIds.add(event.id);
      return false;
    }

    // 4. Role relevance filter
    const isRelevant = this.isEventRelevantToRole(
      event.event_type,
      currentRole,
      event.event_payload,
      currentStaffId
    );

    if (!isRelevant) {
      this.announcedEventIds.add(event.id);
      return false;
    }

    // Mark as announced
    this.announcedEventIds.add(event.id);

    // 5. Play chime first if sound enabled
    if (settings.sound_enabled) {
      this.playFallbackSound(event.event_type);
    }

    // 6. Generate text and enqueue announcement
    const text = this.formatAnnouncementText(
      event.event_type,
      event.event_payload,
      settings.language || 'hi',
      currentRole
    );

    this.enqueueAnnouncement({
      id: event.id,
      text,
      language: settings.language || 'hi',
      volume: typeof settings.volume === 'number' ? settings.volume : 1.0,
      rate: typeof settings.speech_rate === 'number' ? settings.speech_rate : 1.0,
      repeatCount: settings.repeat_count || 1,
    });

    return true;
  }

  /**
   * Enqueue speech item into non-overlapping queue
   */
  public enqueueAnnouncement(item: QueuedAnnouncement) {
    this.queue.push(item);
    if (!this.isSpeaking) {
      this.processNextInQueue();
    }
  }

  private processNextInQueue() {
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.queue.shift();
      return;
    }

    this.isSpeaking = true;
    const current = this.queue[0];

    // Ensure natural table number pronunciation in speech synthesis (e.g. "Table number 10", never "T-10" or "T10")
    const spokenText = current.text
      .replace(/\bTable\s+number\s+T-0*(\d+)\b/gi, 'Table number $1')
      .replace(/\bTable\s+T-0*(\d+)\b/gi, 'Table number $1')
      .replace(/\bT-0*(\d+)\b/gi, 'Table number $1')
      .replace(/\bTable\s+T(\d+)\b/gi, 'Table number $1');

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.volume = Math.max(0.1, Math.min(1.0, current.volume));
    utterance.rate = Math.max(0.5, Math.min(2.0, current.rate));

    // Choose voice
    const voice = this.selectBestVoice(current.language);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = current.language === 'hi' ? 'hi-IN' : 'en-IN';

    utterance.onend = () => {
      current.repeatCount -= 1;
      if (current.repeatCount > 0) {
        // Repeat after small pause
        setTimeout(() => this.processNextInQueue(), 600);
      } else {
        this.queue.shift();
        setTimeout(() => this.processNextInQueue(), 400);
      }
    };

    utterance.onerror = () => {
      this.queue.shift();
      this.processNextInQueue();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      this.queue.shift();
      this.processNextInQueue();
    }
  }

  private selectBestVoice(lang: VoiceLanguage): SpeechSynthesisVoice | null {
    if (!this.voicesLoaded) {
      this.initVoices();
    }
    if (!this.availableVoices || this.availableVoices.length === 0) {
      return null;
    }

    if (lang === 'hi') {
      const hindiVoice = this.availableVoices.find(
        v => v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi')
      );
      if (hindiVoice) return hindiVoice;
    }

    // Default to Indian English or any English
    const indianEnglish = this.availableVoices.find(
      v => v.lang.toLowerCase() === 'en-in' || v.name.toLowerCase().includes('india')
    );
    if (indianEnglish) return indianEnglish;

    const anyEnglish = this.availableVoices.find(v => v.lang.toLowerCase().startsWith('en'));
    return anyEnglish || this.availableVoices[0] || null;
  }

  private playFallbackSound(eventType: VoiceEventType) {
    switch (eventType) {
      case 'NEW_ORDER':
      case 'NEW_TABLE_ORDER':
        audioService.playNewOrderChime();
        break;
      case 'CALL_WAITER':
      case 'REQUEST_BILL':
      case 'ORDER_READY':
        audioService.playWaiterCallBell();
        break;
      case 'REPEAT_SCAN':
      case 'URGENT_ASSISTANCE':
      case 'ORDER_CANCELLED':
        audioService.playRepeatScanAlert();
        break;
      default:
        audioService.playNewOrderChime();
    }
  }

  /**
   * Manual test button helper
   */
  public testSpeech(text?: string, lang: VoiceLanguage = 'hi', volume = 1.0, rate = 1.0) {
    const sampleText =
      text ||
      (lang === 'hi'
        ? 'Dhyan dijiye! Yeh Resto OS voice announcement system ka speaker test hai.'
        : 'Attention! This is a speaker test for the Resto OS voice announcement system.');

    this.enqueueAnnouncement({
      id: `test-${Date.now()}`,
      text: sampleText,
      language: lang,
      volume,
      rate,
      repeatCount: 1,
    });
  }

  public testSpeakerSound() {
    audioService.playNewOrderChime();
    setTimeout(() => audioService.playWaiterCallBell(), 500);
  }

  public updateSettings(settings: Partial<VoiceSettings>) {
    // Allows service to update internal cached parameters if needed
  }

  public announceEvent(event: NotificationEvent, settings: VoiceSettings) {
    const role = (typeof window !== 'undefined' ? localStorage.getItem('resto_active_role') : 'admin') || 'admin';
    const staffId = typeof window !== 'undefined' ? localStorage.getItem('resto_staff_id') || undefined : undefined;
    this.processNotificationEvent(event, settings, role as StaffRoleType, staffId);
  }

  public hasAnnounced(eventId: string): boolean {
    return this.announcedEventIds.has(eventId);
  }

  public markAnnounced(eventId: string): void {
    this.announcedEventIds.add(eventId);
  }
}

export const voiceAnnouncementService = new VoiceAnnouncementService();
