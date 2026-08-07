import React, { useState, useRef } from 'react';
import { X, Trash2, Plus, Lock, TrendingUp, TrendingDown, Minus, History, ShieldAlert, Target, AlertTriangle, Calendar, FileText, Info, ListChecks, Clock, CheckCircle2, AlertCircle, ClipboardList, Pencil, BookOpen, AlertOctagon, GraduationCap, Link as LinkIcon, PieChart, BarChart, LineChart, GripVertical, Filter, ToggleLeft, ToggleRight, Code, Upload, FileSpreadsheet, LayoutTemplate, ArrowLeftRight, ArrowUpDown, Columns, Layers, Check, Search } from 'lucide-react';
import { ChartConfig, Post, TopicId, SemaforoConfig, ProgressUpdate, ReportSection } from '../types';
import { TOPICS } from '../constants';
import { read, utils } from 'xlsx';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onAddPost: (topicId: TopicId, description: string, chartConfig: ChartConfig, extra: any) => Promise<boolean | void>;
  onEditPost: (postId: string, topicId: TopicId, description: string, chartConfig: ChartConfig, extra: any) => Promise<boolean | void>;
  onDeletePost: (postId: string) => void;
  usingServer: boolean;
}

const INITIAL_REPORT: ReportSection = {
  // Novos campos estratégicos
  objetivo: '', importanciaPrefeito: '', formula: '', acaoCrise: '',
  responsavelTecnico: '', 

  secretaria: '', periodo: '', responsavelPolitico: '', 
  pontoFocal: { nome: '', cargo: '', telefone: '', email: '' },
  resumoAvanços: '', resumoAtrasos: '', resumoDecisoes: '',
  
  // Cabeçalhos personalizáveis (com defaults)
  headerIndicador: 'Indicador',
  headerResultado: 'Resultado',
  headerMeta: 'Meta',
  headerExtra: 'Variação', 
  showExtraColumn: false, // Default: oculta
  
  indicadoresChave: [], metasPrioritarias: [], problemasCriticos: [], decisoesPrefeito: [],
  riscos: { tipos: [], descricao: '' }, compromissos: [], anexos: '',

  // Layout Default
  layout: {
      chartWidthPercent: 40,
      isVertical: false,
      order: 'chart-first'
  }
};

const INITIAL_SEMAFORO: SemaforoConfig = {
  green: 'Matrículas consolidadas e validadas no sistema',
  yellow: 'Pendências de validação / risco de inconsistência',
  red: 'Matrículas não lançadas ou rejeitadas pelo sistema'
};

const USERS_MAP: Record<string, string> = {
  'azul': 'Lucas Araujo dos Santos',
  'amarelo': 'Gilda Natali Mendes dos Santos Lemos',
  'preto': 'Ana Paula Daltro Oliveira',
  'rosa': 'Maiara dos Santos Maia'
};

const CHART_TYPES: { id: 'bar' | 'line' | 'pie'; label: string; icon: any }[] = [
  { id: 'bar', label: 'Barras', icon: BarChart },
  { id: 'line', label: 'Linha', icon: LineChart },
  { id: 'pie', label: 'Pizza', icon: PieChart },
];

const RECURRENCE_OPTIONS = [
    'Diário', 'Semanal', 'Quinzenal', 'Mensal', 
    'Trimestral', 'Quadrimestral', 'Semestral', 'Anual'
];

// --- Helpers de Formatação ---
const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const handleCurrencyInput = (value: string): number => {
  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, '');
  // Divide por 100 para considerar os centavos
  return (parseInt(digits) || 0) / 100;
};
// -----------------------------

// Interface auxiliar para o State de Múltiplas Linhas
interface LineSeriesState {
  id: string; // Para manipulação interna
  label: string;
  color: string;
  data: Array<{ x: string; y: number; signal?: 'green' | 'yellow' | 'red' | 'none' }>;
}

interface BuilderRow {
  label: string;
  barValue: number;
  lineValue: number;
  color: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  isOpen, onClose, posts, onAddPost, onEditPost, onDeletePost
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [formStep, setFormStep] = useState<number>(1);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // Filter State
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Sort State
  const [sortOrder, setSortOrder] = useState<'default' | 'alpha'>('default');

  // Drag and Drop State
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form State
  const [indicatorName, setIndicatorName] = useState(''); // Nome do Indicador (Cabeçalho)
  const [chartTitle, setChartTitle] = useState(''); // Título do Gráfico (Interno)
  const [description, setDescription] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicId>(TopicId.EDUCACAO);
  const [responsavel, setResponsavel] = useState('');
  const [fonteOficial, setFonteOficial] = useState('');
  const [recorrencia, setRecorrencia] = useState('Mensal');
  
  // Novo State: Semáforo Geral e Tipo de Gráfico
  const [semaforoGeral, setSemaforoGeral] = useState<'green'|'yellow'|'red'>('green');
  const [chartType, setChartType] = useState<'bar'|'line'|'pie'>('bar');
  
  // Labels Customizados para o Gráfico (BARRAS)
  const [barLabel, setBarLabel] = useState('Realizado');
  const [lineLabel, setLineLabel] = useState('Meta');

  // Controle de exibição da coluna de Linha (BARRAS)
  const [showLineData, setShowLineData] = useState(false);

  // Divisor vertical do gráfico
  const [referenceLine, setReferenceLine] = useState('');

  // JSON Mode State (Passo 3)
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // Quick JSON Edit Modal
  const [quickJsonModal, setQuickJsonModal] = useState<{ isOpen: boolean, postId: string, json: string }>({ isOpen: false, postId: '', json: '' });

  // File Upload Ref (Passo 5)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [semaforoRules, setSemaforoRules] = useState<SemaforoConfig>(INITIAL_SEMAFORO);
  const [report, setReport] = useState<ReportSection>(INITIAL_REPORT);
  const [progress, setProgress] = useState(0);
  const [progressHistory, setProgressHistory] = useState<ProgressUpdate[]>([]);
  
  // Builder rows (BARRAS): Agora suporta barValue e lineValue
  const [builderRows, setBuilderRows] = useState<BuilderRow[]>([{ label: 'Mês 1', barValue: 0, lineValue: 0, color: '#10b981' }]);

  // Builder Series (LINHAS): State para múltiplas séries
  const [lineSeries, setLineSeries] = useState<LineSeriesState[]>([
    { 
      id: '1', 
      label: 'Série 1', 
      color: '#10b981', 
      data: [{ x: 'Jan', y: 0 }, { x: 'Fev', y: 0 }] 
    }
  ]);

  // Risco Personalizado
  const [customRiskInput, setCustomRiskInput] = useState('');
  const [isAddingCustomRisk, setIsAddingCustomRisk] = useState(false);

  // State para Nova Movimentação (Step 9)
  const [newMoveDate, setNewMoveDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMovePct, setNewMovePct] = useState<number | ''>('');
  const [newMoveDone, setNewMoveDone] = useState('');
  const [newMoveMissing, setNewMoveMissing] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const normalizedPass = passwordInput.trim().toLowerCase();
    
