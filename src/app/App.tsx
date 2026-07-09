import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Check,
  Search, ChevronDown,
  MoreVertical, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ── Types ── */
type ViewMode = "일" | "주" | "월";
interface Project { id: string; name: string; phase: string; color: string; bg: string; members: number[]; custom?: boolean; }
interface MeetingType { id: string; label: string; requiredRoles: string[] | null; optionalRoles?: string[] | null; custom?: boolean; }
interface Person { id: number; name: string; role: string; initials: string; avatarColor: string; pref: string | null; prefType: "avoid" | "out" | "both" | null; avatarTemplate?: number; }
interface SavedEvent { id: string; meetingId: string; title: string; date: Date; hour: number; duration: number; color: string; personId: number; urgent?: boolean; pendingInvite?: boolean; location?: string; description?: string; }
interface SampleEvent { id: string; title: string; dayOffset: number; startHour: number; duration: number; color: string; }
interface EventOverride { dayOffset: number; startHour: number; }
type DragEventRef = { source: "sample" | "saved"; id: string; meetingId?: string; duration: number };
type AttendanceStatus = "accepted" | "pending" | "declined";
type CalendarEventDetail = {
  id: string;
  meetingId?: string;
  title: string;
  date: Date;
  dayOffset: number;
  startHour: number;
  duration: number;
  color: string;
  personId: number;
  urgent?: boolean;
  pendingInvite?: boolean;
  source: "sample" | "saved";
  location?: string;
  description?: string;
};

/* ── Data ── */
const DEFAULT_PROJECTS: Project[] = [
  { id: "toss-design", name: "토스 디자인 챌린지", phase: "기획",   color: "#4396FB", bg: "#ECF5FF", members: [1,2,3] },
  { id: "toss-pay",   name: "토스 페이",           phase: "개발",   color: "#3182F6", bg: "#EFF6FF", members: [1,2,4,5] },
  { id: "ux",         name: "UX 리서치",           phase: "리서치", color: "#00C3B2", bg: "#E0F9F7", members: [2,3] },
  { id: "redesign",   name: "앱 리디자인",          phase: "디자인", color: "#8B5CF6", bg: "#EDE9FE", members: [1,2,3,4,5] },
];

const DEFAULT_MEETING_TYPES: MeetingType[] = [
  { id: "urgent",  label: "긴급회의",        requiredRoles: null },
  { id: "sync",    label: "싱크",            requiredRoles: null },
  { id: "design",  label: "디자인 리뷰",     requiredRoles: ["PO","FE","UXR"] },
  { id: "kickoff", label: "킥오프",          requiredRoles: ["PO","FE","BE","UXR","QA"] },
  { id: "ux",      label: "사용성 테스트",   requiredRoles: ["PO","UXR"] },
  { id: "sprint",  label: "스프린트 플래닝", requiredRoles: ["PO","FE"] },
  { id: "release", label: "릴리즈 점검",     requiredRoles: ["PO","FE","BE","QA"] },
];

const PEOPLE: Person[] = [
  { id: 1, name: "이가영", role: "PO",  initials: "이", avatarColor: "#4285f4", pref: null, prefType: "avoid" },
  { id: 2, name: "윤지은", role: "FE",  initials: "윤", avatarColor: "#ea4335", pref: null, prefType: null },
  { id: 3, name: "박은주", role: "UXR", initials: "박", avatarColor: "#f9ab00", pref: "목요일 외근", prefType: "out" },
  { id: 4, name: "정지훈", role: "BE",  initials: "정", avatarColor: "#34a853", pref: "목요일 외근", prefType: "both" },
  { id: 5, name: "최이영", role: "QA",  initials: "최", avatarColor: "#9334e6", pref: null, prefType: "avoid" },
];
const ROLE_OPTIONS = [
  "PD", "PO", "PM", "FE", "BE", "QA", "UXR", "Design",
  "Marketing", "Business", "Sales", "CS", "Data", "Ops", "Legal",
];
const TEAM_COLOR_OPTIONS = [
  "#4396FB", "#3182F6", "#00C3B2", "#8B5CF6", "#ea4335", "#f9ab00", "#34a853", "#9334e6",
  "#FF6B6B", "#FF8A00", "#FFD43B", "#12B886", "#20C997", "#15AABF", "#4C6EF5", "#7950F2",
  "#D6336C", "#868E96", "#495057", "#7C5C48",
];
const ORGANIZER = { id: 0, name: "윤소연", role: "주최자", initials: "소연", avatarColor: "#4396FB" };
const EMERGENCY_ICON = "/icons/emergency-siren.svg";
const FOLDER_ICON = "/icons/figma-folder.svg";
const AVATAR_SOURCE_2027 = "/avatars/figma-avatar-2027.png";
const AVATAR_SOURCE_CONTAINER = "/avatars/figma-avatar-container.png";
const AVATAR_SOURCE_CHOI = "/avatars/choi-iyoung-figma.png";
const AVATAR_CROPS: Record<number, { bg: string; src: string; left: number; top: number; width: number; height: number }> = {
  0: { bg: "#e1eefe", src: AVATAR_SOURCE_2027, left: -81.5, top: -37.7, width: 160, height: 115.2 },
  1: { bg: "#b6d3ff", src: AVATAR_SOURCE_CONTAINER, left: -40.0, top: -0.2, width: 150.1, height: 112.6 },
  2: { bg: "#ffdede", src: AVATAR_SOURCE_2027, left: -106.8, top: 2.1, width: 146.1, height: 105.2 },
  3: { bg: "#faeec7", src: AVATAR_SOURCE_CONTAINER, left: -40.3, top: -35.6, width: 151.7, height: 111.6 },
  4: { bg: "#daebd1", src: AVATAR_SOURCE_CONTAINER, left: -83.3, top: -0.3, width: 162.6, height: 119 },
  5: { bg: "#dfe1ff", src: AVATAR_SOURCE_CHOI, left: -76.3, top: -72.3, width: 151.7, height: 111.6 },
};
const OOO_THURSDAY = [PEOPLE[2], PEOPLE[3]];
const LUNCH_AVOID_PEOPLE = [PEOPLE[3]];

// dayOffset: 0=Sun Jul5, 1=Mon Jul6(today), 2=Tue Jul7, 3=Wed Jul8, 4=Thu Jul9, 5=Fri Jul10, 6=Sat Jul11
const SAMPLE_EVENTS: SampleEvent[] = [
  // ─ 월 (Jul 6) ─
  { id: "m1", title: "PO 위클리 미팅",        dayOffset: 1, startHour: 9,  duration: 1,   color: "#4285f4" }, // 이가영
  { id: "m2", title: "팀 주간 싱크",           dayOffset: 1, startHour: 10, duration: 1,   color: "#4396FB" }, // 윤소연
  { id: "m3", title: "사용자 인터뷰 준비",     dayOffset: 1, startHour: 11, duration: 1,   color: "#f9ab00" }, // 박은주
  { id: "m4", title: "디자인 시스템 정기 회의",dayOffset: 1, startHour: 14, duration: 1,   color: "#ea4335" }, // 윤지은
  { id: "m5", title: "BE 코드 리뷰",          dayOffset: 1, startHour: 15, duration: 1,   color: "#34a853" }, // 정지훈
  { id: "m6", title: "QA 테스트 케이스 리뷰", dayOffset: 1, startHour: 16, duration: 1,   color: "#9334e6" }, // 최이영

  // ─ 화 (Jul 7) ─
  { id: "t1", title: "토스 디자인 챌린지 리뷰",dayOffset: 2, startHour: 10, duration: 2,   color: "#ea4335" }, // 윤지은
  { id: "t2", title: "API 계약 점검",          dayOffset: 2, startHour: 10, duration: 1,   color: "#34a853" }, // 정지훈 (overlap)
  { id: "t3", title: "버그 트리아지",          dayOffset: 2, startHour: 11, duration: 1,   color: "#9334e6" }, // 최이영
  { id: "t4", title: "토스 페이 기획 리뷰",    dayOffset: 2, startHour: 14, duration: 1.5, color: "#4396FB" }, // 윤소연
  { id: "t5", title: "UT 분석 세션",           dayOffset: 2, startHour: 15, duration: 1.5, color: "#f9ab00" }, // 박은주

  // ─ 수 (Jul 8) ─
  { id: "w1", title: "리서치 발표",            dayOffset: 3, startHour: 10, duration: 1,   color: "#f9ab00" }, // 박은주
  { id: "w2", title: "스프린트 플래닝",        dayOffset: 3, startHour: 11, duration: 1,   color: "#4396FB" }, // 윤소연
  { id: "w3", title: "제품 로드맵 검토",       dayOffset: 3, startHour: 14, duration: 1,   color: "#4285f4" }, // 이가영
  { id: "w4", title: "프로토타입 피드백",      dayOffset: 3, startHour: 14, duration: 1,   color: "#ea4335" }, // 윤지은 (overlap)
  { id: "w5", title: "DB 쿼리 최적화",         dayOffset: 3, startHour: 16, duration: 1,   color: "#34a853" }, // 정지훈

  // ─ 목 (Jul 9) — 박은주·정지훈 외근 ─
  { id: "th1", title: "이해관계자 보고",       dayOffset: 4, startHour: 10, duration: 1.5, color: "#4285f4" }, // 이가영
  { id: "th2", title: "QA 릴리즈 점검",       dayOffset: 4, startHour: 14, duration: 1,   color: "#9334e6" }, // 최이영
  { id: "th3", title: "주간 진척도 공유",      dayOffset: 4, startHour: 15, duration: 1,   color: "#4396FB" }, // 윤소연

  // ─ 금 (Jul 10) ─
  { id: "f1", title: "UX 워크숍",             dayOffset: 5, startHour: 9,  duration: 2,   color: "#ea4335" }, // 윤지은
  { id: "f2", title: "서버 배포 점검",         dayOffset: 5, startHour: 10, duration: 1,   color: "#34a853" }, // 정지훈
  { id: "f3", title: "백로그 정리",            dayOffset: 5, startHour: 11, duration: 1,   color: "#4285f4" }, // 이가영
  { id: "f4", title: "리서치 결과 공유",       dayOffset: 5, startHour: 14, duration: 1,   color: "#f9ab00" }, // 박은주
  { id: "f5", title: "릴리즈 점검 준비",       dayOffset: 5, startHour: 15, duration: 1,   color: "#4396FB" }, // 윤소연
  { id: "f6", title: "릴리즈 검증 최종 확인",  dayOffset: 5, startHour: 16, duration: 1.5, color: "#9334e6" }, // 최이영
];

// Map event color → person id (0 = ORGANIZER 윤소연)
const COLOR_TO_PID: Record<string, number> = {
  "#4396FB": 0, "#4285f4": 1, "#ea4335": 2,
  "#f9ab00": 3, "#34a853": 4, "#9334e6": 5,
};

// Pastel bg + vivid text per person color
const EVENT_PALETTE: Record<string, { bg: string; text: string }> = {
  "#4396FB": { bg: "#ECF5FF", text: "#2F7FE6" }, // primary blue
  "#4285f4": { bg: "#E8F0FE", text: "#1967D2" }, // 이가영 — blue
  "#ea4335": { bg: "#FDE8E7", text: "#C5221F" }, // 윤지은 — red
  "#f9ab00": { bg: "#FEF7E0", text: "#B06000" }, // 박은주 — amber
  "#34a853": { bg: "#E6F4EA", text: "#137333" }, // 정지훈 — green
  "#9334e6": { bg: "#F0E6FD", text: "#6D28D9" }, // 최이영 — purple
  "#3182F6": { bg: "#EAF1FE", text: "#1A5FCC" }, // toss blue 2
  "#00C3B2": { bg: "#E0F9F7", text: "#007A70" }, // teal
  "#8B5CF6": { bg: "#EDE9FE", text: "#5B21B6" }, // violet
};
function evPalette(color: string) {
  return EVENT_PALETTE[color] ?? { bg: color + "22", text: color };
}

function SuitcaseGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <g clipPath="url(#ooo-suitcase-icon)">
        <path d="M22.5 7.6602V14.76H1.5V7.6602C1.5 6.5556 2.3952 5.6604 3.4998 5.6604H20.4996C21.6042 5.6604 22.5 6.5556 22.5 7.6602Z" fill="#C3846C" />
        <path d="M22.5 14.76V19.26C22.5 20.3646 21.6048 21.2598 20.5002 21.2598H3.4998C2.3952 21.2598 1.5 20.3646 1.5 19.26V14.76H22.5Z" fill="#956759" />
        <path d="M16.7504 5.66043H15.2504C15.2504 4.46343 14.2766 3.49023 13.0802 3.49023H10.9202C9.7238 3.49023 8.75 4.46403 8.75 5.66043H7.25C7.25 3.63663 8.8964 1.99023 10.9202 1.99023H13.0802C15.104 1.99023 16.7504 3.63663 16.7504 5.66043Z" fill="#C3846C" />
        <path d="M13.9998 14.7396C13.9998 15.546 13.3458 16.2 12.5394 16.2H11.4594C10.653 16.2 9.99902 15.546 9.99902 14.7396H13.9998Z" fill="#FFC33A" />
      </g>
      <defs>
        <clipPath id="ooo-suitcase-icon">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function PreferenceGlyph({ className = "shrink-0" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="1 32 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6.87203 55.7534C6.71063 55.7534 6.54683 55.712 6.39683 55.625C5.94083 55.3622 5.78423 54.7796 6.04823 54.3236L10.499 46.6142C10.7618 46.1588 11.3438 46.0016 11.8004 46.2656C12.2564 46.5284 12.413 47.111 12.149 47.567L7.69823 55.2764C7.52183 55.5824 7.20203 55.7534 6.87203 55.7534Z" fill="#4B596A" />
      <path d="M21.9128 37.9226L13.97 33.3368C13.2968 32.948 12.4556 33.434 12.4556 34.211V35.6252C12.4556 37.4288 11.4938 39.095 9.93202 39.9968L4.08742 43.3712C3.41422 43.76 3.41422 44.7314 4.08742 45.1196L16.6496 52.3724C17.3228 52.7612 18.164 52.2752 18.164 51.4982V44.7494C18.164 42.9458 19.1258 41.2796 20.6876 40.3778L21.9128 39.6704C22.586 39.2816 22.586 38.3102 21.9128 37.922V37.9226Z" fill="#EF4452" />
    </svg>
  );
}

