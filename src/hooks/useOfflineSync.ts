import { useEffect } from 'react';
import { db } from '@/lib/dexieDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook de sincronização assíncrona.
 * Instanciar na barreira inicial do App.tsx ou Dashboard
 */
export function useOfflineSync() {
  useEffect(() => {
    const processSyncQueue = async () => {
      if (!navigator.onLine) return;
      
      const pendingOperations = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .toArray();

      if (pendingOperations.length === 0) return;

      console.log(`📡 [Off-first] Iniciando sincronização de ${pendingOperations.length} operações em cache...`);
      toast.info(`Sincronizando ${pendingOperations.length} registros salvos offline...`, { id: 'sync-progress', duration: 10000 });

      let successCount = 0;
      let errorCount = 0;

      for (const op of pendingOperations) {
        try {
          let error = null;

          switch (op.action) {
            case 'INSERT': {
              const res = await supabase.from(op.table as any).insert(op.payload);
              error = res.error;
              break;
            }
            case 'UPDATE': {
              const req = supabase.from(op.table as any).update(op.payload);
              if (op.matchKey) {
                const reqMatch = req.match(op.matchKey);
                const res = await reqMatch;
                error = res.error;
              } else {
                 throw new Error("MatchKey missing in UPDATE");
              }
              break;
            }
            case 'DELETE': {
              if (op.matchKey) {
                const res = await supabase.from(op.table as any).delete().match(op.matchKey);
                error = res.error;
              }
              break;
            }
            case 'RPC': {
              const res = await supabase.rpc(op.table as any, op.payload);
              error = res.error;
              break;
            }
          }

          if (error) throw error;
          
          await db.syncQueue.delete(op.id!);
          successCount++;
        } catch (err: any) {
           console.error('[Off-first] Falha em operação na fila:', err);
           errorCount++;
           await db.syncQueue.update(op.id!, { 
             status: 'ERROR', 
             errorMessage: err.message,
             retryCount: op.retryCount + 1 
           });
        }
      }

      if (successCount > 0) {
        toast.success(`Tudo atualizado! ${successCount} registros subiram pra nuvem.`, { id: 'sync-progress' });
      } else if (errorCount > 0) {
        toast.error(`Falha ao sincronizar ${errorCount} registros (Verifique logs)`, { id: 'sync-progress' });
      } else {
        toast.dismiss('sync-progress');
      }
    };

    window.addEventListener('online', processSyncQueue);
    
    // Tenta quando o componente é montado
    if (navigator.onLine) {
      processSyncQueue();
    }

    // Processamento estático em loop (a cada 5min) para caso o evento window falhe
    const interval = setInterval(() => {
       if (navigator.onLine) processSyncQueue();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', processSyncQueue);
      clearInterval(interval);
    };
  }, []);
}