    if (USERS_MAP[normalizedPass]) {
      setIsAuthenticated(true);
      setCurrentUser(USERS_MAP[normalizedPass]);
    } else {
      setLoginError('Senha incorreta.');
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const handleEditClick = (post: Post) => {
    setEditingPostId(post.id);
    setSelectedTopic(post.topicId);
    
    // Separando Nome do Indicador do Título do Gráfico
    setIndicatorName(post.indicatorName || post.chartConfig.title);
    setChartTitle(post.chartConfig.title);

    setDescription(post.description);
    setResponsavel(post.responsavel || '');
    setFonteOficial(post.fonteOficial || '');
    setRecorrencia(post.recorrencia || 'Mensal');
    setSemaforoRules(post.semaforoRules || INITIAL_SEMAFORO);
    setSemaforoGeral(post.semaforoGeral || 'green');
    setChartType(post.chartConfig.type || 'bar');
    
    // Carrega Labels customizados
    setBarLabel(post.chartConfig.barLabel || 'Realizado');
    setLineLabel(post.chartConfig.lineLabel || 'Meta');
    setReferenceLine(post.chartConfig.referenceLine || '');
    
    // Lógica para determinar se a coluna extra deve ser mostrada em posts antigos
    const shouldShowExtra = post.report.showExtraColumn !== undefined 
        ? post.report.showExtraColumn 
        : (!!post.report.headerExtra || post.report.indicadoresChave.some((i: any) => i.extra));

    setReport({ 
        ...INITIAL_REPORT, 
        ...post.report,
        showExtraColumn: shouldShowExtra,
        layout: post.report.layout || INITIAL_REPORT.layout
    });
    setProgress(post.progress || 0);
    setProgressHistory(post.progressHistory || []);

    // Inicializa JSON Mode se necessário
    setJsonInput(JSON.stringify(post.chartConfig, null, 2));

    // Lógica de Carregamento de Dados (Barras vs Linhas)
    if (post.chartConfig.multiLineSeries) {
        // Carrega séries de linhas
        const loadedSeries = post.chartConfig.multiLineSeries.map((s, idx) => ({
            id: String(idx),
            label: s.label,
            color: s.color,
            data: s.data
        }));
        setLineSeries(loadedSeries);
        // Limpa builder de barras para evitar confusão, embora não seja estritamente necessário
        setBuilderRows([]); 
    } else if (Array.isArray(post.chartConfig.data)) {
        // Carrega builder de barras/pizza (Legacy ou Padrão)
        const hasLine = post.chartConfig.data.some((d: any) => d.lineValue !== undefined && d.lineValue !== null && d.lineValue !== '');
        setShowLineData(hasLine);

        const loadedData = post.chartConfig.data.map((d: any) => ({
            label: d.label,
            color: d.color || '#10b981',
            barValue: d.barValue !== undefined ? d.barValue : (d.Valor !== undefined ? d.Valor : 0),
            lineValue: d.lineValue || 0
        }));
        setBuilderRows(loadedData);
        // Reseta linhas para default
        setLineSeries([{ id: '1', label: 'Série 1', color: '#10b981', data: [{ x: 'Jan', y: 0 }] }]);
    } else {
        setBuilderRows([]);
        setShowLineData(false);
    }
    
    setActiveTab('add');
    setFormStep(1);
    setIsJsonMode(false); 
  };

  const handleSubmit = async () => {
    let config: ChartConfig;

    if (isJsonMode) {
        try {
            config = JSON.parse(jsonInput);
        } catch (e) {
            alert('Erro no JSON do Gráfico. Verifique a sintaxe.');
            return;
        }
    } else {
        // Constrói o Config baseado no Tipo selecionado
        if (chartType === 'line') {
             // Modo Múltiplas Linhas
             const cleanedSeries = lineSeries.map(s => ({
                 label: s.label,
                 color: s.color,
                 data: s.data
             }));

             config = {
                 type: 'line',
                 title: chartTitle,
                 multiLineSeries: cleanedSeries,
                 referenceLine: referenceLine || undefined,
                 data: [] // Deixa vazio para não confundir o renderer legado
             };
        } else {
            // Modo Barras/Pizza
            const cleanData = builderRows.map(row => {
                const { lineValue, ...rest } = row;
                if (showLineData) {
                    return row;
                }
                return rest; 
            });

            config = { 
                type: chartType, 
                title: chartTitle, 
                barLabel,  
                lineLabel: showLineData ? lineLabel : undefined, 
                referenceLine: referenceLine || undefined,
                data: cleanData 
            };
        }
    }
    
    const finalReport = {
      ...report,
      responsavelPolitico: responsavel,
    };
    
    const extra = { 
        indicatorName, 
        responsavel, 
        fonteOficial, 
        recorrencia, 
        dataAtualizacao: Date.now(), 
        semaforoRules, 
        semaforoGeral, 
        progress, 
        progressHistory, 
        report: finalReport,
        lastEditor: currentUser 
    };
    
    let success;
    if (editingPostId) success = await onEditPost(editingPostId, selectedTopic, description, config, extra);
    else success = await onAddPost(selectedTopic, description, config, extra);
    
    if (success !== false) {
      setEditingPostId(null); 
      setIndicatorName('');
      setChartTitle('');
      setReport(INITIAL_REPORT); 
      setActiveTab('list');
      setBuilderRows([{ label: 'Mês 1', barValue: 0, lineValue: 0, color: '#10b981' }]); 
      setLineSeries([{ id: '1', label: 'Série 1', color: '#10b981', data: [{ x: 'Jan', y: 0 }] }]);
      setBarLabel('Realizado');
      setLineLabel('Meta');
      setShowLineData(false);
      setReferenceLine('');
      setIsJsonMode(false);
      setJsonInput('');
      setProgress(0); setProgressHistory([]);
    }
  };

  const toggleRecorrencia = (option: string) => {
      // Divide por vírgula para manter consistência, permitindo edição manual
      const current = recorrencia ? recorrencia.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (current.includes(option)) {
          setRecorrencia(current.filter(i => i !== option).join(', '));
      } else {
          setRecorrencia([...current, option].join(', '));
      }
  };

  const addProgressMove = () => {
    if (newMovePct === '') return;
    const dateObj = new Date(newMoveDate);
    const utcDate = new Date(dateObj.valueOf() + dateObj.getTimezoneOffset() * 60000).getTime();

    const update: ProgressUpdate = {
      date: utcDate,
      percentage: Number(newMovePct),
      whatWasDone: newMoveDone,
      whatIsMissing: newMoveMissing
    };
    setProgress(Number(newMovePct));
    setProgressHistory([update, ...progressHistory]);
    setNewMovePct('');
    setNewMoveDone('');
    setNewMoveMissing('');
  };

  const addCustomRisk = () => {
    if (customRiskInput.trim()) {
        const newTypes = [...report.riscos.tipos, customRiskInput.trim()];
        setReport({...report, riscos: {...report.riscos, tipos: newTypes}});
        setCustomRiskInput('');
        setIsAddingCustomRisk(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = utils.sheet_to_json(ws, { header: 1 }); 

        const statusMap: Record<string, 'green' | 'yellow' | 'red'> = {
            'v': 'green', 'verde': 'green',
            'a': 'yellow', 'amarelo': 'yellow',
            'red': 'red', 'vermelho': 'red', 'r': 'red'
        };

        const trendMap: Record<string, 'up' | 'stable' | 'down'> = {
            'c': 'up', 'crescimento': 'up',
            'e': 'stable', 'estavel': 'stable', 'estável': 'stable',
            'q': 'down', 'queda': 'down'
        };
        
        let foundExtraColumn = false;

        const rows = data.slice(1).map((row: any) => {
             const extraVal = row[3] || '';
             if (extraVal) foundExtraColumn = true;
             return {
                 nome: row[0] || '',
                 resultado: row[1] || '',
                 meta: row[2] || '',
                 extra: extraVal, 
                 status: statusMap[String(row[4]).toLowerCase()] || 'green',
                 tendencia: trendMap[String(row[5]).toLowerCase()] || 'stable',
                 fonte: row[6] || ''
             };
        }).filter(r => r.nome); 

        if (rows.length > 0) {
            setReport(prev => ({
                ...prev,
                showExtraColumn: foundExtraColumn || prev.showExtraColumn, 
                indicadoresChave: [...prev.indicadoresChave, ...rows]
            }));
            alert(`${rows.length} indicadores importados com sucesso! ${foundExtraColumn ? '(Coluna Extra identificada e ativada)' : ''}`);
        } else {
            alert('Nenhum dado válido encontrado na planilha.');
        }
      };
      
      reader.readAsBinaryString(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filtragem e Ordenação
  const filteredPosts = posts
    .filter(p => filterTopic === 'all' || p.topicId === filterTopic)
    .filter(p => {
        if (!searchTerm) return true;
        const name = p.indicatorName || p.chartConfig.title || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
        if (sortOrder === 'alpha') {
            const nameA = a.indicatorName || a.chartConfig.title || '';
            const nameB = b.indicatorName || b.chartConfig.title || '';
            return nameA.localeCompare(nameB);
        }
        // Default: A lista já vem ordenada pelo App.tsx baseado no campo 'order' ou data
        return 0; 
    });
  
  // Helpers para Múltiplas Linhas
  const addLineSeries = () => {
      setLineSeries([...lineSeries, {
          id: Date.now().toString(),
          label: `Série ${lineSeries.length + 1}`,
          color: '#3b82f6',
          data: [{ x: 'Jan', y: 0 }]
      }]);
  };

  const removeLineSeries = (index: number) => {
      if (lineSeries.length > 1) {
          setLineSeries(lineSeries.filter((_, i) => i !== index));
      }
  };

  const addPointToSeries = (seriesIndex: number) => {
      const newSeries = [...lineSeries];
      newSeries[seriesIndex].data.push({ x: 'Novo', y: 0 });
      setLineSeries(newSeries);
  };

  const removePointFromSeries = (seriesIndex: number, pointIndex: number) => {
      const newSeries = [...lineSeries];
      if (newSeries[seriesIndex].data.length > 1) {
          newSeries[seriesIndex].data = newSeries[seriesIndex].data.filter((_, i) => i !== pointIndex);
          setLineSeries(newSeries);
      }
  };

  const updateSeriesField = (index: number, field: keyof LineSeriesState, value: any) => {
      const newSeries = [...lineSeries];
      (newSeries[index] as any)[field] = value;
      setLineSeries(newSeries);
  };

  const updateSeriesPoint = (seriesIndex: number, pointIndex: number, field: 'x' | 'y' | 'signal', value: any) => {
      const newSeries = [...lineSeries];
      (newSeries[seriesIndex].data[pointIndex] as any)[field] = value;
      setLineSeries(newSeries);
  };

  // Drag and Drop Logic
  const handleSort = async () => {
    // Bloqueia ordenação se estiver em modo alfabético
    if (sortOrder === 'alpha') return;

    if (dragItem.current === null || dragOverItem.current === null) return;
    const draggedIdx = dragItem.current;
    const overIdx = dragOverItem.current;
    if (draggedIdx === overIdx) return;
    dragItem.current = null;
    dragOverItem.current = null;
    setIsDragging(false);
    let updates: Post[] = [];
    if (filterTopic === 'all') {
        const _posts = [...posts];
        // Destructure safely to ensure we get an element and type is inferred correctly
        const [draggedContent] = _posts.splice(draggedIdx, 1);
        if (draggedContent) {
            _posts.splice(overIdx, 0, draggedContent);
            for (let i = 0; i < _posts.length; i++) {
                if (_posts[i].order !== i) updates.push({ ..._posts[i], order: i, lastEditor: currentUser });
            }
        }
    } else {
        const currentVisible = [...filteredPosts];
        const availableSlots = currentVisible.map(p => p.order !== undefined ? p.order : 0);
        const [draggedContent] = currentVisible.splice(draggedIdx, 1);
        if (draggedContent) {
            currentVisible.splice(overIdx, 0, draggedContent);
            for (let i = 0; i < currentVisible.length; i++) {
                const p = currentVisible[i];
                const targetOrder = availableSlots[i];
                if (p.order !== targetOrder) updates.push({ ...p, order: targetOrder, lastEditor: currentUser });
            }
        }
    }
    for (const updatedPost of updates) {
        await onEditPost(updatedPost.id, updatedPost.topicId, updatedPost.description, updatedPost.chartConfig, {
            ...updatedPost,
            report: updatedPost.report,
            progress: updatedPost.progress,
            progressHistory: updatedPost.progressHistory,
            lastEditor: updatedPost.lastEditor,
            order: updatedPost.order
        });
    }
  };

  const jsonImportInputRef = useRef<HTMLInputElement>(null);

  const handleJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        try {
          const content = evt.target?.result as string;
          const data = JSON.parse(content);
          
          const response = await fetch('/api/posts/import', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(data)
          });
          const result = await response.json();
          if (response.ok) {
             alert(`Importação concluída: ${result.success} importados com sucesso, ${result.errors} erros.`);
             window.location.reload(); // Recarregar para buscar os novos posts
          } else {
             alert(`Erro na importação: ${result.error}`);
          }
        } catch (err: any) {
          alert('Erro ao processar arquivo JSON: ' + err.message);
        }
      };
      
      reader.readAsText(file);
      if (jsonImportInputRef.current) jsonImportInputRef.current.value = '';
    }
  };

