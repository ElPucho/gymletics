'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Moon,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScreenHeader, SectionTitle } from './shared';
import { isGymleticsData } from '@/lib/gymletics/db';
import { exportBackup, exportCsv, exportExcel, exportPdf, importWorkbook } from '@/lib/gymletics/io';
import type { GymleticsData } from '@/lib/gymletics/types';

export function SettingsScreen({
  data,
  updateData,
  onBack,
}: {
  data: GymleticsData;
  updateData: (updater: GymleticsData | ((current: GymleticsData) => GymleticsData)) => void;
  onBack: () => void;
}) {
  const [storageText, setStorageText] = useState('Calculando…');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const historyInput = useRef<HTMLInputElement>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.estimate().then((estimate) => {
      const used = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      setStorageText(`${formatBytes(used)} usados${quota ? ` de ${formatBytes(quota)}` : ''}`);
    }).catch(() => setStorageText('Datos guardados en este dispositivo'));
  }, [data]);

  async function importHistory(file?: File) {
    if (!file) return;
    setBusy(true);
    setStatus('Leyendo el historial…');
    try {
      const sessions = await importWorkbook(file, data.activePlanId);
      const existing = new Set(data.sessions.map((session) => `${session.date}|${session.dayName}|${session.exercises.length}`));
      const fresh = sessions.filter((session) => !existing.has(`${session.date}|${session.dayName}|${session.exercises.length}`));
      updateData((current) => ({
        ...current,
        sessions: [...fresh, ...current.sessions].sort((a, b) => b.date.localeCompare(a.date)),
        calendarMarks: [
          ...current.calendarMarks.filter((mark) => !fresh.some((session) => session.date === mark.date)),
          ...fresh.map((session) => ({ date: session.date, status: 'completed' as const })),
        ],
      }));
      setStatus(`${fresh.length} sesiones nuevas importadas. ${sessions.length - fresh.length} duplicadas se omitieron.`);
    } catch (error) {
      setStatus(`No se pudo importar: ${error instanceof Error ? error.message : 'formato no reconocido'}`);
    } finally {
      setBusy(false);
      if (historyInput.current) historyInput.current.value = '';
    }
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const candidate = parsed && typeof parsed === 'object' && 'data' in parsed ? (parsed as { data: unknown }).data : parsed;
      if (!isGymleticsData(candidate)) throw new Error('La copia no contiene datos válidos de Gymletics.');
      if (!window.confirm('La restauración sustituirá los datos actuales de este dispositivo. ¿Continuar?')) return;
      updateData(candidate);
      setStatus('Copia restaurada correctamente.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo restaurar la copia.');
    } finally {
      setBusy(false);
      if (restoreInput.current) restoreInput.current.value = '';
    }
  }

  async function runExport(action: () => Promise<void> | void, message: string) {
    setBusy(true);
    try { await action(); setStatus(message); } catch (error) { setStatus(`No se pudo exportar: ${error instanceof Error ? error.message : 'error desconocido'}`); } finally { setBusy(false); }
  }

  return (
    <div className="pb-12">
      <ScreenHeader title="Ajustes" subtitle="Privacidad y datos" onBack={onBack} />
      <div className="space-y-6 px-4 pt-5">
        {status ? <div className="flex items-start gap-2 rounded-[18px] bg-black p-3 text-white"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><p className="text-xs leading-relaxed">{status}</p></div> : null}

        <section>
          <SectionTitle eyebrow="Aspecto" title="Tema" />
          <Card className="rounded-[22px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="grid grid-cols-2 gap-2 px-3"><button type="button" onClick={() => updateData((current) => ({ ...current, settings: { ...current.settings, theme: 'light' } }))} className={`flex items-center gap-3 rounded-[16px] p-3 text-left ring-1 ${data.settings.theme === 'light' ? 'bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white' : 'ring-black/8 dark:ring-white/10'}`}><Sun className="size-4" /><span className="text-sm font-bold">Claro</span></button><button type="button" onClick={() => updateData((current) => ({ ...current, settings: { ...current.settings, theme: 'dark' } }))} className={`flex items-center gap-3 rounded-[16px] p-3 text-left ring-1 ${data.settings.theme === 'dark' ? 'bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white' : 'ring-black/8 dark:ring-white/10'}`}><Moon className="size-4" /><span className="text-sm font-bold">Oscuro</span></button></CardContent></Card>
        </section>

        <section>
          <SectionTitle eyebrow="Migración inicial" title="Importar Google Sheets" />
          <Card className="rounded-[22px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-4"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eeeeea] dark:bg-white/10"><FileSpreadsheet className="size-4" /></div><div><p className="text-sm font-extrabold">Histórico de entrenamientos</p><p className="mt-1 text-xs leading-relaxed text-black/45 dark:text-white/45">Descarga tu hoja de Google como Excel y selecciónala aquí. Gymletics reconoce las hojas Sesiones, Registros y Series_DB.</p></div></div><Input ref={historyInput} type="file" accept=".xlsx,.xls,.csv" className="mt-4 h-11" onChange={(event) => importHistory(event.target.files?.[0])} disabled={busy} /></CardContent></Card>
        </section>

        <section>
          <SectionTitle eyebrow="Todo el dispositivo" title="Copia y restauración" />
          <Card className="rounded-[22px] bg-black py-4 text-white ring-0"><CardContent className="px-4"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="size-4" /><p className="text-sm font-extrabold">Copia completa</p></div><p className="mt-2 text-xs leading-relaxed text-white/45">Incluye planes, sesiones, calendario, mediciones, ajustes y fotografías.</p></div><Badge className="bg-white/12 text-white">Local</Badge></div><div className="mt-4 grid grid-cols-2 gap-2"><Button className="rounded-full bg-white text-black hover:bg-white/90" onClick={() => runExport(() => exportBackup(data), 'Copia completa descargada.')} disabled={busy}><Download /> Descargar</Button><Button variant="outline" className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20" onClick={() => restoreInput.current?.click()} disabled={busy}><Upload /> Restaurar</Button></div><Input ref={restoreInput} type="file" accept=".json" className="hidden" onChange={(event) => restoreBackup(event.target.files?.[0])} /></CardContent></Card>
        </section>

        <section>
          <SectionTitle eyebrow="Informes" title="Exportar datos" />
          <div className="space-y-2">
            <ExportRow icon={FileSpreadsheet} title="Excel" description="Libro con sesiones, series y mediciones" onClick={() => runExport(() => exportExcel(data), 'Archivo Excel descargado.')} disabled={busy} />
            <ExportRow icon={Database} title="CSV" description="Todas las series en formato tabular" onClick={() => runExport(() => exportCsv(data), 'Archivo CSV descargado.')} disabled={busy} />
            <ExportRow icon={FileJson} title="PDF" description="Resumen imprimible del progreso" onClick={() => runExport(() => exportPdf(data), 'Informe PDF descargado.')} disabled={busy} />
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Almacenamiento" title="Solo en este iPhone" />
          <Card className="rounded-[22px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="space-y-4 px-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-[#eeeeea] dark:bg-white/10"><HardDrive className="size-4" /></div><div className="flex-1"><p className="text-sm font-extrabold">{storageText}</p><p className="mt-0.5 text-xs text-black/45 dark:text-white/45">Sin cuentas, sincronización ni recordatorios</p></div></div><div className="rounded-[16px] bg-black/4 p-3 text-xs leading-relaxed text-black/55 dark:bg-white/6 dark:text-white/55">Borrar los datos de Safari o eliminar la aplicación puede borrar el historial. Descarga una copia completa periódicamente.</div></CardContent></Card>
        </section>

        <section>
          <SectionTitle eyebrow="Instalación" title="Añadir al inicio" />
          <Card className="rounded-[22px] bg-[#deded9] py-4 ring-0 dark:bg-white/10"><CardContent className="px-4"><div className="flex items-start gap-3"><Smartphone className="mt-0.5 size-5 shrink-0" /><div><p className="text-sm font-extrabold">Instala Gymletics como aplicación</p><ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-black/55 dark:text-white/55"><li>1. Abre Gymletics en Safari.</li><li>2. Pulsa <Share2 className="mx-1 inline size-3" /> Compartir.</li><li>3. Elige “Añadir a pantalla de inicio”.</li></ol></div></div></CardContent></Card>
        </section>

        <div className="pb-4 text-center"><p className="brand-wordmark text-sm font-black tracking-[0.15em]">GYMLETICS</p><p className="mt-1 text-[10px] font-semibold text-black/35 dark:text-white/35">Versión 1.0 · Datos privados en el dispositivo</p></div>
      </div>
    </div>
  );
}

function ExportRow({ icon: Icon, title, description, onClick, disabled }: { icon: typeof FileSpreadsheet; title: string; description: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-black/6 disabled:opacity-50 dark:bg-[#1c1c1c] dark:ring-white/10"><div className="grid size-9 place-items-center rounded-full bg-[#eeeeea] dark:bg-white/10"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{title}</p><p className="truncate text-xs text-black/45 dark:text-white/45">{description}</p></div><ChevronRight className="size-4 text-black/25 dark:text-white/25" /></button>;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB';
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
