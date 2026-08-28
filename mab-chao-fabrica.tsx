import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cog, ClipboardList, Wrench, Users, History, Plus, Check, X, ChevronRight,
  Search, Trash2, PenTool, Package, Truck, Sparkles, Ruler, AlertCircle,
  CheckCircle2, Clock, ArrowLeft, Save, FileText, Building2, RotateCcw, Printer
} from 'lucide-react';
import { supabase } from './src/supabase';
/* ---------------------------------------------------------------------- */
/* CONSTANTES / TEMPLATES — o "padrão" que já vem pré-preenchido           */
/* ---------------------------------------------------------------------- */

const DEFAULT_MODELOS = ['06538', '06550', '06343', '1418', 'IVECO', '15190', '1721', 'Accelo', 'VW 13-180'];
const DEFAULT_CLIENTES = ['Transunião'];

const ETAPAS_TEMPLATE = [
  {
    id: 'desmontagem', numero: '01', nome: 'Desmontagem e Triagem', codigo: 'IT-OPE 01', icon: Wrench,
    itens: ['Desmontagem mecânica', 'Classificação: Aprovado para remanufatura'],
  },
  {
    id: 'limpeza', numero: '02', nome: 'Preparação e Limpeza', codigo: 'IT-OPE 02', icon: Sparkles,
    itens: ['Limpeza química (Desengraxe)', 'Jateamento técnico (Áreas críticas protegidas)', 'Inspeção pós-limpeza (Ausência de microfissuras)'],
    temConferenciaMedidas: true,
  },
  {
    id: 'usinagem', numero: '03', nome: 'Usinagem e Ajuste de Precisão', codigo: 'IT-OPE 03', icon: Ruler,
    itens: ['Retificado da placa de pressão concluído'],
    medicoes: [{ refLabel: 'Medição ref.', refValor: '42,7 MAX' }],
  },
  {
    id: 'montagem', numero: '04', nome: 'Montagem e Testes de Conjunto', codigo: 'IT-OPE 04', icon: Package,
    itens: ['Revestimentos novos instalados e rebitados', 'Fechamento do platô concluído', 'Teste dinamométrico (Curva de carga OK)'],
    medicoes: [{ refLabel: 'Altura máx.', refValor: '62,5' }, { refLabel: 'Pressão', refValor: '550' }],
  },
  {
    id: 'expedicao', numero: '05', nome: 'Expedição e Logística', codigo: 'IT-OPE 05', icon: Truck,
    itens: ['Inspeção visual final (Sem oxidação/danos)', 'Proteção anticorrosiva (VCI) aplicada', 'Etiqueta de rastreabilidade fixada'],
  },
];

const CONFERENCIA_RECEBIMENTO_ITEMS = ['Quantidade conferida', 'Modelo identificado corretamente', 'Material sem mistura de modelos'];
const INSPECAO_VISUAL_ITEMS = [
  'Ausência de trincas visíveis', 'Ausência de deformações severas', 'Ausência de corrosão excessiva',
  'Ausência de soldas inadequadas', 'Condição geral aceitável para desmontagem',
];

/* ---------------------------------------------------------------------- */
/* HELPERS                                                                 */
/* ---------------------------------------------------------------------- */

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTimeISO = () => {
  const d = new Date();
  return `${todayISO()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const sugerirNumeroOP = (codigo) => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}${codigo || ''}-1/1`;
};

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error('Erro ao salvar', key, e);
  }
}

/* ---------------------------------------------------------------------- */
/* COMPONENTES BASE                                                        */
/* ---------------------------------------------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
      .font-display { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
      .font-body { font-family: 'Inter', sans-serif; }
      @media print {
        .no-print { display: none !important; }
        .print-area { padding: 0 !important; margin: 0 !important; }
      }
    `}</style>
  );
}

function SectionCard({ title, subtitle, icon: Icon, numero, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        {numero && (
          <span className="font-display text-xl text-amber-600 w-8">{numero}</span>
        )}
        {Icon && <Icon size={18} className="text-slate-500" />}
        <div>
          <h3 className="font-display text-sm uppercase tracking-wide text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500";

function ChecklistItemRow({ desc, status, onStatusChange, posLabel = 'OK', negLabel = 'NOK' }) {
  const isPos = status !== 'neg';
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-700 flex-1">{desc}</span>
        <div className="flex rounded-lg overflow-hidden border border-slate-300 shrink-0">
          <button
            type="button"
            onClick={() => onStatusChange('pos')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${isPos ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'}`}
          >
            {posLabel}
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('neg')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${!isPos ? 'bg-red-600 text-white' : 'bg-white text-slate-400'}`}
          >
            {negLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(true);

  const ctx = () => canvasRef.current.getContext('2d');

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = getPos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const c = ctx();
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.strokeStyle = '#1e293b';
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(pos.x, pos.y);
    c.stroke();
    last.current = pos;
    setEmpty(false);
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    ctx().clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setEmpty(true);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg touch-none"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-500 px-3 py-1.5 border border-slate-300 rounded-lg">
          <RotateCcw size={13} /> Limpar
        </button>
        <button
          type="button"
          disabled={empty}
          onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}
          className="flex items-center gap-1 text-xs text-white px-3 py-1.5 bg-slate-800 rounded-lg disabled:opacity-30"
        >
          <Save size={13} /> Salvar assinatura
        </button>
      </div>
    </div>
  );
}

function OperadorPicker({ operadores, value, onChange, label = 'Operador responsável' }) {
  const op = operadores.find((o) => o.id === value);
  return (
    <Field label={label}>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Selecionar...</option>
        {operadores.map((o) => (
          <option key={o.id} value={o.id}>{o.nome}</option>
        ))}
      </select>
      {op && (
        <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
          <img src={op.assinatura} alt="assinatura" className="h-8 object-contain" />
          <span className="text-xs text-slate-400">visto de {op.nome}</span>
        </div>
      )}
    </Field>
  );
}

function StatusBadge({ children, tone }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-500',
    red: 'bg-red-100 text-red-700',
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}

/* ---------------------------------------------------------------------- */
/* NAV                                                                     */
/* ---------------------------------------------------------------------- */

