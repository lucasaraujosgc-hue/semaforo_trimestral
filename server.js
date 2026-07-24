
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
    const { history, prompt, attachments } = req.body;
    // attachments is an array of base64 objects: { mimeType, data }

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
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
         currentParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data
            }
         });
      }
    }
    currentParts.push({ text: prompt });

    contents.push({ role: 'user', parts: currentParts });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
         systemInstruction: "Você é um Assistente de Inteligência Artificial para Gestão Municipal (Semaforo de Indicadores). Responda sempre em Markdown com formatação amigável."
      }
    });

    res.json({ text: response.text });

  } catch (error) {
    console.error('Gemini error:', error);
    
    // Check for 429 quota error
    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
       return res.status(429).json({ error: "O limite de uso gratuito da Inteligência Artificial foi atingido. Por favor, aguarde cerca de 1 a 2 minutos para que a cota seja restabelecida e tente novamente." });
    }
    
    res.status(500).json({ error: 'Erro ao gerar resposta com a Inteligência Artificial.' });
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
