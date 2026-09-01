import { uid } from './defaults';
import type { GymleticsData, SetLog, WeightUnit, WorkoutSession } from './types';
import { formatWeight } from './weight-format';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBackup(data: GymleticsData) {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Gymletics', data }, null, 2);
  downloadBlob(new Blob([payload], { type: 'application/json' }), `gymletics-copia-${today()}.json`);
}

function rowsFromData(data: GymleticsData) {
  return data.sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({
        Sesion_ID: session.id,
        Fecha: session.date,
        Plan: session.planName,
        Dia: session.dayName,
        Enfoque: session.focus,
        Ejercicio: exercise.exerciseName,
        Grupo_muscular: exercise.muscleGroup,
        Tipo_serie: set.type,
        Serie: set.index + 1,
        Peso: set.weight,
        Unidad: exercise.unit,
        Repeticiones: set.reps,
        Completada: set.completed ? 'Sí' : 'No',
        Rest_pause_1: exercise.restPause?.[0] ?? '',
        Rest_pause_2: exercise.restPause?.[1] ?? '',
        Cardio_min: session.cardioMinutes,
      })),
    ),
  );
}

export function exportCsv(data: GymleticsData) {
  const rows = rowsFromData(data);
  const headers = Object.keys(rows[0] ?? { Mensaje: 'Sin sesiones registradas' });
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(';'), ...rows.map((row) => headers.map((header) => escape(row[header as keyof typeof row])).join(';'))].join('\r\n');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `gymletics-series-${today()}.csv`);
}

export async function exportExcel(data: GymleticsData) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sessions = data.sessions.map((session) => ({
    Sesion_ID: session.id,
    Fecha: session.date,
    Plan: session.planName,
    Dia: session.dayName,
    Enfoque: session.focus,
    Estado: session.status,
    Cardio_min: session.cardioMinutes,
    Inicio: session.startedAt,
    Fin: session.completedAt ?? '',
  }));
  const records = data.sessions.flatMap((session) => session.exercises.map((exercise) => ({
    Sesion_ID: session.id,
    Fecha: session.date,
    Dia: session.dayName,
    Ejercicio: exercise.exerciseName,
    Grupo_muscular: exercise.muscleGroup,
    Series_objetivo: exercise.targetSets,
    Reps_objetivo: exercise.targetReps,
    Tecnica: exercise.technique,
    Rest_pause_1: exercise.restPause?.[0] ?? '',
    Rest_pause_2: exercise.restPause?.[1] ?? '',
  })));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sessions), 'Sesiones');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records), 'Registros');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsFromData(data)), 'Series_DB');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.bodyMetrics), 'Mediciones');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.calendarMarks), 'Calendario');
  XLSX.writeFile(workbook, `gymletics-${today()}.xlsx`, { compression: true });
}

export async function exportPdf(data: GymleticsData) {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ unit: 'mm', format: 'a4' });
  const completed = data.sessions.filter((session) => session.status === 'completed');
  const latestBody = [...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0];
  let y = 22;
  document.setFillColor(8, 8, 8);
  document.rect(0, 0, 210, 42, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(25);
  document.text('GYMLETICS', 16, 22);
  document.setFontSize(10);
  document.setFont('helvetica', 'normal');
  document.text('INFORME DE PROGRESO', 16, 31);
  y = 56;
  document.setTextColor(20, 20, 20);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text('Resumen', 16, y);
  y += 9;
  document.setFont('helvetica', 'normal');
  document.setFontSize(10);
  document.text(`Sesiones completadas: ${completed.length}`, 16, y);
  document.text(`Minutos de cardio: ${completed.reduce((sum, session) => sum + session.cardioMinutes, 0)}`, 16, y + 6);
  document.text(`Planes guardados: ${data.plans.length}`, 16, y + 12);
  if (latestBody) document.text(`Última medición: ${formatWeight(latestBody.weight)} kg · grasa ${latestBody.fatPercent}% · músculo ${latestBody.musclePercent}%`, 16, y + 18);
  y += 32;
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text('Sesiones recientes', 16, y);
  y += 8;
  document.setFontSize(9);
  for (const session of [...completed].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)) {
    if (y > 277) { document.addPage(); y = 18; }
    document.setFont('helvetica', 'bold');
    document.text(`${session.date} · ${cleanPdfText(session.dayName)} · ${cleanPdfText(session.focus)}`, 16, y);
    document.setFont('helvetica', 'normal');
    document.text(`${session.exercises.length} ejercicios · ${session.cardioMinutes} min cardio`, 16, y + 5);
    y += 12;
  }
  document.save(`gymletics-informe-${today()}.pdf`);
}

function cleanPdfText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rowMap(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + value);
    return epoch.toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parts = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  return today();
}

function inferUnit(value: unknown): WeightUnit {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('lado')) return 'kg/lado';
  if (text.includes('manc')) return 'kg/mancuerna';
  if (text.includes('corporal')) return 'peso corporal';
  return 'kg';
}

