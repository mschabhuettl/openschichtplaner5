export interface Employee {
  ID: number;
  POSITION: number;
  NUMBER: string;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  SHORTNAME_GENERATED?: boolean;   // true = auto-generated from name, not stored in DB
  SEX: number;
  BIRTHDAY?: string;
  EMPSTART?: string;
  EMPEND?: string;
  HRSDAY: number;
  HRSWEEK: number;
  HRSMONTH: number;
  HRSTOTAL?: number;
  WORKDAYS_LIST: boolean[];
  HIDE: boolean;
  BOLD?: number;
  // Personal data
  SALUTATION?: string;
  STREET?: string;
  ZIP?: string;
  TOWN?: string;
  PHONE?: string;
  EMAIL?: string;
  FUNCTION?: string;
  // Calculation settings
  CALCBASE?: number;
  DEDUCTHOL?: number;
  // Notes
  NOTE1?: string;
  NOTE2?: string;
  NOTE3?: string;
  NOTE4?: string;
  ARBITR1?: string;
  ARBITR2?: string;
  ARBITR3?: string;
  // Colors (BGR int + hex)
  CFGLABEL?: number;
  CFGLABEL_HEX?: string;
  CBKLABEL?: number;
  CBKLABEL_HEX?: string;
  CBKSCHED?: number;
  CBKSCHED_HEX?: string;
  // Photo
  PHOTO?: string;
}

export interface Group {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  POSITION: number;
  SUPERID?: number;
  HIDE: boolean;
  member_count?: number;
  BOLD?: number;
  DAILYDEM?: number;
  ARBITR?: string;
  CFGLABEL?: number;
  CFGLABEL_HEX?: string;
  CBKLABEL?: number;
  CBKLABEL_HEX?: string;
  CBKSCHED?: number;
  CBKSCHED_HEX?: string;
}

export interface ShiftType {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  POSITION: number;
  COLORBK: number;
  COLORBK_HEX: string;
  COLORTEXT: number;
  COLORTEXT_HEX: string;
  COLORBAR_HEX: string;
  COLORBK_LIGHT: boolean;
  HIDE: boolean;
  TIMES_BY_WEEKDAY: Record<string, { start: string; end: string } | null>;
  DURATION0: number;
  // Per-weekday durations (1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa, 7=So)
  DURATION1?: number;
  DURATION2?: number;
  DURATION3?: number;
  DURATION4?: number;
  DURATION5?: number;
  DURATION6?: number;
  DURATION7?: number;
  // Per-weekday start/end times (0=default, 1-7 weekdays)
  STARTEND0?: string;
  STARTEND1?: string;
  STARTEND2?: string;
  STARTEND3?: string;
  STARTEND4?: string;
  STARTEND5?: string;
  STARTEND6?: string;
  STARTEND7?: string;
}

export interface LeaveType {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  POSITION: number;
  COLORBK_HEX: string;
  COLORBAR_HEX: string;
  COLORBK_LIGHT: boolean;
  ENTITLED: boolean;
  STDENTIT: number;
  HIDE: boolean;
}

/** Halbtagsmodus eines Feiertags (5HOLID.INTERVAL): 0 = ganztägig,
 *  1 = erste Tageshälfte, 2 = zweite Tageshälfte. */
export type HolidayInterval = 0 | 1 | 2;

export interface Holiday {
  ID: number;
  DATE: string;
  NAME: string;
  /** Wertebereich HolidayInterval (0|1|2); bewusst breit als number,
   *  solange Alt-Code (Holidays.tsx-Formular) freie Zahlen schreibt. */
  INTERVAL: number;
}

export interface Workplace {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  POSITION: number;
  COLORBK_HEX: string;
  HIDE: boolean;
}

export interface ScheduleEntry {
  employee_id: number;
  date: string;
  kind: 'shift' | 'special_shift' | 'absence';
  shift_id?: number;
  leave_type_id?: number;
  workplace_id?: number;
  workplace_name?: string;
  display_name: string;
  color_bk: string;
  color_text: string;
  shift_name?: string;
  leave_name?: string;
  custom_name?: string;
  /** 'cycle' = generierter Zyklusdienst (5CYASS-Expansion); fehlt/null bei manuellen Einträgen. */
  source?: 'cycle' | null;
  /** Soll-/Istplan (Spec 4.12): 0=Istplan (Normaleintrag), 1=Sollplan (Zielvorgabe). Nur bei kind==='shift'. */
  schedule_type?: number;
  /** Teiltags-Abwesenheit (Spec 3.5.2/D-54): 0=ganz, 1=vorm., 2=nachm., 3=stundenweise. Nur bei kind==='absence' (ab lib 1.14.0). */
  interval?: number;
  /** Nur bei interval=3: Beginn in Minuten ab Mitternacht. */
  start_time?: number;
  /** Nur bei interval=3: Ende in Minuten ab Mitternacht. */
  end_time?: number;
  /** anonymisierte Abwesenheit (5USER.SHOWABS=1) — Anzeige bereits serverseitig ersetzt. */
  anonymized?: boolean;
}

export interface User {
  ID: number;
  NAME: string;
  DESCRIP: string;
  ADMIN: boolean;
  RIGHTS: number;
  HIDE: boolean;
  role?: string;  // 'Admin' | 'Planer' | 'Leser'
  POSITION?: number;
  WDUTIES?: boolean;
  WABSENCES?: boolean;
  BACKUP?: boolean;
  /** Granulare Rechte aus /api/auth/me (z. B. write_duties/write_absences). */
  permissions?: Record<string, boolean>;
}

export interface Stats {
  employees: number;
  groups: number;
  shifts: number;
  leave_types: number;
  workplaces: number;
  holidays: number;
  users: number;
}

export interface ExtraCharge {
  ID: number;
  NAME: string;
  POSITION: number;
  START: number;    // minutes from midnight
  END: number;      // minutes from midnight
  VALIDITY: number;
  VALIDDAYS: string; // 7 chars: '0'/'1' per weekday Mon-Sun
  HOLRULE: number;   // 0=all days, 1=holidays only, 2=not on holidays
  HIDE: number;
}
