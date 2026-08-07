import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { ChartConfig, ExternalChartData } from '../types';

interface ChartRendererProps {
  config: ChartConfig;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
};

// Estilos padronizados do Tooltip
const tooltipContentStyle = { backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#f8fafc' };
const tooltipItemStyle = { color: '#fbbf24', fontWeight: 'bold', fontSize: '13px' }; // Amber-400

// --- NOVO COMPONENTE DE TOOLTIP CUSTOMIZADO ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={tooltipContentStyle} className="p-3 shadow-xl min-w-[180px]">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex justify-between items-center gap-4 py-1">
            <span style={{ color: entry.color || entry.payload.fill || '#fff' }} className="text-xs font-bold">
              {entry.name}:
            </span>
            <span style={tooltipItemStyle}>
              {formatValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Custom Dot para Sinais ---
const CustomDot = (props: any) => {
  const { cx, cy, payload, dataKey, stroke } = props;
  const signal = payload[`${dataKey}_signal`];
  
  if (signal) {
    let emoji = '';
    if (signal === 'green') emoji = '🟢';
    if (signal === 'yellow') emoji = '🟡';
    if (signal === 'red') emoji = '🔴';

    if (emoji) {
      return (
        <svg x={cx - 10} y={cy - 10} width={20} height={20} viewBox="0 0 20 20">
           <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="12">{emoji}</text>
        </svg>
      );
    }
  }

  // Fallback default dot
  return <circle cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill="#020617" />;
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({ config }) => {
  const { type, color: mainColor, barLabel, lineLabel, title } = config;

  const { processedData, dataKeys, isComplex, complexConfig, isMultiLine, multiLineSeriesConfig } = useMemo(() => {
    try {
        // CASO ESPECIAL: Múltiplas Linhas (Estrutura Nova)
        if (config.multiLineSeries && Array.isArray(config.multiLineSeries) && config.multiLineSeries.length > 0) {
            const allXLabels = Array.from(new Set(
                config.multiLineSeries.flatMap(s => s.data.map(d => d.x))
            ));
            
            const mergedData = allXLabels.map(label => {
                const row: any = { label };
                config.multiLineSeries!.forEach(s => {
                    const point = s.data.find(d => d.x === label);
                    if (point) {
                        row[s.label] = point.y;
                        if (point.signal) {
                            row[`${s.label}_signal`] = point.signal;
                        }
                    }
                });
                return row;
            });

            return {
                processedData: mergedData,
                dataKeys: config.multiLineSeries.map(s => s.label),
                isComplex: false,
                isMultiLine: true,
                multiLineSeriesConfig: config.multiLineSeries
            };
        }

      // CASO 0: Formato Complexo (Legado)
      if (config.data && !Array.isArray(config.data) && typeof config.data === 'object') {
        const extData = config.data as any; 
        
        if ('labels' in extData || 'series' in extData) {
          const labels = Array.isArray(extData.labels) ? extData.labels : [];
          const series = Array.isArray(extData.series) ? extData.series : [];
          
          const normalized = labels.map((label: string, index: number) => {
            const item: any = { label };
            series.forEach((s: any, sIndex: number) => {
              if (!s) return;
              const key = s.name || s.label || `series_${sIndex}`;
              const val = (Array.isArray(s.data) && s.data[index] !== undefined) ? s.data[index] : null;
              item[key] = val;
            });
            return item;
          });

          const keys = series
            .filter((s: any) => s)
            .map((s: any) => s.name || s.label || 'unknown');

          return {
            processedData: normalized,
            dataKeys: keys,
            isComplex: true,
            complexConfig: extData as ExternalChartData
          };
        }
      }

      // CASO 1: Formato "Nested Values"
      if (config.data && Array.isArray(config.data) && config.data.length > 0) {
        const firstItem = config.data[0];
        if (firstItem && 'values' in firstItem && Array.isArray(firstItem.values)) {
          const seriesList = config.data as any[];
          const uniqueLabels = new Set<string>();

          seriesList.forEach(series => {
            if (Array.isArray(series.values)) {
              series.values.forEach((v: any) => {
                const xAxisLabel = v.city || v.label;
                if (xAxisLabel) uniqueLabels.add(xAxisLabel);
              });
            }
          });

          const normalized = Array.from(uniqueLabels).map(xAxisLabel => {
            const row: any = { label: xAxisLabel };
            seriesList.forEach(series => {
              const seriesName = series.label || series.name || 'Unnamed';
              const point = series.values?.find((v: any) => (v.city || v.label) === xAxisLabel);
              if (point) {
                row[seriesName] = point.value;
              }
            });
            return row;
          });

          const keys = seriesList.map(s => s.label || s.name || 'Unknown');

          return { processedData: normalized, dataKeys: keys, isComplex: false };
        }
      }

      // CASO 2: Formato "Series" (Antigo)
      if (config.series && Array.isArray(config.series)) {
        const allLabels = new Set<string>();
        config.series.forEach(s => s.data.forEach(d => allLabels.add(d.label)));
        
        const normalized = Array.from(allLabels).map(label => {
          const item: any = { label };
          config.series?.forEach(s => {
            const point = s.data.find(d => d.label === label);
            if (point) {
              item[s.name] = point.value;
            }
          });
          return item;
        });

        return {
          processedData: normalized,
          dataKeys: config.series.map(s => s.name),
          isComplex: false
        };
      }

      // CASO 3: Formato "Flat"
      if (config.data && Array.isArray(config.data) && config.data.length > 0) {
        const first = config.data[0];
        if (!('values' in first) && !('series' in first)) {
          if (first.barValue !== undefined || first.lineValue !== undefined) {
               return { processedData: config.data, dataKeys: ['barValue', 'lineValue'], isComplex: false };
          }

          const keys = Object.keys(first).filter(k => k !== 'label' && k !== 'city' && k !== 'color');
          const normalized = config.data.map((item: any) => ({
            ...item,
            label: item.label || item.city || 'Unknown'
          }));

          return { processedData: normalized, dataKeys: keys, isComplex: false };
        }
      }

      return { processedData: [], dataKeys: [], isComplex: false };

    } catch (e) {
      console.error("Erro ao processar dados do gráfico:", e);
      return { processedData: [], dataKeys: [], isComplex: false };
    }
  }, [config]);

  const renderChart = () => {
    if (!processedData || processedData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Sem dados para exibir
        </div>
      );
    }

    const commonMargin = { top: 20, right: 30, bottom: 20, left: 50 };
    const domainWithPadding: [number, any] = [0, (dataMax: number) => Math.ceil(dataMax * 1.05)];

    let refNextLabel: string | undefined = undefined;
    if (config.referenceLine && processedData.length > 0) {
      const idx = processedData.findIndex((d: any) => d.label === config.referenceLine);
      if (idx !== -1 && idx < processedData.length - 1) {
         refNextLabel = processedData[idx + 1].label;
      }
    }

    const renderCustomDivider = (props: any) => {
      const { viewBox, stroke, strokeDasharray } = props;
      if (!viewBox) return null;
      const x = viewBox.x + (viewBox.width || 0) / 2;
      return (
        <g>
          <line 
            x1={x} y1={viewBox.y} 
            x2={x} y2={viewBox.y + viewBox.height} 
            stroke={stroke || "#f1f5f9"} 
            strokeDasharray={strokeDasharray} 
            strokeWidth={2}
          />
          <text x={x} y={viewBox.y} dy={-10} fill={stroke || "#f1f5f9"} fontSize={10} textAnchor="middle">
            Divisor
          </text>
        </g>
      );
    };

    const renderReferenceElement = () => {
       if (!config.referenceLine) return null;
       if (refNextLabel) {
           return <ReferenceArea x1={config.referenceLine} x2={refNextLabel} stroke="#f1f5f9" strokeDasharray="3 3" shape={renderCustomDivider} />;
       }
       return <ReferenceLine x={config.referenceLine} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth={2} label={{ position: 'top', fill: '#f1f5f9', value: 'Divisor', fontSize: 10 }} />;
    };

    // Renderização MultiLine
    if (isMultiLine && multiLineSeriesConfig) {
        return (
            <LineChart data={processedData} margin={commonMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={true} />
                {renderReferenceElement()}
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} padding={{ left: 20, right: 20 }} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} domain={domainWithPadding} tickFormatter={formatValue} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                {multiLineSeriesConfig.map((series, index) => (
                    <Line 
                        key={series.label} 
                        type="monotone" 
                        dataKey={series.label} 
                        name={series.label} 
                        stroke={series.color || COLORS[index % COLORS.length]} 
                        strokeWidth={3} 
                        dot={<CustomDot />} 
                        activeDot={{ r: 6 }} 
                    />
                ))}
            </LineChart>
        );
    }

    // Renderização Mista (barValue/lineValue)
    if (processedData.length > 0 && (processedData[0].barValue !== undefined || processedData[0].lineValue !== undefined)) {
        const hasLineData = processedData.some((d: any) => d.lineValue !== undefined && d.lineValue !== null);
        
        if (type === 'pie') {
             return (
              <PieChart>
                 <Pie
                  data={processedData} cx="50%" cy="50%" labelLine={false}
                  label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : null}
                  outerRadius={80} dataKey="barValue" nameKey="label"
                >
                  {processedData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            );
        }

        if (type === 'line') {
             return (
                <ComposedChart data={processedData} margin={commonMargin}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={true} />
                  {renderReferenceElement()}
                  <XAxis dataKey="label" scale="point" padding={{ left: 60, right: 60 }} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={domainWithPadding} tickFormatter={formatValue} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="barValue" name={barLabel || "Valor"} stroke={mainColor || '#10b981'} strokeWidth={3} dot={{ r: 4 }} />
                  {hasLineData && (
                    <Line type="monotone" dataKey="lineValue" name={lineLabel || "Meta"} stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} strokeDasharray="5 5" />
                  )}
                </ComposedChart>
            );
        }

        return (
            <ComposedChart data={processedData} margin={commonMargin} barCategoryGap="60%" barGap={0}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={true} />
              {renderReferenceElement()}
              <XAxis dataKey="label" scale="point" padding={{ left: 60, right: 60 }} stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={domainWithPadding} tickFormatter={formatValue} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="barValue" name={barLabel || "Valor"} radius={[6, 6, 0, 0]} maxBarSize={90}>
                 {processedData.map((entry: any, i: number) => (
                  <Cell key={`cell-${i}`} fill={entry.color || '#10b981'} />
                ))}
              </Bar>
              {hasLineData && (
                <Line type="monotone" dataKey="lineValue" name={lineLabel || "Meta"} stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
              )}
            </ComposedChart>
        );
    }

    // Renderização Complexa (Legado)
    if (isComplex && complexConfig && complexConfig.series) {
      return (
        <ComposedChart data={processedData} margin={commonMargin} barCategoryGap="45%">
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={true} />
          {renderReferenceElement()}
          <XAxis dataKey="label" scale="point" padding={{ left: 10, right: 10 }} stroke="#94a3b8" fontSize={11} tickLine={false} />
          <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} domain={domainWithPadding} />
          <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} hide={!complexConfig.yAxes?.right} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          {complexConfig.series.map((serie, index) => {
            if (!serie) return null; 
            const serieColor = serie.color || COLORS[index % COLORS.length];
            const yAxisId = serie.yAxis === 'right' ? 'right' : 'left';
            const dataKey = serie.name || serie.label || `series_${index}`;
            return serie.type === 'line' ? (
              <Line key={dataKey} type="monotone" dataKey={dataKey} name={dataKey} stroke={serieColor} strokeWidth={3} yAxisId={yAxisId} dot={{ r: 4 }} />
            ) : (
              <Bar key={dataKey} dataKey={dataKey} name={dataKey} fill={serieColor} yAxisId={yAxisId} radius={[4, 4, 0, 0]} maxBarSize={60} />
            );
          })}
        </ComposedChart>
      );
    }

    // Tipos básicos (Line, Pie, Bar)
    switch (type) {
      case 'line':
        return (
          <LineChart data={processedData} margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={true} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} domain={domainWithPadding} tickFormatter={formatValue} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {dataKeys.map((key, index) => (
              <Line key={key} type="monotone" dataKey={key} name={key} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />
            ))}
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
             <Pie
              data={processedData} cx="50%" cy="50%" labelLine={false}
              label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : null}
              outerRadius={80} dataKey={dataKeys[0] || 'value'} nameKey="label"
            >
              {processedData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        );
      case 'bar':
      default:
        return (
          <BarChart data={processedData} margin={commonMargin} barCategoryGap="60%">
            <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} domain={domainWithPadding} tickFormatter={formatValue} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {dataKeys.map((key, index) => (
              <Bar key={key} dataKey={key} name={key} fill={mainColor || COLORS[index % COLORS.length]} radius={[6, 6, 0, 0]} maxBarSize={90}>
                {processedData.map((entry: any, i: number) => (
                  <Cell key={`cell-${i}`} fill={entry.color || mainColor || COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            ))}
          </BarChart>
        );
    }
  };

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col relative">
      {title && (
          <div className="w-full text-center pb-2 z-10">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-[#0B1120]/50 px-3 py-1 rounded-full border border-slate-800">
                  {title}
              </span>
          </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};