function MeetingAvoidGlyph({ type }: { type: "lunch" | "home" }) {
  if (type === "lunch") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
        <path d="M14.7105 8.81401C14.8671 8.25182 15.2817 7.79762 15.7959 7.52162L16.2339 7.30022L22.7589 3.88442C23.1183 3.69182 23.2479 3.24122 23.0469 2.88662L22.7757 2.41682C22.5693 2.06522 22.1139 1.95242 21.7671 2.16722L15.5463 6.11042L15.1353 6.37922C14.6397 6.68642 14.0385 6.81841 13.4733 6.67321C12.5217 6.42841 11.1039 6.38642 9.92551 7.07882C8.06851 8.17022 7.61551 9.86101 8.32651 11.0718C9.01891 12.2928 10.7097 12.7458 12.5841 11.6832C13.7727 11.0094 14.4453 9.76021 14.7093 8.81401H14.7105Z" fill="#8A94A0" />
        <path d="M9.17578 18.9293H14.8224V20.9351C14.8224 21.4901 14.3718 21.9407 13.8168 21.9407H10.182C9.62698 21.9407 9.17638 21.4901 9.17638 20.9351L9.17578 18.9293Z" fill="#AFB7C0" />
        <path fillRule="evenodd" clipRule="evenodd" d="M22.055 9.33057C22.6394 9.33057 23.108 9.83277 23.0516 10.4148C22.5068 16.0392 17.7662 20.4354 11.999 20.4354C6.23179 20.4354 1.49179 16.0392 0.946993 10.4148C0.890593 9.83337 1.35919 9.33057 1.94359 9.33057H22.055Z" fill="#D0D5DA" />
      </svg>
    );
  }

  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <path d="M10.6862 17.406H13.3136C13.9004 17.406 14.3762 17.8824 14.3762 18.4686V22.1586H9.62305V18.4686C9.62305 17.8818 10.0994 17.406 10.6856 17.406H10.6862Z" fill="#6B7683" />
      <path d="M21.0693 8.77566L12.6219 2.05866C12.2577 1.76886 11.7417 1.76886 11.3769 2.05866L2.93069 8.77566C2.45369 9.15486 2.17529 9.73146 2.17529 10.3411V19.7593C2.17529 21.0847 3.24989 22.1593 4.57529 22.1593H9.99989V18.4063C9.99989 17.8543 10.4475 17.4061 11.0001 17.4061H12.9999C13.5519 17.4061 14.0001 17.8537 14.0001 18.4063V22.1593H19.4241C20.7495 22.1593 21.8241 21.0847 21.8241 19.7593V10.3411C21.8241 9.73146 21.5469 9.15486 21.0693 8.77566Z" fill="#D0D5DA" />
      <path d="M21.0688 8.77506L12.622 2.05866C12.2578 1.76886 11.7418 1.76886 11.3776 2.05866L2.9302 8.77566C2.4532 9.15486 2.1748 9.73146 2.1748 10.3411V13.3765L11.377 6.05886C11.7412 5.76906 12.2572 5.76906 12.622 6.05886L21.8236 13.3765V10.3411C21.8236 9.73146 21.5452 9.15486 21.0682 8.77506H21.0688Z" fill="#007FF2" />
    </svg>
  );
}

function OutOfOfficeChip({ person }: { person: { name: string; avatarColor: string } }) {
  return (
    <div
      className="h-[19.5px] w-full flex items-center gap-[6px] overflow-hidden px-2 py-[3px] rounded-[4px] text-[9px] leading-[13.5px] font-semibold mb-0.5"
      style={{ backgroundColor: person.avatarColor + "21", color: person.avatarColor }}>
      <SuitcaseGlyph />
      <span className="truncate">{person.name} 외근</span>
    </div>
  );
}

const DAYS_KR = ["일","월","화","수","목","금","토"];
const REPEAT_OPTIONS = ["반복 안 함","매일","매주","격주","매월","매년"];

/* ── Helpers ── */
function fmtTime(h: number, m: number) {
  const period = h < 12 ? "오전" : "오후";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${dh}:${m === 0 ? "00" : m}`;
}
function fmtDateShort(d: Date) {
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS_KR[d.getDay()]})`;
}
function fmtEventRange(date: Date, startHour: number, duration: number) {
  const end = startHour + duration;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS_KR[date.getDay()]}요일) · ${fmtTime(startHour, 0)}~${fmtTime(Math.floor(end), end % 1 === 0.5 ? 30 : 0)}`;
}
function getMiniCalDays(month: Date) {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days: (number|null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

/* ── TimePicker dropdown ── */
function TimePicker({ value, onChange, onClose }: {
  value: { h: number; m: number };
  onChange: (h: number, m: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector('[data-selected]') as HTMLElement | null;
    el?.scrollIntoView({ block: "center" });
  }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const times: { h: number; m: number }[] = [];
  for (let h = 0; h < 24; h++) for (let m of [0, 30]) times.push({ h, m });

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-[#e8eaed] z-[60] w-36 max-h-52 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
      {times.map(t => {
        const sel = t.h === value.h && t.m === value.m;
        return (
          <button key={`${t.h}-${t.m}`} data-selected={sel || undefined}
            onClick={() => { onChange(t.h, t.m); onClose(); }}
            className={`w-full px-4 py-2 text-sm text-left transition-colors
              ${sel ? "bg-[#ECF5FF] text-[#4396FB] font-semibold" : "text-[#202124] hover:bg-[#f1f3f4]"}`}>
            {fmtTime(t.h, t.m)}
          </button>
        );
      })}
    </div>
  );
}

/* ── DatePicker mini-cal ── */
function DatePicker({ value, onChange, onClose }: {
  value: Date; onChange: (d: Date) => void; onClose: () => void;
}) {
  const [month, setMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  const days = getMiniCalDays(month);
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-[#e8eaed] z-[60] p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#202124]">{month.getFullYear()}년 {month.getMonth()+1}월</span>
        <div className="flex gap-0.5">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1))} className="w-6 h-6 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"><ChevronLeft size={13} /></button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1))} className="w-6 h-6 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"><ChevronRight size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_KR.map(d => <div key={d} className="text-center text-[10px] text-[#9aa0a6]">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(month.getFullYear(), month.getMonth(), day);
          const sel = d.getDate() === value.getDate() && d.getMonth() === value.getMonth();
          return (
            <button key={i} onClick={() => { onChange(d); onClose(); }}
              className={`w-7 h-7 mx-auto rounded-full text-[11px] font-medium flex items-center justify-center transition-colors
                ${sel ? "bg-[#4285f4] text-white" : "text-[#202124] hover:bg-[#f1f3f4]"}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── RepeatPicker ── */
