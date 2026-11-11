# RESTO OS - Design System Specification

## 1. Visual Theme & Palette

### Admin & Staff Management (Dark Navy & Clean Slate)
- **Primary Navy:** `#111827` (Top bars, deep accents, badges)
- **Sidebar Background:** `#0B1220` (Dark high-contrast navigation)
- **Primary Purple:** `#7047EB` (Interactive buttons, focus states, selected states)
- **Hover Purple:** `#5E35D6`
- **Dashboard Background:** `#F7F8FC` (Light, readable high-productivity canvas)
- **Success Green:** `#16A34A` (Available tables, ready orders, paid status)
- **Warning Amber:** `#F59E0B` (Pending bills, preparing tickets, repeat scan alerts)
- **Danger Red:** `#DC2626` (Cancelled, rejected, revoked QR, urgent alerts)

### Customer Experience (Warm Bistro & Appetizing)
- **Warm Canvas:** `#FAF7F2` & `#FFFBEB`
- **Restaurant Orange:** `#F97316` & `#EA580C` (Appetizing action buttons, cart pill)
- **Dark Charcoal:** `#1F2937` (Sharp typography, card borders)
- **Pure White Cards:** `#FFFFFF` with `box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05)`

## 2. Typography & Hierarchy
- **Font Family:** `Plus Jakarta Sans`, `Inter`, `sans-serif`
- **Scale:**
  - Display / Hero: 24px - 32px, ExtraBold (800)
  - Section Headings: 18px - 20px, Bold (700)
  - Card Titles: 15px - 16px, SemiBold (600)
  - Body Text: 13px - 14px, Medium (500) & Regular (400)
  - Micro-labels / Badges: 10px - 11px, Bold uppercase with letter-spacing

## 3. Component Standards
- **Buttons:** Rounded-xl (`rounded-xl`), font-semibold, micro-interactions with active scale-down (`active:scale-95`).
- **Cards:** Rounded-2xl (`rounded-2xl`), subtle border `border-slate-100` or `border-slate-200`, soft hover elevation.
- **Audio Notifications:** Web Audio API sound synthesizers (Soft chime for kitchen, double beep for repeat scan alerts, high bell for bill request).
- **Print Standards:** Clean black & white GST invoice template with table breakdown and QR cards formatted for standard receipt rolls and A4 table tent cards.
