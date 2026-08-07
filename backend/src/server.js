// backend/src/server.js
// Arquivo principal do servidor Express

// Carrega as variáveis de ambiente do arquivo .env

// >>> ADICIONE ESTA FUNÇÃO AUXILIAR NO INÍCIO DO ARQUIVO <<<
const crypto = require('crypto'); // Certifique-se que o 'crypto' está sendo importado

function generateRandomPassword(length = 10) {
  // Gera uma senha aleatória com letras maiúsculas, minúsculas, números e um símbolo.
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%&*';
  
  const allChars = uppercase + lowercase + numbers + specialChars;
  
  let password = '';
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += specialChars[crypto.randomInt(specialChars.length)];

  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Embaralha a senha para que os primeiros caracteres não sejam sempre os mesmos
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Importa o pacote CORS
const XLSX = require('xlsx'); // Para lidar com arquivos XLSX
const csv = require('csv-parser'); // Para lidar com arquivos CSV
const fs = require('fs'); // Para lidar com arquivos do sistema de arquivos
const multer = require('multer'); // Para upload de arquivos
const importStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Garante que uma pasta temporária exista para as importações
    const tempDir = path.join(__dirname, 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Cria um nome de arquivo temporário e único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadImport = multer({ storage: importStorage });

// Configuração de Upload para Recibos de Lote (Adicione junto com os outros storages)
const batchReceiptDir = path.join(__dirname, 'uploads', 'batch_receipts');
if (!fs.existsSync(batchReceiptDir)) {
  fs.mkdirSync(batchReceiptDir, { recursive: true });
}

const batchReceiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, batchReceiptDir);
  },
  filename: function (req, file, cb) {
    const batchId = req.params.id;
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `recibo_coletivo_lote_${batchId}_${uniqueSuffix}${ext}`);
  }
});

const uploadBatchReceipt = multer({ storage: batchReceiptStorage });

// Importações para PDFmake
const PdfPrinter = require('pdfmake');

// Define o caminho base para as fontes
const fontsPath = path.join(__dirname, 'fonts');
console.log(`[DEBUG FONT] Caminho base das fontes: ${fontsPath}`); // DEBUG

// Verifica se os arquivos de fonte existem e loga
const fontFiles = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italics.ttf',
  bolditalics: 'Roboto-MediumItalics.ttf'
};

// Mapeia as fontes para o PdfPrinter
const fonts = {
  Roboto: {}
};

let allFontsFound = true; // Flag para verificar se todas as fontes foram encontradas

for (const [key, fileName] of Object.entries(fontFiles)) {
  const fullPath = path.join(fontsPath, fileName);
  if (!fs.existsSync(fullPath)) {
    console.error(`[ERRO CRÍTICO FONT] Fonte não encontrada em: ${fullPath}. O PDF não será gerado corretamente.`);
    allFontsFound = false;
  } else {
    console.log(`[DEBUG FONT] Fonte encontrada: ${fullPath}`);
    fonts.Roboto[key] = fullPath;
  }
}

let printer;
if (Object.keys(fonts.Roboto).length > 0 && allFontsFound) {
  console.log('[DEBUG FONT] Todas as fontes essenciais foram encontradas. Inicializando PdfPrinter.');
  printer = new PdfPrinter(fonts);
} else {
  console.error('[ERRO CRÍTICO FONT] Não foi possível carregar todas as fontes necessárias. A geração de PDF pode falhar.');
  printer = new PdfPrinter({
    'Helvetica': {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  });
}


const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET; // Chave secreta para JWT
const DATABASE_URL = process.env.DATABASE_URL; // URL de conexão com o banco de dados

// Configuração do pool de conexão com o PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Testa a conexão com o banco de dados
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar ao banco de dados:', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Erro ao executar query de teste:', err.stack);
    }
    console.log('Conectado ao PostgreSQL com sucesso! Tempo atual do DB:', result.rows[0].now);
  });
});


// Configuração do Multer para upload de arquivos com controle de destino e nome
const uploadDir = path.join(__dirname, 'uploads', 'receipts');

// Garante que o diretório de uploads exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Busca os detalhes que nosso middleware encontrou.
    const movementId = req.params.id;
    const details = req.movementDetails;

    // Formata o nome da pessoa para ser seguro para um nome de arquivo
    const recipientName = details.recipient_name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]/gi, '_') // Substitui caracteres não alfanuméricos por _
      .toLowerCase();

    // Formata a data para YYYY-MM-DD
    const movementDate = new Date(details.movement_date).toISOString().split('T')[0];
    
    const originalExtension = path.extname(file.originalname);
    
    // Cria o novo nome de arquivo descritivo
    const newFilename = `recibo_mov${movementId}_${recipientName}_${movementDate}${originalExtension}`;
    
    cb(null, newFilename);
  }
});

const simpleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'receipts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Como não temos o ID ou Nome ainda, usamos um Timestamp para garantir unicidade
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'devolucao-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadSimple = multer({ storage: simpleStorage });

const upload = multer({ storage: storage });

// server.js -> Adicionar esta configuração de storage

const evidenceDir = path.join(__dirname, 'uploads', 'evidence');
// Garante que o diretório de evidências exista
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

const evidenceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, evidenceDir);
  },
  filename: function (req, file, cb) {
    const assetId = req.params.id;
    const uniqueSuffix = Date.now();
    const originalExtension = path.extname(file.originalname);
    const newFilename = `evidencia_ativo${assetId}_${uniqueSuffix}${originalExtension}`;
    cb(null, newFilename);
  }
});

const uploadEvidence = multer({ storage: evidenceStorage });

// Middlewares
app.use(express.json()); // Permite que o Express parseie corpos de requisição JSON
app.use(cors({
  exposedHeaders: 'Content-Disposition',
}));

// Middleware de Autenticação (para proteger rotas)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ message: 'Token não fornecido. Acesso negado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Se o token for inválido ou expirado
      return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
    req.user = user; // Anexa o payload do JWT ao objeto request
    next(); // Procede para a próxima função middleware/rota
  });
};

// Definindo os nomes dos perfis para evitar erros de digitação
const ROLES = {
    ADMIN: 'admin',         // Você (Full)
    MANAGER: 'manager',     // Coordenação
    ADVISOR: 'advisor',     // Assessoria (Novo)
    BASIC: 'basic',          // Técnicos
    OPERATOR: 'operator'  // Técnico de Campo (Logística + Escolar) - NOVO
};

// Mapeamento de cada ação para os perfis que podem executá-la
const PERMISSIONS = {
  MENU_DASHBOARD: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.BASIC, ROLES.OPERATOR],
  MENU_CADASTROS: [ROLES.ADMIN, ROLES.MANAGER],

  // Logística Geral: Basic e Operator acessam
  MENU_LOGISTICA: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.BASIC, ROLES.OPERATOR],
  
  // Patrimônio: Gestão apenas
  MENU_PATRIMONIO: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR],

  // Menu Escolar: REMOVEMOS O BASIC e adicionamos o OPERATOR
  MENU_ESCOLAR: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.OPERATOR],

  MENU_RELATORIOS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR],
  MENU_CONSULTAS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.BASIC, ROLES.OPERATOR],
  
  MENU_AUDITORIA: [ROLES.ADMIN], 
  MENU_CONFIGURACOES: [ROLES.ADMIN, ROLES.MANAGER], 

  // Ações
  // Ambos (Basic e Operator) podem registrar movimentações gerais
  ACTION_REGISTER_MOVEMENT: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC, ROLES.OPERATOR],
  
  ACTION_CREATE_EDIT: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR],
  ACTION_REQUEST_RETIREMENT: [ROLES.ADMIN, ROLES.MANAGER],
  ACTION_FINAL_APPROVAL: [ROLES.ADMIN],
  ACTION_APPROVE_REJECT: [ROLES.ADMIN],
  ACTION_DELETE: [ROLES.ADMIN],

  // Compatibilidade
  SUBMENU_TIPOS_ITENS: [ROLES.ADMIN, ROLES.MANAGER],
  SUBMENU_UNIDADES: [ROLES.ADMIN, ROLES.MANAGER],
  SUBMENU_PESSOAS: [ROLES.ADMIN, ROLES.MANAGER],
  SUBMENU_ATIVOS: [ROLES.ADMIN, ROLES.MANAGER],
};

// Middleware para verificar permissão de acesso (admin ou manager)
const authorizeRole = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logAudit(req.user.id, 'unauthorized_access', 'role_check', null, { attempted_role: req.user.role, required_roles: roles, path: req.path }, req.ip);
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
    next();
  };
};

// Função Auxiliar para criar filtros dinâmicos SQL
const buildDashboardFilters = (query, paramsStart = 1) => {
  const { rpa, year, pcd } = query;
  const conditions = [];
  const values = [];
  let currentIndex = paramsStart;

  // Filtro por RPA
  if (rpa) {
    conditions.push(`s.rpa = $${currentIndex}`);
    values.push(rpa);
    currentIndex++;
  }

  // Filtro por Ano de Ensino
  if (year) {
    conditions.push(`s.education_year = $${currentIndex}`);
    values.push(year);
    currentIndex++;
  }

  // Filtro por PCD (Boolean)
  if (pcd === 'true') {
    conditions.push(`(s.pcd_type IS NOT NULL AND LENGTH(s.pcd_type) > 2 AND s.pcd_type NOT ILIKE 'NÃO')`);
    // Não incrementa index pois não usa parâmetro
  }

  return {
    whereClause: conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '',
    values
  };
};

// >>> NOVA FUNÇÃO AUXILIAR ( Padronizar número de telefone) <<<
const formatPhoneNumber = (phone) => {
  if (!phone) {
    return null;
  }
  // 1. Remove todos os caracteres que não são dígitos
  const digitsOnly = String(phone).replace(/\D/g, '');

  // 2. Verifica se o número tem 10 (fixo) ou 11 dígitos (celular)
  if (digitsOnly.length === 10) {
    // Formato: 81 3333-4444
    return `${digitsOnly.substring(0, 2)} ${digitsOnly.substring(2, 6)}-${digitsOnly.substring(6, 10)}`;
  } else if (digitsOnly.length === 11) {
    // Formato: 81 99999-8888
    return `${digitsOnly.substring(0, 2)} ${digitsOnly.substring(2, 7)}-${digitsOnly.substring(7, 11)}`;
  } else {
    // Se não se encaixar nos padrões, retorna o número limpo (ou null se preferir)
    return digitsOnly; 
  }
};

// Função auxiliar para gerar nomes de arquivo limpos
const sanitizeFilename = (text) => {
  if (!text) return 'documento';
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-zA-Z0-9]/g, "_") // Troca tudo que não for letra/número por _
    .replace(/_+/g, "_") // Remove _ duplicados
    .replace(/^_|_$/g, "") // Remove _ do começo e do fim (Isso resolve o problema 3)
    .toUpperCase();
};

// >>> NOVO MIDDLEWARE (Nome de recibos assinados) <<<
const fetchMovementDetailsForUpload = async (req, res, next) => {
  try {
    const { id } = req.params;
    const movementResult = await pool.query(
      `SELECT 
         am.movement_date,
         p.full_name AS recipient_name
       FROM asset_movements am
       LEFT JOIN people p ON am.recipient_person_id = p.id
       WHERE am.id = $1`,
      [id]
    );

    if (movementResult.rows.length === 0) {
      return res.status(404).json({ message: 'Movimentação não encontrada para nomear o arquivo.' });
    }

    // Anexa os detalhes encontrados ao objeto 'req' para que a próxima função (o multer) possa usá-los.
    req.movementDetails = movementResult.rows[0];
    next(); // Continua para o próximo passo (o upload)

  } catch (error) {
    console.error('Erro ao buscar detalhes da movimentação para upload:', error);
    return res.status(500).json({ message: 'Erro interno ao preparar o upload.' });
  }
};

// >>> NOVO MIDDLEWARE (Perfis de Acesso) <<<
const authorizePermission = (permissionKey) => {
  return (req, res, next) => {
    // ETAPA 1: VERIFICAÇÃO DE SEGURANÇA ADICIONADA
    // Garante que o middleware de autenticação foi executado corretamente
    // e que o objeto req.user e sua propriedade 'role' existem.
    if (!req.user || typeof req.user.role === 'undefined') {
      logAudit(null, 'authorization_error', 'permission_check', null, { reason: 'User object not found in request', path: req.path }, req.ip);
      // Retorna um erro 500 porque esta é uma falha interna inesperada, não um erro de permissão do usuário.
      return res.status(500).json({ message: 'Erro de autenticação interna. O usuário não pôde ser verificado.' });
    }

    const userRole = req.user.role;
    const allowedRoles = PERMISSIONS[permissionKey];

    // ETAPA 2: A LÓGICA DE PERMISSÃO PERMANECE A MESMA
    if (allowedRoles && allowedRoles.includes(userRole)) {
      next(); // Permissão concedida
    } else {
      // Permissão negada
      logAudit(req.user.id, 'unauthorized_access', 'permission_check', null, { required_permission: permissionKey, user_role: userRole, path: req.path }, req.ip);
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
  };
};

// Middleware para registrar logs de auditoria
const logAudit = async (userId, actionType, targetEntity = null, targetId = null, details = null, ipAddress = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_entity, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, actionType, targetEntity, targetId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
  }
};

// Helper para buscar dados de assinatura do usuário logado
async function getUserSignatureData(userId) {
    const res = await pool.query(`
        SELECT u.full_name, u.job_title, u.registration_number, u.cpf, un.name as unit_name
        FROM users u
        LEFT JOIN units un ON u.unit_id = un.id
        WHERE u.id = $1
    `, [userId]);
    
    if (res.rows.length === 0) return null;
    const user = res.rows[0];

    // Monta o bloco de assinatura para o PDFMake
    return {
        stack: [
            { text: '____________________________________________________', alignment: 'center' },
            { text: user.full_name.toUpperCase(), bold: true, alignment: 'center', fontSize: 10 },
            { text: user.job_title || 'Cargo não informado', fontSize: 9, alignment: 'center' },
            { text: user.unit_name ? `Lotação: ${user.unit_name}` : '', fontSize: 9, alignment: 'center' },
            { text: [
                user.registration_number ? `Matrícula: ${user.registration_number}  ` : '',
                user.cpf ? `CPF: ${user.cpf}` : ''
              ], fontSize: 9, alignment: 'center', margin: [0, 2, 0, 0] }
        ]
    };
}

// ======================================
// Rotas de Autenticação (Mantidas da Fase 1)
// ======================================

// Rota de Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;

  if (!email || !password) {
    await logAudit(null, 'login_failed', 'user', null, { reason: 'Missing credentials', email }, ipAddress);
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      await logAudit(null, 'login_failed', 'user', null, { reason: 'User not found', email }, ipAddress);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await logAudit(user.id, 'login_failed', 'user', user.id, { reason: 'Incorrect password', email }, ipAddress);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // <<< VERIFICAÇÃO DE CONTA ATIVA >>>
    if (!user.is_active) {
      await logAudit(user.id, 'login_failed', 'user', user.id, { reason: 'Account is deactivated', email }, ipAddress);
      return res.status(403).json({ message: 'Sua conta está desativada. Entre em contato com o administrador.' });
    }
    // <<< FIM DA ADIÇÃO >>>

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      must_change_password: user.must_change_password,
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    await logAudit(user.id, 'login_success', 'user', user.id, { email }, ipAddress);

    res.status(200).json({ message: 'Login bem-sucedido!', token, user: tokenPayload });

  } catch (error) {
    console.error('Erro no login:', error);
    await logAudit(null, 'login_error', null, null, { error: error.message, email }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota de Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await logAudit(req.user.id, 'logout', 'user', req.user.id, { email: req.user.email }, req.ip);
  res.status(200).json({ message: 'Logout realizado com sucesso.' });
});

// Rota para verificar o token
app.get('/api/auth/verify-token', authenticateToken, (req, res) => {
  res.status(200).json({ isValid: true, user: req.user });
});

// Rota de exemplo protegida
app.get('/api/protected-data', authenticateToken, (req, res) => {
  res.status(200).json({ message: `Bem-vindo, ${req.user.username}! Você acessou dados protegidos.`, user: req.user });
});

// Rota para criar um usuário (ADMIN APENAS) - ATUALIZADA
app.post('/api/users/register', authenticateToken, authorizePermission('MENU_CONFIGURACOES'), async (req, res) => {
  // Recebendo novos campos
  const { username, email, full_name, role, job_title, registration_number, cpf, unit_id } = req.body;
  let { password } = req.body;
  const ipAddress = req.ip;

  if (!username || !email || !full_name || !role) {
    return res.status(400).json({ message: 'Campos obrigatórios: Username, Email, Nome e Perfil.' });
  }

  if (!password) password = generateRandomPassword();

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existingUser.rows.length > 0) return res.status(409).json({ message: 'Usuário ou email já cadastrado.' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // INSERT ATUALIZADO COM NOVOS CAMPOS
    const newUserResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, job_title, registration_number, cpf, unit_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, username, email, full_name, role`,
      [username, email, passwordHash, full_name, role, job_title, registration_number, cpf, unit_id || null]
    );
    
    await logAudit(req.user.id, 'user_created', 'user', newUserResult.rows[0].id, { email, role }, ipAddress);
    
    res.status(201).json({ 
      message: 'Usuário registrado com sucesso.', 
      user: newUserResult.rows[0],
      generatedPassword: password 
    });

  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// Rota para atualizar usuário (ADMIN) - ATUALIZADA
app.put('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userIdToUpdate = parseInt(req.params.id, 10);
  const { full_name, username, email, role, is_active, job_title, registration_number, cpf, unit_id } = req.body;
  const ipAddress = req.ip;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, username = $2, email = $3, role = $4, is_active = $5,
           job_title = $6, registration_number = $7, cpf = $8, unit_id = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [full_name, username, email, role, is_active, job_title, registration_number, cpf, unit_id || null, userIdToUpdate]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });

    await logAudit(req.user.id, 'update_user_success', 'user', userIdToUpdate, { updated: true }, ipAddress);
    res.status(200).json({ message: 'Usuário atualizado.', user: result.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar:', error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// Rota Listar Usuários - ATUALIZADA (Para popular o modal de edição corretamente)
app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Agora trazemos também os dados enriquecidos
    const result = await pool.query(`
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, 
               u.job_title, u.registration_number, u.cpf, u.unit_id,
               un.name as unit_name
        FROM users u
        LEFT JOIN units un ON u.unit_id = un.id
        ORDER BY u.full_name ASC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// ======================================
// NOVAS ROTAS DE RELATÓRIOS - PESSOAS
// ======================================

// Função auxiliar para buscar os dados de pessoas
const getPeopleReportData = async () => {
  const result = await pool.query(
    `SELECT
       p.full_name, p.cpf, p.email, p.registration_number, u.name AS unit_name, u.type AS unit_type
     FROM people p
     LEFT JOIN units u ON p.unit_id = u.id
     ORDER BY p.full_name ASC`
  );
  return result.rows;
};

// Rota para exportar lista de pessoas em CSV
app.get('/api/reports/people/csv', authenticateToken, async (req, res) => {
  try {
    const people = await getPeopleReportData();
    if (people.length === 0) {
      return res.status(404).json({ message: 'Nenhuma pessoa encontrada para gerar relatório.' });
    }

    const headers = ['Nome Completo', 'CPF', 'Email', 'Matrícula', 'Unidade', 'Tipo da Unidade'];
    const csvRows = [headers.join(';')];

    for (const person of people) {
      const row = [
        person.full_name,
        person.cpf,
        person.email,
        person.registration_number || 'N/A',
        person.unit_name || 'N/A',
        person.unit_type || 'N/A'
      ];
      csvRows.push(row.map(field => `"${field || ''}"`).join(';'));
    }

    const csvString = csvRows.join('\n');
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_pessoas.csv');
    res.send(Buffer.from(csvString, 'utf-8'));
    await logAudit(req.user.id, 'generate_report', 'people_report_csv', null, { count: people.length }, req.ip);
  } catch (error) {
    console.error('Erro ao gerar relatório CSV de pessoas:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório CSV de pessoas.' });
  }
});

// Rota para exportar lista de pessoas em XLSX
app.get('/api/reports/people/xlsx', authenticateToken, async (req, res) => {
  try {
    const people = await getPeopleReportData();
    if (people.length === 0) {
      return res.status(404).json({ message: 'Nenhuma pessoa encontrada para gerar relatório.' });
    }
    
    // Mapeia os dados para ter cabeçalhos amigáveis
    const dataForSheet = people.map(p => ({
      'Nome Completo': p.full_name,
      'CPF': p.cpf,
      'Email': p.email,
      'Matrícula': p.registration_number || 'N/A',
      'Unidade': p.unit_name || 'N/A',
      'Tipo da Unidade': p.unit_type || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pessoas');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment('relatorio_pessoas.xlsx');
    res.send(buffer);
    await logAudit(req.user.id, 'generate_report', 'people_report_xlsx', null, { count: people.length }, req.ip);
  } catch (error) {
    console.error('Erro ao gerar relatório XLSX de pessoas:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório XLSX de pessoas.' });
  }
});

// Rota para exportar lista de pessoas em PDF
app.get('/api/reports/people/pdf', authenticateToken, async (req, res) => {
  try {
    const people = await getPeopleReportData();
    if (people.length === 0) {
      return res.status(404).json({ message: 'Nenhuma pessoa encontrada para gerar relatório.' });
    }

    const bodyData = people.map(p => [
      p.full_name,
      p.cpf,
      p.email,
      p.unit_name || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Pessoas Cadastradas', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto'],
            body: [
              ['Nome Completo', 'CPF', 'Email', 'Unidade'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Pessoas: ${people.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#e9ecef', alignment: 'left' },
        footer: { fontSize: 10, italics: true }
      },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_pessoas.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'people_report_pdf', null, { count: people.length }, req.ip);
  } catch (error) {
    console.error('Erro ao gerar relatório PDF de pessoas:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório PDF de pessoas.' });
  }
});

// ======================================
// NOVAS ROTAS DE RELATÓRIO DE AUDITORIA
// ======================================

// Função auxiliar para buscar todos os dados de auditoria
const getAuditLogsReportData = async (filters = {}) => {
  const { userId, actionType, startDate, endDate } = filters;

  let baseQuery = `
    SELECT
      al.id, al.action_type, al.target_entity, al.target_id,
      al.details, al.ip_address, al.created_at,
      u.full_name as user_name, u.username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
  `;

  const whereClauses = [];
  const queryParams = [];
  let paramIndex = 1;

  if (userId) {
    whereClauses.push(`al.user_id = $${paramIndex++}`);
    queryParams.push(userId);
  }
  if (actionType) {
    whereClauses.push(`al.action_type = $${paramIndex++}`);
    queryParams.push(actionType);
  }
  if (startDate) {
    whereClauses.push(`al.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }
  if (endDate) {
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    whereClauses.push(`al.created_at < $${paramIndex++}`);
    queryParams.push(nextDay.toISOString().split('T')[0]);
  }

  if (whereClauses.length > 0) {
    baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  baseQuery += ` ORDER BY al.created_at DESC`;
  
  const result = await pool.query(baseQuery, queryParams);
  return result.rows;
};

// Rota para exportar logs em CSV
app.get('/api/reports/audit-logs/csv', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    const logs = await getAuditLogsReportData(req.query);
    const headers = ['Data e Hora', 'Usuário', 'Username', 'Ação', 'Entidade Alvo', 'ID Alvo', 'Endereço IP', 'Detalhes'];
    const csvRows = [headers.join(';')];
    for (const log of logs) {
      const row = [
        new Date(log.created_at).toLocaleString('pt-BR'),
        log.user_name || 'Sistema',
        log.username || 'N/A',
        log.action_type,
        log.target_entity || 'N/A',
        log.target_id || 'N/A',
        log.ip_address,
        log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '{}'
      ];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8').attachment('relatorio_auditoria.csv').send(csvRows.join('\n'));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de auditoria.' }); }
});

// Rota para exportar logs em XLSX
app.get('/api/reports/audit-logs/xlsx', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    const logs = await getAuditLogsReportData(req.query);
    const dataForSheet = logs.map(log => ({
      'Data e Hora': new Date(log.created_at).toLocaleString('pt-BR'),
      'Usuário': log.user_name || 'Sistema',
      'Username': log.username || 'N/A',
      'Ação': log.action_type,
      'Entidade Alvo': log.target_entity || 'N/A',
      'ID Alvo': log.target_id || 'N/A',
      'Endereço IP': log.ip_address,
      'Detalhes': JSON.stringify(log.details, null, 2)
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('relatorio_auditoria.xlsx').send(buffer);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de auditoria.' }); }
});

// Rota para exportar logs em PDF
app.get('/api/reports/audit-logs/pdf', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    const logs = await getAuditLogsReportData(req.query);
    const bodyData = logs.map(log => [
      new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      log.user_name || 'Sistema',
      log.action_type.replace(/_/g, ' '),
      log.target_entity || 'N/A',
      log.ip_address
    ]);
    const docDefinition = {
      content: [
        { text: 'Relatório de Auditoria do Sistema', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: [
              ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Endereço IP'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: { header: { fontSize: 18, bold: true }, tableHeader: { bold: true, fontSize: 10 } },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => res.header('Content-Type', 'application/pdf').attachment('relatorio_auditoria.pdf').send(Buffer.concat(chunks)));
    pdfDoc.end();
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de auditoria.' }); }
});

// ROTA PARA BUSCAR ATIVOS COM GARANTIA A VENCER (PARA DASHBOARD E RELATÓRIO)
app.get('/api/reports/expiring-warranties', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    // A query busca ativos cuja garantia vence entre hoje e os próximos 90 dias.
    // Ela já agrupa e conta os resultados para nós.
    const query = `
      SELECT
        COUNT(a.id) as asset_count,
        it.name as item_type_name,
        a.brand,
        a.model,
        a.warranty_end_date
      FROM
        assets a
      JOIN
        item_types it ON a.item_type_id = it.id
      WHERE
        a.warranty_end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '90 days')
      GROUP BY
        it.name, a.brand, a.model, a.warranty_end_date
      ORDER BY
        a.warranty_end_date ASC;
    `;
    
    const result = await pool.query(query);
    
    // Processa os resultados para calcular os dias restantes
    const expiringWarranties = result.rows.map(row => {
      const warrantyEndDate = new Date(row.warranty_end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      warrantyEndDate.setHours(0, 0, 0, 0);
      
      const diffTime = warrantyEndDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        count: parseInt(row.asset_count, 10),
        description: `${row.item_type_name} ${row.brand} ${row.model}`,
        endDate: warrantyEndDate.toLocaleDateString('pt-BR'),
        daysRemaining: diffDays
      };
    });

    await logAudit(req.user.id, 'generate_report', 'expiring_warranties_report', null, { count: expiringWarranties.length }, ipAddress);
    res.status(200).json(expiringWarranties);

  } catch (error) {
    console.error('Erro ao buscar garantias a vencer:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =====================================================================
// RELATÓRIOS MESTRES DE TABLETS (VISÃO EXECUTIVA E OPERACIONAL)
// =====================================================================

// 1. VISÃO ANALÍTICA (EXCEL) - O Dossiê Linha a Linha (Raio-X de cada Aluno/Tablet)
app.get('/api/reports/tablets/detailed/xlsx', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    try {
        const query = `
            SELECT 
                u.rpa,
                u.name AS school_name,
                s.student_name,
                s.student_registration,
                s.education_year,
                s.pcd_type,
                dbi.delivery_status,
                dbi.delivery_date,
                a.patrimonio_number,
                a.serial_number,
                a.imei,
                a.sim_card_number,
                a.box_number,        -- CAMPO CAIXA
                a.has_livox,         -- CAMPO LIVOX
                a.allow_automation,  -- CAMPO RESERVA
                db.name AS batch_name
            FROM tablet_eligible_students s
            LEFT JOIN units u ON s.school_unit_id = u.id
            LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
            LEFT JOIN assets a ON dbi.asset_id = a.id
            LEFT JOIN delivery_batches db ON dbi.batch_id = db.id
            ORDER BY u.name ASC, s.student_name ASC
        `;
        
        const result = await pool.query(query);

        const rows = result.rows.map(r => {
            let statusPt = 'PENDENTE';
            if (r.delivery_status === 'realizada' || r.delivery_status === 'confirmed') statusPt = 'ENTREGUE';
            else if (r.delivery_status === 'planejada') statusPt = 'NO LOTE';
            else if (r.delivery_status === 'devolvido') statusPt = 'DEVOLVIDO';

            return {
                rpa: r.rpa || '-',
                school: r.school_name || 'Desconhecida',
                student: r.student_name,
                matr: r.student_registration,
                status: statusPt,
                date: r.delivery_date ? new Date(r.delivery_date).toLocaleDateString('pt-BR') : '-',
                patrimonio: r.patrimonio_number || '-',
                imei: r.imei || '-',
                chip: r.sim_card_number || '-',
                caixa: r.box_number || '-',
                livox: r.has_livox ? 'SIM' : 'NÃO',
                reserva: r.allow_automation === false ? 'SIM' : 'NÃO', // Se automação desligada = Reserva
                batch: r.batch_name || '-'
            };
        });

        const columns = [
            { header: 'RPA', key: 'rpa', width: 8 },
            { header: 'ESCOLA', key: 'school', width: 35 },
            { header: 'NOME DO ALUNO', key: 'student', width: 35 },
            { header: 'STATUS', key: 'status', width: 15 },
            { header: 'CAIXA', key: 'caixa', width: 12 },
            { header: 'LIVOX (PCD)', key: 'livox', width: 12 },
            { header: 'RESERVA TÉC.', key: 'reserva', width: 12 },
            { header: 'PATRIMÔNIO', key: 'patrimonio', width: 15 },
            { header: 'IMEI', key: 'imei', width: 20 },
            { header: 'CHIP', key: 'chip', width: 15 },
            { header: 'LOTE', key: 'batch', width: 30 }
        ];

        await generateStyledExcel(res, 'Dossiê Tablets', 'Base_Detalhada_Tablets.xlsx', columns, rows);

    } catch (error) {
        console.error('Erro excel tablets:', error);
        res.status(500).json({ message: 'Erro ao gerar relatório.' });
    }
});

// =====================================================================
// VISÃO SINTÉTICA (PDF) - O Resumo Executivo por Escola
// =====================================================================
app.get('/api/reports/tablets/consolidated/pdf', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    try {
        const query = `
            WITH StudentStatus AS (
                SELECT 
                    s.school_unit_id,
                    s.id AS student_id,
                    MAX(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) as is_delivered,
                    MAX(CASE WHEN dbi.delivery_status = 'planejada' THEN 1 ELSE 0 END) as is_planned,
                    MAX(CASE WHEN dbi.delivery_status = 'devolvido' THEN 1 ELSE 0 END) as is_returned,
                    MAX(CASE WHEN a.has_livox = TRUE AND dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) as has_active_livox
                FROM tablet_eligible_students s
                LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
                LEFT JOIN assets a ON dbi.asset_id = a.id
                GROUP BY s.id, s.school_unit_id
            )
            SELECT 
                u.name AS school_name,
                COALESCE(u.rpa, '-') AS rpa,
                COUNT(ss.student_id) AS total_eligible,
                SUM(ss.is_delivered) AS total_delivered,
                SUM(ss.is_returned) AS total_returned,
                SUM(ss.is_planned) AS total_planned,
                SUM(ss.has_active_livox) AS total_livox,
                -- MATEMÁTICA CORRIGIDA: Pendente = Elegíveis - (Entregues + Devolvidos + Planejados)
                (COUNT(ss.student_id) - SUM(ss.is_delivered) - SUM(ss.is_returned) - SUM(ss.is_planned)) AS total_pending,
                COALESCE((
                    SELECT COUNT(id) FROM assets 
                    WHERE current_unit_id = u.id AND allow_automation = FALSE AND status NOT IN ('retired', 'disposed')
                ), 0) AS total_reserve
            FROM units u
            JOIN StudentStatus ss ON u.id = ss.school_unit_id
            GROUP BY u.id, u.name, u.rpa
            ORDER BY total_delivered DESC, u.name ASC
        `;
        
        const result = await pool.query(query);
        const data = result.rows;

        if (data.length === 0) return res.status(404).json({ message: 'Nenhum dado encontrado.' });

        let sumEligible = 0, sumDelivered = 0, sumReturned = 0, sumPending = 0, sumLivox = 0, sumReserve = 0;

        const bodyData = data.map(r => {
            sumEligible += parseInt(r.total_eligible);
            sumDelivered += parseInt(r.total_delivered);
            sumReturned += parseInt(r.total_returned);
            sumPending += parseInt(r.total_pending);
            sumLivox += parseInt(r.total_livox);
            sumReserve += parseInt(r.total_reserve);

            return [
                r.rpa, r.school_name, r.total_eligible, r.total_delivered, 
                r.total_returned, r.total_pending, r.total_livox, r.total_reserve
            ];
        });

        const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
        let logoBase64 = null;
        if (fs.existsSync(logoPath)) logoBase64 = fs.readFileSync(logoPath, 'base64');

        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [30, 80, 30, 40],
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 40 } : { text: '' },
                    { text: 'SGA - RELATÓRIO CONSOLIDADO DE LOGÍSTICA DE TABLETS', style: 'header', alignment: 'center', margin: [0, 10, 40, 0] }
                ]
            },
            content: [
                { text: `Extração: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, fontSize: 8, alignment: 'right', margin: [0, 0, 0, 10] },
                {
                    table: {
                        headerRows: 1,
                        widths: [35, '*', 45, 50, 60, 50, 35, 45],
                        body: [
                            ['RPA', 'Unidade Escolar', 'Elegíveis', 'Entregues', 'Devolvidos', 'Pendentes', 'Livox', 'Reserva'].map(h => ({ text: h, style: 'tableHeader' })),
                            ...bodyData,
                            [
                                { text: 'TOTAIS GERAIS', colSpan: 2, style: 'tableHeader', alignment: 'right' }, {},
                                { text: sumEligible.toString(), style: 'tableHeader' },
                                { text: sumDelivered.toString(), style: 'tableHeader' },
                                { text: sumReturned.toString(), style: 'tableHeader' },
                                { text: sumPending.toString(), style: 'tableHeader', color: '#ffcccc' },
                                { text: sumLivox.toString(), style: 'tableHeader' },
                                { text: sumReserve.toString(), style: 'tableHeader' }
                            ]
                        ]
                    },
                    layout: 'lightHorizontalLines'
                }
            ],
            styles: {
                header: { fontSize: 12, bold: true },
                tableHeader: { bold: true, fontSize: 8, color: 'white', fillColor: '#1e3a8a', alignment: 'center' },
            },
            defaultStyle: { font: 'Roboto', fontSize: 8, alignment: 'center' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => {
            res.header('Content-Type', 'application/pdf');
            res.send(Buffer.concat(chunks));
        });
        pdfDoc.end();
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({ message: 'Erro ao gerar o PDF.' });
    }
});

// =====================================================================
// RELATÓRIO CONSOLIDADO DE TABLETS (XLSX) - MATEMÁTICA CORRIGIDA (SEM NaN)
// =====================================================================
app.get('/api/reports/tablets/consolidated/xlsx', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    try {
        const query = `
            WITH StudentStatus AS (
                SELECT 
                    s.school_unit_id,
                    s.id AS student_id,
                    MAX(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) as is_delivered,
                    -- Lógica original restabelecida para Devolvidos
                    CASE WHEN MAX(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) = 0 
                         AND MAX(CASE WHEN dbi.delivery_status = 'devolvido' THEN 1 ELSE 0 END) = 1 
                         THEN 1 ELSE 0 END as is_returned,
                    MAX(CASE WHEN a.has_livox = TRUE AND dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) as has_active_livox
                FROM tablet_eligible_students s
                LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
                LEFT JOIN assets a ON dbi.asset_id = a.id
                GROUP BY s.id, s.school_unit_id
            )
            SELECT 
                u.name AS school_name,
                COALESCE(u.rpa, '-') AS rpa,
                COUNT(ss.student_id) AS total_eligible,
                COALESCE(SUM(ss.is_delivered), 0) AS total_delivered,
                COALESCE(SUM(ss.is_returned), 0) AS total_returned,
                -- Lógica original restabelecida para Pendentes: Elegíveis - Entregues - Devolvidos
                (COUNT(ss.student_id) - COALESCE(SUM(ss.is_delivered), 0) - COALESCE(SUM(ss.is_returned), 0)) AS total_pending,
                
                -- Blindagem contra o NaN no Livox e Reserva
                COALESCE(SUM(ss.has_active_livox), 0) AS total_livox,
                COALESCE((
                    SELECT COUNT(id) FROM assets 
                    WHERE current_unit_id = u.id AND allow_automation = FALSE AND status IN ('available', 'maintenance', 'in_use', 'loaned')
                ), 0) AS total_reserve
            FROM units u
            JOIN StudentStatus ss ON u.id = ss.school_unit_id
            GROUP BY u.id, u.name, u.rpa
            ORDER BY total_delivered DESC, u.name ASC
        `;
        
        const result = await pool.query(query);

        const rows = result.rows.map(r => ({
            rpa: r.rpa,
            school: r.school_name,
            eligible: parseInt(r.total_eligible, 10) || 0,
            delivered: parseInt(r.total_delivered, 10) || 0,
            returned: parseInt(r.total_returned, 10) || 0,
            pending: Math.max(0, parseInt(r.total_pending, 10) || 0),
            livox: parseInt(r.total_livox, 10) || 0, // NaN resolvido
            reserve: parseInt(r.total_reserve, 10) || 0 // NaN resolvido
        }));

        const columns = [
            { header: 'RPA', key: 'rpa', width: 10 },
            { header: 'UNIDADE ESCOLAR', key: 'school', width: 45 },
            { header: 'ELEGÍVEIS', key: 'eligible', width: 15 },
            { header: 'ENTREGUES', key: 'delivered', width: 15 },
            { header: 'DEVOLVIDOS', key: 'returned', width: 15 },
            { header: 'PENDENTES', key: 'pending', width: 15 },
            { header: 'LIVOX (PCD)', key: 'livox', width: 15 },
            { header: 'RESERVA TÉCNICA', key: 'reserve', width: 18 }
        ];

        await generateStyledExcel(res, 'Resumo por Escola', 'Consolidado_Entregas_Tablets.xlsx', columns, rows);

    } catch (error) {
        console.error('Erro Excel consolidado:', error);
        res.status(500).json({ message: 'Erro interno ao gerar planilha.' });
    }
});

// ======================================
// NOVAS ROTAS DE RELATÓRIOS - SETORES E TIPOS DE ITENS
// ======================================

/// --- RELATÓRIOS DE SETORES (ATUALIZADO COM RPA) ---

const getUnitsReportData = async () => {
  // 1. ALTERAÇÃO: Adicionado o campo 'rpa' na query
  const result = await pool.query('SELECT code, name, type, address, contact_phone, rpa FROM units ORDER BY type, name');
  return result.rows;
};

app.get('/api/reports/units/csv', authenticateToken, async (req, res) => {
  try {
    const units = await getUnitsReportData();
    // 2. ALTERAÇÃO: Adicionado 'RPA' no cabeçalho
    const headers = ['Código', 'RPA', 'Nome da Unidade', 'Tipo', 'Endereço', 'Telefone'];
    const csvRows = [headers.join(';')];
    for (const unit of units) {
      const row = [
        unit.code || 'N/A',
        unit.rpa || '', // 3. ALTERAÇÃO: Valor do RPA na linha
        unit.name,
        unit.type,
        (unit.address || '').replace(/"/g, '""'),
        unit.contact_phone || 'N/A'
      ];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_unidades.csv');
    res.send(Buffer.from(csvRows.join('\n')));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de unidades.' }); }
});

app.get('/api/reports/units/xlsx', authenticateToken, async (req, res) => {
    try {
        const units = await getUnitsReportData();
        const dataForSheet = units.map(u => ({
            'Código': u.code || 'N/A',
            'RPA': u.rpa || '', // 4. ALTERAÇÃO: Coluna RPA adicionada ao objeto do Excel
            'Nome da Unidade': u.name,
            'Tipo': u.type,
            'Endereço': u.address || 'N/A',
            'Telefone': u.contact_phone || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Unidades');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('relatorio_unidades.xlsx');
        res.send(buffer);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de unidades.' }); }
});

app.get('/api/reports/units/pdf', authenticateToken, async (req, res) => {
  try {
    const units = await getUnitsReportData();
    if (units.length === 0) {
      return res.status(404).json({ message: 'Nenhuma unidade encontrada para gerar relatório.' });
    }

    const bodyData = units.map(u => [
      u.code || 'N/A',
      u.rpa || '-', // 5. ALTERAÇÃO: RPA no PDF também
      u.name,
      u.type,
      u.contact_phone || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Unidades Cadastradas', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            // Ajustei as larguras para caber o RPA
            widths: ['auto', 'auto', '*', 'auto', 'auto'],
            body: [
              ['Código', 'RPA', 'Nome da Unidade', 'Tipo', 'Telefone'].map(h => ({ text: h, style: 'tableHeader', bold: true })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Unidades: ${units.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: { header: { fontSize: 18, bold: true }, footer: { fontSize: 10, italics: true } },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_unidades.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'unit_report_pdf', null, { count: units.length }, req.ip);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de unidades.' }); }
});

// --- RELATÓRIOS DE TIPOS DE ITENS ---

const getItemTypesReportData = async () => {
  const result = await pool.query('SELECT code, name, description FROM item_types ORDER BY name');
  return result.rows;
};

app.get('/api/reports/item-types/csv', authenticateToken, async (req, res) => {
  try {
    const itemTypes = await getItemTypesReportData();
    const headers = ['Código', 'Nome', 'Descrição'];
    const csvRows = [headers.join(';')];
    for (const item of itemTypes) {
      const row = [item.code, item.name, (item.description || '').replace(/"/g, '""')];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_tipos_de_itens.csv');
    res.send(Buffer.from(csvRows.join('\n')));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de tipos de itens.' }); }
});

app.get('/api/reports/item-types/xlsx', authenticateToken, async (req, res) => {
    try {
        const itemTypes = await getItemTypesReportData();
        const dataForSheet = itemTypes.map(it => ({
            'Código': it.code,
            'Nome': it.name,
            'Descrição': it.description || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tipos de Itens');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('relatorio_tipos_de_itens.xlsx');
        res.send(buffer);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de tipos de itens.' }); }
});

app.get('/api/reports/item-types/pdf', authenticateToken, async (req, res) => {
  try {
    const itemTypes = await getItemTypesReportData();
    if (itemTypes.length === 0) {
      return res.status(404).json({ message: 'Nenhum tipo de item encontrado para gerar relatório.' });
    }

    const bodyData = itemTypes.map(it => [
      it.code,
      it.name,
      it.description || ''
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Tipos de Itens', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto'],
            body: [
              ['Código', 'Nome', 'Descrição'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Tipos de Itens: ${itemTypes.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: { /* Estilos do PDF... */ },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_tipos_de_itens.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'item_type_report_xlsx', null, { count: itemTypes.length }, req.ip);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de tipos de itens.' }); }
});

// Arquivo: server.js

// ======================================
// NOVAS ROTAS DE GESTÃO DE USUÁRIOS
// ======================================

// Rota para listar todos os usuários (ADMIN APENAS)
app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, full_name, role, created_at, is_active FROM users ORDER BY full_name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA LISTAR MOVIMENTAÇÕES COM RECIBOS DE ENTREGA CONFIRMADOS
app.get('/api/receipts/confirmed', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const query = `
      SELECT
        am.id,
        am.actual_delivery_date,
        am.receipt_path,
        p.full_name AS recipient_display_name
      FROM
        asset_movements am
      JOIN
        people p ON am.recipient_person_id = p.id
      WHERE
        am.delivery_status = 'confirmed' AND am.receipt_path IS NOT NULL
      ORDER BY
        am.actual_delivery_date DESC;
    `;
    
    const movementsResult = await pool.query(query);

    // Para cada movimentação, buscamos os ativos para dar contexto
    const movementsWithDetails = await Promise.all(movementsResult.rows.map(async (movement) => {
      const assetsResult = await pool.query(
        `SELECT a.patrimonio_number, a.brand, a.model 
         FROM movement_assets ma
         JOIN assets a ON ma.asset_id = a.id
         WHERE ma.movement_id = $1`,
        [movement.id]
      );
      return { ...movement, assets: assetsResult.rows };
    }));

    await logAudit(req.user.id, 'list_confirmed_receipts', 'asset_movement', null, { count: movementsWithDetails.length }, ipAddress);
    res.status(200).json(movementsWithDetails);

  } catch (error) {
    console.error('Erro ao buscar recibos confirmados:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA FAZER O DOWNLOAD DO RECIBO ASSINADO DE UMA MOVIMENTAÇÃO
app.get('/api/receipts/:movementId/download', authenticateToken, async (req, res) => {
  const movementId = parseInt(req.params.movementId, 10);
  try {
    // Busca o caminho do arquivo no banco de dados
    const result = await pool.query(
      'SELECT receipt_path FROM asset_movements WHERE id = $1 AND delivery_status = $2',
      [movementId, 'confirmed']
    );

    if (result.rows.length === 0 || !result.rows[0].receipt_path) {
      return res.status(404).json({ message: 'Recibo assinado não encontrado para esta movimentação.' });
    }
    
    const filePath = result.rows[0].receipt_path;
    
    // Verifica se o arquivo realmente existe no servidor antes de tentar enviar
    if (!fs.existsSync(filePath)) {
        console.error(`Arquivo não encontrado no caminho: ${filePath}`);
        return res.status(404).json({ message: 'O arquivo do recibo não foi encontrado no servidor.' });
    }
    
    // Usa res.download() para enviar o arquivo de forma segura
    res.download(filePath, (err) => {
      if (err) {
        console.error("Erro no download do arquivo:", err);
        if (!res.headersSent) {
            res.status(500).send("Não foi possível baixar o arquivo.");
        }
      }
    });

  } catch (error) {
    console.error('Erro ao processar download do recibo:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// NOVA ROTA ABAIXO DA ROTA DE LISTAR USUÁRIOS 

// Rota para deletar um usuário (ADMIN APENAS)
app.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userIdToDelete = parseInt(req.params.id, 10);
  const loggedInUserId = req.user.id;
  const ipAddress = req.ip;

  if (userIdToDelete === loggedInUserId) {
    await logAudit(loggedInUserId, 'delete_user_failed', 'user', userIdToDelete, { reason: 'Admin tried to delete self' }, ipAddress);
    return res.status(403).json({ message: 'Você não pode remover sua própria conta de administrador.' });
  }

  const client = await pool.connect(); // Pega uma conexão do pool para a transação

  try {
    await client.query('BEGIN'); // Inicia a transação

    // 1. Anonimiza os logs de auditoria do usuário que será deletado
    // Em vez de deletar os logs, apenas removemos a referência ao usuário.
    await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [userIdToDelete]);
    
    // Você pode adicionar lógicas similares para outras tabelas que tenham o user_id, se houver.

    // 2. Agora, deleta o usuário com segurança
    const deleteResult = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userIdToDelete]);

    if (deleteResult.rowCount === 0) {
      // Se o usuário não existia, desfaz a transação
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Se tudo deu certo, confirma a transação
    await client.query('COMMIT');

    // Registra o log de auditoria da exclusão bem-sucedida (agora fora da transação)
    await logAudit(loggedInUserId, 'delete_user_success', 'user', userIdToDelete, { deleted_user_email: deleteResult.rows[0].email }, ipAddress);
    
    res.status(200).json({ message: 'Usuário removido com sucesso.' });

  } catch (error) {
    // Se qualquer passo falhar, desfaz todas as operações da transação
    await client.query('ROLLBACK');
    
    console.error('Erro ao remover usuário:', error);
    await logAudit(loggedInUserId, 'delete_user_error', 'user', userIdToDelete, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao remover usuário.' });
  } finally {
    // Libera a conexão de volta para o pool
    client.release();
  }
});

// Rota para atualizar um usuário (ADMIN APENAS)
app.put('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userIdToUpdate = parseInt(req.params.id, 10);
  // <<< 'is_active' ADICIONADO AQUI >>>
  const { full_name, username, email, role, is_active } = req.body;
  const ipAddress = req.ip;

  // Validação dos dados recebidos
  if (!full_name || !username || !email || !role || typeof is_active !== 'boolean') {
    return res.status(400).json({ message: 'Todos os campos, incluindo o status de ativação, são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      // <<< QUERY ATUALIZADA PARA INCLUIR 'is_active' >>>
      `UPDATE users SET full_name = $1, username = $2, email = $3, role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING id, full_name, username, email, role, is_active`,
      [full_name, username, email, role, is_active, userIdToUpdate]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado para atualização.' });
    }

    await logAudit(req.user.id, 'update_user_success', 'user', userIdToUpdate, { updated_data: result.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Usuário atualizado com sucesso.', user: result.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    if (error.code === '23505') {
        return res.status(409).json({ message: 'O username ou email já está em uso por outra conta.' });
    }
    await logAudit(req.user.id, 'update_user_error', 'user', userIdToUpdate, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar usuário.' });
  }
});

// ======================================
// NOVA ROTA DE AUDITORIA
// ======================================

// Rota para listar os logs de auditoria (ADMIN APENAS)
// server.js -> SUBSTITUA A ROTA EXISTENTE PELA VERSÃO ABAIXO

// Rota para listar os logs de auditoria (AGORA COM FILTROS)
app.get('/api/audit-logs', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    // Extrai os possíveis filtros da query string da URL
    const { userId, actionType, startDate, endDate } = req.query;

    let baseQuery = `
      SELECT
         al.id, al.action_type, al.target_entity, al.target_id,
         al.details, al.ip_address, al.created_at,
         u.full_name as user_name, u.username
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
    `;

    const whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (userId) {
      whereClauses.push(`al.user_id = $${paramIndex++}`);
      queryParams.push(userId);
    }
    if (actionType) {
      whereClauses.push(`al.action_type = $${paramIndex++}`);
      queryParams.push(actionType);
    }
    if (startDate) {
      whereClauses.push(`al.created_at >= $${paramIndex++}`);
      queryParams.push(startDate);
    }
    if (endDate) {
      // Adicionamos 1 dia e buscamos por '<' para incluir o dia inteiro de endDate
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      whereClauses.push(`al.created_at < $${paramIndex++}`);
      queryParams.push(nextDay.toISOString().split('T')[0]);
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY al.created_at DESC LIMIT 200`;

    const result = await pool.query(baseQuery, queryParams);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// >>> NOVA ROTA PARA ALTERAÇÃO DE SENHA <<<

// Rota para o usuário logado alterar a própria senha
app.post('/api/users/me/change-password', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // 1. Validações iniciais
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'Todos os campos de senha são obrigatórios.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'A nova senha e a confirmação não correspondem.' });
  }
  if (newPassword.length < 6) { // Exemplo de regra de complexidade
    return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    // 2. Verifica se a senha atual fornecida está correta
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      await logAudit(userId, 'password_change_failed', 'user', userId, { reason: 'Incorrect current password' }, req.ip);
      return res.status(403).json({ message: 'A senha atual está incorreta.' });
    }

    // 3. Criptografa e salva a nova senha
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', 
      [newPasswordHash, userId]
    );

    // CRUCIAL: Gera um novo token com a informação 'must_change_password: false'
    const newPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      must_change_password: false, // <-- A informação atualizada
    };
    const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '8h' });

    await logAudit(userId, 'password_change_success', 'user', userId, null, req.ip);
    
    // Envia o novo token junto com a mensagem de sucesso
    res.status(200).json({ message: 'Senha alterada com sucesso!', token: newToken });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    await logAudit(userId, 'password_change_error', 'user', userId, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao alterar senha.' });
  }
});

// ======================================
// Funções Auxiliares
// ======================================

// Função para gerar SKU (CORRIGIDA)
// Padrão: ABC123XXX
// ABC: três letras da marca (se somente duas, acrescentar 'X')
// 123: sequência numérica crescente
// XXX: sigla do tipo de item

// Função Auxiliar para criar filtros dinâmicos de Movimentações (ATUALIZADA COM IMEI/CHIP)
async function getFilteredMovements(filters) {
  // Adicionados 'imei' e 'chip' na desestruturação
  const { startDate, endDate, patrimonio, movementType, solicitante, cpf, matricula, imei, chip } = filters;

  let queryParams = [];
  let whereClauses = [];

  let baseQuery = `
    SELECT DISTINCT
       am.*, 
       u.username AS responsible_username, 
       u.full_name AS responsible_full_name,
       COALESCE(p.full_name, am.recipient_name) AS recipient_display_name,
       p.cpf AS recipient_person_cpf,
       p.registration_number AS recipient_person_registration,
       un.name AS destination_unit_name
      FROM asset_movements am
      JOIN users u ON am.responsible_user_id = u.id
      LEFT JOIN people p ON am.recipient_person_id = p.id
      LEFT JOIN units un ON am.destination_unit_id = un.id
      LEFT JOIN movement_assets ma ON am.id = ma.movement_id
      LEFT JOIN assets a ON ma.asset_id = a.id
  `;

  // --- FILTROS ---
  if (patrimonio) {
    queryParams.push(`%${patrimonio}%`);
    whereClauses.push(`(a.patrimonio_number ILIKE $${queryParams.length} OR a.serial_number ILIKE $${queryParams.length})`);
  }
  // NOVO: Filtro por IMEI
  if (imei) {
    queryParams.push(`%${imei}%`);
    whereClauses.push(`a.imei ILIKE $${queryParams.length}`);
  }
  // NOVO: Filtro por Chip
  if (chip) {
    // Remove caracteres não numéricos para busca mais assertiva
    const cleanChip = chip.replace(/\D/g, '');
    if (cleanChip.length > 0) {
        queryParams.push(`%${cleanChip}%`);
        whereClauses.push(`a.sim_card_number LIKE $${queryParams.length}`);
    }
  }

  if (solicitante) {
    queryParams.push(`%${solicitante}%`);
    whereClauses.push(`p.full_name ILIKE $${queryParams.length}`);
  }
  if (cpf) {
    queryParams.push(cpf);
    whereClauses.push(`p.cpf = $${queryParams.length}`);
  }
  if (matricula) {
    queryParams.push(matricula);
    whereClauses.push(`p.registration_number = $${queryParams.length}`);
  }
  if (startDate) {
    queryParams.push(startDate);
    whereClauses.push(`am.movement_date >= $${queryParams.length}`);
  }
  if (endDate) {
    // Ajuste para pegar o final do dia
    queryParams.push(`${endDate} 23:59:59`);
    whereClauses.push(`am.movement_date <= $${queryParams.length}`);
  }
  if (movementType) {
    queryParams.push(movementType);
    whereClauses.push(`am.movement_type = $${queryParams.length}`);
  }

  if (whereClauses.length > 0) {
    baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  baseQuery += ` ORDER BY am.movement_date DESC, am.id DESC`;

  const result = await pool.query(baseQuery, queryParams);

  // Busca os ativos detalhados (incluindo IMEI/Chip na resposta visual)
  const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
    const assetsResult = await pool.query(
      `SELECT a.id, a.sku, a.patrimonio_number, a.brand, a.model, 
              a.imei, a.sim_card_number, -- Trazendo dados técnicos
              it.name as item_type_name
       FROM movement_assets ma 
       JOIN assets a ON ma.asset_id = a.id 
       LEFT JOIN item_types it ON a.item_type_id = it.id
       WHERE ma.movement_id = $1`,
      [movement.id]
    );
    
    const periphResult = await pool.query(
        `SELECT * FROM movement_peripherals WHERE movement_id = $1`, 
        [movement.id]
    );

    return { 
        ...movement, 
        assets: assetsResult.rows,
        peripherals: periphResult.rows 
    };
  }));

  return movementsWithAssets;
}

// Helper para gerar uma abreviação semântica para nomes (ex: "Secretaria de Educação" -> "EDU")
function getSemanticAbbreviation(name, defaultAbbr = 'XXX') {
  // Palavras comuns a serem ignoradas na abreviação
  const commonWords = ['de', 'da', 'do', 'dos', 'das', 'e', 'ou', 'com', 'para', 'em', 'um', 'uma', 'os', 'as', 'a', 'o', 'geral', 'gerência', 'secretaria', 'departamento', 'coordenação'];
  
  // Filtra palavras significativas e as converte para maiúsculas
  const words = name.split(' ')
                    .filter(word => word.length > 2 && !commonWords.includes(word.toLowerCase()))
                    .map(word => word.toUpperCase());

  if (words.length === 0) {
    // Se não houver palavras significativas, tenta pegar as 3 primeiras letras do nome original
    return name.substring(0, 3).toUpperCase().padStart(3, 'X');
  }

  // Prioriza a última palavra significativa para a abreviação
  let abbr = words[words.length - 1].substring(0, 3);

  // Se a abreviação ainda for muito curta e houver mais palavras,
  // tenta combinar as primeiras letras das palavras significativas.
  if (abbr.length < 3 && words.length > 1) {
    abbr = '';
    for (let i = 0; i < words.length && abbr.length < 3; i++) {
      abbr += words[i].charAt(0);
    }
  }
  
  // Garante que a abreviação tenha 3 caracteres, preenchendo com 'X' se necessário
  while (abbr.length < 3) {
    abbr += 'X';
  }
  return abbr.substring(0, 3); // Garante que não exceda 3 caracteres
}

// Criar um novo Tipo de Item (via formulário)
app.post('/api/item-types', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { name, description, sku_code } = req.body;
  const ipAddress = req.ip;

  // Validação dos campos
  if (!name || !sku_code) {
    return res.status(400).json({ message: 'Nome e Código SKU (3 letras) são obrigatórios.' });
  }
  if (String(sku_code).length !== 3) {
    return res.status(400).json({ message: 'O Código SKU deve ter exatamente 3 caracteres.' });
  }

  try {
    // Lógica para gerar o código principal (ex: SEDUC001)
    const lastItemType = await pool.query('SELECT code FROM item_types ORDER BY id DESC LIMIT 1');
    let newCodeNum = 1;
    if (lastItemType.rows.length > 0) {
      const lastCode = lastItemType.rows[0].code;
      // Regex para encontrar o número depois de 'SEDUC'
      const numMatch = lastCode.match(/SEDUC(\d+)/);
      if (numMatch && numMatch[1]) {
        newCodeNum = parseInt(numMatch[1], 10) + 1;
      }
    }
    const code = `SEDUC${String(newCodeNum).padStart(3, '0')}`;

    const newItemType = await pool.query(
      `INSERT INTO item_types (code, name, description, sku_code)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, name, description, sku_code.toUpperCase()]
    );

    await logAudit(req.user.id, 'create_item_type', 'item_type', newItemType.rows[0].id, { name, code, sku_code }, ipAddress);
    res.status(201).json({ message: 'Tipo de item criado com sucesso.', itemType: newItemType.rows[0] });

  } catch (error) {
    console.error('Erro ao criar tipo de item:', error);
    if (error.code === '23505') { 
      // Verifica se a violação foi na coluna sku_code (o nome da constraint geralmente contém a coluna)
      if (error.constraint && error.constraint.includes('sku_code')) {
         return res.status(400).json({ message: `O Código SKU '${sku_code.toUpperCase()}' já está em uso por outro item. Utilize uma variação (ex: SW8, S24).` });
      }
      // Verifica se a violação foi no nome
      if (error.constraint && error.constraint.includes('name')) {
         return res.status(400).json({ message: `O nome '${name}' já está cadastrado.` });
      }
      
      // Fallback caso não identifique a coluna
      return res.status(400).json({ message: 'Já existe um item com este Nome ou SKU.' });
    }
    
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Listar todos os Tipos de Itens
app.get('/api/item-types', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM item_types ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar tipos de itens:', error);
    await logAudit(req.user.id, 'list_item_types_error', 'item_type', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar tipos de itens.' });
  }
});

// Obter Tipo de Item por ID
app.get('/api/item-types/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM item_types WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter tipo de item:', error);
    await logAudit(req.user.id, 'get_item_type_error', 'item_type', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter tipo de item.' });
  }
});

// Atualizar Tipo de Item
app.put('/api/item-types/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { name, description, sku_code } = req.body; // ✨ Recebe o novo campo
  const ipAddress = req.ip;

  if (!name || !sku_code) { // ✨ Valida o novo campo
    return res.status(400).json({ message: 'Nome e Código SKU (3 letras) são obrigatórios.' });
  }
  if (sku_code.length !== 3) { // ✨ Valida o tamanho
    return res.status(400).json({ message: 'O Código SKU deve ter exatamente 3 caracteres.' });
  }

  try {
    const oldItemTypeResult = await pool.query('SELECT * FROM item_types WHERE id = $1', [id]);
    if (oldItemTypeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado para atualização.' });
    }
    const oldItemType = oldItemTypeResult.rows[0];

    const updatedItemType = await pool.query(
      `UPDATE item_types SET name = $1, description = $2, sku_code = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [name, description, sku_code.toUpperCase(), id] // ✨ Atualiza o novo campo
    );

    await logAudit(req.user.id, 'update_item_type', 'item_type', id, { old_data: oldItemType, new_data: updatedItemType.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Tipo de item atualizado com sucesso.', itemType: updatedItemType.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar tipo de item:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Tipo de item com este nome ou Código SKU já existe.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar tipo de item.' });
  }
});

// Deletar Tipo de Item
app.delete('/api/item-types/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem ativos associados a este tipo de item
    const assetsCount = await pool.query('SELECT COUNT(*) FROM assets WHERE item_type_id = $1', [id]);
    if (parseInt(assetsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar este tipo de item, pois existem ativos associados a ele.' });
    }

    const deletedItemType = await pool.query('DELETE FROM item_types WHERE id = $1 RETURNING *', [id]);
    if (deletedItemType.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_item_type', 'item_type', id, { deleted_item_type: deletedItemType.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Tipo de item deletado com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar tipo de item:', error);
    await logAudit(req.user.id, 'delete_item_type_error', 'item_type', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar tipo de item.' });
  }
});

// ======================================
// Rotas para Unidades (Units) - NOVA ESTRUTURA
// ======================================

// Listar todas as Unidades (com filtro opcional por tipo)
app.get('/api/units', authenticateToken, async (req, res) => {
  const { type } = req.query;
  try {
    // A nova query inclui uma subconsulta para contar os ativos em cada unidade
    let query = `
      SELECT
        u.*,
        COALESCE(asset_counts.count, 0) AS current_assets_count
      FROM
        units u
      LEFT JOIN
        (
          SELECT
            current_unit_id,
            COUNT(id) as count
          FROM
            assets
          WHERE
            current_unit_id IS NOT NULL
          GROUP BY
            current_unit_id
        ) AS asset_counts ON u.id = asset_counts.current_unit_id
    `;
    const params = [];

    if (type) {
      params.push(type);
      // Adiciona a cláusula WHERE ou AND dependendo se a query já tem um WHERE
      query += ' WHERE u.type = $1';
    }

    query += ' ORDER BY u.name ASC';
    
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar unidades:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao listar unidades.' });
  }
});

// Criar uma nova Unidade (COM RPA)
app.post('/api/units', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { type, name, code, parent_id, address, contact_phone, contact_email, notes, rpa } = req.body; // <--- Adicionado rpa
  const ipAddress = req.ip;

  if (!type || !name) {
    return res.status(400).json({ message: 'Tipo e Nome da unidade são obrigatórios.' });
  }

  try {
    const newUnit = await pool.query(
      `INSERT INTO units (type, name, code, parent_id, address, contact_phone, contact_email, notes, rpa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, // <--- Adicionado $9
      [
          type, 
          name, 
          code || null, 
          parent_id || null, 
          address || null, 
          contact_phone || null, 
          contact_email || null, 
          notes || null, 
          rpa || null // <--- Valor do RPA
      ]
    );

    await logAudit(req.user.id, 'create_unit', 'unit', newUnit.rows[0].id, { unit_name: name, type }, ipAddress);
    res.status(201).json({ message: 'Unidade criada com sucesso.', unit: newUnit.rows[0] });

  } catch (error) {
    console.error('Erro ao criar unidade:', error);
    if (error.code === '23505') { // Erro de violação de unique (código ou nome)
      return res.status(409).json({ message: 'Já existe uma unidade com este nome ou código.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao criar unidade.' });
  }
});

// ATUALIZAR UNIDADE (COM RPA)
app.put('/api/units/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
    const { id: idFromParams } = req.params;
    // Capturamos o parent_id com um nome temporário e o rpa
    const { name, code, parent_id: parentIdFromRequest, status, type, address, contact_phone, contact_email, notes, rpa } = req.body; // <--- Adicionado rpa
    const ipAddress = req.ip;

    // A CORREÇÃO CRUCIAL ACONTECE AQUI:
    // Convertemos o parent_id para número ou null, garantindo o tipo correto.
    const parent_id = parentIdFromRequest ? parseInt(parentIdFromRequest, 10) : null;
    
    if (!name || !status || !type) {
        return res.status(400).json({ message: 'Nome, Status e Tipo são obrigatórios.' });
    }

    try {
        const id = parseInt(idFromParams, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de unidade inválido.' });
        }

        // ===== INÍCIO DOS BLOCOS DE VERIFICAÇÃO DE DUPLICIDADE =====

        // Verificação 1: Checa se o CÓDIGO (se existir) já pertence a OUTRA unidade.
        if (code) {
            const codeConflictCheck = await pool.query(
                `SELECT id FROM units WHERE code = $1 AND id != $2`,
                [code.toUpperCase(), id]
            );
            if (codeConflictCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Já existe outra unidade com este Código/Sigla.' });
            }
        }

        // Verificação 2: Checa se a combinação de NOME, TIPO e PAI já pertence a OUTRA unidade.
        const nameConflictCheck = await pool.query(
            // "IS NOT DISTINCT FROM" lida corretamente com parent_id que pode ser NULL
            `SELECT id FROM units WHERE name = $1 AND type = $2 AND parent_id IS NOT DISTINCT FROM $3 AND id != $4`,
            [name, type, parent_id || null, id]
        );
        if (nameConflictCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Já existe outra unidade com este nome na mesma hierarquia.' });
        }

        // ===== FIM DOS BLOCOS DE VERIFICAÇÃO =====
        
        const updatedUnit = await pool.query(
            `UPDATE units SET 
                name = $1, code = $2, parent_id = $3, status = $4, address = $5, 
                contact_phone = $6, contact_email = $7, notes = $8, updated_at = NOW(),
                type = $9, rpa = $10 
            WHERE id = $11 RETURNING *`, // <--- Adicionado rpa=$10 e id virou $11
            [
                name, 
                code || null, 
                parent_id || null, 
                status, 
                address || null, 
                contact_phone || null, 
                contact_email || null, 
                notes || null, 
                type, 
                rpa || null, // <--- Valor $10
                id           // <--- Valor $11
            ]
        );

        if (updatedUnit.rowCount === 0) {
            return res.status(404).json({ message: 'Unidade não encontrada para atualização.' });
        }

        await logAudit(req.user.id, 'update_unit', 'unit', id, { updated_data: updatedUnit.rows[0] }, ipAddress);
        res.status(200).json({ message: 'Unidade atualizada com sucesso.', unit: updatedUnit.rows[0] });

    } catch (error) {
        console.error('Erro ao atualizar unidade:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar unidade.' });
    }
});

// Deletar uma Unidade
app.delete('/api/units/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verifica se a unidade é 'pai' de alguma outra unidade
    const childUnitsCount = await pool.query('SELECT COUNT(*) FROM units WHERE parent_id = $1', [id]);
    if (parseInt(childUnitsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar esta unidade, pois ela é uma unidade superior para outra(s). Remova ou realoque as unidades filhas primeiro.' });
    }

    // Adicionar aqui outras verificações (ex: se existem ativos ou pessoas associados)
    //const assetsCount = await pool.query('SELECT COUNT(*) FROM assets WHERE current_unit_id = $1', [id]);
    // if (parseInt(assetsCount.rows[0].count, 10) > 0) {
    //   return res.status(400).json({ message: 'Não é possível deletar esta unidade, pois existem ativos associados a ela.' });
    // }

    const deletedUnit = await pool.query('DELETE FROM units WHERE id = $1 RETURNING *', [id]);
    if (deletedUnit.rowCount === 0) {
        return res.status(404).json({ message: 'Unidade não encontrada para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_unit', 'unit', id, { deleted_unit: deletedUnit.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Unidade deletada com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar unidade:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar unidade.' });
  }
});

// Criar uma nova Pessoa
app.post('/api/people', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { full_name, unit_id, registration_number, cpf, email, contact_phone, job_title } = req.body;
  const ipAddress = req.ip;

  if (!full_name || !cpf || !email) {
    return res.status(400).json({ message: 'Nome Completo, CPF e Email são obrigatórios.' });
  }

  const formattedPhone = formatPhoneNumber(contact_phone);

  try {
    // Verificar unicidade de CPF, Matrícula e Email
    const existingPerson = await pool.query(
      `SELECT id FROM people WHERE cpf = $1 OR (registration_number IS NOT NULL AND registration_number = $2) OR email = $3`,
      [cpf, registration_number, email]
    );
    if (existingPerson.rows.length > 0) {
      await logAudit(req.user.id, 'person_creation_failed', 'person', null,
        { reason: 'CPF, Registration Number or Email already exists', attempted_cpf: cpf, attempted_registration: registration_number, attempted_email: email }, ipAddress);
      return res.status(409).json({ message: 'Pessoa com este CPF, Matrícula ou Email já cadastrada.' });
    }

    const newPerson = await pool.query(
      `INSERT INTO people (full_name, unit_id, registration_number, cpf, email, contact_phone, job_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [full_name, unit_id || null, registration_number || null, cpf, email, formattedPhone, job_title || null]
    );

    await logAudit(req.user.id, 'create_person', 'person', newPerson.rows[0].id, { full_name, cpf, email }, ipAddress);
    res.status(201).json({ message: 'Pessoa cadastrada com sucesso.', person: newPerson.rows[0] });

  } catch (error) {
    console.error('Erro ao cadastrar nova pessoa:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar pessoa.' });
  }
});

// Listar todas as Pessoas
app.get('/api/people', authenticateToken, async (req, res) => {
  try {
    // A nova query inclui uma subconsulta para contar os ativos de cada pessoa
    const query = `
      SELECT
        p.*,
        u.name AS unit_name,
        COALESCE(asset_counts.count, 0) AS current_assets_count
      FROM
        people p
      LEFT JOIN
        units u ON p.unit_id = u.id
      LEFT JOIN
        (
          -- Subconsulta que calcula a contagem de ativos para cada pessoa
          SELECT
            am.recipient_person_id,
            COUNT(DISTINCT a.id) as count
          FROM
            assets a
          -- Encontra a última movimentação de saída de cada ativo
          JOIN
            (
              SELECT
                ma.asset_id,
                MAX(am.id) as last_movement_id
              FROM
                asset_movements am
              JOIN
                movement_assets ma ON am.id = ma.movement_id
              WHERE
                am.movement_type IN ('exit', 'loan')
              GROUP BY
                ma.asset_id
            ) as latest_movements ON a.id = latest_movements.asset_id
          JOIN
            asset_movements am ON latest_movements.last_movement_id = am.id
          WHERE
            a.status IN ('in_use', 'loaned')
          GROUP BY
            am.recipient_person_id
        ) AS asset_counts ON p.id = asset_counts.recipient_person_id
      ORDER BY
        p.full_name ASC;
    `;

    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pessoas:', error);
    await logAudit(req.user.id, 'list_people_error', 'person', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar pessoas.' });
  }
});

// Obter Pessoa por ID
app.get('/api/people/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
  `SELECT
     p.*,
     u.name AS unit_name
   FROM people p
   LEFT JOIN units u ON p.unit_id = u.id
   WHERE p.id = $1`,
  [id]
);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pessoa:', error);
    await logAudit(req.user.id, 'get_person_error', 'person', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter pessoa.' });
  }
});

// Atualizar Pessoa
app.put('/api/people/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { full_name, unit_id, registration_number, cpf, email, contact_phone, job_title } = req.body;
  const ipAddress = req.ip;

  if (!full_name || !cpf || !email) {
    return res.status(400).json({ message: 'Nome Completo, CPF e Email são obrigatórios.' });
  }

  const formattedPhone = formatPhoneNumber(contact_phone);

  try {
    const oldPersonResult = await pool.query('SELECT * FROM people WHERE id = $1', [id]);
    if (oldPersonResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada para atualização.' });
    }
    const oldPerson = oldPersonResult.rows[0];

    // Verifica se os dados já pertencem a OUTRA pessoa
    const existingConflicts = await pool.query(
      `SELECT id FROM people WHERE (cpf = $1 OR (registration_number IS NOT NULL AND registration_number = $2) OR email = $3) AND id != $4`,
      [cpf, registration_number, email, id]
    );
    if (existingConflicts.rows.length > 0) {
      await logAudit(req.user.id, 'person_update_failed', 'person', id, { reason: 'CPF, Registration Number or Email already exists for another person', attempted_cpf: cpf, attempted_registration: registration_number, attempted_email: email }, ipAddress);
      return res.status(409).json({ message: 'Pessoa com este CPF, Matrícula ou Email já existe para outro cadastro.' });
    }

     const updatedPerson = await pool.query(
      `UPDATE people SET
         full_name = $1, unit_id = $2, registration_number = $3, cpf = $4, email = $5, contact_phone = $6, job_title = $7,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [full_name, unit_id || null, registration_number || null, cpf, email, formattedPhone, job_title || null, id]
    );

    if (updatedPerson.rowCount === 0) {
        return res.status(404).json({ message: 'Pessoa não encontrada para atualização.' });
    }

    await logAudit(req.user.id, 'update_person', 'person', id, { old_data: oldPerson, new_data: updatedPerson.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Pessoa atualizada com sucesso.', person: updatedPerson.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar pessoa:', error);
    if (error.code === '23505') { // Unique violation for CPF, registration_number or email
        return res.status(409).json({ message: 'CPF, Matrícula ou Email já existe para outra pessoa.' });
    }
    await logAudit(req.user.id, 'person_update_error', 'person', id, { error: error.message, full_name, cpf, email }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar pessoa.' });
  }
});

// Deletar Pessoa
app.delete('/api/people/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem movimentações de ativos associadas a esta pessoa
    const movementsCount = await pool.query('SELECT COUNT(*) FROM asset_movements WHERE recipient_person_id = $1', [id]);
    if (parseInt(movementsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar esta pessoa, pois existem movimentações de ativos associadas a ela.' });
    }

    const deletedPerson = await pool.query('DELETE FROM people WHERE id = $1 RETURNING *', [id]);
    if (deletedPerson.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_person', 'person', id, { deleted_person: deletedPerson.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Pessoa deletada com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar pessoa:', error);
    await logAudit(req.user.id, 'delete_person_error', 'person', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar pessoa.' });
  }
});

// ROTA OTIMIZADA PARA BUSCAR PESSOAS (react-select async)
app.get('/api/people/search', authenticateToken, async (req, res) => {
  const { searchTerm } = req.query;

  // Se o termo de busca for muito curto, retorna vazio para não sobrecarregar o banco
  if (!searchTerm || String(searchTerm).length < 3) {
    return res.json([]);
  }

  try {
    const query = `
      SELECT id, full_name, cpf FROM people
      WHERE 
        full_name ILIKE $1 OR
        cpf ILIKE $1
      ORDER BY full_name ASC
      LIMIT 20;
    `;
    // Usamos '%' para buscar por partes do nome/CPF
    const result = await pool.query(query, [`%${searchTerm}%`]);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erro ao buscar pessoas:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// >>> NOVA ROTA PARA DAR BAIXA EM LOTE <<<

app.put('/api/assets/batch-retire', authenticateToken, authorizePermission('ACTION_REQUEST_RETIREMENT'), async (req, res) => {
  const { assetIds, reason } = req.body;
  const ipAddress = req.ip;

  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return res.status(400).json({ message: 'É necessário fornecer uma lista de IDs de ativos.' });
  }
  if (!reason) {
    return res.status(400).json({ message: 'O motivo da baixa é obrigatório.' });
  }

  const client = await pool.connect();
  let successCount = 0;
  const errors = [];
  const processedIds = [];

  try {
    await client.query('BEGIN');

    for (const assetId of assetIds) {
      // 1. Busca cada ativo para validar seu status
      const assetResult = await client.query('SELECT id, status, notes, patrimonio_number FROM assets WHERE id = $1', [assetId]);

      if (assetResult.rows.length === 0) {
        errors.push({ id: assetId, reason: 'Ativo não encontrado.' });
        continue; // Pula para o próximo ID
      }
      
      const asset = assetResult.rows[0];

      // 2. Aplica a regra de negócio: só pode baixar se estiver 'disponível' ou 'em manutenção'
      if (!['available', 'maintenance'].includes(asset.status)) {
        errors.push({ id: assetId, patrimonio: asset.patrimonio_number, reason: `Status atual é '${asset.status}', não pode ser baixado.` });
        continue;
      }

      // 3. Se for válido, prepara a atualização
      const retirementNote = `\n[BAIXADO EM ${new Date().toLocaleDateString('pt-BR')}]: ${reason}`;
      const updatedNotes = (asset.notes || '') + retirementNote;

      await client.query(
        `UPDATE assets SET status = 'retired', notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [updatedNotes, assetId]
      );
      
      successCount++;
      processedIds.push(assetId);
    }

    await client.query('COMMIT'); // Confirma a transação para todos os ativos válidos

    await logAudit(req.user.id, 'batch_retire_asset', 'asset', null, { success_count: successCount, failed_count: errors.length, processed_ids: processedIds, errors }, ipAddress);
    
    res.status(200).json({ 
      message: `Operação concluída. ${successCount} ativos baixados com sucesso.`,
      successCount,
      errors
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao dar baixa em lote:', error);
    res.status(500).json({ message: `Erro ao processar a baixa em lote: ${error.message}` });
  } finally {
    client.release();
  }
});

// ROTA PARA CRIAR UMA SOLICITAÇÃO DE BAIXA (Bloqueia o ativo)
app.post(
  '/api/assets/:id/request-retirement',
  authenticateToken,
  authorizePermission('ACTION_REQUEST_RETIREMENT'), // <--- ADICIONAR ESTA LINHA
  uploadEvidence.single('evidenceFile'), 
  async (req, res) => {
    const assetId = parseInt(req.params.id, 10);
    const { reason, details, retirement_type, document_number, event_date } = req.body;
    const requesterUserId = req.user.id;
    const ipAddress = req.ip;

    if (!req.file) return res.status(400).json({ message: 'O arquivo de evidência (laudo/B.O.) é obrigatório.' });
    if (!reason) {
       fs.unlinkSync(req.file.path);
       return res.status(400).json({ message: 'O motivo da baixa é obrigatório.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verifica status atual
      const assetResult = await client.query('SELECT status FROM assets WHERE id = $1', [assetId]);
      if (assetResult.rows.length === 0) throw new Error('Ativo não encontrado.');

      const currentStatus = assetResult.rows[0].status;
      if (!['available', 'maintenance'].includes(currentStatus)) {
        throw new Error(`Ativos com status '${currentStatus}' não podem ter a baixa solicitada.`);
      }

      // 2. ATUALIZA O STATUS DO ATIVO
      await client.query(
        `UPDATE assets SET status = 'pending_retirement', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [assetId]
      );

      // 3. CRIA A SOLICITAÇÃO (CORREÇÃO: Adicionado o campo 'status')
      const requestResult = await client.query(
        `INSERT INTO retirement_requests 
         (asset_id, requester_user_id, reason, details, evidence_path, retirement_type, document_number, event_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id`, // <--- 'pending' explícito aqui
        [
            assetId, 
            requesterUserId, 
            reason, 
            details || null, 
            req.file.path,
            retirement_type || null,
            document_number || null,
            event_date || null
        ]
      );
      const newRequestId = requestResult.rows[0].id;

      await client.query('COMMIT');
      await logAudit(requesterUserId, 'request_retirement', 'asset', assetId, { requestId: newRequestId, type: retirement_type }, ipAddress);
      
      res.status(201).json({ message: 'Solicitação registrada com sucesso.' });

    } catch (error) {
      await client.query('ROLLBACK');
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Erro ao solicitar baixa:', error);
      res.status(500).json({ message: `Falha: ${error.message}` });
    } finally {
      client.release();
    }
  }
);

// ROTA PARA LISTAR SOLICITAÇÕES DE BAIXA PENDENTES (ADMIN/MANAGER)
app.get('/api/retirement-requests/pending', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  try {
    console.log('[DEBUG] Buscando solicitações pendentes...'); // Log para confirmar que a rota foi chamada

    const result = await pool.query(`
      SELECT
        rr.id,
        rr.status,
        rr.reason,
        rr.details,
        rr.created_at,
        rr.retirement_type,
        rr.document_number,
        rr.event_date,
        a.patrimonio_number,
        a.brand,
        a.model,
        -- LEFT JOIN + COALESCE garante que a linha apareça mesmo sem usuário
        COALESCE(u.full_name, 'Usuário não identificado') as requester_name
      FROM retirement_requests rr
      LEFT JOIN assets a ON rr.asset_id = a.id
      LEFT JOIN users u ON rr.requester_user_id = u.id 
      WHERE rr.status = 'pending'
      ORDER BY rr.created_at ASC
    `);
    
    console.log(`[DEBUG] Encontrados ${result.rows.length} registros.`); // Log da quantidade
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('[ERRO CRÍTICO] Falha ao listar solicitações:', error.message);
    // Retorna o erro detalhado para o frontend (útil para debug agora)
    res.status(500).json({ message: 'Erro interno ao buscar lista: ' + error.message });
  }
});

// ROTA DE DIAGNÓSTICO (Remova depois)
app.get('/api/debug/requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM retirement_requests');
        res.json(result.rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// ROTA PARA APROVAR UMA SOLICITAÇÃO DE BAIXA (ADMIN)
app.put('/api/retirement-requests/:id/approve', authenticateToken, authorizePermission('ACTION_FINAL_APPROVAL'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const approverUserId = req.user.id;
  const ipAddress = req.ip;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Busca a solicitação para obter o asset_id e validar
    const requestResult = await client.query('SELECT asset_id, status FROM retirement_requests WHERE id = $1', [requestId]);
    if (requestResult.rows.length === 0) throw new Error('Solicitação não encontrada.');
    if (requestResult.rows[0].status !== 'pending') throw new Error('Esta solicitação já foi processada.');
    const assetId = requestResult.rows[0].asset_id;

    // Atualiza o status do ativo para 'retired'
    await client.query(
      `UPDATE assets SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [assetId]
    );

    // Atualiza o registro da solicitação para 'approved'
    await client.query(
      `UPDATE retirement_requests SET status = 'approved', approver_user_id = $1, approval_date = CURRENT_TIMESTAMP WHERE id = $2`,
      [approverUserId, requestId]
    );

    await client.query('COMMIT');
    await logAudit(approverUserId, 'approve_retirement', 'asset', assetId, { requestId }, ipAddress);
    res.status(200).json({ message: 'Solicitação de baixa APROVADA com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao aprovar baixa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    res.status(500).json({ message: `Falha na aprovação: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// ROTA PARA REJEITAR UMA SOLICITAÇÃO DE BAIXA (ADMIN)
app.put('/api/retirement-requests/:id/reject', authenticateToken, authorizePermission('ACTION_FINAL_APPROVAL'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const { rejection_reason } = req.body;
  const approverUserId = req.user.id;
  const ipAddress = req.ip;

  if (!rejection_reason) {
    return res.status(400).json({ message: 'O motivo da rejeição é obrigatório.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const requestResult = await client.query('SELECT asset_id, status FROM retirement_requests WHERE id = $1', [requestId]);
    if (requestResult.rows.length === 0) throw new Error('Solicitação não encontrada.');
    if (requestResult.rows[0].status !== 'pending') throw new Error('Esta solicitação já foi processada.');
    const assetId = requestResult.rows[0].asset_id;

    // Reverte o status do ativo para 'available'
    await client.query(
      `UPDATE assets SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [assetId]
    );

    // Atualiza o registro da solicitação para 'rejected'
    await client.query(
      `UPDATE retirement_requests SET status = 'rejected', approver_user_id = $1, approval_date = CURRENT_TIMESTAMP, rejection_reason = $2 WHERE id = $3`,
      [approverUserId, rejection_reason, requestId]
    );

    await client.query('COMMIT');
    await logAudit(approverUserId, 'reject_retirement', 'asset', assetId, { requestId, rejection_reason }, ipAddress);
    res.status(200).json({ message: 'Solicitação de baixa REJEITADA com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao rejeitar baixa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    res.status(500).json({ message: `Falha na rejeição: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// ROTA DE CONSULTA INTELIGENTE E UNIFICADA PARA ATIVOS
app.get('/api/query/asset/:identifier', authenticateToken, async (req, res) => {
  const { identifier } = req.params;
  const ipAddress = req.ip;

  try {
    // Esta é a consulta principal que busca os dados base do ativo
    const assetQuery = `
      SELECT
        a.id, a.sku, a.brand, a.model, a.description, a.serial_number, a.patrimonio_number,
        a.status, a.acquisition_date, a.notes,
        it.name AS item_type_name,
        u.name AS current_unit_name
      FROM assets a
      JOIN item_types it ON a.item_type_id = it.id
      LEFT JOIN units u ON a.current_unit_id = u.id
      WHERE a.patrimonio_number = $1 OR a.serial_number = $1
    `;
    const assetResult = await pool.query(assetQuery, [identifier]);

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado com este identificador.' });
    }
    const assetDetails = assetResult.rows[0];

    // Se o ativo estiver em uso ou emprestado, faremos uma segunda consulta para encontrar o responsável
    if (['in_use', 'loaned'].includes(assetDetails.status)) {
      const responsibleQuery = `
        SELECT
          p.full_name
        FROM people p
        JOIN asset_movements am ON p.id = am.recipient_person_id
        JOIN movement_assets ma ON am.id = ma.movement_id
        WHERE ma.asset_id = $1 AND am.movement_type IN ('exit', 'loan')
        ORDER BY am.movement_date DESC, am.id DESC
        LIMIT 1
      `;
      const responsibleResult = await pool.query(responsibleQuery, [assetDetails.id]);

      if (responsibleResult.rows.length > 0) {
        assetDetails.responsible_person_name = responsibleResult.rows[0].full_name;
      } else {
        assetDetails.responsible_person_name = 'Responsável não localizado no histórico';
      }
    }

    await logAudit(req.user.id, 'query_asset_details', 'asset', assetDetails.id, { identifier }, ipAddress);
    res.status(200).json(assetDetails);

  } catch (error) {
    console.error(`Erro na consulta inteligente do ativo ${identifier}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor ao consultar ativo.' });
  }
});

// ROTA PARA BUSCAR OS DETALHES DE UMA ÚNICA SOLICITAÇÃO
app.get('/api/retirement-requests/:id', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(`
      SELECT
        rr.*,
        a.patrimonio_number, a.brand, a.model, a.serial_number,
        u.full_name as requester_name
      FROM retirement_requests rr
      JOIN assets a ON rr.asset_id = a.id
      LEFT JOIN users u ON rr.requester_user_id = u.id
      WHERE rr.id = $1
    `, [requestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Solicitação não encontrada.' });
    }
    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao buscar detalhes da solicitação:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA FAZER O DOWNLOAD DO ARQUIVO DE EVIDÊNCIA
app.get('/api/retirement-requests/:id/download-evidence', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('SELECT evidence_path FROM retirement_requests WHERE id = $1', [requestId]);
    if (result.rows.length === 0 || !result.rows[0].evidence_path) {
      return res.status(404).json({ message: 'Arquivo de evidência não encontrado para esta solicitação.' });
    }
    const filePath = result.rows[0].evidence_path;
    
    // Usa res.download() para enviar o arquivo de forma segura
    res.download(filePath, (err) => {
      if (err) {
        console.error("Erro no download do arquivo:", err);
        res.status(500).send("Não foi possível baixar o arquivo.");
      }
    });

  } catch (error) {
    console.error('Erro ao processar download:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// NOVO ENDPOINT 1: Listar ativos atualmente associados a uma pessoa
app.get('/api/people/:id/assets', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Esta query encontra os ativos cuja movimentação mais recente foi um 'loan' ou 'exit' para esta pessoa.
    const query = `
      WITH LatestMovement AS (
          SELECT
              ma.asset_id,
              MAX(am.movement_date) as max_date
          FROM asset_movements am
          JOIN movement_assets ma ON am.id = ma.movement_id
          GROUP BY ma.asset_id
      ),
      CurrentResponsible AS (
          SELECT
              ma.asset_id,
              am.recipient_person_id,
              a.status
          FROM asset_movements am
          JOIN movement_assets ma ON am.id = ma.movement_id
          JOIN assets a ON a.id = ma.asset_id
          JOIN LatestMovement lm ON ma.asset_id = lm.asset_id AND am.movement_date = lm.max_date
          WHERE a.status IN ('loaned', 'in_use')
      )
      SELECT
          a.id, a.sku, a.brand, a.model, a.serial_number, a.patrimonio_number,
          it.name as item_type_name
      FROM assets a
      JOIN item_types it ON a.item_type_id = it.id
      JOIN CurrentResponsible cr ON a.id = cr.asset_id
      WHERE cr.recipient_person_id = $1;
    `;
    const result = await pool.query(query, [id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(`Erro ao buscar ativos da pessoa ${id}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar ativos da pessoa.' });
  }
});

// server.js -> ADICIONE ESTA NOVA ROTA COMPLETA

// ROTA PARA BUSCAR O RESUMO DE ATIVOS ATUAIS DE UMA PESSOA
// server.js -> SUBSTITUA A ROTA EXISTENTE PELA VERSÃO FINAL ABAIXO

app.get('/api/people/:id/assets-summary', authenticateToken, async (req, res) => {
  const personId = parseInt(req.params.id, 10);

  try {
    // Esta query agora encontra as MOVIMENTAÇÕES ativas e agrupa os ativos dentro de cada uma
    const query = `
      WITH ActiveMovements AS (
        SELECT
          am.id
        FROM asset_movements am
        WHERE am.movement_type IN ('loan', 'exit')
          AND am.recipient_person_id = $1
          AND EXISTS (
            SELECT 1 FROM movement_assets ma JOIN assets a ON ma.asset_id = a.id
            WHERE ma.movement_id = am.id AND a.status IN ('in_use', 'loaned')
          )
          AND NOT EXISTS (
            SELECT 1 FROM movement_assets ma_ret JOIN asset_movements am_ret ON ma_ret.movement_id = am_ret.id
            WHERE am_ret.movement_type = 'return'
            AND ma_ret.asset_id IN (SELECT asset_id FROM movement_assets WHERE movement_id = am.id)
            AND am_ret.movement_date > am.movement_date
          )
      )
      SELECT
        am.id AS movement_id,
        am.expected_return_date,
        am.delivery_status,
        json_agg(
          json_build_object(
            'id', a.id,
            'patrimonio_number', a.patrimonio_number,
            'item_type_name', it.name,
            'brand', a.brand,
            'model', a.model,
            'status', a.status
          )
        ) AS assets
      FROM asset_movements am
      JOIN movement_assets ma ON am.id = ma.movement_id
      JOIN assets a ON ma.asset_id = a.id
      JOIN item_types it ON a.item_type_id = it.id
      WHERE am.id IN (SELECT id FROM ActiveMovements)
      GROUP BY am.id, am.expected_return_date, am.delivery_status
      ORDER BY am.expected_return_date ASC;
    `;
    
    const result = await pool.query(query, [personId]);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error(`Erro ao buscar resumo de ativos para a pessoa ${personId}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// NOVO ENDPOINT 2: Encontrar um ativo e seu responsável para devolução
app.post('/api/assets/find-for-return', authenticateToken, async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ message: 'Identificador (patrimônio ou nº de série) é obrigatório.' });
  }

  try {
    // 1. Encontrar o ativo
    const assetResult = await pool.query(
        `SELECT a.*, it.name as item_type_name 
         FROM assets a 
         JOIN item_types it ON a.item_type_id = it.id 
         WHERE a.patrimonio_number = $1 OR a.serial_number = $1`, [identifier]
    );
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado.' });
    }
    const asset = assetResult.rows[0];

    // 2. Verificar se o ativo pode ser devolvido
    if (!['loaned', 'in_use'].includes(asset.status)) {
        return res.status(409).json({ message: `Este ativo não pode ser devolvido. Status atual: '${asset.status}'.` });
    }

    // 3. Encontrar o responsável atual
    const movementQuery = `
      SELECT am.recipient_person_id
      FROM asset_movements am
      JOIN movement_assets ma ON am.id = ma.movement_id
      WHERE ma.asset_id = $1 AND am.movement_type IN ('loan', 'exit')
      ORDER BY am.movement_date DESC
      LIMIT 1;
    `;
    const movementResult = await pool.query(movementQuery, [asset.id]);
    if (movementResult.rows.length === 0) {
        return res.status(404).json({ message: 'Não foi possível encontrar o responsável atual por este ativo.' });
    }
    const personId = movementResult.rows[0].recipient_person_id;

    // Se o personId for nulo (pode acontecer em saídas antigas sem pessoa vinculada), retorne um erro apropriado.
    if (!personId) {
        return res.status(404).json({ message: 'O ativo foi movimentado, mas não há um responsável (pessoa) vinculado à última saída.' });
    }

    // 4. Buscar os dados do responsável
    const personResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (personResult.rows.length === 0) {
        return res.status(404).json({ message: 'Cadastro do responsável pelo ativo não encontrado.' });
    }
    const person = personResult.rows[0];

    // 5. Retornar ambos
    res.status(200).json({ asset, person });

  } catch (error) {
    console.error('Erro ao buscar ativo para devolução:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =====================================================================
// [NOVO] DEVOLUÇÃO MANUAL INTELIGENTE (COM AUTO-CADASTRO DE LEGADO)
// Resolve o problema de tablets antigos aparecendo como N/A no dashboard
// =====================================================================
app.post('/api/tablets/manual-return', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    const { patrimonio_number, serial_number, condition, notes, school_unit_id } = req.body;
    const userId = req.user.id;
    const ipAddress = req.ip;

    if (!patrimonio_number) {
        return res.status(400).json({ message: 'O número de patrimônio é obrigatório.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // >>> BUSCA O ID DO ALMOXARIFADO AQUI LOGO NO INÍCIO <<<
        const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
        const warehouseId = whRes.rows[0]?.id || null;

        // 1. Limpeza do Patrimônio
        const cleanPatrimonio = String(patrimonio_number).trim();

        // 2. Verifica se o ativo JÁ EXISTE
        const assetRes = await client.query(
            `SELECT id, status, notes FROM assets WHERE patrimonio_number = $1`, 
            [cleanPatrimonio]
        );

        let assetId;
        let isLegacy = false;

        if (assetRes.rows.length > 0) {
            // --- CENÁRIO A: ATIVO EXISTE ---
            const asset = assetRes.rows[0];
            assetId = asset.id;

            if (asset.status === 'disposed') {
                throw new Error('Este ativo consta como DESCARTADO e não pode ser devolvido.');
            }

            const newStatus = (condition === 'Ruim' || condition === 'Defeito') ? 'maintenance' : 'available';
            
            // >>> CORREÇÃO: Transfere para o Almoxarifado em vez de NULL <<<
            await client.query(
                `UPDATE assets SET status = $1, current_unit_id = $3, updated_at = NOW() WHERE id = $2`,
                [newStatus, assetId, warehouseId]
            );

        } else {
            // --- CENÁRIO B: NÃO EXISTE (LEGADO / GESTÃO ANTERIOR) ---
            isLegacy = true;
            console.log(`[DEVOLUÇÃO] Ativo ${cleanPatrimonio} não encontrado. Criando registro legado.`);

            const typeRes = await client.query("SELECT id, sku_code FROM item_types WHERE name ILIKE '%Tablet%' LIMIT 1");
            if (typeRes.rows.length === 0) throw new Error('Tipo "Tablet" não cadastrado no sistema.');
            const { id: typeId, sku_code } = typeRes.rows[0];

            const sku = `${sku_code}-LEGADO-${cleanPatrimonio}`;

            // >>> CORREÇÃO: Insere o tablet já dentro do Almoxarifado <<<
            const insertRes = await client.query(
                `INSERT INTO assets (
                    patrimonio_number, serial_number, item_type_id, sku,
                    brand, model, description,
                    status, acquisition_date, notes, created_at, current_unit_id
                ) VALUES ($1, $2, $3, $4, 'SAMSUNG/MULTILASER', 'LEGADO (Gestão Anterior)', 'Tablet recuperado via devolução manual', 
                          $5, NOW(), $6, NOW(), $7) 
                RETURNING id`,
                [
                    cleanPatrimonio, 
                    serial_number || 'S/N', 
                    typeId, 
                    sku,
                    (condition === 'Ruim' || condition === 'Defeito') ? 'maintenance' : 'available',
                    'Ativo cadastrado automaticamente no ato da devolução.',
                    warehouseId // ID do Almoxarifado
                ]
            );
            assetId = insertRes.rows[0].id;
        }

        // 3. Registra a Movimentação
        const moveNotes = `Devolução Avulsa/Legado. Condição: ${condition}. ${notes || ''}`;
        
        const moveRes = await client.query(
            `INSERT INTO asset_movements (
                movement_type, movement_date, responsible_user_id, 
                delivery_status, actual_delivery_date, notes, destination_unit_id
            ) VALUES (
                'return', NOW(), $1, 
                'confirmed', NOW(), $2, $3
            ) RETURNING id`,
            [userId, moveNotes, school_unit_id || null]
        );
        const movementId = moveRes.rows[0].id;

        // 4. Vincula Ativo à Movimentação
        await client.query(
            `INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`,
            [movementId, assetId]
        );

        await client.query('COMMIT');
        await logAudit(userId, isLegacy ? 'return_legacy_created' : 'return_manual', 'asset', assetId, { patrimonio: cleanPatrimonio }, ipAddress);

        res.json({ 
            message: isLegacy 
                ? 'Devolução realizada. Ativo NÃO existia e foi cadastrado como Legado no Almoxarifado.' 
                : 'Devolução realizada com sucesso. Tablet no Almoxarifado.',
            assetId: assetId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro na devolução manual:', error);
        res.status(500).json({ message: 'Erro ao processar devolução: ' + error.message });
    } finally {
        client.release();
    }
});

// ============================================================================
// DOSSIÊ COMPLETO DO ATIVO (Raio-X Técnico) - VERSÃO BLINDADA PELO SCHEMA
// ============================================================================
app.get('/api/assets/dossier/:patrimonio', authenticateToken, async (req, res) => {
  const { patrimonio } = req.params;
  
  try {
    // 1. Busca os Dados Principais e Lotação
    // Cruzamos assets -> delivery_batch_items -> tablet_eligible_students para pegar o nome e matrícula
    const assetQuery = `
      SELECT 
        a.id, a.patrimonio_number, a.serial_number, a.brand, a.model, a.status, a.notes, a.acquisition_date,
        a.imei, a.sim_card_number, a.box_number,
        u.name as current_unit_name, u.type as current_unit_type,
        it.name as item_type_name,
        s.student_name, s.student_registration, 
        dbi.delivery_status
      FROM assets a
      LEFT JOIN units u ON a.current_unit_id = u.id
      LEFT JOIN item_types it ON a.item_type_id = it.id
      LEFT JOIN delivery_batch_items dbi ON a.id = dbi.asset_id
      LEFT JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
      WHERE a.patrimonio_number = $1 OR a.serial_number = $1
    `;
    const assetResult = await pool.query(assetQuery, [patrimonio]);

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado com este identificador.' });
    }

    const assetData = assetResult.rows[0];

    // 2. Busca o Histórico de Movimentações
    // Usando a tabela ponte (movement_assets) que descobrimos no seu Schema!
    const historyQuery = `
      SELECT 
        m.id, m.movement_date, m.movement_type, m.notes,
        p.full_name as recipient_name,
        un.name as destination_unit_name,
        us.full_name as responsible_name
      FROM movement_assets ma
      JOIN asset_movements m ON ma.movement_id = m.id
      LEFT JOIN people p ON m.recipient_person_id = p.id
      LEFT JOIN units un ON m.destination_unit_id = un.id
      LEFT JOIN users us ON m.responsible_user_id = us.id
      WHERE ma.asset_id = $1
      ORDER BY m.movement_date DESC
    `;
    const historyResult = await pool.query(historyQuery, [assetData.id]);

    res.json({
      asset: assetData,
      history: historyResult.rows
    });

  } catch (error) {
    console.error('Erro ao gerar dossiê do ativo:', error);
    res.status(500).json({ message: 'Erro interno ao buscar detalhes do ativo.' });
  }
});

// NOVO ENDPOINT: Rota para importar Pessoas via XLSX/CSV
app.post('/api/people/import', authenticateToken, authorizeRole(['admin', 'manager']), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  let importedCount = 0;
  let errors = [];

  try {
    // Processa o arquivo XLSX ou CSV para extrair os dados
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' })) // Adicionado separador ';' comum em CSVs no Brasil
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }

    fs.unlinkSync(filePath); // Remove o arquivo temporário após a leitura

    // Itera sobre cada linha do arquivo para inserir no banco
    for (const [index, row] of data.entries()) {
  const line = index + 2;
  const {
    full_name,
    cpf,
    email,
    registration_number,
    unit_name, // Espera a coluna 'unit_name' na planilha
    contact_phone 
  } = row;

  if (!full_name || !cpf || !email) {
    errors.push(`Linha ${line}: Ignorada. Nome completo, CPF e E-mail são obrigatórios.`);
    continue;
  }

  const formattedPhone = formatPhoneNumber(contact_phone);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingPerson = await client.query('SELECT id FROM people WHERE cpf = $1 OR email = $2', [cpf, email]);
    if (existingPerson.rows.length > 0) {
      errors.push(`Linha ${line}: Pessoa com CPF '${cpf}' ou E-mail '${email}' já existe. Ignorada.`);
      await client.query('ROLLBACK');
      continue;
    }

    let unitId = null; // Variável renomeada
    if (unit_name) {
      // Busca na tabela 'units' pelo nome
      const unitResult = await client.query('SELECT id FROM units WHERE name = $1', [unit_name]);
      if (unitResult.rows.length > 0) {
        unitId = unitResult.rows[0].id;
      } else {
        // Mensagem de erro atualizada
        errors.push(`Linha ${line}: Unidade '${unit_name}' não encontrada. A pessoa será cadastrada sem unidade.`);
      }
    }
    
    // Insere na coluna 'unit_id'
    await client.query(
      `INSERT INTO people (full_name, cpf, email, registration_number, unit_id, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [full_name, cpf, email, registration_number || null, unitId, formattedPhone]
    );

    await client.query('COMMIT');
    importedCount++;
  } catch (dbError) {
    await client.query('ROLLBACK');
    console.error('Erro ao importar pessoa da linha:', row, dbError);
    errors.push(`Linha ${line}: Erro no banco de dados ao importar '${full_name}': ${dbError.message}`);
  } finally {
    client.release();
  }
}

    await logAudit(req.user.id, 'import_people', 'person', null, { imported_count: importedCount, errors_count: errors.length, errors }, ipAddress);
    res.status(200).json({
      message: `Importação concluída. ${importedCount} pessoas importadas.`,
      errors: errors,
    });

  } catch (error) {
    console.error('Erro geral na importação de pessoas:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await logAudit(req.user.id, 'import_people_error', 'person', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar pessoas.', error: error.message });
  }
});

// Criar um novo Ativo (Ajustado: Mantendo validações originais + Movimentação de Entrada)
app.post('/api/assets', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const { 
    item_type_id, brand, model, description, 
    serial_number, patrimonio_number, unit_of_measure, 
    status, current_unit_id, acquisition_date, warranty_end_date, notes 
  } = req.body;

  // --- SEU CÓDIGO ORIGINAL MANTIDO ---
  const safePatrimonio = patrimonio_number ? String(patrimonio_number).trim() : null;
  const safeSerial = serial_number ? String(serial_number).trim() : null;
  const ipAddress = req.ip;

  // Validação básica (MANTIDA)
  if (!item_type_id || !brand || !model || !status) {
      return res.status(400).json({ message: 'Tipo de Item, Marca, Modelo e Status são obrigatórios.' });
  }
  // ----------------------------------

  const client = await pool.connect(); // Necessário para a transação

  try {
    await client.query('BEGIN'); // Inicia bloco seguro

    // 1. Gera SKU (CORRIGIDO: Busca o maior número já gerado para o prefixo)
    const typeQuery = await client.query('SELECT sku_code FROM item_types WHERE id = $1', [item_type_id]);
    
    if (typeQuery.rows.length === 0) {
        throw new Error('Tipo de item inválido.');
    }
    
    const prefix = typeQuery.rows[0].sku_code;
    
    // Pega o maior SKU existente com esse prefixo, ignorando a qual categoria ele pertence hoje
    const maxSkuRes = await client.query(
        "SELECT sku FROM assets WHERE sku LIKE $1 ORDER BY sku DESC LIMIT 1", 
        [`${prefix}-%`]
    );

    let nextNum = 1;
    if (maxSkuRes.rows.length > 0) {
        const lastSku = maxSkuRes.rows[0].sku;
        const parts = lastSku.split('-');
        if (parts.length > 1) {
            nextNum = parseInt(parts[1], 10) + 1;
        }
    } else {
        // Fallback apenas se for o primeiríssimo item deste tipo
        const countQuery = await client.query('SELECT count(*) FROM assets WHERE item_type_id = $1', [item_type_id]);
        nextNum = parseInt(countQuery.rows[0].count, 10) + 1;
    }

    const generatedSku = `${prefix}-${String(nextNum).padStart(6, '0')}`;

    // 2. Insere o Ativo no Banco
    // NOTA: Ajustei apenas os nomes das colunas (de safeserial_number para serial_number) 
    // e usei as variáveis safeSerial/safePatrimonio que você criou.
    const newAssetRes = await client.query(
      `INSERT INTO assets (
          sku, item_type_id, brand, model, description,
          serial_number, patrimonio_number, unit_of_measure,
          status, current_unit_id, acquisition_date, warranty_end_date, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        generatedSku, 
        item_type_id, 
        brand, 
        model, 
        description,
        safeSerial,      // Usando sua variável sanitizada
        safePatrimonio,  // Usando sua variável sanitizada
        unit_of_measure, 
        status, 
        current_unit_id, 
        acquisition_date, 
        warranty_end_date, 
        notes
      ]
    );
    const newAsset = newAssetRes.rows[0];

    // 3. >>> O INCREMENTO CRUCIAL <<<
    // Cria o registro na tabela de movimentações para constar no histórico
    if (current_unit_id) {
        const movementRes = await client.query(
            `INSERT INTO asset_movements (
                movement_type, movement_date, destination_unit_id, responsible_user_id, notes, delivery_status, created_at
             ) VALUES ('entry', NOW(), $1, $2, 'Entrada inicial por cadastro manual', 'confirmed', NOW()) RETURNING id`,
            [current_unit_id, req.user.id]
        );
        
        // Vincula o ativo à movimentação
        await client.query(
            `INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`,
            [movementRes.rows[0].id, newAsset.id]
        );
    }

    await client.query('COMMIT'); // Salva tudo

    // 4. Registra na Auditoria (MANTIDO)
    await logAudit(
        req.user.id, 
        'create_asset', 
        'asset', 
        newAsset.id, 
        { sku: generatedSku, patrimonio: safePatrimonio, brand, model }, 
        ipAddress
    );

    res.status(201).json({ message: 'Ativo criado com sucesso.', asset: newAsset });

  } catch (error) {
    await client.query('ROLLBACK'); // Desfaz se der erro
    console.error('Erro ao criar ativo:', error);
    
    // Tratamento de erro (MANTIDO)
    if (error.code === '23505') {
         if (error.constraint && error.constraint.includes('patrimonio')) return res.status(409).json({ message: 'Já existe um ativo com este Patrimônio.' });
         if (error.constraint && error.constraint.includes('serial')) return res.status(409).json({ message: 'Já existe um ativo com este Serial.' });
         return res.status(409).json({ message: 'Conflito de dados duplicados.' });
    }
    
    // Log de erro (MANTIDO)
    try {
       await logAudit(req.user.id, 'create_asset_error', 'asset', null, { error: error.message, brand, model }, ipAddress);
    } catch (auditErr) { console.error('Falha ao logar erro:', auditErr); }

    res.status(500).json({ message: 'Erro interno do servidor ao criar ativo.' });
  } finally {
      client.release();
  }
});

// Listar todos os Ativos (Com Busca inteligente no banco e Limite Seguro)
app.get('/api/assets', authenticateToken, async (req, res) => {
  // Captura o parâmetro 'search' vindo do frontend
  const { status, search } = req.query;

  try {
    let selectClause = '';
    let fromClause = '';
    let whereClauses = [];
    const params = [];
    let paramIndex = 1;

    if (status === 'in_use' || status === 'loaned') {
      selectClause = `
        WITH LatestOutgoingMovement AS (
          SELECT ma.asset_id, MAX(am.id) AS movement_id
          FROM asset_movements am
          JOIN movement_assets ma ON am.id = ma.movement_id
          WHERE am.movement_type IN ('exit', 'loan')
          GROUP BY ma.asset_id
        )
        SELECT a.*, it.name AS item_type_name, u.name AS current_unit_name, p.full_name AS responsible_person_name
      `;
      fromClause = `
        FROM assets a
        JOIN item_types it ON a.item_type_id = it.id
        LEFT JOIN LatestOutgoingMovement lom ON a.id = lom.asset_id
        LEFT JOIN asset_movements am ON lom.movement_id = am.id
        LEFT JOIN people p ON am.recipient_person_id = p.id
        LEFT JOIN units u ON am.destination_unit_id = u.id
      `;
      whereClauses.push(`a.status = $${paramIndex++}`);
      params.push(status);
    } else {
      selectClause = `SELECT a.*, it.name AS item_type_name, u.name AS current_unit_name`;
      fromClause = `
        FROM assets a
        JOIN item_types it ON a.item_type_id = it.id
        LEFT JOIN units u ON a.current_unit_id = u.id
      `;
      if (status) {
        whereClauses.push(`a.status = $${paramIndex++}`);
        params.push(status);
      }
    }

    // A MÁGICA: Filtra no banco de dados ANTES de limitar
    if (search && search.trim() !== '') {
      whereClauses.push(`(
        a.patrimonio_number ILIKE $${paramIndex} OR
        a.brand ILIKE $${paramIndex} OR
        a.model ILIKE $${paramIndex} OR
        a.serial_number ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    let query = selectClause + '\n' + fromClause;
    if (whereClauses.length > 0) {
      query += '\nWHERE ' + whereClauses.join(' AND ');
    }

    // Aplica o limite engessado de segurança no final
    query += `\nORDER BY a.patrimonio_number ASC LIMIT 500;`;

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar ativos:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao listar ativos.' });
  }
});

// Buscar ativos disponíveis por texto (Nome, Marca, Modelo, SKU)
app.get('/api/assets/search-available', authenticateToken, async (req, res) => {
  const { query } = req.query;
  
  if (!query || String(query).length < 3) {
    return res.status(400).json({ message: 'Digite pelo menos 3 caracteres.' });
  }

  try {
    const term = `%${query}%`;
    const result = await pool.query(
      `SELECT a.*, it.name as item_type_name, u.name as current_unit_name 
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN units u ON a.current_unit_id = u.id
       WHERE a.status = 'available' 
         AND (
           it.name ILIKE $1 OR 
           a.brand ILIKE $1 OR 
           a.model ILIKE $1 OR 
           a.description ILIKE $1 OR
           a.sku ILIKE $1
         )
       -- A MÁGICA ACONTECE AQUI: Ordena alfabeticamente para "D"esktop vir antes de "M"ini-desktop
       ORDER BY it.name ASC, a.brand ASC, a.model ASC
       LIMIT 50`, // Limite aumentado para garantir mix de resultados
      [term]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro na busca textual:', error);
    res.status(500).json({ message: 'Erro ao buscar ativos.' });
  }
});

// Buscar ativos (Autocomplete e Busca Geral)
app.get('/api/assets/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    if (!q || String(q).length < 3) {
        return res.json([]); 
    }

    const client = await pool.connect();
    try {
        const searchTerm = `%${q}%`;
        
        // ADICIONADO: OR a.imei OR a.sim_card_number
        const result = await client.query(`
            SELECT 
                a.*, 
                it.name as item_type_name,
                u.name as current_unit_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            LEFT JOIN units u ON a.current_unit_id = u.id
            WHERE 
                a.patrimonio_number ILIKE $1 OR
                a.serial_number ILIKE $1 OR
                a.brand ILIKE $1 OR
                a.model ILIKE $1
            LIMIT 15
        `, [searchTerm]);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro na busca de ativos:', error);
        res.status(500).json({ message: 'Erro ao buscar ativos.' });
    } finally {
        client.release();
    }
});

// ROTA: BUSCAR ATIVO PARA DEVOLUÇÃO EM LOTE (Item 4)
// Só retorna se estiver 'in_use' ou 'loaned'
app.get('/api/assets/validate-returnable', authenticateToken, async (req, res) => {
    const { query } = req.query; // Espera ?query=123456

    if (!query) {
        return res.status(400).json({ message: 'Informe o patrimônio ou serial.' });
    }

    try {
        // 1. Tenta buscar o ativo apto para devolução
        const result = await pool.query(`
            SELECT a.*, it.name as item_type_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            WHERE (a.patrimonio_number = $1 OR a.serial_number = $1)
            AND a.status IN ('in_use', 'loaned')
        `, [query]);

        // 2. Se achou, retorna
        if (result.rows.length > 0) {
            return res.json(result.rows[0]);
        }

        // 3. Se não achou, vamos descobrir o porquê para dar um erro melhor
        const checkAny = await pool.query(`
            SELECT status FROM assets WHERE patrimonio_number = $1 OR serial_number = $1
        `, [query]);

        if (checkAny.rows.length === 0) {
            return res.status(404).json({ message: 'Ativo não encontrado no banco de dados.' });
        } else {
            const status = checkAny.rows[0].status;
            let msg = `Ativo encontrado, mas não pode ser devolvido (Status: ${status}).`;
            
            if (status === 'available') msg = 'Este item já consta como Disponível no estoque.';
            if (status === 'retired') msg = 'Este item já foi Baixado/Descartado.';
            if (status === 'maintenance') msg = 'Este item já está em Manutenção.';

            return res.status(400).json({ message: msg });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro interno ao buscar ativo.' });
    }
});

// Obter Ativo por ID
app.get('/api/assets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter ativo:', error);
    await logAudit(req.user.id, 'get_asset_error', 'asset', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter ativo.' });
  }
});

// Rota para importar Ativos via XLSX/CSV (COM GERAÇÃO PADRONIZADA DE SKU)
app.post('/api/assets/import', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  // Função auxiliar para datas (Mantida da sua versão original)
  const parseAndFormatDate = (dateInput) => {
    if (!dateInput) return null;
    let parsedDate;
    if (dateInput instanceof Date && !isNaN(dateInput)) {
        parsedDate = dateInput;
    } else if (typeof dateInput === 'string') {
        if (!isNaN(dateInput) && !isNaN(parseFloat(dateInput))) {
            const numericDate = Number(dateInput);
            parsedDate = new Date(Math.round((numericDate - 25569) * 86400 * 1000));
        } else {
            const parts = dateInput.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                if (year && year.length === 4) {
                    parsedDate = new Date(year, month - 1, day);
                }
            }
        }
    } else if (typeof dateInput === 'number') {
        parsedDate = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
    }
    if (parsedDate && !isNaN(parsedDate)) {
        return parsedDate.toISOString().split('T')[0];
    }
    return 'invalid';
  };

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  let importedCount = 0;
  let errors = [];

  try {
    // Leitura do arquivo
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { cellDates: true });
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }
    fs.unlinkSync(filePath);

    const client = await pool.connect();
    
    // Cache para evitar consultar o banco repetidamente para o mesmo Tipo de Item
    // Isso garante a sequência correta dentro do mesmo lote de importação
    const typeCache = {};

    try {
      // Loop principal linha a linha
      for (const [index, row] of data.entries()) {
        const line = index + 2;
        
        // Mapeamento flexível de colunas (aceita nomes em inglês ou português)
        const typeName = row['item_type_name'] || row['Tipo'] || row['tipo'];
        const brand = row['brand'] || row['Marca'];
        const model = row['model'] || row['Modelo'];
        let rawSerial = row['serial_number'] || row['Serial'];
        const serial_number = row['serial_number'] || row['Serial'] || null;
        let rawPatrimonio = row['patrimonio_number'] || row['Patrimônio'];
        const patrimonio_number = row['patrimonio_number'] || row['Patrimônio'] || null;
        const unit_name = row['unit_name'] || row['Unidade'] || null;
        let status = row['status'] || 'available';
        
        // Datas
        const acquisition_date = row['acquisition_date'] || row['Data Aquisição'];
        const warranty_end_date = row['warranty_end_date'] || row['Fim Garantia'];

        // Validação de campos obrigatórios
        if (!typeName || !brand || !model) {
          errors.push(`Linha ${line}: Ignorada. 'Tipo', 'Marca' e 'Modelo' são obrigatórios.`);
          continue;
        }

        // Formatação de datas
        const formattedAcquisitionDate = parseAndFormatDate(acquisition_date);
        const formattedWarrantyEndDate = parseAndFormatDate(warranty_end_date);

        if (formattedAcquisitionDate === 'invalid' || formattedWarrantyEndDate === 'invalid') {
            errors.push(`Linha ${line}: Data inválida. Ignorado.`);
            continue;
        }

        try {
          await client.query('BEGIN');

          // 1. Verificação de Duplicidade (Patrimônio ou Serial) antes de gerar SKU
          const existingAsset = await client.query(
            'SELECT id FROM assets WHERE (patrimonio_number IS NOT NULL AND patrimonio_number = $1) OR (serial_number IS NOT NULL AND serial_number = $2)', 
            [patrimonio_number, serial_number]
          );
          
          if (existingAsset.rows.length > 0) {
            errors.push(`Linha ${line}: Patrimônio '${patrimonio_number}' ou Série '${serial_number}' já existe. Ignorado.`);
            await client.query('ROLLBACK');
            continue;
          }

          // 2. Resolução do Tipo de Item e Geração de SKU (CORRIGIDO PARA IGNORAR FANTASMAS)
          let typeData = typeCache[typeName.toUpperCase()];

          if (!typeData) {
            const typeRes = await client.query('SELECT id, sku_code FROM item_types WHERE name ILIKE $1', [typeName]);
            
            if (typeRes.rows.length === 0) {
              errors.push(`Linha ${line}: Tipo de item '${typeName}' não encontrado no sistema. Cadastre-o antes.`);
              await client.query('ROLLBACK');
              continue;
            }

            const itemTypeId = typeRes.rows[0].id;
            const prefix = typeRes.rows[0].sku_code;

            // Busca o MAIOR SKU daquele prefixo para garantir sequência perfeita
            const maxSkuRes = await client.query(
                "SELECT sku FROM assets WHERE sku LIKE $1 ORDER BY sku DESC LIMIT 1", 
                [`${prefix}-%`]
            );

            let startingCount = 0;
            if (maxSkuRes.rows.length > 0) {
                const lastSku = maxSkuRes.rows[0].sku;
                const parts = lastSku.split('-');
                if (parts.length > 1) {
                    startingCount = parseInt(parts[1], 10);
                }
            }

            // Fallback
            if (isNaN(startingCount) || startingCount === 0) {
                const countRes = await client.query('SELECT count(*) FROM assets WHERE item_type_id = $1', [itemTypeId]);
                startingCount = parseInt(countRes.rows[0].count, 10);
            }

            typeData = {
              id: itemTypeId,
              prefix: prefix,
              currentCount: startingCount
            };
            
            typeCache[typeName.toUpperCase()] = typeData;
          }

          // Incrementa a partir do MAIOR SKU existente e não do total de linhas
          typeData.currentCount++;
          const generatedSku = `${typeData.prefix}-${String(typeData.currentCount).padStart(6, '0')}`;

          // 3. Resolução da Unidade (Opcional)
          let current_unit_id = null;
          if (unit_name) {
            const unitResult = await client.query('SELECT id FROM units WHERE name ILIKE $1', [unit_name]);
            if (unitResult.rows.length > 0) {
              current_unit_id = unitResult.rows[0].id;
            }
          }

          // 4. Inserção no Banco
          await client.query(
            `INSERT INTO assets (
                sku, item_type_id, brand, model, 
                serial_number, patrimonio_number, status, 
                acquisition_date, warranty_end_date, notes, current_unit_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                generatedSku, 
                typeData.id, 
                brand, 
                model, 
                serial_number, 
                patrimonio_number, 
                status, 
                formattedAcquisitionDate, 
                formattedWarrantyEndDate, 
                row.notes || null, 
                current_unit_id
            ]
          );

          await client.query('COMMIT');
          importedCount++;

        } catch (dbError) {
          await client.query('ROLLBACK');
          // Tratamento de erro específico para duplicidade que passou pelo check inicial
          if (dbError.code === '23505') {
             errors.push(`Linha ${line}: Dados duplicados (SKU, Serial ou Patrimônio).`);
          } else {
             errors.push(`Linha ${line}: Erro no banco - ${dbError.message}`);
          }
        }
      }
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'import_assets', 'asset', null, { imported_count: importedCount, errors_count: errors.length }, ipAddress);
    
    res.status(200).json({
      message: 'Importação concluída.',
      importedCount: importedCount,
      errors: errors,
    });

  } catch (error) {
    console.error('Erro geral na importação de ativos:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Limpa arquivo em caso de erro fatal
    await logAudit(req.user.id, 'import_assets_error', 'asset', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar ativos.', error: error.message });
  }
});

// NOVO ENDPOINT: Obter Ativo por Número de Patrimônio
app.get('/api/assets/by-patrimonio/:patrimonio_number', authenticateToken, async (req, res) => {
  const { patrimonio_number } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.sku,
         a.brand,
         a.model,
         a.description,
         a.serial_number,
         a.patrimonio_number,
         it.name AS item_type_name,
         a.status
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       WHERE a.patrimonio_number = $1`,
      [patrimonio_number]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado com este número de patrimônio.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter ativo por número de patrimônio:', error);
    await logAudit(req.user.id, 'get_asset_by_patrimonio_error', 'asset', null, { error: error.message, patrimonio_number }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar ativo por número de patrimônio.' });
  }
});

// VALIDAR ATIVO PARA MOVIMENTAÇÃO (COM TRADUÇÃO DE STATUS)
app.post('/api/assets/validate-for-movement', authenticateToken, async (req, res) => {
  const { patrimonio_number, movement_type } = req.body;

  if (!patrimonio_number || !movement_type) {
    return res.status(400).json({ message: 'Número de patrimônio e tipo são obrigatórios.' });
  }

  // Mapeamento de Status (Inglês -> Português)
  const statusTranslation = {
    'available': 'Disponível',
    'loaned': 'Emprestado',
    'in_use': 'Em Uso',
    'maintenance': 'Em Manutenção',
    'retired': 'Baixado/Inservível',
    'disposed': 'Descartado',
    'pending_retirement': 'Aguardando Baixa',
    'missing': 'Extraviado'
  };

  try {
    const cleanPatrimonio = String(patrimonio_number).replace(/\D/g, ''); 

    const assetResult = await pool.query(
      `SELECT a.*, it.name as item_type_name 
       FROM assets a 
       JOIN item_types it ON a.item_type_id = it.id 
       WHERE a.patrimonio_number = $1 
          OR REGEXP_REPLACE(a.patrimonio_number, '\\D', '', 'g') = $2 
          OR a.serial_number = $1`, // <<< BUSCA PELO NÚMERO DE SÉRIE ADICIONADA AQUI
      [patrimonio_number, cleanPatrimonio]
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado.' });
    }

    const asset = assetResult.rows[0];
    const currentAssetStatus = asset.status;
    
    // Traduz o status atual (ou mantém o original se não achar na lista)
    const statusPT = statusTranslation[currentAssetStatus] || currentAssetStatus;

    // >>> VALIDAÇÃO DE BLOQUEIOS (BAIXA/DESCARTE) <<<
    if (currentAssetStatus === 'pending_retirement') {
        return res.status(409).json({ message: `Este ativo está bloqueado: ${statusPT}.` });
    }

    if (['retired', 'disposed'].includes(currentAssetStatus)) {
      return res.status(409).json({ message: `Operação negada. O ativo consta como: ${statusPT}.` });
    }

    // >>> VALIDAÇÃO DO TIPO DE MOVIMENTAÇÃO <<<
    let errorMessage = null;
    switch (movement_type) {
      case 'loan':
      case 'exit':
        // Para Empréstimo ou Saída, o ativo TEM que estar Disponível
        if (currentAssetStatus !== 'available') {
            errorMessage = `Não é possível movimentar. O ativo está atualmente: ${statusPT.toUpperCase()}.`;
        }
        break;
        
      case 'maintenance':
        // Se já estiver em manutenção, avisa
        if (currentAssetStatus === 'maintenance') {
            errorMessage = `Este ativo já se encontra em manutenção.`;
        }
        break;
    }

    if (errorMessage) {
        return res.status(409).json({ message: errorMessage });
    }
    
    res.status(200).json(asset);

  } catch (error) {
    console.error('Erro na validação:', error);
    res.status(500).json({ message: 'Erro interno ao validar ativo.' });
  }
});

// Atualizar Ativo (ATUALIZADO COM DADOS COMPLEMENTARES)
app.put('/api/assets/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { 
      item_type_id, brand, model, description, serial_number, patrimonio_number, 
      unit_of_measure, status, current_unit_id, acquisition_date, warranty_end_date, notes,
      // >>> NOVOS CAMPOS AQUI <<<
      imei, sim_card_number, box_number, has_livox, allow_automation
  } = req.body;
  const ipAddress = req.ip;

  if (!item_type_id || !brand || !model || !status) {
    return res.status(400).json({ message: 'Tipo de Item, Marca, Modelo e Status são obrigatórios.' });
  }

  try {
    const oldAssetResult = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (oldAssetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado para atualização.' });
    }
    const oldAsset = oldAssetResult.rows[0];
    const sku = oldAsset.sku;

    const updatedAsset = await pool.query(
      `UPDATE assets SET
         sku = $1, item_type_id = $2, brand = $3, model = $4, description = $5,
         serial_number = $6, patrimonio_number = $7, unit_of_measure = $8, status = $9,
         current_unit_id = $10, acquisition_date = $11, warranty_end_date = $12, notes = $13,
         imei = $14, sim_card_number = $15, box_number = $16, has_livox = $17, allow_automation = $18,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $19 RETURNING *`,
      [
          sku, item_type_id, brand, model, description, 
          serial_number, patrimonio_number, unit_of_measure, status, 
          current_unit_id, acquisition_date, warranty_end_date, notes,
          imei || null, sim_card_number || null, box_number || null, 
          has_livox !== undefined ? has_livox : oldAsset.has_livox, 
          allow_automation !== undefined ? allow_automation : oldAsset.allow_automation, 
          id
      ]
    );

    await logAudit(req.user.id, 'update_asset', 'asset', id, { old_data: oldAsset, new_data: updatedAsset.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Ativo atualizado com sucesso.', asset: updatedAsset.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar ativo:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Número de série, número de patrimônio ou SKU já existe para outro ativo.' });
    }
    await logAudit(req.user.id, 'update_asset_error', 'asset', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar ativo.' });
  }
});

// Deletar Ativo
app.delete('/api/assets/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem movimentações associadas a este ativo
    const movementsCount = await pool.query('SELECT COUNT(*) FROM movement_assets WHERE asset_id = $1', [id]); // Alterado para movement_assets
    if (parseInt(movementsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar este ativo, pois existem movimentações registradas para ele.' });
    }

    const deletedAsset = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
    if (deletedAsset.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_asset', 'asset', id, { deleted_asset: deletedAsset.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Ativo deletado com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar ativo:', error);
    await logAudit(req.user.id, 'delete_asset_error', 'asset', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar ativo.' });
  }
});

// =====================================================================
// ROTA DE IMPORTAÇÃO DE ALUNOS (COM AUTO-CADASTRO DE ESCOLAS FALTANTES)
// =====================================================================
app.post('/api/tablets/import-students', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  let importedCount = 0;
  let updatedCount = 0;
  let newSchoolsCount = 0; // Contador de escolas criadas
  let errors = [];

  try {
    // 1. Ler o arquivo (Excel ou CSV)
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    } else if (fileExtension === '.csv') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => data.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato não suportado. Use .xlsx ou .csv.' });
    }
    fs.unlinkSync(filePath);

    const client = await pool.connect();
    
    // Cache de Escolas em Memória (Para não consultar o banco 1000 vezes)
    // Mapa: { 'INEP123': ID_1, 'INEP456': ID_2 }
    const unitsRes = await client.query('SELECT id, code FROM units WHERE type = \'ESCOLAR\' AND code IS NOT NULL');
    const unitMap = new Map();
    unitsRes.rows.forEach(u => unitMap.set(String(u.code).trim(), u.id));

    try {
      for (const [index, row] of data.entries()) {
        const line = index + 2;
        
        // Mapeamento das colunas (Flexível para maiúsculas/minúsculas)
        const MATRICULA = row['MATRICULA'] || row['Matricula'] || row['matricula'];
        const ESTUDANTE = row['ESTUDANTE'] || row['Estudante'] || row['Nome'] || row['nome'];
        const INEP = row['INEP'] || row['Inep'] || row['CODIGO_INEP'];
        const ESCOLA_NOME = row['ESCOLA'] || row['Escola'] || row['NOME_ESCOLA']; // Precisamos do nome caso tenhamos que criar
        const RPA = row['RPA'] || row['Rpa'];
        
        // Dados secundários
        const ANO_DE_ENSINO = row['ANO_DE_ENSINO'] || row['Ano'];
        const TURMA = row['TURMA'] || row['Turma'];
        const TURNO = row['TURNO'] || row['Turno'];
        const PCD = row['PCD'] || row['Pcd'];

        if (!MATRICULA || !ESTUDANTE) {
          errors.push(`Linha ${line}: Ignorada. Matrícula ou Nome do aluno faltando.`);
          continue;
        }

        if (!INEP) {
            errors.push(`Linha ${line}: Ignorada. Código INEP da escola faltando.`);
            continue;
        }

        const cleanInep = String(INEP).trim();
        let schoolId = unitMap.get(cleanInep);

        await client.query('BEGIN');

        // >>> A MÁGICA: AUTO-CADASTRO DA ESCOLA <<<
        if (!schoolId) {
            // Se a escola não existe no mapa, cria ela agora!
            const newSchoolName = ESCOLA_NOME || `Escola INEP ${cleanInep}`; // Fallback se não tiver nome
            const cleanRpa = RPA ? String(RPA).replace(/\D/g, '') : null;

            console.log(`[IMPORT] Criando nova escola automaticamente: ${newSchoolName} (${cleanInep})`);

            const createSchoolRes = await client.query(
                `INSERT INTO units (name, code, type, status, rpa, created_at, updated_at)
                 VALUES ($1, $2, 'ESCOLAR', 'active', $3, NOW(), NOW())
                 RETURNING id`,
                [newSchoolName.toUpperCase(), cleanInep, cleanRpa]
            );
            
            schoolId = createSchoolRes.rows[0].id;
            unitMap.set(cleanInep, schoolId); // Adiciona ao cache para as próximas linhas
            newSchoolsCount++;
        }

        // Lógica LIVOX
        let requires_livox = false;
        if (PCD) {
            const pcdText = String(PCD).trim().toUpperCase();
            const invalidValues = ['NAO', 'NÃO', 'NENHUM', 'NENHUMA', '-', '', 'NORMAL'];
            if (pcdText.length > 0 && !invalidValues.includes(pcdText)) {
                requires_livox = true;
            }
        }

        // Upsert do Aluno
        const result = await client.query(
          `INSERT INTO public.tablet_eligible_students (
            year, student_registration, student_name, education_year, class_name, shift, pcd_type, school_unit_id, requires_livox, rpa
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (student_registration) DO UPDATE SET
            year = EXCLUDED.year,
            student_name = EXCLUDED.student_name,
            education_year = EXCLUDED.education_year,
            class_name = EXCLUDED.class_name,
            shift = EXCLUDED.shift,
            pcd_type = EXCLUDED.pcd_type,
            school_unit_id = EXCLUDED.school_unit_id,
            requires_livox = EXCLUDED.requires_livox,
            rpa = EXCLUDED.rpa
          RETURNING xmax`,
          [
            new Date().getFullYear(), 
            String(MATRICULA), 
            String(ESTUDANTE).toUpperCase(), 
            ANO_DE_ENSINO || null, 
            TURMA || null, 
            TURNO || null, 
            PCD || null,
            schoolId, 
            requires_livox,
            RPA || null
          ]
        );

        if (result.rows[0].xmax === '0') importedCount++; else updatedCount++;
        
        await client.query('COMMIT');
      }
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'import_tablet_students', 'tablet_eligible_students', null, { imported: importedCount, updated: updatedCount, new_schools: newSchoolsCount, errors: errors.length }, ipAddress);
    
    res.status(200).json({
      message: `Processamento finalizado.`,
      details: `${importedCount} alunos novos, ${updatedCount} atualizados.`,
      schoolsCreated: newSchoolsCount > 0 ? `${newSchoolsCount} novas escolas cadastradas automaticamente.` : null,
      errors
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Erro interno.', error: error.message });
  }
});

// =====================================================================
// DADOS DO DASHBOARD (MÉTRICAS LIVOX + FILTRO RPA + ESCOLAS PENDENTES)
// VERSÃO CORRIGIDA E INTEGRAL
// =====================================================================
app.get('/api/dashboard/tablets/metrics', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  try {
    const { whereClause, values } = buildDashboardFilters(req.query);

    // 1. Total Geral (Alunos elegíveis)
    const totalRes = await pool.query(`SELECT COUNT(DISTINCT s.id) FROM tablet_eligible_students s WHERE 1=1 ${whereClause}`, values);
    const total = parseInt(totalRes.rows[0].count, 10);

    // 2. Entregues (Sucesso operacional)
    const deliveredRes = await pool.query(`
        SELECT COUNT(DISTINCT s.id)
        FROM delivery_batch_items dbi
        JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
        WHERE dbi.delivery_status IN ('realizada', 'confirmed', 'substituida') ${whereClause}
    `, values);
    const delivered = parseInt(deliveredRes.rows[0].count, 10);

    // 3. Pendentes (Alunos que não têm nenhuma movimentação de sucesso ou devolução)
    const pendingRes = await pool.query(`
        SELECT COUNT(DISTINCT s.id) FROM tablet_eligible_students s
        WHERE 1=1 ${whereClause}
        AND s.id NOT IN (
            SELECT eligible_student_id FROM delivery_batch_items
            WHERE delivery_status IN ('planejada', 'realizada', 'confirmed', 'devolvido', 'substituida')
        )
    `, values);
    const pendingGeneral = parseInt(pendingRes.rows[0].count, 10);

    // 4. Funil PCD
    const totalPcdRes = await pool.query(`
        SELECT COUNT(DISTINCT s.id) FROM tablet_eligible_students s
        WHERE s.requires_livox = TRUE ${whereClause}
    `, values);
    const totalPcd = parseInt(totalPcdRes.rows[0].count, 10);

    const allocatedPcdRes = await pool.query(`
        SELECT COUNT(DISTINCT s.id)
        FROM tablet_eligible_students s
        JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
        WHERE s.requires_livox = TRUE ${whereClause}
        AND dbi.delivery_status IN ('planejada', 'realizada', 'confirmed', 'substituida')
    `, values);
    const allocatedPcd = parseInt(allocatedPcdRes.rows[0].count, 10);

    const pendingPcdRes = await pool.query(`
        SELECT COUNT(DISTINCT s.id) FROM tablet_eligible_students s
        WHERE s.requires_livox = TRUE ${whereClause}
        AND s.id NOT IN (
            SELECT eligible_student_id FROM delivery_batch_items
            WHERE delivery_status IN ('planejada', 'realizada', 'confirmed', 'devolvido', 'substituida')
        )
    `, values);
    const pendingPcd = parseInt(pendingPcdRes.rows[0].count, 10);

    const pendingSchoolsRes = await pool.query(`
        SELECT u.name as school_name, COUNT(DISTINCT s.id) as pending_count
        FROM tablet_eligible_students s
        JOIN units u ON s.school_unit_id = u.id
        WHERE s.requires_livox = TRUE ${whereClause}
        AND s.id NOT IN (
            SELECT eligible_student_id FROM delivery_batch_items
            WHERE delivery_status IN ('planejada', 'realizada', 'confirmed', 'devolvido', 'substituida')
        )
        GROUP BY u.name
        ORDER BY pending_count DESC
        LIMIT 5
    `, values);

    // 5. Funil de Oferta (Itens no estoque)
    const totalLivoxRes = await pool.query(`SELECT COUNT(*) FROM assets WHERE has_livox = TRUE AND status NOT IN ('retired', 'disposed', 'missing')`);
    const totalLivox = parseInt(totalLivoxRes.rows[0].count, 10);
    const availableLivoxRes = await pool.query(`SELECT COUNT(*) FROM assets WHERE has_livox = TRUE AND status = 'available'`);
    const availableLivox = parseInt(availableLivoxRes.rows[0].count, 10);
    const allocatedLivox = totalLivox - availableLivox;

    // 6. Gráficos (RPA e Ano)
    const rpaRes = await pool.query(`
        SELECT COALESCE(s.rpa, 'Indefinido') as name, COUNT(DISTINCT s.id) as total,
        COUNT(DISTINCT CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed', 'substituida') THEN s.id END) as delivered
        FROM tablet_eligible_students s
        LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
        WHERE 1=1 ${whereClause}
        GROUP BY s.rpa ORDER BY s.rpa ASC
    `, values);

    const yearRes = await pool.query(`
        SELECT COALESCE(s.education_year, 'N/A') as name, COUNT(DISTINCT s.id) as total,
        COUNT(DISTINCT CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed', 'substituida') THEN s.id END) as delivered
        FROM tablet_eligible_students s
        LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
        WHERE 1=1 ${whereClause}
        GROUP BY s.education_year ORDER BY s.education_year ASC
    `, values);

    // 7. Cronograma
    const batchesRes = await pool.query(`
        SELECT db.id, db.name as batch_name, u.name as school_name, COALESCE(usr.full_name, 'Usuário Removido') as created_by, db.creation_date, db.scheduled_delivery_date, db.status, (SELECT COUNT(*) FROM delivery_batch_items WHERE batch_id = db.id) as total_items,
        CASE WHEN db.status NOT ILIKE '%Concluído%' AND db.scheduled_delivery_date IS NOT NULL AND db.scheduled_delivery_date < CURRENT_DATE THEN true ELSE false END as is_delayed
        FROM delivery_batches db
        JOIN units u ON db.school_unit_id = u.id
        LEFT JOIN users usr ON db.created_by_user_id = usr.id
        ORDER BY (CASE WHEN db.status NOT ILIKE '%Concluído%' AND db.scheduled_delivery_date < CURRENT_DATE THEN 0 ELSE 1 END) ASC, db.scheduled_delivery_date ASC NULLS LAST
        LIMIT 50
    `);

    // 8. Termos
    const termsStatusRes = await pool.query(`
        SELECT
        COUNT(CASE WHEN (terms_status IS NULL OR terms_status = 'pending') AND CURRENT_DATE <= (delivery_confirmation_date + INTERVAL '14 days') THEN 1 END) as no_prazo,
        COUNT(CASE WHEN (terms_status IS NULL OR terms_status = 'pending') AND CURRENT_DATE > (delivery_confirmation_date + INTERVAL '14 days') AND CURRENT_DATE <= (delivery_confirmation_date + INTERVAL '21 days') THEN 1 END) as atencao,
        COUNT(CASE WHEN (terms_status IS NULL OR terms_status = 'pending') AND CURRENT_DATE > (delivery_confirmation_date + INTERVAL '21 days') THEN 1 END) as atrasado
        FROM delivery_batches
        WHERE status = 'Concluído'
    `);
    const termsStatus = termsStatusRes.rows[0];

    res.json({
        kpis: {
            total, 
            delivered,
            pending: pendingGeneral,
            percentage: total > 0 ? ((delivered / total) * 100).toFixed(1) : 0,
            totalPcd, 
            allocatedPcd, 
            pendingPcd,
            totalLivox, 
            allocatedLivox, 
            availableLivox,
            percentagePcd: totalPcd > 0 ? ((allocatedPcd / totalPcd) * 100).toFixed(1) : 0
        },
        charts: { byRPA: rpaRes.rows, byYear: yearRes.rows },
        batches: batchesRes.rows,
        pendingSchools: pendingSchoolsRes.rows,
        termsStatus: {
            no_prazo: parseInt(termsStatus.no_prazo, 10) || 0,
            atencao: parseInt(termsStatus.atencao, 10) || 0,
            atrasado: parseInt(termsStatus.atrasado, 10) || 0
        }
    });
  } catch (error) {
    console.error('Erro dashboard metrics:', error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// =====================================================================
// AUDITORIA E BUSCA AVANÇADA (DOSSIÊ DO ALUNO) - CORRIGIDO
// =====================================================================
app.get('/api/tablets/audit/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 3) {
    return res.json([]);
  }

  const searchTerm = `%${q}%`;

  try {
    const query = `
      SELECT 
        s.id as student_id,
        s.student_name,
        s.student_registration,
        s.education_year,
        u.name as school_name,
        s.rpa,
        dbi.id as item_id,
        dbi.delivery_status,
        dbi.delivery_date,
        a.patrimonio_number,
        a.serial_number,
        a.sim_card_number,
        a.imei,
        a.box_number,
        db.id as batch_id,
        db.name as batch_name
      FROM tablet_eligible_students s
      LEFT JOIN units u ON s.school_unit_id = u.id
      LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
      LEFT JOIN assets a ON dbi.asset_id = a.id
      LEFT JOIN delivery_batches db ON dbi.batch_id = db.id
      WHERE 
        s.student_name ILIKE $1 OR 
        s.student_registration ILIKE $1 OR
        u.name ILIKE $1 OR
        a.patrimonio_number ILIKE $1 OR
        a.serial_number ILIKE $1 OR
        a.imei ILIKE $1 OR
        a.sim_card_number ILIKE $1
      ORDER BY s.student_name ASC
      LIMIT 50
    `;

    const result = await pool.query(query, [searchTerm]);
    res.json(result.rows);

  } catch (error) {
    console.error('Erro na auditoria:', error);
    res.status(500).json({ message: 'Erro ao realizar busca.' });
  }
});

// =====================================================================
// BAIXAR/VISUALIZAR RECIBO COLETIVO ASSINADO (ARQUIVO ANEXADO)
// =====================================================================
app.get('/api/delivery-batches/:id/signed-receipt', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Busca o caminho do arquivo salvo no banco
    const result = await pool.query('SELECT collective_receipt_path FROM delivery_batches WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Lote não encontrado.' });
    }
    
    const filePath = result.rows[0].collective_receipt_path;
    
    if (!filePath) {
        return res.status(404).json({ message: 'Nenhum recibo assinado foi anexado a este lote.' });
    }
    
    if (!fs.existsSync(filePath)) {
        console.error(`Arquivo sumiu do servidor: ${filePath}`);
        return res.status(404).json({ message: 'Arquivo físico não encontrado no servidor.' });
    }
    
    // Envia o arquivo para o usuário
    res.download(filePath); 
    
  } catch (error) {
    console.error('Erro ao buscar recibo assinado:', error);
    res.status(500).json({ message: 'Erro interno ao buscar o arquivo.' });
  }
});

// =====================================================================
// CRIAR LOTE COMPLEMENTAR (COM DATA, RPA, LIVOX E CORREÇÃO DE LOCALIZAÇÃO V6)
// =====================================================================
app.post('/api/tablets/complementary-batch', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { school_unit_id, students, scheduled_date } = req.body; 
  
  const user_id = req.user.id;
  const ipAddress = req.ip;

  if (!school_unit_id || !students || students.length === 0) {
    return res.status(400).json({ message: 'Escola e lista de alunos são obrigatórios.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obter nome e RPA da escola 
    const schoolRes = await client.query('SELECT name, rpa FROM units WHERE id = $1', [school_unit_id]);
    if (schoolRes.rows.length === 0) throw new Error('Escola não encontrada.');
    const { name: schoolName, rpa: schoolRpa } = schoolRes.rows[0];
    
    // 2. Criar o Lote Complementar
    const batchName = `Complementar - ${schoolName} - ${new Date().toLocaleDateString('pt-BR')}`;
    
    const batchRes = await client.query(
        `INSERT INTO delivery_batches (school_unit_id, created_by_user_id, status, name, creation_date, scheduled_delivery_date)
         VALUES ($1, $2, 'Em Planejamento', $3, NOW(), $4) RETURNING id`,
        [school_unit_id, user_id, batchName, scheduled_date || null]
    );
    const batchId = batchRes.rows[0].id;

    // 3. Processar cada Aluno e Buscar o Tablet Específico (LIVOX ou PADRÃO)
    for (let i = 0; i < students.length; i++) {
        const sData = students[i];

        // Define se o aluno precisa de Livox
        let requires_livox = false;
        if (sData.pcd && sData.pcd.length > 2 && !['NÃO','NAO'].includes(sData.pcd.toUpperCase())) requires_livox = true;

        // A. Upsert do Aluno
        const studentRes = await client.query(`
            INSERT INTO tablet_eligible_students (
                year, student_registration, student_name, school_unit_id, 
                education_year, class_name, shift, pcd_type, requires_livox, rpa
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (student_registration) DO UPDATE SET
                school_unit_id = EXCLUDED.school_unit_id,
                student_name = EXCLUDED.student_name,
                rpa = EXCLUDED.rpa
            RETURNING id
        `, [
            new Date().getFullYear(), 
            sData.registration, 
            sData.name, 
            school_unit_id, 
            sData.year, 
            sData.class_name, 
            null, 
            sData.pcd, 
            requires_livox,
            schoolRpa || null
        ]);
        
        const studentId = studentRes.rows[0].id;

        // B. Verificar se já recebeu
        const checkDouble = await client.query(
            `SELECT id FROM delivery_batch_items WHERE eligible_student_id = $1 AND delivery_status IN ('realizada', 'confirmed', 'planejada')`,
            [studentId]
        );
        if (checkDouble.rows.length > 0) {
            throw new Error(`O aluno ${sData.name} (${sData.registration}) já possui um tablet registrado.`);
        }

        // C. >>> A MÁGICA: Buscar Tablet EXATAMENTE para o perfil do aluno (Livox e Automação) <<<
        const assetRes = await client.query(`
            SELECT a.id 
            FROM assets a 
            JOIN item_types it ON a.item_type_id = it.id
            WHERE a.status = 'available' 
            AND a.has_livox = $1
            AND a.allow_automation = TRUE
            AND (it.name ILIKE 'Tablet' OR it.sku_code ILIKE 'TAB')
            ORDER BY a.box_number ASC NULLS LAST, a.patrimonio_number ASC
            LIMIT 1 FOR UPDATE SKIP LOCKED
        `, [requires_livox]);

        if (assetRes.rows.length === 0) {
            throw new Error(`Sem estoque de tablets disponíveis para o aluno ${sData.name}. Necessário: ${requires_livox ? 'COM LIVOX (PCD)' : 'PADRÃO'}.`);
        }
        const asset = assetRes.rows[0];

        // D. Associar ao Lote
        await client.query(
            `INSERT INTO delivery_batch_items (batch_id, eligible_student_id, asset_id, delivery_status)
             VALUES ($1, $2, $3, 'planejada')`,
            [batchId, studentId, asset.id]
        );

        // E. Reservar Ativo e Mover para Escola
        await client.query(
            `UPDATE assets SET status = 'in_use', current_unit_id = $1, updated_at = NOW() WHERE id = $2`, 
            [school_unit_id, asset.id]
        );
    }

    await client.query('COMMIT');
    await logAudit(user_id, 'create_complementary_batch', 'delivery_batches', batchId, { count: students.length, scheduled_date }, ipAddress);

    res.json({ message: 'Lote complementar criado com sucesso!', batchId });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro lote complementar:', error);
    res.status(500).json({ message: error.message || 'Erro interno.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// ADICIONAR ALUNO MANUALMENTE A UM LOTE EXISTENTE (LIVOX + AUTOMAÇÃO V6)
// =====================================================================
app.post('/api/delivery-batches/:id/add-manual-student', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id: batch_id } = req.params;
  const { 
      student_registration, 
      student_name, 
      education_year,
      class_name,
      pcd_type 
  } = req.body;
  
  const user_id = req.user.id;
  const ipAddress = req.ip;

  if (!student_registration || !student_name) {
      return res.status(400).json({ message: 'Matrícula e Nome são obrigatórios.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Pegar dados do Lote (para saber a escola e RPA)
    const batchRes = await client.query(`
        SELECT db.school_unit_id, u.rpa 
        FROM delivery_batches db
        JOIN units u ON db.school_unit_id = u.id
        WHERE db.id = $1
    `, [batch_id]);

    if (batchRes.rows.length === 0) throw new Error('Lote não encontrado.');
    const { school_unit_id, rpa } = batchRes.rows[0];

    // 2. Cadastrar ou Atualizar o Aluno (Upsert)
    let requires_livox = false;
    if (pcd_type && String(pcd_type).length > 2 && !['NÃO', 'NAO'].includes(String(pcd_type).toUpperCase())) {
        requires_livox = true;
    }

    const studentRes = await client.query(`
      INSERT INTO tablet_eligible_students (
        year, student_registration, student_name, school_unit_id, 
        education_year, class_name, pcd_type, requires_livox, rpa
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (student_registration) DO UPDATE SET
        student_name = EXCLUDED.student_name,
        school_unit_id = EXCLUDED.school_unit_id,
        education_year = EXCLUDED.education_year,
        class_name = EXCLUDED.class_name,
        pcd_type = EXCLUDED.pcd_type,
        rpa = EXCLUDED.rpa
      RETURNING id
    `, [
        new Date().getFullYear(), 
        student_registration, 
        student_name, 
        school_unit_id, 
        education_year, 
        class_name, 
        pcd_type, 
        requires_livox, 
        rpa
    ]);
    const studentId = studentRes.rows[0].id;

    // 3. Verificar se já recebeu tablet
    const checkDouble = await client.query(
        `SELECT id FROM delivery_batch_items WHERE eligible_student_id = $1 AND delivery_status IN ('realizada', 'confirmed', 'planejada')`,
        [studentId]
    );
    if (checkDouble.rows.length > 0) {
        throw new Error('Este aluno já possui um tablet registrado/planejado em outro lote.');
    }

    // 4. >>> A MÁGICA: Buscar Próximo Tablet EXATO para o perfil (LIVOX e Automação) <<<
    const assetRes = await client.query(`
        SELECT a.id, a.patrimonio_number, a.box_number 
        FROM assets a
        JOIN item_types it ON a.item_type_id = it.id
        WHERE a.status = 'available'
        AND a.has_livox = $1
        AND a.allow_automation = TRUE
        AND (it.name ILIKE 'Tablet' OR it.sku_code ILIKE 'TAB')
        ORDER BY a.box_number ASC NULLS LAST, a.patrimonio_number ASC
        LIMIT 1 FOR UPDATE SKIP LOCKED
    `, [requires_livox]);

    if (assetRes.rows.length === 0) {
        throw new Error(`Sem tablets disponíveis no estoque (Perfil necessário: ${requires_livox ? 'LIVOX PCD' : 'PADRÃO'}).`);
    }
    const asset = assetRes.rows[0];

    // 5. Associar ao Lote
    await client.query(
        `INSERT INTO delivery_batch_items (batch_id, eligible_student_id, asset_id, delivery_status)
         VALUES ($1, $2, $3, 'planejada')`,
        [batch_id, studentId, asset.id]
    );

    // 6. Reservar Ativo e Mover para Escola
    await client.query(
        `UPDATE assets SET status = 'in_use', current_unit_id = $1, updated_at = NOW() WHERE id = $2`, 
        [school_unit_id, asset.id]
    );

    await client.query('COMMIT');
    await logAudit(user_id, 'add_student_to_batch', 'delivery_batches', batch_id, { student: student_registration, asset: asset.patrimonio_number }, ipAddress);

    res.json({ message: 'Aluno adicionado ao lote com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao adicionar aluno:', error);
    res.status(500).json({ message: error.message || 'Erro interno.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// ROTA DE IMPORTAÇÃO LOGÍSTICA V2 (IMEI, Chip, Livox e Reserva Técnica)
// =====================================================================
app.post('/api/tablets/import-logistics', authenticateToken, authorizePermission('MENU_ESCOLAR'), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  
  // Contadores para o relatório final
  let stats = { updated: 0, livox_marked: 0, reserve_marked: 0, errors: 0 };
  let errors = [];

  try {
    // 1. Leitura do Arquivo (Mantida a lógica robusta anterior)
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    } else if (fileExtension === '.csv') {
      await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', reject);
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato não suportado.' });
    }
    fs.unlinkSync(filePath);

    const client = await pool.connect();
    try {
      for (const [index, row] of data.entries()) {
        const line = index + 2;
        
        // Mapeamento Flexível das Colunas
        const TOMBAMENTO = row['TOMBAMENTO'] || row['Patrimonio'] || row['PATRIMONIO'];
        const CAIXA = row['CAIXA'] || row['Caixa'];
        const IMEI = row['IMEI'] || row['Imei'];
        const CHIP = row['CHIP'] || row['Chip'] || row['SimCard'];
        
        // >>> NOVAS COLUNAS ESTRATÉGICAS <<<
        const RAW_LIVOX = row['LIVOX'] || row['Livox'] || row['SOFTWARE']; 
        const RAW_RESERVA = row['RESERVA'] || row['Reserva'] || row['RESERVA_TECNICA'];

        if (!TOMBAMENTO) continue; 

        // Limpeza do Patrimônio para busca (remove pontos/traços)
        const tombamentoLimpo = String(TOMBAMENTO).replace(/\D/g, '');
        
        // Verifica se o ativo existe e se é Tablet
        const checkAsset = await client.query(
            `SELECT a.id, t.name as type_name, a.has_livox, a.allow_automation
             FROM assets a
             JOIN item_types t ON a.item_type_id = t.id
             WHERE REGEXP_REPLACE(a.patrimonio_number, '\\D', '', 'g') = $1`, 
            [tombamentoLimpo]
        );

        if (checkAsset.rows.length === 0) {
            errors.push(`Linha ${line}: Tombamento '${TOMBAMENTO}' não encontrado.`);
            continue;
        }

        const asset = checkAsset.rows[0];

        // Validação de Segurança: Só aplica em Tablets
        if (!asset.type_name.toUpperCase().includes('TABLET')) {
            errors.push(`Linha ${line}: Ativo '${TOMBAMENTO}' não é um Tablet.`);
            continue;
        }

        // --- LÓGICA 1: LIVOX ---
        let setLivox = asset.has_livox; // Mantém o valor atual se a coluna estiver vazia
        if (RAW_LIVOX) {
            const val = String(RAW_LIVOX).toUpperCase().trim();
            if (['SIM', 'S', 'YES', 'TRUE', '1', 'COM LIVOX'].includes(val)) {
                setLivox = true;
                stats.livox_marked++;
            } else if (['NAO', 'N', 'NO', 'FALSE', '0', 'SEM LIVOX'].includes(val)) {
                setLivox = false;
            }
        }

        // --- LÓGICA 2: RESERVA TÉCNICA (Trava do Robô) ---
        let setAutomation = asset.allow_automation; // Mantém o atual
        if (RAW_RESERVA) {
            const val = String(RAW_RESERVA).toUpperCase().trim();
            // Se for marcado como Reserva ("SIM"), a automação é DESLIGADA (FALSE)
            if (['SIM', 'S', 'YES', 'TRUE', '1', 'RESERVA'].includes(val)) {
                setAutomation = false; // Bloqueia o robô
                stats.reserve_marked++;
            } else {
                setAutomation = true; // Libera para o robô
            }
        }

        await client.query('BEGIN');
        
        // Executa o Update Seguro
        await client.query(
          `UPDATE assets 
            SET box_number = COALESCE($1, box_number), 
                imei = COALESCE($2, imei), 
                sim_card_number = COALESCE($3, sim_card_number),
                has_livox = $4,
                allow_automation = $5,
                updated_at = NOW()
            WHERE id = $6`,
          [
            CAIXA ? String(CAIXA).trim() : null,
            IMEI ? String(IMEI).trim() : null,
            CHIP ? String(CHIP).trim() : null,
            setLivox,
            setAutomation,
            asset.id
          ]
        );

        stats.updated++;
        await client.query('COMMIT');
      }
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'import_tablet_logistics_v2', 'assets', null, stats, ipAddress);
    
    res.status(200).json({
      message: `Carga processada com sucesso.`,
      details: `${stats.updated} atualizados. ${stats.livox_marked} marcados como LIVOX. ${stats.reserve_marked} movidos para RESERVA TÉCNICA.`,
      stats,
      errors
    });

  } catch (error) {
    console.error('Erro na carga logística:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Erro interno.', error: error.message });
  }
});

// =====================================================================
// [SANEAMENTO] IMPORTAR LOTE DE RESGATE VIA EXCEL (RETROATIVO)
// Cria um lote já concluído a partir de uma planilha (Matrícula x Patrimônio)
// =====================================================================
app.post('/api/tablets/import-rescue-batch', authenticateToken, authorizePermission('MENU_ESCOLAR'), uploadImport.single('file'), async (req, res) => {
    const ipAddress = req.ip;
    const userId = req.user.id;
    const school_unit_id = req.body.school_unit_id; // Recebido do formulário

    if (!req.file || !school_unit_id) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Arquivo e Escola são obrigatórios.' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let data = [];
    let errors = [];
    let successCount = 0;

    try {
        // 1. Leitura do Arquivo
        if (fileExtension === '.xlsx') {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        } else if (fileExtension === '.csv') {
            await new Promise((resolve, reject) => {
                const results = [];
                fs.createReadStream(filePath)
                    .pipe(csv({ separator: ';' }))
                    .on('data', (row) => results.push(row))
                    .on('end', () => { data = results; resolve(); })
                    .on('error', reject);
            });
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ message: 'Formato não suportado. Use .xlsx ou .csv.' });
        }
        fs.unlinkSync(filePath);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 2. Cria o Lote Pai já Concluído
            const batchRes = await client.query(
                `INSERT INTO delivery_batches (school_unit_id, created_by_user_id, status, name, creation_date, delivery_confirmation_date, terms_status)
                 VALUES ($1, $2, 'Concluído', 'Lote de Saneamento (Importação Manual)', NOW(), NOW(), 'completed') RETURNING id`,
                [school_unit_id, userId]
            );
            const batchId = batchRes.rows[0].id;

            // 3. Cria a Movimentação de Saída Oficial
            const movRes = await client.query(
                `INSERT INTO asset_movements (movement_type, responsible_user_id, destination_unit_id, purpose, delivery_status, actual_delivery_date, movement_date)
                 VALUES ('exit', $1, $2, 'Entrega Retroativa (Saneamento de Lote via Excel)', 'confirmed', NOW(), NOW()) RETURNING id`,
                [userId, school_unit_id]
            );
            const movementId = movRes.rows[0].id;

            // 4. Processa Linha a Linha da Planilha
            for (const [index, row] of data.entries()) {
                const line = index + 2;
                
                // Mapeamento flexível das colunas do Excel
                const matricula = row['MATRICULA'] || row['Matricula'] || row['matricula'];
                const patrimonio = row['PATRIMONIO'] || row['Patrimonio'] || row['patrimônio'] || row['TOMBAMENTO'];

                if (!matricula || !patrimonio) {
                    errors.push(`Linha ${line}: Matrícula ou Patrimônio em branco. Ignorada.`);
                    continue;
                }

                // Busca IDs internos
                const studentRes = await client.query('SELECT id FROM tablet_eligible_students WHERE student_registration = $1 LIMIT 1', [String(matricula).trim()]);
                const assetRes = await client.query('SELECT id FROM assets WHERE patrimonio_number = $1 OR serial_number = $1 LIMIT 1', [String(patrimonio).trim()]);

                if (studentRes.rows.length === 0) {
                    errors.push(`Linha ${line}: Aluno com matrícula ${matricula} não cadastrado no SGA.`);
                    continue;
                }
                if (assetRes.rows.length === 0) {
                    errors.push(`Linha ${line}: Tablet com patrimônio ${patrimonio} não encontrado no estoque.`);
                    continue;
                }

                const studentId = studentRes.rows[0].id;
                const assetId = assetRes.rows[0].id;

                // Executa as amarrações do Banco
                await client.query(`UPDATE assets SET status = 'in_use', current_unit_id = $1, updated_at = NOW() WHERE id = $2`, [school_unit_id, assetId]);
                await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [movementId, assetId]);
                await client.query(
                    `INSERT INTO delivery_batch_items (batch_id, asset_id, eligible_student_id, delivery_status, delivery_date, term_received) 
                     VALUES ($1, $2, $3, 'realizada', CURRENT_DATE, true)`,
                    [batchId, assetId, studentId]
                );
                await client.query(`UPDATE tablet_eligible_students SET delivery_movement_id = $1 WHERE id = $2`, [movementId, studentId]);

                successCount++;
            }

            await client.query('COMMIT');
            await logAudit(userId, 'import_rescue_batch', 'delivery_batches', batchId, { successCount, errors_count: errors.length }, ipAddress);

            res.status(201).json({ 
                message: `Saneamento concluído! ${successCount} tablets foram vinculados.`, 
                batch_id: batchId,
                errors 
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Erro na importação de saneamento:', error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: 'Erro interno ao processar planilha.', error: error.message });
    }
});

// =====================================================================
// ROTA DE DISTRIBUIÇÃO AUTOMÁTICA INTELIGENTE (PCD + CAIXAS ORDENADAS)
// =====================================================================
app.post('/api/delivery-batches/:id/distribute-automatically', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id: batch_id } = req.params;
  const ipAddress = req.ip;
  const client = await pool.connect();

  let successPcd = 0;
  let successStandard = 0;
  let warnings = [];

  try {
    await client.query('BEGIN');

    // 1. Dados do Lote
    const batchRes = await client.query('SELECT school_unit_id FROM delivery_batches WHERE id = $1 FOR UPDATE', [batch_id]);
    if (batchRes.rows.length === 0) throw new Error('Lote não encontrado.');
    const { school_unit_id } = batchRes.rows[0];

    // --- FASE 1: A ELITE (Alunos PCD que precisam de Livox) ---
    // Buscamos alunos pendentes que requerem o software, ORDENADOS ALFABETICAMENTE
    const pcdStudentsRes = await client.query(`
      SELECT id, student_name FROM tablet_eligible_students 
      WHERE school_unit_id = $1 AND requires_livox = TRUE
      AND id NOT IN (SELECT eligible_student_id FROM delivery_batch_items WHERE delivery_status IN ('planejada', 'realizada', 'confirmed'))
      ORDER BY student_name ASC
      FOR UPDATE
    `, [school_unit_id]);
    const pcdStudents = pcdStudentsRes.rows;

    if (pcdStudents.length > 0) {
        // Busca Tablets com LIVOX (TRUE) e Automação (TRUE)
        // ORDENADOS RIGOROSAMENTE PELA CAIXA E DEPOIS PATRIMÔNIO
        const pcdAssetsRes = await client.query(`
          SELECT a.id, a.box_number, a.patrimonio_number FROM assets a 
          JOIN item_types it ON a.item_type_id = it.id
          WHERE a.status = 'available' 
            AND a.has_livox = TRUE 
            AND a.allow_automation = TRUE
            AND (it.name ILIKE 'Tablet' OR it.sku_code ILIKE 'TAB')
          ORDER BY a.box_number ASC NULLS LAST, a.patrimonio_number ASC
          LIMIT $1 FOR UPDATE SKIP LOCKED
        `, [pcdStudents.length]);
        const pcdAssets = pcdAssetsRes.rows;

        // Distribui (Casamento 1 para 1)
        const matchCount = Math.min(pcdStudents.length, pcdAssets.length);
        for (let i = 0; i < matchCount; i++) {
            await linkStudentAsset(client, batch_id, pcdStudents[i].id, pcdAssets[i].id, school_unit_id);
            successPcd++;
        }

        if (pcdAssets.length < pcdStudents.length) {
            warnings.push(`Alerta: Faltam ${pcdStudents.length - pcdAssets.length} tablets com LIVOX no estoque liberado.`);
        }
    }

    // --- FASE 2: O GROSSO (Alunos Regulares) ---
    // Buscamos alunos pendentes regulares, ORDENADOS ALFABETICAMENTE
    const stdStudentsRes = await client.query(`
      SELECT id, student_name FROM tablet_eligible_students 
      WHERE school_unit_id = $1 AND requires_livox = FALSE
      AND id NOT IN (SELECT eligible_student_id FROM delivery_batch_items WHERE delivery_status IN ('planejada', 'realizada', 'confirmed'))
      ORDER BY student_name ASC
      FOR UPDATE
    `, [school_unit_id]);
    const stdStudents = stdStudentsRes.rows;

    if (stdStudents.length > 0) {
        // Busca Tablets COMUNS (has_livox = FALSE) e Automação (TRUE)
        // ORDENADOS RIGOROSAMENTE PELA CAIXA E DEPOIS PATRIMÔNIO
        const stdAssetsRes = await client.query(`
          SELECT a.id, a.box_number, a.patrimonio_number FROM assets a 
          JOIN item_types it ON a.item_type_id = it.id
          WHERE a.status = 'available' 
            AND a.has_livox = FALSE 
            AND a.allow_automation = TRUE
            AND (it.name ILIKE 'Tablet' OR it.sku_code ILIKE 'TAB')
          ORDER BY a.box_number ASC NULLS LAST, a.patrimonio_number ASC
          LIMIT $1 FOR UPDATE SKIP LOCKED
        `, [stdStudents.length]);
        const stdAssets = stdAssetsRes.rows;

        // Distribui (Casamento 1 para 1)
        const matchCount = Math.min(stdStudents.length, stdAssets.length);
        for (let i = 0; i < matchCount; i++) {
            await linkStudentAsset(client, batch_id, stdStudents[i].id, stdAssets[i].id, school_unit_id);
            successStandard++;
        }
        
        if (stdAssets.length < stdStudents.length) {
            warnings.push(`Alerta: Faltam ${stdStudents.length - stdAssets.length} tablets regulares no estoque liberado.`);
        }
    }

    await client.query('COMMIT');
    await logAudit(req.user.id, 'auto_distribute_v3', 'delivery_batches', batch_id, { pcd: successPcd, std: successStandard, warnings }, ipAddress);

    res.status(200).json({
      message: `Distribuição Inteligente Concluída!`,
      details: `${successPcd} tablets LIVOX e ${successStandard} tablets padrão foram alocados em ordem.`,
      successCount: successPcd + successStandard,
      warnings
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na distribuição:', error);
    res.status(500).json({ message: 'Erro ao processar distribuição.', error: error.message });
  } finally {
    client.release();
  }
});

// Helper (Mantenha ou adicione se não tiver)
async function linkStudentAsset(client, batchId, studentId, assetId, schoolId) {
    await client.query(
        `INSERT INTO delivery_batch_items (batch_id, eligible_student_id, asset_id, delivery_status)
         VALUES ($1, $2, $3, 'planejada')`,
        [batchId, studentId, assetId]
    );
    await client.query(
        `UPDATE assets SET status = 'in_use', current_unit_id = $1, updated_at = NOW() WHERE id = $2`, 
        [schoolId, assetId]
    );
}

// Helper interno para vincular (evita repetição de código)
async function linkStudentAsset(client, batchId, studentId, assetId, schoolId) {
    // Insere no lote
    await client.query(
        `INSERT INTO delivery_batch_items (batch_id, eligible_student_id, asset_id, delivery_status)
         VALUES ($1, $2, $3, 'planejada')`,
        [batchId, studentId, assetId]
    );
    // Atualiza status do ativo
    await client.query(
        `UPDATE assets SET status = 'in_use', current_unit_id = $1, updated_at = NOW() WHERE id = $2`, 
        [schoolId, assetId]
    );
}

// =====================================================================
// 1. LISTAR ITENS DE UM LOTE (ATUALIZADO COM DADOS PCD/LIVOX)
// =====================================================================
app.get('/api/delivery-batches/:id/items', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id: batch_id } = req.params;
  try {
    const query = `
      SELECT 
        dbi.id, 
        s.student_name, 
        s.student_registration, 
        s.pcd_type,           -- CAMPO NOVO: Tipo de Deficiência
        s.requires_livox,     -- CAMPO NOVO: Se precisa do software
        a.patrimonio_number,
        a.serial_number,
        a.box_number,
        a.has_livox,          -- CAMPO NOVO: Se o tablet tem o software
        dbi.delivery_status
      FROM delivery_batch_items dbi
      JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
      JOIN assets a ON dbi.asset_id = a.id
      WHERE dbi.batch_id = $1
      ORDER BY s.student_name ASC
    `;
    const result = await pool.query(query, [batch_id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar itens do lote:', error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// =====================================================================
// RELATÓRIO: RECIBO COLETIVO DE ENTREGA DE TABLETS
// =====================================================================
app.get('/api/reports/delivery-batch/:id/collective', authenticateToken, async (req, res) => {
  const { id: batch_id } = req.params;
  const ipAddress = req.ip;

  try {
    // 1. Buscar Cabeçalho do Lote
    const batchRes = await pool.query(`
      SELECT db.name, u.name as school_name, db.status, db.creation_date 
      FROM delivery_batches db 
      JOIN units u ON db.school_unit_id = u.id 
      WHERE db.id = $1`, [batch_id]);
    
    if (batchRes.rows.length === 0) return res.status(404).json({ message: 'Lote não encontrado.' });
    const batch = batchRes.rows[0];

    // 2. Buscar Itens (Alunos e Tablets)
    // Ordenados por Aluno (Alfabética)
    const itemsRes = await pool.query(`
      SELECT 
        s.student_name, 
        a.patrimonio_number, 
        a.serial_number,
        a.brand,
        a.model
      FROM delivery_batch_items dbi
      JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
      JOIN assets a ON dbi.asset_id = a.id
      WHERE dbi.batch_id = $1
      ORDER BY s.student_name ASC`, [batch_id]);
    
    const items = itemsRes.rows;

    // 3. Carregar Logo
    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath, 'base64');
    }

    // 4. Construir o Corpo da Tabela (Página 1)
    const tableBody = [
        [
            { text: 'QTD', style: 'tableHeader', alignment: 'center' },
            { text: 'EQUIPAMENTO', style: 'tableHeader', alignment: 'center' },
            { text: 'Nº DE SÉRIE', style: 'tableHeader', alignment: 'center' },
            { text: 'PATRIMÔNIO', style: 'tableHeader', alignment: 'center' },
            { text: 'ALUNO', style: 'tableHeader', alignment: 'center' }
        ]
    ];

    items.forEach(item => {
        tableBody.push([
            { text: '1', alignment: 'center', fontSize: 9 },
            { text: `Tablet ${item.brand} ${item.model}`, fontSize: 9 },
            { text: item.serial_number || 'N/A', alignment: 'center', fontSize: 9 },
            { text: item.patrimonio_number, alignment: 'center', fontSize: 9, bold: true },
            { text: item.student_name, fontSize: 9 }
        ]);
    });

    // 5. Definição do Documento
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [30, 100, 30, 30], // Margens ajustadas para caber cabeçalho/rodapé grandes
      
      // --- CABEÇALHO (Repete em todas as páginas) ---
      header: {
        margin: [40, 20, 40, 0],
        columns: [
            { 
                image: logoBase64 ? `data:image/png;base64,${logoBase64}` : '', 
                width: 60,
                margin: [0, 10, 20, 0] 
            },
            {
                stack: [
                    { text: 'PREFEITURA DO RECIFE', bold: true, fontSize: 11 },
                    { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 },
                    { text: 'SECRETARIA EXECUTIVA DE PROJETOS, TECNOLOGIA E INOVAÇÃO', fontSize: 9 },
                    { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 },
                    { text: 'DIVISÃO DE INFRAESTRUTURA EM TECNOLOGIA', fontSize: 9 }
                ],
                alignment: 'center',
                margin: [0, 5, 60, 0]
            }
        ]
      },

      // --- RODAPÉ (Repete em todas as páginas) ---
      footer: {
        margin: [40, 0, 40, 20],
        stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] }, // Linha separadora
            { text: 'Gerência de Infraestrutura de Tecnologia', bold: true, alignment: 'center', margin: [0, 5, 0, 0], fontSize: 9 },
            { text: 'Av. Oliveira Lima, 824 – Soledade', alignment: 'center', fontSize: 9 },
            { text: 'CEP: 50050-390 | FONE: 3355-5471', alignment: 'center', fontSize: 9 }
        ]
      },

      // --- CONTEÚDO ---
      content: [
        // ========== PÁGINA 1: RECIBO ==========
        { text: 'RECIBO DE ENTREGA DE BENS', style: 'title', alignment: 'center', margin: [0, 0, 0, 20] },
        
        { 
            text: [
                'Estamos entregando por meio da GIT/DIT – Gerência de Infraestrutura de Tecnologia / Divisão de Infraestrutura em Tecnologia, o(s) equipamento(s) especificado(s) abaixo, para distribuição aos alunos elegíveis ao recebimento de Tablets da unidade ',
                { text: batch.school_name, bold: true, decoration: 'underline' },
                '.'
            ],
            style: 'body',
            alignment: 'justify',
            margin: [0, 0, 0, 10]
        },

        // Tabela de Equipamentos
        {
            table: {
                headerRows: 1,
                widths: [25, 100, 80, 70, '*'], // Larguras ajustadas
                body: tableBody
            },
            layout: {
                hLineWidth: (i) => (i === 0 || i === 1) ? 1 : 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#gray',
                vLineColor: () => '#gray'
            }
        },

        // Totalizador
        { text: `Total: ${items.length} equipamentos`, alignment: 'center', bold: true, margin: [0, 5, 0, 10] },

        // Data
        { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}`, alignment: 'right', margin: [0, 0, 0, 20] },

        // >>> NOVO CAMPO DE RESSALVAS <<<
        {
            text: 'OCORRÊNCIAS / ITENS NÃO ENTREGUES (Preencher à mão):',
            fontSize: 8, bold: true, margin: [0, 0, 0, 2]
        },
        {
            table: {
                widths: ['*'],
                body: [
                    [{ text: '\n\n\n\n\n', fontSize: 9 }] // Espaço vazio para escrever
                ]
            },
            layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5
            },
            margin: [0, 0, 0, 20]
        },

        // Assinaturas
        {
            columns: [
                {
                    stack: [
                        // Espaço em branco grande para assinatura
                        { text: ' ', fontSize: 30 }, 
                        { text: '_______________________________________', alignment: 'center' },
                        { text: 'Alberto Dantas', bold: true, alignment: 'center', fontSize: 9 },
                        { text: 'Gerente de Infraestrutura de Tecnologia', fontSize: 8, alignment: 'center' },
                        { text: 'Matrícula 123.738-1', fontSize: 8, alignment: 'center' },
                        { text: 'Responsável pela Liberação', fontSize: 8, alignment: 'center', italics: true, margin: [0, 2, 0, 0] }
                    ],
                    width: '50%'
                },
                {
                    stack: [
                        { text: ' ', fontSize: 30 }, // Espaço em branco igual
                        { text: '_______________________________________', alignment: 'center' },
                        { text: 'Responsável pelo Recebimento', bold: true, fontSize: 9, alignment: 'center' },
                        { text: '(Nome, Cargo e Matrícula Legíveis)', fontSize: 7, italics: true, alignment: 'center' }
                    ],
                    width: '50%'
                }
            ]
        },

        // ========== PÁGINA 2: TERMO DE RESPONSABILIDADE ==========
        { text: '', pageBreak: 'before' },
        
        { text: 'TERMO DE RESPONSABILIDADE', style: 'title', alignment: 'center', margin: [0, 0, 0, 10] }, // Margem reduzida

        { 
            text: [
                'Reconheço que recebi o(s) equipamento(s) descrito(s) no recibo constante no verso deste termo, por meio da GIT – Gerência de Infraestrutura de Tecnologia, a título de:\n',
                { text: '( X ) ENTREGA', bold: true, fontSize: 10 }
            ],
            style: 'body',
            alignment: 'justify',
            margin: [0, 0, 0, 10] // Margem reduzida
        },

        {
            ul: [
        // >>> ITEM 1 ATUALIZADO COM A NOVA ORIENTAÇÃO <<<
        {
            text: [
                'Comprometo-me a entregar o(s) tablet(s) aos alunos elegíveis no prazo de 15 dias úteis e, ao término deste período, enviar a confirmação de entrega para o e-mail ',
                { text: 'sga.git@educ.rec.br', bold: true, decoration: 'underline', color: 'blue' },
                ', contendo em anexo (digitalizados) todos os Termos Individuais devidamente preenchidos e assinados pelos responsáveis dos estudantes.'
            ]
        },
        
        // Itens seguintes mantidos:
        'Caso o(s) tablet(s) não esteja(m) tombado(s), comprometo-me a facilitar o acesso do profissional do Setor de Patrimônio às instalações onde se encontrava(m) o(s) equipamento(s).',
        'Em caso de rescisão de contrato, exoneração, aposentadoria ou transferência, comprometo-me a devolver à GIT – Gerência de Infraestrutura de Tecnologia todos os equipamentos e acessórios sob minha responsabilidade, os quais deverão estar completos e em bom estado de conservação e uso.',
        'Comprometo-me a NÃO repassar a outra pessoa ou remanejar para outro departamento/setor o(s) tablet(s) constantes neste recibo, sem a prévia autorização da GIT.',
        'Estou ciente de que, caso o(s) tablet(s) seja(m) extraviado(s), furtado(s) ou roubado(s), terei que tomar as providências URGENTES abaixo:'
    ],
            style: 'body',
            margin: [0, 5, 0, 5] // Bullet points mais compactos
        },

        {
            text: [
                { text: '5.1. ', bold: true },
                'Registrar um Boletim de Ocorrência (B.O.) online ou na Delegacia de Polícia mais próxima do local onde ocorreu o fato. Neste B.O., deverá constar as especificações do(s) tablet(s), incluindo número de TOMBO do patrimônio e número de SÉRIE.'
            ],
            style: 'body',
            margin: [0, 5, 0, 5] // Margem reduzida
        },
        {
            text: [
                { text: '5.2. ', bold: true },
                'Enviar um ofício relatando o ocorrido, com a cópia anexa do Boletim de Ocorrência, para a GIT – Gerência de Infraestrutura de Tecnologia, localizada à Av. Oliveira Lima, 824, Soledade, Recife (Prédio do CETEC), por e-mail (relacionamentosepti@educ.rec.br e dinfraestrutura@educ.rec.br).'
            ],
            style: 'body',
            margin: [0, 5, 0, 15] // Margem reduzida
        },

        { text: 'Recebido em ____/____/______', alignment: 'center', margin: [0, 0, 0, 20] },

        // Assinatura P2 (AJUSTADO: Compactado para caber na página)
        {
            stack: [
                { text: '_________________________________________________', alignment: 'center' },
                { text: 'Responsável pelo Recebimento', bold: true, alignment: 'center', fontSize: 9 },
                
                // Usando colunas para colocar labels e linhas lado a lado economiza altura vertical
                {
                    columns: [
                        { text: 'Nome:', width: 40, fontSize: 9, bold: true, margin: [0, 5, 0, 0] },
                        { text: '__________________________________________________________________', fontSize: 9, margin: [0, 5, 0, 0] }
                    ],
                    margin: [80, 0, 0, 0] // Indentação para centralizar visualmente
                },
                {
                    columns: [
                        { text: 'Cargo:', width: 40, fontSize: 9, bold: true, margin: [0, 5, 0, 0] },
                        { text: '__________________________________________________________________', fontSize: 9, margin: [0, 5, 0, 0] }
                    ],
                    margin: [80, 0, 0, 0]
                },
                {
                    columns: [
                        { text: 'Matr.:', width: 40, fontSize: 9, bold: true, margin: [0, 5, 0, 0] },
                        { text: '________________________', fontSize: 9, margin: [0, 5, 0, 0], width: 'auto' },
                        { text: 'CPF:', width: 30, fontSize: 9, bold: true, margin: [10, 5, 0, 0] },
                        { text: '________________________', fontSize: 9, margin: [0, 5, 0, 0], width: 'auto' }
                    ],
                    margin: [80, 0, 0, 0]
                },
                {
                    columns: [
                        { text: 'Setor:', width: 40, fontSize: 9, bold: true, margin: [0, 5, 0, 0] },
                        { text: '__________________________________________________________________', fontSize: 9, margin: [0, 5, 0, 0] }
                    ],
                    margin: [80, 0, 0, 0]
                }
            ]
        }
      ],
      styles: {
        headerText: { fontSize: 9, color: '#333' },
        title: { fontSize: 12, bold: true, decoration: 'underline' }, // Fonte reduzida de 14 para 12
        tableHeader: { bold: true, fontSize: 8, fillColor: '#e0e0e0', color: 'black' },
        body: { fontSize: 9, lineHeight: 1.2 } // Fonte reduzida de 10 para 9
      },
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf');
      res.attachment(`recibo_coletivo_lote_${batch_id}.pdf`);
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();

    await logAudit(req.user.id, 'generate_report', 'delivery_batch_collective', batch_id, null, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar recibo coletivo:', error);
    res.status(500).json({ message: 'Erro ao gerar PDF.' });
  }
});

// =====================================================================
// RELATÓRIO: TERMO INDIVIDUAL (COM LOGICA CONDICIONAL DE CHIP E TROCA)
// =====================================================================
app.get('/api/reports/delivery-item/:id/term', authenticateToken, async (req, res) => {
  const { id: item_id } = req.params; 
  const ipAddress = req.ip;

  try {
    // 1. Busca os dados principais da ENTREGA ATUAL
    const result = await pool.query(`
      SELECT 
        s.student_name, s.student_registration, s.education_year,
        a.patrimonio_number, a.serial_number, a.imei, a.brand, a.model, a.sim_card_number,
        u.name as school_name,
        dbi.delivery_date
      FROM delivery_batch_items dbi
      JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
      JOIN assets a ON dbi.asset_id = a.id
      JOIN delivery_batches db ON dbi.batch_id = db.id
      JOIN units u ON db.school_unit_id = u.id
      WHERE dbi.id = $1`, [item_id]);
    
    if (result.rows.length === 0) return res.status(404).json({ message: 'Item não encontrado.' });
    const data = result.rows[0];

    // ==================================================================================
    // 2. BUSCA HISTÓRICO DE SUBSTITUIÇÃO & DETALHES DO ANTIGO
    // ==================================================================================
    let substitution = null;
    let oldAssetDetails = null;

    const subResult = await pool.query(`
        SELECT old_asset_patrimonio, reason, created_at 
        FROM tablet_substitutions_log 
        WHERE student_registration = $1 AND new_asset_patrimonio = $2
        ORDER BY id DESC LIMIT 1
    `, [data.student_registration, data.patrimonio_number]);
    
    if (subResult.rows.length > 0) {
        substitution = subResult.rows[0];

        // Busca os dados técnicos (IMEI/CHIP) do ativo antigo que foi atualizado no Modal
        const oldAssetRes = await pool.query(`
            SELECT imei, sim_card_number, brand, model 
            FROM assets 
            WHERE patrimonio_number = $1
        `, [substitution.old_asset_patrimonio]);

        if (oldAssetRes.rows.length > 0) {
            oldAssetDetails = oldAssetRes.rows[0];
        }
    }
    // ==================================================================================

    // 3. PREPARAÇÃO DA TABELA DE EQUIPAMENTOS (CONDICIONAL)
    const equipmentRows = [
        [{ text: 'QTD', style: 'th' }, { text: 'EQUIPAMENTO / DESCRIÇÃO', style: 'th' }, { text: 'IDENTIFICADOR', style: 'th' }]
    ];

    // Validação Blindada: Forçamos FALSE para OMITIR a impressão da linha do chip no PDF
    const validChip = false;

    // Linha do Chip
    if (validChip) {
        equipmentRows.push([
            { text: '1', alignment: 'center', fontSize: 9, margin: [0, 2] },
            { text: 'LINHA CHIP DE DADOS COM PACOTE DE 20GB/MENSAL - OPERADORA CLARO', fontSize: 9, margin: [0, 2] },
            { text: `Nº DA LINHA: ${data.sim_card_number}`, fontSize: 8, bold: true, margin: [0, 2] }
        ]);
    }

    // Linha do Tablet (Sempre entra)
    let tabletIdText = `TOMBO: ${data.patrimonio_number || 'S/N'}`;
    if (data.imei && String(data.imei).trim() !== '' && String(data.imei).toUpperCase() !== 'N/A') {
        tabletIdText += ` | IMEI: ${data.imei}`;
    }
    
    equipmentRows.push([
        { text: '1', alignment: 'center', fontSize: 8, margin: [0, 2] },
        { text: `TABLET ${data.brand || ''} ${data.model || ''}, CARREGADOR E CAPA`.trim(), fontSize: 9, margin: [0, 2] },
        { text: tabletIdText, fontSize: 8, margin: [0, 2] }
    ]);

    // ==================================================================================

    // ==================================================================================

    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) logoBase64 = fs.readFileSync(logoPath, 'base64');

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 120, 40, 80], 
      
      header: {
        margin: [30, 20, 30, 30],
        columns: [
            { image: logoBase64 ? `data:image/png;base64,${logoBase64}` : '', width: 50, margin: [0, 5, 20, 0] },
            {
                stack: [
                    { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 },
                    { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 },
                    { text: 'SECRETARIA EXECUTIVA DE PROJETOS, TECNOLOGIA E INOVAÇÃO', fontSize: 8 },
                    { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 8 },
                    { text: 'DIVISÃO DE INFRAESTRUTURA EM TECNOLOGIA', fontSize: 8 }
                ],
                alignment: 'center', margin: [0, 15, 50, 0] 
            }
        ]
      },

      footer: {
        margin: [40, 0, 40, 10],
        stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] },
            { text: 'Gerência de Infraestrutura de Tecnologia', bold: true, alignment: 'center', margin: [0, 3, 0, 0], fontSize: 8 },
            { text: 'Av. Oliveira Lima, 824 – Soledade | CEP: 50050-390 | FONE: 3355-5471', alignment: 'center', fontSize: 8 }
        ]
      },

      content: [
        { text: 'TERMO DE PERMISSÃO DE USO', style: 'title', alignment: 'center', margin: [0, 10, 0, 10] },

        {
            text: [
                { text: 'O MUNICÍPIO DO RECIFE', bold: true },
                ', entidade de direito público interno, sediado no Cais do Apolo, nº 925, bairro do Recife, nesta cidade, inscrito no CNPJ sob o nº 10.565.000/0001-92, doravante denominado simplesmente ',
                { text: 'PERMITENTE', bold: true },
                ', e do outro lado, o estudante acima qualificado (',
                { text: data.student_name, bold: true, decoration: 'underline' },
                '), doravante denominado(a) simplesmente ',
                { text: 'PERMISSIONÁRIO(A)', bold: true },
                ', neste ato representado(a) por (Nome do pai ou responsável pelo estudante) __________________________________________________________________, portador do RG ______________________, inscrito sob o CPF nº _______________________, residentes e domiciliados no endereço __________________________________________________________________________ Cidade do Recife, Pernambuco, CEP ______________, telefone (___) _______________, celebram o presente Termo de Permissão de Uso com observância estrita de suas cláusulas, que, em sucessivo, mútua e reciprocamente, outorgam e aceitam, de conformidade com os preceitos de direito público, além dos especificamente previstos na Lei Municipal nº 17.957/2013, aplicando-se, supletivamente, os princípios da Teoria Geral dos Contratos e as disposições de direito.'
            ],
            style: 'body', margin: [0, 10, 0, 5]
        },

        // Tabela Aluno
        { text: 'DADOS DO ESTUDANTE (PERMISSIONÁRIO)', style: 'sectionHeader', margin: [0, 10, 0, 2] },
        {
            table: {
                widths: ['*', 90, 60, '*'],
                body: [
                    [
                        { text: 'NOME DO ESTUDANTE', style: 'th' },
                        { text: 'MATRÍCULA', style: 'th' },
                        { text: 'ANO', style: 'th' },
                        { text: 'UNIDADE', style: 'th' }
                    ],
                    [
                        { text: data.student_name, fontSize: 8, bold: true },
                        { text: data.student_registration, fontSize: 8, alignment: 'center' },
                        { text: data.education_year || '-', fontSize: 8, alignment: 'center' },
                        { text: data.school_name, fontSize: 8 }
                    ]
                ]
            },
            layout: 'lightHorizontalLines', margin: [0, 10, 0, 5]
        },

        // ==================================================================================
        // BLOCO DE SUBSTITUIÇÃO (CONDICIONAL)
        // Mostra dados do antigo (incluindo Chip/IMEI recuperados) se houver substituição
        // ==================================================================================
        ...(substitution ? [
            { text: 'HISTÓRICO DE SUBSTITUIÇÃO', style: 'sectionHeader', margin: [0, 10, 0, 2], color: '#b91c1c' },
            {
                table: {
                    widths: ['*', '*'],
                    body: [
                        [
                            { text: 'EQUIPAMENTO ANTERIOR (RECOLHIDO)', style: 'th', fillColor: '#fff1f2' },
                            { text: 'MOTIVO DA TROCA', style: 'th', fillColor: '#fff1f2' }
                        ],
                        [
                            { 
                                text: [
                                    { text: 'Patrimônio: ', bold: true }, substitution.old_asset_patrimonio,
                                    // Adiciona detalhes técnicos se encontrados
                                    (oldAssetDetails?.imei ? ` | IMEI: ${oldAssetDetails.imei}` : ''),
                                    (oldAssetDetails?.sim_card_number ? `\nChip: ${oldAssetDetails.sim_card_number}` : ''),
                                    '\nData da Troca: ', new Date(substitution.created_at).toLocaleDateString('pt-BR')
                                ], 
                                fontSize: 9, margin: [0, 2]
                            },
                            { text: substitution.reason, fontSize: 9, margin: [0, 2] }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines', margin: [0, 0, 0, 5]
            }
        ] : []),

        // Tabela Equipamento (Dinâmica: Chip só aparece se existir)
        { text: 'DESCRIÇÃO DOS EQUIPAMENTOS CEDIDOS (ATUAL)', style: 'sectionHeader', margin: [0, 10, 0, 2] },
        {
            table: {
                widths: [25, '*', 140],
                body: equipmentRows // <--- Aqui usamos a variável dinâmica
            },
            layout: 'lightHorizontalLines', margin: [0, 10, 0, 8]
        },

        // CLÁUSULAS
        { text: [{ text: 'CLÁUSULA PRIMEIRA – DO OBJETO – ', bold: true }, 'O objeto do presente contrato é permissão de uso, a título gratuito, dos equipamentos discriminados na tabela acima, tudo de propriedade do PERMITENTE para uso exclusivo do (a) PERMISSIONÁRIO (A).'], style: 'clause' },
        
        { text: [{ text: 'PARÁGRAFO PRIMEIRO – ', bold: true }, 'O PERMISSIONÁRIO (A) declara que recebeu, na data da assinatura deste ato, os equipamentos, objeto deste contrato, e seus acessórios em perfeito estado de conservação e funcionamento.'], style: 'clause' },
        
        { text: [{ text: 'PARÁGRAFO SEGUNDO – ', bold: true }, 'Os equipamentos objeto desta permissão de uso destinam-se, exclusivamente, ao uso individual do (a) PERMISSIONÁRIO (A) dentro e fora do ambiente escolar, como material de apoio pedagógico do (a) estudante-PERMISSIONÁRIO, sendo vedada a sua utilização em destinação diversa da estabelecida neste instrumento.'], style: 'clause' },
        
        { text: [{ text: 'CLÁUSULA SEGUNDA – DO PRAZO – ', bold: true }, 'O prazo da presente permissão é de 6 (seis) anos, contados a partir da data de sua assinatura.'], style: 'clause' },
        
        { text: [{ text: 'PARÁGRAFO ÚNICO – ', bold: true }, 'Na hipótese de reprovação do (a) PERMISSIONÁRIO (A) será admitida prorrogação do prazo contratual, uma única vez, pelo novo interregno faltante para conclusão do Ensino Fundamental, condicionado à realização da nova matrícula para a mesma série em que se deu a reprovação, dentro dos prazos regulares divulgados pela Secretaria de Educação.'], style: 'clause' },

        { text: [{ text: 'CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO (A) PERMISSIONÁRIO (A) – ', bold: true }, 'São obrigações do (a) PERMISSIONÁRIO (A): a) conservar, como se sua própria fora, a coisa emprestada nos termos da lei civil; b) não utilizar os equipamentos cedidos em destinação diversa da estabelecida neste contrato; c) não ceder ou transferir, no todo ou em parte, o presente contrato; d) arcar com todas as despesas e custos decorrentes do uso normal do equipamento objeto deste contrato, não podendo jamais recobrar do PERMITENTE as despesas feitas com o uso e gozo da coisa emprestada; e) devolver o equipamento ao PERMITENTE, em bom estado de uso e conservação, quando do término do prazo de vigência do contrato, bem como nas hipóteses de rescisão unilateral e de impossibilidade de prorrogação do prazo contratual; f) observar e cumprir os demais termos e condições de uso contidos no Anexo Único ao presente instrumento, que são parte integrante do presente termo de permissão.'], style: 'clause' },

        { text: [{ text: 'CLÁUSULA QUARTA – DA RESPONSABILIDADE PERANTE TERCEIROS – ', bold: true }, 'O PERMITENTE não será responsável por quaisquer e eventuais danos ou indenizações a terceiros causados por ato do (a) PERMISSIONÁRIO (A) em decorrência do uso, direto ou indireto, do equipamento objeto deste ajuste, cabendo ainda ao PERMISSIONÁRIO responder por perdas e danos causados pelo uso da coisa emprestada em desacordo com a finalidade prevista na CLÁUSULA PRIMEIRA.'], style: 'clause' },

        { text: [{ text: 'CLÁUSULA QUINTA – DA DEVOLUÇÃO DO BEM – ', bold: true }, 'Terminado o prazo de vigência contratual, bem como nas hipóteses de rescisão unilateral do contrato e de impossibilidade de prorrogação no prazo contratual, o (a) PERMISSIONÁRIO (A) se obriga a restituir o equipamento que lhe foi cedido em bom estado de uso e conservação, entregando-o à pessoa encarregada da gestão da unidade escolar.'], style: 'clause' },

        { text: [{ text: 'CLÁUSULA SEXTA – DA RESCISÃO DO CONTRATO - ', bold: true }, 'Constitui causa para rescisão unilateral do contrato: a) a não realização, na vigência do contrato, de matrícula escolar, dentro dos prazos regulares divulgados pela SECRETARIA DE EDUCAÇÃO, em unidade de ensino da rede pública municipal de educação; b) a reprovação por falta, na vigência do contrato; c) a ausência injustificada do aluno em sala de aula, por período superior a 30 (trinta) dias, comprovadas a partir das anotações constantes do Diário de Classe.'], style: 'clause' },

        { text: [{ text: 'CLÁUSULA SÉTIMA– DAS SANÇÕES – ', bold: true }, 'A falta de devolução do bem objeto deste ajuste, bem como sua inutilização sujeitará o (a) PERMISSIONÁRIO (A) às sanções e medidas cabíveis previstas na legislação de regência.'], style: 'clause' },

        { text: [{ text: 'CLÁUSULA OITAVA – DO FORO – ', bold: true }, 'É competente o foro da Comarca do Recife, Capital do Estado de Pernambuco, para dirimir qualquer divergência ou dúvida fundada no presente instrumento que não possa ser resolvido pela via administrativa, renunciando as partes a qualquer outro por mais privilegiado que seja.'], style: 'clause' },

        { text: 'É por estarem justas e contratadas, as partes na presença das testemunhas abaixo, assinam o presente instrumento, em 02 (duas) vias de igual teor e forma.', margin: [0, 5, 0, 10], fontSize: 8 },

        // ASSINATURAS P1
        { text: `Recife, _____ de ___________________ de ${new Date().getFullYear()}.`, alignment: 'center', margin: [0, 100, 0, 80], fontSize: 9 },

        {
            columns: [
                {
                    stack: [
                        { text: '_______________________________________', alignment: 'center' },
                        { text: 'REPRESENTANTE DA SECRETARIA', bold: true, fontSize: 8, alignment: 'center' },
                        { text: 'PERMITENTE', fontSize: 8, alignment: 'center' },
                        { text: '(Carimbar com dados do gestor)', fontSize: 6, italics: true, alignment: 'center' }
                    ]
                },
                {
                    stack: [
                        { text: '_______________________________________', alignment: 'center' },
                        { text: 'REPRESENTANTE DO ESTUDANTE', bold: true, fontSize: 8, alignment: 'center' },
                        { text: 'PERMISSIONÁRIO', fontSize: 8, alignment: 'center' }
                    ]
                }
            ]
        },

        // PÁGINA 2
        { text: '', pageBreak: 'before' },
        { text: 'ANEXO ÚNICO', style: 'title', alignment: 'center', margin: [0, 15, 0, 20] },
        { text: 'TERMOS E CONDIÇÕES DE USO DO EQUIPAMENTO E CONECTIVIDADE', style: 'subheader', alignment: 'center', margin: [0, 15, 0, 20] },

        { text: 'OBRIGAÇÕES DO ESTUDANTE E/OU RESPONSÁVEL:', style: 'sectionHeader', fontSize: 9 },
        { text: 'O equipamento (TABLET) e a conectividade a ele vinculada (quando aplicável) são para uso exclusivo e individual do(a) estudante como instrumento/recurso de apoio às suas atividades pedagógicas, sendo deveres diários do(a) estudante seguir as orientações abaixo:', style: 'body', margin: [0, 5] },
        {
            ul: [
                'Acessar a plataforma EducaRecife, por meio de aplicativo, principalmente nos horários estabelecidos no cronograma de aulas digitais;',
                'Realizar as atividades e pesquisas propostas pelos professores.'
            ],
            style: 'body', margin: [20, 2, 0, 5]
        },

        { text: 'São obrigações do(a) estudante e/ou responsável zelar pelo integral cumprimento de todas as orientações descritas acima, sob pena de imediato bloqueio e recolhimento do equipamento, sendo vedado também o uso do mesmo nas seguintes situações:', style: 'body', margin: [0, 5] },
        {
            ul: [
                'Utilizar o equipamento ou a conectividade para espalhar notícias falsas ou proibidas;',
                'Utilizar o equipamento ou a conectividade para praticar atos ilícitos;',
                'Divulgar conteúdo sem autorização dos autores;',
                'Acessar e divulgar conteúdo impróprio para sua idade;',
                'Emprestar, ceder ou vender o equipamento e seus respectivos acessórios.'
            ],
            style: 'body', margin: [20, 2, 0, 5]
        },

        { text: 'São ainda obrigações do(a) estudante e/ou responsável, conservar o equipamento em bom estado, zelar pelo uso apenas educacional e, em casos de extravio, furto ou roubo, providenciar o Boletim de Ocorrência e comunicar formalmente o fato ao órgão responsável, por meio do e-mail programaeducarecife@educ.rec.br, para que seja efetuado o bloqueio. Quaisquer dúvidas poderão ser dirimidas pelo telefone 0800 200 6565.', style: 'body', margin: [0, 5, 0, 15] },

        { text: 'DEVOLUÇÃO DOS EQUIPAMENTOS:', style: 'sectionHeader', fontSize: 9, margin: [0, 10, 0, 5] },
        { text: 'O equipamento e seus acessórios deverão ser devolvidos pelo estudante e/ou responsável no caso de saída/cancelamento de matrícula do estudante, ou no caso de transferência para uma escola que não pertença à rede municipal do Recife.', style: 'body', margin: [0, 0, 0, 15] },

        { text: 'OUTRAS DISPOSIÇÕES:', style: 'sectionHeader', fontSize: 9, margin: [0, 10, 0, 5] },
        { text: 'Ressaltamos ainda que a interação do estudante durante as aulas será objeto de acompanhamento pedagógico. Sendo assim, o responsável autoriza que fotos e/ou filmagens sejam feitas durante as atividades realizadas e declara estar ciente de que as imagens serão usadas apenas para fins pedagógicos e não comerciais.', style: 'body', margin: [0, 5] },
        { text: 'Ratificamos que o equipamento (tablet) é de uso exclusivo do(a) estudante e poderá ser monitorado a distância. Qualquer descumprimento dos termos e condições de uso acarretará no recolhimento do equipamento ou sua completa desativação remotamente. Todos os acessos e consultas efetuados através do equipamento ou da conectividade disponibilizada poderão ser registrados pela SEDUC e estarão sujeitos ao seu monitoramento.', style: 'body', margin: [0, 5] },
        { text: 'O usuário autoriza expressamente a SEDUC a coletar, usar e armazenar seus dados para fins de monitoramento das atividades pedagógicas desenvolvidas pelo estudante e do uso adequado do equipamento. Os dados pessoais do estudante serão excluídos definitivamente mediante requerimento do próprio usuário ou ao término da relação entre as partes, obedecido o prazo de guarda estabelecido em lei e observadas as exceções previstas no art. 16 da Lei Federal nº 13.709/2018.', style: 'body', margin: [0, 5] },
        { text: 'Salientamos que a transferência, venda ou cessão para terceiros do equipamento ou da conectividade de uso exclusivo do estudante é ilegal e os responsáveis estarão sujeitos às sanções civis e penais cabíveis.', style: 'body', margin: [0, 5] },
        { text: 'A Secretaria de Educação do Recife não será responsável por quaisquer eventuais danos ou indenizações a terceiros causados em decorrência do uso, direto ou indireto, do equipamento ou conectividade objeto deste termo, cabendo ao responsável pelo(a) estudante responder por danos causados pelo uso em desacordo com a finalidade educativa.', style: 'body', margin: [0, 5] },
        { text: 'O recolhimento do equipamento e/ou a desativação do seu acesso, a qualquer tempo, não gera direito a qualquer indenização ao estudante ou seu responsável por parte da Secretaria de Educação.', style: 'body', margin: [0, 5] },

        // ASSINATURAS P2
        { text: 'Recebido em ____/____/______', alignment: 'center', margin: [0, 40, 0, 20], fontSize: 10 },
        {
            stack: [
                { text: '_________________________________________________', alignment: 'center' },
                { text: 'Responsável pelo Recebimento', bold: true, alignment: 'center', margin: [0, 2, 0, 30], fontSize: 9 },
                { text: 'Nome: ____________________________________', width: 'auto', fontSize: 9, margin: [0, 0, 0, 25] },
                { text: 'CPF: __________________________', width: 'auto', fontSize: 9 }
            ],
            alignment: 'center'
        }
      ],
      styles: {
        title: { fontSize: 12, bold: true, decoration: 'underline' },
        subheader: { fontSize: 10, bold: true },
        sectionHeader: { fontSize: 10, bold: true, decoration: 'underline' },
        th: { bold: true, fontSize: 9, fillColor: '#e0e0e0', color: 'black' },
        body: { fontSize: 11, alignment: 'justify', lineHeight: 1.3 }, 
        clause: { fontSize: 11, alignment: 'justify', margin: [5, 5, 0, 5], lineHeight: 1.3 } 
      },
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const safeName = data.student_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      res.header('Content-Type', 'application/pdf');
      res.attachment(`termo_${safeName}.pdf`);
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();

    await logAudit(req.user.id, 'generate_report', 'individual_term', item_id, null, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar termo:', error);
    res.status(500).json({ message: 'Erro ao gerar PDF.' });
  }
});

// 2. Remover Item do Lote (CORREÇÃO V5 - DEVOLUÇÃO AO ESTOQUE)
app.delete('/api/delivery-batch-items/:id', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Descobre qual é o ativo para liberá-lo
    const itemRes = await client.query('SELECT asset_id FROM delivery_batch_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) throw new Error('Item não encontrado.');
    const { asset_id } = itemRes.rows[0];

    // Busca ID do Almoxarifado
    const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
    const warehouseId = whRes.rows[0]?.id || null;

    // 2. Remove a associação
    await client.query('DELETE FROM delivery_batch_items WHERE id = $1', [id]);

    // 3. Libera o tablet (volta para 'available' e para o Almoxarifado)
    await client.query("UPDATE assets SET status = 'available', current_unit_id = $1 WHERE id = $2", [warehouseId, asset_id]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Associação removida. Tablet liberado.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao remover item:', error);
    res.status(500).json({ message: 'Erro ao remover item.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// ORDEM DE COLETA DINÂMICA (CORRIGIDA E BLINDADA)
// =====================================================================
app.post('/api/reports/blank-collection-order', authenticateToken, async (req, res) => {
    try {
        // Recebe os dados e aplica valores padrão vazios ('') para evitar crash do PDF
        const { 
            school_name, 
            technician_name, 
            collection_reason, 
            estimated_quantity, 
            or_code 
        } = req.body;

        const safeSchoolName = school_name || '_______________________';
        const safeTechName = technician_name || '_______________________';
        const safeReason = collection_reason || 'Recolhimento / Devolução';
        const safeCode = or_code ? `CÓDIGO RASTREADOR: ${or_code}` : '';

        const totalLines = estimated_quantity ? parseInt(estimated_quantity) : 20;

        // 1. Logo
        const logoPath = path.join(__dirname, 'assets/brasao-recife.png'); // Ajuste se necessário '../assets'
        let logoBase64 = null;
        if (fs.existsSync(logoPath)) {
             try { logoBase64 = fs.readFileSync(logoPath, 'base64'); } catch (e) {}
        }

        // 2. Geração Dinâmica de Linhas
        const emptyRows = [];
        for (let i = 1; i <= totalLines; i++) {
            emptyRows.push([
                { text: i.toString(), style: 'cell', alignment: 'center', color: '#999' },
                { text: ' ', style: 'cell', height: 18 },
                { text: ' ', style: 'cell', height: 18 },
                { text: ' ', style: 'cell', height: 18 },
                { text: ' ', style: 'cell', height: 18 }
            ]);
        }

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [30, 110, 30, 60],
            
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 50, margin: [0, 5, 10, 0] } : { text: '', width: 50 },
                    { 
                        stack: [ 
                            { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, 
                            { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 }, 
                            { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 } 
                        ], 
                        alignment: 'center', margin: [0, 10, 50, 0] 
                    }
                ]
            },

            footer: function(currentPage, pageCount) { 
                return { 
                    text: `Página ${currentPage} de ${pageCount}`, 
                    alignment: 'center', 
                    fontSize: 8, 
                    margin: [0, 0, 0, 10] 
                };
            },

            content: [
                { text: 'ORDEM DE COLETA E TRANSFERÊNCIA DE CUSTÓDIA', style: 'header', alignment: 'center', margin: [0, 0, 0, 5] },
                
                // Exibe o código da OR em vermelho e destaque
                { text: safeCode, style: 'codeHighlight', alignment: 'center', margin: [0, 0, 0, 15] },

                // Bloco de Informações
                {
                    style: 'infoTable',
                    table: {
                        widths: ['15%', '35%', '15%', '35%'],
                        body: [
                            [
                                { text: 'UNIDADE:', bold: true, style: 'label' },
                                { text: safeSchoolName, style: 'value' },
                                { text: 'DATA:', bold: true, style: 'label' },
                                { text: new Date().toLocaleDateString('pt-BR'), style: 'value' }
                            ],
                            [
                                { text: 'TÉCNICO:', bold: true, style: 'label' },
                                { text: safeTechName, style: 'value' },
                                { text: 'MOTIVO:', bold: true, style: 'label' },
                                { text: safeReason, style: 'value' }
                            ]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 15]
                },

                { text: 'RELAÇÃO DE EQUIPAMENTOS RECOLHIDOS:', fontSize: 10, bold: true, margin: [0, 0, 0, 5] },

                // Tabela Pautada
                {
                    table: {
                        headerRows: 1,
                        widths: [25, '*', 80, 80, 80],
                        body: [
                            [
                                { text: '#', style: 'th' },
                                { text: 'TIPO / DESCRIÇÃO', style: 'th' },
                                { text: 'PATRIMÔNIO', style: 'th' },
                                { text: 'Nº SÉRIE', style: 'th' },
                                { text: 'ESTADO / OBS', style: 'th' }
                            ],
                            ...emptyRows
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 0.5; },
                        vLineWidth: function (i, node) { return 0.5; },
                        hLineColor: function (i, node) { return '#aaa'; },
                        vLineColor: function (i, node) { return '#aaa'; },
                    },
                    margin: [0, 0, 0, 15]
                },

                // Termo de Transferência (Mantido junto para não quebrar)
                {
                    unbreakable: true,
                    stack: [
                        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5 }] },
                        { text: 'TERMO DE TRANSFERÊNCIA DE RESPONSABILIDADE', style: 'sectionHeader', margin: [0, 10, 0, 5] },
                        
                        { 
                            text: [
                                'Pelo presente instrumento, a Unidade Escolar acima identificada realiza a ',
                                { text: 'ENTREGA FÍSICA', bold: true },
                                ' e a ',
                                { text: 'TRANSFERÊNCIA DA CUSTÓDIA', bold: true },
                                ' dos bens relacionados neste documento à equipe da Gerência de Infraestrutura de Tecnologia (GIT).\n\n',
                                'A partir da assinatura deste termo pelo técnico responsável pelo recolhimento, cessa a responsabilidade de guarda do Gestor Escolar sobre os itens listados, que passam a estar sob responsabilidade da Secretaria Executiva de Projetos, Tecnologia e Inovação para triagem, manutenção ou descarte.'
                            ],
                            fontSize: 10,
                            alignment: 'justify',
                            margin: [0, 0, 0, 20]
                        },

                        // Assinaturas
                        {
                            columns: [
                                {
                                    stack: [
                                        { text: '_______________________________________', alignment: 'center' },
                                        { text: 'Gestor(a) da Unidade Escolar', bold: true, fontSize: 9, alignment: 'center' },
                                        { text: '(Entreguei os itens)', fontSize: 8, italics: true, alignment: 'center' }
                                    ]
                                },
                                {
                                    stack: [
                                        { text: '_______________________________________', alignment: 'center' },
                                        { text: safeTechName, bold: true, fontSize: 9, alignment: 'center' },
                                        { text: '(Recebi e conferi a contagem)', fontSize: 8, italics: true, alignment: 'center' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],

            styles: {
                header: { fontSize: 14, bold: true, decoration: 'underline' },
                codeHighlight: { fontSize: 12, bold: true, color: '#d32f2f' }, // Estilo novo para o código
                sectionHeader: { fontSize: 11, bold: true, alignment: 'center' },
                th: { fontSize: 8, bold: true, fillColor: '#eeeeee', alignment: 'center', margin: [0, 4, 0, 4] },
                cell: { fontSize: 10, margin: [0, 2, 0, 2] },
                label: { fontSize: 9, fillColor: '#f0f0f0', margin: [2, 2, 2, 2] },
                value: { fontSize: 9, margin: [2, 2, 2, 2] }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => {
            res.header('Content-Type', 'application/pdf');
            res.send(Buffer.concat(chunks));
        });
        pdfDoc.end();

    } catch (error) {
        console.error('Erro ao gerar guia de coleta:', error);
        res.status(500).json({ message: 'Erro ao gerar PDF: ' + error.message });
    }
});



// =====================================================================
// RELATÓRIO: TODOS OS TERMOS DO LOTE (IMPRESSÃO EM MASSA)
// =====================================================================
app.get('/api/reports/delivery-batch/:id/all-terms', authenticateToken, async (req, res) => {
  const { id: batch_id } = req.params;
  const ipAddress = req.ip;

  try {
    // 1. Buscar TODOS os itens do lote (Ordenados alfabeticamente)
    const result = await pool.query(`
      SELECT 
        s.student_name, 
        s.student_registration, 
        s.education_year,
        a.patrimonio_number, 
        a.serial_number,
        a.imei,
        a.brand,
        a.model,
        a.sim_card_number,
        u.name as school_name
      FROM delivery_batch_items dbi
      JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
      JOIN assets a ON dbi.asset_id = a.id
      JOIN delivery_batches db ON dbi.batch_id = db.id
      JOIN units u ON db.school_unit_id = u.id
      WHERE dbi.batch_id = $1
      ORDER BY s.student_name ASC`, [batch_id]);
    
    if (result.rows.length === 0) return res.status(404).json({ message: 'Lote vazio ou não encontrado.' });
    const items = result.rows;

    // 2. Carregar Logo
    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath, 'base64');
    }

    // 3. Função Geradora de Conteúdo (Cria as 2 páginas para UM aluno)
    const generateStudentTerm = (data) => {
        return [
            // --- PÁGINA 1: TERMO ---
            { text: 'TERMO DE PERMISSÃO DE USO', style: 'title', alignment: 'center', margin: [0, 10, 0, 20] },

            // Preâmbulo
            {
                text: [
                    { text: 'O MUNICÍPIO DO RECIFE', bold: true },
                    ', entidade de direito público interno, sediado no Cais do Apolo, nº 925, bairro do Recife, nesta cidade, inscrito no CNPJ sob o nº 10.565.000/0001-92, doravante denominado simplesmente ',
                    { text: 'PERMITENTE', bold: true },
                    ', e do outro lado, o estudante abaixo qualificado (',
                    { text: data.student_name, bold: true, decoration: 'underline' },
                    '), doravante denominado(a) simplesmente ',
                    { text: 'PERMISSIONÁRIO(A)', bold: true },
                    ', neste ato representado(a) por (Nome do pai ou responsável pelo estudante) ______________________________________________________________________, portador do RG __________________________, inscrito sob o CPF nº _________________________, residentes e domiciliados no endereço ________________________________________________________________________________ Cidade do Recife, Pernambuco, CEP ____________________, telefone (____) _______________________, celebram o presente Termo de Permissão de Uso com observância estrita de suas cláusulas...'
                ],
                style: 'body', alignment: 'justify', margin: [0, 10, 0, 15]
            },

            // Tabela Aluno
            { text: 'DADOS DO ESTUDANTE (PERMISSIONÁRIO)', style: 'sectionHeader', margin: [0, 2, 0, 2] },
            {
                table: {
                    widths: ['*', 100, 80, '*'],
                    body: [
                        [{ text: 'NOME DO ESTUDANTE', style: 'th' }, { text: 'MATRÍCULA', style: 'th' }, { text: 'ANO', style: 'th' }, { text: 'UNIDADE', style: 'th' }],
                        [
                            { text: data.student_name, fontSize: 9, bold: true },
                            { text: data.student_registration, fontSize: 9, alignment: 'center' },
                            { text: data.education_year || '-', fontSize: 9, alignment: 'center' },
                            { text: data.school_name, fontSize: 9 }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines', margin: [0, 0, 0, 10]
            },

            // Tabela Equipamento (CONSTRUÇÃO DINÂMICA)
            { text: 'DESCRIÇÃO DOS EQUIPAMENTOS CEDIDOS', style: 'sectionHeader', margin: [0, 2, 0, 2] },
            {
                table: {
                    widths: [30, '*', 150],
                    body: (() => {
                        const rows = [
                            [{ text: 'QTD', style: 'th' }, { text: 'EQUIPAMENTO / DESCRIÇÃO', style: 'th' }, { text: 'IDENTIFICADOR', style: 'th' }]
                        ];
                        
                        // Validação Blindada: Forçamos FALSE para OMITIR a impressão do chip no lote
                        const validChip = false;

                        // SÓ ADICIONA A LINHA DE CHIP SE ELE REALMENTE EXISTIR NO BANCO
                        if (validChip) {
                            rows.push([
                                { text: '1', alignment: 'center', fontSize: 9, margin: [0, 5] },
                                { text: 'LINHA CHIP DE DADOS COM PACOTE DE 20GB/MENSAL - OPERADORA CLARO', fontSize: 9, margin: [0, 5] },
                                { text: `Nº DA LINHA: ${data.sim_card_number}`, fontSize: 9, bold: true, margin: [0, 5] }
                            ]);
                        }

                        // ADICIONA A LINHA DO TABLET
                        let tabletIds = `TOMBAMENTO: ${data.patrimonio_number || 'S/N'}`;
                        if (data.imei && String(data.imei).trim() !== '' && String(data.imei).toUpperCase() !== 'N/A') {
                            tabletIds += `\nIMEI: ${data.imei}`;
                        } else if (data.serial_number && String(data.serial_number).trim() !== '' && String(data.serial_number).toUpperCase() !== 'N/A') {
                            tabletIds += `\nSÉRIE: ${data.serial_number}`;
                        }

                        rows.push([
                            { text: '1', alignment: 'center', fontSize: 9, margin: [0, 5] },
                            { text: `TABLET ${data.brand || ''} ${data.model || ''}, CARREGADOR E CAPA`.trim(), fontSize: 9, margin: [0, 5] },
                            { text: tabletIds, fontSize: 9, margin: [0, 5] }
                        ]);

                        return rows;
                    })()
                },
                layout: 'lightHorizontalLines', margin: [0, 0, 0, 10]
            },

            // Cláusulas (Texto Integral)
            { text: [{ text: 'CLÁUSULA PRIMEIRA – DO OBJETO – ', bold: true }, 'O objeto do presente contrato é permissão de uso, a título gratuito, dos equipamentos discriminados na tabela acima, tudo de propriedade do PERMITENTE para uso exclusivo do (a) PERMISSIONÁRIO (A).'], style: 'clause' },
            { text: [{ text: 'PARÁGRAFO PRIMEIRO – ', bold: true }, 'O PERMISSIONÁRIO (A) declara que recebeu, na data da assinatura deste ato, os equipamentos, objeto deste contrato, e seus acessórios em perfeito estado de conservação e funcionamento.'], style: 'clause' },
            { text: [{ text: 'PARÁGRAFO SEGUNDO – ', bold: true }, 'Os equipamentos objeto desta permissão de uso destinam-se, exclusivamente, ao uso individual do (a) PERMISSIONÁRIO (A) dentro e fora do ambiente escolar, como material de apoio pedagógico do (a) estudante-PERMISSIONÁRIO, sendo vedada a sua utilização em destinação diversa da estabelecida neste instrumento.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA SEGUNDA – DO PRAZO – ', bold: true }, 'O prazo da presente permissão é de 6 (seis) anos, contados a partir da data de sua assinatura.'], style: 'clause' },
            { text: [{ text: 'PARÁGRAFO ÚNICO – ', bold: true }, 'Na hipótese de reprovação do (a) PERMISSIONÁRIO (A) será admitida prorrogação do prazo contratual, uma única vez, pelo novo interregno faltante para conclusão do Ensino Fundamental, condicionado à realização da nova matrícula para a mesma série em que se deu a reprovação, dentro dos prazos regulares divulgados pela Secretaria de Educação.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO (A) PERMISSIONÁRIO (A) – ', bold: true }, 'São obrigações do (a) PERMISSIONÁRIO (A): a) conservar, como se sua própria fora, a coisa emprestada nos termos da lei civil; b) não utilizar os equipamentos cedidos em destinação diversa da estabelecida neste contrato; c) não ceder ou transferir, no todo ou em parte, o presente contrato; d) arcar com todas as despesas e custos decorrentes do uso normal do equipamento objeto deste contrato, não podendo jamais recobrar do PERMITENTE as despesas feitas com o uso e gozo da coisa emprestada; e) devolver o equipamento ao PERMITENTE, em bom estado de uso e conservação, quando do término do prazo de vigência do contrato, bem como nas hipóteses de rescisão unilateral e de impossibilidade de prorrogação do prazo contratual; f) observar e cumprir os demais termos e condições de uso contidos no Anexo Único ao presente instrumento, que são parte integrante do presente termo de permissão.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA QUARTA – DA RESPONSABILIDADE PERANTE TERCEIROS – ', bold: true }, 'O PERMITENTE não será responsável por quaisquer e eventuais danos ou indenizações a terceiros causados por ato do (a) PERMISSIONÁRIO (A) em decorrência do uso, direto ou indireto, do equipamento objeto deste ajuste, cabendo ainda ao PERMISSIONÁRIO responder por perdas e danos causados pelo uso da coisa emprestada em desacordo com a finalidade prevista na CLÁUSULA PRIMEIRA.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA QUINTA – DA DEVOLUÇÃO DO BEM – ', bold: true }, 'Terminado o prazo de vigência contratual, bem como nas hipóteses de rescisão unilateral do contrato e de impossibilidade de prorrogação no prazo contratual, o (a) PERMISSIONÁRIO (A) se obriga a restituir o equipamento que lhe foi cedido em bom estado de uso e conservação, entregando-o à pessoa encarregada da gestão da unidade escolar.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA SEXTA – DA RESCISÃO DO CONTRATO - ', bold: true }, 'Constitui causa para rescisão unilateral do contrato: a) a não realização, na vigência do contrato, de matrícula escolar, dentro dos prazos regulares divulgados pela SECRETARIA DE EDUCAÇÃO, em unidade de ensino da rede pública municipal de educação; b) a reprovação por falta, na vigência do contrato; c) a ausência injustificada do aluno em sala de aula, por período superior a 30 (trinta) dias, comprovadas a partir das anotações constantes do Diário de Classe.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA SÉTIMA– DAS SANÇÕES – ', bold: true }, 'A falta de devolução do bem objeto deste ajuste, bem como sua inutilização sujeitará o (a) PERMISSIONÁRIO (A) às sanções e medidas cabíveis previstas na legislação de regência.'], style: 'clause' },
            { text: [{ text: 'CLÁUSULA OITAVA – DO FORO – ', bold: true }, 'É competente o foro da Comarca do Recife, Capital do Estado de Pernambuco, para dirimir qualquer divergência ou dúvida fundada no presente instrumento que não possa ser resolvido pela via administrativa, renunciando as partes a qualquer outro por mais privilegiado que seja.'], style: 'clause' },

            { text: 'É por estarem justas e contratadas, as partes na presença das testemunhas abaixo, assinam o presente instrumento, em 02 (duas) vias de igual teor e forma.', margin: [0, 5, 0, 10], fontSize: 9 },

            // Assinaturas P1
            { text: `Recife, _____ de ___________________ de ${new Date().getFullYear()}.`, alignment: 'center', margin: [0, 80, 0, 40], fontSize: 10 },
            {
                columns: [
                    { stack: [{ text: '_______________________________________', alignment: 'center' }, { text: 'REPRESENTANTE DA SECRETARIA', bold: true, fontSize: 7, alignment: 'center' }, { text: '(Carimbar com dados do gestor)', fontSize: 7, italics: true, alignment: 'center' }] },
                    { stack: [{ text: '_______________________________________', alignment: 'center' }, { text: 'REPRESENTANTE DO ESTUDANTE', bold: true, fontSize: 7, alignment: 'center' }, { text: 'PERMISSIONÁRIO', fontSize: 7, alignment: 'center' }] }
                ]
            },

            // --- PÁGINA 2: ANEXO ---
            { text: '', pageBreak: 'before' },
            { text: 'ANEXO ÚNICO', style: 'title', alignment: 'center', margin: [0, 10, 0, 15] },
            { text: 'TERMOS E CONDIÇÕES DE USO DO EQUIPAMENTO E CONECTIVIDADE', style: 'subheader', alignment: 'center', margin: [0, 10, 0, 20] },

            { text: 'OBRIGAÇÕES DO ESTUDANTE E/OU RESPONSÁVEL:', style: 'sectionHeader', fontSize: 9 },
            { text: 'O equipamento (TABLET) e a conectividade a ele vinculada (quando aplicável) são para uso exclusivo e individual do(a) estudante como instrumento/recurso de apoio às suas atividades pedagógicas, sendo deveres diários do(a) estudante seguir as orientações abaixo:', style: 'body', margin: [0, 5] },
            { ul: ['Acessar a plataforma EducaRecife, por meio de aplicativo, principalmente nos horários estabelecidos no cronograma de aulas digitais;', 'Realizar as atividades e pesquisas propostas pelos professores.'], style: 'body', margin: [20, 2, 0, 5] },
            { text: 'São obrigações do(a) estudante e/ou responsável zelar pelo integral cumprimento de todas as orientações descritas acima, sob pena de imediato bloqueio e recolhimento do equipamento, sendo vedado também o uso do mesmo nas seguintes situações:', style: 'body', margin: [0, 5] },
            { ul: ['Utilizar o equipamento ou a conectividade para espalhar notícias falsas ou proibidas;', 'Utilizar o equipamento ou a conectividade para praticar atos ilícitos;', 'Divulgar conteúdo sem autorização dos autores;', 'Acessar e divulgar conteúdo impróprio para sua idade;', 'Emprestar, ceder ou vender o equipamento e seus respectivos acessórios.'], style: 'body', margin: [20, 2, 0, 5] },
            { text: 'São ainda obrigações do(a) estudante e/ou responsável, conservar o equipamento em bom estado, zelar pelo uso apenas educacional e, em casos de extravio, furto ou roubo, providenciar o Boletim de Ocorrência e comunicar formalmente o fato ao órgão responsável, por meio do e-mail programaeducarecife@educ.rec.br, para que seja efetuado o bloqueio. Quaisquer dúvidas poderão ser dirimidas pelo telefone 0800 200 6565.', style: 'body', margin: [0, 5, 0, 15] },

            { text: 'DEVOLUÇÃO DOS EQUIPAMENTOS:', style: 'sectionHeader', fontSize: 9, margin: [0, 10, 0, 5] },
            { text: 'O equipamento e seus acessórios deverão ser devolvidos pelo estudante e/ou responsável no caso de saída/cancelamento de matrícula do estudante, ou no caso de transferência para uma escola que não pertença à rede municipal do Recife.', style: 'body', margin: [0, 0, 0, 15] },

            { text: 'OUTRAS DISPOSIÇÕES:', style: 'sectionHeader', fontSize: 9, margin: [0, 10, 0, 5] },
            { text: 'Ressaltamos ainda que a interação do estudante durante as aulas será objeto de acompanhamento pedagógico. Sendo assim, o responsável autoriza que fotos e/ou filmagens sejam feitas durante as atividades realizadas e declara estar ciente de que as imagens serão usadas apenas para fins pedagógicos e não comerciais.', style: 'body', margin: [0, 5] },
            { text: 'Ratificamos que o equipamento (tablet) é de uso exclusivo do(a) estudante e poderá ser monitorado a distância. Qualquer descumprimento dos termos e condições de uso acarretará no recolhimento do equipamento ou sua completa desativação remotamente. Todos os acessos e consultas efetuados através do equipamento ou da conectividade disponibilizada poderão ser registrados pela SEDUC e estarão sujeitos ao seu monitoramento.', style: 'body', margin: [0, 5] },
            { text: 'O usuário autoriza expressamente a SEDUC a coletar, usar e armazenar seus dados para fins de monitoramento das atividades pedagógicas desenvolvidas pelo estudante e do uso adequado do equipamento. Os dados pessoais do estudante serão excluídos definitivamente mediante requerimento do próprio usuário ou ao término da relação entre as partes, obedecido o prazo de guarda estabelecido em lei e observadas as exceções previstas no art. 16 da Lei Federal nº 13.709/2018.', style: 'body', margin: [0, 5] },
            { text: 'Salientamos que a transferência, venda ou cessão para terceiros do equipamento ou da conectividade de uso exclusivo do estudante é ilegal e os responsáveis estarão sujeitos às sanções civis e penais cabíveis.', style: 'body', margin: [0, 5] },
            { text: 'A Secretaria de Educação do Recife não será responsável por quaisquer eventuais danos ou indenizações a terceiros causados em decorrência do uso, direto ou indireto, do equipamento ou conectividade objeto deste termo, cabendo ao responsável pelo(a) estudante responder por danos causados pelo uso em desacordo com a finalidade educativa.', style: 'body', margin: [0, 5] },
            { text: 'O recolhimento do equipamento e/ou a desativação do seu acesso, a qualquer tempo, não gera direito a qualquer indenização ao estudante ou seu responsável por parte da Secretaria de Educação.', style: 'body', margin: [0, 5] },

            // Assinatura P2
            { text: 'Recebido em ____/____/______', alignment: 'center', margin: [0, 20, 0, 30], fontSize: 9 },
            {
            stack: [
                { text: '_________________________________________________', alignment: 'center' },
                { text: 'Responsável pelo Recebimento', bold: true, alignment: 'center', margin: [0, 5, 0, 30],fontSize: 9 },
                { text: 'Nome: ____________________________________', width: 'auto', fontSize: 9, margin: [0, 10, 20, 30] },
                { text: 'CPF: __________________________', width: 'auto', fontSize: 9 }
            ]
        }
        ];
    };

    // 4. Montar o PDF Gigante (Concatenando alunos)
    let fullContent = [];
    items.forEach((item, index) => {
        // Adiciona quebra de página antes de cada NOVO aluno (exceto o primeiro, que já começa na pág 1)
        if (index > 0) {
            fullContent.push({ text: '', pageBreak: 'before' });
        }
        // Gera o conteúdo (Pág 1 e 2) para este aluno
        fullContent = fullContent.concat(generateStudentTerm(item));
    });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [30, 100, 30, 30], // Margem exata do termo individual
      
      // Cabeçalho Fixo
      header: {
        margin: [40, 20, 40, 0],
        columns: [
            { image: logoBase64 ? `data:image/png;base64,${logoBase64}` : '', width: 60, margin: [0, 5, 20, 0] },
            { stack: [{ text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 }, { text: 'SECRETARIA EXECUTIVA DE PROJETOS, TECNOLOGIA E INOVAÇÃO', fontSize: 8 }, { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 8 }, { text: 'DIVISÃO DE INFRAESTRUTURA EM TECNOLOGIA', fontSize: 8 }], alignment: 'center', margin: [0, 5, 60, 0] }
        ]
      },

      // Rodapé Fixo
      footer: {
        margin: [40, 0, 40, 20],
        stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] },
            { text: 'Gerência de Infraestrutura de Tecnologia', bold: true, alignment: 'center', margin: [0, 5, 0, 0], fontSize: 8 },
            { text: 'Av. Oliveira Lima, 824 – Soledade | CEP: 50050-390 | FONE: 3355-5471', alignment: 'center', fontSize: 8 }
        ]
      },

      content: fullContent, // O conteúdo acumulado de todos os alunos

      styles: {
        title: { fontSize: 12, bold: true, decoration: 'underline' },
        subheader: { fontSize: 10, bold: true },
        sectionHeader: { fontSize: 9, bold: true, decoration: 'underline' },
        th: { bold: true, fontSize: 8, fillColor: '#e0e0e0', color: 'black', alignment: 'center' },
        body: { fontSize: 9, alignment: 'justify', lineHeight: 1.5 },
        clause: { fontSize: 8, alignment: 'justify', margin: [0, 5, 0, 4], lineHeight: 1.3 }
      },
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf');
      res.attachment(`termos_lote_${batch_id}.pdf`);
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();

    await logAudit(req.user.id, 'generate_report', 'batch_all_terms', batch_id, { count: items.length }, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar termos em massa:', error);
    res.status(500).json({ message: 'Erro ao gerar PDF.' });
  }
});

// 2. Rota para Listar Lotes de Entrega (ATUALIZADA COM RPA)
app.get('/api/delivery-batches', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  try {
    const query = `
      SELECT
        db.id,
        db.school_unit_id,
        db.status,
        db.name,
        db.scheduled_delivery_date,
        db.creation_date,
        db.delivery_confirmation_date,
        u.name AS school_unit_name,
        u.rpa, -- <<< CAMPO ADICIONADO AQUI
        usr.full_name AS created_by_user_name,
        (SELECT COUNT(*) FROM delivery_batch_items WHERE batch_id = db.id) as total_items
      FROM delivery_batches db
      JOIN units u ON db.school_unit_id = u.id
      JOIN users usr ON db.created_by_user_id = usr.id
      ORDER BY db.creation_date DESC
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar lotes de entrega:', error);
    await logAudit(req.user.id, 'list_delivery_batches_error', 'delivery_batches', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =====================================================================
// CRIAR LOTE DE ENTREGA (COM VALIDAÇÃO DE DUPLICIDADE E DATA)
// =====================================================================
app.post('/api/delivery-batches', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { school_unit_id, batch_name, scheduled_date } = req.body;
  const created_by_user_id = req.user.id;
  const ipAddress = req.ip;

  // VALIDAÇÃO 1: Data Obrigatória
  if (!school_unit_id || !batch_name || !scheduled_date) {
    return res.status(400).json({ message: 'Unidade, Nome do Lote e Data de Previsão são obrigatórios.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // VALIDAÇÃO 2: Verificar se já existe lote em planejamento
    const checkDuplicate = await client.query(
        `SELECT id, name FROM delivery_batches 
         WHERE school_unit_id = $1 AND status = 'Em Planejamento'`,
        [school_unit_id]
    );

    if (checkDuplicate.rows.length > 0) {
        const existingBatch = checkDuplicate.rows[0];
        throw new Error(`Esta unidade já possui o lote "${existingBatch.name}" em planejamento. Utilize a função de "Editar Lote" ou "Lote Complementar".`);
    }

    const newBatchResult = await client.query(
      `INSERT INTO delivery_batches (school_unit_id, created_by_user_id, status, name, scheduled_delivery_date, creation_date)
       VALUES ($1, $2, 'Em Planejamento', $3, $4, NOW()) RETURNING *`,
      [school_unit_id, created_by_user_id, batch_name, scheduled_date]
    );
    const newBatch = newBatchResult.rows[0];
    
    await client.query('COMMIT');
    await logAudit(req.user.id, 'create_delivery_batch', 'delivery_batches', newBatch.id, { name: batch_name, school_unit_id, scheduled_date }, ipAddress);
    
    res.status(201).json(newBatch);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar lote:', error);
    // Retorna 409 (Conflict) se for duplicidade, ou 500 para outros erros
    const status = error.message.includes('já possui o lote') ? 409 : 500;
    res.status(status).json({ message: error.message || 'Erro interno.' });
  } finally {
    client.release();
  }
});

// Rota para Editar Lote (Nome e Data Prevista)
app.put('/api/delivery-batches/:id', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id } = req.params;
  const { batch_name, scheduled_date } = req.body;
  const ipAddress = req.ip;

  try {
    await pool.query(
      `UPDATE delivery_batches 
       SET name = $1, scheduled_delivery_date = $2 
       WHERE id = $3`,
      [batch_name, scheduled_date || null, id]
    );
    
    await logAudit(req.user.id, 'update_delivery_batch', 'delivery_batches', id, { batch_name, scheduled_date }, ipAddress);
    res.json({ message: 'Lote atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar lote:', error);
    res.status(500).json({ message: 'Erro ao atualizar lote.' });
  }
});

// =====================================================================
// EXCLUIR LOTE DE ENTREGA (COM LIBERAÇÃO DE ATIVOS)
// =====================================================================
app.delete('/api/delivery-batches/:id', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id: batch_id } = req.params;
  const ipAddress = req.ip;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar se o lote existe
    const batchRes = await client.query('SELECT id, name, status FROM delivery_batches WHERE id = $1', [batch_id]);
    if (batchRes.rows.length === 0) throw new Error('Lote não encontrado.');
    const batch = batchRes.rows[0];

    // >>> 2. CORREÇÃO: Buscar Almoxarifado e Liberar os Tablets para lá <<<
    const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
    const warehouseId = whRes.rows[0]?.id || null;

    await client.query(`
      UPDATE assets 
      SET status = 'available', current_unit_id = $2, updated_at = NOW()
      WHERE id IN (SELECT asset_id FROM delivery_batch_items WHERE batch_id = $1)
    `, [batch_id, warehouseId]);

    // 3. Apagar os Itens do Lote (Associações Aluno-Tablet)
    await client.query('DELETE FROM delivery_batch_items WHERE batch_id = $1', [batch_id]);

    // 4. Apagar o Lote em si
    await client.query('DELETE FROM delivery_batches WHERE id = $1', [batch_id]);

    await client.query('COMMIT');
    await logAudit(req.user.id, 'delete_delivery_batch', 'delivery_batches', batch_id, { name: batch.name }, ipAddress);

    res.status(200).json({ message: 'Lote excluído e tablets liberados com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao excluir lote:', error);
    if (error.code === '23503') {
        return res.status(400).json({ message: 'Não é possível excluir este lote pois existem recibos ou auditorias dependentes dele.' });
    }
    res.status(500).json({ message: 'Erro ao excluir lote.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// TRANSFERÊNCIA DE ALUNO ENTRE ESCOLAS
// =====================================================================
app.put('/api/tablets/students/transfer', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { student_registration, new_school_id } = req.body;
  const ipAddress = req.ip;
  const client = await pool.connect();

  if (!student_registration || !new_school_id) {
    return res.status(400).json({ message: 'Matrícula e Nova Escola são obrigatórias.' });
  }

  try {
    await client.query('BEGIN');

    // 1. Buscar o aluno
    const studentRes = await client.query(
        'SELECT id, student_name, school_unit_id FROM tablet_eligible_students WHERE student_registration = $1', 
        [student_registration]
    );

    if (studentRes.rows.length === 0) throw new Error('Aluno não encontrado.');
    const student = studentRes.rows[0];

    // 2. Verificar se está em um lote PENDENTE (Em Planejamento)
    // Se estiver, precisamos remover para liberar o tablet
    const pendingItemRes = await client.query(`
        SELECT dbi.id, dbi.asset_id 
        FROM delivery_batch_items dbi
        JOIN delivery_batches db ON dbi.batch_id = db.id
        WHERE dbi.eligible_student_id = $1 AND db.status = 'Em Planejamento'`,
        [student.id]
    );

    let messageExtra = "";

    if (pendingItemRes.rows.length > 0) {
        const item = pendingItemRes.rows[0];
        
        // Remove do lote antigo
        await client.query('DELETE FROM delivery_batch_items WHERE id = $1', [item.id]);
        
        // Libera o tablet
        await client.query("UPDATE assets SET status = 'available' WHERE id = $1", [item.asset_id]);
        
        messageExtra = " O aluno foi removido do lote de planejamento anterior e o tablet foi liberado.";
    }

    // 3. Atualizar a Escola
    await client.query(
        'UPDATE tablet_eligible_students SET school_unit_id = $1 WHERE id = $2',
        [new_school_id, student.id]
    );

    await client.query('COMMIT');
    
    await logAudit(req.user.id, 'student_transfer', 'tablet_eligible_students', student.id, { 
        old_school: student.school_unit_id, 
        new_school: new_school_id,
        removed_from_batch: pendingItemRes.rows.length > 0 
    }, ipAddress);

    res.json({ message: `Aluno transferido com sucesso.${messageExtra}` });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na transferência:', error);
    res.status(500).json({ message: error.message || 'Erro ao transferir aluno.' });
  } finally {
    client.release();
  }
});

// 4. Rota para buscar Alunos Elegíveis para um Lote
app.get('/api/tablets/eligible-students/:school_unit_id', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { school_unit_id } = req.params;
  try {
    // CORREÇÃO: A subconsulta agora filtra pelo STATUS.
    // Só exclui da lista quem tem tablet 'planejada', 'realizada' ou 'confirmed'.
    // Se o status for 'devolvido' (ou se o registro foi deletado), o aluno volta a aparecer.
    const query = `
      SELECT * FROM tablet_eligible_students
      WHERE school_unit_id = $1
      AND id NOT IN (
        SELECT eligible_student_id 
        FROM delivery_batch_items 
        WHERE delivery_status IN ('planejada', 'realizada', 'confirmed')
      )
      ORDER BY student_name ASC
    `;
    const result = await pool.query(query, [school_unit_id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar alunos elegíveis:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// 5. Rota para buscar Tablets Disponíveis
app.get('/api/tablets/available-assets', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  try {
    // Busca ativos com status 'available' E que sejam do tipo 'Tablet'
    // (Esta query assume que você cadastrou um item_type com nome 'Tablet')
    const query = `
      SELECT a.* FROM assets a
      JOIN item_types it ON a.item_type_id = it.id
      WHERE a.status = 'available'
      AND (it.name ILIKE 'Tablet' OR it.sku_code ILIKE 'TAB')
      ORDER BY a.patrimonio_number ASC
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tablets disponíveis:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// 6. Rota para Associar Aluno + Tablet a um Lote (O "Planejamento")
app.post('/api/delivery-batch-items', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { batch_id, eligible_student_id, asset_id } = req.body;
  const ipAddress = req.ip;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // 1. Insere o item no lote
    await client.query(
      `INSERT INTO delivery_batch_items (batch_id, eligible_student_id, asset_id, delivery_status)
       VALUES ($1, $2, $3, 'planejada')`,
      [batch_id, eligible_student_id, asset_id]
    );

    // 2. Atualiza o status do ativo (como no seu AppScript)
    await client.query(
      `UPDATE assets SET status = 'in_use' WHERE id = $1`,
      [asset_id]
    );

    await client.query('COMMIT');
    await logAudit(req.user.id, 'create_batch_item', 'delivery_batch_items', null, { batch_id, eligible_student_id, asset_id }, ipAddress);
    res.status(201).json({ message: 'Ativo associado ao aluno com sucesso!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao associar item ao lote:', error);
    await logAudit(req.user.id, 'create_batch_item_error', 'delivery_batch_items', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// CONFIRMAR ENTREGA DO LOTE (CORREÇÃO V5 - DEVOLUÇÃO AO ESTOQUE)
// =====================================================================
app.put('/api/delivery-batches/:id/confirm', 
  authenticateToken, 
  authorizePermission('MENU_ESCOLAR'), 
  uploadBatchReceipt.single('receiptFile'), 
  async (req, res) => {
    const { id: batch_id } = req.params;
    const { exceptions } = req.body; 
    
    const responsible_user_id = req.user.id;
    const ipAddress = req.ip;
    const client = await pool.connect();

    if (!req.file) return res.status(400).json({ message: 'É obrigatório anexar o Recibo Coletivo.' });

    try {
      await client.query('BEGIN');

      // Busca ID do Almoxarifado para Devoluções
      const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
      const warehouseId = whRes.rows[0]?.id || null;

      let exceptionsList = [];
      if (exceptions) {
          try { exceptionsList = JSON.parse(exceptions); } catch(e) {}
      }
      const exceptionsMap = new Map(exceptionsList.map(e => [parseInt(e.itemId), e.reason]));

      const batchResult = await client.query('SELECT * FROM delivery_batches WHERE id = $1', [batch_id]);
      if (batchResult.rows.length === 0) throw new Error('Lote não encontrado.');
      const batch = batchResult.rows[0];
      
      const itemsResult = await client.query(
        `SELECT id, asset_id, eligible_student_id FROM delivery_batch_items WHERE batch_id = $1`,
        [batch_id]
      );
      const items = itemsResult.rows;

      // Cria movimentação de SAÍDA (Geral)
      const movementResult = await client.query(
        `INSERT INTO asset_movements (
           movement_type, responsible_user_id, destination_unit_id, 
           delivery_status, actual_delivery_date, purpose, receipt_path
         ) VALUES (
           'exit', $1, $2, 'confirmed', CURRENT_TIMESTAMP, $3, $4
         ) RETURNING id`,
        [responsible_user_id, batch.school_unit_id, `Entrega Lote #${batch_id}`, req.file.path]
      );
      const exit_movement_id = movementResult.rows[0].id;

      let return_movement_id = null;
      if (exceptionsList.length > 0) {
          const retRes = await client.query(
            `INSERT INTO asset_movements (
               movement_type, responsible_user_id, destination_unit_id, 
               delivery_status, actual_delivery_date, purpose
             ) VALUES (
               'return', $1, $2, 'confirmed', CURRENT_TIMESTAMP, 'Devolução imediata (Entrega Parcial)'
             ) RETURNING id`,
            [responsible_user_id, warehouseId] // Devolve para o Almoxarifado
          );
          return_movement_id = retRes.rows[0].id;
      }

      for (const item of items) {
        const exceptionReason = exceptionsMap.get(item.id);

        if (exceptionReason) {
            // CASO 1: NÃO ENTREGUE (Devolução)
            await client.query(`UPDATE delivery_batch_items SET delivery_status = 'devolvido', notes = $1 WHERE id = $2`, [`Não entregue: ${exceptionReason}`, item.id]);
            
            // CORREÇÃO V5: Volta para Almoxarifado
            await client.query(`UPDATE assets SET status = 'available', current_unit_id = $1 WHERE id = $2`, [warehouseId, item.asset_id]);
            
            if (return_movement_id) {
                await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`, [return_movement_id, item.asset_id]);
            }
        } else {
            // CASO 2: ENTREGUE (Sucesso)
            await client.query(`UPDATE delivery_batch_items SET delivery_status = 'realizada', delivery_date = CURRENT_DATE WHERE id = $1`, [item.id]);
            await client.query(`UPDATE tablet_eligible_students SET delivery_movement_id = $1 WHERE id = $2`, [exit_movement_id, item.eligible_student_id]);
            await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`, [exit_movement_id, item.asset_id]);
        }
      }
      
      await client.query(
        `UPDATE delivery_batches SET status = 'Concluído', delivery_confirmation_date = CURRENT_TIMESTAMP, collective_receipt_path = $1 WHERE id = $2`,
        [req.file.path, batch_id]
      );

      await client.query('COMMIT');
      await logAudit(req.user.id, 'confirm_delivery_batch', 'delivery_batches', batch_id, { partial: exceptionsList.length > 0 }, ipAddress);
      res.status(200).json({ message: 'Entrega processada com sucesso!' });

    } catch (error) {
      await client.query('ROLLBACK');
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Erro ao confirmar:', error);
      res.status(500).json({ message: 'Erro ao confirmar.' });
    } finally {
      client.release();
    }
});

// =====================================================================
// REGISTRAR DEVOLUÇÃO / NÃO ENTREGA (Logística Reversa)
// =====================================================================
app.post('/api/delivery-batch-items/:id/return', authenticateToken, authorizePermission('ACTION_REGISTER_MOVEMENT'), async (req, res) => {
  const { id: item_id } = req.params;
  const { reason } = req.body;
  const user_id = req.user.id;
  const ipAddress = req.ip;

  if (!reason) return res.status(400).json({ message: 'O motivo da devolução é obrigatório.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Buscar dados do item
    const itemRes = await client.query(`
      SELECT dbi.asset_id, dbi.eligible_student_id, u.id as school_unit_id
      FROM delivery_batch_items dbi
      JOIN delivery_batches db ON dbi.batch_id = db.id
      JOIN units u ON db.school_unit_id = u.id
      WHERE dbi.id = $1`, [item_id]);

    if (itemRes.rows.length === 0) throw new Error('Item não encontrado.');
    const { asset_id, eligible_student_id, school_unit_id, delivery_status } = itemRes.rows[0];
      if (delivery_status === 'devolvido') {
          throw new Error('Este item já foi devolvido anteriormente.');
      }

    // 2. Atualizar o item do lote para "Devolvido"
    await client.query(
      `UPDATE delivery_batch_items 
       SET delivery_status = 'devolvido', 
           notes = COALESCE(notes, '') || ' [DEVOLVIDO: ' || $1 || ']' 
       WHERE id = $2`,
      [reason, item_id]
    );

    // 3. Atualizar o Tablet para "Disponível" (Volta para o Almoxarifado)
    const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
    const warehouseId = whRes.rows[0]?.id || null;

    await client.query(
        `UPDATE assets SET status = 'available', current_unit_id = $1, updated_at = NOW() WHERE id = $2`, 
        [warehouseId, asset_id]
    );

    // 4. Registrar Movimentação de Retorno (Histórico)
    await client.query(
      `INSERT INTO asset_movements (
         movement_type, responsible_user_id, recipient_person_id, 
         destination_unit_id, notes, delivery_status, movement_date
       ) VALUES (
         'return', $1, $2, $3, $4, 'confirmed', CURRENT_TIMESTAMP
       )`,
      [
        user_id, 
        null, // Não tem pessoa recebendo, é o estoque
        school_unit_id, // Origem (a escola)
        `Devolução de Tablet escolar. Motivo: ${reason}`
      ]
    );

    await client.query('COMMIT');
    await logAudit(user_id, 'return_delivery_item', 'delivery_batch_items', item_id, { reason }, ipAddress);

    res.json({ message: 'Devolução registrada com sucesso. Tablet disponível novamente.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na devolução:', error);
    res.status(500).json({ message: 'Erro ao registrar devolução.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// MÓDULO DE SUBSTITUIÇÃO DE TABLETS
// =====================================================================

// 1. Consultar Situação do Aluno (ATUALIZADA COM DADOS CADASTRAIS)
app.get('/api/tablets/student-status/:matricula', authenticateToken, async (req, res) => {
  const { matricula } = req.params;
  const matriculaLimpa = String(matricula).trim();

  try {
    const result = await pool.query(`
      SELECT 
        s.id as student_id,
        s.student_name, 
        s.school_unit_id,
        s.education_year,  -- <<< ADICIONADO
        s.class_name,      -- <<< ADICIONADO
        s.pcd_type,        -- <<< ADICIONADO
        u.name as school_name,
        dbi.id as item_id,
        dbi.batch_id,
        a.id as asset_id,
        a.patrimonio_number,
        a.sim_card_number,
        a.serial_number,
        dbi.delivery_status
      FROM tablet_eligible_students s
      LEFT JOIN delivery_batch_items dbi ON dbi.eligible_student_id = s.id
      LEFT JOIN assets a ON dbi.asset_id = a.id
      LEFT JOIN units u ON s.school_unit_id = u.id
      WHERE s.student_registration = $1
      ORDER BY dbi.id DESC 
      LIMIT 1`, [matriculaLimpa]);

    // Se não achar na tabela de alunos, retorna erro 404 (para o frontend liberar o cadastro manual)
    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Matrícula não encontrada.' });
    }

    // Retorna os dados (mesmo que não tenha tablet entregue ainda)
    res.json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao buscar aluno:', error);
    res.status(500).json({ message: 'Erro ao processar a consulta.' });
  }
});

// 2. Executar a Substituição (Tablet Escolar)
app.post('/api/tablets/substitute', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { 
      student_id, 
      old_item_id, 
      old_asset_id, 
      new_asset_patrimonio, 
      reason, 
      batch_id, 
      new_school_id,
      // Novos objetos de saneamento vindos do frontend
      old_asset_updates, 
      new_asset_updates 
  } = req.body;
  
  const user_id = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // -----------------------------------------------------------------------
    // PASSO 1: VALIDAR E ENCONTRAR O NOVO TABLET (PRIORIDADE ZERO)
    // Precisamos do ID dele antes de tentar atualizar o chip
    // -----------------------------------------------------------------------
    
    // Remove caracteres não numéricos para garantir busca exata
    const patLimpo = String(new_asset_patrimonio).replace(/\D/g, '');
    
    const newAssetRes = await client.query(
        `SELECT id, status FROM assets WHERE REGEXP_REPLACE(patrimonio_number, '\\D', '', 'g') = $1`, 
        [patLimpo]
    );

    if (newAssetRes.rows.length === 0) {
        throw new Error('Novo tablet não encontrado no estoque.');
    }
    
    // Se o status for diferente de available ou maintenance (caso sua regra permita), bloqueia.
    // Ajuste conforme sua regra de negócio. O padrão é 'available'.
    if (newAssetRes.rows[0].status !== 'available' && newAssetRes.rows[0].status !== 'maintenance') {
         throw new Error(`O novo tablet não está disponível (Status: ${newAssetRes.rows[0].status}).`);
    }
    
    const new_asset_id = newAssetRes.rows[0].id; // <--- AGORA TEMOS O ID!

    // -----------------------------------------------------------------------
    // PASSO 2: SANEAMENTO CADASTRAL (CHIP/IMEI)
    // Agora que temos os IDs (old e new), podemos atualizar.
    // -----------------------------------------------------------------------

    // 2.1. Atualiza Antigo (Se enviado)
    if (old_asset_updates) {
        await client.query(
            `UPDATE assets SET imei = $1, sim_card_number = $2 WHERE id = $3`,
            [
                old_asset_updates.imei || null, 
                old_asset_updates.sim_card_number || null, // Se vazio, vira NULL (extravio)
                old_asset_id
            ]
        );
    }

    // 2.2. Atualiza Novo (Se enviado)
    if (new_asset_updates) {
        await client.query(
            `UPDATE assets SET imei = $1, sim_card_number = $2 WHERE id = $3`,
            [
                new_asset_updates.imei || null,
                new_asset_updates.sim_card_number || null,
                new_asset_id // <--- USAMOS A VARIÁVEL QUE ACABAMOS DE DESCOBRIR
            ]
        );
    }

    // -----------------------------------------------------------------------
    // PASSO 3: EXECUÇÃO DA TROCA (LOGÍSTICA)
    // -----------------------------------------------------------------------

    // 3.1. Aposentar a Entrega Antiga
    await client.query(
        `UPDATE delivery_batch_items SET delivery_status = 'substituida', notes = $1 WHERE id = $2`,
        [`Substituído em ${new Date().toLocaleDateString()}. Motivo: ${reason}`, old_item_id]
    );

    // 3.2. Atualizar Status do Tablet Antigo (Vai para Manutenção)
    await client.query(
        `UPDATE assets SET status = 'maintenance', notes = COALESCE(notes, '') || '\n[SUBSTITUIÇÃO] Recolhido do aluno. Motivo: ' || $1 WHERE id = $2`,
        [reason, old_asset_id]
    );

    // 3.3. Atualizar Escola do Aluno (se houve mudança)
    if (new_school_id) {
        await client.query('UPDATE tablet_eligible_students SET school_unit_id = $1 WHERE id = $2', [new_school_id, student_id]);
    }

    // 3.4. Criar Nova Entrega (Associação do Novo Tablet)
    const newDeliverRes = await client.query(
        `INSERT INTO delivery_batch_items (batch_id, eligible_student_id, asset_id, delivery_status, delivery_date, notes)
         VALUES ($1, $2, $3, 'realizada', CURRENT_DATE, 'Entrega por substituição') RETURNING id`,
        [batch_id, student_id, new_asset_id]
    );

    // 3.5. Atualizar Status do Novo Tablet
    await client.query(`UPDATE assets SET status = 'in_use' WHERE id = $1`, [new_asset_id]);

    // 3.6. Logar na Tabela de Histórico
    await client.query(
        `INSERT INTO tablet_substitutions_log (student_registration, old_asset_patrimonio, new_asset_patrimonio, reason, created_by_user_id)
         SELECT s.student_registration, a_old.patrimonio_number, a_new.patrimonio_number, $1, $2
         FROM tablet_eligible_students s, assets a_old, assets a_new
         WHERE s.id = $3 AND a_old.id = $4 AND a_new.id = $5`,
        [reason, user_id, student_id, old_asset_id, new_asset_id]
    );

    await client.query('COMMIT');
    
    res.json({ 
        message: 'Substituição realizada com sucesso!', 
        newItemId: newDeliverRes.rows[0].id 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na substituição:', error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

// =====================================================================
// [ATUALIZADO] TROCA DE CHIP (SIM SWAP) + CORREÇÃO DE IMEI
// =====================================================================
app.put('/api/assets/:id/swap-sim', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    const { id } = req.params;
    const { new_sim_number, new_imei, reason } = req.body; // <--- Agora recebe new_imei
    const userId = req.user.id;
    const ipAddress = req.ip;

    if (!new_sim_number) {
        return res.status(400).json({ message: 'O novo número do chip é obrigatório.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Buscar o ativo para pegar o chip antigo e validar
        const assetRes = await client.query('SELECT sim_card_number, imei, notes, patrimonio_number FROM assets WHERE id = $1', [id]);
        
        if (assetRes.rows.length === 0) throw new Error('Ativo não encontrado.');
        
        const asset = assetRes.rows[0];
        const oldSim = asset.sim_card_number || 'Sem Chip';
        const oldImei = asset.imei || 'Sem IMEI';

        // 2. Montar nota de histórico
        let historyNote = `\n[TROCA DE CHIP - ${new Date().toLocaleDateString('pt-BR')}]: Substituído de [${oldSim}] para [${new_sim_number}]. Motivo: ${reason || 'N/A'}.`;
        
        // Se houve alteração de IMEI, registra no log também
        if (new_imei && new_imei !== oldImei) {
            historyNote += ` [IMEI AJUSTADO]: De ${oldImei} para ${new_imei}.`;
        }

        const newNotes = (asset.notes || '') + historyNote;

        // 3. Atualizar o Ativo (Chip e IMEI)
        await client.query(
            `UPDATE assets 
             SET sim_card_number = $1, 
                 imei = COALESCE($2, imei), -- Atualiza IMEI se enviado, senão mantém o atual
                 notes = $3, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4`,
            [new_sim_number, new_imei || null, newNotes, id]
        );

        await client.query('COMMIT');

        // 4. Auditoria
        await logAudit(userId, 'asset_update', 'asset', id, { 
            action: 'sim_swap',
            old_sim: oldSim, 
            new_sim: new_sim_number, 
            imei_update: new_imei !== oldImei ? new_imei : null,
            reason: reason,
            patrimonio: asset.patrimonio_number 
        }, ipAddress);

        res.json({ message: 'Chip e dados técnicos atualizados com sucesso.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro na troca de chip:', error);
        res.status(500).json({ message: 'Erro ao processar troca: ' + error.message });
    } finally {
        client.release();
    }
});

// =====================================================================
// LISTAR ESCOLAS COM ALUNOS (ORDENADAS POR DEMANDA) - CORRIGIDA
// =====================================================================
app.get('/api/tablets/schools-with-students', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.name, u.rpa,
        COUNT(DISTINCT s.id) as total_eligible,
        (
          COUNT(DISTINCT s.id) -
          COUNT(DISTINCT CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed', 'planejada', 'devolvido') THEN s.id END)
        ) as pending_count,
        (
          COUNT(DISTINCT CASE WHEN s.requires_livox = true THEN s.id END) -
          COUNT(DISTINCT CASE WHEN s.requires_livox = true AND dbi.delivery_status IN ('realizada', 'confirmed', 'planejada', 'devolvido') THEN s.id END)
        ) as pending_livox_count
      FROM units u
      JOIN tablet_eligible_students s ON s.school_unit_id = u.id
      LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
      GROUP BY u.id, u.name, u.rpa
      -- A escola só aparece se ainda houver saldo de alunos "intocados"
      HAVING (COUNT(DISTINCT s.id) - COUNT(DISTINCT CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed', 'planejada', 'devolvido') THEN s.id END)) > 0
      ORDER BY pending_count DESC, u.name ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar demanda:', error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// =====================================================================
// LISTAR ESCOLAS COM ALUNOS (SINALIZANDO SALDO DE PENDÊNCIAS)
// =====================================================================
app.get('/api/tablets/schools-with-students', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.name,
        u.rpa,
        COUNT(DISTINCT s.id) as total_eligible,
        -- Saldo Real: Alunos que NÃO estão em nenhum lote (ou cujos lotes foram devolvidos/cancelados)
        (
          COUNT(DISTINCT s.id) - 
          COUNT(DISTINCT CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed', 'planejada') THEN s.id END)
        ) as pending_count
      FROM units u
      JOIN tablet_eligible_students s ON s.school_unit_id = u.id
      LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
      GROUP BY u.id, u.name, u.rpa
      -- Só exibe se o saldo de pendentes for maior que zero
      HAVING (COUNT(DISTINCT s.id) - COUNT(DISTINCT CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed', 'planejada') THEN s.id END)) > 0
      ORDER BY pending_count DESC, u.name ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar escolas com saldo pendente:', error);
    res.status(500).json({ message: 'Erro interno ao buscar demanda.' });
  }
});

// =====================================================================
// [NOVA TELA] LISTAR LOTES COM TERMOS PENDENTES (Com Contador de Cobranças)
// =====================================================================
app.get('/api/delivery-batches/pending-terms', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  try {
    const query = `
      SELECT 
        db.id as batch_id,
        db.name as batch_name,
        u.name as school_name,
        db.delivery_confirmation_date,
        db.last_contact_date,
        -- >>> NOVO: Conta quantas cobranças foram feitas no total <<<
        (SELECT COUNT(*) FROM delivery_batch_contacts WHERE batch_id = db.id) as contact_count,
        (db.delivery_confirmation_date + INTERVAL '21 days') as deadline_date,
        (CURRENT_DATE - db.delivery_confirmation_date::date) as days_passed
      FROM delivery_batches db
      JOIN units u ON db.school_unit_id = u.id
      WHERE db.status = 'Concluído' 
        AND (db.terms_status IS NULL OR db.terms_status = 'pending')
      ORDER BY days_passed DESC, db.delivery_confirmation_date ASC
    `;
    const result = await pool.query(query);

    const data = result.rows.map(row => {
      let statusTag = 'no_prazo';
      const days = parseInt(row.days_passed, 10);
      
      if (days > 21) { statusTag = 'atrasado'; } 
      else if (days >= 15) { statusTag = 'atencao'; }

      let businessDays = 0;
      const startDate = new Date(row.delivery_confirmation_date);
      const endDate = new Date();
      startDate.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
      
      let currentDate = new Date(startDate);
      while (currentDate < endDate) {
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays++;
          currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        ...row,
        statusTag,
        days_passed: days,
        business_days_passed: businessDays,
        contact_count: parseInt(row.contact_count, 10) // Envia a contagem para a tela
      };
    });

    res.status(200).json(data);
  } catch (error) {
    console.error('Erro ao listar termos pendentes:', error);
    res.status(500).json({ message: 'Erro interno ao buscar lotes.' });
  }
});

// =====================================================================
// [NOVA AÇÃO] REGISTRAR CONTATO/COBRANÇA DA ESCOLA (Histórico 1:N)
// =====================================================================
app.put('/api/delivery-batches/:id/register-contact', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const userId = req.user.id; 

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Guarda o histórico detalhado na nova tabela
    await client.query(
      `INSERT INTO delivery_batch_contacts (batch_id, contact_notes, created_by) VALUES ($1, $2, $3)`,
      [id, notes, userId]
    );

    // 2. Atualiza a tabela principal apenas para manter a data de "Último contato" rápida para leitura
    await client.query(
      `UPDATE delivery_batches SET last_contact_date = NOW(), contact_notes = $1 WHERE id = $2`,
      [notes, id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Cobrança registrada no histórico!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao registrar cobrança:', error);
    res.status(500).json({ message: 'Erro ao registrar cobrança.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// [NOVO] BUSCAR ALUNOS PARA O CHECKLIST DE TERMOS (Ignora Devolvidos)
// =====================================================================
app.get('/api/delivery-batches/:id/items-for-terms', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                dbi.id as item_id,
                -- >>> CORREÇÃO DOS NOMES DAS COLUNAS CONFORME O SEU BANCO <<<
                s.student_name,
                s.student_registration as registration_number,
                dbi.term_received
            FROM delivery_batch_items dbi
            JOIN tablet_eligible_students s ON dbi.eligible_student_id = s.id
            WHERE dbi.batch_id = $1
              AND dbi.delivery_status IN ('realizada', 'confirmed') 
            ORDER BY s.student_name ASC
        `;
        const result = await pool.query(query, [id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar alunos para checklist:', error);
        res.status(500).json({ message: 'Erro ao buscar alunos do lote.' });
    }
});

// =====================================================================
// [NOVO] SALVAR CHECKLIST DE TERMOS E AUTOMATIZAR STATUS DO LOTE
// =====================================================================
app.put('/api/delivery-batches/:id/register-terms-checklist', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    const { id } = req.params;
    const { received_date, notes, checklist } = req.body; 
    // checklist é um array: [{ item_id: 1, term_received: true }, ...]

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let termsReceivedCount = 0;
        let totalValidItems = checklist.length;

        // 1. Atualiza o status de cada aluno individualmente
        for (const item of checklist) {
            await client.query(
                `UPDATE delivery_batch_items SET term_received = $1 WHERE id = $2`,
                [item.term_received, item.item_id]
            );
            if (item.term_received) termsReceivedCount++;
        }

        // 2. Inteligência Automática: Completo ou Parcial?
        const newStatus = (termsReceivedCount === totalValidItems && totalValidItems > 0) ? 'completed' : 'partial';

        // 3. Atualiza o Lote Pai com a data, a anotação e o status automático
        await client.query(
            `UPDATE delivery_batches 
             SET terms_returned_at = $1, 
                 terms_returned_notes = $2,
                 terms_status = $3
             WHERE id = $4`,
            [received_date, notes, newStatus, id]
        );

        await client.query('COMMIT');
        res.status(200).json({ 
            message: 'Checklist salvo com sucesso!', 
            calculatedStatus: newStatus 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar checklist de termos:', error);
        res.status(500).json({ message: 'Erro ao processar a baixa documental.' });
    } finally {
        client.release();
    }
});

// =====================================================================
// [NOVA AÇÃO] REGISTRAR DEVOLUTIVA DOS TERMOS POR E-MAIL
// =====================================================================
app.put('/api/delivery-batches/:id/register-terms', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
  const { id: batch_id } = req.params;
  const { received_date, status, notes } = req.body; // status: 'completed' ou 'partial'
  const ipAddress = req.ip;

  if (!received_date || !status) {
    return res.status(400).json({ message: 'Data de recebimento e status são obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atualiza o lote com as novas colunas
    const result = await client.query(`
      UPDATE delivery_batches 
      SET 
        terms_status = $1, 
        terms_returned_at = $2, 
        terms_returned_notes = $3
      WHERE id = $4
      RETURNING id, name
    `, [status, received_date, notes || null, batch_id]);

    if (result.rowCount === 0) {
      throw new Error('Lote não encontrado.');
    }

    await client.query('COMMIT');
    
    // Loga a ação para auditoria
    await logAudit(req.user.id, 'register_terms_return', 'delivery_batches', batch_id, { status, notes }, ipAddress);

    res.status(200).json({ message: 'Devolutiva de termos registrada com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao registrar devolutiva de termos:', error);
    res.status(500).json({ message: error.message || 'Erro ao registrar devolutiva.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// ANALYTICS: DESEMPENHO POR ESCOLA (APENAS ATIVAS NA LOGÍSTICA)
// =====================================================================
app.get('/api/analytics/schools-performance', authenticateToken, async (req, res) => {
  try {
    const { whereClause, values } = buildDashboardFilters(req.query);

    const query = `
      SELECT 
        u.name as school_name,
        s.rpa,
        COUNT(s.id) as total_students,
        -- Conta Entregues (Realizada/Confirmed)
        COUNT(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 END) as delivered_count,
        -- Conta Planejados (Para saber se a escola "começou")
        COUNT(CASE WHEN dbi.delivery_status = 'planejada' THEN 1 END) as planned_count
      FROM tablet_eligible_students s
      JOIN units u ON s.school_unit_id = u.id
      LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
      WHERE 1=1 ${whereClause}
      GROUP BY u.name, s.rpa
      
      -- FILTRO DE RELEVÂNCIA: Só mostra escolas que têm "movimento"
      -- Ou já entregou alguém, ou já planejou alguém.
      HAVING 
        COUNT(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 END) > 0 
        OR 
        COUNT(CASE WHEN dbi.delivery_status = 'planejada' THEN 1 END) > 0

      ORDER BY delivered_count DESC, total_students DESC
    `;

    const result = await pool.query(query, values);

    const data = result.rows.map(row => ({
        ...row,
        percentage: row.total_students > 0 
            ? ((parseInt(row.delivered_count) / parseInt(row.total_students)) * 100).toFixed(1) 
            : 0
    }));

    res.json(data);
  } catch (error) {
    console.error('Erro analytics escolas:', error);
    res.status(500).json({ message: 'Erro ao carregar detalhes.' });
  }
});

// ======================================
// Rotas de Importação (XLSX/CSV)
// ======================================

// Rota para importar Tipos de Itens via XLSX/CSv

app.post('/api/item-types/import', authenticateToken, authorizeRole(['admin', 'manager']), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];

  try {
    // A sua lógica de leitura de arquivos está ótima e foi mantida.
    // Apenas garantimos que o CSV use ponto e vírgula, que é mais comum.
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' })) // Ajustado para ponto e vírgula
          .on('data', (row) => data.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }

    fs.unlinkSync(filePath); // Remove o arquivo temporário

    let importedCount = 0;
    let updatedCount = 0;
    let errors = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      
      // ✨ CORRIGIDO: Lógica de código sequencial movida para fora do loop para otimização
      const lastItemType = await client.query('SELECT code FROM item_types ORDER BY id DESC LIMIT 1');
      let nextCodeNum = 1;
      if (lastItemType.rows.length > 0 && lastItemType.rows[0].code) {
        const lastCode = lastItemType.rows[0].code;
        const numMatch = lastCode.match(/SEDUC(\d+)/); // ✨ CORRIGIDO: Busca por 'SEDUC'
        if (numMatch && numMatch[1]) {
          nextCodeNum = parseInt(numMatch[1], 10) + 1;
        }
      }

      for (const row of data) {
        // ✨ CORRIGIDO: Lendo todos os campos necessários, com flexibilidade nos nomes das colunas
        console.log('DEBUG: Processando linha do CSV:', row);
        const name = row['Nome do Tipo de Item'] || row['name'];
        const sku_code = row['Código SKU (3 Letras)'] || row['sku_code'];
        const description = row['Descrição (Opcional)'] || row['description'];

        // ✨ CORRIGIDO: Validação agora inclui o sku_code
        if (!name || !sku_code) {
          errors.push(`Linha ignorada: 'Nome' e 'Código SKU' são obrigatórios. Dados: ${JSON.stringify(row)}`);
          continue;
        }
        
        if (String(sku_code).length !== 3) {
            errors.push(`Linha ignorada para '${name}': O Código SKU deve ter 3 caracteres. Valor recebido: '${sku_code}'`);
            continue;
        }

        // ✨ CORRIGIDO: O código do sistema agora usa o prefixo 'SEDUC'
        const code = `SEDUC${String(nextCodeNum).padStart(3, '0')}`;

        // ✨ CORRIGIDO: Usando INSERT ... ON CONFLICT para inserir ou atualizar (UPSERT)
        const result = await client.query(
          `INSERT INTO item_types (name, sku_code, description, code)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (sku_code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            updated_at = NOW()
          RETURNING xmax`, // xmax é 0 para INSERT, e diferente de 0 para UPDATE
          [name, sku_code.toUpperCase(), description, code]
        );

        if (result.rows[0].xmax === '0') {
            importedCount++;
            nextCodeNum++; // Só incrementa o código se for uma nova inserção
        } else {
            updatedCount++;
        }
      }

      await client.query('COMMIT');
      await logAudit(req.user.id, 'import_item_types', 'item_type', null, { imported: importedCount, updated: updatedCount, errors: errors.length }, ipAddress);
      
      res.status(200).json({
        message: `Importação concluída. ${importedCount} tipos criados, ${updatedCount} atualizados.`,
        errors: errors,
      });

    } catch (dbError) {
        await client.query('ROLLBACK');
        console.error('Erro na transação de importação:', dbError);
        errors.push(`Erro fatal no banco de dados: ${dbError.message}`);
        res.status(500).json({ message: 'Erro ao salvar no banco.', errors });
    } finally {
        client.release();
    }

  } catch (error) {
    console.error('Erro geral na importação de tipos de itens:', error);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    await logAudit(req.user.id, 'import_item_types_error', 'item_type', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar tipos de itens.', error: error.message });
  }
});

// Rota para importar Unidades via XLSX/CSV (VERSÃO FINAL E ROBUSTA)
app.post('/api/units/import', authenticateToken, authorizeRole(['admin', 'manager']), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  
  try {
    // Lógica para ler o arquivo XLSX ou CSV
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath).pipe(csv({ separator: ';' }))
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }
  } catch (readError) {
    console.error('Erro ao ler o arquivo de importação:', readError);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ message: `Erro ao processar o arquivo: ${readError.message}` });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  let importedCount = 0;
  let updatedCount = 0;
  let errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Inicia a transação

    // Mapeia todos os nomes de unidades existentes para IDs para consulta rápida
    const allUnitsResult = await client.query('SELECT id, name FROM units');
    const unitNameToIdMap = new Map(allUnitsResult.rows.map(u => [u.name, u.id]));

    // Primeira Etapa: Processa apenas as unidades que já existem ou são de topo (sem pai)
    for (const [index, row] of data.entries()) {
      const { name, type, code, parent_name } = row;
      if (!parent_name) {
        // Validação
        if (!name || !type) { errors.push(`Linha ${index + 2}: 'name' e 'type' são obrigatórios.`); continue; }
        
        const result = await upsertUnit(client, row); // Função auxiliar para inserir/atualizar
        if (result.isNew) importedCount++; else updatedCount++;
        
        // Atualiza nosso mapa local para a próxima etapa
        if (!unitNameToIdMap.has(name)) {
            unitNameToIdMap.set(name, result.id);
        }
      }
    }

    // Segunda Etapa: Processa as unidades "filhas"
    for (const [index, row] of data.entries()) {
      const { name, type, code, parent_name } = row;
      if (parent_name) {
         if (!name || !type) { errors.push(`Linha ${index + 2}: 'name' e 'type' são obrigatórios.`); continue; }
        
        // Busca o ID do pai no nosso mapa
        const parentId = unitNameToIdMap.get(parent_name);
        if (!parentId) {
            errors.push(`Linha ${index + 2}: Unidade superior '${parent_name}' para '${name}' não foi encontrada.`);
            continue;
        }

        const result = await upsertUnit(client, { ...row, parent_id: parentId });
        if (result.isNew) importedCount++; else updatedCount++;
      }
    }

    await client.query('COMMIT'); // Confirma todas as inserções/atualizações

    await logAudit(req.user.id, 'import_units', 'unit', null, { imported: importedCount, updated: updatedCount, errors: errors.length }, ipAddress);
    res.status(200).json({
      message: `Importação concluída. ${importedCount} unidades criadas, ${updatedCount} atualizadas.`,
      errors: errors,
    });

  } catch (error) {
    await client.query('ROLLBACK'); // Desfaz tudo em caso de erro
    await logAudit(req.user.id, 'import_units_error', 'unit', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: `Erro durante a transação: ${error.message}`, errors });
  } finally {
    client.release();
  }
});

// Função auxiliar para inserir ou atualizar (UPSERT) uma unidade de forma segura
async function upsertUnit(client, row) {
    const { name, type, code, parent_id, address, contact_phone, contact_email, notes, rpa, RPA } = row;
    
    // Pega RPA de minúsculo ou maiúsculo
    const rpaValue = rpa || RPA || null;

    // Validações básicas
    if (type.toUpperCase() === 'ESCOLAR' && (!code || String(code).trim() === '')) {
        throw new Error(`Unidade '${name}' é do tipo ESCOLAR mas está sem Código (INEP).`);
    }
    const validTypes = ['ADMINISTRATIVA', 'ESCOLAR', 'EXTERNA'];
    if (!validTypes.includes(type.toUpperCase())) {
        throw new Error(`Tipo '${type}' inválido.`);
    }

    // 1. ESTRATÉGIA DE BUSCA INTELIGENTE
    let existingId = null;

    // A) Tenta achar pelo CÓDIGO (Mais confiável para Escolas)
    if (code && String(code).trim() !== '') {
        const resCode = await client.query('SELECT id FROM units WHERE code = $1', [code]);
        if (resCode.rows.length > 0) {
            existingId = resCode.rows[0].id;
        }
    }

    // B) Se não achou pelo código (ou não tem código), tenta pelo NOME + TIPO + PAI
    if (!existingId) {
        const resName = await client.query(
            'SELECT id FROM units WHERE name = $1 AND type = $2 AND parent_id IS NOT DISTINCT FROM $3',
            [name, type.toUpperCase(), parent_id || null]
        );
        if (resName.rows.length > 0) {
            existingId = resName.rows[0].id;
        }
    }

    // 2. DECISÃO: ATUALIZAR OU CRIAR
    if (existingId) {
        // --- ATUALIZAÇÃO (UPDATE) ---
        // Atualiza inclusive o RPA e corrige o nome se estiver diferente da planilha
        await client.query(
            `UPDATE units SET 
                name = $1, 
                code = $2, 
                type = $3, 
                parent_id = $4, 
                address = COALESCE($5, address), -- Só atualiza se vier valor na planilha
                contact_phone = COALESCE($6, contact_phone),
                contact_email = COALESCE($7, contact_email),
                notes = COALESCE($8, notes),
                rpa = COALESCE($9, rpa),         -- Atualiza RPA
                updated_at = NOW()
             WHERE id = $10`,
            [
                name, 
                code || null, 
                type.toUpperCase(), 
                parent_id || null, 
                address || null, 
                contact_phone || null, 
                contact_email || null, 
                notes || null, 
                rpaValue, 
                existingId
            ]
        );
        return { id: existingId, isNew: false };

    } else {
        // --- CRIAÇÃO (INSERT) ---
        const insertRes = await client.query(
            `INSERT INTO units (name, code, type, parent_id, address, contact_phone, contact_email, notes, rpa)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
                name, 
                code || null, 
                type.toUpperCase(), 
                parent_id || null, 
                address || null, 
                contact_phone || null, 
                contact_email || null, 
                notes || null, 
                rpaValue
            ]
        );
        return { id: insertRes.rows[0].id, isNew: true };
    }
}

// ======================================
// Rotas de Relatórios Iniciais
// ======================================

// Rota para exportar lista de ativos em CSV
app.get('/api/reports/assets/csv', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const result = await pool.query(
     `SELECT
         a.sku, it.name AS item_type_name, a.brand, a.model, a.description,
         a.serial_number, a.patrimonio_number, a.unit_of_measure, a.status,
         u.name AS current_unit_name,
         a.acquisition_date, a.warranty_end_date, a.notes, a.created_at
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN units u ON a.current_unit_id = u.id
       ORDER BY a.sku ASC`
    );

    const assets = result.rows;
    if (assets.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado para gerar relatório.' });
    }

    // Cria o cabeçalho do CSV
    const headers = [
      'SKU', 'Tipo de Item', 'Marca', 'Modelo', 'Descrição', 'Número de Série',
      'Número de Patrimônio', 'Unidade de Medida', 'Status', 'Unidade Atual',
      'Data de Aquisição', 'Data Fim Garantia', 'Observações', 'Data de Criação'
    ];
    const csvRows = [headers.join(',')];

    // Adiciona os dados
    for (const asset of assets) {
      const row = [
        asset.sku,
        asset.item_type_name,
        asset.brand,
        asset.model,
        asset.description ? `"${asset.description.replace(/"/g, '""')}"` : '',
        asset.serial_number,
        asset.patrimonio_number,
        asset.unit_of_measure,
        asset.status,
        asset.current_unit_name,
        asset.acquisition_date ? asset.acquisition_date.toISOString().split('T')[0] : '',
        asset.warranty_end_date ? asset.warranty_end_date.toISOString().split('T')[0] : '',
        asset.notes ? `"${asset.notes.replace(/"/g, '""')}"` : '',
        asset.created_at ? asset.created_at.toISOString() : ''
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('relatorio_ativos.csv');
    res.send(csvString);

    await logAudit(req.user.id, 'generate_report', 'asset_report_csv', null, { format: 'CSV', count: assets.length }, ipAddress);
  } catch (error) {
    console.error('Erro ao gerar relatório CSV de ativos:', error);
    await logAudit(req.user.id, 'generate_report_error', 'asset_report_csv', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório CSV de ativos.' });
  }
});

// ROTA ATUALIZADA: ATIVOS (XLSX - VISUAL MATRIZ)
app.get('/api/reports/assets/xlsx', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.sku, it.name AS item_type, a.brand, a.model, 
                   a.patrimonio_number, a.serial_number, a.status, 
                   u.name AS unit_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            LEFT JOIN units u ON a.current_unit_id = u.id
            ORDER BY a.sku ASC
        `);

        // Mapeia para o formato do Excel
        const rows = result.rows.map(a => ({
            pat: a.patrimonio_number || 'S/N',
            type: a.item_type,
            desc: `${a.brand} ${a.model}`,
            serial: a.serial_number || '-',
            status: a.status, // Você pode aplicar a função translateStatus aqui se quiser traduzir no back
            unit: a.unit_name || 'Sem Unidade'
        }));

        const columns = [
            { header: 'PATRIMÔNIO', key: 'pat', width: 15 },
            { header: 'TIPO', key: 'type', width: 20 },
            { header: 'MODELO / MARCA', key: 'desc', width: 40 },
            { header: 'SÉRIE', key: 'serial', width: 20 },
            { header: 'STATUS', key: 'status', width: 15 },
            { header: 'LOCALIZAÇÃO ATUAL', key: 'unit', width: 40 },
        ];

        await generateStyledExcel(res, 'Ativos', 'Relatorio_Ativos_Completo.xlsx', columns, rows);

    } catch (error) {
        console.error('Erro xlsx ativos:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
});

// Rota para exportar lista de ativos em PDF (usando pdfmake)
app.get('/api/reports/assets/pdf', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const result = await pool.query(
      `SELECT
         a.sku,
         it.name AS item_type_name,
         a.brand,
         a.model,
         a.status,
         u.name AS current_unit_name
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN units u ON a.current_unit_id = u.id
       ORDER BY a.sku ASC`
    );

    const assets = result.rows;
    if (assets.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado para gerar relatório.' });
    }

    // Estrutura do documento PDF para pdfmake
    const docDefinition = {
      content: [
        { text: 'PREFEITURA DO RECIFE', style: 'header', alignment: 'center' },
        { text: 'SECRETARIA DE EDUCAÇÃO', style: 'subheader', alignment: 'center' },
        { text: 'Sistema de Gestão de Ativos - SGA', style: 'subheader', alignment: 'center' },
        { text: '\n\n' },
        { text: `RELATÓRIO DE ATIVOS`, style: 'documentTitle', alignment: 'center' },
        { text: `\nData de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, alignment: 'right' },
        { text: '\n\n' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*'], // Larguras das colunas
            body: [
              // Cabeçalho da tabela
              ['SKU', 'Tipo de Item', 'Marca', 'Modelo', 'Status', 'Unidade Atual'].map(header => ({ text: header, style: 'tableHeader' })),
              // Dados dos ativos
              ...assets.map(asset => [
                asset.sku,
                asset.item_type_name,
                asset.brand,
                asset.model,
                asset.status,
                asset.current_unit_name || 'N/A'
              ])
            ]
          },
          layout: {
            hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 2 : 1; },
            vLineWidth: function (i, node) { return (i === 0 || i === node.table.widths.length) ? 2 : 1; },
            hLineColor: function (i, node) { return (i === 0 || i === node.table.body.length) ? '#007bff' : '#ccc'; },
            vLineColor: function (i, node) { return (i === 0 || i === node.table.widths.length) ? '#007bff' : '#ccc'; },
            paddingLeft: function(i, node) { return 8; },
            paddingRight: function(i, node) { return 8; },
            paddingTop: function(i, node) { return 5; },
            paddingBottom: function(i, node) { return 5; },
          }
        },
        '\n\n',
        { text: `Total de Ativos: ${assets.length}`, alignment: 'right', style: 'footer' }
      ],
       styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5], color: '#0056b3' },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
        documentTitle: { fontSize: 18, bold: true, margin: [0, 10, 0, 10], decoration: 'underline' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5], color: '#0056b3' },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#007bff',
          alignment: 'center',
          margin: [0, 5, 0, 5]
        },
        footer: { fontSize: 10, italics: true, color: '#343a40' }
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        alignment: 'left'
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_ativos.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'asset_report_pdf', null, { format: 'PDF', count: assets.length }, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar recibo PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erro interno do servidor ao gerar o PDF.' });
    }
  }
});

// =====================================================================
// 1. ROTA DE PREVIEW DE DEVOLUÇÃO (PADRONIZADA - 2 PÁGINAS)
// =====================================================================
app.post('/api/reports/preview-return-term', authenticateToken, async (req, res) => {
  try {
    const { 
        recipient_name, recipient_cpf, recipient_registration, unit_name, 
        assets, reason 
    } = req.body;

    // 1. Logo
    let logoBase64 = null;
    const pathsToTry = [
        path.join(__dirname, 'assets/brasao-recife.png'),
        path.join(__dirname, '../assets/brasao-recife.png'),
        path.join(__dirname, 'public/assets/brasao-recife.png')
    ];
    for (const p of pathsToTry) {
        if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} }
    }

    // 2. Estilos
    const styles = {
        docTitle: { fontSize: 12, bold: true, alignment: 'center', color: '#000', margin: [0, 10, 0, 10] },
        sectionTitle: { fontSize: 10, bold: true, margin: [0, 5, 0, 2], color: '#444' },
        infoBox: { fontSize: 9, lineHeight: 1.2 },
        tableHeader: { bold: true, fontSize: 8, fillColor: '#f0f0f0', alignment: 'center', color: 'black' },
        tableCell: { fontSize: 8, alignment: 'center' },
        tableCellLeft: { fontSize: 8, alignment: 'left' },
        legalText: { fontSize: 10, lineHeight: 1.5, alignment: 'justify', margin: [0, 5, 0, 5] }
    };

    const getHeader = () => ({
        margin: [30, 15, 30, 5],
        columns: [
            logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 45, margin: [0, 0, 10, 0] } : { text: '', width: 45 },
            { stack: [ 
                { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 10 }, 
                { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 9 }, 
                { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 8 } 
            ], alignment: 'center', margin: [0, 5, 45, 0] }
        ]
    });

    const getUserInfoBox = () => ({
      margin: [0, 5, 0, 10],
      columns: [
          { width: '*', stack: [
              { text: `NOME: ${recipient_name || ''}`, style: 'infoBox', bold: true },
              { text: `UNIDADE: ${unit_name || ''}`, style: 'infoBox' }
          ]},
          { width: 150, stack: [
              { text: `MATRÍCULA: ${recipient_registration || ''}`, style: 'infoBox' },
              { text: `CPF: ${recipient_cpf || ''}`, style: 'infoBox' }
          ]}
      ]
    });

    // Construtor da Tabela (Apenas ativos principais)
    const buildTableRows = (items) => {
        const rows = [[ 
            { text: 'QTD', style: 'tableHeader', width: 25 }, 
            { text: 'EQUIPAMENTO', style: 'tableHeader', width: '*' }, 
            { text: 'SÉRIE', style: 'tableHeader', width: 70 }, 
            { text: 'TOMBAMENTO', style: 'tableHeader', width: 80 } 
        ]];

        (items || []).forEach(a => {
            rows.push([
                { text: '1', style: 'tableCell' },
                { text: `${a.item_type_name || 'Equipamento'} ${a.brand || ''} ${a.model || ''}`.toUpperCase(), style: 'tableCellLeft' },
                { text: a.serial_number || '-', style: 'tableCell' },
                { text: a.patrimonio_number || '-', style: 'tableCell', bold: true }
            ]);
        });
        return rows;
    };

    // =========================================================
    // PÁGINA 1: RECIBO DE DEVOLUÇÃO (COM VISTORIA)
    // =========================================================
    const contentReturn = [
        { text: 'RECIBO DE DEVOLUÇÃO', style: 'docTitle' },
        { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
        getUserInfoBox(),
        { text: [ 'Atestamos o ', { text: 'RECOLHIMENTO DEFINITIVO', bold: true }, ' dos equipamentos abaixo.\n', { text: `Motivo: ${reason || 'Devolução ao Estoque'}`, italics: true } ], style: 'infoBox', margin: [0, 0, 0, 5] },
        
        { table: { headerRows: 1, widths: [25, '*', 70, 80], body: buildTableRows(assets) }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 10] },

        // VISTORIA TÉCNICA
        { text: 'CONFERÊNCIA TÉCNICA DE DEVOLUÇÃO (VISTORIA)', style: 'sectionTitle', margin: [0, 10, 0, 5], color: '#b91c1c' },
        { 
            table: { widths: ['25%', '25%', '25%', '25%'], body: [[ { text: '[   ] Mouse', fontSize: 8 }, { text: '[   ] Teclado', fontSize: 8 }, { text: '[   ] Fonte', fontSize: 8 }, { text: '[   ] Cabos', fontSize: 8 } ]] },
            layout: 'noBorders', margin: [0, 0, 0, 5]
        },
        { text: 'Observações sobre o Estado de Conservação / Avarias:', fontSize: 8, bold: true },
        { canvas: [{ type: 'line', x1: 0, y1: 12, x2: 515, y2: 12, lineWidth: 0.5, lineColor: '#999' }] },
        { canvas: [{ type: 'line', x1: 0, y1: 12, x2: 515, y2: 12, lineWidth: 0.5, lineColor: '#999' }] },
        { canvas: [{ type: 'line', x1: 0, y1: 12, x2: 515, y2: 12, lineWidth: 0.5, lineColor: '#999' }] },
        { canvas: [{ type: 'line', x1: 0, y1: 12, x2: 515, y2: 12, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 0, 0, 20] },

        { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 10, 0, 30], fontSize: 9 },
        { columns: [ 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: recipient_name, fontSize: 8, bold: true, alignment: 'center' }, { text: 'Devolvendo', fontSize: 8, alignment: 'center' }] }, 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, bold: true, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center' }] } 
        ] }
    ];

    // =========================================================
    // PÁGINA 2: TERMO DE DEVOLUÇÃO E DESONERAÇÃO (Texto Exato)
    // =========================================================
    const contentDesoneracao = [
        { text: 'TERMO DE DEVOLUÇÃO E DESONERAÇÃO', style: 'docTitle', margin: [0, 10, 0, 20] },
        
        { text: 'Declaro que DEVOLVI à Gerência de Infraestrutura de Tecnologia GIT, todos os equipamentos e acessórios constantes no recibo (verso), os quais foram conferidos pela equipe técnica.', style: 'legalText', margin: [0, 0, 0, 15] },
        
        { text: '1. Declaro estar ciente de que a devolução dos equipamentos encerra minha responsabilidade de guarda sobre os mesmos a partir desta data.', style: 'legalText' },
        
        { text: '2. Atesto que os equipamentos foram devolvidos nas condições informadas no ato do recebimento pela equipe técnica.', style: 'legalText', margin: [0, 0, 0, 30] },

        { text: 'Recebido em ____/____/______', margin: [0, 20, 0, 10], fontSize: 9 },
        
        { stack: [
            { text: `Responsável: ${recipient_name}`, bold: true },
            { text: `Setor: ${unit_name}` },
            { text: `Matrícula: ${recipient_registration}` },
            { text: `CPF: ${recipient_cpf}` }
        ], style: 'infoBox', margin: [0, 0, 0, 40] },

        { text: '____________________________________________________', alignment: 'center' },
        { text: 'Assinatura', alignment: 'center', fontSize: 8 }
    ];

    const docDefinition = {
      pageSize: 'A4', pageMargins: [40, 90, 40, 40], 
      header: getHeader(),
      footer: (page) => ({ margin: [40, 0, 40, 10], stack: [ { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] }, { text: 'Av. Oliveira Lima, 824 - Soledade | CEP: 50050-390 | FONE: 3355-5471', alignment: 'center', fontSize: 7, margin: [0, 3, 0, 0] } ] }),
      content: [ ...contentReturn, { text: '', pageBreak: 'after' }, ...contentDesoneracao ],
      styles: styles, defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', c => chunks.push(c));
    pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
    pdfDoc.end();
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar PDF: ' + error.message }); }
});

// =====================================================================
// ROTA DE PRÉVIA DE SUBSTITUIÇÃO (GERA PDF SEM SALVAR NO BANCO)
// =====================================================================
app.post('/api/reports/preview-substitution', authenticateToken, async (req, res) => {
  try {
    const { 
      recipient_name, recipient_cpf, recipient_registration, unit_name, 
      old_assets, new_assets, reason 
    } = req.body;

    // 1. Configurar Logo
    const logoPath = path.join(__dirname, 'assets/brasao-recife.png'); // Confirme se é 'assets' ou '../assets' no seu projeto
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
        try { logoBase64 = fs.readFileSync(logoPath, 'base64'); } catch(e) {}
    }

    // 2. Estilos PDFMake (Copiados do seu padrão)
    const styles = {
        docTitle: { fontSize: 14, bold: true, alignment: 'center', color: '#2c3e50', margin: [0, 0, 0, 10] },
        sectionTitle: { fontSize: 10, bold: true, margin: [0, 5, 0, 2], color: '#444' },
        infoBox: { fontSize: 9, lineHeight: 1.3, background: '#f8f9fa' },
        body: { fontSize: 10, lineHeight: 1.3, alignment: 'justify' },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee', alignment: 'center' },
        tableCell: { fontSize: 9 },
        legalText: { fontSize: 9, lineHeight: 1.4, color: '#333', alignment: 'justify' },
        clause: { fontSize: 9, alignment: 'justify', margin: [0, 5, 0, 4], lineHeight: 1.3 }
    };

    // 3. Helper de Cabeçalho Seguro
    const getHeader = () => {
        const cols = [];
        if (logoBase64) cols.push({ image: `data:image/png;base64,${logoBase64}`, width: 50, margin: [0, 5, 20, 0] });
        else cols.push({ text: '', width: 50 });

        cols.push({
            stack: [
                { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 },
                { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 },
                { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 }
            ],
            alignment: 'center', margin: [0, 15, 50, 0]
        });
        return { margin: [30, 20, 30, 10], columns: cols };
    };

    const getUserInfoBox = () => ({
      table: { 
        widths: ['*', '*', '*'], 
        body: [
          [
            { text: `NOME: ${recipient_name || ''}`, style: 'infoBox' }, 
            { text: `CPF: ${recipient_cpf || ''}`, style: 'infoBox' }, 
            { text: `MATRÍCULA: ${recipient_registration || ''}`, style: 'infoBox' }
          ], 
          [ { text: `UNIDADE: ${unit_name || ''}`, style: 'infoBox', colSpan: 3 }, {}, {} ]
        ] 
      }, 
      layout: 'noBorders', margin: [0, 5, 0, 15]
    });

    // --- PÁGINA 1: DEVOLUÇÃO ---
    const tableBodyReturn = [[ { text: 'QTD', style: 'tableHeader' }, { text: 'EQUIPAMENTO DEVOLVIDO', style: 'tableHeader' }, { text: 'PATRIMÔNIO', style: 'tableHeader' } ]];
    if (Array.isArray(old_assets)) {
        old_assets.forEach(a => {
            tableBodyReturn.push([
                { text: '1', style: 'tableCell', alignment: 'center' },
                { text: `${a.brand} ${a.model}`, style: 'tableCell' },
                { text: a.patrimonio_number || '-', style: 'tableCell', alignment: 'center', bold: true }
            ]);
        });
    }

    const contentReturn = [
        { text: 'RECIBO DE DEVOLUÇÃO (SUBSTITUIÇÃO)', style: 'docTitle' },
        { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
        getUserInfoBox(),
        { text: [ 'Declaramos o ', { text: 'RECEBIMENTO/RECOLHIMENTO', bold: true }, ' do(s) equipamento(s) abaixo.\n', 'Motivo da Substituição: ', { text: reason || 'Não informado', italics: true } ], style: 'body', margin: [0, 0, 0, 10] },
        { table: { headerRows: 1, widths: [30, '*', 100], body: tableBodyReturn }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 20] },
        { text: 'O item acima foi recolhido e o servidor fica desonerado da responsabilidade sobre este bem a partir desta data.', style: 'legalText', margin: [0, 0, 0, 40] },
        { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 0, 0, 40] },
        { columns: [ 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: recipient_name || 'Servidor', fontSize: 8, alignment: 'center' }, { text: 'Devolvendo', fontSize: 8, alignment: 'center', italics: true }] }, 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center', italics: true }] } 
        ]}
    ];

    // --- PÁGINAS 2 e 3: ENTREGA ---
    const tableBodyDelivery = [[ { text: 'QTD', style: 'tableHeader' }, { text: 'EQUIPAMENTO ENTREGUE', style: 'tableHeader' }, { text: 'PATRIMÔNIO', style: 'tableHeader' } ]];
    if (Array.isArray(new_assets)) {
        new_assets.forEach(a => {
            tableBodyDelivery.push([
                { text: '1', style: 'tableCell', alignment: 'center' },
                { text: `${a.item_type_name || ''} ${a.brand} ${a.model}`, style: 'tableCell' },
                { text: a.patrimonio_number || '-', style: 'tableCell', alignment: 'center', bold: true }
            ]);
        });
    }

    const contentDelivery = [
        { text: 'TERMO DE PERMISSÃO DE USO', style: 'docTitle', margin: [0, 0, 0, 10] },
        { text: [ { text: 'O MUNICÍPIO DO RECIFE', bold: true }, '... e do outro lado, o servidor (', { text: recipient_name || 'SERVIDOR', bold: true, decoration: 'underline' }, '), doravante denominado ', { text: 'PERMISSIONÁRIO(A)', bold: true }, '...' ], style: 'body', alignment: 'justify', margin: [0, 10, 0, 15] },
        { text: 'DADOS DO PERMISSIONÁRIO', style: 'sectionTitle' },
        getUserInfoBox(),
        { text: 'DESCRIÇÃO DOS EQUIPAMENTOS CEDIDOS (SUBSTITUIÇÃO)', style: 'sectionTitle', margin: [0, 10, 0, 2] },
        { table: { headerRows: 1, widths: [30, '*', 100], body: tableBodyDelivery }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 15] },
        { text: [{ text: 'CLÁUSULA PRIMEIRA – DO OBJETO – ', bold: true }, 'O objeto do presente contrato é permissão de uso, a título gratuito, dos equipamentos discriminados.'], style: 'clause' },
        { text: [{ text: 'CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES – ', bold: true }, 'São obrigações do (a) PERMISSIONÁRIO (A): a) conservar a coisa emprestada; b) não utilizar em destinação diversa; c) não ceder a terceiros; d) devolver o equipamento em bom estado.'], style: 'clause' },
        { text: [{ text: 'CLÁUSULA TERCEIRA – DA RESPONSABILIDADE – ', bold: true }, 'Em caso de roubo, furto ou extravio, apresentar B.O. em 48h.'], style: 'clause' },
        { text: 'E por estarem justos e contratados, assinam o presente termo.', margin: [0, 10, 0, 20], fontSize: 9 },
        { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 0, 0, 40] },
        { columns: [ { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, alignment: 'center' }, { text: 'Entregando', fontSize: 8, alignment: 'center', italics: true }] }, { stack: [{ text: '_______________________________', alignment: 'center' }, { text: recipient_name || 'Servidor', fontSize: 8, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center', italics: true }] } ]}
    ];

    // 4. Montagem Final
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 110, 40, 60],
      header: getHeader(),
      footer: { margin: [40, 0, 40, 20], stack: [ { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] }, { text: 'Gerência de Infraestrutura de Tecnologia - SGA', fontSize: 8, alignment: 'center', margin: [0, 5, 0, 0] } ] },
      content: [ ...contentReturn, { text: '', pageBreak: 'after' }, ...contentDelivery ],
      styles: styles,
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf');
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();

  } catch (error) {
    console.error('Erro ao gerar prévia:', error);
    res.status(500).json({ message: 'Erro ao gerar o documento de prévia: ' + error.message });
  }
});

// =====================================================================
// ROTA PRINCIPAL DE MOVIMENTAÇÃO (COM RENOMEAÇÃO INTELIGENTE DO ARQUIVO)
// =====================================================================
// =====================================================================
// [ATUALIZADO] REGISTRAR MOVIMENTAÇÃO (COM ATUALIZAÇÃO DE IMEI/CHIP)
// =====================================================================
app.post('/api/asset-movements', authenticateToken, authorizePermission('ACTION_REGISTER_MOVEMENT'), uploadSimple.single('receiptFile'), async (req, res) => {
    let {
        asset_ids, movement_type, recipient_person_id, recipient_name, recipient_document,
        purpose, expected_return_date, notes, destination_unit_id,
        request_channel_type, request_channel_details, peripherals, returned_peripherals,
        return_condition,
        asset_updates, // <<< NOVO: Objeto com atualizações { assetId: { imei: '...', sim_card_number: '...' } }
        request_id     // <<< Solicitação de TI vinculada (opcional)
    } = req.body;

    const responsible_user_id = req.user.id;
    const ipAddress = req.ip;

    // 1. TRATAMENTO DE DADOS (JSON Parse)
    if (typeof asset_ids === 'string') {
        try {
            const parsed = JSON.parse(asset_ids);
            asset_ids = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            asset_ids = asset_ids.includes(',') ? asset_ids.split(',').map(Number) : [parseInt(asset_ids)];
        }
    } else if (typeof asset_ids === 'number') {
        asset_ids = [asset_ids];
    }

    if (typeof peripherals === 'string') { try { peripherals = JSON.parse(peripherals); } catch (e) { peripherals = []; } }
    if (typeof returned_peripherals === 'string') { try { returned_peripherals = JSON.parse(returned_peripherals); } catch (e) { returned_peripherals = []; } }

    // Parse do asset_updates se vier como string (comum em FormData)
    if (typeof asset_updates === 'string') {
        try { asset_updates = JSON.parse(asset_updates); } catch (e) { asset_updates = {}; }
    } else if (!asset_updates) {
        asset_updates = {};
    }

    recipient_person_id = (recipient_person_id && recipient_person_id !== 'null' && recipient_person_id !== 'undefined') ? parseInt(recipient_person_id) : null;
    destination_unit_id = (destination_unit_id && destination_unit_id !== 'null' && destination_unit_id !== 'undefined') ? parseInt(destination_unit_id) : null;

    // 2. VALIDAÇÃO BÁSICA
    if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0 || !movement_type) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Dados obrigatórios faltando.' });
    }

    // Valida solicitação vinculada antes de iniciar a transação
    if (request_id) {
        const reqCheck = await pool.query(
            'SELECT id, status FROM requests WHERE id = $1',
            [parseInt(request_id)]
        );
        if (reqCheck.rows.length === 0) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Solicitação de TI não encontrada.' });
        }
        if (!['aprovado', 'parcialmente_aprovado'].includes(reqCheck.rows[0].status)) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: `A solicitação de TI precisa estar em status "Aprovada" ou "Parcialmente Aprovada" para vincular uma movimentação (status atual: ${reqCheck.rows[0].status}).`
            });
        }
    }

    let receiptPath = req.file ? req.file.path : null;
    let deliveryStatus = 'pending_confirmation';
    let actualDeliveryDate = null;

    if (movement_type === 'return' || receiptPath) {
        deliveryStatus = 'confirmed';
        actualDeliveryDate = new Date();
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lógica de Renomeação de Arquivo (Mantida)
        if (req.file && recipient_person_id) {
            try {
                const personRes = await client.query('SELECT full_name FROM people WHERE id = $1', [recipient_person_id]);
                if (personRes.rows.length > 0) {
                    const personName = personRes.rows[0].full_name;
                    const safeName = personName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
                    const dateStr = new Date().toISOString().split('T')[0];
                    const ext = path.extname(req.file.originalname);
                    const newFileName = `Devolucao_${safeName}_${dateStr}${ext}`;
                    const oldPath = req.file.path;
                    const newPath = path.join(path.dirname(oldPath), newFileName);
                    fs.renameSync(oldPath, newPath);
                    receiptPath = newPath;
                }
            } catch (renameError) {
                console.error('Erro ao renomear arquivo:', renameError);
            }
        }

        // 3. INSERÇÃO DA MOVIMENTAÇÃO
        const newMovementResult = await client.query(
            `INSERT INTO asset_movements (
           movement_type, responsible_user_id, recipient_person_id, recipient_name, recipient_document,
           purpose, expected_return_date, notes, destination_unit_id,
           request_channel_type, request_channel_details, delivery_status,
           receipt_path, actual_delivery_date, movement_date, request_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15) RETURNING id`,
            [
                movement_type, responsible_user_id, recipient_person_id, recipient_name || null, recipient_document || null,
                purpose || null, expected_return_date || null, notes || null, destination_unit_id,
                request_channel_type || null, request_channel_details || null,
                deliveryStatus, receiptPath, actualDeliveryDate,
                request_id ? parseInt(request_id) : null
            ]
        );
        const newMovementId = newMovementResult.rows[0].id;

        // 4. PROCESSAMENTO DE CADA ATIVO
        for (const asset_id of asset_ids) {
            
            // --- A. ATUALIZAÇÃO TÉCNICA (IMEI / CHIP) ---
            // Verifica se há dados novos para este ativo específico no pacote recebido
            if (asset_updates && asset_updates[asset_id]) {
                const { imei, sim_card_number } = asset_updates[asset_id];
                
                // Se o usuário mandou string vazia, salva NULL para limpar o dado. Se mandou texto, salva o texto.
                const newImei = (imei !== undefined && imei.trim() !== '') ? imei.trim() : (imei === '' ? null : undefined);
                const newSim = (sim_card_number !== undefined && sim_card_number.trim() !== '') ? sim_card_number.trim() : (sim_card_number === '' ? null : undefined);

                // Monta query dinâmica para só atualizar o que foi enviado
                if (newImei !== undefined || newSim !== undefined) {
                    // COALESCE aqui mantém o valor antigo se o novo for undefined (não enviado), 
                    // mas permite NULL se foi enviado explicitamente como limpeza.
                    await client.query(`
                        UPDATE assets 
                        SET 
                            imei = COALESCE($1, imei), 
                            sim_card_number = COALESCE($2, sim_card_number)
                        WHERE id = $3
                    `, [newImei, newSim, asset_id]);
                }
            }

            // --- B. ATUALIZAÇÃO DE STATUS E LOCALIZAÇÃO ---
            let newAssetStatus = 'available';
            let newCurrentUnitId = null;

            switch (movement_type) {
                case 'exit': newAssetStatus = 'in_use'; newCurrentUnitId = destination_unit_id; break;
                case 'loan': newAssetStatus = 'loaned'; newCurrentUnitId = destination_unit_id; break;
                case 'return':
                    newAssetStatus = (return_condition === 'defective') ? 'maintenance' : 'available';
                    const infraUnitRes = await client.query(`SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1`);
                    if (infraUnitRes.rows.length > 0) newCurrentUnitId = infraUnitRes.rows[0].id;
                    break;
                case 'maintenance': newAssetStatus = 'maintenance'; newCurrentUnitId = destination_unit_id; break;
            }

            await client.query(`UPDATE assets SET status = $1, current_unit_id = $2, updated_at = NOW() WHERE id = $3`, [newAssetStatus, newCurrentUnitId, asset_id]);
            await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`, [newMovementId, asset_id]);
        }

        // 5. PROCESSAMENTO DE PERIFÉRICOS (Mantido)
        if (peripherals && Array.isArray(peripherals)) {
            for (const p of peripherals) {
                const pType = p.peripheral_type || p;
                const pQty = p.quantity || 1;
                if (pType) await client.query(`INSERT INTO movement_peripherals (movement_id, peripheral_type, quantity, status) VALUES ($1, $2, $3, 'out')`, [newMovementId, pType, pQty]);
            }
        }
        if (movement_type === 'return' && returned_peripherals && Array.isArray(returned_peripherals)) {
            for (const p of returned_peripherals) {
                if (p.peripheral_type) await client.query(`INSERT INTO movement_peripherals (movement_id, peripheral_type, quantity, status) VALUES ($1, $2, $3, 'in')`, [newMovementId, p.peripheral_type, p.quantity]);
            }
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'create_movement', 'asset_movement', newMovementId, { type: movement_type, assets: asset_ids }, ipAddress);

        // Atualiza status da Solicitação de TI vinculada (fora da transação principal)
        if (request_id) {
            try {
                const requestRepository = require('./repositories/requestRepository');
                await requestRepository.updateRequestStatus(
                    pool, parseInt(request_id), deliveryStatus, req.user.id,
                    `Movimentação #${newMovementId} registrada — status atualizado automaticamente.`
                );
            } catch (requestErr) {
                console.error(`[Solicitações] Erro ao atualizar status da solicitação ${request_id}:`, requestErr.message);
            }
        }

        res.status(201).json({ message: 'Movimentação registrada com sucesso!', movement_id: newMovementId });

    } catch (error) {
        await client.query('ROLLBACK');
        if (req.file && fs.existsSync(req.file.path)) try { fs.unlinkSync(req.file.path); } catch (e) {}
        console.error('Erro ao registrar movimentação:', error);
        res.status(500).json({ message: 'Erro ao registrar: ' + error.message });
    } finally {
        client.release();
    }
});

// >>> NOVA ROTA PARA DESCARTAR UM ATIVO <<<

app.put('/api/assets/:id/dispose', authenticateToken, authorizePermission('ACTION_DELETE'), async (req, res) => {
  const { id } = req.params;
  const { disposal_note } = req.body; // Nota de descarte
  const ipAddress = req.ip;

  if (!disposal_note) {
    return res.status(400).json({ message: 'A nota de descarte é obrigatória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assetResult = await client.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (assetResult.rows.length === 0) {
      throw new Error('Ativo não encontrado.');
    }
    const asset = assetResult.rows[0];

    // Regra de negócio: Só pode descartar ativos já baixados ('retired')
    if (asset.status !== 'retired') {
      throw new Error(`Apenas ativos com status 'Baixado' podem ser descartados. Status atual: ${asset.status}.`);
    }

    const finalNote = `\n[DESCARTADO EM ${new Date().toLocaleDateString('pt-BR')}]: ${disposal_note}`;
    const updatedNotes = (asset.notes || '') + finalNote;

    const updatedAsset = await client.query(
      `UPDATE assets SET status = 'disposed', notes = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [updatedNotes, id]
    );

    await client.query('COMMIT');

    await logAudit(req.user.id, 'dispose_asset', 'asset', id, { disposal_note, old_status: asset.status }, ipAddress);
    res.status(200).json({ message: 'Ativo descartado com sucesso!', asset: updatedAsset.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Erro ao descartar o ativo ${id}:`, error);
    res.status(500).json({ message: `Erro ao descartar o ativo: ${error.message}` });
  } finally {
    client.release();
  }
});

// >>> NOVA ROTA PARA DAR BAIXA EM UM ATIVO <<<

app.put('/api/assets/:id/retire', authenticateToken, authorizePermission('ACTION_REQUEST_RETIREMENT'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // Motivo da baixa
  const ipAddress = req.ip;

  if (!reason) {
    return res.status(400).json({ message: 'O motivo da baixa é obrigatório.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Busca o ativo para validar seu status
    const assetResult = await client.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (assetResult.rows.length === 0) {
      throw new Error('Ativo não encontrado.');
    }
    const asset = assetResult.rows[0];

    // Aplica a regra de negócio
    if (!['available', 'maintenance'].includes(asset.status)) {
      throw new Error(`Ativos com status '${asset.status}' não podem ser baixados. É necessário primeiro registrar a devolução.`);
    }

    const retirementNote = `\n[BAIXADO EM ${new Date().toLocaleDateString('pt-BR')}]: ${reason}`;
    const updatedNotes = (asset.notes || '') + retirementNote;

    // Atualiza o status e as notas do ativo
    const updatedAsset = await client.query(
      `UPDATE assets SET status = 'retired', notes = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [updatedNotes, id]
    );

    await client.query('COMMIT');

    await logAudit(req.user.id, 'retire_asset', 'asset', id, { reason, old_status: asset.status }, ipAddress);
    res.status(200).json({ message: 'Ativo baixado com sucesso!', asset: updatedAsset.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Erro ao dar baixa no ativo ${id}:`, error);
    res.status(500).json({ message: `Erro ao dar baixa no ativo: ${error.message}` });
  } finally {
    client.release();
  }
});

// =====================================================================
// CONFIGURAÇÃO ESPECÍFICA DE UPLOAD PARA SUBSTITUIÇÃO
// =====================================================================
const substitutionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Salva na mesma pasta de recibos
    const dir = path.join(__dirname, 'uploads', 'receipts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Usa um nome seguro com timestamp, já que não temos o ID da movimentação ainda
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'substituicao-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadSubstitution = multer({ storage: substitutionStorage });

// =====================================================================
// ROTA DE SUBSTITUIÇÃO (COM PARSING ROBUSTO E RENOMEAÇÃO DE ARQUIVO)
// =====================================================================
app.post('/api/asset-movements/substitute', authenticateToken, authorizeRole(['admin', 'manager']), uploadSubstitution.single('receiptFile'), async (req, res) => {
  let { 
    oldAssetIds, newAssetIds, reason, peripherals, 
    recipient_person_id, destination_unit_id, return_condition 
  } = req.body;
  
  const responsibleUserId = req.user.id;
  const ipAddress = req.ip;

  // --- 1. TRATAMENTO DE DADOS (CRUCIAL PARA FORMDATA) ---
  const parseArray = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) return input;
      if (typeof input === 'string') {
          try {
              const parsed = JSON.parse(input);
              return Array.isArray(parsed) ? parsed : [parsed];
          } catch (e) {
              return input.includes(',') ? input.split(',').map(Number) : [parseInt(input)];
          }
      }
      return [input];
  };

  oldAssetIds = parseArray(oldAssetIds);
  newAssetIds = parseArray(newAssetIds);
  
  if (typeof peripherals === 'string') { try { peripherals = JSON.parse(peripherals); } catch(e) { peripherals = []; } }
  
  recipient_person_id = (recipient_person_id && recipient_person_id !== 'undefined' && recipient_person_id !== 'null') ? parseInt(recipient_person_id) : null;
  destination_unit_id = (destination_unit_id && destination_unit_id !== 'undefined' && destination_unit_id !== 'null') ? parseInt(destination_unit_id) : null;

  // 2. VALIDAÇÃO BÁSICA
  if (oldAssetIds.length === 0 || newAssetIds.length === 0) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'É necessário selecionar os ativos antigos e os novos.' });
  }

  let receiptPath = req.file ? req.file.path : null;
  // Se tem arquivo, considera confirmado. Se não, pendente.
  const deliveryStatus = receiptPath ? 'confirmed' : 'pending_confirmation';
  const deliveryDate = receiptPath ? new Date() : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- 3. LÓGICA DE RENOMEAÇÃO DO ARQUIVO (PADRÃO OURO) ---
    if (req.file && recipient_person_id) {
        try {
            const personRes = await client.query('SELECT full_name FROM people WHERE id = $1', [recipient_person_id]);
            if (personRes.rows.length > 0) {
                const personName = personRes.rows[0].full_name;
                const safeName = personName
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9]/g, "_")
                    .toUpperCase();

                const dateStr = new Date().toISOString().split('T')[0];
                const ext = path.extname(req.file.originalname);
                const newFileName = `Substituicao_${safeName}_${dateStr}${ext}`;
                
                const oldPath = req.file.path;
                const newPath = path.join(path.dirname(oldPath), newFileName);

                fs.renameSync(oldPath, newPath);
                receiptPath = newPath; // Atualiza o caminho para salvar no banco
                console.log(`[SUBSTITUIÇÃO] Arquivo renomeado para: ${newFileName}`);
            }
        } catch (renameError) {
            console.error('Erro ao renomear arquivo de substituição:', renameError);
            // Mantém o nome original em caso de erro no rename
        }
    }

    // 4. CONTEXTO DA SUBSTITUIÇÃO
    // Tenta descobrir a unidade e tipo baseados no histórico do ativo antigo, se não informado
    if (!recipient_person_id || !destination_unit_id) {
        const lastMovementRes = await client.query(
          `SELECT recipient_person_id, destination_unit_id
           FROM asset_movements
           WHERE id IN (SELECT movement_id FROM movement_assets WHERE asset_id = $1)
           AND movement_type IN ('exit', 'loan')
           ORDER BY movement_date DESC, id DESC LIMIT 1`, [oldAssetIds[0]]
        );

        if (lastMovementRes.rows.length > 0) {
            const hist = lastMovementRes.rows[0];
            if (!recipient_person_id) recipient_person_id = hist.recipient_person_id;
            if (!destination_unit_id) destination_unit_id = hist.destination_unit_id;
        }
    }
    
    if (!recipient_person_id) throw new Error('Responsável pela substituição não identificado.');

    // Busca ID do Almoxarifado para devolução dos antigos
    const warehouseUnitRes = await client.query(`SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1`);
    const warehouseUnitId = warehouseUnitRes.rows.length > 0 ? warehouseUnitRes.rows[0].id : null;

    // 5. REGISTRAR DEVOLUÇÃO (Recolhimento dos Antigos)
    // Se marcou "Com Defeito", vai pra manutenção. Se não, disponível.
    const oldAssetStatus = (return_condition === 'defective') ? 'maintenance' : 'available';
    
    const returnNote = `Substituição (Recolhido). Motivo: ${reason}`;
    const returnMovementRes = await client.query(
      `INSERT INTO asset_movements (movement_type, responsible_user_id, recipient_person_id, destination_unit_id, notes, delivery_status, actual_delivery_date, movement_date)
       VALUES ('return', $1, $2, $3, $4, 'confirmed', NOW(), NOW()) RETURNING id`,
      [responsibleUserId, recipient_person_id, warehouseUnitId, returnNote]
    );
    const returnMovementId = returnMovementRes.rows[0].id;

    for (const oldAssetId of oldAssetIds) {
      await client.query('UPDATE assets SET status = $1, current_unit_id = $2, updated_at = NOW() WHERE id = $3', [oldAssetStatus, warehouseUnitId, oldAssetId]);
      await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [returnMovementId, oldAssetId]);
    }

    // 6. REGISTRAR SAÍDA (Entrega dos Novos)
    const exitNote = `Substituição (Entregue). Motivo: ${reason}`;
    // Assume status 'loaned' (Empréstimo) como padrão seguro, ou 'in_use' se preferir.
    const newAssetStatus = 'loaned'; 
    const movementType = 'loan';

    const exitMovementRes = await client.query(
      `INSERT INTO asset_movements (
          movement_type, responsible_user_id, recipient_person_id, destination_unit_id, 
          notes, delivery_status, receipt_path, actual_delivery_date, movement_date
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
      [movementType, responsibleUserId, recipient_person_id, destination_unit_id, exitNote, deliveryStatus, receiptPath, deliveryDate]
    );
    const exitMovementId = exitMovementRes.rows[0].id;

    for (const newAssetId of newAssetIds) {
      await client.query('UPDATE assets SET status = $1, current_unit_id = $2, updated_at = NOW() WHERE id = $3', [newAssetStatus, destination_unit_id, newAssetId]);
      await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [exitMovementId, newAssetId]);
    }

    // Periféricos (Mouse, Teclado...) na saída
    if (peripherals && peripherals.length > 0) {
        for (const p of peripherals) {
            // Verifica se p é string ou objeto
            const pType = typeof p === 'string' ? p : p.peripheral_type;
            const pQty = (typeof p === 'object' && p.quantity) ? p.quantity : 1;
            
            if (pType) {
                await client.query(`INSERT INTO movement_peripherals (movement_id, peripheral_type, quantity, status) VALUES ($1, $2, $3, 'out')`, [exitMovementId, pType, pQty]);
            }
        }
    }

    await client.query('COMMIT');
    await logAudit(responsibleUserId, 'asset_kit_substitution', 'asset_movement', exitMovementId, { oldAssetIds, newAssetIds }, ipAddress);

    // Retorna IDs para que o frontend possa gerar recibos se quiser
    res.status(201).json({ message: 'Substituição realizada com sucesso!', returnMovementId, newMovementId: exitMovementId });

  } catch (error) {
    await client.query('ROLLBACK');
    // Limpa arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    console.error('Erro substituição:', error);
    res.status(500).json({ message: 'Erro ao processar substituição: ' + error.message });
  } finally {
    client.release();
  }
});

// >>> ROTA PARA BUSCAR ATIVOS EM USO (COM FILTROS E DADOS PARA PDF) <<<
// =====================================================================
// LISTAR ATIVOS EM USO (Somente Entregues/Confirmados) - AJUSTADO
// =====================================================================
app.get('/api/asset-movements/in-use-assets', authenticateToken, async (req, res) => {
  const { solicitante, patrimonio, startDate, endDate, itemType } = req.query;

  try {
    // 1. Construção Dinâmica dos Filtros
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (solicitante) { conditions.push(`p.full_name ILIKE $${paramIndex++}`); values.push(`%${solicitante}%`); }
    if (patrimonio) { conditions.push(`a.patrimonio_number ILIKE $${paramIndex++}`); values.push(`%${patrimonio}%`); }
    if (itemType) { conditions.push(`it.name ILIKE $${paramIndex++}`); values.push(`%${itemType}%`); }
    if (startDate) { conditions.push(`am.movement_date >= $${paramIndex++}`); values.push(startDate); }
    if (endDate) { conditions.push(`am.movement_date <= $${paramIndex++}`); values.push(endDate); }

    const whereClause = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    // 2. Query Principal
    const query = `
      WITH LatestExitMovement AS (
        SELECT
          a.id as asset_id,
          (SELECT ma.movement_id
           FROM movement_assets ma
           JOIN asset_movements am_inner ON ma.movement_id = am_inner.id
           WHERE ma.asset_id = a.id AND am_inner.movement_type = 'exit'
           ORDER BY am_inner.created_at DESC, am_inner.id DESC
           LIMIT 1) as latest_movement_id
        FROM assets a
        WHERE a.status = 'in_use'
      )
      SELECT
        am.id, am.movement_type, am.movement_date, am.delivery_status,
        p.full_name as recipient_display_name,
        
        -- >>> CORREÇÃO: IDs NECESSÁRIOS PARA O FLUXO DE SUBSTITUIÇÃO <<<
        am.destination_unit_id,
        am.recipient_person_id,

        -- Campos para o PDF
        p.cpf as recipient_person_cpf,
        p.registration_number as recipient_person_registration,
        u.name as destination_unit_name,

        a.id as asset_id, a.patrimonio_number, a.brand, a.model,
        it.name as item_type_name
      FROM asset_movements am
      JOIN people p ON am.recipient_person_id = p.id
      LEFT JOIN units u ON am.destination_unit_id = u.id
      JOIN LatestExitMovement lem ON am.id = lem.latest_movement_id
      JOIN assets a ON lem.asset_id = a.id
      JOIN item_types it ON a.item_type_id = it.id
      
      WHERE am.delivery_status = 'confirmed' ${whereClause}
      
      ORDER BY am.movement_date DESC;
    `;

    const result = await pool.query(query, values);
    
    // Agrupamento manual via Javascript
    const movements = result.rows.reduce((acc, row) => {
      let movement = acc.find(m => m.id === row.id);
      
      if (!movement) {
        movement = {
          id: row.id,
          movement_type: row.movement_type,
          movement_date: row.movement_date,
          delivery_status: row.delivery_status,
          recipient_display_name: row.recipient_display_name,
          
          // >>> MAPEAMENTO DOS NOVOS CAMPOS <<<
          destination_unit_id: row.destination_unit_id,
          recipient_person_id: row.recipient_person_id,

          recipient_person_cpf: row.recipient_person_cpf,
          recipient_person_registration: row.recipient_person_registration,
          destination_unit_name: row.destination_unit_name,
          
          assets: []
        };
        acc.push(movement);
      }
      
      movement.assets.push({
        id: row.asset_id,
        patrimonio_number: row.patrimonio_number,
        brand: row.brand,
        model: row.model,
        item_type_name: row.item_type_name
      });
      
      return acc;
    }, []);

    res.status(200).json(movements);
  } catch (error) {
    console.error('Erro ao buscar ativos em uso:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA CONFIRMAR A ENTREGA DE UMA MOVIMENTAÇÃO
app.post('/api/asset-movements/:id/confirm-delivery', 
    fetchMovementDetailsForUpload,     // 1º: Busca os detalhes para o nome do arquivo
    upload.single('receiptFile'),      // 2º: Processa o upload do arquivo
    authenticateToken,                 // 3º: Autentica o token (agora que a requisição foi processada)
    authorizePermission('ACTION_REGISTER_MOVEMENT'), // 4º: Autoriza a permissão
    async (req, res) => {              // 5º: Executa a lógica final
  const { id } = req.params;
  const { actual_delivery_date } = req.body;
  const ipAddress = req.ip;

  // 1. Validação da requisição
  if (!req.file) {
    return res.status(400).json({ message: 'O arquivo do recibo é obrigatório.' });
  }
  if (!actual_delivery_date) {
    // Se a data não for enviada, deleta o arquivo que foi salvo para não deixar lixo no servidor
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'A data de entrega efetiva é obrigatória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Busca a movimentação e verifica seu estado atual
    const movementResult = await client.query('SELECT * FROM asset_movements WHERE id = $1', [id]);
    if (movementResult.rows.length === 0) {
      throw new Error('Movimentação não encontrada.');
    }

    const movement = movementResult.rows[0];
    if (movement.delivery_status === 'confirmed') {
      throw new Error('Esta entrega já foi confirmada anteriormente.');
    }
    if (movement.delivery_status !== 'pending_confirmation') {
        throw new Error(`Apenas movimentações com status 'pending_confirmation' podem ser confirmadas. Status atual: ${movement.delivery_status}`);
    }

    // 3. Atualiza o banco de dados com as novas informações
    await client.query(
      `UPDATE asset_movements 
       SET delivery_status = 'confirmed', actual_delivery_date = $1, receipt_path = $2 
       WHERE id = $3`,
      [actual_delivery_date, req.file.path, id]
    );

    await client.query('COMMIT');

    // Atualiza status da Solicitação de TI vinculada, se houver
    if (movement.request_id) {
        try {
            const requestRepository = require('./repositories/requestRepository');
            await requestRepository.updateRequestStatus(
                pool, movement.request_id, 'confirmed', req.user.id,
                `Entrega confirmada — Movimentação #${id} concluída.`
            );
        } catch (requestErr) {
            console.error(`[Solicitações] Erro ao concluir solicitação ${movement.request_id}:`, requestErr.message);
        }
    }

    // 4. Loga a auditoria e envia a resposta de sucesso
    await logAudit(req.user.id, 'confirm_delivery', 'asset_movement', id, { receipt_path: req.file.path }, ipAddress);
    res.status(200).json({ message: 'Entrega confirmada com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    // Se deu erro, remove o arquivo que foi feito upload
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    console.error('Erro ao confirmar entrega:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    await logAudit(req.user.id, 'confirm_delivery_error', 'asset_movement', id, { error: errorMessage }, ipAddress);
    res.status(500).json({ message: `Erro ao confirmar entrega: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// >>> NOVA ROTA PARA RENOVAÇÃO DE EMPRÉSTIMO <<<

app.put('/api/asset-movements/:id/renew', authenticateToken, authorizePermission('ACTION_REQUEST_RETIREMENT'), async (req, res) => {
  const { id } = req.params;
  const { new_expected_return_date, renewal_note } = req.body;
  const ipAddress = req.ip;

  if (!new_expected_return_date) {
    return res.status(400).json({ message: 'A nova data de devolução é obrigatória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Busca a movimentação original para validar e obter dados antigos
    const movementResult = await client.query('SELECT * FROM asset_movements WHERE id = $1', [id]);
    if (movementResult.rows.length === 0) {
      throw new Error('Movimentação não encontrada.');
    }
    const movement = movementResult.rows[0];

    // 2. Valida se é um empréstimo
    if (movement.movement_type !== 'loan') {
      throw new Error('Apenas movimentações do tipo "empréstimo" podem ser renovadas.');
    }
    
    // 3. Prepara a nova nota, mantendo o histórico
    const oldDate = new Date(movement.expected_return_date).toLocaleDateString('pt-BR');
    const renewalLog = `\n[RENOVADO EM ${new Date().toLocaleDateString('pt-BR')}]: Vencimento alterado de ${oldDate} para ${new Date(new_expected_return_date).toLocaleDateString('pt-BR')}. Motivo: ${renewal_note || 'N/A'}.`;
    const updatedNotes = (movement.notes || '') + renewalLog;

    // 4. Atualiza o registro no banco de dados
    await client.query(
      `UPDATE asset_movements 
       SET expected_return_date = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [new_expected_return_date, updatedNotes, id]
    );

    await client.query('COMMIT');

    await logAudit(req.user.id, 'renew_loan', 'asset_movement', id, { new_expected_return_date, renewal_note }, ipAddress);
    res.status(200).json({ message: 'Empréstimo renovado com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao renovar empréstimo:', error);
    res.status(500).json({ message: `Erro ao renovar empréstimo: ${error.message}` });
  } finally {
    client.release();
  }
});

// >>> ROTA PARA BUSCAR EMPRÉSTIMOS ATIVOS (CORRIGIDA COM DADOS DO USUÁRIO) <<<

// >>> ROTA PARA BUSCAR EMPRÉSTIMOS ATIVOS (COM FILTROS E DADOS PARA PDF) <<<
// =====================================================================
// LISTAR EMPRÉSTIMOS ATIVOS (Somente Entregues/Confirmados) - AJUSTADO
// =====================================================================
app.get('/api/asset-movements/active-loans', authenticateToken, async (req, res) => {
  const { solicitante, patrimonio, startDate, endDate, itemType } = req.query;

  try {
    // 1. Construção Dinâmica dos Filtros
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (solicitante) { conditions.push(`p.full_name ILIKE $${paramIndex++}`); values.push(`%${solicitante}%`); }
    if (patrimonio) { conditions.push(`a.patrimonio_number ILIKE $${paramIndex++}`); values.push(`%${patrimonio}%`); }
    if (itemType) { conditions.push(`it.name ILIKE $${paramIndex++}`); values.push(`%${itemType}%`); }
    if (startDate) { conditions.push(`am.movement_date >= $${paramIndex++}`); values.push(startDate); }
    if (endDate) { conditions.push(`am.movement_date <= $${paramIndex++}`); values.push(endDate); }

    const whereClause = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    // 2. Query Principal
    const query = `
      WITH CurrentLoanedAssets AS (
        SELECT
          a.id as asset_id,
          (SELECT ma.movement_id
           FROM movement_assets ma
           JOIN asset_movements am_inner ON ma.movement_id = am_inner.id
           WHERE ma.asset_id = a.id AND am_inner.movement_type = 'loan'
           ORDER BY am_inner.movement_date DESC, am_inner.id DESC
           LIMIT 1) as latest_loan_movement_id
        FROM assets a
        WHERE a.status = 'loaned'
      )
      SELECT
        am.id,
        am.movement_type,
        am.movement_date,
        am.expected_return_date,
        am.delivery_status,
        
        -- >>> CORREÇÃO: IDs NECESSÁRIOS PARA O FLUXO DE SUBSTITUIÇÃO <<<
        am.destination_unit_id,
        am.recipient_person_id, -- Pegando direto da tabela de movimento para garantir

        p.full_name as recipient_display_name,
        
        -- Campos para o PDF
        p.cpf as recipient_person_cpf,
        p.registration_number as recipient_person_registration,
        u.name as destination_unit_name,

        -- Agregação dos ativos
        json_agg(
          json_build_object(
            'id', cla.asset_id,
            'patrimonio_number', a.patrimonio_number,
            'item_type_name', it.name,
            'brand', a.brand,
            'model', a.model
          )
        ) as assets
      FROM asset_movements am
      JOIN people p ON am.recipient_person_id = p.id
      LEFT JOIN units u ON am.destination_unit_id = u.id
      JOIN CurrentLoanedAssets cla ON am.id = cla.latest_loan_movement_id
      JOIN assets a ON cla.asset_id = a.id
      JOIN item_types it ON a.item_type_id = it.id
      
      WHERE am.delivery_status = 'confirmed' ${whereClause}
      
      -- >>> CORREÇÃO NO GROUP BY: Adicionado am.destination_unit_id e am.recipient_person_id <<<
      GROUP BY am.id, p.full_name, p.id, p.cpf, p.registration_number, u.name, am.destination_unit_id, am.recipient_person_id
      ORDER BY am.expected_return_date ASC;
    `;
    
    const result = await pool.query(query, values);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erro ao buscar empréstimos ativos:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA BUSCAR MOVIMENTAÇÕES COM ENTREGA PENDENTE
app.get('/api/asset-movements/pending-delivery', authenticateToken, async (req, res) => {
  const { solicitante, patrimonio } = req.query;
  let query = `
    SELECT
      am.id, am.movement_type, am.movement_date,
      p.full_name as recipient_display_name
    FROM asset_movements am
    LEFT JOIN people p ON am.recipient_person_id = p.id
    WHERE am.delivery_status = 'pending_confirmation'
      AND am.movement_type IN ('exit', 'loan')
  `;
  const params = [];

  if (solicitante) {
    params.push(`%${solicitante}%`);
    query += ` AND p.full_name ILIKE $${params.length}`;
  }
  
  if (patrimonio) {
    query += ` AND EXISTS (
      SELECT 1 FROM movement_assets ma
      JOIN assets a ON ma.asset_id = a.id
      WHERE ma.movement_id = am.id AND a.patrimonio_number = $${params.length + 1}
    )`;
    params.push(patrimonio);
  }

  query += ' ORDER BY am.movement_date DESC';

  try {
    const result = await pool.query(query, params);
    // Para cada movimentação, busca os ativos associados
    const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
        const assetsResult = await pool.query(
          `SELECT a. id, a.sku, a.patrimonio_number, a.brand, a.model FROM movement_assets ma JOIN assets a ON ma.asset_id = a.id WHERE ma.movement_id = $1`,
          [movement.id]
        );
        return { ...movement, assets: assetsResult.rows };
      }));
    res.status(200).json(movementsWithAssets);
  } catch (error) {
    console.error('Erro ao buscar movimentações pendentes:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// >>> NOVA ROTA PARA BUSCAR MOVIMENTAÇÕES POR PESSOA <<<

app.get('/api/asset-movements/by-person/:personId', authenticateToken, async (req, res) => {
  const { personId } = req.params;
  // Filtros de data opcionais
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT
        am.id,
        am.movement_date,
        am.movement_type,
        am.delivery_status,
        u.full_name AS responsible_full_name
      FROM asset_movements am
      JOIN users u ON am.responsible_user_id = u.id
      WHERE am.recipient_person_id = $1
    `;
    const params = [personId];

    if (startDate) {
      params.push(startDate);
      query += ` AND am.movement_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND am.movement_date <= $${params.length}`;
    }

    query += ' ORDER BY am.movement_date DESC, am.id DESC';

    const result = await pool.query(query, params);

    // Para cada movimentação, buscar os ativos associados
    const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
      const assetsResult = await pool.query(
        `SELECT a.id, a.patrimonio_number, a.brand, a.model, a.sku 
         FROM movement_assets ma 
         JOIN assets a ON ma.asset_id = a.id 
         WHERE ma.movement_id = $1`,
        [movement.id]
      );
      return { ...movement, assets: assetsResult.rows };
    }));

    res.status(200).json(movementsWithAssets);

  } catch (error) {
    console.error(`Erro ao buscar movimentações da pessoa ${personId}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Arquivo: backend/src/server.js

// >>> NOVA ROTA PARA BUSCAR MOVIMENTAÇÕES POR ATIVO <<<

app.get('/api/asset-movements/by-asset/:assetId', authenticateToken, async (req, res) => {
  const { assetId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT
        am.id,
        am.movement_date,
        am.movement_type,
        am.delivery_status,
        u.full_name AS responsible_full_name,
        p.full_name AS recipient_display_name
      FROM asset_movements am
      JOIN movement_assets ma ON am.id = ma.movement_id
      JOIN users u ON am.responsible_user_id = u.id
      LEFT JOIN people p ON am.recipient_person_id = p.id
      WHERE ma.asset_id = $1
    `;
    const params = [assetId];

    if (startDate) {
      params.push(startDate);
      query += ` AND am.movement_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND am.movement_date <= $${params.length}`;
    }

    query += ' ORDER BY am.movement_date ASC, am.id ASC'; // Ordem cronológica ascendente

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error(`Erro ao buscar movimentações do ativo ${assetId}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});



// >>> ENDPOINT DE LISTAR MOVIMENTAÇÕES  <<<
app.get('/api/asset-movements', authenticateToken, async (req, res) => {
  try {
    const movements = await getFilteredMovements(req.query);
    res.status(200).json(movements);
  } catch (error) {
    console.error('Erro ao listar movimentações de ativos:', error);
    await logAudit(req.user.id, 'list_movements_error', 'asset_movement', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar movimentações.' });
  }
});

// >>> NOVO ENDPOINT DE RELATÓRIO <<<

app.post('/api/reports/movements/pdf', authenticateToken, async (req, res) => {
  try {
    // A rota usa o CORPO da requisição (req.body) para os filtros
    const movements = await getFilteredMovements(req.body);

    if (movements.length === 0) {
      return res.status(404).json({ message: 'Nenhuma movimentação encontrada com os filtros especificados.' });
    }

    // Tradução dos tipos de movimentação para o relatório
    const translateMovementTypeForPDF = (type) => ({
      'entry': 'Entrada', 'exit': 'Saída', 'loan': 'Empréstimo', 'return': 'Devolução', 'maintenance': 'Manutenção'
    }[type] || type);

    const bodyData = movements.map(m => [
      m.assets.map(a => a.patrimonio_number || a.sku).join(', '),
      translateMovementTypeForPDF(m.movement_type),
      new Date(m.movement_date).toLocaleDateString('pt-BR'),
      m.responsible_full_name,
      m.recipient_display_name || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Movimentações Filtrado', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              ['Ativos (Patrimônio)', 'Tipo', 'Data', 'Responsável', 'Solicitante'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: { header: { fontSize: 18, bold: true }, tableHeader: { bold: true, fontSize: 10, color: 'black' }, footer: { fontSize: 10, italics: true } },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_movimentacoes.pdf');
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error('Erro ao gerar relatório de movimentações:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// --- RELATÓRIOS DE EMPRÉSTIMOS VENCIDOS ---

const getOverdueLoansData = async () => {
  // Query robusta que primeiro encontra as MOVIMENTAÇÕES de empréstimo realmente ativas e depois filtra as vencidas.
  const query = `
    SELECT
      am.id as movement_id,
      am.expected_return_date,
      am.movement_date AS loan_date,
      p.full_name AS recipient_name,
      p.cpf AS recipient_cpf,
      p.email AS recipient_email,
      u.name AS unit_name
    FROM asset_movements am
    JOIN people p ON am.recipient_person_id = p.id
    LEFT JOIN units u ON am.destination_unit_id = u.id
    WHERE am.movement_type = 'loan'
      AND am.expected_return_date < CURRENT_DATE
      AND NOT EXISTS ( -- Garante que não existe uma devolução posterior para os ativos deste empréstimo
        SELECT 1
        FROM asset_movements am_return
        JOIN movement_assets ma_return ON am_return.id = ma_return.movement_id
        WHERE am_return.movement_type = 'return'
          AND ma_return.asset_id IN (SELECT asset_id FROM movement_assets WHERE movement_id = am.id)
          AND am_return.created_at > am.created_at
      );
  `;
  const movementsResult = await pool.query(query);
  if (movementsResult.rows.length === 0) {
    return [];
  }

  // Para cada movimentação vencida, buscamos TODOS os seus ativos
  const fullReportData = await Promise.all(movementsResult.rows.map(async (movement) => {
    const assetsResult = await pool.query(
      `SELECT patrimonio_number FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       WHERE ma.movement_id = $1`,
      [movement.movement_id]
    );
    
    const expectedDate = new Date(movement.expected_return_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expectedDate.setHours(0, 0, 0, 0);
    const diffTime = today - expectedDate;
    const overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      ...movement,
      assets: assetsResult.rows, // Array de ativos
      overdue_days: overdue_days > 0 ? overdue_days : 0 // Garante que não haja dias negativos
    };
  }));

  return fullReportData;
};

// Rota para PDF (com as novas colunas)

// server.js -> SUBSTITUA A ROTA DE PDF DE VENCIDOS PELA VERSÃO ABAIXO

app.get('/api/reports/overdue-loans/pdf', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const reportData = await getOverdueLoansData();
    
    // Carrega a imagem do brasão para o PDF
    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    if (reportData.length === 0) {
      const docDefinitionEmpty = { 
        content: [{ text: 'Nenhum empréstimo vencido encontrado no momento.', style: 'header', alignment: 'center' }],
        styles: { header: { fontSize: 18, bold: true, font: 'Roboto' } }
      };
      const pdfDocEmpty = printer.createPdfKitDocument(docDefinitionEmpty);
      res.header('Content-Type', 'application/pdf');
      pdfDocEmpty.pipe(res);
      pdfDocEmpty.end();
      return;
    }

    const bodyData = reportData.map(item => [
      item.recipient_name || 'N/A',
      item.assets.map(a => a.patrimonio_number).join(', ') || 'N/A',
      item.unit_name || 'N/A',
      new Date(item.expected_return_date).toLocaleDateString('pt-BR'),
      { text: `${item.overdue_days} dia(s)`, bold: true, color: 'red' } // Destaca o atraso
    ]);

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [ 40, 100, 40, 60 ],
      
      header: {
        columns: [
          { image: `data:image/png;base64,${logoBase64}`, width: 70, margin: [40, 20, 10, 0] },
          {
            stack: [
              'PREFEITURA DO RECIFE',
              'SECRETARIA DE EDUCAÇÃO',
              'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA'
            ],
            style: 'headerText',
            margin: [10, 30, 40, 0]
          }
        ]
      },
      
      footer: {
        stack: [
          { text: 'Sistema de Gestão de Ativos - SGA', alignment: 'center' },
          { text: 'Av. Oliveira Lima, 824 - Soledade | FONE: 3355-5471', alignment: 'center', fontSize: 8 },
        ],
        style: 'footer'
      },

      content: [
          { text: 'Relatório de Empréstimos Vencidos', style: 'docTitle', alignment: 'center' },
          { text: `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, style: 'body', alignment: 'right', margin: [0, 0, 0, 20] },
          {
              table: {
                  headerRows: 1,
                  widths: ['*', 'auto', '*', 'auto', 'auto'],
                  body: [
                      ['Solicitante', 'Patrimônio(s)', 'Unidade', 'Vencimento', 'Atraso'].map(h => ({ text: h, style: 'tableHeader' })),
                      ...bodyData
                  ]
              },
              layout: 'lightHorizontalLines'
          },
          { text: `\nTotal de Empréstimos Vencidos: ${reportData.length}`, alignment: 'right', style: 'body', bold: true }
      ],
      styles: {
        headerText: { fontSize: 9, bold: true, alignment: 'center', color: '#333' },
        docTitle: { fontSize: 18, bold: true, margin: [0, 20, 0, 20] },
        tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#ffc107' },
        body: { fontSize: 9 },
        footer: { fontSize: 8, color: 'gray', margin: [40, 10, 40, 0] }
      },
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => { 
      res.header('Content-Type', 'application/pdf').attachment('relatorio_emprestimos_vencidos.pdf').send(Buffer.concat(chunks));
      logAudit(req.user.id, 'generate_report', 'overdue_loans_report_pdf', null, { count: reportData.length }, ipAddress);
    });
    pdfDoc.end();
  } catch (error) { 
      console.error("Erro ao gerar relatório de vencidos:", error);
      res.status(500).json({ message: 'Erro ao gerar relatório PDF.' }); 
  }
});

// Rota para CSV (com as novas colunas)
app.get('/api/reports/overdue-loans/csv', authenticateToken, async (req, res) => {
  try {
    const overdueAssets = await getOverdueLoansData();
    if (overdueAssets.length === 0) return res.status(404).json({ message: 'Nenhum empréstimo vencido encontrado.' });

    const headers = ['Solicitante', 'CPF', 'Email', 'Telefone da Unidade', 'Nome da Unidade', 'Tipo da Unidade', 'Patrimônio', 'Ativo', 'Data do Empréstimo', 'Vencimento', 'Dias de Atraso'];
    const csvRows = [headers.join(';')];

    for (const item of overdueAssets) {
      const row = [
        item.recipient_name,
        item.recipient_cpf,
        item.recipient_email,
        item.unit_phone,
        item.unit_name,
        item.unit_type,
        item.patrimonio_number,
        `${item.brand} ${item.model}`,
        new Date(item.loan_date).toLocaleDateString('pt-BR'),
        new Date(item.expected_return_date).toLocaleDateString('pt-BR'),
        item.overdue_days
      ];
      csvRows.push(row.map(field => `"${field || ''}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8').attachment('relatorio_vencidos.csv').send(csvRows.join('\n'));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV.' }); }
});

// ROTA ATUALIZADA: VENCIDOS (XLSX - VISUAL MATRIZ)
app.get('/api/reports/overdue-loans/xlsx', authenticateToken, async (req, res) => {
    try {
        // Reutiliza sua função de busca de vencidos (certifique-se que getOverdueLoansData existe no arquivo)
        const overdueAssets = await getOverdueLoansData(); 

        const rows = overdueAssets.map(item => ({
            name: item.recipient_name,
            pat: item.assets.map(a => a.patrimonio_number).join(', '),
            unit: item.unit_name,
            loan_date: new Date(item.loan_date).toLocaleDateString('pt-BR'),
            due_date: new Date(item.expected_return_date).toLocaleDateString('pt-BR'),
            days: item.overdue_days
        }));

        const columns = [
            { header: 'SOLICITANTE', key: 'name', width: 40 },
            { header: 'PATRIMÔNIO(S)', key: 'pat', width: 25 },
            { header: 'UNIDADE', key: 'unit', width: 30 },
            { header: 'DATA EMPRÉSTIMO', key: 'loan_date', width: 18 },
            { header: 'VENCIMENTO', key: 'due_date', width: 18 },
            { header: 'DIAS ATRASO', key: 'days', width: 15 },
        ];

        await generateStyledExcel(res, 'Vencidos', 'Relatorio_Vencidos.xlsx', columns, rows);

    } catch (error) {
        console.error('Erro xlsx vencidos:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
});

// ======================================
// Rotas para Dashboard - FASE 3 (ATUALIZADA)
// ======================================

// Obter dados sumarizados para o Dashboard
// ======================================
// Rotas para Dashboard - FASE 3 (CORRIGIDA)
// ======================================

// =====================================================================
// DASHBOARD: RESUMO EXECUTIVO (V6 - LÓGICA EXPLÍCITA + DRILL-DOWN TABLETS)
// Correção: Conta estritamente pelo STATUS, ignorando a localização.
// Adição: Agrupamento detalhado (Marca/Modelo para comuns, Perfil para Tablets).
// =====================================================================
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    // 1. Definição de "Lixo" (O que não conta como ativo operacional no topo)
    const trashStatuses = ['disposed', 'retired', 'missing', 'pending_retirement'];

    // 2. BUSCA PRINCIPAL (Adicionado brand, model, has_livox e allow_automation)
    const mainQuery = `
      SELECT 
        a.id, 
        a.status, 
        it.name as category,
        a.brand,
        a.model,
        a.has_livox,
        a.allow_automation
      FROM assets a
      JOIN item_types it ON a.item_type_id = it.id
      WHERE a.status NOT IN ('${trashStatuses.join("','")}')
    `;
    const mainResult = await pool.query(mainQuery);
    const allAssets = mainResult.rows;

    // 3. CÁLCULO DOS CARDS (KPIs) - CONTAGEM DIRETA E EXPLÍCITA
    const totalAssets = allAssets.length;
    const availableAssets = allAssets.filter(a => a.status === 'available').length;
    const maintenanceAssets = allAssets.filter(a => ['maintenance', 'defective'].includes(a.status)).length;
    const inUseAssets = allAssets.filter(a => a.status === 'in_use').length;
    const loanedAssets = allAssets.filter(a => a.status === 'loaned').length;

    // --- CARDS DE "LIXO" (Separados) ---
    const retiredRes = await pool.query("SELECT COUNT(*) FROM assets WHERE status = 'retired'");
    const retiredAssets = parseInt(retiredRes.rows[0].count);
    
    const disposedRes = await pool.query("SELECT COUNT(*) FROM assets WHERE status = 'disposed'");
    const disposedAssets = parseInt(disposedRes.rows[0].count);

    // 4. PENDÊNCIAS
    const pendingDeliveriesRes = await pool.query("SELECT COUNT(*) FROM asset_movements WHERE delivery_status = 'pending_confirmation'");
    const pendingDeliveriesCount = parseInt(pendingDeliveriesRes.rows[0].count, 10);

    const pendingSubstitutionsRes = await pool.query("SELECT COUNT(*) FROM pending_substitutions WHERE status = 'pending'");
    const pendingSubstitutionsCount = parseInt(pendingSubstitutionsRes.rows[0].count, 10);

    // 5. GRÁFICOS (CATEGORIA + DRILL-DOWN INTELIGENTE E STATUS)
    const catMap = {};
    const breakdownMap = {};
    const statusBreakdown = {}; // Guarda a saúde de cada categoria
    const advancedBreakdownMap = { 'GLOBAL': {} }; // Guarda a intersecção Categoria x Status

    allAssets.forEach(a => { 
        const catKey = a.category || 'OUTROS';
        
        // Padroniza o status para o cruzamento bater com o texto do Frontend
        let statusLabel = 'Outros';
        if (a.status === 'available') statusLabel = 'Disponíveis';
        else if (['in_use', 'loaned'].includes(a.status)) statusLabel = 'Em Uso';
        else if (['maintenance', 'defective'].includes(a.status)) statusLabel = 'Manutenção';
        else if (a.status === 'retired') statusLabel = 'Baixados';
        else if (a.status === 'disposed') statusLabel = 'Descartados';

        // A. Contagem Macro (Categorias)
        catMap[catKey] = (catMap[catKey] || 0) + 1; 

        // B. Contagem de Status por Categoria
        if (!statusBreakdown[catKey]) {
            statusBreakdown[catKey] = { available: 0, in_use: 0, loaned: 0, maintenance: 0 };
        }
        if (a.status === 'available') statusBreakdown[catKey].available++;
        else if (a.status === 'in_use') statusBreakdown[catKey].in_use++;
        else if (a.status === 'loaned') statusBreakdown[catKey].loaned++;
        else if (['maintenance', 'defective'].includes(a.status)) statusBreakdown[catKey].maintenance++;

        // C. Formatação do Nome do Modelo
        const catNameStr = catKey.toLowerCase();
        let label = '';
        if (catNameStr.includes('tablet') || catNameStr.includes('ipad') || catNameStr.includes('galaxy') || catNameStr.includes('tab')) {
            label = '📱 Tablet Padrão';
            if (a.allow_automation === false) label = '🛡️ Reserva Técnica';
            else if (a.has_livox) label = '♿ Com Livox (PCD)';
        } else {
            const brand = a.brand && a.brand.trim() ? a.brand.trim() : 'Sem Marca';
            const model = a.model && a.model.trim() ? a.model.trim() : '';
            label = `${brand} ${model}`.trim();
        }
        
        // D. Contagem Micro (Apenas Categoria -> Modelos)
        if (!breakdownMap[catKey]) breakdownMap[catKey] = {};
        breakdownMap[catKey][label] = (breakdownMap[catKey][label] || 0) + 1;

        // E. Contagem Avançada (Categoria -> Status -> Marca/Modelo)
        if (!advancedBreakdownMap[catKey]) advancedBreakdownMap[catKey] = {};
        if (!advancedBreakdownMap[catKey][statusLabel]) advancedBreakdownMap[catKey][statusLabel] = {};
        advancedBreakdownMap[catKey][statusLabel][label] = (advancedBreakdownMap[catKey][statusLabel][label] || 0) + 1;

        // F. Contagem Avançada GLOBAL (Sem Categoria -> Status -> Marca/Modelo)
        if (!advancedBreakdownMap['GLOBAL'][statusLabel]) advancedBreakdownMap['GLOBAL'][statusLabel] = {};
        advancedBreakdownMap['GLOBAL'][statusLabel][label] = (advancedBreakdownMap['GLOBAL'][statusLabel][label] || 0) + 1;
    });

    const assetsByCategory = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const assetsBreakdown = {};
    for (const [category, models] of Object.entries(breakdownMap)) {
        assetsBreakdown[category] = Object.entries(models).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }

    const assetsAdvancedBreakdown = {};
    for (const [category, statuses] of Object.entries(advancedBreakdownMap)) {
        assetsAdvancedBreakdown[category] = {};
        for (const [status, models] of Object.entries(statuses)) {
            assetsAdvancedBreakdown[category][status] = Object.entries(models).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        }
    }

    // 6. MOVIMENTAÇÕES RECENTES
    const recentMovementsResult = await pool.query(`
      SELECT am.id, am.movement_type, am.movement_date, 
             u.full_name AS responsible_user_name, 
             COALESCE(p.full_name, am.recipient_name) AS recipient_display_name
      FROM asset_movements am
      JOIN users u ON am.responsible_user_id = u.id
      LEFT JOIN people p ON am.recipient_person_id = p.id
      ORDER BY am.movement_date DESC LIMIT 5
    `);
    
    const recentMovements = await Promise.all(recentMovementsResult.rows.map(async (m) => {
        const itemRes = await pool.query(`
            SELECT it.name, a.brand, a.model FROM movement_assets ma 
            JOIN assets a ON ma.asset_id = a.id 
            JOIN item_types it ON a.item_type_id = it.id 
            WHERE ma.movement_id = $1 LIMIT 1`, [m.id]);
        const item = itemRes.rows[0];
        return {
            id: m.id,
            asset: item ? `${item.name} ${item.brand}` : 'Vários Itens',
            type: m.movement_type,
            date: new Date(m.movement_date).toLocaleDateString('pt-BR'),
            user: m.responsible_user_name
        };
    }));

    // 7. ALERTAS DE VENCIMENTO
    const pendingAlertsResult = await pool.query(`
        SELECT am.id, am.expected_return_date, a.brand, a.model, p.full_name 
        FROM asset_movements am
        JOIN movement_assets ma ON am.id = ma.movement_id
        JOIN assets a ON ma.asset_id = a.id
        JOIN people p ON am.recipient_person_id = p.id
        WHERE am.movement_type = 'loan' AND a.status = 'loaned' 
          AND am.expected_return_date < (CURRENT_DATE + INTERVAL '8 days')
        LIMIT 5
    `);

    const pendingAlerts = pendingAlertsResult.rows.map(row => ({
        id: row.id,
        message: `Devolução de ${row.brand} vence em breve/hoje.`,
        asset: `${row.model} (${row.full_name})`,
        dueDate: new Date(row.expected_return_date).toLocaleDateString('pt-BR')
    }));

    // RESPOSTA FINAL
    res.json({
        totalAssets,
        availableAssets,
        inUseAssets,    
        loanedAssets,   
        maintenanceAssets,
        retiredAssets,
        disposedAssets,
        pendingDeliveriesCount,
        pendingSubstitutionsCount,
        assetsByCategory,
        
        // >>> OS 3 OBJETOS DE DRILL-DOWN ENVIADOS AQUI <<<
        assetsBreakdown, 
        statusBreakdown, 
        assetsAdvancedBreakdown, 
        
        recentMovements,
        pendingAlerts,
        expiringWarranties: [] 
    });

  } catch (error) {
    console.error('Erro dashboard V6 Drill-Down:', error);
    res.status(500).json({ message: 'Erro ao carregar dashboard.' });
  }
});

// >>> ROTA DE DETALHES DA MOVIMENTAÇÃO (USADA NO MODAL DE DEVOLUÇÃO) <<<
app.get('/api/asset-movements/:id/details', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Busca a movimentação principal com os dados ENRIQUECIDOS
    const movementResult = await pool.query(
      `SELECT 
         am.*, 
         p.full_name AS recipient_display_name,
         p.id as recipient_person_id,
         
         -- >>> DADOS ADICIONAIS PARA O TERMO DE DEVOLUÇÃO <<<
         p.cpf as recipient_person_cpf,
         p.registration_number as recipient_person_registration,
         u.name as destination_unit_name

       FROM asset_movements am
       LEFT JOIN people p ON am.recipient_person_id = p.id
       LEFT JOIN units u ON am.destination_unit_id = u.id -- JOIN para pegar o nome da unidade
       WHERE am.id = $1`,
      [id]
    );

    if (movementResult.rows.length === 0) {
      return res.status(404).json({ message: 'Movimentação não encontrada.' });
    }
    const movement = movementResult.rows[0];

    // Busca os ativos associados (Mantido igual)
    const assetsResult = await pool.query(
      `SELECT a.id, a.brand, a.model, a.patrimonio_number, a.serial_number, it.name as item_type_name
       FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       LEFT JOIN item_types it ON a.item_type_id = it.id
       WHERE ma.movement_id = $1`,
      [id]
    );
    movement.assets = assetsResult.rows;

    // Busca os periféricos (Mantido igual)
    const peripheralsResult = await pool.query(
      `SELECT peripheral_type, quantity, status 
       FROM movement_peripherals 
       WHERE movement_id = $1 AND status = 'out'`,
      [id]
    );
    movement.peripherals = peripheralsResult.rows;

    res.status(200).json(movement);

  } catch (error) {
    console.error(`Erro ao buscar detalhes da movimentação ${id}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =====================================================================
// GERAR RECIBO OFICIAL (HISTÓRICO) - COM DADOS DE CHIP/IMEI
// =====================================================================
app.get('/api/asset-movements/:id/receipt-pdf', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { simulate_return } = req.query; 
  const ipAddress = req.ip;

  try {
    // 1. Busca Dados da Movimentação (MANTIDO)
    const movementResult = await pool.query(
      `SELECT 
        am.*, 
        u.full_name AS responsible_user_full_name,
        p.full_name AS recipient_display_name,
        p.cpf AS recipient_person_cpf,
        p.registration_number AS recipient_person_registration,
        p.job_title AS recipient_job_title,
        ds.name AS destination_unit_name
      FROM asset_movements am
      JOIN users u ON am.responsible_user_id = u.id
      LEFT JOIN people p ON am.recipient_person_id = p.id
      LEFT JOIN units ds ON am.destination_unit_id = ds.id
      WHERE am.id = $1`,
      [id]
    );

    if (movementResult.rows.length === 0) return res.status(404).json({ message: 'Movimentação não encontrada.' });
    const movement = movementResult.rows[0];

    // 2. Busca Ativos (ATUALIZADO: Adicionado sim_card_number e imei)
    const assetsResult = await pool.query(
      `SELECT 
          a.sku, 
          a.brand, 
          a.model, 
          a.serial_number, 
          a.patrimonio_number, 
          a.sim_card_number,  -- <<< CAMPO ADICIONADO
          a.imei,             -- <<< CAMPO ADICIONADO
          it.name AS item_type_name
       FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       JOIN item_types it ON a.item_type_id = it.id
       WHERE ma.movement_id = $1`,
      [movement.id]
    );
    const assets = assetsResult.rows;

    // 3. Busca Periféricos (MANTIDO)
    const peripheralsResult = await pool.query(
        `SELECT peripheral_type, quantity FROM movement_peripherals WHERE movement_id = $1`,
        [id]
    );
    const peripherals = peripheralsResult.rows;

    // --- CÁLCULO DE TOTAIS E ORIGEM (MANTIDO) ---
    const totalAssets = assets.length;
    const totalPeripherals = peripherals.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

    let requestSource = 'Não informada';
    if (movement.request_channel_type === 'Email') requestSource = 'E-mail para relacionamentosepti@educ.rec.br';
    else if (movement.request_channel_type === 'SEI') requestSource = `Processo SEI Nº ${movement.request_channel_details || 'N/A'}`;
    else if (movement.request_channel_type === 'Ordem Direta') requestSource = `Ordem Direta de ${movement.request_channel_details || 'N/A'}`;

    // --- LOGICA DO TÍTULO E TEXTO ---
    
    // 1. Define se é uma devolução (Real ou Simulada)
    let isReturn = movement.movement_type === 'return';
    
    if (req.query.simulate_return === 'true') {
        isReturn = true; 
    }

    // 2. Define os Títulos e Textos
    let receiptTitle = 'RECIBO DE MOVIMENTAÇÃO';
    let termTitle = 'TERMO DE RESPONSABILIDADE'; 
    let receiptIntroText = [];
    let termBodyText = []; 

    if (isReturn) {
        // --- CASO DEVOLUÇÃO ---
        receiptTitle = 'RECIBO DE DEVOLUÇÃO';
        termTitle = 'TERMO DE DEVOLUÇÃO E DESONERAÇÃO';
        
        receiptIntroText = [
            'Atestamos o ', { text: 'RECEBIMENTO', bold: true }, ' do(s) equipamento(s) abaixo relacionado(s), que encontravam-se sob a guarda do servidor abaixo qualificado.',
            '\nA devolução ocorre devido ao procedimento de DEVOLUÇÃO/RECOLHIMENTO.',
            movement.notes ? `\nMotivo/Obs: ${movement.notes}` : ''
        ];

        termBodyText = [
            {
                text: [
                    'Declaro que ', { text: 'DEVOLVI', bold: true }, ' à Gerência de Infraestrutura de Tecnologia - GIT, todos os equipamentos e acessórios constantes no recibo (verso), os quais foram conferidos pela equipe técnica.',
                    '\n\n',
                    '1. Declaro estar ciente de que a devolução dos equipamentos encerra minha responsabilidade de guarda sobre os mesmos a partir desta data.',
                    '\n\n',
                    '2. Atesto que os equipamentos foram devolvidos nas condições informadas no ato do recebimento pela equipe técnica.'
                ],
                style: 'body', alignment: 'justify', margin: [0, 0, 0, 40]
            }
        ];

    } else {
        // --- CASO EMPRÉSTIMO / SAÍDA ---
        switch (movement.movement_type) {
            case 'loan': receiptTitle = 'RECIBO DE EMPRÉSTIMO'; break;
            case 'exit': receiptTitle = 'RECIBO DE ENTREGA'; termTitle = 'TERMO DE ENTREGA'; break;
            case 'maintenance': receiptTitle = 'GUIA DE MANUTENÇÃO'; break;
        }

        receiptIntroText = [
            'Estamos entregando, por meio da GIT/DIT – Gerência de Infraestrutura de Tecnologia, o(s) equipamento(s) especificado(s) abaixo, para utilização em ',
            { text: movement.destination_unit_name || 'Unidade não informada', bold: true },
            '.',
            movement.notes ? `\nObs.: ${movement.notes}` : ''
        ];

        const movementLabel = movement.movement_type === 'loan' ? 'EMPRÉSTIMO' : 'ENTREGA';
        
        termBodyText = [
             { text: ['Reconheço que recebi o(s) equipamento(s) descrito(s) no recibo constante no verso deste termo, por meio da Gerência de Infraestrutura de Tecnologia - GIT, a título de:\n\n', { text: `( X ) ${movementLabel}`, bold: true, fontSize: 11 }], style: 'body', margin: [0, 0, 0, 15] },
             { text: '1. Caso o(s) equipamento(s) não esteja(m) tombado(s), me comprometo em facilitar o acesso do profissional do Setor de Patrimônio às instalações na qual o(s) equipamento(s) se encontrava(m).', style: 'legalText', margin: [0, 0, 0, 5] },
             { text: '2. Mediante rescisão de contrato, exoneração, aposentadoria ou transferência, comprometo-me a devolver à Gerência de Infraestrutura de Tecnologia - GIT, todos os equipamentos e acessórios que se encontrarem sob minha responsabilidade, que deverão estar completos e em bom estado de conservação e uso, considerando-se o tempo de obsolescência destes.', style: 'legalText', margin: [0, 0, 0, 5] },
             { text: '3. Comprometo-me a NÃO repassar a outra pessoa OU remanejar para outro departamento/setor o(s) equipamento(s) constante(s) neste recibo, sem a prévia autorização da GIT.', style: 'legalText', margin: [0, 0, 0, 5] },
             { text: '4. Estou ciente que se o(s) equipamento(s) for(em) extraviado(s), furtado(s) ou roubado(s), terei que tomar as providências URGENTES abaixo:', style: 'legalText', margin: [0, 0, 0, 2] },
             { text: ' 4.1 Registrar um Boletim de Ocorrência (B.O.) online ou na Delegacia de Polícia mais próxima do local em que ocorreu o fato. Neste B.O. Deverá constar as especificações do(s) equipamento(s) contendo número de TOMBO do patrimônio e número de SÉRIE.', style: 'legalText', margin: [10, 0, 0, 2] },
             { text: ' 4.2 Enviar um ofício citando o ocorrido com cópia anexa do Boletim de Ocorrência para a Gerência de Tecnologia, localizada à Av. Oliveira Lima, 824, Soledade, Recife (Prédio do CETEC) por e-mail (relacionamentosepti@educ.rec.br e dinfraestrutura@educ.rec.br).', style: 'legalText', margin: [10, 0, 0, 15] }
        ];
    }

    // --- MONTAGEM DO PDF (MANTIDA) ---
    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) logoBase64 = fs.readFileSync(logoPath, 'base64');
    
    const getHeader = () => ({
        margin: [30, 20, 30, 10],
        columns: [
            { image: logoBase64 ? `data:image/png;base64,${logoBase64}` : '', width: 50, margin: [0, 5, 20, 0] },
            { stack: [{ text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 }, { text: 'SECRETARIA EXECUTIVA DE PROJETOS, TECNOLOGIA E INOVAÇÃO', fontSize: 8 }, { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 8 }, { text: 'DIVISÃO DE INFRAESTRUTURA EM TECNOLOGIA', fontSize: 8 }], alignment: 'center', margin: [0, 15, 50, 0] }
        ]
    });
    
    const getFooter = () => ({
        margin: [30, 0, 30, 10], stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 1 }] }, { text: 'Gerência de Infraestrutura de Tecnologia', bold: true, alignment: 'center', margin: [0, 3, 0, 0], fontSize: 8 }, { text: 'Av. Oliveira Lima, 824 – Soledade | CEP: 50050-390 | FONE: 3355-5471', alignment: 'center', fontSize: 8 }]
    });

    const getUserInfoBox = () => ({
        table: { widths: ['*', '*', '*'], body: [[{ text: `NOME: ${movement.recipient_display_name || 'N/A'}`, style: 'infoBox' }, { text: `CPF: ${movement.recipient_person_cpf || 'N/A'}`, style: 'infoBox' }, { text: `MATRÍCULA: ${movement.recipient_person_registration || 'N/A'}`, style: 'infoBox' }], [{ text: `UNIDADE: ${movement.destination_unit_name || 'N/A'}`, style: 'infoBox', colSpan: 3 }, {}, {}]] }, layout: 'noBorders', margin: [0, 5, 0, 5]
    });

    const tableBody = [[{ text: 'QTD', style: 'tableHeader', alignment: 'center' }, { text: 'EQUIPAMENTO / ACESSÓRIO', style: 'tableHeader' }, { text: 'SÉRIE', style: 'tableHeader', alignment: 'center' }, { text: 'TOMBAMENTO / SKU', style: 'tableHeader', alignment: 'center' }]];
    
    // --- LÓGICA DE PREENCHIMENTO DA TABELA (ATUALIZADA) ---
    assets.forEach(a => {
        const identificador = a.patrimonio_number ? a.patrimonio_number : (a.sku ? `SKU: ${a.sku}` : '-');
        
        // Monta a descrição, adicionando Chip e IMEI se existirem
        let description = `${a.item_type_name} ${a.brand} ${a.model}`;
        /* >>> BLOQUEIO DO CHIP NO RECIBO <<<
        if (a.sim_card_number) {
            description += `\n(CHIP: ${a.sim_card_number})`;
        }
        */
        if (a.imei) {
            description += `\n(IMEI: ${a.imei})`;
        }

        tableBody.push([
            { text: '1', style: 'tableCell', alignment: 'center' },
            { text: description, style: 'tableCell' }, // Descrição atualizada com quebra de linha
            { text: a.serial_number || '-', style: 'tableCell', alignment: 'center' },
            { text: identificador, style: 'tableCell', alignment: 'center', bold: true }
        ]);
    });

    if (peripherals.length > 0) { peripherals.forEach(p => { tableBody.push([{ text: p.quantity, style: 'tableCell', alignment: 'center' }, { text: `- ${p.peripheral_type}`, style: 'tableCell', italics: true }, { text: '-', style: 'tableCell', alignment: 'center' }, { text: '-', style: 'tableCell', alignment: 'center' }]); }); }
    
    // --- LÓGICA DINÂMICA DAS ASSINATURAS ---
    const techActionLabel = isReturn ? 'Recebendo' : 'Entregando';
    const userActionLabel = isReturn ? 'Devolvendo' : 'Recebendo';
    
    // MONTAGEM FINAL
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 110, 40, 60],
      header: getHeader,
      footer: getFooter,
      content: [
          // PÁGINA 1
          { text: receiptTitle, style: 'docTitle', margin: [0, 10, 0, 20] },
          { text: `Número do Recibo: ${movement.id}/${new Date(movement.movement_date).getFullYear()}`, alignment: 'right', fontSize: 9, margin: [0, 0, 0, 10] },
          { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
          getUserInfoBox(),
          { text: [ { text: 'Origem da Solicitação: ', bold: true }, { text: requestSource } ], fontSize: 9, margin: [0, 0, 0, 15] },
          { text: receiptIntroText, style: 'body', alignment: 'justify', margin: [0, 0, 0, 15] },
          { text: [ { text: `Total de Equipamentos: ${totalAssets}`, bold: true }, { text: `   |   Total de Acessórios: ${totalPeripherals}`, bold: true } ], fontSize: 10, alignment: 'right', margin: [0, 0, 0, 5], color: '#444' },
          { table: { headerRows: 1, widths: [30, '*', 90, 100], body: tableBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 40] },
          { text: `Recife, ${new Date(movement.movement_date).toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 20, 0, 50], fontSize: 10 },
          { columns: [ 
            { stack: [{ text: '______________________________________', alignment: 'center' }, { text: 'Alberto Dantas', bold: true, fontSize: 9, alignment: 'center' }, { text: 'Gerência de Infraestrutura Tecnologia', fontSize: 8, alignment: 'center' }, { text: techActionLabel, fontSize: 8, alignment: 'center', italics: true }] }, 
            { stack: [{ text: '______________________________________', alignment: 'center' }, { text: movement.recipient_display_name || 'Servidor', bold: true, fontSize: 9, alignment: 'center' }, { text: movement.recipient_person_registration ? `Matrícula: ${movement.recipient_person_registration}` : '', fontSize: 8, alignment: 'center' }, { text: userActionLabel, fontSize: 8, alignment: 'center', italics: true }] } 
          ] },
          { text: '', pageBreak: 'after' },
          
          // PÁGINA 2 (Termo)
          { text: termTitle, style: 'docTitle', margin: [0, 0, 0, 20] },
          
          // Renderiza o array de textos do termo
          ...termBodyText,
          
          { text: 'Recebido em ____/____/______', alignment: 'left', margin: [0, 0, 0, 30] },
          { text: `Responsável: ${movement.recipient_display_name || ''}`, fontSize: 10, margin: [0, 0, 0, 5] },
          { text: `Cargo: ${movement.recipient_job_title || ''}`, fontSize: 10, margin: [0, 0, 0, 5] },
          { text: `Setor: ${movement.destination_unit_name || ''}`, fontSize: 10, margin: [0, 0, 0, 5] },
          { text: `Matrícula: ${movement.recipient_person_registration || ''}`, fontSize: 10, margin: [0, 0, 0, 5] },
          { text: `CPF: ${movement.recipient_person_cpf || ''}`, fontSize: 10, margin: [0, 0, 0, 30] },
          { text: '____________________________________________________', alignment: 'center' },
          { text: 'Assinatura', alignment: 'center', fontSize: 9 }
      ],
      styles: { docTitle: { fontSize: 14, bold: true, alignment: 'center', color: '#2c3e50' }, sectionTitle: { fontSize: 10, bold: true, margin: [0, 5, 0, 2], color: '#444' }, infoBox: { fontSize: 9, lineHeight: 1.3 }, body: { fontSize: 10, lineHeight: 1.3 }, tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee', alignment: 'center' }, tableCell: { fontSize: 9 }, legalText: { fontSize: 9, lineHeight: 1.4, color: '#333', alignment: 'justify' } },
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
        const namePart = (movement.recipient_display_name || 'Usuario').replace(/[^a-zA-Z0-9]/g, "_");
        const datePart = new Date(movement.movement_date).toLocaleDateString('pt-BR').replace(/\//g, '-');
        const fileName = `${namePart}_${datePart}.pdf`;
        res.header('Content-Type', 'application/pdf');
        res.header('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();
    
    // Log apenas se não for simulação
    if (simulate_return !== 'true') {
        await logAudit(req.user.id, 'generate_receipt_pdf', 'asset_movement', movement.id, null, ipAddress);
    }

  } catch (error) {
    console.error('Erro ao gerar recibo PDF:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar recibo.' });
  }
});

// =====================================================================
// RELATÓRIO UNIFICADO: SUBSTITUIÇÃO TÉCNICA (DEVOLUÇÃO + NOVA ENTREGA)
// =====================================================================
app.get('/api/reports/substitution-full/:returnId/:exitId', authenticateToken, async (req, res) => {
  const { returnId, exitId } = req.params;
  const ipAddress = req.ip;

  try {
    // 1. CARREGAR LOGOTIPO
    const logoPath = path.join(__dirname, 'assets/brasao-recife.png'); // Ajuste se a pasta for '../assets'
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) logoBase64 = fs.readFileSync(logoPath, 'base64');

    // --- FUNÇÃO HELPER: BUSCAR DADOS COMPLETOS ---
    const getMovementData = async (movementId) => {
      // Busca dados principais da movimentação e pessoas
      const movRes = await pool.query(`
        SELECT 
          am.*, 
          u.full_name AS responsible_user_full_name,
          p.full_name AS recipient_display_name,
          p.cpf AS recipient_person_cpf,
          p.registration_number AS recipient_person_registration,
          p.job_title AS recipient_job_title,
          ds.name AS destination_unit_name
        FROM asset_movements am
        JOIN users u ON am.responsible_user_id = u.id
        LEFT JOIN people p ON am.recipient_person_id = p.id
        LEFT JOIN units ds ON am.destination_unit_id = ds.id
        WHERE am.id = $1`, [movementId]);
      
      if (movRes.rows.length === 0) return null;
      const movement = movRes.rows[0];

      // Busca os ativos
      const assetsRes = await pool.query(`
        SELECT a.sku, a.brand, a.model, a.serial_number, a.patrimonio_number, it.name AS item_type_name
        FROM movement_assets ma
        JOIN assets a ON ma.asset_id = a.id
        JOIN item_types it ON a.item_type_id = it.id
        WHERE ma.movement_id = $1`, [movementId]);

      // Busca periféricos
      const periphRes = await pool.query(
        `SELECT peripheral_type, quantity FROM movement_peripherals WHERE movement_id = $1`, 
        [movementId]
      );

      return { movement, assets: assetsRes.rows, peripherals: periphRes.rows };
    };

    // 2. BUSCAR DADOS DAS DUAS OPERAÇÕES
    const dataReturn = await getMovementData(returnId);
    const dataExit = await getMovementData(exitId);

    if (!dataReturn || !dataExit) {
        return res.status(404).json({ message: 'Dados da substituição não encontrados.' });
    }

    // 3. DEFINIR ESTILOS (Padrão do seu sistema)
    const styles = {
        docTitle: { fontSize: 14, bold: true, alignment: 'center', color: '#2c3e50', margin: [0, 0, 0, 10] },
        sectionTitle: { fontSize: 10, bold: true, margin: [0, 5, 0, 2], color: '#444' },
        infoBox: { fontSize: 9, lineHeight: 1.3, background: '#f8f9fa' },
        body: { fontSize: 10, lineHeight: 1.3, alignment: 'justify' },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee', alignment: 'center' },
        tableCell: { fontSize: 9 },
        legalText: { fontSize: 9, lineHeight: 1.4, color: '#333', alignment: 'justify' }
    };

    // --- HELPER: CABEÇALHO PADRÃO ---
    const getHeader = () => ({
        margin: [30, 20, 30, 10],
        columns: [
            { image: logoBase64 ? `data:image/png;base64,${logoBase64}` : '', width: 50, margin: [0, 5, 20, 0] },
            { 
              stack: [
                { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, 
                { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 }, 
                { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 }
              ], 
              alignment: 'center', margin: [0, 15, 50, 0] 
            }
        ]
    });

    // --- HELPER: CAIXA DE DADOS DO USUÁRIO ---
    const getUserInfoBox = (data) => ({
      table: { 
        widths: ['*', '*', '*'], 
        body: [
          [
            { text: `NOME: ${data.recipient_display_name || 'N/A'}`, style: 'infoBox' }, 
            { text: `CPF: ${data.recipient_person_cpf || 'N/A'}`, style: 'infoBox' }, 
            { text: `MATRÍCULA: ${data.recipient_person_registration || 'N/A'}`, style: 'infoBox' }
          ], 
          [
            { text: `UNIDADE: ${data.destination_unit_name || 'N/A'}`, style: 'infoBox', colSpan: 3 }, {}, {}
          ]
        ] 
      }, 
      layout: 'noBorders', margin: [0, 5, 0, 15]
    });

    // --- CONSTRUÇÃO DA PÁGINA 1: DEVOLUÇÃO ---
    const tableBodyReturn = [[ { text: 'QTD', style: 'tableHeader' }, { text: 'EQUIPAMENTO DEVOLVIDO', style: 'tableHeader' }, { text: 'PATRIMÔNIO', style: 'tableHeader' } ]];
    
    dataReturn.assets.forEach(a => {
        tableBodyReturn.push([
            { text: '1', style: 'tableCell', alignment: 'center' },
            { text: `${a.item_type_name} ${a.brand} ${a.model}`, style: 'tableCell' },
            { text: a.patrimonio_number || '-', style: 'tableCell', alignment: 'center', bold: true }
        ]);
    });

    const contentReturn = [
        { text: 'RECIBO DE DEVOLUÇÃO (SUBSTITUIÇÃO)', style: 'docTitle' },
        { text: `Número do Recibo: ${dataReturn.movement.id}/${new Date(dataReturn.movement.movement_date).getFullYear()}`, alignment: 'right', fontSize: 9, margin: [0, 0, 0, 10] },
        
        { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
        getUserInfoBox(dataReturn.movement),

        { 
          text: [
            'Declaramos o ', { text: 'RECEBIMENTO/RECOLHIMENTO', bold: true }, 
            ' do(s) equipamento(s) abaixo, anteriormente sob a guarda do servidor.\n',
            dataReturn.movement.notes ? `Obs: ${dataReturn.movement.notes}` : ''
          ], 
          style: 'body', margin: [0, 0, 0, 10] 
        },
        
        { table: { headerRows: 1, widths: [30, '*', 100], body: tableBodyReturn }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 20] },
        
        { text: 'O item acima foi recolhido para fins de substituição técnica e o servidor fica desonerado da responsabilidade sobre este bem específico a partir desta data.', style: 'legalText', margin: [0, 0, 0, 40] },
        
        { text: `Recife, ${new Date(dataReturn.movement.movement_date).toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 0, 0, 40] },

        { columns: [
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: dataReturn.movement.recipient_display_name, fontSize: 8, alignment: 'center' }, { text: 'Devolvendo', fontSize: 8, alignment: 'center', italics: true }] },
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center', italics: true }] }
        ]}
    ];

    // --- CONSTRUÇÃO DA PÁGINA 2: ENTREGA ---
    const tableBodyDelivery = [[ { text: 'QTD', style: 'tableHeader' }, { text: 'EQUIPAMENTO ENTREGUE', style: 'tableHeader' }, { text: 'PATRIMÔNIO', style: 'tableHeader' } ]];
    
    dataExit.assets.forEach(a => {
        tableBodyDelivery.push([
            { text: '1', style: 'tableCell', alignment: 'center' },
            { text: `${a.item_type_name} ${a.brand} ${a.model}`, style: 'tableCell' },
            { text: a.patrimonio_number || '-', style: 'tableCell', alignment: 'center', bold: true }
        ]);
    });
    // Adiciona acessórios
    dataExit.peripherals.forEach(p => {
        tableBodyDelivery.push([
            { text: p.quantity, style: 'tableCell', alignment: 'center' }, 
            { text: `Acessório: ${p.peripheral_type}`, style: 'tableCell', italics: true }, 
            { text: '-', style: 'tableCell', alignment: 'center' }
        ]);
    });

    const contentDelivery = [
        { text: 'RECIBO DE ENTREGA E TERMO DE RESPONSABILIDADE', style: 'docTitle', margin: [0, 0, 0, 10] },
        { text: `Número do Recibo: ${dataExit.movement.id}/${new Date(dataExit.movement.movement_date).getFullYear()}`, alignment: 'right', fontSize: 9, margin: [0, 0, 0, 10] },
        
        { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
        getUserInfoBox(dataExit.movement),

        { 
          text: [
            'Recebi da Gerência de Infraestrutura de Tecnologia (GIT) o(s) equipamento(s) novo(s) listado(s) abaixo, em substituição ao item devolvido anteriormente.\n',
            dataExit.movement.notes ? `Obs: ${dataExit.movement.notes}` : ''
          ], 
          style: 'body', margin: [0, 0, 0, 10] 
        },

        { table: { headerRows: 1, widths: [30, '*', 100], body: tableBodyDelivery }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 20] },

        { text: 'TERMOS E CONDIÇÕES:', style: 'sectionTitle' },
        { ul: [
            'Comprometo-me a zelar pela guarda, conservação e uso adequado do equipamento.',
            'Comprometo-me a utilizar o bem estritamente para fins profissionais no âmbito da Secretaria.',
            'Em caso de roubo ou furto, apresentarei o Boletim de Ocorrência (B.O.) imediatamente.',
            'Comprometo-me a devolver este equipamento quando solicitado ou ao fim do vínculo.'
          ], style: 'legalText', margin: [0, 0, 0, 40] 
        },

        { text: `Recife, ${new Date(dataExit.movement.movement_date).toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 0, 0, 40] },

        { columns: [
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, alignment: 'center' }, { text: 'Entregando', fontSize: 8, alignment: 'center', italics: true }] },
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: dataExit.movement.recipient_display_name, fontSize: 8, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center', italics: true }] }
        ]}
    ];

    // 4. MONTAR E GERAR O PDF
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 110, 40, 60],
      header: getHeader,
      footer: {
        margin: [40, 0, 40, 20],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] },
          { text: 'Gerência de Infraestrutura de Tecnologia - Sistema SGA', fontSize: 8, alignment: 'center', margin: [0, 5, 0, 0] }
        ]
      },
      content: [
        ...contentReturn,
        { text: '', pageBreak: 'after' }, // QUEBRA DE PÁGINA ENTRE A DEVOLUÇÃO E A ENTREGA
        ...contentDelivery
      ],
      styles: styles,
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', `inline; filename=Substituicao_${returnId}_${exitId}.pdf`);
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();

    await logAudit(req.user.id, 'generate_report', 'substitution_full_pdf', exitId, null, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar relatório de substituição:', error);
    res.status(500).json({ message: 'Erro ao gerar o PDF unificado.' });
  }
});

// =====================================================================
// RELATÓRIO GERENCIAL: MATRIZ DE INVENTÁRIO (V4 - REAL TIME / EXCELJS)
// Substitui a rota antiga '/api/reports/management/inventory-by-unit/xlsx'
// Cruzamento: UNIDADE (Linhas) x TIPO DE ITEM (Colunas)
// =====================================================================
app.get('/api/reports/management/inventory-by-unit/xlsx', authenticateToken, async (req, res) => {
    const ipAddress = req.ip;
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inventário Geral');

        // 1. Buscar todos os Tipos de Itens (para criar as colunas dinamicamente)
        const typesRes = await pool.query('SELECT id, name FROM item_types ORDER BY name ASC');
        const itemTypes = typesRes.rows;

        // 2. Buscar dados brutos (Contagem direta na tabela ASSETS - Fiel ao Dossiê)
        // Agrupa por Unidade e Tipo de Item.
        // Filtramos fora 'disposed' e 'retired' para contar apenas o ACERVO ATIVO da rede.
        const dataQuery = `
            SELECT 
                COALESCE(u.name, 'Estoque Central / Sem Unidade') as unit_name,
                u.type as unit_type,
                it.name as item_type,
                COUNT(a.id) as quantity
            FROM assets a
            LEFT JOIN units u ON a.current_unit_id = u.id
            JOIN item_types it ON a.item_type_id = it.id
            WHERE a.status NOT IN ('disposed', 'retired', 'missing') 
            GROUP BY u.name, u.type, it.name
            ORDER BY u.name ASC
        `;
        
        const dataRes = await pool.query(dataQuery);
        const rows = dataRes.rows;

        // 3. Processamento de Dados (Pivot Table / Matriz)
        // Transforma a lista plana em um objeto: { 'Escola A': { type: 'ESCOLAR', totals: { 'Mouse': 5, 'Monitor': 10 } } }
        const matrix = {};
        
        rows.forEach(row => {
            const uName = row.unit_name;
            if (!matrix[uName]) {
                matrix[uName] = { 
                    type: row.unit_type || 'OUTROS',
                    totals: {} 
                };
            }
            matrix[uName].totals[row.item_type] = parseInt(row.quantity);
        });

        // 4. Configurar Cabeçalhos do Excel
        const columns = [
            { header: 'UNIDADE / SETOR', key: 'unit', width: 45 },
            { header: 'TIPO UNID.', key: 'type', width: 15 },
        ];

        // Adiciona uma coluna para cada Tipo de Item existente no banco
        itemTypes.forEach(type => {
            columns.push({ header: type.name.toUpperCase(), key: `type_${type.id}`, width: 15 });
        });

        // Coluna Totalizador da Linha
        columns.push({ header: 'TOTAL', key: 'total_row', width: 12 });

        worksheet.columns = columns;

        // --- ESTILIZAÇÃO DO CABEÇALHO ---
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } }; // Azul Escuro Institucional
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25; 

        // Ajusta alinhamento da primeira coluna (Nome da Unidade) para a esquerda
        worksheet.getColumn(1).alignment = { vertical: 'middle', horizontal: 'left' };

        // 5. Preencher Linhas
        Object.keys(matrix).forEach(unitName => {
            const unitData = matrix[unitName];
            const rowValues = {
                unit: unitName,
                type: unitData.type
            };

            let rowTotal = 0;

            // Preenche a quantidade para cada coluna de tipo
            itemTypes.forEach(type => {
                const qtd = unitData.totals[type.name] || 0;
                
                // Se for zero, coloca '-' para limpar visualmente, senão o número
                rowValues[`type_${type.id}`] = qtd > 0 ? qtd : '-'; 
                rowTotal += qtd;
            });

            rowValues['total_row'] = rowTotal;

            const newRow = worksheet.addRow(rowValues);
            
            // Centraliza os números
            for (let i = 2; i <= columns.length; i++) {
                newRow.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' };
            }

            // Zebra Striping (Cinza claro nas linhas pares para facilitar leitura)
            if (worksheet.rowCount % 2 === 0) {
                newRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            }
        });

        // 6. Adicionar Linha de Totais Gerais no Final
        const totalRowValues = { unit: 'TOTAL GERAL DA REDE', type: '' };
        let grandTotal = 0;
        
        itemTypes.forEach(type => {
            // Soma a coluna inteira
            let colTotal = 0;
            Object.values(matrix).forEach(u => {
                colTotal += (u.totals[type.name] || 0);
            });
            totalRowValues[`type_${type.id}`] = colTotal;
            grandTotal += colTotal;
        });
        totalRowValues['total_row'] = grandTotal;

        const footerRow = worksheet.addRow(totalRowValues);
        footerRow.font = { bold: true };
        footerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } }; // Cinza mais escuro
        for (let i = 3; i <= columns.length; i++) {
            footerRow.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // 7. Enviar Arquivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Inventario_Geral_Consolidado.xlsx');

        await workbook.xlsx.write(res);
        res.end();

        await logAudit(req.user.id, 'generate_report', 'inventory_matrix_v4', null, null, ipAddress);

    } catch (error) {
        console.error('Erro ao gerar relatório matriz:', error);
        res.status(500).json({ message: 'Erro ao gerar planilha.' });
    }
});

// =====================================================================
// RELATÓRIO: EXTRATO DETALHADO DE MOVIMENTAÇÕES (XLSX)
// Substitui a antiga versão que só contava números.
// Agora mostra: Quem, Onde, O Que e Porquê.
// =====================================================================
app.get('/api/reports/management/movements-summary/xlsx', authenticateToken, async (req, res) => {
    const { startDate, endDate } = req.query; 
    
    try {
        // Query rica com JOINs para pegar nomes e detalhes
        let query = `
            SELECT 
                am.id,
                am.movement_date,
                am.movement_type,
                am.delivery_status,
                am.notes,
                am.purpose,
                u.full_name as responsible_name,    -- Técnico que operou
                p.full_name as recipient_name,      -- Beneficiário
                un.name as unit_name,               -- Destino/Origem
                -- Agrega os itens da movimentação em uma única string (Ex: "Notebook Dell, Mouse HP")
                STRING_AGG(DISTINCT CONCAT(it.name, ' ', a.brand, ' ', a.model, ' (', a.patrimonio_number, ')'), ', ') as items_list
            FROM asset_movements am
            LEFT JOIN users u ON am.responsible_user_id = u.id
            LEFT JOIN people p ON am.recipient_person_id = p.id
            LEFT JOIN units un ON am.destination_unit_id = un.id
            LEFT JOIN movement_assets ma ON am.id = ma.movement_id
            LEFT JOIN assets a ON ma.asset_id = a.id
            LEFT JOIN item_types it ON a.item_type_id = it.id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Filtros de Data (usando ::date para pegar o dia todo)
        if (startDate) {
            params.push(startDate);
            query += ` AND am.movement_date::date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            query += ` AND am.movement_date::date <= $${params.length}`;
        }

        // Agrupamento necessário por causa do STRING_AGG
        query += ` 
            GROUP BY am.id, u.full_name, p.full_name, un.name
            ORDER BY am.movement_date DESC, am.id DESC
        `;

        const result = await pool.query(query, params);

        // Mapeamento de Tipos para Português
        const typeMap = {
            'entry': 'Entrada (Aquisição)',
            'exit': 'Saída Definitiva',
            'loan': 'Empréstimo',
            'return': 'Devolução',
            'maintenance': 'Manutenção'
        };

        // Formatação dos Dados para o Excel
        const data = result.rows.map(row => {
            // Lógica inteligente para o campo "Detalhes/Motivo"
            // Se for substituição, geralmente está no 'notes' ou 'purpose'
            let details = row.purpose || row.notes || '';
            
            // Limpa quebras de linha para o Excel ficar bonito
            details = details.replace(/\n/g, ' ').trim();

            return {
                id: row.id,
                date: new Date(row.movement_date).toLocaleDateString('pt-BR') + ' ' + new Date(row.movement_date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
                type: typeMap[row.movement_type] || row.movement_type,
                items: row.items_list || 'Sem itens vinculados',
                origin_dest: row.unit_name || 'Estoque Central',
                person: row.recipient_name || 'N/A',
                tech: row.responsible_name || 'Sistema',
                details: details
            };
        });

        // Configuração das Colunas (Largas para caber texto)
        const columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'DATA/HORA', key: 'date', width: 20 },
            { header: 'TIPO', key: 'type', width: 20 },
            { header: 'ITENS MOVIMENTADOS', key: 'items', width: 60 }, // Coluna Larga
            { header: 'UNIDADE (DESTINO/ORIGEM)', key: 'origin_dest', width: 35 },
            { header: 'SOLICITANTE / BENEFICIÁRIO', key: 'person', width: 30 },
            { header: 'TÉCNICO RESPONSÁVEL', key: 'tech', width: 25 },
            { header: 'MOTIVO / OBSERVAÇÕES', key: 'details', width: 50 }, // Aqui aparecem as substituições
        ];

        // Usa nosso gerador estilizado
        await generateStyledExcel(res, 'Extrato de Movimentações', 'Extrato_Detalhado.xlsx', columns, data);

    } catch (error) {
        console.error('Erro ao gerar extrato detalhado:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
});

// =====================================================================
// ROTA DE PRÉVIA DE SUBSTITUIÇÃO (CORRIGIDA: LÊ PERIFÉRICOS DO FRONTEND)
// =====================================================================
app.post('/api/reports/preview-substitution-term', authenticateToken, async (req, res) => {
  try {
    const { 
        recipient_name, recipient_cpf, recipient_registration, unit_name, 
        old_assets, new_assets, reason, peripherals,
        chipScope 
    } = req.body;

    // 1. TRATAMENTO ROBUSTO DOS PERIFÉRICOS
    // O Frontend envia: { list: ['Mouse', 'Teclado'] }
    let periphList = [];
    
    let rawPeriph = peripherals;
    // Se vier como string JSON (comum em uploads de arquivo/FormData), faz parse
    if (typeof rawPeriph === 'string') {
        try { rawPeriph = JSON.parse(rawPeriph); } catch (e) {}
    }

    if (rawPeriph) {
        if (Array.isArray(rawPeriph)) {
            // Caso 1: Envio direto array ['Mouse']
            periphList = rawPeriph;
        } else if (rawPeriph.list && Array.isArray(rawPeriph.list)) {
            // Caso 2 (SEU CASO): Envio do Modal { list: ['Mouse'] }
            periphList = rawPeriph.list;
        } else if (typeof rawPeriph === 'object') {
            // Caso 3: Legado { Mouse: true }
            periphList = Object.keys(rawPeriph).filter(k => rawPeriph[k] === true);
        }
    }

    // 2. Logo
    let logoBase64 = null;
    const pathsToTry = [
        path.join(__dirname, 'assets/brasao-recife.png'),
        path.join(__dirname, '../assets/brasao-recife.png'),
        path.join(__dirname, 'public/assets/brasao-recife.png')
    ];
    for (const p of pathsToTry) {
        if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} }
    }

    // 3. Estilos
    const styles = {
        docTitle: { fontSize: 12, bold: true, alignment: 'center', color: '#000', margin: [0, 10, 0, 10] },
        sectionTitle: { fontSize: 10, bold: true, margin: [0, 5, 0, 2], color: '#444' },
        infoBox: { fontSize: 9, lineHeight: 1.2 },
        tableHeader: { bold: true, fontSize: 8, fillColor: '#f0f0f0', alignment: 'center', color: 'black' },
        tableCell: { fontSize: 8, alignment: 'center' },
        tableCellLeft: { fontSize: 8, alignment: 'left' },
        legalText: { fontSize: 9, lineHeight: 1.3, alignment: 'justify', margin: [0, 2, 0, 2] },
        signatureBox: { fontSize: 8, alignment: 'center', italics: true }
    };

    const getHeader = () => ({
        margin: [30, 15, 30, 5],
        columns: [
            logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 45, margin: [0, 0, 10, 0] } : { text: '', width: 45 },
            { stack: [ 
                { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 10 }, 
                { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 9 }, 
                { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 8 } 
            ], alignment: 'center', margin: [0, 5, 45, 0] }
        ]
    });

    const getUserInfoBox = () => ({
      margin: [0, 5, 0, 10],
      columns: [
          { width: '*', stack: [
              { text: `NOME: ${recipient_name || ''}`, style: 'infoBox', bold: true },
              { text: `UNIDADE: ${unit_name || ''}`, style: 'infoBox' }
          ]},
          { width: 150, stack: [
              { text: `MATRÍCULA: ${recipient_registration || ''}`, style: 'infoBox' },
              { text: `CPF: ${recipient_cpf || ''}`, style: 'infoBox' }
          ]}
      ]
    });

    // --- HELPER: CONSTRUTOR DE LINHAS DA TABELA ---
    const buildTableRows = (assets, isDelivery) => {
        const rows = [[ 
            { text: 'QTD', style: 'tableHeader', width: 25 }, 
            { text: 'EQUIPAMENTO / ACESSÓRIO', style: 'tableHeader', width: '*' }, 
            { text: 'SÉRIE', style: 'tableHeader', width: 70 }, 
            { text: 'ID / PATRIMÔNIO / CHIP', style: 'tableHeader', width: 90 } 
        ]];

        // 1. ATIVOS PRINCIPAIS
        (assets || []).forEach(a => {
            let desc = `${a.item_type_name || 'Equipamento'} ${a.brand || ''} ${a.model || ''}`.toUpperCase();
            let serial = a.serial_number || '-';
            let idValue = a.patrimonio_number || '-';

            // Lógica de Tablet
            if (chipScope === 'chip_only') {
                desc = 'CHIP DE DADOS MÓVEIS (SIM CARD)';
                serial = 'N/A';
                idValue = a.sim_card_number || 'N/A';
            } else if (chipScope === 'both') {
                if (a.sim_card_number) desc += `\n+ CHIP: ${a.sim_card_number}`;
                if (a.imei) desc += `\n(IMEI: ${a.imei})`;
            } 

            if (a._isKept) desc = `(ITEM MANTIDO / CONFERIDO)\n${desc}`;
            
            rows.push([
                { text: '1', style: 'tableCell' },
                { text: desc, style: 'tableCellLeft' },
                { text: serial, style: 'tableCell' },
                { text: idValue, style: 'tableCell', bold: true }
            ]);
        });

        // 2. PERIFÉRICOS (Apenas na Entrega)
        // Se a lista existir (o que significa que o usuário marcou no modal), imprimimos.
        if (isDelivery && periphList && periphList.length > 0) {
            periphList.forEach(itemName => {
                // Filtra strings vazias ou inválidas
                if (itemName && typeof itemName === 'string') {
                    rows.push([
                        { text: '1', style: 'tableCell', alignment: 'center' },
                        { text: `- ${itemName.toUpperCase()}`, style: 'tableCellLeft', italics: true },
                        { text: '-', style: 'tableCell', alignment: 'center' },
                        { text: '-', style: 'tableCell', alignment: 'center' }
                    ]);
                }
            });
        }

        return rows;
    };

    // =========================================================
    // PÁGINA 1: RECIBO DE DEVOLUÇÃO
    // =========================================================
    const contentReturn = [
        { text: 'RECIBO DE DEVOLUÇÃO (SUBSTITUIÇÃO)', style: 'docTitle' },
        { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
        getUserInfoBox(),
        { text: [ 'Atestamos o ', { text: 'RECOLHIMENTO', bold: true }, ' dos itens abaixo.\n', { text: `Motivo: ${reason || '-'}`, italics: true } ], style: 'infoBox', margin: [0, 0, 0, 5] },
        
        // isDelivery = false (Não imprime periféricos na devolução)
        { table: { headerRows: 1, widths: [25, '*', 70, 90], body: buildTableRows(old_assets, false) }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 10] },

        // VISTORIA TÉCNICA (Só se não for apenas chip)
        ...(chipScope === 'chip_only' ? [] : [
            { text: 'CONFERÊNCIA TÉCNICA DE DEVOLUÇÃO (VISTORIA)', style: 'sectionTitle', margin: [0, 10, 0, 5], color: '#b91c1c' },
            { 
                table: { widths: ['25%', '25%', '25%', '25%'], body: [[ { text: '[   ] Mouse', fontSize: 8 }, { text: '[   ] Teclado', fontSize: 8 }, { text: '[   ] Fonte', fontSize: 8 }, { text: '[   ] Cabos', fontSize: 8 } ]] },
                layout: 'noBorders', margin: [0, 0, 0, 5]
            },
            { text: 'Observações sobre o Estado de Conservação:', fontSize: 8, bold: true },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 20, 0, 0] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 20, 0, 0] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 20, 0, 0] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 20, 0, 0] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 20, 0, 0] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 20, 0, 20] },
        ]),
        
        ...(chipScope === 'chip_only' ? [{ text: 'Declaro a devolução do Chip/Sim Card acima identificado.', fontSize: 10, margin: [0,20,0,20] }] : []),

        { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 10, 0, 30], fontSize: 9 },
        { columns: [ 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: recipient_name, fontSize: 8, bold: true, alignment: 'center' }, { text: 'Devolvendo', fontSize: 8, alignment: 'center' }] }, 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, bold: true, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center' }] } 
        ]}
    ];

    // =========================================================
    // PÁGINA 2: RECIBO DE ENTREGA
    // =========================================================
    const contentDelivery = [
        { text: 'RECIBO DE ENTREGA (SUBSTITUIÇÃO)', style: 'docTitle' },
        { text: 'DADOS DO RESPONSÁVEL', style: 'sectionTitle' },
        getUserInfoBox(),
        { text: 'Estamos entregando o(s) item(ns) abaixo em substituição.', style: 'infoBox', margin: [0, 0, 0, 5] },
        
        // isDelivery = true (IMPRIME PERIFÉRICOS SE TIVER LISTA)
        { table: { headerRows: 1, widths: [25, '*', 70, 90], body: buildTableRows(new_assets, true) }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 10] },
        
        { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 20, 0, 40], fontSize: 9 },
        { columns: [ 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: 'Técnico Responsável', fontSize: 8, bold: true, alignment: 'center' }, { text: 'Entregando', fontSize: 8, alignment: 'center' }] }, 
            { stack: [{ text: '_______________________________', alignment: 'center' }, { text: recipient_name, fontSize: 8, bold: true, alignment: 'center' }, { text: 'Recebendo', fontSize: 8, alignment: 'center' }] } 
        ]}
    ];

    // =========================================================
    // PÁGINA 3: TERMO DE RESPONSABILIDADE
    // =========================================================
    const contentTerm = [
        { text: 'TERMO DE RESPONSABILIDADE', style: 'docTitle', margin: [0, 0, 0, 10] },
        { text: [ 'Reconheço que recebi o(s) equipamento(s) descrito(s) no recibo constante no verso deste termo, por meio da Gerência de Infraestrutura de Tecnologia - GIT, a título de:\n\n', { text: '( X ) EMPRÉSTIMO / SUBSTITUIÇÃO', bold: true, fontSize: 10 } ], style: 'legalText', margin: [0, 0, 0, 15] },
        
        { text: '1. Caso o(s) equipamento(s) não esteja(m) tombado(s), me comprometo em facilitar o acesso do profissional do Setor de Patrimônio às instalações na qual o(s) equipamento(s) se encontrava(m).', style: 'legalText' },
        { text: '2. Mediante rescisão de contrato, exoneração, aposentadoria ou transferência, comprometo-me a devolver à Gerência de Infraestrutura de Tecnologia GIT, todos os equipamentos e acessórios que se encontrarem sob minha responsabilidade, que deverão estar completos e em bom estado de conservação e uso.', style: 'legalText' },
        { text: '3. Comprometo me a NÃO repassar a outra pessoa OU remanejar para outro departamento/ setor o(s) equipamento(s) constante(s) neste recibo, sem a prévia autorização da GIT.', style: 'legalText' },
        { text: '4. Estou ciente que se o(s) equipamento(s) for(em) extraviado(s), furtado(s) ou roubado(s), terei que tomar as providências URGENTES abaixo:', style: 'legalText', margin: [0, 5, 0, 2] },
        { text: '   4.1 Registrar um Boletim de Ocorrência (B.O.) online.', style: 'legalText', margin: [0, 2, 0, 2] },
        { text: '   4.2 Enviar ofício com B.O. para a Gerência de Tecnologia.', style: 'legalText', margin: [0, 2, 0, 15] },

        { text: 'Recebido em ____/____/______', margin: [0, 20, 0, 10], fontSize: 9 },
        { stack: [
            { text: `Responsável: ${recipient_name}`, bold: true },
            { text: `Setor: ${unit_name}` },
            { text: `Matrícula: ${recipient_registration}` },
            { text: `CPF: ${recipient_cpf}` }
        ], style: 'infoBox', margin: [0, 0, 0, 30] },
        { text: '____________________________________________________', alignment: 'center' },
        { text: 'Assinatura', alignment: 'center', fontSize: 8 }
    ];

    const docDefinition = {
      pageSize: 'A4', pageMargins: [40, 90, 40, 40], header: getHeader(),
      footer: (page) => ({ margin: [40, 0, 40, 10], stack: [ { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] }, { text: 'Av. Oliveira Lima, 824 - Soledade | CEP: 50050-390 | FONE: 3355-5471', alignment: 'center', fontSize: 7, margin: [0, 3, 0, 0] } ] }),
      content: [ ...contentReturn, { text: '', pageBreak: 'after' }, ...contentDelivery, { text: '', pageBreak: 'after' }, ...contentTerm ],
      styles: styles, defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', c => chunks.push(c));
    pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
    pdfDoc.end();
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar PDF: ' + error.message }); }
});

// =====================================================================
// [FIX KIT] INICIAR SUBSTITUIÇÃO (SALVA RASCUNHO + DADOS TÉCNICOS)
// =====================================================================
app.post('/api/substitutions/start', authenticateToken, authorizePermission('ACTION_REGISTER_MOVEMENT'), async (req, res) => {
    // Agora recebemos arrays e objetos extras, INCLUINDO DADOS DO CHIP
    let { 
        oldAssetIds, newAssetIds, 
        oldMonitorId, newMonitorId, 
        peripherals, 
        recipient_person_id, destination_unit_id, reason,
        // Novos campos vindos do Modal de Tablet
        new_sim_number, new_imei 
    } = req.body;

    // Função auxiliar para limpar IDs
    const parseId = (val) => {
        const parsed = parseInt(val);
        return isNaN(parsed) ? null : parsed;
    };

    const mainOldId = parseId(Array.isArray(oldAssetIds) ? oldAssetIds[0] : oldAssetIds);
    const mainNewId = parseId(Array.isArray(newAssetIds) ? newAssetIds[0] : newAssetIds);
    const monOldId = parseId(oldMonitorId);
    const monNewId = parseId(newMonitorId);

    if (!mainOldId || !mainNewId) {
        return res.status(400).json({ message: "IDs dos ativos principais são obrigatórios." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // >>> NOVO: SE FOR TABLET, JÁ GRAVA OS DADOS NO NOVO ATIVO <<<
        // Isso garante que o recibo gerado a seguir já tenha o Chip/IMEI correto
        if (new_sim_number || new_imei) {
             // Busca se é tablet para garantir
             const typeCheck = await client.query(
                `SELECT t.name FROM assets a JOIN item_types t ON a.item_type_id = t.id WHERE a.id = $1`, 
                [mainNewId]
             );
             
             if (typeCheck.rows.length > 0 && typeCheck.rows[0].name.toUpperCase().includes('TABLET')) {
                 await client.query(`
                    UPDATE assets 
                    SET sim_card_number = COALESCE($1, sim_card_number), 
                        imei = COALESCE($2, imei),
                        updated_at = NOW()
                    WHERE id = $3
                 `, [new_sim_number || null, new_imei || null, mainNewId]);
             }
        }
        // -----------------------------------------------------------

        // A. Salva Pendência com os dados do KIT
        const pendRes = await client.query(
            `INSERT INTO pending_substitutions 
            (old_asset_id, new_asset_id, old_monitor_id, new_monitor_id, peripherals, recipient_person_id, destination_unit_id, reason, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [mainOldId, mainNewId, monOldId, monNewId, JSON.stringify(peripherals || {}), recipient_person_id, destination_unit_id, reason, req.user.id]
        );
        const pendingId = pendRes.rows[0].id;

        // B. TRAVA DE SEGURANÇA (Status 'maintenance')
        const lockNote = `\n[SISTEMA] Bloqueado para substituição (ID Pendência: ${pendingId}).`;
        await client.query("UPDATE assets SET status = 'maintenance', notes = COALESCE(notes, '') || $1 WHERE id = $2", [lockNote, mainOldId]);
        await client.query("UPDATE assets SET status = 'maintenance', notes = COALESCE(notes, '') || $1 WHERE id = $2", [lockNote, mainNewId]);

        if (monOldId) await client.query("UPDATE assets SET status = 'maintenance', notes = COALESCE(notes, '') || $1 WHERE id = $2", [lockNote, monOldId]);
        if (monNewId) await client.query("UPDATE assets SET status = 'maintenance', notes = COALESCE(notes, '') || $1 WHERE id = $2", [lockNote, monNewId]);

        await client.query('COMMIT');
        
        // Retorna o ID da pendência para o frontend (pode ser usado para gerar prévia se necessário)
        res.json({ message: 'Substituição iniciada. Ativos travados.', pendingId: pendingId });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Erro ao salvar pendência: ' + e.message });
    } finally {
        client.release();
    }
});

// 2. ROTA: LISTAR PENDÊNCIAS (Para a aba "Substituições Pendentes")
app.get('/api/substitutions/pending', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ps.*, 
                   p.full_name as recipient_name, 
                   
                   -- Ativo Principal (Antigo)
                   old.patrimonio_number as old_pat, 
                   old.model as old_model,
                   old.brand as old_brand,
                   
                   -- Monitor Antigo (Opcional)
                   old_mon.patrimonio_number as old_mon_pat,
                   old_mon.model as old_mon_model,

                   -- Ativo Principal (Novo)
                   new.patrimonio_number as new_pat, 
                   new.model as new_model,
                   new.brand as new_brand,

                   -- Monitor Novo (Opcional)
                   new_mon.patrimonio_number as new_mon_pat,
                   new_mon.model as new_mon_model

            FROM pending_substitutions ps
            JOIN people p ON ps.recipient_person_id = p.id
            
            -- Joins dos Principais
            JOIN assets old ON ps.old_asset_id = old.id
            JOIN assets new ON ps.new_asset_id = new.id
            
            -- Joins dos Monitores (LEFT JOIN pois podem ser nulos)
            LEFT JOIN assets old_mon ON ps.old_monitor_id = old_mon.id
            LEFT JOIN assets new_mon ON ps.new_monitor_id = new_mon.id
            
            WHERE ps.status = 'pending'
            ORDER BY ps.created_at DESC
        `);
        res.json(result.rows);
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Erro ao listar pendências.' }); 
    }
});

// 3. ROTA: FINALIZAR (UPLOAD + EFETIVAÇÃO)

// =====================================================================
// [FINAL] FINALIZAR SUBSTITUIÇÃO (COM HERANÇA + MIGRAÇÃO DE REMANESCENTES)
// =====================================================================
  app.post('/api/substitutions/:id/finalize', 
    authenticateToken, 
    authorizePermission('ACTION_REGISTER_MOVEMENT'), // <--- Trava de Segurança Adicionada
    uploadSubstitution.single('receiptFile'), 
    async (req, res) => {

    const { id } = req.params;
    const { return_condition } = req.body;

    if (!req.file) return res.status(400).json({ message: 'Arquivo obrigatório.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Busca dados da pendência
        const pendRes = await client.query('SELECT * FROM pending_substitutions WHERE id = $1', [id]);
        if (pendRes.rows.length === 0) throw new Error('Pendência não encontrada');
        const pend = pendRes.rows[0];

        // 2. BUSCA ROBUSTA DA MOVIMENTAÇÃO ORIGINAL & REMANESCENTES
        // Objetivo: Herdar o TIPO (loan/exit), DATA, e identificar o ID da movimentação antiga para buscar parceiros.
        const movRes = await client.query(`
            SELECT am.id, am.expected_return_date, am.movement_type
            FROM asset_movements am
            JOIN movement_assets ma ON am.id = ma.movement_id
            WHERE ma.asset_id = $1 
              AND am.recipient_person_id = $2
              AND am.delivery_status = 'confirmed'
            ORDER BY am.movement_date DESC 
            LIMIT 1
        `, [pend.old_asset_id, pend.recipient_person_id]);

        let originalDueDate = null;
        let originalType = 'loan'; // Fallback seguro
        let originalMovementId = null;

        if (movRes.rows.length > 0) {
            originalDueDate = movRes.rows[0].expected_return_date;
            originalType = movRes.rows[0].movement_type; // Herda 'exit' ou 'loan'
            originalMovementId = movRes.rows[0].id; // Importante para achar os remanescentes
        }

        // Lógica de Data (Fallback para Empréstimo sem data)
        if (originalType === 'loan' && !originalDueDate) {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            originalDueDate = nextYear;
        }

        // 3. IDENTIFICAR REMANESCENTES (O "Casamento")
        // Buscamos outros ativos que estavam na movimentação original (ID encontrado acima),
        // mas EXCLUÍMOS os ativos que estão sendo devolvidos agora.
        const itemsToExclude = [pend.old_asset_id];
        if (pend.old_monitor_id) itemsToExclude.push(pend.old_monitor_id);

        let remnantAssets = [];
        if (originalMovementId) {
            const remRes = await client.query(`
                SELECT asset_id 
                FROM movement_assets 
                WHERE movement_id = $1 
                AND asset_id != ALL($2::int[])
            `, [originalMovementId, itemsToExclude]);
            
            remnantAssets = remRes.rows.map(r => r.asset_id);
        }

        // ---------------------------------------------------------
        
        // Status final do antigo
        const oldStatus = (return_condition === 'defective') ? 'maintenance' : 'available';
        const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
        const whId = whRes.rows[0]?.id;

        // 4. REGISTRA DEVOLUÇÃO (Recolhimento)
        const retRes = await client.query(
            `INSERT INTO asset_movements (movement_type, responsible_user_id, recipient_person_id, destination_unit_id, notes, delivery_status, movement_date)
             VALUES ('return', $1, $2, $3, $4, 'confirmed', NOW()) RETURNING id`,
            [req.user.id, pend.recipient_person_id, whId, `Substituição Kit (Recolhido). Motivo: ${pend.reason}`]
        );
        const retMovId = retRes.rows[0].id;

        // Vincula Antigos ao Retorno
        await client.query('UPDATE assets SET status = $1, current_unit_id = $2 WHERE id = $3', [oldStatus, whId, pend.old_asset_id]);
        await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [retMovId, pend.old_asset_id]);

        if (pend.old_monitor_id) {
            await client.query('UPDATE assets SET status = $1, current_unit_id = $2 WHERE id = $3', [oldStatus, whId, pend.old_monitor_id]);
            await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [retMovId, pend.old_monitor_id]);
        }

        // 5. REGISTRA ENTREGA (Nova Movimentação)
        // Monta texto de periféricos (incluindo o campo 'others')
        let periphText = '';
        if (pend.peripherals) {
             let p = {};
             try { p = typeof pend.peripherals === 'string' ? JSON.parse(pend.peripherals) : pend.peripherals; } catch(e) {}
             
             // Filtra true ou strings preenchidas (para capturar 'others')
             const keys = Object.keys(p).filter(k => p[k] === true || (k === 'others' && p[k]));
             if (keys.length > 0) {
                 periphText = ` | Periféricos: ${keys.map(k => k === 'others' ? p[k] : k).join(', ')}`;
             }
        }

        const exitRes = await client.query(
            `INSERT INTO asset_movements (movement_type, responsible_user_id, recipient_person_id, destination_unit_id, notes, delivery_status, receipt_path, movement_date, expected_return_date)
             VALUES ($7, $1, $2, $3, $4, 'confirmed', $5, NOW(), $6) RETURNING id`,
            [
                req.user.id, 
                pend.recipient_person_id, 
                pend.destination_unit_id, 
                `Substituição Kit (Entregue). Motivo: ${pend.reason}${periphText}`, 
                req.file.path, 
                originalDueDate,
                originalType // $7: Usa o tipo herdado ('loan' ou 'exit')
            ]
        );
        const exitMovId = exitRes.rows[0].id;

        // Define status correto do novo ativo ('in_use' para saída, 'loaned' para empréstimo)
        const newAssetStatus = (originalType === 'exit') ? 'in_use' : 'loaned';

        // A. Vincula Novos Ativos
        await client.query('UPDATE assets SET status = $1, current_unit_id = $2 WHERE id = $3', [newAssetStatus, pend.destination_unit_id, pend.new_asset_id]);
        await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [exitMovId, pend.new_asset_id]);

        if (pend.new_monitor_id) {
            await client.query('UPDATE assets SET status = $1, current_unit_id = $2 WHERE id = $3', [newAssetStatus, pend.destination_unit_id, pend.new_monitor_id]);
            await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [exitMovId, pend.new_monitor_id]);
        }

        // B. >>> MIGRAÇÃO DOS REMANESCENTES (O "CASAMENTO") <<<
        // Insere os ativos que sobraram na nova movimentação para manter o agrupamento visual
        if (remnantAssets.length > 0) {
            console.log(`[SUBSTITUIÇÃO] Migrando ${remnantAssets.length} ativos remanescentes para o movimento #${exitMovId}`);
            for (const remId of remnantAssets) {
                // Não alteramos status (já estão em uso), apenas o vínculo com a movimentação
                await client.query(
                    `INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [exitMovId, remId]
                );
            }
        }

        // 6. ENCERRA A PENDÊNCIA
        await client.query("UPDATE pending_substitutions SET status = 'completed' WHERE id = $1", [id]);

        await client.query('COMMIT');
        res.json({ message: 'Substituição finalizada! Kit atualizado e unificado.' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Erro ao finalizar: ' + e.message });
    } finally { client.release(); }
});

// =====================================================================
// [PDF] LAUDO TÉCNICO DE CONDENAÇÃO (PARA O PROCESSO DE BAIXA)
// =====================================================================
app.post('/api/reports/retirement-term', authenticateToken, async (req, res) => {
    try {
        const { asset, reason, technician_name } = req.body;

        // 1. Logo
        let logoBase64 = null;
        const pathsToTry = [
            path.join(__dirname, 'assets/brasao-recife.png'),
            path.join(__dirname, '../assets/brasao-recife.png'),
            path.join(__dirname, 'public/assets/brasao-recife.png')
        ];
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} }
        }

        const docDefinition = {
            pageSize: 'A4', pageMargins: [40, 100, 40, 60],
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 50 } : { text: '', width: 50 },
                    { 
                        stack: [ 
                            { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, 
                            { text: 'SECRETARIA DE EDUCAÇÃO - GIT', bold: true, fontSize: 10 },
                            { text: 'DIVISÃO DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 } 
                        ], alignment: 'center', margin: [0, 10, 50, 0] 
                    }
                ]
            },
            content: [
                { text: 'LAUDO TÉCNICO DE CONDENAÇÃO DE BEM', style: 'header', alignment: 'center', margin: [0, 10, 0, 20] },
                
                { text: 'IDENTIFICAÇÃO DO BEM:', style: 'sectionTitle' },
                {
                    table: {
                        widths: ['*', '*', '*'],
                        body: [
                            [
                                { text: `Patrimônio:\n${asset.patrimonio_number || 'S/N'}`, style: 'cell' },
                                { text: `Marca/Modelo:\n${asset.brand} ${asset.model}`, style: 'cell' },
                                { text: `Nº Série:\n${asset.serial_number || 'N/A'}`, style: 'cell' }
                            ],
                            [
                                { text: `Tipo de Item:\n${asset.item_type_name || 'Equipamento'}`, style: 'cell', colSpan: 3 }, {}, {}
                            ]
                        ]
                    },
                    margin: [0, 5, 0, 15]
                },

                { text: 'PARECER TÉCNICO:', style: 'sectionTitle' },
                { text: 'Após análise técnica minuciosa, constatou-se que o equipamento acima descrito encontra-se IMPRÓPRIO para uso na rede municipal de ensino devido a:', fontSize: 10, margin: [0, 5, 0, 5] },
                { 
                    text: reason.toUpperCase(), 
                    style: 'reasonBox' 
                },
                { text: 'Diante do exposto, sugerimos a BAIXA PATRIMONIAL do referido bem, visto que sua recuperação é técnica ou economicamente inviável (Antieconômico/Irrecuperável).', fontSize: 10, margin: [0, 10, 0, 30], alignment: 'justify' },

                { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 20, 0, 50] },

                {
                    stack: [
                        { text: '____________________________________________________', alignment: 'center' },
                        { text: technician_name || 'Técnico Responsável', bold: true, alignment: 'center', fontSize: 10 },
                        { text: 'Avaliador Técnico - GIT', fontSize: 9, alignment: 'center' }
                    ]
                }
            ],
            styles: {
                header: { fontSize: 14, bold: true, decoration: 'underline' },
                sectionTitle: { fontSize: 11, bold: true, margin: [0, 5, 0, 2] },
                cell: { fontSize: 10, bold: true },
                reasonBox: { fontSize: 11, bold: true, background: '#f0f0f0', margin: [0, 5, 0, 5], padding: 10, alignment: 'justify' }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', c => chunks.push(c));
        pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
        pdfDoc.end();

    } catch (error) { res.status(500).json({ message: 'Erro ao gerar Laudo: ' + error.message }); }
});

// =====================================================================
// [PDF] TERMO DE DESCARTE FINAL (DESTINAÇÃO)
// =====================================================================
app.post('/api/reports/disposal-term', authenticateToken, async (req, res) => {
    try {
        const { asset, disposal_note } = req.body;
        const signatureBlock = await getUserSignatureData(req.user.id)

        // 1. Logo
        let logoBase64 = null;
        const pathsToTry = [
            path.join(__dirname, 'assets/brasao-recife.png'),
            path.join(__dirname, '../assets/brasao-recife.png'),
            path.join(__dirname, 'public/assets/brasao-recife.png')
        ];
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} }
        }

        const docDefinition = {
            pageSize: 'A4', pageMargins: [40, 100, 40, 60],
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 50 } : { text: '', width: 50 },
                    { 
                        stack: [ 
                            { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, 
                            { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 },
                            { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 } 
                        ], alignment: 'center', margin: [0, 10, 50, 0] 
                    }
                ]
            },
            content: [
                { text: 'TERMO DE DESCARTE / DESTINAÇÃO FINAL', style: 'header', alignment: 'center', margin: [0, 10, 0, 20] },
                
                { text: 'Certificamos que o bem patrimonial abaixo descrito, previamente avaliado e baixado do acervo ativo (status: "Retired"), recebeu a seguinte destinação final:', fontSize: 10, margin: [0, 0, 0, 15], alignment: 'justify' },

                {
                    table: {
                        headerRows: 1,
                        widths: ['25%', '50%', '25%'],
                        body: [
                            [ { text: 'PATRIMÔNIO', style: 'th' }, { text: 'DESCRIÇÃO DO BEM', style: 'th' }, { text: 'SÉRIE', style: 'th' } ],
                            [ 
                                { text: asset.patrimonio_number || 'S/N', alignment: 'center', bold: true }, 
                                { text: `${asset.item_type_name || ''} ${asset.brand} ${asset.model}`, alignment: 'center' }, 
                                { text: asset.serial_number || '-', alignment: 'center' } 
                            ]
                        ]
                    },
                    layout: 'lightHorizontalLines',
                    margin: [0, 5, 0, 15]
                },

                { text: 'DESTINAÇÃO / OBSERVAÇÕES:', style: 'sectionTitle' },
                { 
                    text: disposal_note.toUpperCase(), 
                    style: 'reasonBox' 
                },
                
                { text: 'Declaro que o processo de descarte seguiu as normas ambientais e administrativas vigentes, não restando pendências sobre este item no estoque da Secretaria.', fontSize: 10, margin: [0, 10, 0, 30], alignment: 'justify' },

                { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 20, 0, 50] },

                signatureBlock || { text: 'Erro ao carregar assinatura', alignment: 'center' }
            ],
            styles: {
                header: { fontSize: 14, bold: true, decoration: 'underline' },
                sectionTitle: { fontSize: 11, bold: true, margin: [0, 5, 0, 2] },
                th: { fontSize: 9, bold: true, fillColor: '#eeeeee', alignment: 'center' },
                reasonBox: { fontSize: 10, background: '#ffebee', margin: [0, 5, 0, 5], padding: 10, alignment: 'justify' }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', c => chunks.push(c));
        pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
        pdfDoc.end();

    } catch (error) { res.status(500).json({ message: 'Erro ao gerar Termo: ' + error.message }); }
});

// =====================================================================
// [ATUALIZADO] DESCARTE EM LOTE (ATUALIZA STATUS + GERA PDF)
// =====================================================================
app.post('/api/assets/batch-dispose', authenticateToken, async (req, res) => {
    const { assetIds, disposal_note } = req.body;
    const signatureBlock = await getUserSignatureData(req.user.id);
    
    if (!assetIds || assetIds.length === 0) return res.status(400).json({ message: 'Nenhum ativo selecionado.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Busca dados
        const query = `
            SELECT a.id, a.patrimonio_number, a.brand, a.model, a.serial_number, it.name as item_type_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            WHERE a.id = ANY($1::int[])
            ORDER BY a.patrimonio_number ASC
        `;
        const result = await client.query(query, [assetIds]);
        const assets = result.rows;

        // 2. Atualiza status
        const updateNote = `\n[DESCARTE EM LOTE ${new Date().toLocaleDateString('pt-BR')}]: ${disposal_note}`;
        await client.query(
            `UPDATE assets 
             SET status = 'disposed', 
                 notes = COALESCE(notes, '') || $1, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = ANY($2::int[])`,
            [updateNote, assetIds]
        );

        await client.query('COMMIT');

        // 3. Gera PDF
        let logoBase64 = null;
        const pathsToTry = [
            path.join(__dirname, 'assets/brasao-recife.png'),
            path.join(__dirname, '../assets/brasao-recife.png'),
            path.join(__dirname, 'public/assets/brasao-recife.png')
        ];
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} }
        }

        const tableBody = [[ 
            { text: 'TOMBO', style: 'th' }, 
            { text: 'DESCRIÇÃO DO BEM', style: 'th' },
            { text: 'SÉRIE', style: 'th' } 
        ]];

        assets.forEach(a => {
            tableBody.push([
                { text: a.patrimonio_number || 'S/N', fontSize: 9, alignment: 'center', bold: true },
                { text: `${a.item_type_name} - ${a.brand} ${a.model}`, fontSize: 9 },
                { text: a.serial_number || '-', fontSize: 9, alignment: 'center' }
            ]);
        });

        const docDefinition = {
            pageSize: 'A4', pageMargins: [40, 100, 40, 60],
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 50, margin: [0, 5, 10, 0] } : { text: '', width: 50 },
                    { 
                        stack: [ 
                            { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, 
                            { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 },
                            { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 } 
                        ], alignment: 'center', margin: [0, 10, 50, 0] 
                    }
                ]
            },
            content: [
                { text: 'TERMO DE DESCARTE E DESTINAÇÃO FINAL (LOTE)', style: 'header', alignment: 'center', margin: [0, 10, 0, 20] },
                
                { text: `Certificamos que os ${assets.length} itens abaixo relacionados, previamente baixados do acervo ativo (Status: Retired), foram conferidos e receberam a seguinte destinação final física:`, fontSize: 10, margin: [0, 0, 0, 15], alignment: 'justify' },

                {
                    table: { headerRows: 1, widths: ['20%', '*', '25%'], body: tableBody },
                    layout: 'lightHorizontalLines', margin: [0, 5, 0, 15]
                },

                { text: 'DESTINAÇÃO / JUSTIFICATIVA:', style: 'sectionTitle' },
                { text: disposal_note.toUpperCase(), style: 'reasonBox' },
                
                { text: 'Declaro que o processo seguiu as normas ambientais e administrativas vigentes, sendo os itens removidos fisicamente do estoque desta Secretaria.', fontSize: 10, margin: [0, 10, 0, 30], alignment: 'justify' },

                { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 20, 0, 50] },

                signatureBlock || { text: 'Assinatura não disponível', alignment: 'center' }
            ],
            styles: {
                header: { fontSize: 14, bold: true, decoration: 'underline' },
                sectionTitle: { fontSize: 11, bold: true, margin: [0, 5, 0, 2] },
                th: { fontSize: 9, bold: true, fillColor: '#eeeeee', alignment: 'center' },
                reasonBox: { fontSize: 10, background: '#ffebee', margin: [0, 5, 0, 5], padding: 10, alignment: 'justify' }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', c => chunks.push(c));
        pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
        pdfDoc.end();

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Erro no descarte: ' + error.message });
    } finally {
        client.release();
    }
});

// =====================================================================
// [NOVO] TERMO DE DESCARTE AVULSO (NÃO CADASTRADOS / SUCATA)
// =====================================================================
app.post('/api/reports/legacy-disposal', authenticateToken, async (req, res) => {
    try {
        // items é um array de { description, quantity, observation }
        const { items, disposal_destination, technician_name } = req.body;

        // ... (Mesma lógica de carregamento do Logo) ...
        let logoBase64 = null;
        const pathsToTry = [ path.join(__dirname, 'assets/brasao-recife.png'), path.join(__dirname, '../assets/brasao-recife.png'), path.join(__dirname, 'public/assets/brasao-recife.png') ];
        for (const p of pathsToTry) { if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} } }

        const tableBody = [
            [ { text: 'QTD', style: 'th' }, { text: 'DESCRIÇÃO DO MATERIAL / EQUIPAMENTO', style: 'th' }, { text: 'OBSERVAÇÕES', style: 'th' } ]
        ];

        items.forEach(i => {
            tableBody.push([
                { text: i.quantity || '1', alignment: 'center', fontSize: 10 },
                { text: i.description.toUpperCase(), fontSize: 10 },
                { text: i.observation || '-', fontSize: 10 }
            ]);
        });

        const docDefinition = {
            pageSize: 'A4', pageMargins: [40, 100, 40, 60],
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 50 } : { text: '', width: 50 },
                    { 
                        stack: [ 
                            { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 11 }, 
                            { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 10 },
                            { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 9 } 
                        ], alignment: 'center', margin: [0, 10, 50, 0] 
                    }
                ]
            },
            content: [
                { text: 'TERMO DE DESCARTE DE BENS INSERVÍVEIS (NÃO PATRIMONIADOS)', style: 'header', alignment: 'center', margin: [0, 10, 0, 20] },
                
                { text: `Certificamos a destinação final dos itens abaixo relacionados, classificados como sucata eletrônica ou bens inservíveis sem registro patrimonial ativo:`, fontSize: 10, margin: [0, 0, 0, 15], alignment: 'justify' },

                {
                    table: { headerRows: 1, widths: ['15%', '50%', '35%'], body: tableBody },
                    layout: 'lightHorizontalLines', margin: [0, 5, 0, 15]
                },

                { text: 'DESTINAÇÃO FINAL:', style: 'sectionTitle' },
                { text: disposal_destination.toUpperCase(), style: 'reasonBox' },
                
                { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 40, 0, 50] },

                {
                    stack: [
                        { text: '____________________________________________________', alignment: 'center' },
                        { text: technician_name || 'Responsável', bold: true, alignment: 'center', fontSize: 10 }
                    ]
                }
            ],
            styles: {
                header: { fontSize: 14, bold: true, decoration: 'underline' },
                sectionTitle: { fontSize: 11, bold: true, margin: [0, 5, 0, 2] },
                th: { fontSize: 10, bold: true, fillColor: '#eeeeee', alignment: 'center' },
                reasonBox: { fontSize: 10, background: '#ffebee', margin: [0, 5, 0, 5], padding: 10 }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', c => chunks.push(c));
        pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
        pdfDoc.end();

    } catch (error) { res.status(500).json({ message: 'Erro: ' + error.message }); }
});

// =====================================================================
// [NOVO] SOLICITAÇÃO DE BAIXA EM LOTE (MANAGER)
// =====================================================================
app.post(
  '/api/retirement-requests/batch',
  authenticateToken,
  authorizePermission('ACTION_REQUEST_RETIREMENT'), // <--- ADICIONAR ESTA LINHA
  uploadEvidence.single('evidenceFile'), 
  async (req, res) => {
    const { reason, assetIds } = req.body;
    const requesterUserId = req.user.id;
    const ipAddress = req.ip;

    if (!req.file) return res.status(400).json({ message: 'O arquivo de evidência (laudo/B.O.) é obrigatório para o lote.' });
    
    // Tratamento do array de IDs (vem como string no FormData)
    let idsToProcess = [];
    try {
        idsToProcess = JSON.parse(assetIds);
        if (!Array.isArray(idsToProcess)) throw new Error();
    } catch (e) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Formato de IDs inválido.' });
    }

    if (idsToProcess.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Nenhum ativo selecionado.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Validar e Atualizar Status dos Ativos
      // Só pega ativos que estão disponíveis ou em manutenção
      const updateResult = await client.query(
        `UPDATE assets 
         SET status = 'pending_retirement', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($1::int[]) 
           AND status IN ('available', 'maintenance')
         RETURNING id`,
        [idsToProcess]
      );

      const processedIds = updateResult.rows.map(r => r.id);

      if (processedIds.length === 0) {
          throw new Error('Nenhum dos ativos selecionados estava disponível para solicitação de baixa (verifique se já estão baixados ou em uso).');
      }

      // 2. Criar os registros na tabela retirement_requests
      // Vamos inserir um por um para garantir IDs individuais (ou usar unnest para insert em lote, farei loop simples para clareza)
      for (const assetId of processedIds) {
          await client.query(
            `INSERT INTO retirement_requests (asset_id, requester_user_id, reason, evidence_path)
             VALUES ($1, $2, $3, $4)`,
            [assetId, requesterUserId, reason, req.file.path]
          );
      }

      await client.query('COMMIT');
      
      await logAudit(requesterUserId, 'batch_request_retirement', 'assets', null, { count: processedIds.length, ids: processedIds }, ipAddress);
      
      res.status(201).json({ 
          message: `Solicitação em lote criada com sucesso para ${processedIds.length} ativos.`,
          processedCount: processedIds.length
      });

    } catch (error) {
      await client.query('ROLLBACK');
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Erro no lote de solicitação:', error);
      res.status(500).json({ message: error.message || 'Erro ao processar lote.' });
    } finally {
      client.release();
    }
  }
);

// =====================================================================
// [ATUALIZADO] GERAR MINUTA DE SOLICITAÇÃO (LOTE) - PDF
// =====================================================================
app.post('/api/reports/batch-retirement-term-draft', authenticateToken, async (req, res) => {
    try {
        const { assetIds, reason } = req.body;
        const userId = req.user.id;
        const signatureBlock = await getUserSignatureData(req.user.id);
        
        // 1. Carregar Logo (Brasão)
        let logoBase64 = null;
        const pathsToTry = [
            path.join(__dirname, 'assets/brasao-recife.png'),
            path.join(__dirname, '../assets/brasao-recife.png'),
            path.join(__dirname, 'public/assets/brasao-recife.png')
        ];
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) { try { logoBase64 = fs.readFileSync(p, 'base64'); break; } catch (e) {} }
        }

        // 2. Busca dados dos ativos
        const query = `
            SELECT a.patrimonio_number, a.brand, a.model, a.serial_number, it.name as item_type_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            WHERE a.id = ANY($1::int[])
            ORDER BY a.patrimonio_number ASC
        `;
        const result = await pool.query(query, [assetIds]);
        const assets = result.rows;

        // 3. Monta Tabela
        const tableBody = [[ 
            { text: 'TOMBO', style: 'th' }, 
            { text: 'TIPO / DESCRIÇÃO', style: 'th' }, 
            { text: 'SÉRIE', style: 'th' } 
        ]];
        
        assets.forEach(a => {
            tableBody.push([
                { text: a.patrimonio_number || 'S/N', alignment: 'center', fontSize: 9, bold: true },
                { text: `${a.item_type_name} - ${a.brand} ${a.model}`, fontSize: 9 },
                { text: a.serial_number || '-', alignment: 'center', fontSize: 9 }
            ]);
        });

        // 4. Definição do Documento
        const docDefinition = {
            pageSize: 'A4', pageMargins: [40, 110, 40, 80],
            
            header: {
                margin: [30, 20, 30, 10],
                columns: [
                    logoBase64 ? { image: `data:image/png;base64,${logoBase64}`, width: 50, margin: [0, 5, 10, 0] } : { text: '', width: 50 },
                    { 
                        stack: [ 
                            { text: 'PREFEITURA DA CIDADE DO RECIFE', bold: true, fontSize: 12 }, 
                            { text: 'SECRETARIA DE EDUCAÇÃO', bold: true, fontSize: 11 },
                            { text: 'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA', fontSize: 10 } 
                        ], alignment: 'center', margin: [0, 10, 50, 0] 
                    }
                ]
            },

            content: [
                { text: 'SOLICITAÇÃO DE BAIXA PATRIMONIAL', style: 'header', alignment: 'center', margin: [0, 10, 0, 20] },
                
                { text: 'À Gerência de Infraestrutura de Tecnologia,', fontSize: 10, margin: [0, 0, 0, 10], bold: true },

                // TEXTO TÉCNICO MELHORADO
                { 
                    text: [
                        'Submetemos à apreciação superior a relação de equipamentos de informática abaixo descritos. ',
                        'Após análises técnicas realizadas nos equipamentos, foi constatado que os danos apresentados são irreparáveis ou que o custo de recuperação é antieconômico, ',
                        'não sendo possível a permanência destes itens no parque tecnológico da Secretaria de Educação do Recife.'
                    ], 
                    style: 'bodyText' 
                },

                // OBSERVAÇÃO SOBRE LAUDOS FÍSICOS
                { 
                    text: [
                        { text: 'OBSERVAÇÃO IMPORTANTE: ', bold: true },
                        'Certificamos que cada item listado abaixo possui ',
                        { text: 'Laudo Técnico Individual físico', bold: true },
                        ', devidamente analisado e aprovado pela EMPREL (Empresa Municipal de Informática), encontrando-se arquivado sob a guarda desta Gerência de Infraestrutura de Tecnologia, corroborando a necessidade de baixa patrimonial.'
                    ], 
                    style: 'highlightBox' 
                },

                { text: 'RELAÇÃO DE ITENS PARA BAIXA:', style: 'sectionTitle' },

                { table: { headerRows: 1, widths: ['20%', '*', '25%'], body: tableBody }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 15] },

                { text: `Justificativa do Lote: ${reason.toUpperCase()}`, fontSize: 10, margin: [0, 10, 0, 10] },

                { text: `Recife, ${new Date().toLocaleDateString('pt-BR')}.`, alignment: 'center', margin: [0, 30, 0, 50] },

                signatureBlock || { text: 'Erro ao carregar assinatura', alignment: 'center' }
            ],
            styles: {
                header: { fontSize: 14, bold: true, decoration: 'underline' },
                sectionTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 5] },
                th: { bold: true, fontSize: 10, fillColor: '#eeeeee', alignment: 'center' },
                bodyText: { fontSize: 11, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 10] },
                highlightBox: { fontSize: 10, alignment: 'justify', background: '#f5f5f5', margin: [0, 5, 0, 15], padding: 8, lineHeight: 1.3 }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        pdfDoc.on('data', c => chunks.push(c));
        pdfDoc.on('end', () => { res.header('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });
        pdfDoc.end();

    } catch (error) { res.status(500).json({ message: error.message }); }
});

// =====================================================================
// [NOVO] APROVAÇÃO/REJEIÇÃO EM LOTE (ADMIN)
// =====================================================================
app.post('/api/retirement-requests/batch-action', authenticateToken, authorizePermission('ACTION_APPROVE_REJECT'), async (req, res) => {
    const { requestIds, action, rejection_reason } = req.body; // action: 'approve' | 'reject'
    const adminId = req.user.id;

    if (!requestIds || requestIds.length === 0) return res.status(400).json({ message: 'Nenhuma solicitação selecionada.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Busca os assets relacionados a esses requests
        const requestsRes = await client.query(`SELECT id, asset_id, status FROM retirement_requests WHERE id = ANY($1::int[])`, [requestIds]);
        const validRequests = requestsRes.rows.filter(r => r.status === 'pending');
        
        if (validRequests.length === 0) throw new Error('Nenhuma solicitação pendente encontrada nos IDs informados.');
        
        const assetIds = validRequests.map(r => r.asset_id);
        const validRequestIds = validRequests.map(r => r.id);

        if (action === 'approve') {
            // Atualiza Assets -> retired
            await client.query(`UPDATE assets SET status = 'retired', updated_at = NOW() WHERE id = ANY($1::int[])`, [assetIds]);
            // Atualiza Requests -> approved
            await client.query(`UPDATE retirement_requests SET status = 'approved', approver_user_id = $1, approval_date = NOW() WHERE id = ANY($2::int[])`, [adminId, validRequestIds]);
        } else {
            // Rejeitar
            // Atualiza Assets -> available
            await client.query(`UPDATE assets SET status = 'available', updated_at = NOW() WHERE id = ANY($1::int[])`, [assetIds]);
            // Atualiza Requests -> rejected
            await client.query(`UPDATE retirement_requests SET status = 'rejected', approver_user_id = $1, approval_date = NOW(), rejection_reason = $2 WHERE id = ANY($3::int[])`, [adminId, rejection_reason || 'Rejeitado em lote', validRequestIds]);
        }

        await client.query('COMMIT');
        res.json({ message: `Sucesso! ${validRequests.length} solicitações processadas.` });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

// =====================================================================
// [ROTA COMPLETA] PROCESSAMENTO DE COLETA EM LOTE
// Inclui: Upload, Upsert de Ativos, Baixa na OR e Sincronia com Módulo Escolar
// =====================================================================
app.post('/api/assets/process-collection', authenticateToken, authorizePermission('ACTION_REGISTER_MOVEMENT'), uploadSimple.single('receiptFile'), async (req, res) => {
    // 1. Parsing e Validação Inicial
    let { school_unit_id, notes, items, or_code } = req.body;
    const userId = req.user.id;
    const ipAddress = req.ip;

    // Tratamento de segurança: FormData envia arrays como string
    try {
        if (typeof items === 'string') {
            items = JSON.parse(items);
        }
    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Formato de itens inválido.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'A lista de itens está vazia.' });
    }

    // Caminho do arquivo salvo pelo Multer
    const receiptPath = req.file ? req.file.path : null;

    const client = await pool.connect();
    
    // Contadores para o relatório final
    let stats = { processed: 0, created_legacy: 0, updated: 0, sim_conflicts: 0, school_sync_count: 0 };
    let warnings = [];

    try {
        await client.query('BEGIN');

        // 2. Preparação de IDs de Sistema
        
        // Busca ID do Almoxarifado (Destino padrão)
        const whRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1");
        const warehouseId = whRes.rows[0]?.id || null;

        // Busca ID do Tipo "Tablet" (Para a lógica de sincronia escolar)
        const tabletRes = await client.query("SELECT id, sku_code FROM item_types WHERE name ILIKE '%Tablet%' LIMIT 1");
        const defaultTabletId = tabletRes.rows[0]?.id;

        // Busca nome da escola para o histórico
        const schoolRes = await client.query('SELECT name FROM units WHERE id = $1', [school_unit_id]);
        const schoolName = schoolRes.rows[0]?.name || 'Escola Não Identificada';

        // 3. Criar Movimentação "Mãe" (O Lote de Devolução)
        const moveNote = `Coleta em Lote (Logística Reversa): ${schoolName}. ${notes || ''}`;
        
        const moveRes = await client.query(
            `INSERT INTO asset_movements (
                movement_type, movement_date, responsible_user_id, 
                delivery_status, actual_delivery_date, notes, destination_unit_id, 
                receipt_path
            ) VALUES (
                'return', NOW(), $1, 
                'confirmed', NOW(), $2, $3, 
                $4
            ) RETURNING id`,
            [userId, moveNote, warehouseId, receiptPath]
        );
        const movementId = moveRes.rows[0].id;

        // 4. Processar Itens Individualmente
        for (const item of items) {
            // Sanitização dos dados
            const pat = item.patrimonio ? String(item.patrimonio).trim().toUpperCase() : null;
            const serial = item.serial ? String(item.serial).trim().toUpperCase() : null;
            let sim = item.sim_card ? String(item.sim_card).replace(/\D/g, '') : null;
            const imei = item.imei ? String(item.imei).trim() : null;
            const box = item.box ? String(item.box).trim() : null;
            
            // Dados expandidos (Marca/Modelo/Tipo)
            // Se o usuário não selecionou tipo, usa o padrão Tablet (comum em coletas escolares)
            const itemTypeId = item.itemTypeId ? parseInt(item.itemTypeId) : defaultTabletId;
            const brand = item.brand ? String(item.brand).toUpperCase() : 'GENERICO';
            const model = item.model ? String(item.model).toUpperCase() : 'LEGADO';
            
            // Define status físico (Controle de Estoque)
            const status = (item.condition === 'Ruim' || item.condition === 'Defeito') ? 'maintenance' : 'available';

            if (!pat && !serial) continue; // Pula linha vazia

            // --- Validação de Conflito de Chip ---
            if (sim) {
                const conflictQuery = pat 
                    ? `SELECT patrimonio_number FROM assets WHERE sim_card_number = $1 AND patrimonio_number != $2`
                    : `SELECT patrimonio_number FROM assets WHERE sim_card_number = $1`;
                const conflictParams = pat ? [sim, pat] : [sim];
                const conflictRes = await client.query(conflictQuery, conflictParams);

                if (conflictRes.rows.length > 0) {
                    warnings.push(`Item ${pat || serial}: Chip ${sim} ignorado (pertence a ${conflictRes.rows[0].patrimonio_number}).`);
                    sim = null; 
                    stats.sim_conflicts++;
                }
            }

            // --- Busca Ativo Existente ---
            let assetId = null;
            const findRes = await client.query(
                `SELECT id, item_type_id FROM assets WHERE (patrimonio_number IS NOT NULL AND patrimonio_number = $1) OR (serial_number IS NOT NULL AND serial_number = $2) LIMIT 1`,
                [pat, serial]
            );

            // Variável para checar se é tablet (para a sincronia escolar)
            let currentItemTypeId = itemTypeId; 

            if (findRes.rows.length > 0) {
                // >>> UPDATE (Já existe) <<<
                assetId = findRes.rows[0].id;
                currentItemTypeId = findRes.rows[0].item_type_id; // Usa o tipo real que já estava no banco

                await client.query(
                    `UPDATE assets SET 
                        status = $1, 
                        current_unit_id = $2, 
                        imei = COALESCE($3, imei), 
                        box_number = COALESCE($4, box_number), 
                        sim_card_number = COALESCE($5, sim_card_number), 
                        updated_at = NOW() 
                     WHERE id = $6`,
                    [status, warehouseId, imei, box, sim, assetId]
                );
                stats.updated++;
            } else {
                // >>> INSERT (Novo/Legado) <<<
                const typeInfo = await client.query('SELECT sku_code FROM item_types WHERE id = $1', [itemTypeId]);
                const skuPrefix = typeInfo.rows[0]?.sku_code || 'GEN';
                const sku = `${skuPrefix}-COL-${new Date().getTime().toString().slice(-6)}`;

                const insertRes = await client.query(
                    `INSERT INTO assets (
                        patrimonio_number, serial_number, item_type_id, sku, brand, model, description, 
                        status, current_unit_id, imei, sim_card_number, box_number, 
                        acquisition_date, notes, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'Cadastro via Coleta em Lote', 
                              $7, $8, $9, $10, $11, NOW(), 'Coleta de Campo', NOW()) 
                    RETURNING id`,
                    [pat || `S/PAT-${Math.floor(Math.random()*10000)}`, serial || 'S/N', itemTypeId, sku, brand, model, status, warehouseId, imei, sim, box]
                );
                assetId = insertRes.rows[0].id;
                stats.created_legacy++;
            }

            // --- Vincular Item à Movimentação de Retorno ---
            await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [movementId, assetId]);
            stats.processed++;

            // =================================================================
            // >>> CRUZAMENTO DE INFORMAÇÕES (SYNC ESCOLAR) <<<
            // Se for Tablet, temos que "liberar" o aluno no módulo escolar
            // =================================================================
            
            // Verifica se o ID do tipo corresponde ao ID de Tablet ou se o nome contém Tablet
            const typeCheckSync = await client.query('SELECT name FROM item_types WHERE id = $1', [currentItemTypeId]);
            const isTablet = typeCheckSync.rows[0]?.name.toUpperCase().includes('TABLET');

            if (isTablet) {
                // Procura na tabela de entregas escolares (delivery_batch_items) se esse ativo está com alguém
                // e marca como 'devolvido'.
                const updateEscolar = await client.query(
                    `UPDATE delivery_batch_items 
                     SET delivery_status = 'devolvido', 
                         notes = COALESCE(notes, '') || ' [BAIXA AUTOMÁTICA: Logística Reversa OR #' || $1 || ']'
                     WHERE asset_id = $2 
                       AND delivery_status IN ('realizada', 'confirmed', 'planejada')
                     RETURNING id`,
                    [or_code || 'MANUAL', assetId]
                );

                if (updateEscolar.rowCount > 0) {
                    stats.school_sync_count += updateEscolar.rowCount;
                    // Opcional: Logar no console para debug
                    console.log(`[SYNC] Tablet ID ${assetId} desvinculado de aluno(s) via Coleta.`);
                }
            }
            // =================================================================
        }

        // 5. Dar Baixa na OR (Se houver código)
        if (or_code) {
            await client.query("UPDATE collection_orders SET status = 'completed', completed_at = NOW() WHERE code = $1", [or_code]);
        }

        await client.query('COMMIT');
        
        // Audit Log Completo
        await logAudit(userId, 'process_collection_batch', 'asset_movement', movementId, { stats, warnings, receipt_path: receiptPath }, ipAddress);

        res.json({ message: 'Processamento concluído.', stats, warnings });

    } catch (error) {
        await client.query('ROLLBACK');
        // Limpa arquivo em caso de erro
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Erro na coleta:', error);
        res.status(500).json({ message: 'Erro ao processar: ' + error.message });
    } finally {
        client.release();
    }
});

// Verifica se o Tablet tem um Chip associado (mesmo dono/setor)
// =====================================================================
// 2. ROTA: VERIFICA SE O ATIVO TEM CHIP VINCULADO (Código Completo)
// =====================================================================
app.get('/api/assets/:id/associated-chip', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        // 1. Pega dados do Tablet (Quem está com ele?)
        const tabletRes = await client.query('SELECT recipient_person_id, current_unit_id FROM assets WHERE id = $1', [id]);
        
        if (tabletRes.rows.length === 0) {
            return res.json({ hasChip: false });
        }
        
        const { recipient_person_id, current_unit_id } = tabletRes.rows[0];

        // Se não tem dono nem setor, não tem como ter chip vinculado
        if (!recipient_person_id && !current_unit_id) {
            return res.json({ hasChip: false });
        }

        // 2. Busca Chip com o mesmo dono ou no mesmo setor
        // Procura ativos cujo tipo contenha 'Chip' ou 'SimCard'
        const chipRes = await client.query(`
            SELECT a.id, a.code, a.patrimonio_number, a.serial_number, it.name as type_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            WHERE (it.name ILIKE '%Chip%' OR it.name ILIKE '%SimCard%')
              AND a.status IN ('in_use', 'loaned')
              AND (
                  (a.recipient_person_id IS NOT NULL AND a.recipient_person_id = $1) OR 
                  (a.current_unit_id = $2 AND a.recipient_person_id IS NULL)
              )
            LIMIT 1
        `, [recipient_person_id, current_unit_id]);

        if (chipRes.rows.length > 0) {
            // Retorna o chip encontrado
            res.json({ hasChip: true, chip: chipRes.rows[0] });
        } else {
            res.json({ hasChip: false });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ hasChip: false, error: e.message }); 
    } finally {
        client.release();
    }
});

// =====================================================================
// ROTA: SUBSTITUIÇÃO INTELIGENTE DE TABLET (COM GERAÇÃO DE MOVIMENTOS)
// =====================================================================
app.post('/api/substitutions/smart-swap', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    const { 
        old_tablet_id, 
        scope, // 'tablet_only', 'chip_only', 'both'
        new_tablet_code, 
        new_sim_number, 
        new_imei,       
        reason,
        recipient_person_id,
        destination_unit_id 
    } = req.body;

    const responsible_user_id = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Valida e Busca Tablet Antigo
        const oldRes = await client.query('SELECT * FROM assets WHERE id = $1', [old_tablet_id]);
        if (oldRes.rows.length === 0) throw new Error('Tablet antigo não encontrado.');
        const oldTablet = oldRes.rows[0];

        // Variáveis para os IDs de movimentação
        let returnMovementId = null;
        let exitMovementId = null;

        // --- CENÁRIO 1: APENAS ATUALIZAÇÃO CADASTRAL (CHIP ONLY) ---
        if (scope === 'chip_only') {
            await client.query(`
                UPDATE assets 
                SET sim_card_number = $1, imei = COALESCE($2, imei), updated_at = NOW() 
                WHERE id = $3
            `, [new_sim_number, new_imei || null, old_tablet_id]);
            
            // Neste caso não há troca física, então não geramos movimentação de entrada/saída,
            // apenas retornamos sucesso. (Ou poderia gerar uma manutenção, mas vamos manter simples).
        } 
        
        // --- CENÁRIO 2: TROCA FÍSICA (TABLET ONLY OU BOTH) ---
        else {
            if (!new_tablet_code) throw new Error('Patrimônio do novo tablet é obrigatório.');

            // A. Busca Novo Tablet
            const newRes = await client.query('SELECT * FROM assets WHERE patrimonio_number = $1 OR serial_number = $1', [new_tablet_code]);
            if (newRes.rows.length === 0) throw new Error('Novo tablet não encontrado no estoque.');
            const newTablet = newRes.rows[0];

            if (newTablet.status !== 'available') throw new Error(`O novo tablet não está disponível (Status: ${newTablet.status}).`);

            // B. Define dados do Novo
            let finalSimNumber = (scope === 'tablet_only') ? oldTablet.sim_card_number : new_sim_number;
            let finalImei = new_imei || newTablet.imei;

            // C. CRIA MOVIMENTAÇÃO DE DEVOLUÇÃO (Antigo)
            // Busca unidade de manutenção/almoxarifado para destino do velho
            const almoxRes = await client.query("SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' OR name ILIKE '%Manutenção%' LIMIT 1");
            const maintenanceUnitId = almoxRes.rows[0]?.id || destination_unit_id;

            const retMov = await client.query(`
                INSERT INTO asset_movements (
                    movement_type, movement_date, responsible_user_id, 
                    recipient_person_id, destination_unit_id, purpose, notes
                ) VALUES ('return', NOW(), $1, $2, $3, 'Substituição Técnica (Smart Swap)', $4) 
                RETURNING id
            `, [responsible_user_id, oldTablet.recipient_person_id, maintenanceUnitId, reason]);
            returnMovementId = retMov.rows[0].id;

            // Vincula o ativo velho à movimentação de retorno
            await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`, [returnMovementId, oldTablet.id]);

            // Atualiza status do Velho (Manutenção) e remove chip dele
            await client.query(`
                UPDATE assets 
                SET status = 'maintenance', current_unit_id = $1, recipient_person_id = NULL, sim_card_number = NULL, updated_at = NOW()
                WHERE id = $2
            `, [maintenanceUnitId, oldTablet.id]);

            // D. CRIA MOVIMENTAÇÃO DE SAÍDA (Novo)
            // Herda dados do dono original ou usa os passados
            const targetRecipient = recipient_person_id || oldTablet.recipient_person_id;
            const targetUnit = destination_unit_id || oldTablet.current_unit_id;

            const exitMov = await client.query(`
                INSERT INTO asset_movements (
                    movement_type, movement_date, responsible_user_id, 
                    recipient_person_id, destination_unit_id, purpose, notes
                ) VALUES ('loan', NOW(), $1, $2, $3, 'Substituição Técnica (Entrega de Novo Ativo)', $4) 
                RETURNING id
            `, [responsible_user_id, targetRecipient, targetUnit, reason]);
            exitMovementId = exitMov.rows[0].id;

            // Atualiza o Novo Ativo (Grava o Chip/IMEI aqui antes de vincular)
            await client.query(`
                UPDATE assets 
                SET status = 'loaned', current_unit_id = $1, recipient_person_id = $2, 
                    sim_card_number = $3, imei = $4, updated_at = NOW()
                WHERE id = $5
            `, [targetUnit, targetRecipient, finalSimNumber, finalImei, newTablet.id]);

            // Vincula o ativo novo à movimentação de saída
            await client.query(`INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`, [exitMovementId, newTablet.id]);
        }

        await client.query('COMMIT');
        
        // Retorna os IDs para o frontend gerar o recibo unificado
        res.json({ 
            message: 'Substituição realizada com sucesso!',
            returnId: returnMovementId,
            exitId: exitMovementId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro no Smart Swap:', error);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

// =====================================================================
// ROTA: DOSSIÊ GERENCIAL DA UNIDADE (FINAL - V4)
// Copie e substitua a rota antiga '/api/units/:id/dossier' no server.js
// =====================================================================
app.get('/api/units/:id/dossier', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { year } = req.query; 
    const targetYear = year || new Date().getFullYear();

    try {
        // 1. Valida a Unidade
        const unitRes = await pool.query('SELECT name, type, code FROM units WHERE id = $1', [id]);
        if (unitRes.rows.length === 0) return res.status(404).json({ message: 'Unidade não encontrada.' });

        // 2. INVENTÁRIO FÍSICO ATUAL (O que está lá AGORA)
        const inventoryQuery = `
            SELECT 
                a.id, a.patrimonio_number, a.serial_number, a.brand, a.model, 
                a.status, it.name as item_type,
                (SELECT movement_type FROM asset_movements am JOIN movement_assets ma ON am.id = ma.movement_id WHERE ma.asset_id = a.id AND am.destination_unit_id = a.current_unit_id ORDER BY am.movement_date DESC LIMIT 1) as origin_type,
                (SELECT expected_return_date FROM asset_movements am JOIN movement_assets ma ON am.id = ma.movement_id WHERE ma.asset_id = a.id AND am.destination_unit_id = a.current_unit_id ORDER BY am.movement_date DESC LIMIT 1) as expected_return_date,
                (SELECT p.full_name FROM people p JOIN asset_movements am ON p.id = am.recipient_person_id JOIN movement_assets ma ON am.id = ma.movement_id WHERE ma.asset_id = a.id AND am.destination_unit_id = a.current_unit_id ORDER BY am.movement_date DESC LIMIT 1) as responsible_name
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            WHERE a.current_unit_id = $1
        `;
        const inventoryRes = await pool.query(inventoryQuery, [id]);
        const currentInventory = inventoryRes.rows;

        // 3. FLUXO DO ANO
        const flowQuery = `
            SELECT 
                a.id as asset_id, a.patrimonio_number, it.name as item_type,
                am.movement_type, am.movement_date
            FROM asset_movements am
            JOIN movement_assets ma ON am.id = ma.movement_id
            JOIN assets a ON ma.asset_id = a.id
            JOIN item_types it ON a.item_type_id = it.id
            WHERE am.destination_unit_id = $1
              AND EXTRACT(YEAR FROM am.movement_date) = $2
              AND am.movement_type IN ('loan', 'exit')
        `;
        const flowRes = await pool.query(flowQuery, [id, targetYear]);
        const flowItems = flowRes.rows;

        // 4. PROCESSAMENTO MATEMÁTICO (COMBINADO)
        const allTypes = new Set([...currentInventory.map(i => i.item_type), ...flowItems.map(i => i.item_type)]);

        const stats = Array.from(allTypes).map(type => {
            const inventoryOfType = currentInventory.filter(i => i.item_type === type);
            const flowOfType = flowItems.filter(i => i.item_type === type);

            // A. Saldo Atual
            const currentCount = inventoryOfType.length;
            const currentActiveLoans = inventoryOfType.filter(i => i.origin_type === 'loan').length;
            
            // B. Total Enviado (Unicos)
            const uniqueSentIds = new Set(flowOfType.map(f => f.asset_id));
            const totalSent = uniqueSentIds.size;

            // C. Vencidos
            const today = new Date(); today.setHours(0,0,0,0);
            const overdueCount = inventoryOfType.filter(i => 
                i.origin_type === 'loan' && i.expected_return_date && new Date(i.expected_return_date) <= today
            ).length;

            // D. Devolvidos (Dedução)
            const inventoryIds = new Set(inventoryOfType.map(i => i.id));
            const returnedItemsList = flowOfType.filter(f => !inventoryIds.has(f.asset_id));
            const uniqueReturned = [];
            const seenRet = new Set();
            returnedItemsList.forEach(item => {
                if(!seenRet.has(item.asset_id)){ seenRet.add(item.asset_id); uniqueReturned.push(item); }
            });

            return {
                item_type: type,
                total_quantity: totalSent,
                total_loans: flowOfType.filter(f => f.movement_type === 'loan').length,
                total_exits: flowOfType.filter(f => f.movement_type === 'exit').length,
                currently_active: currentCount,
                currently_loaned: currentActiveLoans,
                overdue_loans: overdueCount,
                returned_count: uniqueReturned.length,
                
                // >>> ESTA PARTE É CRUCIAL PARA O FRONTEND NÃO QUEBRAR <<<
                _details: {
                    loans: inventoryOfType.filter(i => i.origin_type === 'loan'),
                    exits: inventoryOfType.filter(i => i.origin_type !== 'loan'),
                    returns: uniqueReturned
                }
            };
        });

        // 5. Histórico Geral (Opcional, mas mantido para segurança)
        const safeHistoryQuery = `
             SELECT am.id, am.movement_date, am.movement_type, it.name as item_type, a.patrimonio_number, p.full_name as recipient_name
            FROM asset_movements am
            JOIN movement_assets ma ON am.id = ma.movement_id
            JOIN assets a ON ma.asset_id = a.id
            JOIN item_types it ON a.item_type_id = it.id
            LEFT JOIN people p ON am.recipient_person_id = p.id
            WHERE am.destination_unit_id = $1 AND EXTRACT(YEAR FROM am.movement_date) = $2
            ORDER BY am.movement_date DESC
        `;
        const historyRes = await pool.query(safeHistoryQuery, [id, targetYear]);

        res.json({
            unit: unitRes.rows[0],
            year: targetYear,
            stats: stats,
            current_inventory: currentInventory, // Campo legado para segurança
            history: historyRes.rows
        });

    } catch (error) {
        console.error('Erro ao gerar dossiê:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
});

// =====================================================================
// ROTA: DOSSIÊ COMPLETO DO ALUNO (CORRIGIDA - SEM CPF)
// =====================================================================
app.get('/api/tablets/dossier', authenticateToken, async (req, res) => {
    const { q } = req.query; // Busca por Nome ou Matrícula

    if (!q || String(q).length < 3) return res.json([]);

    try {
        const query = `
            SELECT 
                s.id as student_id,
                s.student_name,
                s.student_registration,
                -- s.student_cpf removido pois não existe na tabela
                s.education_year,
                s.pcd_type,
                u.name as school_name,
                
                -- Dados do Tablet Atual
                a.patrimonio_number,
                a.serial_number,
                a.imei,
                a.sim_card_number,
                
                -- Dados da Entrega
                dbi.delivery_status,
                dbi.delivery_date,
                db.id as batch_id,
                db.name as batch_name,
                
                -- Rastreio do Documento (Lote vs Individual)
                db.collective_receipt_path as batch_receipt,
                am.receipt_path as individual_receipt,
                am.id as movement_id

            FROM tablet_eligible_students s
            LEFT JOIN units u ON s.school_unit_id = u.id
            LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
            LEFT JOIN delivery_batches db ON dbi.batch_id = db.id
            LEFT JOIN assets a ON dbi.asset_id = a.id
            -- Tenta achar movimentação individual (se houve substituição ou entrega avulsa confirmada)
            LEFT JOIN asset_movements am ON s.delivery_movement_id = am.id

            WHERE 
                s.student_name ILIKE $1 OR 
                s.student_registration ILIKE $1
            
            ORDER BY s.student_name ASC
            LIMIT 20
        `;
        
        const result = await pool.query(query, [`%${q}%`]);
        res.json(result.rows);

    } catch (error) {
        console.error('Erro no dossiê do aluno:', error);
        res.status(500).json({ message: 'Erro ao buscar dossiê.' });
    }
});

// =====================================================================
// ROTA: CONSULTA DE RECIBOS DE LOTES (AUDITORIA/MP)
// =====================================================================
app.get('/api/audit/batch-receipts', authenticateToken, async (req, res) => {
    const { schoolName, startDate, endDate } = req.query;

    try {
        let query = `
            SELECT 
                db.id,
                db.name as batch_name,
                db.status,
                db.creation_date,
                db.delivery_confirmation_date,
                db.collective_receipt_path,
                u.name as school_name,
                u.rpa,
                (SELECT COUNT(*) FROM delivery_batch_items WHERE batch_id = db.id) as total_items,
                -- Conta quantos foram devolvidos/não entregues dentro do lote
                (SELECT COUNT(*) FROM delivery_batch_items WHERE batch_id = db.id AND delivery_status = 'devolvido') as returned_items
            FROM delivery_batches db
            JOIN units u ON db.school_unit_id = u.id
            WHERE db.status = 'Concluído' -- Apenas lotes finalizados interessam para recibo
        `;

        const params = [];

        if (schoolName) {
            params.push(`%${schoolName}%`);
            query += ` AND u.name ILIKE $${params.length}`;
        }

        if (startDate) {
            params.push(startDate);
            query += ` AND db.delivery_confirmation_date >= $${params.length}`;
        }

        if (endDate) {
            // Ajuste para pegar o final do dia
            params.push(`${endDate} 23:59:59`);
            query += ` AND db.delivery_confirmation_date <= $${params.length}`;
        }

        query += ` ORDER BY db.delivery_confirmation_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Erro na busca de recibos de lote:', error);
        res.status(500).json({ message: 'Erro ao buscar recibos.' });
    }
});

// =====================================================================
// RELATÓRIO OPERACIONAL: SAÚDE DO PARQUE (MANUTENÇÃO E BAIXAS)
// =====================================================================
app.get('/api/reports/maintenance/xlsx', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.patrimonio_number, a.serial_number,
                it.name as item_type,
                a.brand, a.model,
                a.status,
                u.name as location,
                a.updated_at as last_update,
                a.notes
            FROM assets a
            JOIN item_types it ON a.item_type_id = it.id
            LEFT JOIN units u ON a.current_unit_id = u.id
            -- Filtra apenas o que não está operacional
            WHERE a.status IN ('maintenance', 'retired', 'disposed', 'defective')
            ORDER BY a.status ASC, a.updated_at DESC
        `;
        
        const result = await pool.query(query);

        // Tradução de Status para exibição
        const statusMap = {
            'maintenance': 'EM MANUTENÇÃO',
            'defective': 'COM DEFEITO',
            'retired': 'BAIXADO (INSERVÍVEL)',
            'disposed': 'DESCARTADO (LIXO)'
        };

        const rows = result.rows.map(item => ({
            pat: item.patrimonio_number || 'S/N',
            desc: `${item.item_type} - ${item.brand} ${item.model}`,
            status: statusMap[item.status] || item.status.toUpperCase(),
            loc: item.location || 'Sem Localização',
            date: new Date(item.last_update).toLocaleDateString('pt-BR'),
            notes: item.notes ? item.notes.split('\n').pop() : '' // Pega só a última nota para não poluir
        }));

        const columns = [
            { header: 'PATRIMÔNIO', key: 'pat', width: 15 },
            { header: 'DESCRIÇÃO DO BEM', key: 'desc', width: 40 },
            { header: 'SITUAÇÃO ATUAL', key: 'status', width: 20 },
            { header: 'LOCALIZAÇÃO', key: 'loc', width: 30 },
            { header: 'ÚLT. ATUALIZAÇÃO', key: 'date', width: 18 },
            { header: 'OBSERVAÇÕES / MOTIVO', key: 'notes', width: 50 },
        ];

        await generateStyledExcel(res, 'Manutenção e Baixas', 'Relatorio_Saude_Parque.xlsx', columns, rows);

    } catch (error) {
        console.error('Erro relatório manutenção:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
});

// =====================================================================
// RELATÓRIO OPERACIONAL: PENDÊNCIAS DE DOCUMENTAÇÃO (COBRANÇA)
// =====================================================================
app.get('/api/reports/pending-docs/xlsx', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                am.id,
                am.movement_date,
                am.movement_type,
                u.full_name as tech_name,
                p.full_name as recipient_name,
                un.name as dest_unit,
                COUNT(ma.asset_id) as items_count
            FROM asset_movements am
            JOIN users u ON am.responsible_user_id = u.id
            LEFT JOIN people p ON am.recipient_person_id = p.id
            LEFT JOIN units un ON am.destination_unit_id = un.id
            LEFT JOIN movement_assets ma ON am.id = ma.movement_id
            WHERE am.delivery_status = 'pending_confirmation'
            GROUP BY am.id, am.movement_date, am.movement_type, u.full_name, p.full_name, un.name
            ORDER BY am.movement_date ASC
        `;

        const result = await pool.query(query);

        const rows = result.rows.map(item => {
            // Calcula dias de atraso
            const movDate = new Date(item.movement_date);
            const today = new Date();
            const diffTime = Math.abs(today - movDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
                id: item.id,
                date: movDate.toLocaleDateString('pt-BR'),
                type: item.movement_type === 'loan' ? 'EMPRÉSTIMO' : 'SAÍDA',
                tech: item.tech_name,
                dest: item.recipient_name || item.dest_unit || 'N/A',
                qtd: item.items_count,
                days: diffDays
            };
        });

        const columns = [
            { header: 'ID MOV.', key: 'id', width: 10 },
            { header: 'DATA CRIAÇÃO', key: 'date', width: 15 },
            { header: 'TIPO', key: 'type', width: 15 },
            { header: 'TÉCNICO RESPONSÁVEL', key: 'tech', width: 30 },
            { header: 'DESTINATÁRIO / SETOR', key: 'dest', width: 35 },
            { header: 'QTD. ITENS', key: 'qtd', width: 12 },
            { header: 'DIAS PENDENTE', key: 'days', width: 15 },
        ];

        await generateStyledExcel(res, 'Pendências de Upload', 'Relatorio_Pendencias_Docs.xlsx', columns, rows);

    } catch (error) {
        console.error('Erro relatório pendências:', error);
        res.status(500).json({ message: 'Erro interno.' });
    }
});

// =====================================================================
// HELPER: GERADOR DE EXCEL PADRÃO (VISUAL AZUL / MATRIZ)
// =====================================================================
async function generateStyledExcel(res, sheetName, fileName, columns, rows) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns;

    // 1. Estilização do Cabeçalho (Azul Escuro Institucional)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // 2. Preencher Linhas
    rows.forEach(item => {
        const newRow = worksheet.addRow(item);
        
        // Estilo Zebrado (Linhas Pares em Cinza Claro)
        if (worksheet.rowCount % 2 === 0) {
            newRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        }
        
        // Centraliza células (exceto a primeira que geralmente é texto longo)
        newRow.eachCell((cell, colNumber) => {
            if (colNumber > 1) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
            };
        });
    });

    // 3. Enviar
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    await workbook.xlsx.write(res);
    res.end();
}

// =====================================================================
// ROTA PARA BAIXAR RECIBO ASSINADO (INDIVIDUAL) - CORRIGIDA
// =====================================================================
app.get('/api/asset-movements/:id/signed-receipt', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // CORREÇÃO: Usamos 'receipt_path', que é a coluna onde o upload é salvo
    const result = await pool.query(
      'SELECT receipt_path FROM asset_movements WHERE id = $1', 
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Movimentação não encontrada.' });
    }

    // O caminho salvo no banco (ex: "C:\sga\backend\uploads\receipts\arquivo.pdf")
    const fullPath = result.rows[0].receipt_path;

    if (!fullPath) {
      return res.status(404).json({ message: 'Nenhum arquivo anexado a esta movimentação.' });
    }

    // Como o multer salva o caminho completo, podemos usar direto
    // Mas para segurança, verificamos se ele existe
    if (!fs.existsSync(fullPath)) {
      console.error(`Arquivo físico não encontrado: ${fullPath}`);
      return res.status(404).json({ message: 'O arquivo consta no banco mas não foi encontrado no disco.' });
    }

    // Extrai apenas o nome do arquivo para o download
    const filename = path.basename(fullPath);

    // Envia o arquivo
    res.download(fullPath, filename);

  } catch (error) {
    console.error('Erro ao baixar recibo:', error);
    res.status(500).json({ message: 'Erro interno ao processar download.' });
  }
});

// =====================================================================
// GESTÃO DE ORDENS DE COLETA (OR) - LOGÍSTICA REVERSA
// =====================================================================

// 1. CRIAR UMA NOVA OR (Gera Código Único)
app.post('/api/collection-orders', authenticateToken, authorizePermission('MENU_ESCOLAR'), async (req, res) => {
    const { school_unit_id, technician_name, reason, estimated_quantity } = req.body;
    
    if (!school_unit_id) return res.status(400).json({ message: 'A unidade escolar é obrigatória.' });

    try {
        // Gera um código único amigável: OR-DATA-HEXA (Ex: OR-20240201-A1B2)
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `OR-${dateStr}-${randomSuffix}`;

        const result = await pool.query(
            `INSERT INTO collection_orders (code, school_unit_id, technician_name, reason, estimated_quantity, status)
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
            [code, school_unit_id, technician_name, reason, estimated_quantity || 20]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar OR:', error);
        res.status(500).json({ message: 'Erro ao gerar ordem de coleta.' });
    }
});

// 2. CONSULTAR OR PELO CÓDIGO (No Retorno do Técnico)
app.get('/api/collection-orders/:code', authenticateToken, async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query(`
            SELECT co.*, u.name as school_name 
            FROM collection_orders co
            JOIN units u ON co.school_unit_id = u.id
            WHERE co.code = $1
        `, [code.toUpperCase()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Ordem de Coleta não encontrada.' });
        }

        const or = result.rows[0];
        if (or.status === 'completed') {
            return res.status(409).json({ message: `Esta Ordem de Coleta já foi processada em ${new Date(or.completed_at).toLocaleDateString()}.` });
        }

        res.json(or);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar OR.' });
    }
});

// 3. BAIXAR OR (Atualiza status para completed quando o processamento finaliza)
// Obs: Vamos chamar isso de dentro da rota 'process-collection'
const closeCollectionOrder = async (client, code) => {
    if (!code) return;
    await client.query(
        `UPDATE collection_orders SET status = 'completed', completed_at = NOW() WHERE code = $1`,
        [code]
    );
};

// =====================================================================
// ANALYTICS: PAINEL EXECUTIVO (PROJEÇÃO, RUN RATE E RPAS)
// VERSÃO DEFINITIVA (Com Meta Líquida e Baixas Calculadas)
// =====================================================================
app.get('/api/analytics/tablet-projection', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        
        try {
            // 1. A QUERY MESTRA: Status Líquido dos Alunos (A base de tudo)
            const masterQuery = `
                WITH StudentStatus AS (
                    SELECT 
                        s.id AS student_id,
                        MAX(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) AS has_delivered,
                        MAX(CASE WHEN dbi.delivery_status = 'devolvido' THEN 1 ELSE 0 END) AS has_returned,
                        MAX(CASE WHEN dbi.delivery_status = 'planejada' THEN 1 ELSE 0 END) AS has_planned
                    FROM tablet_eligible_students s
                    LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
                    GROUP BY s.id
                ),
                ClassifiedStudents AS (
                    SELECT
                        student_id,
                        CASE 
                            WHEN has_delivered = 1 THEN 'ENTREGUE'
                            WHEN has_delivered = 0 AND has_returned = 1 THEN 'CANCELADO'
                            ELSE 'PENDENTE'
                        END AS status_final
                    FROM StudentStatus
                )
                SELECT 
                    COUNT(*) AS censo_bruto,
                    COUNT(CASE WHEN status_final = 'ENTREGUE' THEN 1 END) AS total_entregue,
                    COUNT(CASE WHEN status_final = 'CANCELADO' THEN 1 END) AS total_cancelado,
                    COUNT(CASE WHEN status_final = 'PENDENTE' THEN 1 END) AS total_pendente
                FROM ClassifiedStudents;
            `;
            
            const masterRes = await client.query(masterQuery);
            const masterStats = masterRes.rows[0];

            const totalDelivered = parseInt(masterStats.total_entregue, 10);
            const totalCancelado = parseInt(masterStats.total_cancelado, 10);
            
            // A META REAL é o Censo Bruto menos os alunos que não precisam mais do tablet (evasão/baixa)
            const totalMeta = parseInt(masterStats.censo_bruto, 10) - totalCancelado;
            const remaining = totalMeta - totalDelivered;

            // 2. Estoque (Permanece igual)
            const stockRes = await client.query(`
                SELECT COUNT(a.id) as count FROM assets a
                JOIN item_types it ON a.item_type_id = it.id
                WHERE a.status = 'available' 
                AND (it.name ILIKE '%Tablet%' OR it.sku_code ILIKE 'TAB')
            `);
            const availableStock = parseInt(stockRes.rows[0].count, 10);

            // 3. Histórico Semanal (Permanece igual)
            const weeklyRes = await client.query(`
                SELECT 
                    DATE_TRUNC('week', delivery_date) as week_start,
                    COUNT(*) as weekly_total
                FROM delivery_batch_items
                WHERE delivery_status IN ('realizada', 'confirmed')
                  AND delivery_date IS NOT NULL
                GROUP BY week_start
                ORDER BY week_start ASC
            `);
            const weeklyHistory = weeklyRes.rows.map(r => ({
                weekStart: new Date(r.week_start),
                count: parseInt(r.weekly_total, 10)
            }));

            // 4. Run Rate (Dias Úteis)
            const runRateRes = await client.query(`
                SELECT 
                    COUNT(*) as total_delivered,
                    COUNT(DISTINCT delivery_date::date) as active_days
                FROM delivery_batch_items
                WHERE delivery_status IN ('realizada', 'confirmed')
                  AND delivery_date IS NOT NULL
            `);
            let dailyVelocity = 0;
            let weeklyVelocity = 0;
            if (runRateRes.rows.length > 0) {
                const totalRecent = parseInt(runRateRes.rows[0].total_delivered, 10);
                const activeDays = parseInt(runRateRes.rows[0].active_days, 10);
                if (activeDays > 0) {
                    dailyVelocity = Math.round(totalRecent / activeDays);
                    weeklyVelocity = dailyVelocity * 5;
                }
            }

            // 5. Projeção e Burn-up
            const targetDate = new Date('2026-05-31T23:59:59Z');
            let projectedDate = null; 

            // >>> CORREÇÃO: SE TERMINOU, CONGELA A DATA DE CONCLUSÃO <<<
            if (remaining <= 0) {
                // Se já concluímos, a data de projeção é a data da última entrega real.
                const lastDeliveryRes = await client.query(`
                    SELECT MAX(delivery_date) as last_date 
                    FROM delivery_batch_items 
                    WHERE delivery_status IN ('realizada', 'confirmed')
                `);
                if (lastDeliveryRes.rows.length > 0 && lastDeliveryRes.rows[0].last_date) {
                    projectedDate = new Date(lastDeliveryRes.rows[0].last_date);
                } else {
                    projectedDate = new Date(); // Fallback seguro
                }
            } else if (dailyVelocity > 0) {
                // Se não terminou, calcula a projeção normalmente
                const workingDaysNeeded = Math.ceil(remaining / dailyVelocity);
                const calendarDaysNeeded = Math.ceil(workingDaysNeeded * (7/5));
                projectedDate = new Date();
                projectedDate.setDate(projectedDate.getDate() + calendarDaysNeeded);
            }

            let cumulative = 0;
            const chartData = [];
            const formattedWeeklyHistory = [];

            const startDate = weeklyHistory.length > 0 ? weeklyHistory[0].weekStart : new Date();
            const totalProjectTime = targetDate.getTime() - startDate.getTime();

            // A. HISTÓRICO PASSADO
            weeklyHistory.forEach(w => {
                cumulative += w.count;
                const label = w.weekStart.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                
                const elapsed = w.weekStart.getTime() - startDate.getTime();
                let ideal = totalProjectTime > 0 ? Math.round((elapsed / totalProjectTime) * totalMeta) : 0;
                ideal = Math.min(Math.max(ideal, 0), totalMeta);

                chartData.push({ 
                    name: label, 
                    realizado: cumulative, 
                    projetado: null,
                    planejado: ideal 
                });
                formattedWeeklyHistory.push({ name: label, entregas: w.count });
            });

            // B. PROJEÇÃO FUTURA VS ALVO (Só plota futuro se ainda houver meta)
            if (weeklyVelocity > 0 && remaining > 0) {
                let futureCumulative = cumulative;
                let futureDate = new Date(); 
                
                if (chartData.length > 0) {
                    chartData[chartData.length - 1].projetado = cumulative;
                }

                const endChartDate = (projectedDate && projectedDate > targetDate) ? projectedDate : targetDate;

                while (futureDate < endChartDate || futureCumulative < totalMeta) {
                    futureDate.setDate(futureDate.getDate() + 7);
                    
                    if (futureCumulative < totalMeta) {
                        futureCumulative += weeklyVelocity;
                        if (futureCumulative > totalMeta) futureCumulative = totalMeta;
                    }

                    let ideal = null; 
                    if (futureDate <= targetDate) {
                        const elapsed = futureDate.getTime() - startDate.getTime();
                        ideal = totalProjectTime > 0 ? Math.round((elapsed / totalProjectTime) * totalMeta) : 0;
                        ideal = Math.min(Math.max(ideal, 0), totalMeta);
                    }

                    chartData.push({
                        name: futureDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}),
                        realizado: null,
                        projetado: futureCumulative,
                        planejado: ideal
                    });

                    if (chartData.length > 150) break;
                }
            }

            // 6. Dados por RPA
            const rpaRes = await client.query(`
                WITH StudentStatus AS (
                    SELECT 
                        s.rpa,
                        s.school_unit_id,
                        s.id AS student_id,
                        MAX(CASE WHEN dbi.delivery_status IN ('realizada', 'confirmed') THEN 1 ELSE 0 END) as is_delivered,
                        MAX(CASE WHEN dbi.delivery_status = 'devolvido' THEN 1 ELSE 0 END) as is_returned,
                        MAX(CASE WHEN dbi.delivery_status = 'planejada' THEN 1 ELSE 0 END) as is_planned
                    FROM tablet_eligible_students s
                    LEFT JOIN delivery_batch_items dbi ON s.id = dbi.eligible_student_id
                    GROUP BY s.id, s.rpa, s.school_unit_id
                ),
                SchoolStatus AS (
                    SELECT
                        u.id AS school_unit_id,
                        COALESCE(u.rpa, '-') AS rpa,
                        -- Elegíveis REAIS: ignora os que devolveram definitivamente
                        SUM(CASE WHEN ss.is_returned = 0 THEN 1 ELSE 0 END) AS total_eligible,
                        SUM(ss.is_delivered) AS total_delivered,
                        SUM(ss.is_returned) AS total_returned,
                        SUM(ss.is_planned) AS total_planned,
                        (SUM(CASE WHEN ss.is_returned = 0 THEN 1 ELSE 0 END) - SUM(ss.is_delivered)) AS total_pending
                    FROM units u
                    JOIN StudentStatus ss ON u.id = ss.school_unit_id
                    GROUP BY u.id, u.rpa
                )
                SELECT 
                    rpa,
                    SUM(total_eligible) as total,
                    SUM(total_delivered) as delivered,
                    SUM(total_returned) as returned,
                    SUM(total_planned) as planned,
                    SUM(total_pending) as pending,
                    COUNT(school_unit_id) as total_schools,
                    COUNT(CASE WHEN total_pending <= 0 THEN 1 END) as served_schools
                FROM SchoolStatus
                GROUP BY rpa 
                ORDER BY rpa ASC
            `);
            
            const rpaData = rpaRes.rows.map(r => {
                const total = parseInt(r.total, 10) || 0;
                const entregues = parseInt(r.delivered, 10) || 0;
                const pendentes = parseInt(r.pending, 10) || 0;

                return {
                    name: r.rpa === '-' ? 'Sem RPA' : (String(r.rpa).toUpperCase().includes('RPA') ? r.rpa : `RPA ${r.rpa}`),
                    entregues: entregues,
                    pendentes: Math.max(0, pendentes),
                    total: total,
                    escolas_atendidas: parseInt(r.served_schools, 10) || 0,
                    escolas_total: parseInt(r.total_schools, 10) || 0
                };
            });

            const metaDate = new Date('2026-05-31T23:59:59Z');
            // Data real considerada é a data atual (já que o projeto foi concluído)
            const realDate = new Date(); 
            // Calcula diferença em dias
            const diffInTime = realDate.getTime() - metaDate.getTime();
            const diffInDays = Math.max(0, Math.ceil(diffInTime / (1000 * 3600 * 24)));

            res.json({
                totalMeta,
                totalDelivered,
                remaining: Math.max(0, remaining), // Nunca será negativo
                availableStock,
                velocity: dailyVelocity,
                weeklyVelocity,
                projectedDate: projectedDate ? projectedDate.toISOString() : null,
                targetDeadline: '2026-05-31T23:59:59Z', 
                delayDays: diffInDays, 
                isLate: realDate > metaDate,
                chartData,
                weeklyHistory: formattedWeeklyHistory,
                rpaData
            });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Erro na projeção:', error);
        res.status(500).json({ message: 'Erro ao calcular projeção.' });
    }
});

// =====================================================================
// MÓDULO HISTÓRICO LEGADO (ANOS ANTERIORES - 75k Linhas)
// =====================================================================

// 1. Rota de Busca no Histórico (Otimizada com LIMIT para não travar o navegador)
app.get('/api/tablets/legacy/search', authenticateToken, async (req, res) => {
    const { q } = req.query; 

    if (!q || String(q).length < 3) return res.json([]);

    try {
        const searchTerm = `%${q}%`;
        // Busca por Matrícula, Nome ou Unidade
        const query = `
            SELECT * FROM legacy_tablet_deliveries
            WHERE student_registration ILIKE $1 
               OR student_name ILIKE $1
               OR unit_name ILIKE $1
            ORDER BY delivery_year DESC, student_name ASC
            LIMIT 100
        `;
        const result = await pool.query(query, [searchTerm]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro na busca legada:', error);
        res.status(500).json({ message: 'Erro ao consultar histórico anterior.' });
    }
});

// 2. Rota de Importação da Planilha (Carga Espelho - Truncate & Load)
app.post('/api/tablets/legacy/import', authenticateToken, authorizePermission('MENU_CONFIGURACOES'), uploadImport.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado.' });

    const filePath = req.file.path;
    const client = await pool.connect();

    try {
        const workbook = XLSX.readFile(filePath);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        await client.query('BEGIN');
        console.log(`[LEGADO] Limpando base antiga e iniciando importação de ${data.length} linhas...`);

        // A MÁGICA: Apaga todos os registros antigos instantaneamente
        await client.query('TRUNCATE TABLE legacy_tablet_deliveries');

        for (const row of data) {
            await client.query(
                `INSERT INTO legacy_tablet_deliveries 
                (student_registration, student_name, class_name, unit_name, equipment, delivery_status_info, delivery_year, patrimonio_number, imei, sim_card_number)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    String(row['MATRÍCULA'] || row['MATRICULA'] || ''),
                    String(row['NOME DO ALUNO'] || row['NOME'] || '').toUpperCase(),
                    String(row['TURMA'] || ''),
                    String(row['UNIDADE'] || ''),
                    String(row['EQUIPAMENTO'] || ''),
                    String(row['ENTREGA'] || ''),
                    parseInt(row['ANO']) || null,
                    // MAPEAMENTO DAS 3 NOVAS COLUNAS:
                    String(row['TOMBAMENTO'] || row['PATRIMONIO'] || row['PATRIMÔNIO'] || ''),
                    String(row['IMEI'] || ''),
                    String(row['CHIP'] || row['SIMCARD'] || '')
                ]
            );
        }
        await client.query('COMMIT');
        res.json({ message: `Sucesso! Base sincronizada com ${data.length} registros.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro importação legada:', error);
        res.status(500).json({ message: 'Erro ao processar planilha de histórico.' });
    } finally {
        client.release();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});


// =====================================================================
// ROTAS DE SISTEMA DE CATÁLOGO INTEGRADO (BLINDAGEM DE MARCA E MODELO)
// =====================================================================

// GET /api/catalog/brands - Lista marcas disponíveis para um Tipo de Item específico
app.get('/api/catalog/brands', authenticateToken, async (req, res) => {
    const { item_type_id } = req.query;
    try {
        let query = 'SELECT id, name FROM catalog_brands ORDER BY name ASC';
        let params = [];
        if (item_type_id) {
            query = `SELECT DISTINCT cb.id, cb.name 
                     FROM catalog_brands cb 
                     JOIN catalog_models cm ON cb.id = cm.brand_id 
                     WHERE cm.item_type_id = $1 
                     ORDER BY cb.name ASC`;
            params = [item_type_id];
        }
        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/catalog/models - Lista modelos filtrados por Marca e por Tipo de Item
app.get('/api/catalog/models', authenticateToken, async (req, res) => {
    const { brand_id, item_type_id } = req.query;
    if (!brand_id || !item_type_id) {
        return res.status(400).json({ message: 'brand_id e item_type_id são obrigatórios.' });
    }
    try {
        const result = await pool.query(
            'SELECT id, name FROM catalog_models WHERE brand_id = $1 AND item_type_id = $2 ORDER BY name ASC', 
            [brand_id, item_type_id]
        );
        res.status(200).json(result.rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/catalog/brands - Cadastra uma nova marca (Força Caixa Alta e evita duplicados)
app.post('/api/catalog/brands', authenticateToken, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Nome da marca é obrigatório.' });
    const cleanName = String(name).trim().toUpperCase();
    try {
        const result = await pool.query(
            'INSERT INTO catalog_brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
            [cleanName]
        );
        res.status(201).json({ id: result.rows[0].id, name: cleanName });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/catalog/models - Cadastra um novo modelo vinculado à Marca e Tipo de Item
app.post('/api/catalog/models', authenticateToken, async (req, res) => {
    const { name, brand_id, item_type_id } = req.body;
    if (!name || !brand_id || !item_type_id) {
        return res.status(400).json({ message: 'Nome, brand_id e item_type_id são obrigatórios.' });
    }
    const cleanName = String(name).trim().toUpperCase();
    try {
        const result = await pool.query(
            'INSERT INTO catalog_models (name, brand_id, item_type_id) VALUES ($1, $2, $3) ON CONFLICT (brand_id, name, item_type_id) DO NOTHING RETURNING id',
            [cleanName, brand_id, item_type_id]
        );
        if (result.rowCount === 0) {
            const existing = await pool.query('SELECT id FROM catalog_models WHERE brand_id = $1 AND name = $2 AND item_type_id = $3', [brand_id, cleanName, item_type_id]);
            return res.status(200).json({ id: existing.rows[0].id, name: cleanName });
        }
        res.status(201).json({ id: result.rows[0].id, name: cleanName });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Módulo de Solicitações de TI ────────────────────────────────────────────
const requestsRouter = require('./routes/requests');
app.use('/api', requestsRouter(pool, authenticateToken, authorizePermission, logAudit));

// ─── Módulo de Feedback ──────────────────────────────────────────────────────
const feedbacksRouter = require('./routes/feedbacks');
app.use('/api', feedbacksRouter(pool, authenticateToken, authorizeRole, logAudit));

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