function RepeatPicker({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-[#e8eaed] z-[60] w-40 overflow-hidden">
      {REPEAT_OPTIONS.map(opt => (
        <button key={opt} onClick={() => { onChange(opt); onClose(); }}
          className={`w-full px-4 py-2.5 text-sm text-left transition-colors
            ${value === opt ? "bg-[#ECF5FF] text-[#4396FB] font-semibold" : "text-[#202124] hover:bg-[#f1f3f4]"}`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ── EventChip ── */
function EventChip({ title, startHour, duration, color }: { title: string; startHour: number; duration: number; color: string }) {
  const { bg, text } = evPalette(color);
  return (
    <div className="absolute left-1 right-1 top-0.5 rounded-2xl px-2.5 py-2 z-20 overflow-hidden"
      style={{ height: `${duration * 64 - 4}px`, backgroundColor: bg }}>
      <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: text }}>{title}</p>
      {duration >= 1 && (
        <p className="text-[10px] mt-0.5 truncate" style={{ color: text, opacity: 0.8 }}>
          {fmtTime(startHour, 0)} – {fmtTime(startHour + Math.floor(duration), duration % 1 === 0.5 ? 30 : 0)}
        </p>
      )}
    </div>
  );
}

/* ── SchedulePreview ── */
function SchedulePreview({ participants, dayOffset, sampleEvents, selStartH, selStartM, selEndH, selEndM }: {
  participants: { id: number; name: string; initials: string; avatarColor: string }[];
  dayOffset: number; sampleEvents: SampleEvent[]; selStartH: number; selStartM: number; selEndH: number; selEndM: number;
}) {
  const H_START = 8, H_END = 20, RANGE = H_END - H_START;
  function pct(h: number, m = 0) { return Math.max(0, Math.min(100, ((h + m / 60 - H_START) / RANGE) * 100)); }
  const selLeft = pct(selStartH, selStartM);
  const selWidth = Math.max(2, pct(selEndH, selEndM) - selLeft);

  return (
    <div>
      {/* Hour markers */}
      <div className="flex ml-7 mb-1">
        {Array.from({ length: RANGE + 1 }, (_, i) => H_START + i).map(h => (
          <div key={h} className="flex-1 text-[8px] text-[#c5c7c5] -translate-x-1/2">{h}</div>
        ))}
      </div>

      <div className="relative space-y-1.5">
        {/* Selected time highlight band */}
        <div className="absolute inset-y-0 z-20 pointer-events-none rounded"
          style={{
            left: `calc(1.75rem + ${selLeft}%)`,
            width: `${selWidth}%`,
            backgroundColor: "#4396FB12",
            borderLeft: "2px solid #4396FB66",
            borderRight: "2px solid #4396FB66",
          }} />

        {participants.map(p => {
          const evs = dayOffset >= 0
            ? sampleEvents.filter(e => e.dayOffset === dayOffset && COLOR_TO_PID[e.color] === p.id)
            : [];
          return (
            <div key={p.id} className="flex items-center gap-2">
              <ProfileAvatar person={p} size={24} />
              {/* Timeline row */}
              <div className="flex-1 h-6 bg-[#f8f9fa] rounded-md relative overflow-hidden border border-[#e8eaed]">
                {evs.map(ev => (
                  <div key={ev.id} title={ev.title}
                    className="absolute inset-y-[2px] rounded"
                    style={{
                      left: `${pct(ev.startHour)}%`,
                      width: `${Math.max(1.5, (ev.duration / RANGE) * 100)}%`,
                      backgroundColor: p.avatarColor + "40",
                      borderLeft: `2px solid ${p.avatarColor}`,
                    }}>
                    <span className="absolute inset-0 flex items-center px-1 text-[8px] font-semibold truncate"
                      style={{ color: p.avatarColor }}>{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ModalGlyphName = "clock" | "document" | "people" | "video" | "pin" | "note" | "calendar";

function ModalGlyph({ name, className = "" }: { name: ModalGlyphName; className?: string }) {
  const base = `w-6 h-6 shrink-0 block ${className}`;

  if (name === "clock") {
    return (
      <span className={base} aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 21 21" fill="none" className="mx-auto my-0.5">
          <path d="M10.4998 1.80005C5.7028 1.80005 1.7998 5.70305 1.7998 10.5C1.7998 15.297 5.7028 19.2 10.4998 19.2C15.2968 19.2 19.1998 15.297 19.1998 10.5C19.1998 5.70305 15.2968 1.80005 10.4998 1.80005ZM11.3998 10.5C11.3998 10.9974 10.9972 11.4 10.4998 11.4C10.0024 11.4 9.5998 10.9974 9.5998 10.5V4.69685C9.5998 4.19945 10.0024 3.79685 10.4998 3.79685C10.9972 3.79685 11.3998 4.19945 11.3998 4.69685V10.5Z" fill="#E5E8EB" />
          <path d="M10.5 0C4.701 0 0 4.701 0 10.5C0 16.299 4.701 21 10.5 21C16.299 21 21 16.299 21 10.5C21 4.701 16.299 0 10.5 0ZM10.5 19.2C5.703 19.2 1.8 15.297 1.8 10.5C1.8 5.703 5.703 1.8 10.5 1.8C15.297 1.8 19.2 5.703 19.2 10.5C19.2 15.297 15.297 19.2 10.5 19.2Z" fill="#A3ADB7" />
          <path d="M10.5001 3.79675C10.0027 3.79675 9.6001 4.19935 9.6001 4.69675V10.5C9.6001 10.9974 10.0027 11.4 10.5001 11.4C10.9975 11.4 11.4001 10.9974 11.4001 10.5V4.69675C11.4001 4.19935 10.9975 3.79675 10.5001 3.79675Z" fill="#313D4C" />
        </svg>
      </span>
    );
  }
  if (name === "document") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" aria-hidden="true">
        <g clipPath="url(#modal-document-icon)">
          <path fillRule="evenodd" clipRule="evenodd" d="M3.76367 20.835V3.16497C3.76367 2.84997 4.01867 2.59497 4.33367 2.59497H15.4361L20.2367 7.39557V20.835C20.2367 21.15 19.9817 21.405 19.6667 21.405H4.33367C4.01867 21.405 3.76367 21.15 3.76367 20.835Z" fill="#E5E9EE" />
          <path fillRule="evenodd" clipRule="evenodd" d="M16.006 7.39557H20.2366L15.436 2.59497V6.82557C15.436 7.14057 15.691 7.39557 16.006 7.39557Z" fill="#C0C7D1" />
          <path d="M20.2362 17.7372H3.76318V18.3066H20.2362V17.7372Z" fill="#D0D5DA" />
          <path d="M20.2362 15.0438H3.76318V15.6132H20.2362V15.0438Z" fill="#D0D5DA" />
          <path d="M20.2362 12.3503H3.76318V12.9197H20.2362V12.3503Z" fill="#D0D5DA" />
          <path d="M20.2362 9.65759H3.76318V10.227H20.2362V9.65759Z" fill="#D0D5DA" />
        </g>
        <defs>
          <clipPath id="modal-document-icon">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" aria-hidden="true">
        <g clipPath="url(#modal-people-icon)">
          <path d="M7.87923 11.6479C9.944 11.6479 11.6178 9.97403 11.6178 7.90925C11.6178 5.84448 9.944 4.17065 7.87923 4.17065C5.81445 4.17065 4.14062 5.84448 4.14062 7.90925C4.14062 9.97403 5.81445 11.6479 7.87923 11.6479Z" fill="#8BBDFF" />
          <path d="M7.8791 12.7915C2.8547 12.7915 0.899902 16.2175 0.899902 17.8111C0.899902 19.4047 5.0603 19.8289 7.8791 19.8289C10.6979 19.8289 14.8583 19.4047 14.8583 17.8111C14.8583 16.2175 12.9041 12.7915 7.8791 12.7915Z" fill="#8BBDFF" />
          <path d="M16.1209 11.6479C18.1857 11.6479 19.8595 9.97403 19.8595 7.90925C19.8595 5.84448 18.1857 4.17065 16.1209 4.17065C14.0562 4.17065 12.3823 5.84448 12.3823 7.90925C12.3823 9.97403 14.0562 11.6479 16.1209 11.6479Z" fill="#3180F3" />
          <path d="M16.1208 12.7915C11.0964 12.7915 9.1416 16.2175 9.1416 17.8111C9.1416 19.4047 13.302 19.8289 16.1208 19.8289C18.9396 19.8289 23.1 19.4047 23.1 17.8111C23.1 16.2175 21.1458 12.7915 16.1208 12.7915Z" fill="#3180F3" />
        </g>
        <defs>
          <clipPath id="modal-people-icon">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  }
  if (name === "video") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" aria-hidden="true">
        <g clipPath="url(#modal-video-icon)">
          <path d="M17.718 5.61719H5.74863C4.77303 5.61719 3.93723 6.20159 3.56223 7.03739C3.42783 7.33739 3.34863 7.66739 3.34863 8.01719V18.7194C3.34863 20.0448 4.42323 21.1194 5.74863 21.1194H17.7174C19.0428 21.1194 20.1174 20.0448 20.1174 18.7194V8.01719C20.1174 7.94219 20.1018 7.87199 20.0952 7.79879C19.983 6.57719 18.9678 5.61719 17.7174 5.61719H17.718ZM15.3468 15.819L13.8222 17.3436C13.2738 17.892 12.3852 17.892 11.8368 17.3436L6.42603 11.9328C5.87763 11.3844 5.87763 10.4958 6.42603 9.94739L7.95063 8.42279C8.49903 7.87439 9.38763 7.87439 9.93603 8.42279L15.3468 13.8336C15.8952 14.382 15.8952 15.2706 15.3468 15.819ZM17.556 8.60219C17.112 8.60219 16.7526 8.24219 16.7526 7.79879C16.7526 7.35539 17.1126 6.99539 17.556 6.99539C17.9994 6.99539 18.3594 7.35539 18.3594 7.79879C18.3594 8.24219 17.9994 8.60219 17.556 8.60219Z" fill="#4E5968" />
          <path d="M3.56248 7.03738L1.75888 6.43798C1.39588 6.31738 1.02148 6.58738 1.02148 6.96958V12.2466C1.02148 12.6288 1.39588 12.8994 1.75888 12.7782L3.34948 12.2496V8.01658C3.34948 7.66678 3.42808 7.33618 3.56308 7.03678L3.56248 7.03738Z" fill="#2E3D51" />
          <path d="M23.0523 3.612V7.626C23.0523 8.03401 22.7283 8.35801 22.3203 8.35801H22.0683C21.7263 8.35801 21.4503 8.118 21.3723 7.8H20.0943C19.9863 6.576 18.9663 5.616 17.7183 5.616H14.0703L14.9223 4.158C15.1863 3.708 15.6603 3.438 16.1823 3.438H21.3723C21.4563 3.12 21.7263 2.88 22.0683 2.88H22.3203C22.7283 2.88 23.0523 3.21 23.0523 3.612Z" fill="#2E3D51" />
          <path d="M7.95071 8.42286L6.42635 9.94727C5.87807 10.4956 5.87808 11.3845 6.42639 11.9328L11.8367 17.3429C12.385 17.8912 13.274 17.8912 13.8223 17.3429L15.3466 15.8185C15.8949 15.2702 15.8949 14.3812 15.3466 13.8329L9.93626 8.42283C9.38796 7.87454 8.499 7.87456 7.95071 8.42286Z" fill="#2E3D51" />
          <path d="M17.5554 6.99475C17.1114 6.99475 16.752 7.35475 16.752 7.79815C16.752 8.24155 17.112 8.60155 17.5554 8.60155C17.9988 8.60155 18.3588 8.24155 18.3588 7.79815C18.3588 7.35475 17.9988 6.99475 17.5554 6.99475Z" fill="#FFCD00" />
        </g>
        <defs>
          <clipPath id="modal-video-icon">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" aria-hidden="true">
        <g clipPath="url(#modal-pin-icon)">
          <path d="M8.69961 21.273L2.54001 19.5066C2.28021 19.4322 2.09961 19.1796 2.09961 18.891V5.31C2.09961 4.8912 2.46921 4.5864 2.84601 4.6944L8.69961 6.3732V21.273Z" fill="#D0D5DC" />
          <path d="M8.69922 21.273L15.2992 19.3806V4.48022L8.69922 6.37322V21.273Z" fill="#E1E4E7" />
          <path d="M21.1534 21.0588L15.2998 19.38V4.48022L21.4594 6.24662C21.7192 6.32102 21.8998 6.57362 21.8998 6.86222V20.4432C21.8998 20.862 21.5302 21.1668 21.1534 21.0588Z" fill="#D0D5DC" />
          <path d="M15.7313 11.6832C16.2923 11.0904 17.3075 10.0248 18.2075 9.12058C19.9223 7.39678 20.0393 4.45498 18.3035 2.75278C17.4695 1.93498 16.3847 1.52638 15.2993 1.52698C14.2145 1.52698 13.1297 1.93498 12.2957 2.75278C10.5587 4.45558 10.6763 7.39738 12.3917 9.12118C13.2917 10.0254 14.3087 11.091 14.8697 11.6838C15.1037 11.931 15.4967 11.9304 15.7307 11.6838L15.7313 11.6832Z" fill="#4582ED" />
          <path d="M15.3002 7.09081C16.0037 7.09081 16.574 6.52051 16.574 5.81701C16.574 5.11351 16.0037 4.54321 15.3002 4.54321C14.5967 4.54321 14.0264 5.11351 14.0264 5.81701C14.0264 6.52051 14.5967 7.09081 15.3002 7.09081Z" fill="#FBFBFB" />
        </g>
        <defs>
          <clipPath id="modal-pin-icon">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  }
  if (name === "note") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" aria-hidden="true">
        <g clipPath="url(#modal-note-icon)">
          <path fillRule="evenodd" clipRule="evenodd" d="M17.8996 20.7996V3.20037C17.8996 2.53737 17.3626 2.00037 16.6996 2.00037H6.89979L0.900391 8.00037V20.7996C0.900391 21.4626 1.43739 21.9996 2.10039 21.9996H16.6996C17.3626 21.9996 17.8996 21.4626 17.8996 20.7996Z" fill="#E5E9EE" />
          <path fillRule="evenodd" clipRule="evenodd" d="M5.70039 8.00037H0.900391L6.89979 2.00037V6.80037C6.89979 7.46337 6.36279 8.00037 5.69979 8.00037H5.70039Z" fill="#C0C7D1" />
          <path d="M18.2754 8.90307L9.77441 17.4041L12.9988 20.6285L21.4998 12.1275L18.2754 8.90307Z" fill="#FFAA00" />
          <path fillRule="evenodd" clipRule="evenodd" d="M22.8306 10.7964L21.4998 12.1272L18.2754 8.90281L19.6056 7.57261C19.9656 7.21261 20.5488 7.21261 20.9088 7.57261L22.83 9.49381C23.19 9.85381 23.19 10.437 22.83 10.797L22.8306 10.7964Z" fill="#FF9000" />
          <path fillRule="evenodd" clipRule="evenodd" d="M9.02826 21.6924L10.6039 21.27L9.13266 19.7982L8.71026 21.3744C8.65866 21.5676 8.83506 21.744 9.02826 21.6924Z" fill="#313D4C" />
          <path fillRule="evenodd" clipRule="evenodd" d="M9.13281 19.7982L10.6046 21.27L12.9992 20.628L9.77481 17.4042L9.13281 19.7982Z" fill="#FFCCA8" />
        </g>
        <defs>
          <clipPath id="modal-note-icon">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" aria-hidden="true">
      <g clipPath="url(#modal-calendar-icon)">
        <path d="M19.855 2.87939H4.14579C3.18183 2.87939 2.40039 3.66084 2.40039 4.62479V19.752C2.40039 20.716 3.18183 21.4974 4.14579 21.4974H19.855C20.8189 21.4974 21.6004 20.716 21.6004 19.752V4.62479C21.6004 3.66084 20.8189 2.87939 19.855 2.87939Z" fill="#E5E9EE" />
        <path d="M4.14579 2.87939H19.855C20.8186 2.87939 21.6004 3.66179 21.6004 4.62479V7.43639H2.40039V4.62479C2.40039 3.66119 3.18279 2.87939 4.14579 2.87939Z" fill="#FDAEB3" />
        <path d="M6.18228 4.33385C5.78088 4.33385 5.45508 4.00865 5.45508 3.60665V2.15225C5.45508 1.75025 5.78028 1.42505 6.18228 1.42505C6.58428 1.42505 6.90948 1.75025 6.90948 2.15225V3.60665C6.90948 4.00865 6.58428 4.33385 6.18228 4.33385Z" fill="#4B596A" />
        <path d="M17.819 4.33385C17.4176 4.33385 17.0918 4.00865 17.0918 3.60665V2.15225C17.0918 1.75025 17.417 1.42505 17.819 1.42505C18.221 1.42505 18.5462 1.75025 18.5462 2.15225V3.60665C18.5462 4.00865 18.221 4.33385 17.819 4.33385Z" fill="#4B596A" />
        <path d="M6.59961 11.6717C6.59961 11.3999 6.73941 11.1467 6.97041 11.0027L8.77581 9.87354C8.96001 9.75834 9.17301 9.69714 9.39021 9.69714C10.0298 9.69714 10.5488 10.2155 10.5488 10.8557V17.5481C10.5488 18.0755 10.121 18.5033 9.59361 18.5033C9.06621 18.5033 8.63841 18.0755 8.63841 17.5481V11.8289L7.80441 12.3437C7.27881 12.6683 6.60081 12.2903 6.60081 11.6723L6.59961 11.6717Z" fill="#EF4452" />
        <path d="M11.541 10.5882C11.541 10.1604 11.8878 9.8136 12.3156 9.8136H16.7034C17.088 9.8136 17.4 10.1256 17.4 10.5102C17.4 10.9578 17.3082 11.4 17.1294 11.8104L14.475 17.9172C14.3202 18.273 13.9692 18.5034 13.581 18.5034C12.8742 18.5034 12.4026 17.7756 12.6906 17.1306L15.2688 11.3634H12.3162C11.8884 11.3634 11.5416 11.0166 11.5416 10.5888L11.541 10.5882Z" fill="#EF4452" />
      </g>
      <defs>
        <clipPath id="modal-calendar-icon">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

/* ── Avatar + PersonRow ── */
function ProfileAvatar({ person, size = 36 }: {
  person: { id: number; name: string; initials: string; avatarColor: string; avatarTemplate?: number };
  size?: number;
}) {
  const templateId = person.avatarTemplate ?? person.id;
  const crop = AVATAR_CROPS[templateId];
  if (!crop) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
        style={{ width: size, height: size, backgroundColor: person.avatarColor, fontSize: Math.max(9, size * 0.28) }}>
        {person.initials}
      </div>
    );
  }
  const ratio = size / 36;
  const avatarBg = templateId === 5 && person.avatarColor === PEOPLE[4].avatarColor ? crop.bg : person.avatarColor + "30";
  return (
    <div
      className="relative rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, backgroundColor: avatarBg }}>
      <img
        src={crop.src}
        alt=""
        className="absolute block max-w-none select-none"
        draggable={false}
        style={{
          left: crop.left * ratio,
          top: crop.top * ratio,
          width: crop.width * ratio,
          height: crop.height * ratio,
        }}
      />
    </div>
  );
}

function PersonRow({ person, role }: {
  person: { id: number; name: string; initials: string; avatarColor: string };
  role: string;
}) {
  return (
    <div
      className="h-12 flex items-center gap-3 px-1 py-1.5 rounded-[10px] hover:bg-[#f1f3f4] transition-colors"
      style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      <ProfileAvatar person={person} />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className="text-[14px] leading-5 font-medium text-[#202124] truncate">{person.name}</p>
        <span className="text-[10px] leading-[15px] font-semibold px-[6px] py-[2px] rounded-[4px] bg-[#f1f3f4] text-[#5f6368] shrink-0">{role}</span>
      </div>
    </div>
  );
}

function AttendanceAvatar({ person, status, size = 36 }: {
  person: { id: number; name: string; initials: string; avatarColor: string };
  status: AttendanceStatus;
  size?: number;
}) {
  const statusStyle = {
    accepted: { bg: "#34A853", label: "수락", mark: <Check size={9} strokeWidth={3.2} /> },
    pending: { bg: "#F9AB00", label: "대기", mark: <span className="block w-1.5 h-1.5 rounded-full bg-white" /> },
    declined: { bg: "#EA4335", label: "거절", mark: <X size={9} strokeWidth={3.2} /> },
  }[status];

  return (
    <div className="relative shrink-0" title={status === "pending" ? person.name : `${person.name} · ${statusStyle.label}`}>
      <ProfileAvatar person={person} size={size} />
      {status !== "pending" && (
        <span
          className="absolute left-[22px] top-[22px] w-4 h-4 rounded-full border border-white flex items-center justify-center p-px text-white"
          style={{ backgroundColor: statusStyle.bg }}>
          {statusStyle.mark}
        </span>
      )}
    </div>
  );
}

/* ── Main ── */
export default function App() {
  const today = new Date(2026, 6, 6);     // Mon Jul 6 = today
  const initialWeekStart = new Date(2026, 6, 5); // week starts Sun Jul 5
  const calendarScrollRef = useRef<HTMLDivElement>(null);

  /* ── Calendar state ── */
  const [currentView, setCurrentView] = useState<ViewMode>("주");
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [eventOverrides, setEventOverrides] = useState<Record<string, EventOverride>>({});
  const [draggingEvent, setDraggingEvent] = useState<DragEventRef | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEventDetail | null>(null);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date(2026, 6, 1));
  const [addCalOpen, setAddCalOpen] = useState(false);
  const [addCalInput, setAddCalInput] = useState("");
  const addCalendarLockRef = useRef<string | null>(null);
  const [visiblePersonIds, setVisiblePersonIds] = useState<number[]>([ORGANIZER.id, ...PEOPLE.map(p => p.id)]);
  const [teamColorMenuId, setTeamColorMenuId] = useState<number | null>(null);

  // My calendar settings
  const [showMyMenu, setShowMyMenu] = useState(false);
  const [showMyPrefs, setShowMyPrefs] = useState(false);
  const [myPrefsTab, setMyPrefsTab] = useState<"meeting" | "ooo">("ooo");
  const [myPrefs, setMyPrefs] = useState({
    avoidLunch: false,    // 점심 직후 (13:00–14:00)
    avoidMorning: false,  // 오전 9시 이전
    avoidEvening: false,  // 오후 6시 이후
    oooDays: [] as number[], // 1=Mon … 5=Fri
  });

  /* ── Popup state ── */
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [activeTab, setActiveTab] = useState("일정");
  const [popupDate, setPopupDate] = useState<Date>(today);
  const [startH, setStartH] = useState(10);
  const [startM, setStartM] = useState(0);
  const [endH, setEndH] = useState(11);
  const [endM, setEndM] = useState(0);
  const [isAllDay, setIsAllDay] = useState(false);
  const [repeatVal, setRepeatVal] = useState("반복 안 함");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [locationMode, setLocationMode] = useState<"none" | "room" | "location">("none");
  const [locationVal, setLocationVal] = useState("");
  const [descriptionVal, setDescriptionVal] = useState("");

  /* ── Project / Meeting type (extendable) ── */
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>(DEFAULT_MEETING_TYPES);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [meetingTypeId, setMeetingTypeId] = useState<string | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addProjectInput, setAddProjectInput] = useState("");
  const [newProjectMembers, setNewProjectMembers] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [allPeople, setAllPeople] = useState(PEOPLE);
  const nextPersonIdRef = useRef(Math.max(...PEOPLE.map(person => person.id)) + 1);
  const personNameRegistryRef = useRef(new Set([ORGANIZER.name, ...PEOPLE.map(person => person.name)]));
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [addTypeInput, setAddTypeInput] = useState("");
  const [newTypeRequiredRoles, setNewTypeRequiredRoles] = useState<string[]>([]);
  const [newTypeOptionalRoles, setNewTypeOptionalRoles] = useState<string[]>([]);

  const PROJECT_COLORS = ["#4396FB","#3182F6","#00C3B2","#8B5CF6","#ea4335","#fbbc04","#34a853","#FF6B6B"];

  function parsePersonInput(raw: string, fallbackIndex: number) {
    const normalized = raw.trim().replace(/[,/]+/g, " ").replace(/\s+/g, " ");
    if (!normalized) return null;
    const parts = normalized.split(" ");
    const upperRoles = ROLE_OPTIONS.map(role => role.toUpperCase());
    const roleCandidate = parts[parts.length - 1]?.toUpperCase();
    const roleIndex = upperRoles.indexOf(roleCandidate);
    const hasExplicitRole = roleIndex >= 0 && parts.length > 1;
    const fallbackRoles = ["PO", "FE", "BE", "QA", "UXR"];
    return {
      normalized,
      name: hasExplicitRole ? parts.slice(0, -1).join(" ") : normalized,
      role: hasExplicitRole ? ROLE_OPTIONS[roleIndex] : fallbackRoles[fallbackIndex % fallbackRoles.length],
    };
  }

  function createTeamPerson(name: string, role: string, index: number): Person {
    const nextId = nextPersonIdRef.current++;
    return {
      id: nextId,
      name,
      role,
      initials: name.slice(0, 1),
      avatarColor: TEAM_COLOR_OPTIONS[(allPeople.length + index + 5) % TEAM_COLOR_OPTIONS.length],
      pref: null,
      prefType: null,
      avatarTemplate: ([1, 2, 3, 4, 5] as const)[(allPeople.length + index) % 5],
    };
  }

  function defaultEventsForPerson(person: Person): SavedEvent[] {
    const presets: Record<string, { title: string; day: number; hour: number; duration: number }> = {
      PO: { title: "제품 방향성 싱크", day: 8, hour: 10, duration: 1 },
      FE: { title: "프론트엔드 구현 리뷰", day: 8, hour: 14, duration: 1 },
      BE: { title: "API 설계 점검", day: 9, hour: 15, duration: 1 },
      QA: { title: "QA 체크리스트 리뷰", day: 10, hour: 14, duration: 1 },
      UXR: { title: "리서치 인사이트 공유", day: 9, hour: 11, duration: 1 },
    };
    const preset = presets[person.role] ?? { title: `${person.role} 업무 싱크`, day: 8, hour: 15, duration: 1 };
    return [{
      id: `team-${person.id}-seed`,
      meetingId: `team-${person.id}-seed`,
      title: preset.title,
      date: new Date(2026, 6, preset.day),
      hour: preset.hour,
      duration: preset.duration,
      color: person.avatarColor,
      personId: person.id,
      description: `${person.name} ${person.role} 일정입니다.`,
    }];
  }

  function addProject() {
    if (!addProjectInput.trim()) return;
    const c = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    setProjects(prev => [...prev, {
      id: Date.now().toString(),
      name: addProjectInput.trim(),
      phase: "진행중",
      color: c,
      bg: c + "22",
      members: newProjectMembers,
      custom: true,
    }]);
    setAddProjectInput(""); setNewProjectMembers([]); setMemberSearch(""); setAddProjectOpen(false);
  }

  function deleteProject(id: string) {
    setProjects(prev => prev.filter(project => project.id !== id));
    if (projectId === id) {
      setProjectId(null);
      setMeetingTypeId(null);
    }
  }

  function addNewPersonAndSelect(name: string) {
    const parsed = parsePersonInput(name, allPeople.length);
    if (!parsed?.name) return;
    const existing = allPeople.find(person => person.name === parsed.name);
    if (existing) {
      setNewProjectMembers(prev => prev.includes(existing.id) ? prev : [...prev, existing.id]);
      setMemberSearch("");
      return;
    }
    if (ORGANIZER.name === parsed.name) {
      setMemberSearch("");
      return;
    }
    if (personNameRegistryRef.current.has(parsed.name)) {
      setMemberSearch("");
      return;
    }
    const newPerson = createTeamPerson(parsed.name, parsed.role, 0);
    personNameRegistryRef.current.add(newPerson.name);
    setAllPeople(prev => [...prev, newPerson]);
    setNewProjectMembers(prev => prev.includes(newPerson.id) ? prev : [...prev, newPerson.id]);
    setVisiblePersonIds(prev => prev.includes(newPerson.id) ? prev : [...prev, newPerson.id]);
    setSavedEvents(prev => prev.some(event => event.personId === newPerson.id) ? prev : [...prev, ...defaultEventsForPerson(newPerson)]);
    setMemberSearch("");
  }

  function addMeetingType() {
    if (!addTypeInput.trim()) return;
    setMeetingTypes(prev => [...prev, {
      id: Date.now().toString(),
      label: addTypeInput.trim(),
      requiredRoles: newTypeRequiredRoles.length > 0 ? newTypeRequiredRoles : null,
      optionalRoles: newTypeOptionalRoles.length > 0 ? newTypeOptionalRoles : null,
      custom: true,
    }]);
    setAddTypeInput(""); setNewTypeRequiredRoles([]); setNewTypeOptionalRoles([]); setAddTypeOpen(false);
  }

  function deleteMeetingType(id: string) {
    setMeetingTypes(prev => prev.filter(type => type.id !== id));
    if (meetingTypeId === id) setMeetingTypeId(null);
  }

  function setNewTypeRole(role: string, mode: "required" | "optional" | "none") {
    setNewTypeRequiredRoles(prev => mode === "required" ? [...prev.filter(r => r !== role), role] : prev.filter(r => r !== role));
    setNewTypeOptionalRoles(prev => mode === "optional" ? [...prev.filter(r => r !== role), role] : prev.filter(r => r !== role));
  }

  function closeAddMeetingType() {
    setAddTypeInput("");
    setNewTypeRequiredRoles([]);
    setNewTypeOptionalRoles([]);
    setAddTypeOpen(false);
  }

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; }), [weekStart]);
  const headerMonthLabel = `${weekStart.getFullYear()}년 ${weekStart.getMonth() + 1}월`;
  function moveWeek(delta: number) {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      setMiniCalMonth(new Date(next.getFullYear(), next.getMonth(), 1));
      return next;
    });
  }
  function goToday() {
    setWeekStart(initialWeekStart);
    setMiniCalMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }
  const weekOffset = Math.round((weekStart.getTime() - initialWeekStart.getTime()) / (7 * 86400000));
  const sampleEventsForWeek = useMemo<SampleEvent[]>(() => {
    if (weekOffset === 0) return SAMPLE_EVENTS;
    const nextTitles = [
      "분기 로드맵 싱크", "디자인 QA 리뷰", "유저 피드백 정리", "FE 구현 점검", "API 안정화 회의", "릴리즈 리허설",
      "리서치 가설 검토", "결제 플로우 점검", "온보딩 개선 리뷰", "데이터 지표 공유", "버그 우선순위 회의", "회고 준비",
    ];
    const prevTitles = [
      "킥오프 사전 미팅", "요구사항 정리", "와이어프레임 리뷰", "QA 시나리오 설계", "서버 구조 논의", "실험 결과 공유",
      "정책 검토 회의", "사용성 인터뷰", "컴포넌트 정리", "스프린트 회고", "배포 체크", "운영 이슈 싱크",
    ];
    const titles = weekOffset > 0 ? nextTitles : prevTitles;
    const weekdays = [1, 2, 3, 4, 5];
    const offsetAbs = Math.abs(weekOffset);
    return SAMPLE_EVENTS.map((event, index) => {
      const hourDelta = ((index + offsetAbs) % 3) - 1;
      const dayIndex = weekdays.indexOf(event.dayOffset);
      const shiftedDay = weekdays[((dayIndex < 0 ? index : dayIndex) + offsetAbs + index) % weekdays.length];
      return {
        ...event,
        id: `${event.id}-w${weekOffset}`,
        title: titles[index % titles.length],
        dayOffset: shiftedDay,
        startHour: Math.max(9, Math.min(16, event.startHour + hourDelta)),
        duration: index % 5 === 0 ? Math.min(2, event.duration + 0.5) : event.duration,
      };
    });
  }, [weekOffset]);
  const hours = Array.from({ length: 23 }, (_, i) => i + 1);
  const miniDays = getMiniCalDays(miniCalMonth);

  useEffect(() => {
    const target = calendarScrollRef.current;
    if (!target || currentView === "월") return;
    const hourHeight = currentView === "일" ? 80 : 64;
    target.scrollTop = (9 - 1) * hourHeight;
  }, [currentView]);

  const selectedProject = projects.find(p => p.id === projectId) ?? null;
  const selectedMeetingType = meetingTypes.find(t => t.id === meetingTypeId) ?? null;

  const { requiredPeople, optionalPeople } = useMemo(() => {
    if (!projectId || !selectedProject) return { requiredPeople: [], optionalPeople: [] };
    const members = allPeople.filter(p => selectedProject.members.includes(p.id));
    if (!selectedMeetingType?.requiredRoles && !selectedMeetingType?.optionalRoles) return { requiredPeople: members, optionalPeople: [] };
    const requiredRoles = selectedMeetingType.requiredRoles ?? [];
    const optionalRoles = selectedMeetingType.optionalRoles ?? [];
    return {
      requiredPeople: members.filter(p => requiredRoles.includes(p.role)),
      optionalPeople: optionalRoles.length > 0
        ? members.filter(p => optionalRoles.includes(p.role) && !requiredRoles.includes(p.role))
        : members.filter(p => !requiredRoles.includes(p.role)),
    };
  }, [projectId, selectedProject, selectedMeetingType, allPeople]);

  function openPopup(date: Date, hour: number) {
    setPopupDate(date); setStartH(hour); setStartM(0); setEndH(hour + 1); setEndM(0);
    setPopupTitle(""); setProjectId(null); setMeetingTypeId(null); setLocationVal(""); setDescriptionVal("");
    setLocationMode("none");
    setIsAllDay(false); setRepeatVal("반복 안 함"); setActiveTab("일정");
    setShowDatePicker(false); setShowStartPicker(false); setShowEndPicker(false); setShowRepeatPicker(false);
    setAddProjectOpen(false); setAddProjectInput(""); setNewProjectMembers([]); setMemberSearch("");
    setAddTypeOpen(false); setAddTypeInput(""); setNewTypeRequiredRoles([]); setNewTypeOptionalRoles([]);
    setPopupOpen(true);
  }

  function handleSave() {
    const meetingId = Date.now().toString();
    const isUrgent = meetingTypeId === "urgent";
    const title = popupTitle.trim() || (isUrgent ? "긴급 회의" : "새 회의");
    const duration = Math.max(0.5, (endH + endM / 60) - (startH + startM / 60));

    // Build participant list: organizer + project members (required + optional)
    const participants: { id: number; color: string }[] = [
      { id: ORGANIZER.id, color: ORGANIZER.avatarColor },
      ...requiredPeople.map(p => ({ id: p.id, color: p.avatarColor })),
      ...optionalPeople.map(p => ({ id: p.id, color: p.avatarColor })),
    ];

    // Deduplicate by id
    const seen = new Set<number>();
    const unique = participants.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

    setSavedEvents(prev => [
      ...prev,
      ...unique.map(p => ({
        id: `${meetingId}-${p.id}`,
        meetingId,
        title,
        date: popupDate,
        hour: startH,
        duration,
        color: p.color,
        personId: p.id,
        urgent: isUrgent,
        pendingInvite: p.id !== ORGANIZER.id,
        location: locationVal,
        description: descriptionVal,
      })),
    ]);
    setPopupOpen(false);
  }

  // Close my menu on outside click
  useEffect(() => {
    if (!showMyMenu) return;
    const handler = () => setShowMyMenu(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMyMenu]);

  function isToday(d: Date) { return d.getDate() === today.getDate() && d.getMonth() === today.getMonth(); }
  function isPersonVisible(id: number) { return visiblePersonIds.includes(id); }
  function togglePersonVisibility(id: number) {
    setVisiblePersonIds(prev => prev.includes(id) ? prev.filter(personId => personId !== id) : [...prev, id]);
  }
  function isEventVisible(ev: { color: string; personId?: number }) {
    const personId = ev.personId ?? COLOR_TO_PID[ev.color];
    return personId === undefined || isPersonVisible(personId);
  }

  function isOwnEvent(ev: { color: string; personId?: number; pendingInvite?: boolean }) {
    const personId = ev.personId ?? COLOR_TO_PID[ev.color];
    return personId === ORGANIZER.id && !ev.pendingInvite;
  }

  function personById(id: number) {
    return id === ORGANIZER.id ? ORGANIZER : allPeople.find(p => p.id === id) ?? ORGANIZER;
  }

  function removeTeamMember(id: number) {
    const person = allPeople.find(item => item.id === id);
    if (person) personNameRegistryRef.current.delete(person.name);
    setTeamColorMenuId(current => current === id ? null : current);
    setAllPeople(prev => prev.filter(person => person.id !== id));
    setVisiblePersonIds(prev => prev.filter(personId => personId !== id));
    setProjects(prev => prev.map(project => ({
      ...project,
      members: project.members.filter(memberId => memberId !== id),
    })));
    setNewProjectMembers(prev => prev.filter(personId => personId !== id));
  }

  function updateTeamColor(id: number, color: string) {
    setAllPeople(prev => prev.map(person => person.id === id ? { ...person, avatarColor: color } : person));
    setSavedEvents(prev => prev.map(ev => ev.personId === id ? { ...ev, color } : ev));
    setTeamColorMenuId(null);
  }

  function openEventDetail(ev: CalendarEventDetail) {
    setPopupOpen(false);
    setDetailEvent(ev);
  }

  function eventOwner(ev: CalendarEventDetail) {
    return personById(ev.personId);
  }

  function defaultMeetingRoom(ev: CalendarEventDetail) {
    const owner = eventOwner(ev);
    if (ev.title.includes("워크숍") || ev.title.includes("발표")) return "회의실 A · 6층";
    if (ev.title.includes("보고") || ev.title.includes("공유")) return "회의실 B · 8층";
    if (ev.title.includes("리뷰") || ev.title.includes("점검")) return "회의실 C · 7층";
    if (ev.title.includes("싱크") || ev.title.includes("플래닝")) return "스프린트룸 · 5층";
    if (owner.role === "BE") return "개발 회의실 · 7층";
    if (owner.role === "QA") return "QA 랩 · 6층";
    if (owner.role === "UXR") return "리서치룸 · 8층";
    return "회의실 B · 8층";
  }

  function eventDetailMeta(ev: CalendarEventDetail) {
    const owner = eventOwner(ev);
    const location = ev.location?.trim() || defaultMeetingRoom(ev);
    const description = ev.description?.trim()
      || `${ev.title} 관련 회의입니다. 참석자 상태와 세부 정보를 확인할 수 있습니다.`;
    return { owner, location, description };
  }

  function sampleAttendeeIds(ev: CalendarEventDetail) {
    const title = ev.title;
    const withOwner = (ids: number[]) => {
      const filtered = ev.personId === ORGANIZER.id ? ids : ids.filter(id => id !== ORGANIZER.id);
      return [ev.personId, ...filtered].filter((id, idx, arr) => arr.indexOf(id) === idx);
    };

    if (title.includes("릴리즈") || title.includes("배포") || title.includes("QA")) return withOwner([1, 2, 4, 5]);
    if (title.includes("API") || title.includes("DB") || title.includes("BE") || title.includes("서버")) return withOwner([1, 4, 5]);
    if (title.includes("UX") || title.includes("리서치") || title.includes("인터뷰") || title.includes("사용성")) return withOwner([1, 3]);
    if (title.includes("디자인") || title.includes("프로토타입")) return withOwner([1, 2, 3]);
    if (title.includes("스프린트") || title.includes("싱크") || title.includes("위클리")) return withOwner([1, 2, 4, 5]);
    return withOwner([1, 2]);
  }

  function detailAttendees(ev: CalendarEventDetail): { person: ReturnType<typeof personById>; status: AttendanceStatus }[] {
    if (ev.source === "saved" && ev.meetingId) {
      const group = savedEvents.filter(item => item.meetingId === ev.meetingId);
      if (group.length > 0) {
        return group.map((item, idx) => ({
          person: personById(item.personId),
          status: item.personId === ORGANIZER.id ? "accepted" : item.pendingInvite ? "pending" : "accepted",
        }));
      }
    }
    return sampleAttendeeIds(ev).map((id) => ({
      person: personById(id),
      status: "accepted",
    }));
  }

  function moveDraggedEvent(dayIdx: number, hour: number) {
    if (!draggingEvent) return;
    const nextHour = Math.max(1, Math.min(23, hour));

    if (draggingEvent.source === "sample") {
      setEventOverrides(prev => ({ ...prev, [draggingEvent.id]: { dayOffset: dayIdx, startHour: nextHour } }));
    } else {
      const nextDate = new Date(weekDays[dayIdx]);
      setSavedEvents(prev => prev.map(ev =>
        ev.meetingId === draggingEvent.meetingId ? { ...ev, date: nextDate, hour: nextHour } : ev
      ));
    }
    setDraggingEvent(null);
  }

  // Returns 0–6 if popupDate is within the displayed week (Mon Jul6 – Sun Jul12), else -1
  function getDayOffset(date: Date): number {
    const diff = Math.round((date.getTime() - weekStart.getTime()) / 86400000);
    return diff >= 0 && diff < 7 ? diff : -1;
  }

  function eventsForDay(dayIdx: number): CalendarEventDetail[] {
    const wd = weekDays[dayIdx];
    const sample = sampleEventsForWeek
      .map(e => {
        const override = eventOverrides[e.id];
        const startHour = override?.startHour ?? e.startHour;
        const effectiveDayOffset = override?.dayOffset ?? e.dayOffset;
        const personId = COLOR_TO_PID[e.color];
        return { ...e, date: new Date(weekDays[effectiveDayOffset]), startHour, dayOffset: effectiveDayOffset, source: "sample" as const, personId, color: personById(personId).avatarColor };
      })
      .filter(e => e.dayOffset === dayIdx && isEventVisible(e));
    const saved = savedEvents
      .filter(e => e.date.getDate() === wd?.getDate() && e.date.getMonth() === wd?.getMonth() && isEventVisible(e))
      .map(e => ({ id: e.id, meetingId: e.meetingId, title: e.title, date: e.date, dayOffset: dayIdx, startHour: e.hour, duration: e.duration, color: e.color, personId: e.personId, urgent: e.urgent, pendingInvite: e.pendingInvite, location: e.location, description: e.description, source: "saved" as const }));
    return [...sample, ...saved];
  }

  function cellEvents(dayIdx: number, hour: number): CalendarEventDetail[] {
    return eventsForDay(dayIdx).filter(e => Math.floor(e.startHour) === hour);
  }

  function preferenceBlocksForDay(dayIdx: number) {
    const wd = weekDays[dayIdx];
    if (!wd || wd.getDay() === 0 || wd.getDay() === 6) return [];

    const uniquePeople = (people: { id: number; name: string; avatarColor: string }[]) => {
      const seen = new Set<number>();
      return people.filter(person => {
        if (seen.has(person.id)) return false;
        seen.add(person.id);
        return true;
      });
    };

    return [
      {
        startHour: 1,
        duration: 8,
        people: uniquePeople(myPrefs.avoidMorning && isPersonVisible(ORGANIZER.id) ? [ORGANIZER] : []),
      },
      {
        startHour: 13,
        duration: 1,
        people: uniquePeople([
          ...LUNCH_AVOID_PEOPLE.filter(p => isPersonVisible(p.id)),
          ...(myPrefs.avoidLunch && isPersonVisible(ORGANIZER.id) ? [ORGANIZER] : []),
        ]),
      },
      {
        startHour: 18,
        duration: 6,
        people: uniquePeople(myPrefs.avoidEvening && isPersonVisible(ORGANIZER.id) ? [ORGANIZER] : []),
      },
    ].filter(block => block.people.length > 0);
  }

  function layoutEventsForDay(dayIdx: number): (CalendarEventDetail & { column: number; columns: number })[] {
    const events = eventsForDay(dayIdx).sort((a, b) => a.startHour - b.startHour || b.duration - a.duration);
    const preferenceBlocks = preferenceBlocksForDay(dayIdx);
    const columnEnds: number[] = [];
    const laid = events.map(ev => {
      const col = columnEnds.findIndex(end => end <= ev.startHour);
      const column = col === -1 ? columnEnds.length : col;
      columnEnds[column] = ev.startHour + ev.duration;
      return { ...ev, column, columns: 1 };
    });

    return laid.map(ev => {
      const end = ev.startHour + ev.duration;
      const overlapping = laid.filter(other => other.startHour < end && other.startHour + other.duration > ev.startHour);
      const eventColumns = Math.max(1, ...overlapping.map(other => other.column + 1));
      const preferenceColumns = Math.max(
        0,
        ...preferenceBlocks
          .filter(block => block.startHour < end && block.startHour + block.duration > ev.startHour)
          .map(block => block.people.length)
      );
      const columns = eventColumns + preferenceColumns;
      return { ...ev, columns };
    });
  }

  function dayEventsForMonth(day: number) {
    const sample = sampleEventsForWeek
      .filter(e => { const wd = weekDays[e.dayOffset]; return wd && wd.getDate() === day && wd.getMonth() === 6 && isEventVisible(e); })
      .map(e => {
        const personId = COLOR_TO_PID[e.color];
        return { ...e, color: personById(personId).avatarColor };
      });
    // Deduplicate saved events by meetingId for month view (show once per meeting)
    const seenMeetings = new Set<string>();
    const saved = savedEvents.filter(e => {
      if (e.date.getDate() !== day || e.date.getMonth() !== 6) return false;
      if (!isEventVisible(e)) return false;
      if (seenMeetings.has(e.meetingId)) return false;
      seenMeetings.add(e.meetingId);
      return true;
    });
    return {
      sample,
      saved: saved.map(e => ({ ...e, color: personById(e.personId).avatarColor })),
    };
  }

  const monthCells = useMemo(() => {
    const cells: (number|null)[] = Array(new Date(2026,6,1).getDay()).fill(null);
    for (let i = 1; i <= 31; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, []);

  function addCalendar() {
    const parsed = parsePersonInput(addCalInput, allPeople.length);
    if (!parsed?.name) return;
    if (addCalendarLockRef.current === parsed.normalized) return;
    addCalendarLockRef.current = parsed.normalized;

    const existing = allPeople.find(person => person.name === parsed.name);
    if (ORGANIZER.name === parsed.name || existing || personNameRegistryRef.current.has(parsed.name)) {
      if (existing) setVisiblePersonIds(prev => prev.includes(existing.id) ? prev : [...prev, existing.id]);
      setAddCalInput("");
      setAddCalOpen(false);
      addCalendarLockRef.current = null;
      return;
    }

    const newPerson = createTeamPerson(parsed.name, parsed.role, 0);
    personNameRegistryRef.current.add(newPerson.name);

    setAllPeople(prev => [...prev, newPerson]);
    setVisiblePersonIds(prev => prev.includes(newPerson.id) ? prev : [...prev, newPerson.id]);
    setSavedEvents(prev => prev.some(event => event.personId === newPerson.id) ? prev : [...prev, ...defaultEventsForPerson(newPerson)]);
    setAddCalInput("");
    setAddCalOpen(false);
    window.setTimeout(() => { addCalendarLockRef.current = null; }, 0);
  }

  return (
    <div className="h-screen min-h-[925px] w-full min-w-[1024px] flex flex-col overflow-hidden bg-white" style={{ fontFamily: "'Pretendard', sans-serif" }}>

      {/* ── Header ── */}
      <header className="h-16 bg-white border-b border-[#e8eaed] flex items-center px-4 gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex items-center justify-center">
            <img src="/figma-calendar-logo.png" alt="" className="w-9 h-9 object-contain" />
          </div>
          <span className="text-[18px] leading-7 font-semibold text-[#202124]">캘린더</span>
        </div>
        <button
          onClick={goToday}
          className="ml-1 px-4 py-1.5 rounded-full border border-[#dadce0] text-sm text-[#444746] hover:bg-[#f1f3f4] transition-colors">
          오늘
        </button>
        <div className="flex">
          <button
            onClick={() => moveWeek(-1)}
            className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"
            aria-label="지난주로 이동">
            <ChevronLeft size={18} className="text-[#5f6368]" />
          </button>
          <button
            onClick={() => moveWeek(1)}
            className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"
            aria-label="다음주로 이동">
            <ChevronRight size={18} className="text-[#5f6368]" />
          </button>
        </div>
        <h1 className="text-[18px] font-medium text-[#202124]">{headerMonthLabel}</h1>
        <div className="ml-auto flex items-center gap-2.5">
          <button className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"><Search size={18} className="text-[#5f6368]" /></button>
          <div className="relative">
            <button
              onClick={() => setViewMenuOpen(v => !v)}
              className="px-4 py-1.5 rounded-full border border-[#dadce0] bg-white flex items-center justify-center gap-2 text-sm leading-5 font-medium text-[#444746] hover:bg-[#f1f3f4] transition-colors"
              aria-label="캘린더 보기 선택">
              <span>{currentView}</span>
              <ChevronDown size={14} className="text-[#444746]" strokeWidth={2.4} />
            </button>
            <AnimatePresence>
              {viewMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-[92px] rounded-2xl bg-white border border-[#dadce0] shadow-xl overflow-hidden z-50 py-1">
                  {(["일","주","월"] as ViewMode[]).map(v => (
                    <button
                      key={v}
                      onClick={() => { setCurrentView(v); setViewMenuOpen(false); }}
                      className={`w-full px-5 py-2.5 text-left text-[15px] leading-5 font-medium transition-colors ${currentView === v ? "bg-[#ECF5FF] text-[#4396FB]" : "text-[#202124] hover:bg-[#f1f3f4]"}`}>
                      {v}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-[256px] shrink-0 bg-white border-r border-[#e8eaed] flex flex-col overflow-hidden">
          <div className="px-4 pt-5 pb-3">
            <button
              onClick={() => openPopup(today, 10)}
              className="mb-4 w-full h-10 rounded-[14px] bg-[#4396FB] text-white text-[14px] leading-5 font-semibold flex items-center justify-center gap-1.5 hover:bg-[#2F7FE6] transition-colors shadow-sm">
              <Plus size={16} strokeWidth={2.4} />
              <span>새 회의</span>
            </button>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#202124]">{miniCalMonth.getFullYear()}년 {miniCalMonth.getMonth()+1}월</span>
              <div className="flex gap-0.5">
                <button onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth()-1))} className="w-7 h-7 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"><ChevronLeft size={13} className="text-[#5f6368]" /></button>
                <button onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth()+1))} className="w-7 h-7 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center"><ChevronRight size={13} className="text-[#5f6368]" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-1">{DAYS_KR.map(d => <div key={d} className="text-center text-[10px] text-[#9aa0a6] font-medium py-0.5">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {miniDays.map((day, i) => {
                if (!day) return <div key={i} />;
                const isT = day === today.getDate() && miniCalMonth.getMonth() === today.getMonth();
                return <button key={i} onClick={() => openPopup(new Date(2026,6,day), 10)}
                  className={`w-7 h-7 mx-auto rounded-full text-[11px] font-medium flex items-center justify-center transition-colors ${isT ? "bg-[#4396FB] text-white" : "text-[#202124] hover:bg-[#f1f3f4]"}`}>{day}</button>;
              })}
            </div>
          </div>
          <div className="mx-4 h-px bg-[#e8eaed]" />
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#f1f3f4]">
              <Search size={13} className="text-[#9aa0a6] shrink-0" />
              <input type="text" placeholder="팀원 검색" className="h-5 bg-transparent text-[14px] leading-5 font-normal placeholder-[#9aa0a6] text-[#202124] outline-none w-full" />
            </div>
          </div>
          <div className="mx-4 h-px bg-[#e8eaed] mb-2" />
          <div className="px-3 py-1">
            <div className="flex items-center justify-between px-2 py-[6px]">
              <span className="text-[11px] leading-[16.5px] font-semibold text-[#5f6368] uppercase tracking-[0.275px]">내 캘린더</span>
              <button className="w-5 h-5 rounded-full hover:bg-[#e8eaed] flex items-center justify-center" aria-label="내 캘린더 접기">
                <ChevronLeft size={13} className="text-[#5f6368] -rotate-90" strokeWidth={1.9} />
              </button>
            </div>
            {/* 윤소연 row + ... menu */}
            <div className="pt-[2px]">
              <div className="relative px-3 py-2 rounded-[14px] hover:bg-[#f1f3f4] cursor-pointer transition-colors group">
                <div className="w-[207px] flex items-center gap-2.5">
                  <button
                    onClick={e => { e.stopPropagation(); togglePersonVisibility(ORGANIZER.id); }}
                    className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center transition-colors ${isPersonVisible(ORGANIZER.id) ? "bg-[#4396FB]" : "bg-white border border-[#bdc1c6]"}`}
                    aria-label="윤소연 캘린더 표시 전환">
                    {isPersonVisible(ORGANIZER.id) && <Check size={8} className="text-white" strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`block text-[14px] leading-5 font-normal truncate ${isPersonVisible(ORGANIZER.id) ? "text-[#202124]" : "text-[#9aa0a6]"}`}>윤소연</span>
                  </div>
                  <span className="text-[10px] leading-[15px] font-semibold px-1.5 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368] whitespace-nowrap group-hover:hidden">PD</span>
                  <button
                    onClick={e => { e.stopPropagation(); setShowMyMenu(v => !v); }}
                    className="hidden group-hover:flex w-5 h-5 rounded-full hover:bg-[#d7dde6] items-center justify-center shrink-0"
                    aria-label="윤소연 캘린더 더보기">
                    <MoreVertical size={16} className="text-[#3c4043]" strokeWidth={2.4} />
                  </button>
                </div>

              {/* Dropdown menu */}
              <AnimatePresence>
                {showMyMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-[#e8eaed] z-50 w-44 overflow-hidden py-1">
                    <button
                      onClick={() => { setMyPrefsTab("ooo"); setShowMyPrefs(true); setShowMyMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#202124] hover:bg-[#f1f3f4] transition-colors text-left">
                      <SuitcaseGlyph />
                      외근 설정
                    </button>
                    <button
                      onClick={() => { setMyPrefsTab("meeting"); setShowMyPrefs(true); setShowMyMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#202124] hover:bg-[#f1f3f4] transition-colors text-left">
                      <PreferenceGlyph />
                      개인 선호 설정
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          </div>
          <div className="mx-4 h-px bg-[#e8eaed] my-2" />
          <div className="px-3 py-1">
            <div className="flex items-center justify-between px-2 py-[6px]">
              <span className="text-[11px] leading-[16.5px] font-semibold text-[#5f6368] uppercase tracking-[0.275px]">다른 팀원 캘린더</span>
              <button onClick={() => setAddCalOpen(v => !v)} className="w-5 h-5 rounded-full hover:bg-[#e8eaed] flex items-center justify-center"><Plus size={13} className="text-[#5f6368]" /></button>
            </div>
            <AnimatePresence>
              {addCalOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-2 pb-1 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <input autoFocus type="text" value={addCalInput} onChange={e => setAddCalInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addCalendar(); if (e.key === "Escape") setAddCalOpen(false); }}
                      placeholder="이름 또는 이름 역할"
                      className="flex-1 h-8 px-2 rounded-[10px] bg-[#f1f3f4] text-xs text-[#202124] placeholder-[#9aa0a6] outline-none border border-[#e8eaed] focus:border-[#4396FB]" />
                    <button
                      onClick={addCalendar}
                      disabled={!addCalInput.trim()}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${addCalInput.trim() ? "bg-[#4396FB]" : "bg-[#dfe3e8] cursor-not-allowed"}`}>
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {allPeople.map(person => (
              <div key={person.id} className="pt-[2px]">
                <div className="group relative px-3 py-2 rounded-[14px] hover:bg-[#e8edf5] cursor-pointer transition-colors">
                  <div className="w-[207px] flex items-center gap-2.5">
                    <button
                      onClick={e => { e.stopPropagation(); togglePersonVisibility(person.id); }}
                      className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center transition-colors ${isPersonVisible(person.id) ? "" : "bg-white border border-[#bdc1c6]"}`}
                      style={isPersonVisible(person.id) ? { backgroundColor: person.avatarColor } : undefined}
                      aria-label={`${person.name} 캘린더 표시 전환`}>
                      {isPersonVisible(person.id) && <Check size={8} className="text-white" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0 flex items-end gap-1.5">
                      <span className={`text-[14px] leading-5 font-normal whitespace-nowrap truncate ${isPersonVisible(person.id) ? "text-[#202124]" : "text-[#9aa0a6]"}`}>{person.name}</span>
                      {person.pref && (
                        <span
                          className="text-[9px] leading-[13.5px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{ backgroundColor: person.avatarColor + "17", color: person.avatarColor }}>
                          {person.pref}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] leading-[15px] font-semibold px-1.5 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368] whitespace-nowrap group-hover:hidden">{person.role}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); removeTeamMember(person.id); }}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#d7dde6]"
                        aria-label={`${person.name} 팀원 삭제`}>
                        <X size={16} className="text-[#3c4043]" strokeWidth={2.4} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setTeamColorMenuId(current => current === person.id ? null : person.id); }}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#d7dde6]"
                        aria-label={`${person.name} 색상 변경`}>
                        <MoreVertical size={16} className="text-[#3c4043]" strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {teamColorMenuId === person.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.12 }}
                        onClick={e => e.stopPropagation()}
                        className="absolute right-2 top-full mt-1 z-50 grid grid-cols-5 gap-1.5 rounded-xl border border-[#e8eaed] bg-white p-2 shadow-xl">
                        {TEAM_COLOR_OPTIONS.map(color => (
                          <button
                            key={color}
                            onClick={() => updateTeamColor(person.id, color)}
                            className="w-5 h-5 rounded-full border border-white shadow-[0_0_0_1px_rgba(60,64,67,0.12)] flex items-center justify-center"
                            style={{ backgroundColor: color }}
                            aria-label={`${person.name} 색상 ${color}로 변경`}>
                            {person.avatarColor === color && <Check size={11} className="text-white drop-shadow" strokeWidth={3} />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Calendar ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">

          {/* WEEK VIEW */}
          {currentView === "주" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-[78px] flex border-b border-[#e8eaed] bg-white shrink-0 z-10">
                <div className="w-16 h-[77px] shrink-0 flex items-end justify-end pr-2 pb-2"><span className="text-[10px] leading-[15px] text-[#9aa0a6]">GMT+09</span></div>
                {weekDays.map((day, idx) => {
                  const tod = isToday(day); const isWknd = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div key={idx} className="flex-1 h-[77px] flex flex-col items-center pt-2 pb-2 border-l border-[#e8eaed]">
                      <span className={`text-[11px] leading-[16.5px] font-semibold tracking-[1.1px] uppercase ${tod ? "text-[#4396FB]" : isWknd ? "text-[#bdc1c6]" : "text-[#5f6368]"}`}>{DAYS_KR[day.getDay()]}</span>
                      <div className={`w-10 h-10 flex items-center justify-center mt-1 transition-colors ${tod ? "rounded-lg bg-[#ECF5FF]" : "rounded-full hover:bg-[#f1f3f4]"}`}>
                        <span className={`text-2xl leading-8 font-normal ${tod ? "text-[#4396FB]" : isWknd ? "text-[#bdc1c6]" : "text-[#202124]"}`}>{day.getDate()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="h-[55px] flex border-b border-[#e8eaed] bg-white shrink-0">
                <div className="w-16 h-[55px] shrink-0 flex items-center justify-end pr-2"><span className="text-[9px] leading-[13.5px] text-[#c5c7c5] font-medium">종일</span></div>
                {weekDays.map((day, idx) => {
                  // dayOfWeek: 0=Sun,1=Mon,...,6=Sat → map to 1-based Mon-Fri
                  const dw = day.getDay(); // 1=Mon…5=Fri
                  const myOOOToday = myPrefs.oooDays.includes(dw) && isPersonVisible(ORGANIZER.id);
                  return (
                    <div key={idx} className="flex-1 h-[55px] border-l border-[#e8eaed] pl-[5px] pr-1 py-1.5 overflow-hidden">
                      {/* Fixed OOO: 박은주·정지훈 on Thu */}
                      {dw === 4 && OOO_THURSDAY
                        .map(p => personById(p.id))
                        .filter(p => isPersonVisible(p.id))
                        .map(p => <OutOfOfficeChip key={p.id} person={p} />)}
                      {/* My OOO from settings */}
                      {myOOOToday && (
                        <OutOfOfficeChip person={ORGANIZER} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div ref={calendarScrollRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {hours.map(hour => (
                  <div key={hour} className="flex" style={{ height: "64px" }}>
                    <div className="w-16 shrink-0 relative"><span className="absolute -top-2.5 right-2.5 text-[10px] text-[#9aa0a6] whitespace-nowrap">{fmtTime(hour, 0)}</span></div>
                    {weekDays.map((day, dayIdx) => {
                      const isWknd = day.getDay() === 0 || day.getDay() === 6;
                      const isLunch = hour === 13;
                      const evs = layoutEventsForDay(dayIdx).filter(e => Math.floor(e.startHour) === hour);
                      return (
                        <div key={dayIdx}
                          onClick={() => !isWknd && !draggingEvent && openPopup(day, hour)}
                          onDragOver={e => { if (!isWknd && draggingEvent) e.preventDefault(); }}
                          onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!isWknd) moveDraggedEvent(dayIdx, hour); }}
                          className={`flex-1 border-l border-t border-[#e8eaed] relative transition-colors bg-white ${isWknd ? "cursor-default" : "cursor-pointer group hover:bg-[#f8f9fa]"}`}>

                          {/* Events — side by side with small gap */}
                          {(() => {
                            if (evs.length === 0) return null;
                            const showEvs = evs;
                            const GAP = 2; // px gap between cards
                            return (
                              <>
                                {showEvs.map((ev) => {
                                  const { bg, text } = evPalette(ev.color);
                                  const pendingInvite = (ev as { pendingInvite?: boolean }).pendingInvite;
                                  const canDrag = isOwnEvent(ev);
                                  const totalMargin = 6 + (ev.columns - 1) * GAP;
                                  const widthCalc = `calc((100% - ${totalMargin}px) / ${ev.columns})`;
                                  const leftCalc = ev.column === 0
                                    ? "3px"
                                    : `calc(3px + ${ev.column} * ((100% - ${totalMargin}px) / ${ev.columns} + ${GAP}px))`;
                                  return (
                                    <div key={ev.id}
                                      draggable={canDrag}
                                      onClick={e => { e.stopPropagation(); openEventDetail(ev); }}
                                      onDragStart={e => {
                                        if (!canDrag) return;
                                        e.stopPropagation();
                                        setDraggingEvent({ source: ev.source, id: ev.id, meetingId: (ev as { meetingId?: string }).meetingId, duration: ev.duration });
                                        e.dataTransfer.effectAllowed = "move";
                                      }}
                                      onDragEnd={() => setDraggingEvent(null)}
                                      className={`absolute top-0.5 rounded-[10px] z-20 overflow-hidden transition-opacity ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${draggingEvent?.id === ev.id ? "opacity-45" : ""} ${!pendingInvite && ev.columns > 1 ? "border border-white" : ""}`}
                                      style={{
                                        left: leftCalc,
                                        width: widthCalc,
                                        height: `${ev.duration * 64 - 4}px`,
                                        backgroundColor: pendingInvite ? "#fff" : bg,
                                        border: pendingInvite ? `1.5px dashed ${ev.color}55` : undefined,
                                        borderRadius: "10px",
                                        padding: ev.columns >= 5 ? "6px 5px" : pendingInvite ? "7.5px 8.5px" : "6px 7px",
                                      }}>
                                      <div className="flex items-center gap-1 min-w-0">
                                        {(ev as { urgent?: boolean }).urgent && <img src={EMERGENCY_ICON} alt="" className="w-3 h-3 shrink-0" draggable={false} />}
                                        <p className="text-[10px] font-semibold leading-[12.5px] truncate"
                                          style={{ color: text }}>{ev.title}</p>
                                      </div>
                                      {ev.duration >= 1 && (
                                        <p className="text-[9px] leading-[13.5px] mt-0.5 truncate"
                                          style={{ color: text, opacity: 0.8 }}>
                                          {fmtTime(ev.startHour, 0)} – {fmtTime(
                                            ev.startHour + Math.floor(ev.duration),
                                            ev.duration % 1 === 0.5 ? 30 : 0
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}

                          {/* Meeting preference blocks share the same overlap columns as meetings. */}
                          {!isWknd && (() => {
                            const preferenceBlock = preferenceBlocksForDay(dayIdx).find(block => block.startHour === hour);
                            if (!preferenceBlock) return null;

                            const avoidPeople = preferenceBlock.people;
                            const blockDuration = preferenceBlock.duration;
                            const isLunchAvoid = hour === 13;
                            const sublabel = isLunchAvoid
                              ? "점심 직후 회의 기피"
                              : hour === 1
                                ? "오전 9시 이전 회의 기피"
                                : "오후 6시 이후 회의 기피";
                            const subtime = isLunchAvoid ? "오후 1:00 - 2:00" : hour === 1 ? "오전 9:00 이전" : "오후 6:00 이후";
                            const overlappingEvents = layoutEventsForDay(dayIdx).filter(ev =>
                              ev.startHour < hour + blockDuration && ev.startHour + ev.duration > hour
                            );
                            const usedEventColumns = overlappingEvents.length
                              ? Math.max(...overlappingEvents.map(ev => ev.column + 1))
                              : 0;
                            const totalColumns = overlappingEvents.length
                              ? Math.max(...overlappingEvents.map(ev => ev.columns), usedEventColumns + avoidPeople.length)
                              : avoidPeople.length;
                            const preferenceStartColumn = Math.max(0, Math.min(usedEventColumns, totalColumns - avoidPeople.length));
                            const GAP = 2;
                            const totalMargin = 6 + (totalColumns - 1) * GAP;
                            const widthCalc = `calc((100% - ${totalMargin}px) / ${totalColumns})`;

                            return (
                              <>
                                {avoidPeople.map((p, i) => {
                                  const column = preferenceStartColumn + i;
                                  const leftCalc = column === 0
                                    ? "3px"
                                    : `calc(3px + ${column} * ((100% - ${totalMargin}px) / ${totalColumns} + ${GAP}px))`;
                                  return (
                                    <div key={p.id}
                                      className="absolute rounded-[10px] overflow-hidden pointer-events-none"
                                      style={{
                                        left: leftCalc,
                                        width: widthCalc,
                                        top: "2px",
                                        height: `${blockDuration * 64 - 4}px`,
                                        backgroundColor: `${p.avatarColor}0F`,
                                        zIndex: 18,
                                        padding: "7.5px 9.5px",
                                        opacity: 0.9,
                                      }}>
                                      <div className="flex items-center gap-1 min-w-0">
                                        <MeetingAvoidGlyph type={isLunchAvoid ? "lunch" : "home"} />
                                        <p className="text-[10px] font-semibold truncate" style={{ color: p.avatarColor }}>{sublabel}</p>
                                      </div>
                                      <p className="text-[9px] mt-0.5 truncate" style={{ color: p.avatarColor, opacity: 0.7 }}>{subtime}</p>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}

                          {!isWknd && <div className="absolute inset-1 rounded-[10px] border-2 border-dashed border-[#9CC8FD] opacity-0 group-hover:opacity-45 pointer-events-none transition-opacity z-40" />}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DAY VIEW */}
          {currentView === "일" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex border-b border-[#e8eaed] bg-white shrink-0 shadow-sm">
                <div className="w-16 shrink-0 flex items-end justify-end pr-2 pb-2"><span className="text-[10px] text-[#9aa0a6]">GMT+09</span></div>
                <div className="flex-1 flex flex-col items-center py-2 border-l border-[#e8eaed]">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-[#4396FB]">{DAYS_KR[today.getDay()]}</span>
                  <div className="w-10 h-10 rounded-xl bg-[#ECF5FF] flex items-center justify-center mt-1"><span className="text-2xl font-normal text-[#4396FB]">{today.getDate()}</span></div>
                </div>
              </div>
              <div ref={calendarScrollRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {hours.map(hour => {
                  const evs = cellEvents(0, hour); const isLunch = hour === 13;
                  return (
                    <div key={hour} className="flex" style={{ height: "80px" }}>
                      <div className="w-16 shrink-0 relative"><span className="absolute -top-2.5 right-2.5 text-[10px] text-[#9aa0a6] whitespace-nowrap">{fmtTime(hour, 0)}</span></div>
                      <div className="flex-1 border-l border-t border-[#e8eaed] relative cursor-pointer group hover:bg-[#f8f9fa] bg-white" onClick={() => openPopup(today, hour)}>
                        {evs.map(ev => {
                          const { bg, text } = evPalette(ev.color);
                          const pendingInvite = (ev as { pendingInvite?: boolean }).pendingInvite;
                          return (
                            <div key={ev.id}
                              onClick={e => { e.stopPropagation(); openEventDetail(ev); }}
                              className="absolute left-2 right-2 top-0.5 rounded-2xl px-3 py-2.5 z-20 overflow-hidden"
                              style={{
                                height: `${ev.duration * 80 - 6}px`,
                                backgroundColor: pendingInvite ? "#fff" : bg,
                                border: pendingInvite ? `1.5px dashed ${ev.color}55` : undefined,
                                borderRadius: pendingInvite ? "10px" : undefined,
                              }}>
                              <div className="flex items-center gap-1 min-w-0">
                                {(ev as { urgent?: boolean }).urgent && <img src={EMERGENCY_ICON} alt="" className="w-3.5 h-3.5 shrink-0" draggable={false} />}
                                <p className="text-sm font-semibold truncate" style={{ color: text }}>{ev.title}</p>
                              </div>
                              {ev.duration >= 1 && (
                                <p className="text-xs mt-0.5" style={{ color: text, opacity: 0.8 }}>
                                  {fmtTime(ev.startHour, 0)} – {fmtTime(ev.startHour + Math.floor(ev.duration), ev.duration % 1 === 0.5 ? 30 : 0)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {isLunch && (
                          <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 z-10">
                            {LUNCH_AVOID_PEOPLE.filter(p => isPersonVisible(p.id)).map(p => (
                              <div key={p.id} className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-md" style={{ border: `1.5px dashed ${p.avatarColor}` }}>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.avatarColor }} />
                                <span className="text-[9px] font-semibold" style={{ color: p.avatarColor }}>{p.name} 점심</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="absolute inset-1 rounded-[10px] border-2 border-dashed border-[#9CC8FD] opacity-0 group-hover:opacity-45 pointer-events-none transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MONTH VIEW */}
          {currentView === "월" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="grid grid-cols-7 border-b border-[#e8eaed] shrink-0">
                {DAYS_KR.map(d => <div key={d} className="text-center py-2 text-[11px] font-semibold text-[#5f6368] uppercase tracking-wide">{d}</div>)}
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
                  {monthCells.map((day, i) => {
                    const isT = day === today.getDate(); const isWknd = i % 7 === 0 || i % 7 === 6;
                    const { sample, saved } = day ? dayEventsForMonth(day) : { sample: [], saved: [] };
                    return (
                      <div key={i} onClick={() => day && openPopup(new Date(2026,6,day), 10)}
                        className={`border-b border-r border-[#e8eaed] p-1.5 bg-white transition-colors ${day ? "cursor-pointer hover:bg-[#f8f9fa]" : "cursor-default"}`}>
                        {day && (
                          <>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-sm font-medium ${isT ? "bg-[#4396FB] text-white" : isWknd ? "text-[#bdc1c6]" : "text-[#202124]"}`}>{day}</div>
                            <div className="space-y-0.5">
                              {[...sample.slice(0,2).map(ev => ({ title: ev.title, color: ev.color, urgent: false, pendingInvite: ev.pendingInvite })),
                                ...saved.slice(0, Math.max(0, 2 - sample.length)).map(ev => ({ title: ev.title, color: ev.color, urgent: ev.urgent, pendingInvite: ev.pendingInvite }))
                              ].map((ev, idx) => (
                                <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate"
                                  style={{
                                    backgroundColor: ev.pendingInvite ? "#fff" : ev.color + "22",
                                    border: ev.pendingInvite ? `1.5px dashed ${ev.color}55` : undefined,
                                    color: ev.color,
                                  }}>
                                  {ev.urgent ? <img src={EMERGENCY_ICON} alt="" className="w-3 h-3 shrink-0" draggable={false} /> : <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />}{ev.title}
                                </div>
                              ))}
                              {sample.length + saved.length > 2 && <p className="text-[10px] text-[#5f6368] px-1">+{sample.length + saved.length - 2}개 더</p>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Event Detail ── */}
      <AnimatePresence>
        {detailEvent && (() => {
          const { owner, location, description } = eventDetailMeta(detailEvent);
          const attendees = detailAttendees(detailEvent);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-start justify-center pt-20 px-4"
              style={{ backgroundColor: "rgba(32,33,36,0.08)" }}
              onClick={e => { if (e.target === e.currentTarget) setDetailEvent(null); }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.16 }}
                className="w-[520px] max-w-[calc(100vw-32px)] rounded-[28px] bg-white shadow-[0_18px_45px_rgba(60,64,67,0.26)] overflow-hidden"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2 h-14 px-5">
                  <button className="w-9 h-9 rounded-full hover:bg-[#E5EAF2] flex items-center justify-center transition-colors" aria-label="메일">
                    <Mail size={20} className="text-[#4E5968]" strokeWidth={2.4} />
                  </button>
                  <button onClick={() => setDetailEvent(null)} className="w-9 h-9 rounded-full hover:bg-[#E5EAF2] flex items-center justify-center transition-colors" aria-label="닫기">
                    <X size={22} className="text-[#4E5968]" strokeWidth={2.4} />
                  </button>
                </div>

                <div className="px-8 pb-5">
                  <div className="flex items-start gap-5">
                    <ProfileAvatar person={owner} size={36} />
                    <div className="min-w-0 flex-1 w-[420px]">
                      <div className="flex items-center gap-2 mb-1.5">
                        {detailEvent.urgent && <img src={EMERGENCY_ICON} alt="" className="w-4 h-4 shrink-0" draggable={false} />}
                        <h2 className="text-[26px] leading-[36px] font-medium text-[#202124] tracking-normal break-keep">
                          {detailEvent.title}
                        </h2>
                      </div>
                      <p className="text-[18px] leading-7 font-normal text-[#202124]">
                        {fmtEventRange(detailEvent.date, detailEvent.startHour, detailEvent.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center gap-5 pt-6">
                      <ModalGlyph name="pin" />
                      <p className="text-[16px] leading-6 font-normal text-[#202124] w-[412px]">{location}</p>
                    </div>

                    <div className="flex items-start gap-5 pt-6">
                      <ModalGlyph name="note" className="mt-0.5" />
                      <p className="text-[16px] leading-7 font-normal text-[#202124] whitespace-pre-line w-[412px]">{description}</p>
                    </div>

                    <div className="flex items-start gap-5 pt-6">
                      <ModalGlyph name="people" className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[16px] leading-6 font-semibold text-[#202124]">참석자 {attendees.length}명</p>
                        </div>
                        <div className="pt-3 space-y-2">
                          {attendees.map(({ person, status }) => (
                            <div key={person.id} className="h-[48px] flex items-center gap-[12px] rounded-[12px] px-[4px]">
                              <AttendanceAvatar person={person} status={status} />
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="text-[15px] leading-5 font-semibold text-[#202124] truncate">{person.name}</span>
                                <span className="text-[10px] leading-[15px] font-semibold px-[6px] py-[2px] rounded-[4px] bg-[#E9EDF2] text-[#5f6368] shrink-0">
                                  {person.id === ORGANIZER.id ? "주최자" : "role" in person ? person.role : ""}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 pt-6">
                      <ModalGlyph name="calendar" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] leading-6 font-semibold text-[#202124]">{owner.name}</span>
                        </div>
                        <p className="text-[13px] leading-5 text-[#5f6368]">바쁨 · 기본 공개 설정 · 30분 전에 알림</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── My Prefs Modal ── */}
      <AnimatePresence>
        {showMyPrefs && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowMyPrefs(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.16 }}
              className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8eaed]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: ORGANIZER.avatarColor }}>{ORGANIZER.initials.slice(0,1)}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#202124]">{ORGANIZER.name}</p>
                    <p className="text-xs text-[#9aa0a6]">내 캘린더 설정</p>
                  </div>
                </div>
                <button onClick={() => setShowMyPrefs(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center">
                  <X size={18} className="text-[#5f6368]" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 px-5 pt-4 pb-2">
                {[{ id: "ooo" as const, label: "외근 설정", icon: <SuitcaseGlyph /> },
                  { id: "meeting" as const, label: "개인 선호", icon: <PreferenceGlyph /> }].map(tab => (
                  <button key={tab.id} onClick={() => setMyPrefsTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${myPrefsTab === tab.id ? "bg-[#ECF5FF] text-[#4396FB]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="px-5 py-4 space-y-4 min-h-[200px]">
                {myPrefsTab === "meeting" && (
                  <>
                    <p className="text-xs text-[#9aa0a6] leading-relaxed">
                      설정된 선호는 캘린더에 <span className="font-semibold">점선</span>으로 표시되어 팀원들이 회의 시간 조율 시 참고합니다.
                    </p>
                    {[
                      { key: "avoidLunch",   label: "점심 직후 회의 기피",   desc: "오후 1:00 – 2:00" },
                      { key: "avoidMorning", label: "오전 9시 이전 회의 기피", desc: "오전 9:00 이전" },
                      { key: "avoidEvening", label: "오후 6시 이후 회의 기피", desc: "오후 6:00 이후" },
                    ].map(({ key, label, desc }) => {
                      const active = myPrefs[key as keyof typeof myPrefs] as boolean;
                      return (
                        <label key={key}
                          onClick={() => setMyPrefs(p => ({ ...p, [key]: !active }))}
                          className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-[#f8f9fa] transition-colors">
                          <div className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-colors shrink-0
                            ${active ? "bg-[#4396FB] border-[#4396FB]" : "border-[#dadce0]"}`}>
                            {active && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#202124]">{label}</p>
                            <p className="text-xs text-[#9aa0a6] mt-0.5">{desc}</p>
                          </div>
                          {active && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: ORGANIZER.avatarColor + "18", color: ORGANIZER.avatarColor }}>
                              캘린더 표시 중
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </>
                )}

                {myPrefsTab === "ooo" && (
                  <>
                    <p className="text-xs text-[#9aa0a6] leading-relaxed">
                      반복 외근 요일을 설정하면 캘린더 종일 행에 표시되며, 팀원의 회의 생성 시 참고됩니다.
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-[#5f6368] mb-3">반복 외근 요일</p>
                      <div className="flex gap-2">
                        {["월","화","수","목","금"].map((d, i) => {
                          const dayNum = i + 1;
                          const active = myPrefs.oooDays.includes(dayNum);
                          return (
                            <button key={d}
                              onClick={() => setMyPrefs(p => ({
                                ...p,
                                oooDays: active ? p.oooDays.filter(x => x !== dayNum) : [...p.oooDays, dayNum],
                              }))}
                              className={`w-11 h-11 rounded-full text-sm font-semibold transition-all
                                ${active ? "text-white shadow-sm" : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"}`}
                              style={active ? { backgroundColor: ORGANIZER.avatarColor } : {}}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {myPrefs.oooDays.length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#ECF5FF]">
                        <SuitcaseGlyph />
                        <p className="text-xs text-[#4396FB] leading-relaxed">
                          {["월","화","수","목","금"].filter((_, i) => myPrefs.oooDays.includes(i + 1)).join(", ")}요일에 외근이 캘린더에 표시됩니다.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#e8eaed]">
                <button onClick={() => setShowMyPrefs(false)} className="text-sm text-[#5f6368] hover:underline">취소</button>
                <button onClick={() => setShowMyPrefs(false)}
                  className="px-5 py-2 rounded-full bg-[#4396FB] text-white text-sm font-semibold hover:bg-[#2F7FE6] transition-colors shadow-sm">
                  저장 및 적용
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Popup ── */}
      <AnimatePresence>
        {popupOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
            onClick={e => { if (e.target === e.currentTarget) setPopupOpen(false); }}>

            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
              className="bg-[#f8f8f8] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] w-[540px] max-h-[92vh] overflow-y-auto"
              style={{ scrollbarWidth: "thin" }}>

              {/* Header */}
              <div className="h-14 flex items-start justify-end p-2.5">
                <button onClick={() => setPopupOpen(false)} className="w-8 h-8 rounded-full hover:bg-[#e8eaed] flex items-center justify-center transition-colors"><X size={18} className="text-[#5f6368]" /></button>
              </div>

              {/* Title */}
              <div className="h-[61px] px-6">
                <input type="text" value={popupTitle} onChange={e => setPopupTitle(e.target.value)} placeholder="회의" autoFocus
                  className="w-full h-[45px] text-[26px] leading-none font-medium bg-transparent outline-none pb-1 text-[#202124] placeholder-[#9aa0a6]"
                  style={{ borderBottom: "2px solid #4396FB" }} />
              </div>

              {/* Tabs */}
              <div className="px-5 pb-4 flex gap-2">
                {["일정","할 일","약속 일정"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full text-[14px] leading-5 font-medium transition-colors ${activeTab === tab ? "bg-[#ECF5FF] text-[#4396FB]" : "text-[#5f6368] hover:bg-[#e8eaed]"}`}>{tab}</button>
                ))}
              </div>

              {/* Form card */}
              <div className="bg-white rounded-[16px] mx-4 mb-3 divide-y divide-[#f1f3f4] overflow-hidden">

                {/* ── Date/Time row ── */}
                <div className="flex items-start gap-4 px-5 pt-4 pb-[17px]">
                  <ModalGlyph name="clock" className="mt-0.5" />
                  <div className="flex-1 space-y-3">
                    {/* Date + time pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Date pill */}
                      <div className="relative">
                        <button onClick={() => { setShowDatePicker(v => !v); setShowStartPicker(false); setShowEndPicker(false); setShowRepeatPicker(false); }}
                          className="h-9 px-4 rounded-[10px] bg-[#f1f3f4] text-[14px] leading-5 font-medium text-[#5f6368] hover:bg-[#e8eaed] transition-colors">
                          {fmtDateShort(popupDate)}
                        </button>
                        {showDatePicker && <DatePicker value={popupDate} onChange={setPopupDate} onClose={() => setShowDatePicker(false)} />}
                      </div>
                      {/* Start time pill */}
                      {!isAllDay && (
                        <>
                          <div className="relative">
                            <button onClick={() => { setShowStartPicker(v => !v); setShowDatePicker(false); setShowEndPicker(false); setShowRepeatPicker(false); }}
                              className="h-9 px-4 rounded-[10px] bg-[#f1f3f4] text-[14px] leading-5 font-medium text-[#5f6368] hover:bg-[#e8eaed] transition-colors">
                              {fmtTime(startH, startM)}
                            </button>
                            {showStartPicker && <TimePicker value={{ h: startH, m: startM }} onChange={(h, m) => { setStartH(h); setStartM(m); if (h * 60 + m >= endH * 60 + endM) { setEndH(h + 1); setEndM(m); } }} onClose={() => setShowStartPicker(false)} />}
                          </div>
                          <span className="text-[#5f6368] text-sm">–</span>
                          <div className="relative">
                            <button onClick={() => { setShowEndPicker(v => !v); setShowDatePicker(false); setShowStartPicker(false); setShowRepeatPicker(false); }}
                              className="h-9 px-4 rounded-[10px] bg-[#f1f3f4] text-[14px] leading-5 font-medium text-[#5f6368] hover:bg-[#e8eaed] transition-colors">
                              {fmtTime(endH, endM)}
                            </button>
                            {showEndPicker && <TimePicker value={{ h: endH, m: endM }} onChange={(h, m) => { setEndH(h); setEndM(m); }} onClose={() => setShowEndPicker(false)} />}
                          </div>
                        </>
                      )}
                    </div>
                    {/* All day + timezone */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setIsAllDay(v => !v)}
                          className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${isAllDay ? "bg-[#4396FB] border-[#4396FB]" : "border-[#9aa0a6]"}`}>
                          {isAllDay && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-[14px] leading-5 font-medium text-[#5f6368]">종일</span>
                      </label>
                      <button className="text-sm text-[#4396FB] font-medium hover:underline">시간대</button>
                    </div>
                    {/* Repeat dropdown */}
                    <div className="relative inline-block">
                      <button onClick={() => { setShowRepeatPicker(v => !v); setShowDatePicker(false); setShowStartPicker(false); setShowEndPicker(false); }}
                        className="h-9 flex items-center gap-2 px-4 rounded-[10px] bg-[#f1f3f4] text-[14px] leading-5 font-medium text-[#5f6368] hover:bg-[#e8eaed] transition-colors">
                        <span>{repeatVal}</span><ChevronDown size={14} className="text-[#5f6368]" />
                      </button>
                      {showRepeatPicker && <RepeatPicker value={repeatVal} onChange={setRepeatVal} onClose={() => setShowRepeatPicker(false)} />}
                    </div>
                  </div>
                </div>

                {/* ── Project row ── */}
                <div className="flex items-start gap-4 px-5 pt-[14px] pb-[15px]">
                  <div className="w-6 h-6 shrink-0 mt-0 flex items-center justify-start overflow-hidden">
                    <img src={FOLDER_ICON} alt="" className="w-6 h-6 block" draggable={false} />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      {projects.map(proj => {
                        const sel = projectId === proj.id;
                        return (
                          <div key={proj.id}
                            className="group relative h-8 flex items-center rounded-[10px] text-[12px] leading-4 font-semibold transition-all"
                            style={sel ? { backgroundColor: "#ECF5FF", color: "#4396FB" } : { backgroundColor: "#f1f3f4", color: "#5f6368" }}>
                            <button onClick={() => { setProjectId(sel ? null : proj.id); setMeetingTypeId(null); }}
                              className="h-full min-w-0 flex items-center gap-[6px] rounded-[10px] pl-3 pr-3 transition-[padding] group-hover:pr-7">
                              <span className="truncate text-[12px] leading-4 font-semibold">{proj.name}</span>
                              {sel && <span className="opacity-75 text-[12px] leading-4 whitespace-nowrap">· {proj.phase}</span>}
                            </button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); deleteProject(proj.id); }}
                              aria-label={`${proj.name} 프로젝트 삭제`}
                              title="프로젝트 삭제"
                              className={`absolute right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all
                                ${sel ? "text-[#4396FB] hover:bg-[#DCEEFF]" : "text-[#80868b] hover:bg-[#e0e3e7]"}
                                opacity-0 group-hover:opacity-100 focus:opacity-100`}>
                              <X size={12} strokeWidth={2.4} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {/* + 프로젝트 추가 */}
                    <AnimatePresence>
                      {addProjectOpen ? (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-2">
                          <div className="bg-[#f8f9fa] rounded-xl p-3 space-y-3 border border-[#e8eaed]">
                            {/* Name */}
                            <input autoFocus type="text" value={addProjectInput}
                              onChange={e => setAddProjectInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Escape") { setAddProjectOpen(false); setNewProjectMembers([]); } }}
                              placeholder="새 프로젝트 이름"
                              className="w-full px-3 py-2 rounded-lg bg-white text-sm text-[#202124] placeholder-[#9aa0a6] outline-none border border-[#e8eaed] focus:border-[#4396FB]" />

                            {/* Member selection */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-wide">프로젝트 멤버</p>
                                {newProjectMembers.length > 0 && (
                                  <span className="text-[10px] text-[#4396FB] font-semibold">{newProjectMembers.length}명 선택</span>
                                )}
                              </div>

                              {/* Search bar */}
                              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#e8eaed] focus-within:border-[#4396FB] mb-2 transition-colors">
                                <Search size={12} className="text-[#9aa0a6] shrink-0" />
                                <input
                                  type="text"
                                  value={memberSearch}
                                  onChange={e => setMemberSearch(e.target.value)}
                                  placeholder="이름 또는 역할 검색"
                                  className="flex-1 text-xs text-[#202124] placeholder-[#9aa0a6] bg-transparent outline-none"
                                />
                                {memberSearch && (
                                  <button onClick={() => setMemberSearch("")} className="w-4 h-4 rounded-full hover:bg-[#e8eaed] flex items-center justify-center">
                                    <X size={10} className="text-[#9aa0a6]" />
                                  </button>
                                )}
                              </div>

                              {/* Filtered member list */}
                              <div className="space-y-1 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                                {(() => {
                                  const q = memberSearch.trim().toLowerCase();
                                  const filtered = allPeople.filter(p =>
                                    !q || p.name.includes(q) || p.role.toLowerCase().includes(q)
                                  );
                                  return (
                                    <>
                                      {filtered.map(p => {
                                        const sel = newProjectMembers.includes(p.id);
                                        return (
                                          <button key={p.id}
                                            onClick={() => setNewProjectMembers(prev =>
                                              sel ? prev.filter(x => x !== p.id) : [...prev, p.id]
                                            )}
                                            className={`w-full flex items-center gap-3 px-1 py-1.5 rounded-[10px] text-left transition-colors
                                              ${sel ? "bg-[#ECF5FF]" : "bg-white hover:bg-[#f1f3f4]"}`}
                                            style={{ fontFamily: "'Noto Sans KR', 'Pretendard', sans-serif" }}>
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                                              ${sel ? "bg-[#4396FB] border-[#4396FB]" : "border-[#dadce0]"}`}>
                                              {sel && <Check size={9} className="text-white" strokeWidth={3} />}
                                            </div>
                                            <ProfileAvatar person={p} />
                                            <span className={`text-sm flex-1 ${sel ? "text-[#4396FB] font-medium" : "text-[#202124]"}`}>{p.name}</span>
                                            <span className="text-[10px] leading-[15px] font-semibold px-1.5 py-0.5 rounded-lg bg-[#f1f3f4] text-[#5f6368] shrink-0">{p.role}</span>
                                          </button>
                                        );
                                      })}

                                      {/* Add new person if no exact match */}
                                      {memberSearch.trim() && !allPeople.some(p => p.name === memberSearch.trim()) && (
                                        <button
                                          onClick={() => addNewPersonAndSelect(memberSearch)}
                                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left bg-white hover:bg-[#f1f3f4] border border-dashed border-[#4396FB] transition-colors mt-1">
                                          <div className="w-4 h-4 rounded border-2 border-[#4396FB] flex items-center justify-center shrink-0">
                                            <Plus size={9} className="text-[#4396FB]" strokeWidth={3} />
                                          </div>
                                          <div className="w-6 h-6 rounded-full bg-[#ECF5FF] flex items-center justify-center text-[#4396FB] text-[9px] font-bold shrink-0">
                                            {memberSearch.trim().slice(0, 1)}
                                          </div>
                                          <span className="text-sm text-[#4396FB] font-medium flex-1">"{memberSearch.trim()}" 새 멤버로 추가</span>
                                        </button>
                                      )}

                                      {filtered.length === 0 && !memberSearch.trim() && (
                                        <p className="text-xs text-[#9aa0a6] text-center py-3">등록된 팀원이 없습니다</p>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              <button onClick={addProject}
                                disabled={!addProjectInput.trim()}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
                                  ${addProjectInput.trim() ? "bg-[#4396FB] text-white hover:bg-[#2F7FE6]" : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed"}`}>
                                프로젝트 추가
                              </button>
                              <button onClick={() => { setAddProjectOpen(false); setNewProjectMembers([]); }}
                                className="px-3 py-2 rounded-lg text-sm text-[#5f6368] hover:bg-[#e8eaed] transition-colors">
                                취소
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <button onClick={() => setAddProjectOpen(true)}
                          className="pt-2 flex items-center gap-1 text-[12px] leading-4 font-medium text-[#5f6368] hover:text-[#4396FB] transition-colors"
                          style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
                          <Plus size={12} /><span>프로젝트 추가</span>
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── Meeting type row ── */}
                <div className="flex items-start gap-4 px-5 pt-[14px] pb-[15px]">
                    <ModalGlyph name="document" className="mt-0.5" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2" style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
                      <div>
                        <div className="flex flex-wrap content-start gap-2">
                        {meetingTypes.map(type => {
                          const sel = meetingTypeId === type.id;
                          const isUrgent = type.id === "urgent";
                          return (
                            <div key={type.id}
                              className={`group relative h-8 rounded-[10px] text-[12px] leading-4 font-semibold transition-all ${sel ? "bg-[#ECF5FF] text-[#4396FB]" : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"}`}>
                              <button onClick={() => setMeetingTypeId(sel ? null : type.id)}
                                className={`h-full flex items-center justify-center rounded-[10px] py-2 pl-3 pr-3 transition-[padding] group-hover:pr-7 ${isUrgent ? "gap-1" : ""}`}>
                                {isUrgent && <img src={EMERGENCY_ICON} alt="" className="w-3 h-3 shrink-0" draggable={false} />}
                                <span className="text-[12px] leading-4 font-semibold whitespace-nowrap">{type.label}</span>
                              </button>
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); deleteMeetingType(type.id); }}
                                aria-label={`${type.label} 회의 유형 삭제`}
                                title="회의 유형 삭제"
                                className={`absolute right-1 top-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all
                                  ${sel ? "text-[#4396FB] hover:bg-[#DCEEFF]" : "text-[#80868b] hover:bg-[#e0e3e7]"}
                                  opacity-0 group-hover:opacity-100 focus:opacity-100`}>
                                <X size={12} strokeWidth={2.4} />
                              </button>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                      <AnimatePresence>
                        {addTypeOpen ? (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="mt-1 rounded-xl border border-[#e8eaed] bg-[#f8f9fa] p-3 space-y-3">
                              <input autoFocus type="text" value={addTypeInput} onChange={e => setAddTypeInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") addMeetingType(); if (e.key === "Escape") closeAddMeetingType(); }}
                                placeholder="새 회의 유형 이름"
                                className="w-full px-3 py-2 rounded-lg bg-white text-sm text-[#202124] placeholder-[#9aa0a6] outline-none border border-[#e8eaed] focus:border-[#4396FB]" />
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-wide">참석 역할 설정</p>
                                  <span className="text-[10px] leading-[15px] text-[#9aa0a6]">필수 {newTypeRequiredRoles.length} · 선택 {newTypeOptionalRoles.length}</span>
                                </div>
                                <div className="space-y-1.5 max-h-[172px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                                  {ROLE_OPTIONS.map(role => {
                                    const mode = newTypeRequiredRoles.includes(role) ? "required" : newTypeOptionalRoles.includes(role) ? "optional" : "none";
                                    return (
                                      <div key={role} className="flex items-center gap-2 min-w-0">
                                        <span className="w-[68px] truncate text-[11px] leading-4 font-semibold text-[#202124]">{role}</span>
                                        {([
                                          ["required", "필수"],
                                          ["optional", "선택"],
                                          ["none", "제외"],
                                        ] as const).map(([value, label]) => (
                                          <button key={value} type="button"
                                            onClick={() => setNewTypeRole(role, value)}
                                            className={`h-7 min-w-[44px] px-3 rounded-[10px] text-[12px] leading-4 font-semibold transition-colors
                                              ${mode === value ? "bg-[#ECF5FF] text-[#4396FB]" : "bg-white text-[#5f6368] hover:bg-[#f1f3f4]"}`}>
                                            {label}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button onClick={addMeetingType}
                                  disabled={!addTypeInput.trim()}
                                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
                                    ${addTypeInput.trim() ? "bg-[#4396FB] text-white hover:bg-[#2F7FE6]" : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed"}`}>
                                  회의 유형 추가
                                </button>
                                <button onClick={closeAddMeetingType} className="px-3 py-2 rounded-lg text-sm text-[#5f6368] hover:bg-[#e8eaed] transition-colors">
                                  취소
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <button onClick={() => setAddTypeOpen(true)} className="pt-2 flex items-center gap-1 text-[12px] leading-4 font-medium text-[#5f6368] hover:text-[#4396FB] transition-colors">
                            <Plus size={12} /><span>회의 유형 추가</span>
                          </button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                {/* ── Participants ── */}
                <div className="flex items-start gap-4 px-5 pt-[14px] pb-[15px]">
                  <ModalGlyph name="people" className="mt-2" />
                  <div className="flex-1">
                    <div className="h-9 w-full px-3 py-2 rounded-[10px] bg-[#f1f3f4] text-[14px] leading-5 text-[#9aa0a6] cursor-text mb-3">참석자 추가</div>
                    <PersonRow person={ORGANIZER} role="주최자" />
                    {projectId && requiredPeople.length > 0 && (
                      <>
                        {meetingTypeId && <p className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-wide px-1 pt-3 pb-1">필수 참석자</p>}
                        {requiredPeople.map(p => <PersonRow key={p.id} person={p} role={p.role} />)}
                      </>
                    )}
                    {projectId && optionalPeople.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-wide px-1 pt-3 pb-1">선택 참석자</p>
                        {optionalPeople.map(p => <PersonRow key={p.id} person={p} role={p.role} />)}
                      </>
                    )}
                  </div>
                </div>

                {/* Schedule Preview — shown when project is selected */}
                {projectId && (
                  <div className="px-5 py-4 border-t border-[#f1f3f4]">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-[#5f6368]">
                        참석자 스케줄 — {fmtDateShort(popupDate)}
                      </p>
                      {getDayOffset(popupDate) < 0 && (
                        <span className="text-[9px] text-[#9aa0a6]">현재 주 범위 외</span>
                      )}
                    </div>
                    <SchedulePreview
                      participants={[ORGANIZER, ...requiredPeople, ...optionalPeople].filter(p => isPersonVisible(p.id))}
                      dayOffset={getDayOffset(popupDate)}
                      sampleEvents={sampleEventsForWeek}
                      selStartH={startH} selStartM={startM}
                      selEndH={endH} selEndM={endM}
                    />
                    {/* Conflict hint */}
                    {(() => {
                      const do_ = getDayOffset(popupDate);
                      if (do_ < 0) return null;
                      const allP = [ORGANIZER, ...requiredPeople, ...optionalPeople].filter(p => isPersonVisible(p.id));
                      const conflicts = allP.filter(p => {
                        const evs = sampleEventsForWeek.filter(e => e.dayOffset === do_ && COLOR_TO_PID[e.color] === p.id && isEventVisible(e));
                        return evs.some(ev => {
                          const evEnd = ev.startHour + ev.duration;
                          const sStart = startH + startM / 60;
                          const sEnd = endH + endM / 60;
                          return ev.startHour < sEnd && evEnd > sStart;
                        });
                      });
                      if (conflicts.length === 0) return (
                        <p className="text-[10px] text-[#34a853] mt-2 flex items-center gap-1 font-medium">
                          <Check size={10} strokeWidth={3} /> 모든 참석자가 가능한 시간입니다
                        </p>
                      );
                      return (
                        <p className="text-[10px] text-[#f9ab00] mt-2 font-medium">
                          ⚠ {conflicts.map(p => p.name).join(", ")}의 일정과 겹칩니다
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Google Meet */}
                <div className="flex items-center gap-4 px-5 pt-[14px] pb-[15px]">
                  <ModalGlyph name="video" />
                  <span className="text-[14px] leading-5 font-normal text-[#9aa0a6] whitespace-nowrap">Google Meet 화상 회의 추가</span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-4 px-5 pt-[14px] pb-[15px]">
                  <ModalGlyph name="pin" />
                  {locationMode === "none" && !locationVal ? (
                    <div className="flex-1 text-[14px] leading-5 font-normal text-[#9aa0a6]">
                      <button
                        type="button"
                        onClick={() => setLocationMode("room")}
                        className="text-[14px] leading-5 font-normal underline underline-offset-[3px] decoration-[#9aa0a6] hover:text-[#4396FB] hover:decoration-[#4396FB] transition-colors">
                        회의실
                      </button>
                      <span className="text-[14px] leading-5 font-normal"> 또는 </span>
                      <button
                        type="button"
                        onClick={() => setLocationMode("location")}
                        className="text-[14px] leading-5 font-normal underline underline-offset-[3px] decoration-[#9aa0a6] hover:text-[#4396FB] hover:decoration-[#4396FB] transition-colors">
                        위치
                      </button>
                      <span className="text-[14px] leading-5 font-normal"> 추가</span>
                    </div>
                  ) : (
                    <input
                      autoFocus
                      type="text"
                      value={locationVal}
                      onChange={e => setLocationVal(e.target.value)}
                      placeholder={locationMode === "room" ? "회의실 예약" : "위치 설정"}
                      className="flex-1 text-[14px] leading-5 font-normal text-[#202124] bg-transparent outline-none placeholder-[#9aa0a6]" />
                  )}
                </div>

                {/* Description */}
                <div className="flex items-start gap-4 px-5 py-[14px]">
                  <ModalGlyph name="note" className="mt-0.5" />
                  <textarea
                    value={descriptionVal}
                    onChange={e => setDescriptionVal(e.target.value)}
                    rows={descriptionVal ? 3 : 1}
                    placeholder="설명 또는 Google Drive 첨부파일 추가"
                    className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-5 text-[#202124] placeholder-[#9aa0a6]"
                  />
                </div>
              </div>

              {/* Calendar */}
              <div className="bg-white rounded-[16px] mx-4 mb-4 px-5 py-[14px]">
                <div className="flex items-center gap-3">
                  <ModalGlyph name="calendar" />
                  <div>
                    <div className="flex items-center gap-2"><span className="text-sm text-[#202124]">윤소연</span></div>
                    <p className="text-xs text-[#5f6368] mt-0.5">바쁨 · 기본 공개 설정 · 30분 전에 알림</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-[76px] flex items-center justify-end gap-3 px-5 pt-4 pb-5">
                <button onClick={() => setPopupOpen(false)} className="text-[14px] leading-5 text-[#4396FB] font-medium hover:underline">옵션 더보기</button>
                <button onClick={handleSave} className="px-6 py-2.5 rounded-full bg-[#4396FB] text-white text-[14px] leading-5 font-semibold hover:bg-[#2F7FE6] transition-colors shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)]">저장</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