  if (!isAuthenticated) {
     return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 md:p-12 w-full max-w-sm text-center space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20"><Lock className="text-emerald-400" size={32}/></div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Gestão Técnica</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input type="password" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setLoginError(''); }} placeholder="Senha" className={`w-full p-4 bg-slate-950 border ${loginError ? 'border-red-500' : 'border-slate-800'} rounded-2xl text-white text-center font-black outline-none focus:ring-2 focus:ring-emerald-500`} autoFocus />
              {loginError && <p className="text-red-400 text-xs font-bold mt-2">{loginError}</p>}
            </div>
            <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase hover:bg-emerald-500 transition-all">Acessar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-[2rem] w-full max-w-6xl h-[95vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2"><ClipboardList className="text-emerald-500" /> Sala de Lançamento</h2>
            <div className="flex flex-col">
                 <span className="text-[10px] text-slate-500 font-bold uppercase">Logado como:</span>
                 <span className="text-xs text-emerald-400 font-black uppercase">{currentUser}</span>
            </div>
            <div className="flex bg-slate-800/50 p-1.5 rounded-2xl">
              <button onClick={() => setActiveTab('add')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'add' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{editingPostId ? 'Editar' : 'Novo'}</button>
              <button onClick={() => setActiveTab('list')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>Catálogo</button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X size={24}/></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'add' && (
            <div className="w-64 bg-slate-900/30 border-r border-slate-800 p-6 flex flex-col gap-2 overflow-y-auto hidden md:flex">
              {[
                { id: 1, label: '1. Definição', icon: BookOpen },
                { id: 2, label: '2. Semáforo', icon: AlertOctagon },
                { id: 3, label: '3. Dados & Gráfico', icon: TrendingUp },
                { id: 4, label: '4. Resumo Exec.', icon: FileText },
                { id: 5, label: '5. Informações', icon: ListChecks }, 
                { id: 7, label: '7. Prob. & Decisões', icon: AlertTriangle },
                { id: 10, label: '10. Layout', icon: LayoutTemplate },
              ].map(step => (
                <button key={step.id} onClick={() => setFormStep(step.id)} className={`flex items-center gap-3 p-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-left transition-all ${formStep === step.id ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                  <step.icon size={16} className={formStep === step.id ? 'text-emerald-400' : 'text-slate-600'} />
                  {step.label}
                </button>
              ))}
              <div className="mt-auto pt-6 border-t border-slate-800">
                <button onClick={handleSubmit} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all active:scale-95">Salvar</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
            {activeTab === 'add' ? (
              <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
                
                {/* Steps 1 e 2 mantidos implicitamente iguais, vamos direto ao Step 3 */}
                {formStep === 1 && (
                  // ... (Mantido igual ao original)
                  <div className="space-y-8">
                    <h3 className="text-2xl font-black text-white border-b border-slate-800 pb-4">1. Definição Estratégica</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase">Nome do Indicador (Cabeçalho)</label>
                         <input value={indicatorName} onChange={e => setIndicatorName(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-bold" />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase">Área</label>
                         <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value as TopicId)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-bold">
                            {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                         </select>
                       </div>
                    </div>
                    
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                         <label className="text-[10px] font-black text-slate-500 uppercase">Status Geral do Indicador (Aparece na Lista)</label>
                         <div className="flex gap-4">
                            {(['green', 'yellow', 'red'] as const).map(color => (
                                <button
                                    key={color}
                                    onClick={() => setSemaforoGeral(color)}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${semaforoGeral === color 
                                        ? (color === 'green' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : color === 'yellow' ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-red-500 bg-red-500/20 text-red-400') 
                                        : 'border-slate-800 bg-slate-950 text-slate-600 hover:border-slate-700'}`}
                                >
                                    <div className={`w-3 h-3 rounded-full ${color === 'green' ? 'bg-emerald-500' : color === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                    <span className="font-bold uppercase text-xs">{color === 'green' ? 'Normal' : color === 'yellow' ? 'Atenção' : 'Crítico'}</span>
                                </button>
                            ))}
                         </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Objetivo</label>
                        <textarea value={report.objetivo} onChange={e => setReport({...report, objetivo: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" rows={2} />
                    </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Por que é crítico?</label>
                        <textarea value={report.importanciaPrefeito} onChange={e => setReport({...report, importanciaPrefeito: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" rows={2} />
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Fórmula</label>
                            <input value={report.formula} onChange={e => setReport({...report, formula: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Fonte do Dado</label>
                            <input value={fonteOficial} onChange={e => setFonteOficial(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" />
                        </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Periodicidade</label>
                            <input 
                                value={recorrencia} 
                                onChange={e => setRecorrencia(e.target.value)} 
                                className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm mb-2" 
                                placeholder="Ex: Mensal (Dia 5)"
                            />
                            <div className="flex flex-wrap gap-2">
                                {RECURRENCE_OPTIONS.map(opt => {
                                    // Verifica se a opção está inclusa na string atual para destacar o botão
                                    const isSelected = recorrencia ? recorrencia.split(',').map(s => s.trim()).includes(opt) : false;
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => toggleRecorrencia(opt)}
                                            className={`px-3 py-2 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${
                                                isSelected 
                                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50' 
                                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-white hover:border-slate-700'
                                            }`}
                                        >
                                            {isSelected && <Check size={12} />}
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Resp. Político</label>
                            <input value={responsavel} onChange={e => setResponsavel(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Resp. Técnico</label>
                            <input value={report.responsavelTecnico} onChange={e => setReport({...report, responsavelTecnico: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" />
                        </div>
                    </div>
                  </div>
                )}
                
                {formStep === 2 && (
                    <div className="space-y-8">
                        <h3 className="text-2xl font-black text-white border-b border-slate-800 pb-4">2. Regras de Calibração</h3>
                         <div className="space-y-6">
                            <div className="flex gap-4 items-start bg-emerald-950/20 p-6 rounded-2xl border border-emerald-900/50">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] shrink-0 mt-1"></div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Verde</label>
                                    <input value={semaforoRules.green} onChange={e => setSemaforoRules({...semaforoRules, green: e.target.value})} className="w-full p-3 bg-slate-950 border border-emerald-900/50 rounded-xl text-white text-sm" />
                                </div>
                            </div>
                            <div className="flex gap-4 items-start bg-amber-950/20 p-6 rounded-2xl border border-amber-900/50">
                                <div className="w-8 h-8 rounded-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] shrink-0 mt-1"></div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Amarelo</label>
                                    <input value={semaforoRules.yellow} onChange={e => setSemaforoRules({...semaforoRules, yellow: e.target.value})} className="w-full p-3 bg-slate-950 border border-amber-900/50 rounded-xl text-white text-sm" />
                                </div>
                            </div>
                            <div className="flex gap-4 items-start bg-red-950/20 p-6 rounded-2xl border border-red-900/50">
                                <div className="w-8 h-8 rounded-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] shrink-0 mt-1"></div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest">Vermelho</label>
                                    <input value={semaforoRules.red} onChange={e => setSemaforoRules({...semaforoRules, red: e.target.value})} className="w-full p-3 bg-slate-950 border border-red-900/50 rounded-xl text-white text-sm" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-800 mt-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 flex items-center gap-2"><ShieldAlert size={14}/> Ação Automática se Vermelho (Crise)</label>
                                <textarea value={report.acaoCrise} onChange={e => setReport({...report, acaoCrise: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm" />
                            </div>
                        </div>
                    </div>
                )}

                {formStep === 3 && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                            <h3 className="text-2xl font-black text-white">3. Dados e Visualização</h3>
                            <button 
                                onClick={() => {
                                    if (!isJsonMode) {
                                        const cleanData = builderRows.map(row => {
                                            const { lineValue, ...rest } = row;
                                            return showLineData ? row : rest;
                                        });
                                        const currentConfig = { 
                                            type: chartType, 
                                            title: chartTitle, 
                                            barLabel: chartType === 'bar' ? barLabel : undefined,  
                                            lineLabel: chartType === 'bar' && showLineData ? lineLabel : undefined, 
                                            data: chartType === 'line' ? [] : cleanData, // Se for linha, usa multiLineSeries
                                            multiLineSeries: chartType === 'line' ? lineSeries.map(s => ({ label: s.label, color: s.color, data: s.data })) : undefined,
                                            referenceLine: referenceLine || undefined
                                        };
                                        setJsonInput(JSON.stringify(currentConfig, null, 2));
                                    }
                                    setIsJsonMode(!isJsonMode);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${isJsonMode ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                                <Code size={16} /> {isJsonMode ? 'Voltar ao Assistente' : 'Modo Avançado (JSON)'}
                            </button>
                        </div>
                        
                        {isJsonMode ? (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                    <p className="text-sm text-slate-400 mb-2">Edite o JSON de configuração diretamente. Use isso para gráficos complexos.</p>
                                    <textarea 
                                        value={jsonInput} 
                                        onChange={e => setJsonInput(e.target.value)}
                                        className="w-full h-96 bg-slate-950 font-mono text-xs text-green-400 p-4 rounded-xl border border-slate-800 outline-none focus:border-emerald-500"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase">Título do Gráfico (Legenda Interna)</label>
                                    <input 
                                        value={chartTitle} 
                                        onChange={e => setChartTitle(e.target.value)} 
                                        className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-white font-bold" 
                                        placeholder="Ex: Evolução Mensal"
                                    />
                                </div>
                                
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-3">Tipo de Visualização</label>
                                    <div className="flex gap-3">
                                        {CHART_TYPES.map(t => (
                                            <button 
                                                key={t.id} 
                                                onClick={() => setChartType(t.id)}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase transition-all ${chartType === t.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-white'}`}
                                            >
                                                <t.icon size={16}/> {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RENDERIZAÇÃO CONDICIONAL BASEADA NO TIPO DE GRÁFICO */}
                            
                            {chartType === 'line' ? (
                                // --- BUILDER PARA LINHAS (MÚLTIPLAS SÉRIES) ---
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="flex justify-between items-center py-4 border-b border-slate-800">
                                        <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2"><Layers size={18}/> Séries de Dados</h4>
                                        <button onClick={addLineSeries} className="text-xs font-black uppercase text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-2 transition-all">
                                            <Plus size={14}/> Nova Série
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-8">
                                        {lineSeries.map((series, idx) => (
                                            <div key={series.id} className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 relative group">
                                                <div className="absolute -top-3 left-6 bg-slate-900 px-2 text-[10px] font-black uppercase text-slate-500 tracking-widest border border-slate-800 rounded">
                                                    Série #{idx + 1}
                                                </div>
                                                <button 
                                                    onClick={() => removeLineSeries(idx)}
                                                    className="absolute top-4 right-4 p-2 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Remover Série"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>

                                                <div className="grid md:grid-cols-2 gap-4 mb-6">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-600 uppercase">Nome da Linha</label>
                                                        <input 
                                                            value={series.label} 
                                                            onChange={e => updateSeriesField(idx, 'label', e.target.value)} 
                                                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white text-sm font-bold" 
                                                            placeholder="Ex: 2023"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-600 uppercase">Cor da Linha</label>
                                                        <div className="flex items-center gap-3">
                                                            <input 
                                                                type="color" 
                                                                value={series.color} 
                                                                onChange={e => updateSeriesField(idx, 'color', e.target.value)} 
                                                                className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-none" 
                                                            />
                                                            <span className="text-xs text-slate-500 uppercase font-mono">{series.color}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-600 uppercase block">Pontos (Eixo X / Eixo Y)</label>
                                                    <div className="space-y-2 pl-4 border-l-2 border-slate-800">
                                                        {series.data.map((point, pIdx) => (
                                                            <div key={pIdx} className="flex gap-2 items-center">
                                                                <input 
                                                                    value={point.x} 
                                                                    onChange={e => updateSeriesPoint(idx, pIdx, 'x', e.target.value)}
                                                                    className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-slate-300 text-xs" 
                                                                    placeholder="Eixo X (ex: Jan)"
                                                                />
                                                                <input 
                                                                    type="text"
                                                                    value={formatCurrency(point.y)} 
                                                                    onChange={e => updateSeriesPoint(idx, pIdx, 'y', handleCurrencyInput(e.target.value))}
                                                                    className="w-24 bg-slate-950 border border-slate-800 p-2 rounded-lg text-emerald-400 text-xs font-bold text-right" 
                                                                    placeholder="Valor"
                                                                />
                                                                <select
                                                                    value={point.signal || 'none'}
                                                                    onChange={e => updateSeriesPoint(idx, pIdx, 'signal', e.target.value === 'none' ? undefined : e.target.value)}
                                                                    className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs"
                                                                >
                                                                    <option value="none">Sinal</option>
                                                                    <option value="green">🟢</option>
                                                                    <option value="yellow">🟡</option>
                                                                    <option value="red">🔴</option>
                                                                </select>
                                                                <button onClick={() => removePointFromSeries(idx, pIdx)} className="p-1.5 text-slate-700 hover:text-red-500"><X size={14}/></button>
                                                            </div>
                                                        ))}
                                                        <button onClick={() => addPointToSeries(idx)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2">
                                                            <Plus size={12}/> Adicionar Ponto
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-4 mt-4 border-t border-slate-800">
                                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Divisor Vertical (Opcional - Rótulo do Eixo X)</label>
                                        <input 
                                            value={referenceLine} 
                                            onChange={e => setReferenceLine(e.target.value)} 
                                            className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-bold" 
                                            placeholder="Ex: Março (Deixe vazio para não usar)"
                                        />
                                    </div>
                                </div>
                            ) : (
                                // --- BUILDER PADRÃO (BARRAS / PIZZA) ---
                                <div className="space-y-6 animate-in fade-in">
                                    {chartType === 'bar' && (
                                    <>
                                        <div className="flex justify-between items-center py-4 border-t border-b border-slate-800">
                                            <span className="text-xs font-bold text-slate-400 flex items-center gap-2"><TrendingUp size={16}/> Adicionar Linha de Comparativo/Meta?</span>
                                            <button 
                                                onClick={() => setShowLineData(!showLineData)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${showLineData ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-slate-900 text-slate-600 border border-slate-800'}`}
                                            >
                                                {showLineData ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}
                                                {showLineData ? 'Ativado' : 'Desativado'}
                                            </button>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-emerald-400 uppercase">Legenda da Barra (Principal)</label>
                                                <input 
                                                    value={barLabel} 
                                                    onChange={e => setBarLabel(e.target.value)} 
                                                    className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-xs font-bold" 
                                                    placeholder="Ex: Realizado"
                                                />
                                            </div>
                                            {showLineData && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                                                    <label className="text-[10px] font-black text-amber-400 uppercase">Legenda da Linha (Meta/Secundário)</label>
                                                    <input 
                                                        value={lineLabel} 
                                                        onChange={e => setLineLabel(e.target.value)} 
                                                        className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-xs font-bold" 
                                                        placeholder="Ex: Meta"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                    )}

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pontos de Dados</h4>
                                        <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
                                            {builderRows.map((r, i) => (
                                            <div key={i} className="flex gap-2 mb-2 items-center">
                                                <div className="flex-1 min-w-[100px]">
                                                    <input value={r.label} onChange={e => { const n = [...builderRows]; n[i].label = e.target.value; setBuilderRows(n); }} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white text-xs" placeholder="Rótulo (Ex: Jan)" />
                                                </div>
                                                <div className="w-32">
                                                    <input 
                                                        type="text" 
                                                        value={formatCurrency(r.barValue || 0)} 
                                                        onChange={e => { const n = [...builderRows]; n[i].barValue = handleCurrencyInput(e.target.value); setBuilderRows(n); }} 
                                                        className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-emerald-400 text-xs font-bold text-right" 
                                                        placeholder="Valor" 
                                                    />
                                                </div>
                                                {/* Opção para Linha/Meta */}
                                                {chartType === 'bar' && showLineData && (
                                                    <div className="w-32 animate-in fade-in slide-in-from-right-4">
                                                        <input 
                                                            type="text" 
                                                            value={formatCurrency(r.lineValue || 0)} 
                                                            onChange={e => { const n = [...builderRows]; n[i].lineValue = handleCurrencyInput(e.target.value); setBuilderRows(n); }} 
                                                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-amber-400 text-xs font-bold text-right" 
                                                            placeholder="Meta/Linha" 
                                                        />
                                                    </div>
                                                )}

                                                <div className="relative w-10 h-10 overflow-hidden rounded-xl border border-slate-800 shrink-0">
                                                    <input type="color" value={r.color || '#10b981'} onChange={e => { const n = [...builderRows]; n[i].color = e.target.value; setBuilderRows(n); }} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" />
                                                </div>
                                                <button onClick={() => setBuilderRows(builderRows.filter((_, idx) => idx !== i))} className="p-2 text-slate-700 hover:text-red-500"><X size={18}/></button>
                                            </div>
                                            ))}
                                            <button onClick={() => setBuilderRows([...builderRows, {label: '', barValue: 0, lineValue: 0, color: '#10b981'}])} className="text-[10px] font-black text-emerald-400 mt-2 uppercase flex items-center gap-1"><Plus size={14}/> Adicionar Ponto</button>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-800">
                                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Divisor Vertical (Opcional - Rótulo do Eixo X)</label>
                                        <input 
                                            value={referenceLine} 
                                            onChange={e => setReferenceLine(e.target.value)} 
                                            className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-bold" 
                                            placeholder="Ex: Março (Deixe vazio para não usar)"
                                        />
                                    </div>
                                </div>
                            )}

                            </>
                        )}
                    </div>
                )}
                
                {formStep === 4 && (
                    <div className="space-y-6">
                    <h3 className="text-2xl font-black text-white border-b border-slate-800 pb-4">4. Resumo Executivo</h3>
                    <div className="space-y-6">
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">Avanços</label>
                        <textarea value={report.resumoAvanços} onChange={e => setReport({...report, resumoAvanços: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white h-24" />
                        </div>
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">Atrasos</label>
                        <textarea value={report.resumoAtrasos} onChange={e => setReport({...report, resumoAtrasos: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white h-24" />
                        </div>
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">Decisões Necessárias</label>
                        <textarea value={report.resumoDecisoes} onChange={e => setReport({...report, resumoDecisoes: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white h-24" />
                        </div>
                    </div>
                    </div>
                )}
                
                {formStep === 5 && (
                    <div className="space-y-8">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                        <h3 className="text-2xl font-black text-white">5. Informações do Indicador</h3>
                        <div className="flex items-center gap-2">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                accept=".xlsx, .xls" 
                                className="hidden" 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-green-900/20"
                            >
                                <FileSpreadsheet size={16} /> Importar Excel (.xlsx)
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end mb-2">
                        {!report.showExtraColumn && (
                            <button 
                                onClick={() => setReport({...report, showExtraColumn: true})} 
                                className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all"
                            >
                                <Plus size={12}/> Adicionar Coluna Personalizada
                            </button>
                        )}
                    </div>
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl overflow-x-auto">
                        <table className="w-full text-xs text-left min-w-[800px]">
                            <thead className="bg-slate-950 text-slate-500 font-black uppercase">
                            <tr>
                                <th className="p-4 min-w-[150px]">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-700 mb-1">EDITÁVEL</span>
                                        <input 
                                            value={report.headerIndicador} 
                                            onChange={e => setReport({...report, headerIndicador: e.target.value})} 
                                            className="bg-transparent border-b border-slate-800 focus:border-emerald-500 outline-none w-full uppercase text-slate-500 focus:text-emerald-400 transition-colors cursor-text" 
                                            placeholder="Indicador"
                                        />
                                    </div>
                                </th>
                                <th className="p-4 min-w-[100px]">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-700 mb-1">EDITÁVEL</span>
                                         <input 
                                            value={report.headerResultado} 
                                            onChange={e => setReport({...report, headerResultado: e.target.value})} 
                                            className="bg-transparent border-b border-slate-800 focus:border-emerald-500 outline-none w-full uppercase text-slate-500 focus:text-emerald-400 transition-colors cursor-text" 
                                            placeholder="Resultado"
                                        />
                                    </div>
                                </th>
                                <th className="p-4 min-w-[100px]">
                                     <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-700 mb-1">EDITÁVEL</span>
                                         <input 
                                            value={report.headerMeta} 
                                            onChange={e => setReport({...report, headerMeta: e.target.value})} 
                                            className="bg-transparent border-b border-slate-800 focus:border-emerald-500 outline-none w-full uppercase text-slate-500 focus:text-emerald-400 transition-colors cursor-text" 
                                            placeholder="Meta"
                                        />
                                    </div>
                                </th>
                                {report.showExtraColumn && (
                                    <th className="p-4 min-w-[100px] bg-slate-900/50 relative group/header">
                                        <div className="flex flex-col">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-emerald-500/50">NOVO! EDITÁVEL</span>
                                                <button 
                                                    onClick={() => setReport({...report, showExtraColumn: false})}
                                                    className="opacity-0 group-hover/header:opacity-100 transition-opacity text-slate-600 hover:text-red-500"
                                                    title="Remover Coluna"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>
                                            <input 
                                                value={report.headerExtra} 
                                                onChange={e => setReport({...report, headerExtra: e.target.value})} 
                                                className="bg-transparent border-b border-slate-800 focus:border-emerald-500 outline-none w-full uppercase text-emerald-400 focus:text-emerald-300 transition-colors cursor-text font-bold" 
                                                placeholder="Extra"
                                            />
                                        </div>
                                    </th>
                                )}
                                <th className="p-4">Sinal</th>
                                <th className="p-4">Tendência</th>
                                <th className="p-4">Fonte</th>
                                <th className="p-4"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                            {report.indicadoresChave.map((ind, i) => (
                                <tr key={i} className="hover:bg-slate-800/20">
                                <td className="p-2"><input value={ind.nome} onChange={e => { const n = [...report.indicadoresChave]; n[i].nome = e.target.value; setReport({...report, indicadoresChave: n}); }} className="w-full bg-transparent p-2 text-white outline-none" placeholder="Nome" /></td>
                                <td className="p-2"><input value={ind.resultado} onChange={e => { const n = [...report.indicadoresChave]; n[i].resultado = e.target.value; setReport({...report, indicadoresChave: n}); }} className="w-full bg-transparent p-2 text-emerald-400 font-bold outline-none" placeholder="100%" /></td>
                                <td className="p-2"><input value={ind.meta} onChange={e => { const n = [...report.indicadoresChave]; n[i].meta = e.target.value; setReport({...report, indicadoresChave: n}); }} className="w-full bg-transparent p-2 text-slate-400 outline-none" placeholder="120%" /></td>
                                {report.showExtraColumn && (
                                    <td className="p-2 bg-slate-900/30"><input value={ind.extra || ''} onChange={e => { const n = [...report.indicadoresChave]; n[i].extra = e.target.value; setReport({...report, indicadoresChave: n}); }} className="w-full bg-transparent p-2 text-amber-200 outline-none font-medium" placeholder="-" /></td>
                                )}
                                <td className="p-2">
                                    <select value={ind.status} onChange={e => { const n = [...report.indicadoresChave]; n[i].status = e.target.value as 'green' | 'yellow' | 'red'; setReport({...report, indicadoresChave: n}); }} className="bg-slate-950 text-white rounded p-1 outline-none text-[10px]">
                                    <option value="green">🟢</option>
                                    <option value="yellow">🟡</option>
                                    <option value="red">🔴</option>
                                    </select>
                                </td>
                                <td className="p-2">
                                    <div className="relative">
                                        <select value={ind.tendencia} onChange={e => { const n = [...report.indicadoresChave]; n[i].tendencia = e.target.value as 'up' | 'stable' | 'down'; setReport({...report, indicadoresChave: n}); }} className="bg-slate-950 text-white rounded p-1 outline-none text-[10px] appearance-none pl-6 pr-2">
                                        <option value="up">Crescimento</option>
                                        <option value="stable">Estável</option>
                                        <option value="down">Queda</option>
                                        </select>
                                        <div className="absolute left-1 top-1.5 pointer-events-none">
                                        {ind.tendencia === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
                                        {ind.tendencia === 'down' && <TrendingDown size={12} className="text-red-500" />}
                                        {ind.tendencia === 'stable' && <Minus size={12} className="text-slate-500" />}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-2"><input value={ind.fonte} onChange={e => { const n = [...report.indicadoresChave]; n[i].fonte = e.target.value; setReport({...report, indicadoresChave: n}); }} className="w-full bg-transparent p-2 text-slate-500 outline-none" placeholder="Fonte" /></td>
                                <td className="p-2 text-center"><button onClick={() => setReport({...report, indicadoresChave: report.indicadoresChave.filter((_, idx) => idx !== i)})} className="text-slate-600 hover:text-red-500"><Trash2 size={14}/></button></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <button onClick={() => setReport({...report, indicadoresChave: [...report.indicadoresChave, {nome: '', meta: '', resultado: '', status: 'green', tendencia: 'stable', fonte: ''}]})} className="w-full p-4 bg-slate-800 text-xs font-black uppercase text-emerald-400 hover:bg-slate-700 transition-all">+ Nova Linha de Informação</button>
                    </div>
                    </div>
                )}
                

                {formStep === 7 && (
                  <div className="space-y-8">
                    <h3 className="text-2xl font-black text-white border-b border-slate-800 pb-4">7. Problemas e Decisões</h3>
                    <div>
                        <h4 className="text-sm font-bold text-slate-400 mb-2">Problemas Críticos</h4>
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl mb-8">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-950 text-slate-500 font-black uppercase">
                            <tr>
                                <th className="p-4">Problema</th>
                                <th className="p-4 w-32">Impacto</th>
                                <th className="p-4">Causa Provável</th>
                                <th className="p-4">Ação Corretiva</th>
                                <th className="p-4 w-32">Prazo</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                            {report.problemasCriticos.map((p, i) => (
                                <tr key={i}>
                                <td className="p-2"><input value={p.problema} onChange={e => { const n = [...report.problemasCriticos]; n[i].problema = e.target.value; setReport({...report, problemasCriticos: n}); }} className="w-full bg-transparent p-2 text-white outline-none" placeholder="Problema" /></td>
                                
                                <td className="p-2">
                                    <select value={p.impacto} onChange={e => { const n = [...report.problemasCriticos]; n[i].impacto = e.target.value as 'Alto' | 'Médio' | 'Baixo'; setReport({...report, problemasCriticos: n}); }} className="w-full bg-slate-950 text-white rounded p-2 outline-none">
                                        <option value="Alto">Alto</option>
                                        <option value="Médio">Médio</option>
                                        <option value="Baixo">Baixo</option>
                                    </select>
                                </td>

                                <td className="p-2"><input value={p.causa} onChange={e => { const n = [...report.problemasCriticos]; n[i].causa = e.target.value; setReport({...report, problemasCriticos: n}); }} className="w-full bg-transparent p-2 text-slate-400 outline-none" placeholder="Causa raiz" /></td>

                                <td className="p-2"><input value={p.acao} onChange={e => { const n = [...report.problemasCriticos]; n[i].acao = e.target.value; setReport({...report, problemasCriticos: n}); }} className="w-full bg-transparent p-2 text-emerald-400 outline-none" placeholder="Ação" /></td>

                                <td className="p-2"><input value={p.prazo} onChange={e => { const n = [...report.problemasCriticos]; n[i].prazo = e.target.value; setReport({...report, problemasCriticos: n}); }} className="w-full bg-transparent p-2 text-slate-400 outline-none" placeholder="Prazo" /></td>

                                <td className="p-2"><button onClick={() => setReport({...report, problemasCriticos: report.problemasCriticos.filter((_, idx) => idx !== i)})} className="text-slate-600 hover:text-red-500"><Trash2 size={14}/></button></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <button onClick={() => setReport({...report, problemasCriticos: [...report.problemasCriticos, {problema: '', impacto: 'Alto', causa: '', acao: '', prazo: ''}]})} className="w-full p-4 bg-slate-800 text-xs font-black uppercase text-emerald-400 hover:bg-slate-700 transition-all">+ Problema</button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-400 mb-2">Decisões do Prefeito</h4>
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-950 text-slate-500 font-black uppercase">
                            <tr><th className="p-4">Tema</th><th className="p-4">Decisão</th><th className="p-4"></th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                            {report.decisoesPrefeito.map((d, i) => (
                                <tr key={i}>
                                <td className="p-2"><input value={d.tema} onChange={e => { const n = [...report.decisoesPrefeito]; n[i].tema = e.target.value; setReport({...report, decisoesPrefeito: n}); }} className="w-full bg-transparent p-2 text-white outline-none" placeholder="Tema" /></td>
                                <td className="p-2"><input value={d.decisao} onChange={e => { const n = [...report.decisoesPrefeito]; n[i].decisao = e.target.value; setReport({...report, decisoesPrefeito: n}); }} className="w-full bg-transparent p-2 text-white outline-none" placeholder="Decisão" /></td>
                                <td className="p-2"><button onClick={() => setReport({...report, decisoesPrefeito: report.decisoesPrefeito.filter((_, idx) => idx !== i)})} className="text-slate-600 hover:text-red-500"><Trash2 size={14}/></button></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <button onClick={() => setReport({...report, decisoesPrefeito: [...report.decisoesPrefeito, {tema: '', decisao: '', consequencia: '', prazo: ''}]})} className="w-full p-4 bg-slate-800 text-xs font-black uppercase text-emerald-400 hover:bg-slate-700 transition-all">+ Decisão</button>
                        </div>
                    </div>
                  </div>
                )}


                
                {formStep === 10 && (
                  <div className="space-y-8">
                      <h3 className="text-2xl font-black text-white border-b border-slate-800 pb-4">10. Layout e Aparência</h3>
                      <div className="grid md:grid-cols-2 gap-8">
                          
                          <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl space-y-8">
                              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <ArrowLeftRight size={18} className="text-emerald-500"/> Largura do Gráfico vs. Tabela
                              </h4>
                              
                              <div className="space-y-4">
                                  <div className="flex justify-between items-end">
                                      <span className="text-xs font-black text-white">{report.layout?.chartWidthPercent || 40}% Gráfico</span>
                                      <span className="text-xs font-black text-white">{100 - (report.layout?.chartWidthPercent || 40)}% Tabela</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="20" 
                                    max="80" 
                                    value={report.layout?.chartWidthPercent || 40} 
                                    onChange={e => setReport({
                                        ...report, 
                                        layout: { ...report.layout!, chartWidthPercent: Number(e.target.value) }
                                    })}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                                  />
                                  <p className="text-[10px] text-slate-500 italic">Arraste para definir a proporção inicial entre o gráfico e a área de informações.</p>
                              </div>
                          </div>

                          <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl space-y-8">
                               <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <ArrowUpDown size={18} className="text-emerald-500"/> Orientação
                               </h4>
                               
                               <div className="flex gap-4">
                                   <button 
                                      onClick={() => setReport({ ...report, layout: { ...report.layout!, isVertical: false } })}
                                      className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${!report.layout?.isVertical ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-950 text-slate-600'}`}
                                   >
                                       <div className="flex gap-1 items-center">
                                           <div className="w-8 h-8 bg-current rounded opacity-50"></div>
                                           <div className="w-12 h-8 bg-current rounded opacity-50"></div>
                                       </div>
                                       <span className="text-xs font-bold uppercase">Lado a Lado</span>
                                   </button>
                                   <button 
                                      onClick={() => setReport({ ...report, layout: { ...report.layout!, isVertical: true } })}
                                      className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${report.layout?.isVertical ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-950 text-slate-600'}`}
                                   >
                                       <div className="flex flex-col gap-1 items-center">
                                           <div className="w-8 h-8 bg-current rounded opacity-50"></div>
                                           <div className="w-8 h-8 bg-current rounded opacity-50"></div>
                                       </div>
                                       <span className="text-xs font-bold uppercase">Empilhado</span>
                                   </button>
                               </div>

                               <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-8">
                                  Ordem de Exibição
                               </h4>
                               <div className="flex gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                                   <button 
                                      onClick={() => setReport({ ...report, layout: { ...report.layout!, order: 'chart-first' } })}
                                      className={`flex-1 py-2 rounded text-[10px] font-black uppercase transition-all ${report.layout?.order === 'chart-first' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                   >
                                      Gráfico 1º
                                   </button>
                                   <button 
                                      onClick={() => setReport({ ...report, layout: { ...report.layout!, order: 'table-first' } })}
                                      className={`flex-1 py-2 rounded text-[10px] font-black uppercase transition-all ${report.layout?.order === 'table-first' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                   >
                                      Tabela 1º
                                   </button>
                               </div>
                          </div>

                      </div>
                  </div>
                )}
              </div>
            ) : (
              // Modo Lista (Catálogo)
              // ... (Mantido igual)
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-6 px-4">
                    <div>
                         <h3 className="text-2xl font-black text-white">Catálogo</h3>
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{filteredPosts.length} Cadastrados</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <input 
                           type="file" 
                           accept=".json" 
                           ref={jsonImportInputRef} 
                           onChange={handleJSONImport} 
                           className="hidden" 
                        />
                        <button 
                           onClick={() => jsonImportInputRef.current?.click()}
                           className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all"
                        >
                           Importar JSON
                        </button>
                        <button 
                           onClick={async () => {
                               if(window.confirm('Tem certeza que deseja excluir TODOS os indicadores cadastrados? Isso apagará todas as importações.')) {
                                   try {
                                       const response = await fetch('/api/posts', { method: 'DELETE' });
                                       if(response.ok) {
                                           window.location.reload();
                                       }
                                   } catch(e) {
                                       alert('Erro ao excluir tudo.');
                                   }
                               }
                           }}
                           className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all"
                        >
                           Excluir Tudo
                        </button>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input 
                                type="text" 
                                placeholder="Buscar indicador..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-56 bg-slate-900 text-white text-xs font-bold pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-500 placeholder:font-medium"
                            />
                        </div>

                        <div className="relative">
                            <select 
                                value={sortOrder} 
                                onChange={e => setSortOrder(e.target.value as any)}
                                className="appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-10 pr-8 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-colors"
                            >
                                <option value="default">Personalizado</option>
                                <option value="alpha">A - Z</option>
                            </select>
                            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-t-4 border-l-4 border-r-4 border-transparent border-t-slate-500"></div>
                        </div>

                        <div className="relative">
                            <select 
                                value={filterTopic} 
                                onChange={e => setFilterTopic(e.target.value)}
                                className="appearance-none bg-slate-900 text-white text-xs font-bold uppercase pl-10 pr-8 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-800 transition-colors"
                            >
                                <option value="all">Todas as Áreas</option>
                                {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-t-4 border-l-4 border-r-4 border-transparent border-t-slate-500"></div>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {filteredPosts.map((post, index) => (
                    <div 
                        key={post.id} 
                        className={`bg-slate-900/40 p-6 rounded-3xl border flex items-center justify-between group transition-all ${isDragging ? 'opacity-50 border-dashed border-slate-700' : 'border-slate-800 hover:border-emerald-500/30'}`}
                        draggable={sortOrder === 'default'}
                        onDragStart={() => { dragItem.current = index; setIsDragging(true); }}
                        onDragEnter={() => { dragOverItem.current = index; }}
                        onDragEnd={handleSort}
                        onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center gap-6">
                         {/* Grip Handle for Dragging */}
                         {sortOrder === 'default' && (
                             <div className="p-2 rounded cursor-grab active:cursor-grabbing text-slate-600 hover:text-white">
                                 <GripVertical size={20} />
                             </div>
                         )}

                        <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 group-hover:scale-105 transition-all relative">
                          <span className="text-[10px] font-black text-slate-600">{post.topicId.substring(0,3).toUpperCase()}</span>
                          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${post.semaforoGeral === 'yellow' ? 'bg-amber-500' : post.semaforoGeral === 'red' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-100 text-lg leading-none mb-1">{post.indicatorName || post.chartConfig.title}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{post.responsavel} • {new Date(post.dataAtualizacao).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setQuickJsonModal({ isOpen: true, postId: post.id, json: JSON.stringify(post.chartConfig, null, 2) })} className="p-3 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-xl transition-all"><Code size={18}/></button>
                        <button onClick={() => handleEditClick(post)} className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all"><Pencil size={18}/></button>
                        <button onClick={() => onDeletePost(post.id)} className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {quickJsonModal.isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-black text-xl text-white flex items-center gap-2"><Code size={24} className="text-purple-400" /> Editor Avançado JSON</h3>
                    <button onClick={() => setQuickJsonModal({ isOpen: false, postId: '', json: '' })} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="p-6 bg-slate-950 flex-1">
                    <textarea 
                        value={quickJsonModal.json}
                        onChange={e => setQuickJsonModal({ ...quickJsonModal, json: e.target.value })}
                        className="w-full h-[400px] bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-xl border border-slate-800 outline-none focus:border-purple-500"
                    />
                </div>
                <div className="p-6 border-t border-slate-800 flex justify-end">
                    <button 
                        onClick={() => {
                            try {
                                const parsed = JSON.parse(quickJsonModal.json);
                                const targetPost = posts.find(p => p.id === quickJsonModal.postId);
                                if(targetPost) {
                                    onEditPost(
                                        targetPost.id, 
                                        targetPost.topicId, 
                                        targetPost.description, 
                                        parsed, 
                                        {
                                            indicatorName: targetPost.indicatorName,
                                            responsavel: targetPost.responsavel,
                                            fonteOficial: targetPost.fonteOficial,
                                            recorrencia: targetPost.recorrencia,
                                            dataAtualizacao: targetPost.dataAtualizacao,
                                            semaforoRules: targetPost.semaforoRules,
                                            semaforoGeral: targetPost.semaforoGeral,
                                            report: targetPost.report,
                                            progress: targetPost.progress,
                                            progressHistory: targetPost.progressHistory
                                        }
                                    );
                                    setQuickJsonModal({ isOpen: false, postId: '', json: '' });
                                }
                            } catch(e) {
                                alert('JSON Inválido! Verifique a sintaxe.');
                            }
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center gap-2"
                    >
                        Salvar JSON
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};