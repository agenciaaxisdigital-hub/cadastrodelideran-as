import { useState, useEffect } from 'react';
import { Users, Shield, Eye, TrendingUp, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UsuarioResumo {
  id: string;
  nome: string;
  tipo: string;
  liderancas: number;
  fiscais: number;
  eleitores: number;
  total: number;
}

interface SuplenteResumo {
  id: string;
  nome: string;
  usuarios: UsuarioResumo[];
  liderancas: number;
  fiscais: number;
  eleitores: number;
  total: number;
}

export default function TabPainel() {
  const { usuario, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suplentes, setSuplentes] = useState<SuplenteResumo[]>([]);
  const [expandedSuplente, setExpandedSuplente] = useState<string | null>(null);
  const [totais, setTotais] = useState({ liderancas: 0, fiscais: 0, eleitores: 0 });

  useEffect(() => {
    fetchData();
  }, [usuario]);

  const fetchData = async () => {
    if (!usuario) return;
    setLoading(true);

    try {
      // Fetch all users in the hierarchy visible to current user
      const { data: usuarios } = await supabase
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, suplente_id')
        .eq('ativo', true);

      if (!usuarios) { setLoading(false); return; }

      // Fetch all registrations with cadastrado_por
      const [lRes, fRes, eRes] = await Promise.all([
        supabase.from('liderancas').select('id, cadastrado_por, suplente_id'),
        supabase.from('fiscais').select('id, cadastrado_por, suplente_id'),
        supabase.from('possiveis_eleitores').select('id, cadastrado_por, suplente_id'),
      ]);

      const liderancasList = lRes.data || [];
      const fiscaisList = fRes.data || [];
      const eleitoresList = eRes.data || [];

      // Count per cadastrado_por
      const countBy = (list: { cadastrado_por: string | null }[], userId: string) =>
        list.filter(r => r.cadastrado_por === userId).length;

      // Count per suplente_id
      const countBySuplente = (list: { suplente_id: string | null }[], supId: string) =>
        list.filter(r => r.suplente_id === supId).length;

      // Build user summaries
      const userMap = new Map<string, UsuarioResumo>();
      for (const u of usuarios) {
        const l = countBy(liderancasList, u.id);
        const f = countBy(fiscaisList, u.id);
        const e = countBy(eleitoresList, u.id);
        userMap.set(u.id, {
          id: u.id,
          nome: u.nome,
          tipo: u.tipo,
          liderancas: l,
          fiscais: f,
          eleitores: e,
          total: l + f + e,
        });
      }

      // Fetch suplentes from edge function
      let suplentesList: { id: string; nome: string }[] = [];
      try {
        const { data } = await supabase.functions.invoke('buscar-suplentes');
        if (data) suplentesList = data;
      } catch { /* ignore */ }

      // Group users by suplente_id
      const supMap = new Map<string, SuplenteResumo>();

      for (const sup of suplentesList) {
        const usersOfSup = usuarios.filter(u => u.suplente_id === sup.id);
        const userSummaries = usersOfSup
          .map(u => userMap.get(u.id)!)
          .filter(Boolean)
          .sort((a, b) => b.total - a.total);

        const l = countBySuplente(liderancasList, sup.id);
        const f = countBySuplente(fiscaisList, sup.id);
        const e = countBySuplente(eleitoresList, sup.id);

        supMap.set(sup.id, {
          id: sup.id,
          nome: sup.nome,
          usuarios: userSummaries,
          liderancas: l,
          fiscais: f,
          eleitores: e,
          total: l + f + e,
        });
      }

      // Users without suplente_id (coordenadores, super_admin)
      const orphanUsers = usuarios.filter(u => !u.suplente_id);
      if (orphanUsers.length > 0) {
        const userSummaries = orphanUsers
          .map(u => userMap.get(u.id)!)
          .filter(Boolean)
          .filter(u => u.total > 0)
          .sort((a, b) => b.total - a.total);
        
        if (userSummaries.length > 0) {
          const l = userSummaries.reduce((s, u) => s + u.liderancas, 0);
          const f = userSummaries.reduce((s, u) => s + u.fiscais, 0);
          const e = userSummaries.reduce((s, u) => s + u.eleitores, 0);
          supMap.set('_coord', {
            id: '_coord',
            nome: 'Coordenação',
            usuarios: userSummaries,
            liderancas: l,
            fiscais: f,
            eleitores: e,
            total: l + f + e,
          });
        }
      }

      const sorted = Array.from(supMap.values()).sort((a, b) => b.total - a.total);
      setSuplentes(sorted);
      setTotais({
        liderancas: liderancasList.length,
        fiscais: fiscaisList.length,
        eleitores: eleitoresList.length,
      });
    } catch (err) {
      console.error('Erro ao carregar painel:', err);
    }

    setLoading(false);
  };

  const tipoLabel = (tipo: string) => {
    const map: Record<string, string> = {
      super_admin: 'Admin',
      coordenador: 'Coord.',
      suplente: 'Suplente',
      lideranca: 'Liderança',
      fiscal: 'Fiscal',
    };
    return map[tipo] || tipo;
  };

  const tipoBg = (tipo: string) => {
    const map: Record<string, string> = {
      super_admin: 'bg-primary/10 text-primary',
      coordenador: 'bg-primary/10 text-primary',
      suplente: 'bg-blue-500/10 text-blue-600',
      lideranca: 'bg-purple-500/10 text-purple-600',
      fiscal: 'bg-amber-500/10 text-amber-600',
    };
    return map[tipo] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const totalGeral = totais.liderancas + totais.fiscais + totais.eleitores;

  return (
    <div className="space-y-4 pb-24">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: TrendingUp, label: 'Total', value: totalGeral, color: 'text-primary' },
          { icon: Users, label: 'Lideranças', value: totais.liderancas, color: 'text-blue-500' },
          { icon: Shield, label: 'Fiscais', value: totais.fiscais, color: 'text-purple-500' },
          { icon: Eye, label: 'Eleitores', value: totais.eleitores, color: 'text-amber-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[9px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Suplentes ranking */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-foreground">Produção por Suplente</h2>
        
        {suplentes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhum dado encontrado</p>
        ) : (
          suplentes.map((sup, idx) => {
            const isExpanded = expandedSuplente === sup.id;
            return (
              <div key={sup.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSuplente(isExpanded ? null : sup.id)}
                  className="w-full flex items-center gap-3 p-3 active:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{idx + 1}º</span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-foreground truncate">{sup.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-blue-500 font-medium">{sup.liderancas} lid</span>
                      <span className="text-[10px] text-purple-500 font-medium">{sup.fiscais} fis</span>
                      <span className="text-[10px] text-amber-500 font-medium">{sup.eleitores} ele</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-bold text-foreground">{sup.total}</span>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && sup.usuarios.length > 0 && (
                  <div className="border-t border-border bg-muted/30">
                    <div className="px-3 py-2">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Agentes</p>
                      <div className="space-y-1">
                        {sup.usuarios.map(u => (
                          <div key={u.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-card/60">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground truncate">{u.nome}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tipoBg(u.tipo)}`}>
                                  {tipoLabel(u.tipo)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-blue-500">{u.liderancas} lid</span>
                                <span className="text-[10px] text-purple-500">{u.fiscais} fis</span>
                                <span className="text-[10px] text-amber-500">{u.eleitores} ele</span>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-foreground">{u.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && sup.usuarios.length === 0 && (
                  <div className="border-t border-border px-3 py-3">
                    <p className="text-[10px] text-muted-foreground text-center">Nenhum agente com cadastros</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
