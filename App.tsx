
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Maximize2, X, User, Database, Info, History, TrendingUp, TrendingDown, Minus, Clock, FileText, AlertTriangle, CheckCircle2, Link as LinkIcon, Briefcase, Phone, Mail, ChevronRight, ListChecks, Target, AlertCircle, Calendar, GraduationCap, ShieldAlert, ExternalLink, ArrowRight, LayoutDashboard, Search, Filter, ArrowUpDown } from 'lucide-react';
import { TOPICS } from './constants';
import { Post, TopicId, ChartConfig, ProgressUpdate } from './types';
import { TopicCard } from './components/TopicCard';
import { ChartRenderer } from './components/ChartRenderer';
import { AdminPanel } from './components/AdminPanel';
import { SummaryPanel } from './components/SummaryPanel';
import { ReportModal, SemaforoWithTooltip, TrendBadge } from './components/ReportModal';
import { AIAssistant } from './components/AIAssistant';

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [usingServer, setUsingServer] = useState(true);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/posts');
      if (!response.ok) throw new Error('Erro servidor');
      const json = await response.json();
      const parsedPosts = json.data.map((p: any) => {
         const extra = p.extraData ? JSON.parse(p.extraData) : {};
         return {
           ...p,
           ...extra,
           chartConfig: typeof p.chartConfig === 'string' ? JSON.parse(p.chartConfig) : p.chartConfig
         };
      });

      // Ordenação: Primeiro pelo campo 'order' (crescente), depois por data de criação (decrescente) como fallback
      const sortedPosts = parsedPosts.sort((a: Post, b: Post) => {
          const orderA = a.order !== undefined ? a.order : 99999;
          const orderB = b.order !== undefined ? b.order : 99999;
          
          if (orderA !== orderB) {
              return orderA - orderB;
          }
          return b.createdAt - a.createdAt;
      });

      setPosts(sortedPosts || []);
      setUsingServer(true);
    } catch (err) {
      setUsingServer(false);
      const localData = localStorage.getItem('posts');
      if (localData) {
          const parsedLocal = JSON.parse(localData);
          // Aplica a mesma ordenação para dados locais
          const sortedLocal = parsedLocal.sort((a: Post, b: Post) => {
            const orderA = a.order !== undefined ? a.order : 99999;
            const orderB = b.order !== undefined ? b.order : 99999;
            return orderA - orderB || b.createdAt - a.createdAt;
          });
          setPosts(sortedLocal);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleAddPost = async (topicId: TopicId, description: string, chartConfig: ChartConfig, extraData: any) => {
    // Novos posts vão para o final da lista por padrão (ordem alta)
    const maxOrder = posts.length > 0 ? Math.max(...posts.map(p => p.order || 0)) : 0;
    
    const newPost: Post = {
      id: Date.now().toString(),
      topicId,
      description,
      chartConfig,
      createdAt: Date.now(),
      order: maxOrder + 1,
      ...extraData
    };

    if (usingServer) {
      try {
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPost),
        });
        if (!response.ok) throw new Error('Erro salvar');
        setPosts(prev => [...prev, newPost].sort((a,b) => (a.order||0)-(b.order||0)));
        return true;
      } catch (err) { return false; }
    } else {
      const updated = [...posts, newPost].sort((a,b) => (a.order||0)-(b.order||0));
      setPosts(updated);
      localStorage.setItem('posts', JSON.stringify(updated));
      return true;
    }
  };

  const handleEditPost = async (postId: string, topicId: TopicId, description: string, chartConfig: ChartConfig, extraData: any) => {
    const updatedFields = { topicId, description, chartConfig, ...extraData };
    if (usingServer) {
      try {
        const response = await fetch(`/api/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields),
        });
        if (!response.ok) throw new Error('Erro update');
        // Atualiza e reordena
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updatedFields } : p).sort((a,b) => (a.order||9999)-(b.order||9999)));
        return true;
      } catch (err) { return false; }
    } else {
      const updated = posts.map(p => p.id === postId ? { ...p, ...updatedFields } : p).sort((a,b) => (a.order||9999)-(b.order||9999));
      setPosts(updated);
      localStorage.setItem('posts', JSON.stringify(updated));
      return true;
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (usingServer) {
      await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== postId));
    } else {
      const updated = posts.filter(p => p.id !== postId);
      setPosts(updated);
      localStorage.setItem('posts', JSON.stringify(updated));
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
        <header className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-4">
              <img src="https://pmsgc-goncalinho.wvai75.easypanel.host/brasao.png" className="h-10 w-auto" alt="Logo" />
              <div>
                <h1 className="text-xl font-bold text-white leading-none">Gestão de Indicadores</h1>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Sala de Situação Executiva</span>
              </div>
            </Link>
            <div className="flex items-center gap-3">
                <Link to="/painel" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-emerald-400 border border-slate-700 rounded-lg transition-all active:scale-95 hover:bg-slate-800">
                    <LayoutDashboard size={14} /> Painel
                </Link>
                <button onClick={() => setIsAdminOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-emerald-400 border border-slate-700 rounded-lg transition-all active:scale-95 hover:bg-slate-800">
                    <Lock size={14} /> Gestão
                </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<DashboardView isLoading={isLoading} />} />
            <Route path="/topic/:topicId" element={<TopicDetailView posts={posts} isLoading={isLoading} />} />
            <Route path="/painel" element={<SummaryPanel posts={posts} />} />
          </Routes>
        </main>

        {isAdminOpen && (
          <AdminPanel 
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
            posts={posts}
            onAddPost={handleAddPost}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
            usingServer={usingServer}
          />
        )}
        <AIAssistant />
      </div>
    </Router>
  );
}

const DashboardView = ({ isLoading }: { isLoading: boolean }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-10 py-10">
      <div className="text-center">
        <h2 className="text-4xl font-black text-white mb-2">Painel de Monitoramento - Trismestral</h2>
        <p className="text-slate-400 max-w-xl mx-auto">Acompanhamento transparente das metas e resultados da gestão municipal.</p>
      </div>
      {isLoading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TOPICS.map(topic => <TopicCard key={topic.id} topic={topic} onClick={(id) => navigate(`/topic/${id}`)} />)}
        </div>
      )}
    </div>
  );
};

const TopicDetailView = ({ posts, isLoading }: { posts: Post[], isLoading: boolean }) => {
  const { topicId } = useParams();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['all']);
  const [filterRecorrencia, setFilterRecorrencia] = useState('all');
  const [sortBy, setSortBy] = useState<'default' | 'alpha' | 'status'>('default');

  const topic = TOPICS.find(t => t.id === topicId);
  const topicPosts = posts.filter(p => p.topicId === topicId);

  // Extrair periodicidades únicas para este tópico
  const uniqueRecorrencias = useMemo(() => {
      const recs = new Set(topicPosts.map(p => p.recorrencia).filter(Boolean));
      return Array.from(recs).sort();
  }, [topicPosts]);

  // Lógica de Filtragem e Ordenação
  const processedPosts = useMemo(() => {
      let result = topicPosts.filter(post => {
          const matchesSearch = (post.indicatorName || post.chartConfig.title).toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = filterStatuses.includes('all') || filterStatuses.includes(post.semaforoGeral || 'green');
          const matchesRecorrencia = filterRecorrencia === 'all' || post.recorrencia === filterRecorrencia;
          return matchesSearch && matchesStatus && matchesRecorrencia;
      });

      if (sortBy === 'alpha') {
          result.sort((a, b) => (a.indicatorName || a.chartConfig.title).localeCompare(b.indicatorName || b.chartConfig.title));
      } else if (sortBy === 'status') {
          const weight = { red: 3, yellow: 2, green: 1 };
          result.sort((a, b) => {
              const wa = weight[a.semaforoGeral || 'green'] || 0;
              const wb = weight[b.semaforoGeral || 'green'] || 0;
              return wb - wa; // Críticos primeiro
          });
      }
      // 'default' mantém a ordem original (que já é baseada no campo 'order' do banco)

      return result;
  }, [topicPosts, searchTerm, filterStatuses, filterRecorrencia, sortBy]);

  if (!topic) return <div className="text-center py-20">Não encontrado</div>;

  return (
    <div>
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-6">
        <div>
          <Link to="/" className="text-xs text-slate-500 hover:text-white flex items-center gap-1 mb-2"><ArrowLeft size={12}/> Voltar ao Início</Link>
          <h2 className="text-3xl font-bold">{topic.label}</h2>
          <p className="text-slate-400 mt-1">{topic.description}</p>
        </div>

        {/* Barra de Ferramentas (Filtros e Busca) */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto md:items-center">
            
            {/* Filtro Status */}
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shrink-0 overflow-x-auto w-full sm:w-auto">
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
                        className={`whitespace-nowrap px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase rounded-lg transition-all flex-1 sm:flex-none ${filterStatuses.includes(opt.id) ? `${opt.color} text-white shadow-lg` : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Busca */}
            <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={14} />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full sm:w-40 bg-slate-900 text-white text-xs py-2.5 pl-9 pr-4 rounded-xl border border-slate-800 outline-none focus:border-emerald-500 transition-all font-medium placeholder:text-slate-500"
                />
            </div>

            {/* Filtro Periodicidade */}
            <div className="relative">
                <select 
                    value={filterRecorrencia} 
                    onChange={e => setFilterRecorrencia(e.target.value)}
                    className="w-full sm:w-32 appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-3 pr-8 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-all"
                >
                    <option value="all">Período</option>
                    {uniqueRecorrencias.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={12}/>
            </div>

            {/* Ordenação */}
            <div className="relative">
                <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as any)}
                    className="w-full sm:w-32 appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-3 pr-8 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-all"
                >
                    <option value="default">Padrão</option>
                    <option value="alpha">A-Z</option>
                    <option value="status">Prioridade</option>
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={12}/>
            </div>

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {processedPosts.length > 0 ? processedPosts.map(post => {
            const status = post.semaforoGeral || 'green';
            const rules = post.semaforoRules || { green: 'Normal', yellow: 'Atenção', red: 'Crítico' };
            const progressColor = post.progress >= 100 ? 'bg-emerald-500' : post.progress > 50 ? 'bg-blue-500' : 'bg-amber-500';

            return (
          // Removido overflow-hidden e adicionado rounded-t-3xl no header interno para permitir tooltip
          <div key={post.id} className="bg-slate-900/40 border border-slate-800/60 rounded-3xl hover:border-emerald-500/50 hover:z-20 transition-all flex flex-col h-full group relative">
            
            <div className="p-6 flex items-start justify-between bg-slate-900/80 border-b border-slate-800 relative z-10 rounded-t-3xl">
              <div className="flex items-start gap-5 pr-10 w-full">
                 <div className="mt-1 shrink-0">
                    <SemaforoWithTooltip status={status} rules={rules} sizeClass="w-12 h-12" />
                 </div>
                 
                 <div className="flex-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{post.recorrencia}</span>
                    {/* Exibe o Nome do Indicador (Principal) ou fallback para o Título do Gráfico */}
                    <h3 className="font-bold text-lg text-slate-100 leading-tight mt-1">{post.indicatorName || post.chartConfig.title}</h3>
                 </div>
              </div>
              <button onClick={() => setSelectedPost(post)} className="p-2.5 bg-slate-800 text-slate-400 hover:text-white hover:bg-emerald-600 rounded-xl transition-all absolute top-6 right-6"><Maximize2 size={18}/></button>
            </div>

            <div className="p-6 flex-1 space-y-6">
              {/* Gráfico Reduzido, AUMENTADO DE h-52 PARA h-64 para evitar cortes */}
              <div className="h-64 bg-[#0B1120] rounded-2xl p-4 border border-slate-800/80 shadow-inner overflow-hidden relative group-hover:shadow-[inset_0_0_20px_rgba(16,185,129,0.05)] transition-all">
                <ChartRenderer config={post.chartConfig} />
              </div>

              {/* Barra de Progresso */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  <span>Execução da Meta</span>
                  <span className={`${post.progress >= 100 ? 'text-emerald-400' : 'text-slate-200'}`}>{post.progress}%</span>
                </div>
                <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50 shadow-inner relative">
                  <div className={`h-full ${progressColor} transition-all duration-1000 relative`} style={{ width: `${post.progress}%` }}>
                     <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-50 animate-[pulse_2s_linear_infinite]"></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold border-t border-slate-800 pt-4">
                <span className="flex items-center gap-1.5"><User size={12}/> {post.responsavel}</span>
                <span className="flex items-center gap-1.5"><Clock size={12}/> {new Date(post.dataAtualizacao).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}) : (
            <div className="col-span-1 md:col-span-2 text-center py-20 text-slate-500 bg-slate-900/20 rounded-3xl border border-slate-800 border-dashed">
                <Search className="mx-auto mb-4 opacity-20" size={48} />
                <p className="text-sm font-bold uppercase">Nenhum indicador encontrado com os filtros atuais.</p>
            </div>
        )}
      </div>

      {selectedPost && (
        <ReportModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
};

export default App;
