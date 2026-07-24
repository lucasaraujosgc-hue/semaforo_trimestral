
import React, { useState, useMemo } from 'react';
import { Filter, Search, User, Calendar, Target, Activity, LayoutDashboard, ArrowLeft, FileText, AlertTriangle, CheckCircle2, Clock, ListChecks, ArrowUpDown } from 'lucide-react';
import { Post, TopicId } from '../types';
import { TOPICS } from '../constants';
import { Link } from 'react-router-dom';
import { ReportModal } from './ReportModal';

interface SummaryPanelProps {
  posts: Post[];
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ posts }) => {
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['all']);
  const [filterRecorrencia, setFilterRecorrencia] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'alpha'>('default');
  
  // States para controle do Tooltip Inteligente
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
  
  // State para o Modal Completo
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Extrair periodicidades únicas para o filtro
  const uniqueRecorrencias = useMemo(() => {
      const recs = new Set(posts.map(p => p.recorrencia).filter(Boolean));
      return Array.from(recs).sort();
  }, [posts]);

  const filteredPosts = posts.filter(post => {
    const matchesTopic = filterTopic === 'all' || post.topicId === filterTopic;
    const postStatus = post.semaforoGeral || 'green';
    const matchesStatus = filterStatuses.includes('all') || filterStatuses.includes(postStatus);
    const matchesRecorrencia = filterRecorrencia === 'all' || post.recorrencia === filterRecorrencia;
    const matchesSearch = (post.indicatorName || post.chartConfig.title).toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesTopic && matchesStatus && matchesSearch && matchesRecorrencia;
  });

  // Função auxiliar de ordenação
  const sortPosts = (postsToSort: Post[]) => {
      if (sortBy === 'alpha') {
          return [...postsToSort].sort((a, b) => {
              const nameA = a.indicatorName || a.chartConfig.title || '';
              const nameB = b.indicatorName || b.chartConfig.title || '';
              return nameA.localeCompare(nameB);
          });
      }
      return postsToSort; // Retorna na ordem original (padrão)
  };

  // Agrupar por Secretaria se o filtro for 'all', senão mostra lista direta
  // Aplica a ordenação DENTRO dos grupos
  const groupedPosts = filterTopic === 'all' 
    ? TOPICS.map(topic => ({
        topic,
        posts: sortPosts(filteredPosts.filter(p => p.topicId === topic.id))
      })).filter(g => g.posts.length > 0)
    : [{
        topic: TOPICS.find(t => t.id === filterTopic)!,
        posts: sortPosts(filteredPosts)
      }];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'red': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
      case 'yellow': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]';
      case 'green': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
      default: return 'bg-slate-500';
    }
  };

  const getStatusText = (status: string, rules: any) => {
      if (status === 'red') return rules?.red || 'Crítico';
      if (status === 'yellow') return rules?.yellow || 'Atenção';
      return rules?.green || 'Normal';
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, postId: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const estimatedCardHeight = 600; // Aumentado um pouco para segurança

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Lógica aprimorada: Só joga para CIMA se não tiver espaço embaixo E tiver espaço em cima.
      if (spaceBelow < estimatedCardHeight && spaceAbove > estimatedCardHeight) {
          setTooltipPosition('top');
      } else {
          // Se tiver espaço embaixo, ou se não tiver espaço em lugar nenhum (default), mantem embaixo
          setTooltipPosition('bottom');
      }
      setHoveredPostId(postId);
  };

  const handleMouseLeave = () => {
      setHoveredPostId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header e Filtros */}
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <Link to="/" className="text-xs text-slate-500 hover:text-white flex items-center gap-1 mb-2"><ArrowLeft size={12}/> Voltar ao Início</Link>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                    <LayoutDashboard className="text-emerald-500"/> Visão Geral Executiva
                </h2>
                <p className="text-sm text-slate-400">Monitoramento consolidado de todas as secretarias.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700">
                    {[
                        { id: 'all', label: 'Todos', color: 'bg-slate-700' },
                        { id: 'green', label: 'Normal', color: 'bg-emerald-600' },
                        { id: 'yellow', label: 'Atenção', color: 'bg-amber-600' },
                        { id: 'red', label: 'Crítico', color: 'bg-red-600' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => {
                                setFilterStatuses(prev => {
                                    if (opt.id === 'all') return ['all'];
                                    let next = prev.filter(s => s !== 'all');
                                    if (next.includes(opt.id)) {
                                        next = next.filter(s => s !== opt.id);
                                        return next.length === 0 ? ['all'] : next;
                                    } else {
                                        return [...next, opt.id];
                                    }
                                });
                            }}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterStatuses.includes(opt.id) ? `${opt.color} text-white shadow-lg` : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                
                <div className="h-6 w-px bg-slate-800 hidden md:block"></div>
                
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                        type="text" 
                        placeholder="Buscar indicador..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-slate-900 text-white text-xs py-2 pl-9 pr-4 rounded-xl border border-slate-800 outline-none focus:border-emerald-500 w-48"
                    />
                </div>
            </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800/50">
            <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Filtrar por Secretaria</label>
                <div className="relative">
                    <select 
                        value={filterTopic} 
                        onChange={e => setFilterTopic(e.target.value)}
                        className="w-full appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-4 pr-10 py-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                        <option value="all">Todas as Secretarias</option>
                        {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14}/>
                </div>
            </div>

            <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Periodicidade</label>
                <div className="relative">
                    <select 
                        value={filterRecorrencia} 
                        onChange={e => setFilterRecorrencia(e.target.value)}
                        className="w-full appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-4 pr-10 py-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                        <option value="all">Todas</option>
                        {uniqueRecorrencias.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14}/>
                </div>
            </div>

             <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Ordenação</label>
                <div className="relative">
                    <select 
                        value={sortBy} 
                        onChange={e => setSortBy(e.target.value as 'default' | 'alpha')}
                        className="w-full appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-4 pr-10 py-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                        <option value="default">Padrão</option>
                        <option value="alpha">A - Z</option>
                    </select>
                    <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14}/>
                </div>
            </div>

        </div>
      </div>

      {/* Lista de Indicadores */}
      <div className="space-y-8">
        {groupedPosts.map((group) => (
            <div key={group.topic.id} className="space-y-3">
                {filterTopic === 'all' && (
                    <div className="flex items-center gap-3 px-2">
                        <div className={`w-2 h-2 rounded-full ${group.topic.color}`}></div>
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">{group.topic.label}</h3>
                        <div className="h-px bg-slate-800 flex-1"></div>
                    </div>
                )}
                
                <div className="grid gap-2">
                    {group.posts.map(post => (
                        <div 
                            key={post.id} 
                            className="relative"
                            onMouseEnter={(e) => handleMouseEnter(e, post.id)}
                            onMouseLeave={handleMouseLeave}
                        >
                            {/* Linha do Indicador (Botão clicável) */}
                            <div 
                                onClick={() => setSelectedPost(post)}
                                className="bg-slate-900/40 hover:bg-slate-800 border border-slate-800/50 hover:border-slate-700 p-4 rounded-xl flex items-center justify-between transition-all cursor-pointer duration-300 hover:translate-x-1"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <span className="text-[10px] font-black text-slate-600 w-8 shrink-0">{post.progress}%</span>
                                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                        <span className="text-sm font-medium text-slate-200">{post.indicatorName || post.chartConfig.title}</span>
                                        {/* Status Textual ao lado do nome */}
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                            post.semaforoGeral === 'red' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                                            post.semaforoGeral === 'yellow' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 
                                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        }`}>
                                            {getStatusText(post.semaforoGeral || 'green', post.semaforoRules)}
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-3 h-3 rounded-full shrink-0 ml-4 ${getStatusColor(post.semaforoGeral || 'green')}`}></div>
                            </div>

                            {/* GRID DETALHADO (TOOLTIP INTELIGENTE) */}
                            {hoveredPostId === post.id && (
                                <div 
                                    className={`absolute z-50 right-0 w-full md:w-[500px] lg:w-[650px] animate-in fade-in duration-200 ${tooltipPosition === 'top' ? 'bottom-full mb-3 slide-in-from-bottom-2' : 'top-full mt-3 slide-in-from-top-2'}`}
                                    onClick={() => setSelectedPost(post)} // Clique no tooltip também abre o modal
                                >
                                    <div className="bg-[#0f172a] border border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden p-6 relative cursor-pointer">
                                        
                                        {/* Seta decorativa */}
                                        <div className={`absolute right-6 w-4 h-4 bg-[#0f172a] border-slate-700 rotate-45 ${tooltipPosition === 'top' ? '-bottom-2 border-b border-r' : '-top-2 border-t border-l'}`}></div>
                                        
                                        <div className="flex justify-between items-start mb-5 border-b border-slate-800 pb-4">
                                            <div>
                                                <h4 className="text-lg font-black text-white leading-tight mb-1">{post.indicatorName || post.chartConfig.title}</h4>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{post.recorrencia} • {post.responsavel}</span>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${post.semaforoGeral === 'red' ? 'bg-red-500/10 border-red-500/30 text-red-400' : post.semaforoGeral === 'yellow' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                                {post.semaforoGeral === 'red' ? 'Crítico' : post.semaforoGeral === 'yellow' ? 'Atenção' : 'Normal'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6 mb-5">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Target size={12}/> Objetivo</span>
                                                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{post.report.objetivo || 'Não definido.'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Activity size={12}/> Status Atual</span>
                                                <p className={`text-xs font-bold leading-relaxed ${
                                                    post.semaforoGeral === 'red' ? 'text-red-400' : 
                                                    post.semaforoGeral === 'yellow' ? 'text-amber-400' : 
                                                    'text-emerald-400'
                                                }`}>
                                                    {getStatusText(post.semaforoGeral || 'green', post.semaforoRules)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Resumo Executivo (Com Decisões) */}
                                        <div className="mb-5 p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
                                            <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
                                                <FileText size={12} className="text-blue-400"/> Resumo Executivo do Período
                                            </span>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1 mb-1"><CheckCircle2 size={10}/> Avanços</span>
                                                    <p className="text-[10px] text-slate-300 leading-snug line-clamp-3 italic">{post.report.resumoAvanços || 'Não informado.'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 mb-1"><Clock size={10}/> Atrasos</span>
                                                    <p className="text-[10px] text-slate-300 leading-snug line-clamp-3 italic">{post.report.resumoAtrasos || 'Não informado.'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-blue-500 uppercase flex items-center gap-1 mb-1"><ListChecks size={10}/> Decisões</span>
                                                    <p className="text-[10px] text-slate-300 leading-snug line-clamp-3 italic">{post.report.resumoDecisoes || 'Nenhuma.'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Problemas Críticos (Se houver) */}
                                        {post.report.problemasCriticos && post.report.problemasCriticos.length > 0 && (
                                            <div className="mb-5 p-4 bg-red-950/20 rounded-xl border border-red-900/30">
                                                <span className="text-[10px] font-black text-red-400 uppercase flex items-center gap-2 mb-2">
                                                    <AlertTriangle size={12}/> Problema Crítico Principal
                                                </span>
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <p className="text-[11px] font-bold text-white mb-1">{post.report.problemasCriticos[0].problema}</p>
                                                        <p className="text-[10px] text-slate-400">Ação: {post.report.problemasCriticos[0].acao}</p>
                                                    </div>
                                                    <span className="text-[9px] font-black bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/20 uppercase whitespace-nowrap">
                                                        {post.report.problemasCriticos[0].impacto} Impacto
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                                                <span>Progresso da Meta</span>
                                                <span>{post.progress}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                                <div 
                                                    className={`h-full ${post.progress >= 100 ? 'bg-emerald-500' : post.progress > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                                                    style={{ width: `${post.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                                            <span className="flex items-center gap-1"><Calendar size={12}/> Atualizado em: {new Date(post.dataAtualizacao).toLocaleDateString()}</span>
                                            <span className="text-emerald-500 flex items-center gap-1">Clique para Detalhes &rarr;</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        ))}
        {filteredPosts.length === 0 && (
            <div className="text-center py-20 text-slate-500">
                <LayoutDashboard className="mx-auto mb-4 opacity-20" size={48} />
                <p className="text-sm font-bold uppercase">Nenhum indicador encontrado com os filtros atuais.</p>
            </div>
        )}
      </div>

      {/* Modal Completo */}
      {selectedPost && (
        <ReportModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
};