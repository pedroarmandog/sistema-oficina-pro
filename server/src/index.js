import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Carrega as variáveis de ambiente antes de importar os modelos
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

// Importações da aplicação
const [
  expressModule,
  corsModule,
  helmetModule,
  rateLimitModule,
  modelsModule,
  authModule,
  apiModule,
  advancedModule,
  schedulerModule,
  webhookModule
] = await Promise.all([
  import('express'),
  import('cors'),
  import('helmet'),
  import('express-rate-limit'),
  import('./models/index.js'),
  import('./routes/auth.js'),
  import('./routes/api.js'),
  import('./routes/advanced.js'),
  import('./services/scheduler.js'),
  import('./routes/webhooks.js')
]);

const express = expressModule.default;
const cors = corsModule.default;
const helmet = helmetModule.default;
const rateLimit = rateLimitModule.default;

const { db } = modelsModule;
const authRoutes = authModule.default;
const apiRoutes = apiModule.default;
const advancedRoutes = advancedModule.default;
const { startNotificationScheduler } = schedulerModule;
const webhookRoutes = webhookModule.default;

// Validação de segurança
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
) {
  throw new Error(
    'JWT_SECRET forte (mínimo 32 caracteres) é obrigatório em produção.'
  );
}

// Inicialização do Express
const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173'
  })
);

app.use(express.json({ limit: '2mb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500
  })
);

// Arquivos enviados
app.use(
  '/uploads',
  express.static(
    path.resolve(__dirname, '../uploads'),
    {
      maxAge: '7d',
      immutable: true
    }
  )
);

// Rota de saúde da API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OficinaPro API'
  });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api', advancedRoutes);
app.use('/api', apiRoutes);

// Frontend em produção
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');

  app.use(express.static(clientDist));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: 'Erro interno do servidor.'
  });
});

// Inicialização do servidor
const port = process.env.PORT || 3333;

try {
  await db.authenticate();

  console.log('Conexão com o banco de dados estabelecida.');

  if (process.env.NODE_ENV !== 'production') {
    await db.sync({ alter: true });
  }

  app.listen(port, () => {
    console.log(`OficinaPro API rodando na porta ${port}`);

    startNotificationScheduler();
  });
} catch (error) {
  console.error('Falha ao conectar ou inicializar o banco:', error);
  process.exit(1);
}