function Sidebar({ view, setView }) {
  const items = [
    { id: 'home', label: 'Início', icon: Cog },
    { id: 'recebimento', label: 'Recebimento', icon: ClipboardList },
    { id: 'op', label: 'Ordem de Produção', icon: Wrench },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'operadores', label: 'Operadores', icon: Users },
  ];
  return (
    <div className="w-20 md:w-24 bg-slate-900 flex flex-col items-center py-4 shrink-0 no-print">
      <div className="mb-6 text-amber-500"><Cog size={26} /></div>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setView(it.id)}
          className={`flex flex-col items-center gap-1 w-full py-3 mb-1 transition-colors ${view === it.id ? 'text-amber-400' : 'text-slate-500'}`}
        >
          <it.icon size={20} />
          <span className="font-body text-[9px] leading-tight text-center px-1">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* HOME                                                                    */
/* ---------------------------------------------------------------------- */

function HomeView({ recebimentos, ops, setView, setDetalhe }) {
  const opsAbertas = ops.filter((o) => !o.liberacaoFinal?.status);
  const opsConcluidas = ops.filter((o) => o.liberacaoFinal?.status);
  const recentes = [
    ...recebimentos.map((r) => ({ tipo: 'recebimento', data: r.data, ref: r.fornecedorCliente, id: r.id })),
    ...ops.map((o) => ({ tipo: 'op', data: o.dataAbertura, ref: o.numeroOP, id: o.id })),
  ].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 6);

  return (
    <div className="font-body">
      <h1 className="font-display text-2xl text-slate-800 mb-1">Chão de Fábrica Digital</h1>
      <p className="text-sm text-slate-400 mb-6">MAB Embreagem · Registros ISO de remanufatura</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setView('recebimento')} className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-400 transition-colors">
          <ClipboardList className="text-amber-600 mb-2" size={22} />
          <div className="font-display text-sm text-slate-800">Novo Recebimento</div>
          <div className="text-xs text-slate-400">Checklist de triagem de carcaças</div>
        </button>
        <button onClick={() => setView('op')} className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-400 transition-colors">
          <Wrench className="text-amber-600 mb-2" size={22} />
          <div className="font-display text-sm text-slate-800">Nova Ordem de Produção</div>
          <div className="text-xs text-slate-400">5 etapas de remanufatura</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className="font-display text-2xl text-slate-800">{recebimentos.length}</div>
          <div className="text-[11px] text-slate-400 uppercase">Recebimentos</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className="font-display text-2xl text-amber-600">{opsAbertas.length}</div>
          <div className="text-[11px] text-slate-400 uppercase">OPs em andamento</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className="font-display text-2xl text-emerald-600">{opsConcluidas.length}</div>
          <div className="text-[11px] text-slate-400 uppercase">OPs concluídas</div>
        </div>
      </div>

      <h2 className="font-display text-sm uppercase text-slate-500 mb-2">Atividade recente</h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {recentes.length === 0 && <div className="p-4 text-sm text-slate-400">Nenhum registro ainda.</div>}
        {recentes.map((r, i) => (
          <button
            key={i}
            onClick={() => setDetalhe({ tipo: r.tipo, id: r.id })}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              {r.tipo === 'recebimento' ? <ClipboardList size={16} className="text-slate-400" /> : <Wrench size={16} className="text-slate-400" />}
              <div>
                <div className="text-sm text-slate-700">{r.tipo === 'recebimento' ? 'Recebimento' : 'OP'} · {r.ref || '—'}</div>
                <div className="text-xs text-slate-400">{fmtDate(r.data)}</div>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* OPERADORES                                                              */
/* ---------------------------------------------------------------------- */

function OperadoresView({ operadores, setOperadores }) {
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [assinatura, setAssinatura] = useState(null);
  const [adding, setAdding] = useState(false);

  const salvar = () => {
    if (!nome.trim() || !assinatura) return;
    const novo = { id: uid(), nome: nome.trim(), cargo: cargo.trim(), assinatura };
    setOperadores((prev) => [...prev, novo]);
    setNome(''); setCargo(''); setAssinatura(null); setAdding(false);
  };

  const remover = (id) => setOperadores((prev) => prev.filter((o) => o.id !== id));

  return (
    <div className="font-body max-w-xl">
      <h1 className="font-display text-2xl text-slate-800 mb-1">Operadores</h1>
      <p className="text-sm text-slate-400 mb-6">Cadastre uma vez — a assinatura fica salva e é usada em todos os registros.</p>

      <div className="space-y-2 mb-4">
        {operadores.map((o) => (
          <div key={o.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <img src={o.assinatura} className="h-10 w-20 object-contain bg-slate-50 rounded border border-slate-100" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-800">{o.nome}</div>
              <div className="text-xs text-slate-400">{o.cargo || 'Operador de produção'}</div>
            </div>
            <button onClick={() => remover(o.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
          </div>
        ))}
        {operadores.length === 0 && <p className="text-sm text-slate-400">Nenhum operador cadastrado ainda.</p>}
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <Plus size={16} /> Cadastrar operador
        </button>
      ) : (
        <SectionCard title="Novo operador" icon={PenTool}>
          <Field label="Nome" required><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João Dario" /></Field>
          <Field label="Função"><input className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Operador de desmontagem" /></Field>
          <Field label="Assinatura" required><SignaturePad onSave={setAssinatura} /></Field>
          {assinatura && <p className="text-xs text-emerald-600 mb-3">✓ Assinatura capturada</p>}
          <div className="flex gap-2">
            <button onClick={salvar} disabled={!nome.trim() || !assinatura} className="flex-1 bg-slate-800 disabled:opacity-30 text-white text-sm font-semibold py-2.5 rounded-lg">Salvar operador</button>
            <button onClick={() => { setAdding(false); setAssinatura(null); }} className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-500">Cancelar</button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* NOVO RECEBIMENTO                                                        */
/* ---------------------------------------------------------------------- */

function novoRecebimentoState() {
  return {
    id: uid(),
    data: todayISO(),
    fornecedorCliente: DEFAULT_CLIENTES[0],
    modelosRecebidos: [{ modelo: '', qtde: '' }],
    conferencia: CONFERENCIA_RECEBIMENTO_ITEMS.map((desc) => ({ desc, status: 'pos', obs: '' })),
    inspecao: INSPECAO_VISUAL_ITEMS.map((desc) => ({ desc, status: 'pos', obs: '' })),
    classe: 'B',
    naoConformidades: '',
    aprovadas: [{ modelo: '', qtde: '', lote: '' }],
    recebedorId: null,
    dataRecebedor: todayISO(),
  };
}

function RecebimentoForm({ operadores, modelos, clientes, onSalvar, onCancelar }) {
  const [f, setF] = useState(novoRecebimentoState);

  const upd = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const updList = (key, i, patch) => setF((prev) => {
    const list = [...prev[key]];
    list[i] = { ...list[i], ...patch };
    return { ...prev, [key]: list };
  });
  const addRow = (key, row) => setF((prev) => ({ ...prev, [key]: [...prev[key], row] }));
  const delRow = (key, i) => setF((prev) => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));

  const podeSalvar = f.fornecedorCliente.trim() && f.recebedorId;

  return (
    <div className="font-body max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancelar} className="p-1 text-slate-400"><ArrowLeft size={20} /></button>
        <h1 className="font-display text-2xl text-slate-800">Checklist de Recebimento e Triagem</h1>
      </div>

      <SectionCard title="Dados gerais" icon={Building2}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input type="date" className={inputCls} value={f.data} onChange={(e) => upd({ data: e.target.value })} /></Field>
          <Field label="Fornecedor / Cliente" required>
            <input list="clientes" className={inputCls} value={f.fornecedorCliente} onChange={(e) => upd({ fornecedorCliente: e.target.value })} />
            <datalist id="clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Modelos recebidos" icon={Package}>
        {f.modelosRecebidos.map((m, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input list="modelos" placeholder="Modelo" className={inputCls} value={m.modelo} onChange={(e) => updList('modelosRecebidos', i, { modelo: e.target.value })} />
            <input placeholder="Qtde" type="number" className={`${inputCls} w-24`} value={m.qtde} onChange={(e) => updList('modelosRecebidos', i, { qtde: e.target.value })} />
            <button onClick={() => delRow('modelosRecebidos', i)} className="text-slate-300 hover:text-red-500 px-1"><Trash2 size={16} /></button>
          </div>
        ))}
        <datalist id="modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
        <button onClick={() => addRow('modelosRecebidos', { modelo: '', qtde: '' })} className="text-xs font-semibold text-amber-700 flex items-center gap-1 mt-1"><Plus size={13} /> Adicionar modelo</button>
      </SectionCard>

      <SectionCard title="1. Conferência de recebimento" icon={CheckCircle2}>
        {f.conferencia.map((item, i) => (
          <ChecklistItemRow key={i} {...item} posLabel="Sim" negLabel="Não"
            onStatusChange={(s) => updList('conferencia', i, { status: s })} />
        ))}
      </SectionCard>

      <SectionCard title="2. Inspeção visual inicial" icon={Search}>
        {f.inspecao.map((item, i) => (
          <ChecklistItemRow key={i} {...item} posLabel="Conforme" negLabel="Não conf."
            onStatusChange={(s) => updList('inspecao', i, { status: s })} />
        ))}
      </SectionCard>

      <SectionCard title="5. Classificação da carcaça" icon={FileText}>
        <div className="flex gap-2">
          {[
            { v: 'A', l: 'Classe A · Reutilização imediata' },
            { v: 'B', l: 'Classe B · Necessita recuperação' },
            { v: 'C', l: 'Classe C · Sucata' },
          ].map((c) => (
            <button key={c.v} onClick={() => upd({ classe: c.v })}
              className={`flex-1 text-xs font-semibold py-3 rounded-lg border ${f.classe === c.v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'}`}>
              {c.l}
            </button>
          ))}
        </div>
        <Field label="Observações / não conformidades">
          <textarea className={inputCls} rows={2} value={f.naoConformidades} onChange={(e) => upd({ naoConformidades: e.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard title="Aprovadas (lotes gerados)" icon={ClipboardList}>
        {f.aprovadas.map((a, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input placeholder="Modelo" className={inputCls} value={a.modelo} onChange={(e) => updList('aprovadas', i, { modelo: e.target.value })} />
            <input placeholder="Qtde" type="number" className={`${inputCls} w-20`} value={a.qtde} onChange={(e) => updList('aprovadas', i, { qtde: e.target.value })} />
            <input placeholder="Lote" className={inputCls} value={a.lote} onChange={(e) => updList('aprovadas', i, { lote: e.target.value })} />
            <button onClick={() => delRow('aprovadas', i)} className="text-slate-300 hover:text-red-500 px-1"><Trash2 size={16} /></button>
          </div>
        ))}
        <button onClick={() => addRow('aprovadas', { modelo: '', qtde: '', lote: '' })} className="text-xs font-semibold text-amber-700 flex items-center gap-1 mt-1"><Plus size={13} /> Adicionar lote</button>
      </SectionCard>

      <SectionCard title="Recebedor" icon={PenTool}>
        <OperadorPicker operadores={operadores} value={f.recebedorId} onChange={(v) => upd({ recebedorId: v })} label="Recebido e conferido por" />
        <Field label="Data do recebedor"><input type="date" className={inputCls} value={f.dataRecebedor} onChange={(e) => upd({ dataRecebedor: e.target.value })} /></Field>
      </SectionCard>

      <div className="flex gap-2 sticky bottom-0 bg-slate-100 py-3">
        <button disabled={!podeSalvar} onClick={() => onSalvar(f)} className="flex-1 bg-amber-600 disabled:opacity-30 text-white font-display text-sm py-3 rounded-lg">Salvar registro</button>
        <button onClick={onCancelar} className="px-5 border border-slate-300 rounded-lg text-sm text-slate-500">Cancelar</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* NOVA OP                                                                  */
/* ---------------------------------------------------------------------- */

function novaOPState() {
  return {
    id: uid(),
    numeroOP: sugerirNumeroOP(''),
    dataAbertura: todayISO(),
    clienteOrigem: DEFAULT_CLIENTES[0],
    aplicacaoModelo: '',
    novaReman: 'REMAN',
    etapas: ETAPAS_TEMPLATE.map((t) => ({
      id: t.id,
      itens: t.itens.map((desc) => ({ desc, status: 'pos', obs: '' })),
      medicoes: (t.medicoes || []).map((m) => ({ refLabel: m.refLabel, refValor: m.refValor, valorMedido: '' })),
      conferenciaMedidas: t.temConferenciaMedidas ? '' : undefined,
      inicio: '',
      termino: '',
      operadorId: null,
    })),
    requisicoes: [{ setor: '', codigo: '', qtde: '', descricao: '', aprovacaoId: null }],
    observacoes: '',
    liberacao: { status: 'APROVADO', operadorId: null, data: todayISO() },
    lote: '',
  };
}

function EtapaBlock({ template, etapa, onChange, operadores }) {
  const Icon = template.icon;
  const updItem = (i, patch) => {
    const itens = [...etapa.itens];
    itens[i] = { ...itens[i], ...patch };
    onChange({ itens });
  };
  const updMed = (i, patch) => {
    const medicoes = [...etapa.medicoes];
    medicoes[i] = { ...medicoes[i], ...patch };
    onChange({ medicoes });
  };

  return (
    <SectionCard title={template.nome} subtitle={template.codigo} icon={Icon} numero={template.numero}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Início (data/hora)">
          <div className="flex gap-1">
            <input className={inputCls} value={etapa.inicio} onChange={(e) => onChange({ inicio: e.target.value })} placeholder="—" />
            <button type="button" onClick={() => onChange({ inicio: nowTimeISO() })} className="px-2 border border-slate-300 rounded-lg text-slate-400 shrink-0"><Clock size={16} /></button>
          </div>
        </Field>
        <Field label="Término (data/hora)">
          <div className="flex gap-1">
            <input className={inputCls} value={etapa.termino} onChange={(e) => onChange({ termino: e.target.value })} placeholder="—" />
            <button type="button" onClick={() => onChange({ termino: nowTimeISO() })} className="px-2 border border-slate-300 rounded-lg text-slate-400 shrink-0"><Clock size={16} /></button>
          </div>
        </Field>
      </div>

      {etapa.itens.map((item, i) => (
        <ChecklistItemRow key={i} {...item}
          onStatusChange={(s) => updItem(i, { status: s })} />
      ))}

      {etapa.conferenciaMedidas !== undefined && (
        <Field label="Conferência de medidas">
          <input className={inputCls} value={etapa.conferenciaMedidas} onChange={(e) => onChange({ conferenciaMedidas: e.target.value })} placeholder="Opcional" />
        </Field>
      )}

      <div className="mt-2 space-y-3">
        {etapa.medicoes.map((m, i) => (
          <div key={i} className="border border-slate-100 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-2">
              <input className="flex-1 text-xs font-medium text-slate-500 uppercase tracking-wide bg-transparent border-b border-slate-200 focus:outline-none focus:border-amber-500 py-1" value={m.refLabel} onChange={(e) => updMed(i, { refLabel: e.target.value })} placeholder="Nome da medição" />
              {etapa.medicoes.length > 1 && (
                <button type="button" onClick={() => onChange({ medicoes: etapa.medicoes.filter((_, idx) => idx !== i) })} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={15} /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Referência"><input className={inputCls} value={m.refValor} onChange={(e) => updMed(i, { refValor: e.target.value })} /></Field>
              <Field label="Valor medido"><input className={inputCls} value={m.valorMedido} onChange={(e) => updMed(i, { valorMedido: e.target.value })} placeholder="—" /></Field>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ medicoes: [...etapa.medicoes, { refLabel: 'Medição ref.', refValor: '', valorMedido: '' }] })} className="text-xs font-semibold text-amber-700 flex items-center gap-1">
          <Plus size={13} /> Adicionar medição
        </button>
      </div>

      <OperadorPicker operadores={operadores} value={etapa.operadorId} onChange={(v) => onChange({ operadorId: v })} label="Visto operador" />
    </SectionCard>
  );
}

function OPForm({ operadores, modelos, clientes, onSalvar, onCancelar }) {
  const [f, setF] = useState(novaOPState);

  const upd = (patch) => setF((p) => ({ ...p, ...patch }));
  const updEtapa = (idx, patch) => setF((p) => {
    const etapas = [...p.etapas];
    etapas[idx] = { ...etapas[idx], ...patch };
    return { ...p, etapas };
  });
  const updReq = (i, patch) => setF((p) => {
    const requisicoes = [...p.requisicoes];
    requisicoes[i] = { ...requisicoes[i], ...patch };
    return { ...p, requisicoes };
  });

  const podeSalvar = f.numeroOP.trim() && f.aplicacaoModelo.trim();

  return (
    <div className="font-body max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancelar} className="p-1 text-slate-400"><ArrowLeft size={20} /></button>
        <h1 className="font-display text-2xl text-slate-800">Ordem de Produção — Remanufatura</h1>
      </div>

      <SectionCard title="Dados da OP" icon={FileText}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nº da OP" required><input className={inputCls} value={f.numeroOP} onChange={(e) => upd({ numeroOP: e.target.value })} /></Field>
          <Field label="Data de abertura"><input type="date" className={inputCls} value={f.dataAbertura} onChange={(e) => upd({ dataAbertura: e.target.value })} /></Field>
          <Field label="Cliente / Origem">
            <input list="clientes-op" className={inputCls} value={f.clienteOrigem} onChange={(e) => upd({ clienteOrigem: e.target.value })} />
            <datalist id="clientes-op">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Aplicação / Modelo" required>
            <input list="modelos-op" className={inputCls} value={f.aplicacaoModelo} onChange={(e) => upd({ aplicacaoModelo: e.target.value, numeroOP: f.numeroOP.includes('-1/1') || !f.numeroOP ? sugerirNumeroOP(e.target.value) : f.numeroOP })} />
            <datalist id="modelos-op">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
        </div>
        <Field label="Nova / Reman">
          <div className="flex gap-2">
            {['NOVA', 'REMAN'].map((v) => (
              <button key={v} onClick={() => upd({ novaReman: v })} className={`flex-1 text-xs font-semibold py-2.5 rounded-lg border ${f.novaReman === v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'}`}>{v}</button>
            ))}
          </div>
        </Field>
      </SectionCard>

      {ETAPAS_TEMPLATE.map((t, idx) => (
        <EtapaBlock key={t.id} template={t} etapa={f.etapas[idx]} onChange={(patch) => updEtapa(idx, patch)} operadores={operadores} />
      ))}

      <SectionCard title="Observações / Não Conformidades" icon={AlertCircle}>
        <textarea className={inputCls} rows={2} value={f.observacoes} onChange={(e) => upd({ observacoes: e.target.value })} placeholder="Opcional" />
      </SectionCard>

      <SectionCard title="Requisição de material" icon={Package}>
        {f.requisicoes.map((r, i) => (
          <div key={i} className="border border-slate-100 rounded-lg p-2 mb-2">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input placeholder="Setor" className={inputCls} value={r.setor} onChange={(e) => updReq(i, { setor: e.target.value })} />
              <input placeholder="Código" className={inputCls} value={r.codigo} onChange={(e) => updReq(i, { codigo: e.target.value })} />
              <input placeholder="Qtde" type="number" className={inputCls} value={r.qtde} onChange={(e) => updReq(i, { qtde: e.target.value })} />
              <input placeholder="Descrição do material" className={inputCls} value={r.descricao} onChange={(e) => updReq(i, { descricao: e.target.value })} />
            </div>
            <OperadorPicker operadores={operadores} value={r.aprovacaoId} onChange={(v) => updReq(i, { aprovacaoId: v })} label="Aprovação / visto" />
          </div>
        ))}
        <button onClick={() => setF((p) => ({ ...p, requisicoes: [...p.requisicoes, { setor: '', codigo: '', qtde: '', descricao: '', aprovacaoId: null }] }))} className="text-xs font-semibold text-amber-700 flex items-center gap-1"><Plus size={13} /> Adicionar item</button>
      </SectionCard>

      <SectionCard title="Liberação final (Controle de Qualidade)" icon={CheckCircle2}>
        <div className="flex gap-2 mb-3">
          {[{ v: 'APROVADO', l: 'Aprovado para expedição' }, { v: 'REPROVADO', l: 'Reprovado / sucata' }].map((s) => (
            <button key={s.v} onClick={() => upd({ liberacao: { ...f.liberacao, status: s.v } })}
              className={`flex-1 text-xs font-semibold py-2.5 rounded-lg border ${f.liberacao.status === s.v ? (s.v === 'APROVADO' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-600 text-white border-red-600') : 'bg-white text-slate-500 border-slate-300'}`}>
              {s.l}
            </button>
          ))}
        </div>
        <OperadorPicker operadores={operadores} value={f.liberacao.operadorId} onChange={(v) => upd({ liberacao: { ...f.liberacao, operadorId: v } })} label="Assinatura de liberação" />
        <Field label="Lote"><input className={inputCls} value={f.lote || f.numeroOP} onChange={(e) => upd({ lote: e.target.value })} /></Field>
      </SectionCard>

      <div className="flex gap-2 sticky bottom-0 bg-slate-100 py-3">
        <button disabled={!podeSalvar} onClick={() => onSalvar({ ...f, lote: f.lote || f.numeroOP })} className="flex-1 bg-amber-600 disabled:opacity-30 text-white font-display text-sm py-3 rounded-lg">Salvar Ordem de Produção</button>
        <button onClick={onCancelar} className="px-5 border border-slate-300 rounded-lg text-sm text-slate-500">Cancelar</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* HISTÓRICO + DETALHE                                                     */
/* ---------------------------------------------------------------------- */

function HistoricoView({ recebimentos, ops, onAbrir }) {
  const [busca, setBusca] = useState('');
  const todos = [
    ...recebimentos.map((r) => ({ tipo: 'recebimento', id: r.id, data: r.data, titulo: r.fornecedorCliente, sub: `${r.modelosRecebidos.map(m => m.modelo).filter(Boolean).join(', ') || 'sem modelos'}`, tag: r.classe ? `Classe ${r.classe}` : '' })),
    ...ops.map((o) => ({ tipo: 'op', id: o.id, data: o.dataAbertura, titulo: o.numeroOP, sub: `${o.aplicacaoModelo} · ${o.novaReman}${o.liberacao?.status ? ` · concluída em ${fmtDate(o.liberacao.data)}` : ''}`, tag: o.liberacao?.status || 'Em andamento' })),
  ].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const filtrados = todos.filter((t) => `${t.titulo} ${t.sub}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="font-body max-w-2xl">
      <h1 className="font-display text-2xl text-slate-800 mb-4">Histórico</h1>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input className={`${inputCls} pl-9`} placeholder="Buscar por OP, lote, modelo, cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {filtrados.length === 0 && <div className="p-4 text-sm text-slate-400">Nenhum registro encontrado.</div>}
        {filtrados.map((t) => (
          <button key={`${t.tipo}-${t.id}`} onClick={() => onAbrir({ tipo: t.tipo, id: t.id })} className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50">
            <div className="flex items-center gap-3">
              {t.tipo === 'recebimento' ? <ClipboardList size={16} className="text-slate-400" /> : <Wrench size={16} className="text-slate-400" />}
              <div>
                <div className="text-sm font-medium text-slate-700">{t.titulo}</div>
                <div className="text-xs text-slate-400">{t.sub} · {fmtDate(t.data)}</div>
              </div>
            </div>
            <StatusBadge tone={t.tag === 'APROVADO' ? 'green' : t.tag === 'REPROVADO' ? 'red' : 'amber'}>{t.tag}</StatusBadge>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetalheView({ tipo, item, operadores, onVoltar }) {
  const opNome = (id) => operadores.find((o) => o.id === id)?.nome || '—';
  const opAssin = (id) => operadores.find((o) => o.id === id)?.assinatura;

  return (
    <div className="font-body max-w-2xl print-area">
      <div className="flex items-center justify-between mb-4 no-print">
        <div className="flex items-center gap-2">
          <button onClick={onVoltar} className="p-1 text-slate-400"><ArrowLeft size={20} /></button>
          <h1 className="font-display text-2xl text-slate-800">{tipo === 'recebimento' ? 'Recebimento' : 'Ordem de Produção'}</h1>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1 text-xs font-semibold text-slate-500 border border-slate-300 rounded-lg px-3 py-2"><Printer size={14} /> Imprimir / PDF</button>
      </div>

      {tipo === 'recebimento' ? (
        <>
          <SectionCard title="Dados gerais" icon={Building2}>
            <p className="text-sm text-slate-600">Data: {fmtDate(item.data)} · Fornecedor: {item.fornecedorCliente}</p>
          </SectionCard>
          <SectionCard title="Modelos recebidos" icon={Package}>
            {item.modelosRecebidos.map((m, i) => <p key={i} className="text-sm text-slate-600">{m.modelo} — {m.qtde} un.</p>)}
          </SectionCard>
          <SectionCard title="Conferência" icon={CheckCircle2}>
            {item.conferencia.map((c, i) => (
              <p key={i} className="text-sm text-slate-600 flex items-center gap-2">
                {c.status === 'pos' ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-red-600" />} {c.desc} {c.obs && <span className="text-red-500 text-xs">— {c.obs}</span>}
              </p>
            ))}
          </SectionCard>
          <SectionCard title="Inspeção visual" icon={Search}>
            {item.inspecao.map((c, i) => (
              <p key={i} className="text-sm text-slate-600 flex items-center gap-2">
                {c.status === 'pos' ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-red-600" />} {c.desc} {c.obs && <span className="text-red-500 text-xs">— {c.obs}</span>}
              </p>
            ))}
          </SectionCard>
          <SectionCard title="Classificação" icon={FileText}>
            <p className="text-sm text-slate-600">Classe {item.classe} {item.naoConformidades && `· Obs: ${item.naoConformidades}`}</p>
          </SectionCard>
          <SectionCard title="Lotes aprovados" icon={ClipboardList}>
            {item.aprovadas.filter(a => a.modelo).map((a, i) => <p key={i} className="text-sm text-slate-600">{a.modelo} · {a.qtde} un. · Lote {a.lote}</p>)}
          </SectionCard>
          <SectionCard title="Recebedor" icon={PenTool}>
            <div className="flex items-center gap-2">
              {opAssin(item.recebedorId) && <img src={opAssin(item.recebedorId)} className="h-10" />}
              <span className="text-sm text-slate-600">{opNome(item.recebedorId)} · {fmtDate(item.dataRecebedor)}</span>
            </div>
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title="Dados da OP" icon={FileText}>
            <p className="text-sm text-slate-600">Nº {item.numeroOP} · {fmtDate(item.dataAbertura)} · {item.clienteOrigem} · {item.aplicacaoModelo} · {item.novaReman}</p>
          </SectionCard>
          {item.etapas.map((e, idx) => {
            const t = ETAPAS_TEMPLATE[idx];
            return (
              <SectionCard key={e.id} title={t.nome} subtitle={t.codigo} icon={t.icon} numero={t.numero}>
                <p className="text-xs text-slate-400 mb-2">Início: {e.inicio || '—'} · Término: {e.termino || '—'}</p>
                {e.itens.map((it, i) => (
                  <p key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    {it.status === 'pos' ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-red-600" />} {it.desc} {it.obs && <span className="text-red-500 text-xs">— {it.obs}</span>}
                  </p>
                ))}
                {e.medicoes?.map((m, i) => (
                  <p key={i} className="text-sm text-slate-500 mt-1">{m.refLabel}: {m.refValor} · Medido: {m.valorMedido || '—'}</p>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  {opAssin(e.operadorId) && <img src={opAssin(e.operadorId)} className="h-8" />}
                  <span className="text-xs text-slate-400">visto de {opNome(e.operadorId)}</span>
                </div>
              </SectionCard>
            );
          })}
          {item.observacoes && (
            <SectionCard title="Observações / Não Conformidades" icon={AlertCircle}>
              <p className="text-sm text-slate-600">{item.observacoes}</p>
            </SectionCard>
          )}
          <SectionCard title="Requisição de material" icon={Package}>
            {item.requisicoes.filter(r => r.descricao).map((r, i) => (
              <p key={i} className="text-sm text-slate-600">{r.setor} · {r.codigo} · {r.qtde}x · {r.descricao} — aprovado por {opNome(r.aprovacaoId)}</p>
            ))}
          </SectionCard>
          <SectionCard title="Liberação final" icon={CheckCircle2}>
            <p className="text-sm text-slate-600 mb-2">Status: <StatusBadge tone={item.liberacao.status === 'APROVADO' ? 'green' : 'red'}>{item.liberacao.status}</StatusBadge> · Lote {item.lote}</p>
            <div className="flex items-center gap-2">
              {opAssin(item.liberacao.operadorId) && <img src={opAssin(item.liberacao.operadorId)} className="h-10" />}
              <span className="text-sm text-slate-600">{opNome(item.liberacao.operadorId)}</span>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* APP RAIZ                                                                 */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [operadores, setOperadores] = useState([]);
  const [recebimentos, setRecebimentos] = useState([]);
  const [ops, setOps] = useState([]);
  const [modelos, setModelos] = useState(DEFAULT_MODELOS);
  const [clientes, setClientes] = useState(DEFAULT_CLIENTES);
  const [view, setView] = useState('home');
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    (async () => {
      const [o, r, p, m, c] = await Promise.all([
        loadKey('mab-operadores', []),
        loadKey('mab-recebimentos', []),
        loadKey('mab-ops', []),
        loadKey('mab-modelos', DEFAULT_MODELOS),
        loadKey('mab-clientes', DEFAULT_CLIENTES),
      ]);
      setOperadores(o); setRecebimentos(r); setOps(p); setModelos(m); setClientes(c);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) saveKey('mab-operadores', operadores); }, [operadores, loading]);
  useEffect(() => { if (!loading) saveKey('mab-recebimentos', recebimentos); }, [recebimentos, loading]);
  useEffect(() => { if (!loading) saveKey('mab-ops', ops); }, [ops, loading]);
  useEffect(() => { if (!loading) saveKey('mab-modelos', modelos); }, [modelos, loading]);
  useEffect(() => { if (!loading) saveKey('mab-clientes', clientes); }, [clientes, loading]);

  const registrarNovosValores = (lista, setLista, valores) => {
    const novos = valores.filter((v) => v && v.trim() && !lista.some((x) => x.toLowerCase() === v.trim().toLowerCase()));
    if (novos.length) setLista((prev) => [...prev, ...novos.map((v) => v.trim())]);
  };

  const salvarRecebimento = (r) => {
    registrarNovosValores(clientes, setClientes, [r.fornecedorCliente]);
    registrarNovosValores(modelos, setModelos, r.modelosRecebidos.map((m) => m.modelo));
    setRecebimentos((prev) => [...prev, r]);
    setView('home');
  };
  const salvarOP = (o) => {
    registrarNovosValores(clientes, setClientes, [o.clienteOrigem]);
    registrarNovosValores(modelos, setModelos, [o.aplicacaoModelo]);
    setOps((prev) => [...prev, o]);
    setView('home');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100">
        <Cog className="text-amber-500 animate-spin" size={32} />
      </div>
    );
  }

  const item = detalhe ? (detalhe.tipo === 'recebimento' ? recebimentos.find((r) => r.id === detalhe.id) : ops.find((o) => o.id === detalhe.id)) : null;

  return (
    <div className="h-screen w-full flex bg-slate-100 overflow-hidden">
      <GlobalStyle />
      <Sidebar view={detalhe ? '' : view} setView={(v) => { setDetalhe(null); setView(v); }} />
      <div className="flex-1 overflow-y-auto p-5 md:p-8">
        {detalhe && item ? (
          <DetalheView tipo={detalhe.tipo} item={item} operadores={operadores} onVoltar={() => setDetalhe(null)} />
        ) : view === 'home' ? (
          <HomeView recebimentos={recebimentos} ops={ops} setView={setView} setDetalhe={setDetalhe} />
        ) : view === 'operadores' ? (
          <OperadoresView operadores={operadores} setOperadores={setOperadores} />
        ) : view === 'recebimento' ? (
          operadores.length === 0 ? (
            <EmptyOperadores setView={setView} />
          ) : (
            <RecebimentoForm operadores={operadores} modelos={modelos} clientes={clientes} onSalvar={salvarRecebimento} onCancelar={() => setView('home')} />
          )
        ) : view === 'op' ? (
          operadores.length === 0 ? (
            <EmptyOperadores setView={setView} />
          ) : (
            <OPForm operadores={operadores} modelos={modelos} clientes={clientes} onSalvar={salvarOP} onCancelar={() => setView('home')} />
          )
        ) : view === 'historico' ? (
          <HistoricoView recebimentos={recebimentos} ops={ops} onAbrir={setDetalhe} />
        ) : null}
      </div>
    </div>
  );
}

function EmptyOperadores({ setView }) {
  return (
    <div className="max-w-md font-body">
      <h2 className="font-display text-xl text-slate-800 mb-2">Cadastre um operador primeiro</h2>
      <p className="text-sm text-slate-500 mb-4">Para colher a assinatura automaticamente nos formulários, é preciso cadastrar ao menos um operador.</p>
      <button onClick={() => setView('operadores')} className="bg-amber-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">Ir para Operadores</button>
    </div>
  );
}
