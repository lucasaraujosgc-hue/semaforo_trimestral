
export enum TopicId {
  SAUDE = 'saude',
  EDUCACAO = 'educacao',
  DESENVOLVIMENTO_SOCIAL = 'social',
  FINANCAS = 'financas',
  ESPORTE_CULTURA_LAZER = 'esporte',
  AGRICULTURA = 'agricultura',
  INFRAESTRUTURA = 'infraestrutura',
  PLANEJAMENTO = 'planejamento',
}

export interface ProgressUpdate {
  date: number;
  percentage: number;
  whatWasDone: string;
  whatIsMissing: string;
}

export interface SemaforoConfig {
  green: string;
  yellow: string;
  red: string;
}

export interface ReportSection {
  // 1. Identificação & Estratégia
  objetivo: string;
  importanciaPrefeito: string;
  formula: string;
  acaoCrise: string; // Ação automática se RED
  
  secretaria: string;
  periodo: string;
  responsavelPolitico: string;
  responsavelTecnico: string;
  pontoFocal: {
    nome: string;
    cargo: string;
    telefone: string;
    email: string;
  };

  // 2. Resumo Executivo
  resumoAvanços: string;
  resumoAtrasos: string;
  resumoDecisoes: string;

  // 3. Dados do Gráfico (Gerenciado via ChartConfig, mas referenciado aqui logicamente)

  // 5. Informações do Indicador (Antigo Indicadores Secundários)
  // Campos personalizáveis do cabeçalho da tabela
  headerIndicador?: string;
  headerResultado?: string;
  headerMeta?: string;
  headerExtra?: string; // Novo cabeçalho opcional
  showExtraColumn?: boolean; // Controle de visibilidade da coluna extra

  // Campos: Resultado atual, Meta (trimestre/ano), Extra, Sinal (🟢/🟡/🔴), Tendência (↑/→/↓) e Fonte do dado
  indicadoresChave: Array<{
    nome: string; // Nome do indicador/Variável
    resultado: string;
    meta: string;
    extra?: string; // Nova coluna extra
    status: 'green' | 'yellow' | 'red'; // Sinal
    tendencia: 'up' | 'stable' | 'down';
    fonte: string;
  }>;

  // 6. Metas Prioritárias
  metasPrioritarias: Array<{
    meta: string;
    prazo: string;
    responsavel: string;
    status: 'green' | 'yellow' | 'red';
    evidencia: string; // Link/Foto/SEI
    obs: string; // Observação objetiva
  }>;

  // 7. Problemas Críticos
  problemasCriticos: Array<{
    problema: string;
    impacto: 'Alto' | 'Médio' | 'Baixo';
    causa: string;
    acao: string;
    prazo: string;
  }>;

  // 6. Decisões Prefeito (Mantido no index 7 logicamente ou grupo de problemas)
  decisoesPrefeito: Array<{
    tema: string;
    decisao: string;
    consequencia: string;
    prazo: string;
  }>;

  // 8. Riscos e Alertas
  riscos: {
    tipos: string[];
    descricao: string;
  };

  // 9. Compromissos Próximo Período
  compromissos: Array<{
    compromisso: string;
    prazo: string;
    responsavel: string;
    evidencia: string;
  }>;

  // 10. Configuração de Layout (Novo)
  layout?: {
    chartWidthPercent: number; // Porcentagem de largura do gráfico (ex: 40)
    isVertical: boolean; // Se verdadeiro, empilha gráfico e tabela
    order: 'chart-first' | 'table-first'; // Quem aparece primeiro/esquerda
  };

  // 11. Anexos
  anexos: string;
}

export interface ExternalChartData {
  labels: string[];
  series: Array<{
    name?: string;
    label?: string;
    data: any[];
    type?: 'bar' | 'line';
    color?: string;
    yAxis?: 'left' | 'right';
  }>;
  yAxes?: {
    left?: { title?: string };
    right?: { title?: string };
  };
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie';
  title: string;
  barLabel?: string; // Nome da série de barras (ex: Realizado)
  lineLabel?: string; // Nome da série de linha (ex: Meta)
  data?: any; // Array de objetos { label, value, color }
  // Nova estrutura para Múltiplas Linhas
  multiLineSeries?: Array<{
    label: string;
    color: string;
    data: Array<{ x: string; y: number; signal?: 'green' | 'yellow' | 'red' | 'none' }>;
  }>;
  referenceLine?: string; // New field for reference line
  series?: any[];
  color?: string; // Cor padrão
  options?: any;
}

export interface Post {
  id: string;
  topicId: TopicId;
  indicatorName?: string; // Nome principal do Indicador (Cabeçalho)
  description: string;
  chartConfig: ChartConfig;
  createdAt: number;
  order?: number; // Campo para ordenação personalizada
  
  responsavel: string;
  fonteOficial: string;
  recorrencia: string;
  dataAtualizacao: number;
  lastEditor?: string; // Novo campo para rastrear quem editou
  
  semaforoRules: SemaforoConfig;
  semaforoGeral: 'green' | 'yellow' | 'red'; // Novo campo para o card da lista
  
  progress: number;
  progressHistory: ProgressUpdate[];
  report: ReportSection;
}

export interface TopicDef {
  id: TopicId;
  label: string;
  iconName: string;
  color: string;
  description: string;
}
