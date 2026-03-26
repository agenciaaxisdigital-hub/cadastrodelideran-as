import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = 'Carregando...' }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full gradient-primary opacity-20 animate-ping absolute inset-0" />
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center relative">
          <Loader2 size={28} className="text-white animate-spin" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Rede Política – Dra. Fernanda Sarelli</p>
      </div>
    </div>
  );
}
