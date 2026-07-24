import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { ChartConfig } from '../types';

interface AddPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (description: string, chartData: ChartConfig) => void;
}

const DEFAULT_JSON_TEMPLATE = `{
  "chart": {
    "type": "bar",
    "title": "Novo Gráfico",
    "data": [
      { "label": "Janeiro", "value": 10 },
      { "label": "Fevereiro", "value": 20 }
    ]
  }
}`;

export const AddPostModal: React.FC<AddPostModalProps> = ({ isOpen, onClose, onSave }) => {
  const [description, setDescription] = useState('');
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON_TEMPLATE);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      let parsed = JSON.parse(jsonInput);
      
      // Inteligência para detectar se o usuário colou { chart: { ... } } ou direto { type: ... }
      let config: ChartConfig;

      if (parsed.chart) {
        config = parsed.chart;
      } else {
        config = parsed;
      }

      // Validação básica
      if (!config.type || !config.data || !Array.isArray(config.data)) {
        throw new Error("O JSON deve conter 'type' e uma lista 'data'.");
      }

      onSave(description, config);
      
      // Reset form
      setDescription('');
      setJsonInput(DEFAULT_JSON_TEMPLATE);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao processar JSON. Verifique a sintaxe.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Novo Indicador</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Descreva o contexto deste gráfico..."
              rows={3}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Configuração do Gráfico (JSON)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Você pode colar o código completo iniciando com <code>{`{ "chart": ... }`}</code> ou apenas a configuração interna.
            </p>
            <div className="relative">
              <textarea
                required
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full p-3 font-mono text-sm bg-gray-900 text-green-400 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-64"
                spellCheck={false}
              />
            </div>
            {error && (
              <div className="mt-2 text-red-600 text-sm flex items-center gap-2 bg-red-50 p-2 rounded">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all hover:shadow-md"
            >
              Publicar Gráfico
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};