export async function importWorkbook(file: File, activePlanId: string): Promise<WorkoutSession[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => normalizeKey(name) === 'seriesdb') ?? workbook.SheetNames.find((name) => normalizeKey(name).includes('serie')) ?? workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
  const rows = rawRows.map(rowMap);
  if (!rows.length) return [];

  const sessionRows = workbook.SheetNames.find((name) => normalizeKey(name) === 'sesiones');
  const sessionMeta = new Map<string, Record<string, unknown>>();
  if (sessionRows) {
    const metaRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sessionRows], { defval: '' }).map(rowMap);
    for (const row of metaRows) {
      const date = dateValue(pick(row, ['fecha', 'date']));
      const day = String(pick(row, ['dia', 'día', 'day', 'sesion']) ?? 'Entrenamiento');
      const id = String(pick(row, ['sesion_id', 'session_id', 'id_sesion', 'id']) ?? `${date}-${day}`);
      sessionMeta.set(id, row);
      sessionMeta.set(`${date}-${day}`, row);
    }
  }

  type ExerciseBucket = { name: string; muscle: string; unit: WeightUnit; sets: SetLog[]; rp: [number, number]; technique: 'normal' | 'rest-pause' };
  type SessionBucket = { id: string; date: string; day: string; focus: string; exercises: Map<string, ExerciseBucket>; cardio: number };
  const buckets = new Map<string, SessionBucket>();

  for (const row of rows) {
    const date = dateValue(pick(row, ['fecha', 'date']));
    const day = String(pick(row, ['dia', 'día', 'day', 'nombre_dia']) ?? 'Entrenamiento');
    const sourceId = String(pick(row, ['sesion_id', 'session_id', 'id_sesion', 'sesion']) ?? `${date}-${day}`);
    const exerciseName = String(pick(row, ['ejercicio', 'exercise', 'nombre_ejercicio']) ?? '').trim();
    if (!exerciseName) continue;
    const key = sourceId || `${date}-${day}`;
    const meta = sessionMeta.get(key) ?? sessionMeta.get(`${date}-${day}`);
    const bucket = buckets.get(key) ?? {
      id: key,
      date,
      day,
      focus: String(pick(row, ['enfoque', 'focus', 'grupo']) ?? pick(meta ?? {}, ['enfoque', 'focus']) ?? ''),
      exercises: new Map<string, ExerciseBucket>(),
      cardio: numberValue(pick(meta ?? {}, ['cardio_min', 'cardio', 'minutos_cardio'])),
    };
    const exerciseKey = normalizeKey(exerciseName);
    const exercise = bucket.exercises.get(exerciseKey) ?? {
      name: exerciseName,
      muscle: String(pick(row, ['grupo_muscular', 'musculo', 'grupo']) ?? 'General'),
      unit: inferUnit(pick(row, ['unidad', 'unit'])),
      sets: [],
      rp: [0, 0],
      technique: 'normal',
    };
    const type = String(pick(row, ['tipo_serie', 'tipo', 'set_type']) ?? '').toLowerCase();
    const seriesLabel = String(pick(row, ['serie', 'set', 'numero_serie']) ?? exercise.sets.length + 1).toLowerCase();
    const reps = numberValue(pick(row, ['repeticiones', 'reps', 'rep']));
    if (type.includes('rest') || seriesLabel.includes('rp') || seriesLabel.includes('rest')) {
      exercise.technique = 'rest-pause';
      const position = seriesLabel.includes('2') || exercise.rp[0] > 0 ? 1 : 0;
      exercise.rp[position] = reps;
    } else {
      exercise.sets.push({
        id: uid('set'),
        index: Math.max(0, numberValue(seriesLabel) - 1 || exercise.sets.length),
        type: type.includes('calent') || type.includes('warm') ? 'warmup' : 'work',
        weight: numberValue(pick(row, ['peso', 'peso_kg', 'carga', 'weight'])),
        reps,
        completed: !['no', 'false', '0'].includes(String(pick(row, ['completada', 'completado', 'completed']) ?? 'sí').toLowerCase()),
      });
    }
    bucket.exercises.set(exerciseKey, exercise);
    buckets.set(key, bucket);
  }

  return [...buckets.values()].map((bucket) => ({
    id: `import_${normalizeKey(bucket.id)}_${uid('s')}`,
    planId: activePlanId,
    planName: 'Histórico importado',
    dayId: `import_${normalizeKey(bucket.day)}`,
    dayName: bucket.day,
    focus: bucket.focus,
    date: bucket.date,
    startedAt: `${bucket.date}T12:00:00.000Z`,
    completedAt: `${bucket.date}T13:00:00.000Z`,
    status: 'completed' as const,
    cardioMinutes: bucket.cardio,
    exercises: [...bucket.exercises.values()].map((exercise) => {
      const workSets = exercise.sets.filter((set) => set.type === 'work');
      return {
        id: uid('log'),
        planExerciseId: `import_${normalizeKey(bucket.day)}_${normalizeKey(exercise.name)}`,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscle,
        unit: exercise.unit,
        targetSets: workSets.length || 4,
        targetReps: Math.max(1, ...workSets.map((set) => set.reps)),
        technique: exercise.technique,
        sets: exercise.sets,
        restPause: exercise.rp[0] || exercise.rp[1] ? exercise.rp : undefined,
      };
    }),
  }));
}
