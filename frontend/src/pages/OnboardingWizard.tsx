import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

// ── Types ────────────────────────────────────────────────────────────────────

interface Group {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  HIDE: number | boolean;
  member_count?: number;
}

// ── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { icon: '👤', label: 'Persönliche Daten' },
  { icon: '⚙️', label: 'Arbeitszeitmodell' },
  { icon: '👥', label: 'Gruppe(n)' },
  { icon: '✅', label: 'Zusammenfassung' },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-all
              ${i < current ? 'bg-green-500 border-green-500 text-white' :
                i === current ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110' :
                'bg-white border-gray-300 text-gray-600'}`}>
              {i < current ? '✓' : s.icon}
            </div>
            <span className={`text-xs mt-1 font-medium text-center whitespace-nowrap
              ${i === current ? 'text-blue-600' : i < current ? 'text-green-600' : 'text-gray-600'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-[-16px] transition-all
              ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Personal data ─────────────────────────────────────────────────────

interface PersonalData {
  LASTNAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  NUMBER: string;
  SEX: number;
  EMAIL: string;
  PHONE: string;
  BIRTHDAY: string;
  EMPSTART: string;
  FUNCTION: string;
  STREET: string;
  ZIP: string;
  TOWN: string;
}

function Step1Personal({ data, onChange, lastnameBlurred, onLastnameBlur }: { data: PersonalData; onChange: (d: PersonalData) => void; lastnameBlurred?: boolean; onLastnameBlur?: () => void }) {
  const set = (key: keyof PersonalData, val: string | number) =>
    onChange({ ...data, [key]: val });

  // Auto-generate shortname from name
  const autoShort = (ln: string, fn: string) => {
    const l = ln.trim().slice(0, 2).toUpperCase();
    const f = fn.trim().slice(0, 1).toUpperCase();
    return f + l;
  };

  const lastnameInvalid = lastnameBlurred && !data.LASTNAME.trim();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Persönliche Daten</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wizard-lastname">Nachname *</label>
            <input
              id="wizard-lastname"
              type="text"
              value={data.LASTNAME}
              required
              aria-required="true"
              aria-invalid={lastnameInvalid}
              onBlur={onLastnameBlur}
              onChange={e => {
                const v = e.target.value;
                onChange({ ...data, LASTNAME: v, SHORTNAME: autoShort(v, data.FIRSTNAME) });
              }}
              className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${lastnameInvalid ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Mustermann"
            />
            {lastnameInvalid && <p className="text-red-500 text-xs mt-0.5" role="alert">Nachname ist ein Pflichtfeld</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
            <input
              type="text"
              value={data.FIRSTNAME}
              onChange={e => {
                const v = e.target.value;
                onChange({ ...data, FIRSTNAME: v, SHORTNAME: autoShort(data.LASTNAME, v) });
              }}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Max"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kürzel</label>
            <input
              type="text"
              value={data.SHORTNAME}
              onChange={e => set('SHORTNAME', e.target.value.toUpperCase())}
              maxLength={5}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              placeholder="MMU"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personalnummer</label>
            <input
              type="text"
              value={data.NUMBER}
              onChange={e => set('NUMBER', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="MA-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geschlecht</label>
            <select
              value={data.SEX}
              onChange={e => set('SEX', Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value={0}>Keine Angabe</option>
              <option value={1}>Männlich</option>
              <option value={2}>Weiblich</option>
              <option value={3}>Divers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Funktion / Stelle</label>
            <input
              type="text"
              value={data.FUNCTION}
              onChange={e => set('FUNCTION', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="z.B. Pflegehelfer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={data.EMAIL}
              onChange={e => set('EMAIL', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="max@beispiel.at"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              type="text"
              value={data.PHONE}
              onChange={e => set('PHONE', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+43 664 ..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
            <input
              type="date"
              value={data.BIRTHDAY}
              onChange={e => set('BIRTHDAY', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Eintrittsdatum</label>
            <input
              type="date"
              value={data.EMPSTART}
              onChange={e => set('EMPSTART', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Straße & Hausnummer</label>
            <input
              type="text"
              value={data.STREET}
              onChange={e => set('STREET', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Musterstraße 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
            <input
              type="text"
              value={data.ZIP}
              onChange={e => set('ZIP', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1010"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
            <input
              type="text"
              value={data.TOWN}
              onChange={e => set('TOWN', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Wien"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Work time model ───────────────────────────────────────────────────

interface WorktimeData {
  HRSDAY: number;
  HRSWEEK: number;
  HRSMONTH: number;
  WORKDAYS: string; // "1 1 1 1 1 0 0 0" — Mon Tue Wed Thu Fri Sat Sun (8 slots)
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function Step2Worktime({ data, onChange }: { data: WorktimeData; onChange: (d: WorktimeData) => void }) {
  const workdayArr = data.WORKDAYS.split(' ').map(Number);

  const toggleDay = (idx: number) => {
    const arr = [...workdayArr];
    arr[idx] = arr[idx] ? 0 : 1;
    const activeDays = arr.slice(0, 7).filter(Boolean).length;
    const hrsWeek = activeDays * data.HRSDAY;
    onChange({ ...data, WORKDAYS: arr.join(' '), HRSWEEK: hrsWeek, HRSMONTH: Math.round(hrsWeek * 4.33 * 10) / 10 });
  };

  const setHrsDay = (v: number) => {
    const activeDays = workdayArr.slice(0, 7).filter(Boolean).length;
    const hrsWeek = activeDays * v;
    onChange({ ...data, HRSDAY: v, HRSWEEK: hrsWeek, HRSMONTH: Math.round(hrsWeek * 4.33 * 10) / 10 });
  };

  // Preset buttons
  const applyPreset = (hd: number, days: number[]) => {
    const arr = Array(8).fill(0);
    days.forEach(d => { arr[d] = 1; });
    const hrsWeek = days.length * hd;
    onChange({ HRSDAY: hd, HRSWEEK: hrsWeek, HRSMONTH: Math.round(hrsWeek * 4.33 * 10) / 10, WORKDAYS: arr.join(' ') });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Arbeitszeitmodell</h3>

      {/* Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Schnellwahl</label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Vollzeit (Mo–Fr, 8h)', hd: 8, days: [0,1,2,3,4] },
            { label: '38,5h (Mo–Fr, 7,7h)', hd: 7.7, days: [0,1,2,3,4] },
            { label: 'Teilzeit 20h (Mo–Fr, 4h)', hd: 4, days: [0,1,2,3,4] },
            { label: '3-Tage (Mo/Mi/Fr, 8h)', hd: 8, days: [0,2,4] },
            { label: 'Wochenenddienst (Sa/So, 8h)', hd: 8, days: [5,6] },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.hd, p.days)}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors text-gray-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workdays toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Arbeitstage</label>
        <div className="flex gap-2">
          {WEEKDAY_LABELS.map((lbl, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`w-12 h-12 rounded-lg font-bold text-sm transition-all border-2
                ${workdayArr[i] ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-500 border-gray-300 hover:border-blue-300'}`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Hours */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stunden/Tag</label>
          <input
            type="number"
            value={data.HRSDAY}
            onChange={e => setHrsDay(Number(e.target.value))}
            step="0.5"
            min="0"
            max="24"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stunden/Woche</label>
          <input
            type="number"
            value={data.HRSWEEK}
            onChange={e => onChange({ ...data, HRSWEEK: Number(e.target.value), HRSMONTH: Math.round(Number(e.target.value) * 4.33 * 10) / 10 })}
            step="0.5"
            min="0"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stunden/Monat</label>
          <input
            type="number"
            value={data.HRSMONTH}
            onChange={e => onChange({ ...data, HRSMONTH: Number(e.target.value) })}
            step="0.5"
            min="0"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <div className="font-semibold mb-1">📊 Übersicht</div>
        <div>
          Arbeitstage: {workdayArr.slice(0, 7).reduce((a, v) => a + v, 0)} Tage/Woche &bull;{' '}
          {data.HRSDAY ?? data.HRSDAY}h/Tag &bull; {data.HRSWEEK}h/Woche &bull; {data.HRSMONTH}h/Monat
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Groups ────────────────────────────────────────────────────────────

function Step3Groups({ groups, selectedGroups, onChange }: {
  groups: Group[];
  selectedGroups: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    if (selectedGroups.includes(id)) {
      onChange(selectedGroups.filter(g => g !== id));
    } else {
      onChange([...selectedGroups, id]);
    }
  };

  const visibleGroups = groups.filter(g => !g.HIDE);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Gruppen zuweisen</h3>
      <p className="text-sm text-gray-500">Wähle eine oder mehrere Gruppen, denen der Mitarbeiter angehören soll.</p>

      <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
        {visibleGroups.map(g => (
          <button
            key={g.ID}
            onClick={() => toggle(g.ID)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
              ${selectedGroups.includes(g.ID)
                ? 'bg-blue-50 border-blue-500 shadow-md'
                : 'bg-white border-gray-200 hover:border-blue-300'}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0
              ${selectedGroups.includes(g.ID) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {selectedGroups.includes(g.ID) ? '✓' : '👥'}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-800 truncate">{g.NAME}</div>
              <div className="text-xs text-gray-600">{g.SHORTNAME}{g.member_count !== undefined ? ` · ${g.member_count} MA` : ''}</div>
            </div>
          </button>
        ))}
      </div>

      {selectedGroups.length === 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          ⚠️ Kein Problem — Gruppen können später jederzeit zugewiesen werden.
        </div>
      )}
      {selectedGroups.length > 0 && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          ✅ {selectedGroups.length} Gruppe{selectedGroups.length > 1 ? 'n' : ''} ausgewählt
        </div>
      )}
    </div>
  );
}

// ── Step 4: Summary ───────────────────────────────────────────────────────────

function Step4Summary({ personal, worktime, groups, selectedGroups }: {
  personal: PersonalData;
  worktime: WorktimeData;
  groups: Group[];
  selectedGroups: number[];
}) {
  const selGroupNames = groups.filter(g => selectedGroups.includes(g.ID)).map(g => g.NAME);
  const workdayArr = worktime.WORKDAYS.split(' ').map(Number);
  const activeDays = ['Mo','Di','Mi','Do','Fr','Sa','So'].filter((_, i) => workdayArr[i]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Zusammenfassung</h3>
      <p className="text-sm text-gray-500">Bitte überprüfe die Angaben, bevor der Mitarbeiter angelegt wird.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 border">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">👤 Persönlich</div>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-500">Name:</span> <strong>{personal.FIRSTNAME} {personal.LASTNAME}</strong></div>
            {personal.SHORTNAME && <div><span className="text-gray-500">Kürzel:</span> <code className="bg-gray-200 px-1 rounded">{personal.SHORTNAME}</code></div>}
            {personal.NUMBER && <div><span className="text-gray-500">Personalnr.:</span> {personal.NUMBER}</div>}
            {personal.FUNCTION && <div><span className="text-gray-500">Funktion:</span> {personal.FUNCTION}</div>}
            {personal.EMAIL && <div><span className="text-gray-500">E-Mail:</span> {personal.EMAIL}</div>}
            {personal.PHONE && <div><span className="text-gray-500">Telefon:</span> {personal.PHONE}</div>}
            {personal.EMPSTART && <div><span className="text-gray-500">Eintritt:</span> {personal.EMPSTART}</div>}
            {personal.BIRTHDAY && <div><span className="text-gray-500">Geburtstag:</span> {personal.BIRTHDAY}</div>}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">⚙️ Arbeitszeit</div>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-500">Tage:</span> {activeDays.join(', ') || '—'}</div>
            <div><span className="text-gray-500">Std/Tag:</span> {worktime.HRSDAY}h</div>
            <div><span className="text-gray-500">Std/Woche:</span> {worktime.HRSWEEK}h</div>
            <div><span className="text-gray-500">Std/Monat:</span> {worktime.HRSMONTH}h</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="text-xs font-semibold text-gray-500 uppercase mb-3">👥 Gruppen</div>
        {selGroupNames.length === 0
          ? <span className="text-sm text-gray-600">Keine Gruppen ausgewählt</span>
          : <div className="flex flex-wrap gap-2">
              {selGroupNames.map(n => (
                <span key={n} className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">{n}</span>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── Main wizard component ─────────────────────────────────────────────────────

const defaultPersonal: PersonalData = {
  LASTNAME: '', FIRSTNAME: '', SHORTNAME: '', NUMBER: '', SEX: 0,
  EMAIL: '', PHONE: '', BIRTHDAY: '', EMPSTART: '', FUNCTION: '',
  STREET: '', ZIP: '', TOWN: '',
};

const defaultWorktime: WorktimeData = {
  HRSDAY: 8, HRSWEEK: 40, HRSMONTH: 173, WORKDAYS: '1 1 1 1 1 0 0 0',
};

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState<PersonalData>(defaultPersonal);
  const [worktime, setWorktime] = useState<WorktimeData>(defaultWorktime);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: number; name: string } | null>(null);
  const [lastnameBlurred, setLastnameBlurred] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.getGroups().then((d: any[]) => setGroups(d)).catch(() => {});
  }, []);

  const canProceed = () => {
    if (step === 0) return personal.LASTNAME.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        NAME: personal.LASTNAME.trim(),
        FIRSTNAME: personal.FIRSTNAME.trim(),
        SHORTNAME: personal.SHORTNAME.trim(),
        NUMBER: personal.NUMBER.trim(),
        SEX: personal.SEX,
        EMAIL: personal.EMAIL.trim(),
        PHONE: personal.PHONE.trim(),
        BIRTHDAY: personal.BIRTHDAY || '',
        EMPSTART: personal.EMPSTART || '',
        FUNCTION: personal.FUNCTION.trim(),
        STREET: personal.STREET.trim(),
        ZIP: personal.ZIP.trim(),
        TOWN: personal.TOWN.trim(),
        HRSDAY: worktime.HRSDAY,
        HRSWEEK: worktime.HRSWEEK,
        HRSMONTH: worktime.HRSMONTH,
        WORKDAYS: worktime.WORKDAYS,
      };
      const res = await api.createEmployee(payload) as { ok: boolean; record: { ID: number; NAME: string; FIRSTNAME: string } };
      const empId = (res.record as { ID: number }).ID;

      // Add to groups
      for (const gid of selectedGroups) {
        try { await api.addGroupMember(gid, empId); } catch (_e) { /* ignore */ }
      }

      setDone({ id: empId, name: `${personal.FIRSTNAME} ${personal.LASTNAME}`.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Onboarding abgeschlossen!</h2>
          <p className="text-gray-600 mb-6">
            <strong>{done.name}</strong> wurde erfolgreich angelegt und den ausgewählten Gruppen zugewiesen.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(`/mitarbeiter/${done.id}`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              👤 Mitarbeiter-Profil öffnen
            </button>
            <button
              onClick={() => {
                setDone(null);
                setStep(0);
                setPersonal(defaultPersonal);
                setWorktime(defaultWorktime);
                setSelectedGroups([]);
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              ➕ Weiteren Mitarbeiter anlegen
            </button>
            <button
              onClick={() => navigate('/employees')}
              className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
            >
              📋 Zur Mitarbeiterliste
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🧭 Onboarding-Wizard</h1>
          <p className="text-gray-500 mt-1">Neuen Mitarbeiter in wenigen Schritten einrichten</p>
        </div>

        <StepBar current={step} />

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 min-h-[400px] flex flex-col">
          <div className="flex-1">
            {step === 0 && <Step1Personal data={personal} onChange={setPersonal} lastnameBlurred={lastnameBlurred} onLastnameBlur={() => setLastnameBlurred(true)} />}
            {step === 1 && <Step2Worktime data={worktime} onChange={setWorktime} />}
            {step === 2 && <Step3Groups groups={groups} selectedGroups={selectedGroups} onChange={setSelectedGroups} />}
            {step === 3 && <Step4Summary personal={personal} worktime={worktime} groups={groups} selectedGroups={selectedGroups} />}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              ❌ {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
            >
              ← Zurück
            </button>

            <div className="text-sm text-gray-600">Schritt {step + 1} von {STEPS.length}</div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Weiter →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-8 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {saving ? '⏳ Wird gespeichert...' : '✅ Mitarbeiter anlegen'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
