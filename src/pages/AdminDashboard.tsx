import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Users, TrendingUp, Award, Activity, ChevronDown, ChevronUp,
  Zap, Target, Shield, Calendar, Clock, Filter
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar
} from 'recharts';

/* ── types ── */
interface Cadastro {
  id: string;
  criado_em: string;
  cadastrado_por: string | null;
  tipo: 'lideranca' | 'fiscal' | 'eleitor';
}

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  criado_em: string;
}

/* ── helpers ── */
const STATUS_COLORS: Record<string, string> = {
  Ativa: 'hsl(142 71% 45%)',
  Potencial: 'hsl(217 91% 60%)',
  'Em negociação': 'hsl(45 93% 47%)',
  Fraca: 'hsl(25 95% 53%)',
  Descartada: 'hsl(0 72% 51%)',
};

const TIPO_COLORS: Record<string, string> = {
  lideranca: 'hsl(217 91% 60%)',
  fiscal: 'hsl(142 71% 45%)',
  eleitor: 'hsl(280 70% 55%)',
};

const TIPO_LABELS: Record<string, string> = {
  lideranca: 'Lideranças',
  fiscal: 'Fiscais',
  eleitor: 'Eleitores',
};

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

type Periodo = 'hoje' | 'semana' | 'mes' | 'total';
type TipoFiltro = 'todos' | 'lideranca' | 'fiscal' | 'eleitor';

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [usuarios, setUsuarios] = useState<HierarquiaUsuario[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('total');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [lRes, fRes, eRes, uRes, statusRes] = await Promise.all([
      supabase.from('liderancas').select('id, criado_em, cadastrado_por'),
      supabase.from('fiscais').select('id, criado_em, cadastrado_por'),
      supabase.from('possiveis_eleitores').select('id, criado_em, cadastrado_por'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, criado_em').eq('ativo', true),
      supabase.from('liderancas').select('status'),
    ]);

    const allCadastros: Cadastro[] = [
      ...(lRes.data || []).map(r => ({ ...r, tipo: 'lideranca' as const })),
      ...(fRes.data || []).map(r => ({ ...r, tipo: 'fiscal' as const })),
      ...(eRes.data || []).map(r => ({ ...r, tipo: 'eleitor' as const })),
    ];

    // ── MOCK DATA (remover depois) ──
    const mockAgentIds = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];
    const mockAgentNames = ['Carlos Silva', 'Maria Souza', 'João Pereira', 'Ana Costa', 'Pedro Santos'];
    const mockAgents: HierarquiaUsuario[] = mockAgentIds.map((id, i) => ({
      id,
      nome: mockAgentNames[i],
      tipo: i < 2 ? 'suplente' : i < 4 ? 'lideranca' : 'coordenador',
      criado_em: new Date(2026, 2, 1).toISOString(),
    }));

    const mockCadastros: Cadastro[] = [];
    const tipos: Array<'lideranca' | 'fiscal' | 'eleitor'> = ['lideranca', 'fiscal', 'eleitor'];
    for (let d = 0; d < 25; d++) {
      const count = Math.floor(Math.random() * 8) + 2;
      for (let j = 0; j < count; j++) {
        const date = new Date(2026, 2, 3 + d, Math.floor(Math.random() * 12) + 8);
        mockCadastros.push({
          id: `mock-${d}-${j}`,
          criado_em: date.toISOString(),
          cadastrado_por: mockAgentIds[Math.floor(Math.random() * mockAgentIds.length)],
          tipo: tipos[Math.floor(Math.random() * 3)],
        });
      }
    }

    setCadastros([...allCadastros, ...mockCadastros]);
    setUsuarios([...(uRes.data || []), ...mockAgents]);

    // Status distribution (mock)
    const mockStatusData = [
      { name: 'Ativa', value: 42 },
      { name: 'Potencial', value: 18 },
      { name: 'Em negociação', value: 12 },
      { name: 'Fraca', value: 7 },
      { name: 'Descartada', value: 3 },
    ];
    setStatusData(mockStatusData);
    // ── FIM MOCK DATA ──

    setLoading(false);
  };

  /* ── date boundaries ── */
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const inicioSemana = useMemo(() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); return d; }, [hoje]);
  const inicioMes = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1), [hoje]);

  const getDateFilter = (p: Periodo) => {
    if (p === 'hoje') return hoje;
    if (p === 'semana') return inicioSemana;
    if (p === 'mes') return inicioMes;
    return null;
  };

  /* ── filtered cadastros ── */
  const filteredCadastros = useMemo(() => {
    let data = cadastros;
    if (tipoFiltro !== 'todos') data = data.filter(c => c.tipo === tipoFiltro);
    const dateLimit = getDateFilter(periodo);
    if (dateLimit) data = data.filter(c => new Date(c.criado_em) >= dateLimit);
    return data;
  }, [cadastros, tipoFiltro, periodo, hoje, inicioSemana, inicioMes]);

  /* ── summary counts ── */
  const totais = useMemo(() => {
    const dateLimit = getDateFilter(periodo);
    const filtered = dateLimit ? cadastros.filter(c => new Date(c.criado_em) >= dateLimit) : cadastros;
    return {
      liderancas: filtered.filter(c => c.tipo === 'lideranca').length,
      fiscais: filtered.filter(c => c.tipo === 'fiscal').length,
      eleitores: filtered.filter(c => c.tipo === 'eleitor').length,
      total: filtered.length,
    };
  }, [cadastros, periodo, hoje, inicioSemana, inicioMes]);

  /* ── agents list ── */
  const agentes = useMemo(() =>
    usuarios.filter(u => u.tipo === 'suplente' || u.tipo === 'lideranca' || u.tipo === 'coordenador'),
    [usuarios]
  );

  /* ── ranking ── */
  const rankingData = useMemo(() => {
    const map: Record<string, { total: number; liderancas: number; fiscais: number; eleitores: number; ultimo: Date | null }> = {};
    agentes.forEach(a => { map[a.id] = { total: 0, liderancas: 0, fiscais: 0, eleitores: 0, ultimo: null }; });

    filteredCadastros.forEach(c => {
      if (!c.cadastrado_por) return;
      if (!map[c.cadastrado_por]) map[c.cadastrado_por] = { total: 0, liderancas: 0, fiscais: 0, eleitores: 0, ultimo: null };
      map[c.cadastrado_por].total++;
      if (c.tipo === 'lideranca') map[c.cadastrado_por].liderancas++;
      if (c.tipo === 'fiscal') map[c.cadastrado_por].fiscais++;
      if (c.tipo === 'eleitor') map[c.cadastrado_por].eleitores++;
      const d = new Date(c.criado_em);
      if (!map[c.cadastrado_por].ultimo || d > map[c.cadastrado_por].ultimo!) map[c.cadastrado_por].ultimo = d;
    });

    return Object.entries(map)
      .map(([id, stats]) => {
        const agent = agentes.find(a => a.id === id) || usuarios.find(u => u.id === id);
        return { id, nome: agent?.nome || 'Desconhecido', tipo: agent?.tipo || '—', ...stats };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredCadastros, agentes, usuarios]);

  /* ── distribution by type (pie) ── */
  const tipoPieData = useMemo(() => [
    { name: 'Lideranças', value: totais.liderancas },
    { name: 'Fiscais', value: totais.fiscais },
    { name: 'Eleitores', value: totais.eleitores },
  ].filter(d => d.value > 0), [totais]);

  /* ── timeline ── */
  const timelineData = useMemo(() => {
    const map: Record<string, { liderancas: number; fiscais: number; eleitores: number }> = {};
    filteredCadastros.forEach(c => {
      const d = new Date(c.criado_em);
      const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!map[key]) map[key] = { liderancas: 0, fiscais: 0, eleitores: 0 };
      if (c.tipo === 'lideranca') map[key].liderancas++;
      if (c.tipo === 'fiscal') map[key].fiscais++;
      if (c.tipo === 'eleitor') map[key].eleitores++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
      })
      .map(([dia, vals]) => ({ dia, ...vals, total: vals.liderancas + vals.fiscais + vals.eleitores }));
  }, [filteredCadastros]);

  /* ── bar chart per agent (top 10) ── */
  const barData = useMemo(() =>
    rankingData.slice(0, 10).map(r => ({
      nome: r.nome.length > 12 ? r.nome.slice(0, 12) + '…' : r.nome,
      liderancas: r.liderancas,
      fiscais: r.fiscais,
      eleitores: r.eleitores,
    })),
    [rankingData]
  );

  const ultimoCadastro = useMemo(() => {
    if (cadastros.length === 0) return null;
    return new Date(Math.max(...cadastros.map(c => new Date(c.criado_em).getTime())));
  }, [cadastros]);

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança', fiscal: 'Fiscal' };
    return labels[t] || t;
  };

  const getMedalEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
  const periodoLabels: Record<Periodo, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total' };
  const tipoFiltroLabels: Record<TipoFiltro, string> = { todos: 'Todos', lideranca: 'Lideranças', fiscal: 'Fiscais', eleitor: 'Eleitores' };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="h-[1.5px] gradient-header" />

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Dashboard Admin</h1>
            <p className="text-[10px] text-muted-foreground">
              Atualizado {ultimoCadastro ? timeSince(ultimoCadastro) : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{totais.total}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">cadastros</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* ── Filtros ── */}
        <div className="section-card">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-primary" />
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Filtros</h2>
          </div>
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(periodoLabels) as Periodo[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    periodo === p ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {periodoLabels[p]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTipoFiltro(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    tipoFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tipoFiltroLabels[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Resumo por tipo ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Lideranças', value: totais.liderancas, color: 'hsl(217 91% 60%)' },
            { icon: Shield, label: 'Fiscais', value: totais.fiscais, color: 'hsl(142 71% 45%)' },
            { icon: Target, label: 'Eleitores', value: totais.eleitores, color: 'hsl(280 70% 55%)' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="section-card text-center">
              <Icon size={18} className="mx-auto mb-1" style={{ color }} />
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Distribuição por tipo (pie) ── */}
        {tipoPieData.length > 0 && (
          <div className="section-card">
            <h2 className="section-title">📊 Distribuição por Tipo</h2>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tipoPieData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25} strokeWidth={2} stroke="hsl(var(--background))">
                      {tipoPieData.map(entry => (
                        <Cell key={entry.name} fill={
                          entry.name === 'Lideranças' ? TIPO_COLORS.lideranca :
                          entry.name === 'Fiscais' ? TIPO_COLORS.fiscal : TIPO_COLORS.eleitor
                        } />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {tipoPieData.map(s => {
                  const pct = totais.total > 0 ? Math.round((s.value / totais.total) * 100) : 0;
                  const color = s.name === 'Lideranças' ? TIPO_COLORS.lideranca :
                    s.name === 'Fiscais' ? TIPO_COLORS.fiscal : TIPO_COLORS.eleitor;
                  return (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-foreground font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-auto">{s.value} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Status lideranças (pie) ── */}
        {statusData.length > 0 && tipoFiltro === 'todos' && (
          <div className="section-card">
            <h2 className="section-title">🎯 Status das Lideranças</h2>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25} strokeWidth={2} stroke="hsl(var(--background))">
                      {statusData.map(entry => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || 'hsl(var(--muted-foreground))'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {statusData.map(s => {
                  const total = statusData.reduce((sum, d) => sum + d.value, 0);
                  const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name] || 'hsl(var(--muted-foreground))' }} />
                      <span className="text-foreground font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-auto">{s.value} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="section-card">
          <h2 className="section-title">📈 Cadastros por Dia</h2>
          {timelineData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="liderancas" name="Lideranças" stackId="a" fill={TIPO_COLORS.lideranca} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="fiscais" name="Fiscais" stackId="a" fill={TIPO_COLORS.fiscal} />
                  <Bar dataKey="eleitores" name="Eleitores" stackId="a" fill={TIPO_COLORS.eleitor} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro no período</p>
          )}
        </div>

        {/* ── Top agentes (bar horizontal) ── */}
        {barData.length > 0 && (
          <div className="section-card">
            <h2 className="section-title">📊 Top Agentes por Cadastros</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 5, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={90} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="liderancas" name="Lideranças" stackId="a" fill={TIPO_COLORS.lideranca} />
                  <Bar dataKey="fiscais" name="Fiscais" stackId="a" fill={TIPO_COLORS.fiscal} />
                  <Bar dataKey="eleitores" name="Eleitores" stackId="a" fill={TIPO_COLORS.eleitor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Ranking completo ── */}
        <div className="section-card">
          <h2 className="section-title">🏆 Ranking de Agentes</h2>
          {rankingData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum cadastro no período selecionado</p>
          ) : (
            <div className="space-y-2">
              {rankingData.map((r, i) => (
                <div key={r.id} className={`p-3 rounded-xl border transition-all ${
                  i === 0 ? 'border-amber-400/40 bg-amber-500/5' :
                  i === 1 ? 'border-slate-400/30 bg-slate-500/5' :
                  i === 2 ? 'border-orange-400/30 bg-orange-500/5' :
                  'border-border bg-card'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center shrink-0">{getMedalEmoji(i)}</span>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{r.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{r.nome}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tipoLabel(r.tipo)}</span>
                      </div>
                      {r.ultimo && (
                        <p className="text-[10px] text-muted-foreground">Último: {timeSince(r.ultimo)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-primary">{r.total}</p>
                      <p className="text-[9px] text-muted-foreground">total</p>
                    </div>
                  </div>
                  {/* Breakdown per type */}
                  <div className="flex gap-2 mt-2 ml-11">
                    {r.liderancas > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsla(217, 91%, 60%, 0.1)', color: TIPO_COLORS.lideranca }}>
                        <Users size={10} /> {r.liderancas} lid.
                      </span>
                    )}
                    {r.fiscais > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsla(142, 71%, 45%, 0.1)', color: TIPO_COLORS.fiscal }}>
                        <Shield size={10} /> {r.fiscais} fisc.
                      </span>
                    )}
                    {r.eleitores > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>
                        <Target size={10} /> {r.eleitores} eleit.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
