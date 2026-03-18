# TATC — Teacher Online Attendance System

ระบบเช็คการเข้า-ออกครูออนไลน์ · MVP Build

## Stack
- **Next.js 14** (App Router + TypeScript)
- **Supabase** (PostgreSQL + RLS)
- **NextAuth.js** + LINE Login OAuth 2.0
- **ExcelJS** (Export .xlsx)
- **Vercel** (Deploy)

---

## Setup (ทำตามลำดับ)

### 1. สร้าง LINE Login Channel
1. ไปที่ https://developers.line.biz → Create a **LINE Login** channel
2. ไปที่ **LINE Login** tab → เปิด "Web app"
3. ตั้ง Callback URL: `https://your-domain.vercel.app/api/auth/callback/line`
4. คัดลอก **Channel ID** และ **Channel Secret**

### 2. สร้าง Supabase Project
1. ไปที่ https://supabase.com → New Project
2. ไปที่ **SQL Editor** → วาง `supabase/migrations/001_init.sql` แล้วรัน
3. คัดลอก **Project URL**, **anon key**, **service_role key**

### 3. เพิ่ม Admin account แรก
```sql
-- รันใน Supabase SQL Editor
-- เปลี่ยน line_user_id เป็น LINE User ID ของคุณ
-- (หา LINE User ID ได้จาก LINE Developers Console → Messaging API → Basic Settings)
INSERT INTO public.users (line_user_id, full_name_th, role)
VALUES ('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'ชื่อ Admin', 'admin');
```

### 4. Install และ config local
```bash
npm install

# สร้างไฟล์ .env.local จาก template
cp .env.local .env.local.example  # backup template
# แก้ไข .env.local ใส่ค่าจริงทุกตัว

npm run dev
# เปิด http://localhost:3000
```

### 5. Deploy บน Vercel
```bash
npm install -g vercel
vercel --prod
# ตั้ง Environment Variables ใน Vercel Dashboard
# (ใส่ค่าเดียวกับ .env.local ทุกตัว)
```

---

## ตัวแปรสิ่งแวดล้อม (.env.local)

| Key | ได้จาก |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `LINE_CLIENT_ID` | LINE Developers → Channel ID |
| `LINE_CLIENT_SECRET` | LINE Developers → Channel Secret |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL จริงของ app |
| `NEXT_PUBLIC_SCHOOL_LAT` | Latitude ของวิทยาลัย |
| `NEXT_PUBLIC_SCHOOL_LNG` | Longitude ของวิทยาลัย |
| `NEXT_PUBLIC_GEOFENCE_RADIUS` | รัศมี (เมตร) ค่าเริ่มต้น 300 |
| `NEXT_PUBLIC_REQUIRE_SELFIE` | `true` หรือ `false` |
| `NEXT_PUBLIC_CHECKIN_CUTOFF` | เวลาตัดสาย เช่น `08:30` |

---

## โครงสร้าง Project

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     ← LINE OAuth handler
│   │   ├── attendance/
│   │   │   ├── checkin/            ← POST: บันทึกเช็คอิน
│   │   │   ├── checkout/           ← POST: บันทึกเช็คเอาท์
│   │   │   ├── today/              ← GET:  สถานะวันนี้
│   │   │   └── history/            ← GET:  ประวัติย้อนหลัง
│   │   └── admin/
│   │       ├── attendance/         ← GET:  ทุกคนวันนี้ (admin)
│   │       └── export/             ← GET:  Export .xlsx (admin)
│   ├── auth/signin/                ← หน้า Login
│   ├── checkin/                    ← หน้าเช็คอิน (ครู)
│   ├── dashboard/                  ← Dashboard (admin)
│   ├── presence/                   ← กระดานสถานะ
│   └── report/                     ← รายงานรายเดือน
├── components/
│   ├── layout/AppShell.tsx         ← Sidebar + Topbar
│   └── ui/index.tsx                ← Chip, StatCard, Panel, LocBadge
├── lib/
│   ├── auth.ts                     ← NextAuth config + whitelist check
│   ├── supabase.ts                 ← Browser + Server clients
│   └── attendance.ts               ← Geofence, status logic, zod
├── middleware.ts                   ← Route guard + role redirect
└── types/
    ├── index.ts                    ← App types (aligned with DB)
    └── next-auth.d.ts              ← Session type augmentation
```

---

## Business Rules

| สถานะ | เงื่อนไข |
|--------|---------|
| `present` | เช็คอินก่อนหรือตรง `CHECKIN_CUTOFF` (08:30) |
| `late` | เช็คอินหลัง `CHECKIN_CUTOFF` |
| `absent` | ไม่มี check_in_at ภายในวันทำงาน |
| `wfh` | เช็คอิน mode WFH (ไม่ใช้ GPS) |

Auto-mark absent: รัน batch job เวลา 17:00 ทุกวัน  
SQL อยู่ใน `supabase/migrations/001_init.sql` (comment ด้านล่าง)

---

## Phase 2 Backlog
- ระบบใบลา (ยื่น / อนุมัติ / ปฏิเสธ)
- LINE Notification แจ้งเตือน
- Selfie verification
- Admin override บันทึกย้อนหลัง
- กราฟสถิติรายเดือน
