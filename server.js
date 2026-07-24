
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configuração do Banco de Dados SQLite
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir);
}
const dbPath = path.join(dataDir, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    initDb();
  }
});

function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      description TEXT NOT NULL,
      chartConfig TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      extraData TEXT -- Nova coluna para armazenar JSON completo (Report, Progresso, etc)
    )
  `;
  db.run(sql, (err) => {
    if (err) console.error('Erro ao criar tabela:', err.message);
    else {
      // Tenta adicionar a coluna extraData se ela não existir (Migração Simples)
      db.run("ALTER TABLE posts ADD COLUMN extraData TEXT", (alterErr) => {
         // Se der erro, provavelmente a coluna já existe, ignoramos.
         if (!alterErr) console.log("Coluna extraData adicionada com sucesso.");
      });
    }
  });
}

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// --- API ROUTES ---

app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { history, prompt, message, attachments, files, systemContext } = req.body;
    
    // Suporte tanto ao formato anterior quanto ao novo
    const userMessage = message || prompt;
    const userFiles = files || attachments;

    const contents = [];
    
    // Convert history into contents array for Gemini
    if (history && history.length > 0) {
       for (const msg of history) {
          contents.push({
             role: msg.role === 'user' ? 'user' : 'model',
             parts: [{ text: msg.text }]
          });
       }
    }

    const currentParts = [];
    
    // Inject context data invisibly
    if (systemContext) {
      currentParts.push({ text: "CONTEXTO DOS INDICADORES ATUAIS:\n" + JSON.stringify(systemContext) + "\n\n" });
    }

    if (userFiles && userFiles.length > 0) {
      for (const f of userFiles) {
         currentParts.push({
            inlineData: {
              mimeType: f.mimeType,
              data: f.data || f.base64
            }
         });
      }
    }
    
    if (userMessage) currentParts.push({ text: userMessage });

    contents.push({ role: 'user', parts: currentParts });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
           systemInstruction: `Você é um assistente IA especializado em gestão pública municipal. Use os dados de contexto fornecidos na primeira mensagem para responder a qualquer dúvida do usuário sobre os dados dos indicadores, tendências ou metas. Responda em Markdown limpo e objetivo.`
        }
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error('Gemini error:', error);
      
      // Check for 429 quota error
      if (error.status === 429 || (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota')))) {
         return res.status(429).json({ error: "Limite de uso gratuito atingido. Aguarde 1 a 2 minutos para tentar novamente." });
      }
      
      res.status(500).json({ error: 'Falha na IA' });
    }

  } catch (error) {
    console.error('Internal server error:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

app.post('/api/posts/import', (req, res) => {
  const importedData = req.body;
  if (!Array.isArray(importedData)) {
    return res.status(400).json({ error: 'Formato inválido. Esperado um array JSON.' });
  }

  let successCount = 0;
  let errorCount = 0;

  const mapTopicToId = (topicName) => {
    const lower = topicName.toLowerCase();
    if (lower.includes('saúde') || lower.includes('saude')) return 'saude';
    if (lower.includes('educação') || lower.includes('educacao')) return 'educacao';
    if (lower.includes('social') || lower.includes('desenvolvimento')) return 'social';
    if (lower.includes('finança') || lower.includes('financa') || lower.includes('govern')) return 'financas';
    if (lower.includes('esporte') || lower.includes('cultura')) return 'esporte';
    if (lower.includes('agri') || lower.includes('meio ambiente')) return 'agricultura';
    if (lower.includes('infra') || lower.includes('obras')) return 'infraestrutura';
    return 'planejamento';
  };

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare(`INSERT INTO posts (id, topicId, description, chartConfig, createdAt, extraData) VALUES (?, ?, ?, ?, ?, ?)`);

    for (const item of importedData) {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const topicId = mapTopicToId(item.topicId || 'planejamento');
      
      const chartConfigObj = item.dadosGrafico || { type: 'bar', title: 'Importado', series: [] };
      if (chartConfigObj.rows && !chartConfigObj.series) {
         chartConfigObj.series = chartConfigObj.rows.map(r => ({ x: r.label, y: r.value }));
         delete chartConfigObj.rows;
      }
      if (chartConfigObj.data && Array.isArray(chartConfigObj.data) && !chartConfigObj.series) {
         chartConfigObj.series = chartConfigObj.data.map(d => ({ 
             x: d.label || d.x, 
             y: d.barValue !== undefined ? d.barValue : (d.value !== undefined ? d.value : d.y), 
             color: d.color,
             signal: d.status || d.signal 
         }));
         delete chartConfigObj.data;
      }
      if (chartConfigObj.multiLineSeries && Array.isArray(chartConfigObj.multiLineSeries)) {
         chartConfigObj.multiLineSeries = chartConfigObj.multiLineSeries.map(mls => {
            if (mls.data && Array.isArray(mls.data)) {
               // Support signal logic in multiLineSeries
               return { ...mls, data: mls.data.map(d => ({ x: d.x || d.label, y: d.y || d.value, signal: d.status || d.signal })) };
            }
            return mls;
         });
      }
      const chartConfigStr = JSON.stringify(chartConfigObj);
      
      // Parse indicadores chave
      let indicadoresChave = [];
      if (item.informacoesIndicador && typeof item.informacoesIndicador.indicadoresChave === 'string') {
          // just a placeholder, as the original JSON says "string" for this
          indicadoresChave = [{
              nome: item.informacoesIndicador.indicadoresChave,
              resultado: '-',
              meta: '-',
              status: 'yellow',
              tendencia: 'stable',
              fonte: '-'
          }];
      } else if (item.informacoesIndicador && Array.isArray(item.informacoesIndicador.indicadoresChave)) {
          indicadoresChave = item.informacoesIndicador.indicadoresChave;
      }

      const rest = {
         indicatorName: item.indicatorName || 'Indicador Importado',
         responsavel: item.identificacaoEstrategia?.responsavelTecnico || '',
         fonteOficial: '-',
         recorrencia: item.identificacaoEstrategia?.periodo || '-',
         dataAtualizacao: Date.now(),
         semaforoRules: { green: '', yellow: '', red: '' },
         semaforoGeral: 'yellow',
         progress: 0,
         progressHistory: [],
         report: {
            objetivo: item.identificacaoEstrategia?.objetivo || '',
            importanciaPrefeito: item.identificacaoEstrategia?.importanciaPrefeito || '',
            formula: item.identificacaoEstrategia?.formula || '',
            acaoCrise: item.identificacaoEstrategia?.acaoCrise || '',
            secretaria: item.identificacaoEstrategia?.secretaria || '',
            periodo: item.identificacaoEstrategia?.periodo || '',
            responsavelPolitico: item.identificacaoEstrategia?.responsavelPolitico || '',
            responsavelTecnico: item.identificacaoEstrategia?.responsavelTecnico || '',
            pontoFocal: { nome: '', cargo: '', telefone: '', email: '' },
            resumoAvanços: item.resumoExecutivo?.resumoAvanços || '',
            resumoAtrasos: item.resumoExecutivo?.resumoAtrasos || '',
            resumoDecisoes: item.resumoExecutivo?.resumoDecisoes || '',
            indicadoresChave: indicadoresChave,
            metasPrioritarias: [],
            problemasCriticos: [],
            decisoesPrefeito: [],
            riscos: { tipos: [], descricao: '' },
            compromissos: [],
            anexos: ''
         }
      };

      const extraDataStr = JSON.stringify(rest);
      
      stmt.run([id, topicId, item.indicatorName || 'Importado', chartConfigStr, Date.now(), extraDataStr], (err) => {
         if (err) errorCount++;
         else successCount++;
      });
    }

    stmt.finalize();
    db.run("COMMIT", (err) => {
       if (err) {
          res.status(500).json({ error: 'Erro ao commitar transação.' });
       } else {
          res.json({ message: 'Importação concluída', success: successCount, errors: errorCount });
       }
    });
  });
});

// Listar todos os posts
app.get('/api/posts', (req, res) => {
  const sql = 'SELECT * FROM posts ORDER BY createdAt DESC';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    // O frontend fará o parse do chartConfig e extraData
    res.json({ data: rows });
  });
});

// Criar novo post
app.post('/api/posts', (req, res) => {
  // Extraímos apenas o que precisamos para colunas fixas, o resto vai pro extraData
  const { id, topicId, description, chartConfig, createdAt, ...rest } = req.body;
  
  // O 'rest' contém: responsavel, report, progress, etc.
  const extraDataStr = JSON.stringify(rest);
  const chartConfigStr = JSON.stringify(chartConfig);

  const sql = `INSERT INTO posts (id, topicId, description, chartConfig, createdAt, extraData) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [id, topicId, description, chartConfigStr, createdAt, extraDataStr];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'Post criado com sucesso', id: id });
  });
});

// Atualizar post (Edição)
app.put('/api/posts/:id', (req, res) => {
  const { topicId, description, chartConfig, ...rest } = req.body;
  const id = req.params.id;
  
  const extraDataStr = JSON.stringify(rest);
  const chartConfigStr = JSON.stringify(chartConfig);

  const sql = `UPDATE posts SET topicId = ?, description = ?, chartConfig = ?, extraData = ? WHERE id = ?`;
  const params = [topicId, description, chartConfigStr, extraDataStr, id];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'Post atualizado com sucesso', changes: this.changes });
  });
});

// Deletar post
app.delete('/api/posts/:id', (req, res) => {
  const sql = 'DELETE FROM posts WHERE id = ?';
  db.run(sql, req.params.id, function(err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'Post deletado', changes: this.changes });
  });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
