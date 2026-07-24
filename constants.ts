
import { TopicId, TopicDef, Post } from './types';

export const TOPICS: TopicDef[] = [
  {
    id: TopicId.SAUDE,
    label: 'Saúde',
    iconName: 'HeartPulse',
    color: 'bg-emerald-500', // Verde
    description: 'Indicadores de saúde pública, campanhas e atendimentos.',
  },
  {
    id: TopicId.EDUCACAO,
    label: 'Educação',
    iconName: 'GraduationCap',
    color: 'bg-sky-500', // Azul
    description: 'Dados sobre escolas, alunos, desempenho e infraestrutura escolar.',
  },
  {
    id: TopicId.DESENVOLVIMENTO_SOCIAL,
    label: 'Desenvolvimento Social',
    iconName: 'Users',
    color: 'bg-amber-400', // Amarelo
    description: 'Programas sociais, assistência e inclusão comunitária.',
  },
  {
    id: TopicId.FINANCAS,
    label: 'Finanças e Governança',
    iconName: 'BadgeDollarSign',
    color: 'bg-emerald-600', // Verde Escuro
    description: 'Orçamento, arrecadação e despesas municipais.',
  },
  {
    id: TopicId.ESPORTE_CULTURA_LAZER,
    label: 'Esporte, Cultura e Lazer',
    iconName: 'Trophy',
    color: 'bg-amber-500', // Amarelo/Laranja
    description: 'Eventos esportivos, culturais e áreas de lazer.',
  },
  {
    id: TopicId.AGRICULTURA,
    label: 'Agricultura e Meio Ambiente',
    iconName: 'Sprout',
    color: 'bg-green-600', // Verde
    description: 'Produção rural, apoio ao agricultor e safras.',
  },
  {
    id: TopicId.INFRAESTRUTURA,
    label: 'Infraestrutura',
    iconName: 'HardHat',
    color: 'bg-cyan-600', // Azul Petróleo
    description: 'Obras, pavimentação e manutenção urbana.',
  },
  {
    id: TopicId.PLANEJAMENTO,
    label: 'Planejamento',
    iconName: 'ClipboardList',
    color: 'bg-sky-600', // Azul
    description: 'Metas, diretrizes e projetos futuros.',
  },
];

export const INITIAL_POSTS: Post[] = [];
