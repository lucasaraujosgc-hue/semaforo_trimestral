
import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, Info, AlertCircle, FileText, CheckCircle2, Clock, ListChecks, History, Target, ExternalLink, AlertTriangle, ShieldAlert, TrendingDown, Minus } from 'lucide-react';
import { Post } from '../types';
import { ChartRenderer } from './ChartRenderer';

// Componente Helper para Semáforo com Tooltip (Exportado para uso no App e SummaryPanel)
export const SemaforoWithTooltip = ({ status, rules, sizeClass = "w-4 h-4" }: { status: 'green' | 'yellow' | 'red', rules: any, sizeClass?: string }) => {
  const colorClass = status === 'green' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]' : status === 'yellow' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]';
  const text = status === 'green' ? rules?.green : status === 'yellow' ? rules?.yellow : rules?.red;

  return (
    <div className="group/tooltip relative flex items-center justify-center cursor-help z-50">
      <div className={`${sizeClass} rounded-full ${colorClass} transition-transform group-hover/tooltip:scale-110`}></div>
      {text && (
        <div className="absolute bottom-full mb-3 hidden group-hover/tooltip:block z-[100] w-64 -left-2">
           <div className="bg-black/90 backdrop-blur-xl text-white text-xs p-3 rounded-xl border border-slate-700 shadow-2xl relative">
              <span className={`block w-2 h-2 rounded-full mb-1 ${status === 'green' ? 'bg-emerald-500' : status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
              <p className="font-medium leading-tight">{text}</p>
              <div className="absolute top-full left-4 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90"></div>
           </div>
        </div>
      )}
    </div>
  );
};

// Componente para Tendência (Exportado)
export const TrendBadge = ({ type }: { type: 'up' | 'down' | 'stable' }) => {
    if (type === 'up') {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wide">
                <TrendingUp size={14} /> Crescimento
            </div>
        );
    }
    if (type === 'down') {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-wide">
                <TrendingDown size={14} /> Queda
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 font-bold text-[10px] uppercase tracking-wide">
            <Minus size={14} /> Estável
        </div>
    );
};

// O Modal Completo (Exportado)
export const ReportModal = ({ post, onClose }: { post: Post, onClose: () => void }) => {
  const r = post.report || {} as any;
  const semaforoRules = post.semaforoRules || { green: 'Normal', yellow: 'Atenção', red: 'Crítico' };
  const history = [...(post.progressHistory || [])].sort((a,b) => b.date - a.date);

  // Layout Logic
  const layout = r.layout || { chartWidthPercent: 40, isVertical: false, order: 'chart-first' };
  
  const [chartWidth, setChartWidth] = useState(layout.chartWidthPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  useEffect(() => {
      setChartWidth(layout.chartWidthPercent);
  }, [layout.chartWidthPercent]);

  const startResizing = (e: React.MouseEvent) => {
      isResizing.current = true;
      e.preventDefault();
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResizing);
  };

  const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      let newPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      if (newPercent < 20) newPercent = 20;
      if (newPercent > 80) newPercent = 80;
      setChartWidth(newPercent);
  };

  const stopResizing = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
  };

  const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: layout.isVertical ? 'column' : 'row',
      gap: '2rem'
  };

  const chartStyle: React.CSSProperties = {
      width: layout.isVertical ? '100%' : `${chartWidth}%`,
      order: layout.order === 'chart-first' ? 1 : 2
  };

  const tableStyle: React.CSSProperties = {
      width: layout.isVertical ? '100%' : `${100 - chartWidth}%`,
      order: layout.order === 'chart-first' ? 2 : 1
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl overflow-y-auto" onClick={onClose}>
      <div className="bg-[#0b1120] w-full max-w-6xl rounded-[2.5rem] border border-slate-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-10 duration-500 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="p-8 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white p-2 rounded-2xl shrink-0">
               <img src="https://pmsgc-goncalinho.wvai75.easypanel.host/brasao.png" className="w-full h-full object-contain" alt="Brasão" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">Indicador Estratégico</span>
                <span className="text-slate-500 text-[10px] font-bold uppercase">{post.recorrencia}</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">{post.indicatorName || post.chartConfig.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-800/50 hover:bg-red-500 text-slate-400 hover:text-white rounded-2xl transition-all shadow-xl"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar">
          
          <section className="space-y-8">
            <h3 className="text-xl font-black flex items-center gap-3 text-white border-b border-slate-800 pb-4"><TrendingUp className="text-emerald-500" size={24}/> Dados de Evolução e Informações</h3>
            
            <div ref={containerRef} style={containerStyle} className="relative group/resize">
               <div style={chartStyle} className="h-96 bg-slate-950/50 rounded-[2rem] p-8 border border-slate-800/80 shadow-2xl shrink-0 transition-[width] duration-75 ease-out relative">
                 <ChartRenderer config={post.chartConfig} />
               </div>

               {!layout.isVertical && (
                   <div 
                        onMouseDown={startResizing}
                        className="w-4 cursor-col-resize flex items-center justify-center opacity-0 group-hover/resize:opacity-100 transition-opacity absolute top-0 bottom-0 z-20 hover:bg-emerald-500/10"
                        style={{ left: `${layout.order === 'chart-first' ? chartWidth : 100 - chartWidth}%`, transform: 'translateX(-50%)' }}
                   >
                       <div className="w-1 h-12 bg-slate-600 rounded-full"></div>
                   </div>
               )}

               <div style={tableStyle} className="bg-slate-900/20 rounded-[2rem] border border-slate-800/50 overflow-hidden shrink-0 flex flex-col h-96">
                 <div className="p-5 border-b border-slate-800 bg-slate-950/50">
                    <h5 className="text-sm font-bold text-white uppercase tracking-wider">Informações do Indicador</h5>
                 </div>
                 <div className="overflow-auto custom-scrollbar flex-1">
                    <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-500 uppercase font-black tracking-widest border-b border-slate-800 sticky top-0 z-10">
                        <tr>
                        <th className="p-5">{r.headerIndicador || 'Indicador'}</th>
                        <th className="p-5">{r.headerResultado || 'Resultado'}</th>
                        <th className="p-5">{r.headerMeta || 'Meta'}</th>
                        {r.showExtraColumn && <th className="p-5 text-emerald-500/80">{r.headerExtra || 'Extra'}</th>}
                        <th className="p-5 text-center">Sinal</th>
                        <th className="p-5 text-center">Tend.</th>
                        <th className="p-5">Fonte</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                        {r.indicadoresChave?.length > 0 ? r.indicadoresChave.map((ind: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-800/20 transition-all">
                            <td className="p-5 font-bold text-slate-100">{ind.nome}</td>
                            <td className="p-5 font-bold text-emerald-400">{ind.resultado}</td>
                            <td className="p-5 text-slate-400">{ind.meta}</td>
                            {r.showExtraColumn && <td className="p-5 text-amber-200 font-medium">{ind.extra || '-'}</td>}
                            <td className="p-5 text-center">
                                <div className="flex justify-center">
                                    <SemaforoWithTooltip status={ind.status} rules={semaforoRules} />
                                </div>
                            </td>
                            <td className="p-5 text-center font-bold text-slate-300">
                                <div className="flex justify-center">
                                    <TrendBadge type={ind.tendencia} />
                                </div>
                            </td>
                            <td className="p-5 text-slate-500 text-[10px]">{ind.fonte}</td>
                        </tr>
                        )) : (
                        <tr><td colSpan={r.showExtraColumn ? 7 : 6} className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest">Nenhuma informação adicional</td></tr>
                        )}
                    </tbody>
                    </table>
                 </div>
               </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 space-y-6">
               <h3 className="text-xl font-black text-white flex items-center gap-2"><Info className="text-emerald-500"/> Definição Estratégica</h3>
               
               <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Objetivo</span>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">{r.objetivo || 'Não definido.'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">Por que é crítico para o Prefeito?</span>
                    <p className="text-sm text-amber-100/80 leading-relaxed italic">{r.importanciaPrefeito || 'Não definido.'}</p>
                  </div>
                  <div className="flex gap-6 pt-2">
                     <div className="flex-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Fórmula</span>
                        <p className="text-xs text-slate-400 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800">{r.formula || 'N/A'}</p>
                     </div>
                     <div className="flex-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Fonte</span>
                        <p className="text-xs text-slate-400 font-bold">{post.fonteOficial || 'N/A'}</p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 space-y-4">
                  <h3 className="text-xl font-black text-white flex items-center gap-2"><AlertCircle className="text-purple-500"/> Calibragem do Semáforo</h3>
                  <div className="space-y-3">
                     <div className="flex items-center gap-3 text-xs text-slate-300">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <span>{semaforoRules.green}</span>
                     </div>
                     <div className="flex items-center gap-3 text-xs text-slate-300">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                        <span>{semaforoRules.yellow}</span>
                     </div>
                     <div className="flex items-center gap-3 text-xs text-slate-300">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        <span>{semaforoRules.red}</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <section className="space-y-6">
            <h3 className="text-xl font-black flex items-center gap-3 text-white border-b border-slate-800 pb-4"><FileText className="text-emerald-500" size={24}/> Resumo Executivo do Período</h3>
            <div className="grid md:grid-cols-3 gap-8">
               <div className="bg-emerald-500/5 border-l-4 border-emerald-500 p-6 rounded-r-3xl">
                 <h5 className="text-[11px] font-black text-emerald-400 uppercase mb-3 flex items-center gap-2"><CheckCircle2 size={14}/> Principais Avanços</h5>
                 <p className="text-sm text-slate-300 leading-relaxed italic">"{r.resumoAvanços || 'Sem avanços relatados no período.'}"</p>
               </div>
               <div className="bg-amber-500/5 border-l-4 border-amber-500 p-6 rounded-r-3xl">
                 <h5 className="text-[11px] font-black text-amber-400 uppercase mb-3 flex items-center gap-2"><Clock size={14}/> Principais Atrasos</h5>
                 <p className="text-sm text-slate-300 leading-relaxed italic">"{r.resumoAtrasos || 'Sem gargalos relatados no período.'}"</p>
               </div>
               <div className="bg-blue-500/5 border-l-4 border-blue-500 p-6 rounded-r-3xl">
                 <h5 className="text-[11px] font-black text-blue-400 uppercase mb-3 flex items-center gap-2"><ListChecks size={14}/> Decisões do Prefeito</h5>
                 <p className="text-sm text-slate-300 leading-relaxed italic">"{r.resumoDecisoes || 'Sem demandas de decisão no período.'}"</p>
               </div>
            </div>
          </section>



          <div className="space-y-6">
             <div className="space-y-6">
                <h4 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight"><AlertTriangle className="text-amber-500" size={20}/> Problemas e Plano de Ataque</h4>
                <div className="space-y-4">
                   {r.problemasCriticos?.length > 0 ? r.problemasCriticos.map((p: any, i: number) => (
                     <div key={i} className="bg-red-500/5 border border-red-500/20 p-5 rounded-3xl space-y-4">
                        <div className="flex justify-between items-start">
                          <h6 className="font-bold text-red-400 text-sm">{p.problema}</h6>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${p.impacto === 'Alto' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{p.impacto} impacto</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                               <span className="text-slate-500 font-black uppercase text-[9px] block mb-1">Causa Provável</span>
                               <p className="text-xs text-slate-300">{p.causa || '-'}</p>
                            </div>
                            <div>
                               <span className="text-slate-500 font-black uppercase text-[9px] block mb-1">Prazo</span>
                               <p className="text-xs text-slate-300">{p.prazo || '-'}</p>
                            </div>
                        </div>

                        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/10 text-xs">
                          <span className="text-emerald-400 font-black uppercase text-[9px] block mb-1">Ação Corretiva</span>
                          {p.acao}
                        </div>
                     </div>
                   )) : <p className="text-slate-500 italic text-sm">Nenhum problema crítico reportado.</p>}
                </div>
             </div>


          </div>

        </div>
        
        <div className="p-8 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
           <span>Fonte Oficial: {post.fonteOficial}</span>
           <div className="flex gap-4">
                {post.lastEditor && <span className="text-emerald-400">{post.lastEditor}</span>}
                <span>SGC - Monitoramento de Resultados v1.3</span>
           </div>
        </div>
      </div>
    </div>
  );
};
