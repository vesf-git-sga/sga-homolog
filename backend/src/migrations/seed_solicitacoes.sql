-- =============================================================================
-- Seed — Módulo de Solicitações de TI (dados de apresentação)
-- Senha de todos os usuários: Demo@2026
-- Executar APÓS a migration 010_solicitacoes_v4.sql.
-- Idempotente: usa ON CONFLICT DO NOTHING ou verifica existência antes de inserir.
-- =============================================================================

BEGIN;

-- ─── Usuários (um por perfil) ─────────────────────────────────────────────────
-- Senha: Demo@2026  →  hash bcrypt cost=10

INSERT INTO users (username, email, password_hash, full_name, role, job_title, is_active)
VALUES
  ('admin.demo',    'admin@demo.sga',    '$2b$10$JxzZFMwODOCps8ONkhtD7eF8UO5LzYkSnCV.JcCj0b2cMcZote88u', 'Administrador Demo',         'admin',    'Administrador do Sistema',      true),
  ('gestor.demo',   'gestor@demo.sga',   '$2b$10$JxzZFMwODOCps8ONkhtD7eF8UO5LzYkSnCV.JcCj0b2cMcZote88u', 'Carlos Andrade (Gestor)',    'manager',  'Gerente de TI',                 true),
  ('tecnico.demo',  'tecnico@demo.sga',  '$2b$10$JxzZFMwODOCps8ONkhtD7eF8UO5LzYkSnCV.JcCj0b2cMcZote88u', 'Ana Tavares (Técnica DIT)', 'operator', 'Técnica de Suporte TI',         true),
  ('atendente.demo','atendente@demo.sga','$2b$10$JxzZFMwODOCps8ONkhtD7eF8UO5LzYkSnCV.JcCj0b2cMcZote88u', 'Roberto Lima (Atendente)',  'basic',    'Atendente de Protocolo',        true)
ON CONFLICT (username) DO NOTHING;

-- ─── Unidades (6 unidades em 3 RPAs distintas) ───────────────────────────────

INSERT INTO units (name, code, type, rpa, address)
VALUES
  ('EMEF Prof. João Pessoa',          'EMEF-001', 'escola',     'RPA 3', 'Av. Principal, 100 — Boa Vista'),
  ('EMEF Santos Dumont',              'EMEF-002', 'escola',     'RPA 3', 'Rua das Flores, 250 — Madalena'),
  ('EMEF Padre Anchieta',             'EMEF-003', 'escola',     'RPA 5', 'Estrada do Arraial, 800 — Casa Amarela'),
  ('Escola Municipal Dom Helder',     'EMEF-004', 'escola',     'RPA 5', 'Rua da Paz, 412 — Dois Unidos'),
  ('Gerência Regional Norte',         'GRE-N',    'gerencia',   'RPA 4', 'Av. Norte, 1.500 — Arruda'),
  ('Secretaria Municipal de Educação','SME-001',  'secretaria', NULL,    'Rua da Aurora, 300 — Santo Antônio')
ON CONFLICT (code) DO NOTHING;

-- ─── Solicitantes (pessoas vinculadas às unidades) ───────────────────────────

INSERT INTO people (full_name, cpf, email, job_title, unit_id)
SELECT v.full_name, v.cpf, v.email, v.job_title, u.id
FROM (VALUES
  ('Maria Aparecida da Silva',  '111.111.111-01', 'maria.silva@demo.sga',    'Diretora',               'EMEF-001'),
  ('José Carlos Ferreira',      '111.111.111-02', 'jose.ferreira@demo.sga',  'Diretor',                'EMEF-002'),
  ('Sandra Leal Oliveira',      '111.111.111-03', 'sandra.oliveira@demo.sga','Diretora',               'EMEF-003'),
  ('Paulo Roberto Mendes',      '111.111.111-04', 'paulo.mendes@demo.sga',   'Diretor',                'EMEF-004'),
  ('Luciana Farias Costa',      '111.111.111-05', 'luciana.farias@demo.sga', 'Gerente Regional',       'GRE-N'),
  ('Fernando Augusto Ramos',    '111.111.111-06', 'fernando.ramos@demo.sga', 'Coordenador Pedagógico', 'SME-001')
) AS v(full_name, cpf, email, job_title, codigo_unidade)
JOIN units u ON u.code = v.codigo_unidade
ON CONFLICT (cpf) DO NOTHING;

-- ─── Catálogo: marcas e modelos ───────────────────────────────────────────────

INSERT INTO catalog_brands (name)
VALUES ('Dell'), ('Lenovo'), ('HP'), ('Epson'), ('Samsung')
ON CONFLICT (name) DO NOTHING;

-- Modelos (usamos subqueries para não depender de IDs fixos)
INSERT INTO catalog_models (name, brand_id, item_type_id)
SELECT v.nome, b.id, it.id
FROM (VALUES
  ('Inspiron 15 3000',   'Dell',    'Notebook'),
  ('ThinkPad E14',       'Lenovo',  'Notebook'),
  ('OptiPlex 3000',      'Dell',    'Desktop'),
  ('IdeaCentre 3',       'Lenovo',  'Desktop'),
  ('EliteDisplay E24',   'HP',      'Monitor'),
  ('S24F350',            'Samsung', 'Monitor'),
  ('L3150',              'Epson',   'Impressora'),
  ('LaserJet M110w',     'HP',      'Impressora')
) AS v(nome, marca, tipo)
JOIN catalog_brands b  ON b.name = v.marca
JOIN item_types     it ON it.name = v.tipo
ON CONFLICT (brand_id, name, item_type_id) DO NOTHING;

-- ─── Solicitações (10 registros cobrindo todos os status) ────────────────────
-- Usamos CTEs para resolver IDs por nome e manter o seed legível.

DO $$
DECLARE
  -- usuários
  uid_admin    INT; uid_gestor  INT; uid_tecnico INT; uid_atend INT;
  -- pessoas
  pid_maria    INT; pid_jose    INT; pid_sandra  INT;
  pid_paulo    INT; pid_luciana INT; pid_fernando INT;
  -- unidades
  eid_emef001  INT; eid_emef002 INT; eid_emef003 INT;
  eid_emef004  INT; eid_gren    INT; eid_sme     INT;
  -- item_types
  it_note INT; it_desk INT; it_mon INT; it_imp INT;
  -- brands
  b_dell INT; b_lenovo INT; b_hp INT; b_epson INT; b_samsung INT;
  -- models
  m_inspiron INT; m_thinkpad INT; m_optiplex INT; m_ideacentre INT;
  m_elitedisp INT; m_s24 INT; m_l3150 INT; m_laserjet INT;
  -- solicitações criadas
  r_id INT;
BEGIN
  -- Resolve IDs
  SELECT id INTO uid_admin   FROM users WHERE username = 'admin.demo';
  SELECT id INTO uid_gestor  FROM users WHERE username = 'gestor.demo';
  SELECT id INTO uid_tecnico FROM users WHERE username = 'tecnico.demo';
  SELECT id INTO uid_atend   FROM users WHERE username = 'atendente.demo';

  SELECT id INTO pid_maria    FROM people WHERE cpf = '111.111.111-01';
  SELECT id INTO pid_jose     FROM people WHERE cpf = '111.111.111-02';
  SELECT id INTO pid_sandra   FROM people WHERE cpf = '111.111.111-03';
  SELECT id INTO pid_paulo    FROM people WHERE cpf = '111.111.111-04';
  SELECT id INTO pid_luciana  FROM people WHERE cpf = '111.111.111-05';
  SELECT id INTO pid_fernando FROM people WHERE cpf = '111.111.111-06';

  SELECT id INTO eid_emef001 FROM units WHERE code = 'EMEF-001';
  SELECT id INTO eid_emef002 FROM units WHERE code = 'EMEF-002';
  SELECT id INTO eid_emef003 FROM units WHERE code = 'EMEF-003';
  SELECT id INTO eid_emef004 FROM units WHERE code = 'EMEF-004';
  SELECT id INTO eid_gren    FROM units WHERE code = 'GRE-N';
  SELECT id INTO eid_sme     FROM units WHERE code = 'SME-001';

  SELECT id INTO it_note FROM item_types WHERE name = 'Notebook';
  SELECT id INTO it_desk FROM item_types WHERE name = 'Desktop';
  SELECT id INTO it_mon  FROM item_types WHERE name = 'Monitor';
  SELECT id INTO it_imp  FROM item_types WHERE name = 'Impressora';

  SELECT id INTO b_dell    FROM catalog_brands WHERE name = 'Dell';
  SELECT id INTO b_lenovo  FROM catalog_brands WHERE name = 'Lenovo';
  SELECT id INTO b_hp      FROM catalog_brands WHERE name = 'HP';
  SELECT id INTO b_epson   FROM catalog_brands WHERE name = 'Epson';
  SELECT id INTO b_samsung FROM catalog_brands WHERE name = 'Samsung';

  SELECT id INTO m_inspiron   FROM catalog_models WHERE name = 'Inspiron 15 3000';
  SELECT id INTO m_thinkpad   FROM catalog_models WHERE name = 'ThinkPad E14';
  SELECT id INTO m_optiplex   FROM catalog_models WHERE name = 'OptiPlex 3000';
  SELECT id INTO m_ideacentre FROM catalog_models WHERE name = 'IdeaCentre 3';
  SELECT id INTO m_elitedisp  FROM catalog_models WHERE name = 'EliteDisplay E24';
  SELECT id INTO m_s24        FROM catalog_models WHERE name = 'S24F350';
  SELECT id INTO m_l3150      FROM catalog_models WHERE name = 'L3150';
  SELECT id INTO m_laserjet   FROM catalog_models WHERE name = 'LaserJet M110w';

  -- ── 1. Requisitado (recém-aberto, aguardando triagem) ──────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00001') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, notes, created_by,
       created_at, updated_at)
    VALUES
      ('SOL-2026-00001', 'emprestimo', 'requisitado', 'email', NULL,
       pid_maria, eid_emef001,
       'Laboratório de informática sem equipamentos funcionais para o ano letivo.',
       uid_atend,
       NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_note, b_dell, m_inspiron, 15);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES (r_id, NULL, 'requisitado', 'Solicitação criada.', uid_atend, NOW() - INTERVAL '10 days');
  END IF;

  -- ── 2. Visita Técnica Solicitada (com visita agendada) ─────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00002') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, fundamentacao, created_by,
       created_at, updated_at)
    VALUES
      ('SOL-2026-00002', 'substituicao', 'visita_tecnica_solicitada', 'chamado', 'CHM-2026-4521',
       pid_jose, eid_emef002, 'avaria',
       uid_atend,
       NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_desk, b_dell, m_optiplex, 3);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,          'requisitado',             'Solicitação criada.',              uid_atend,  NOW() - INTERVAL '8 days'),
      (r_id, 'requisitado', 'visita_tecnica_solicitada','Visita técnica solicitada.',       uid_tecnico, NOW() - INTERVAL '7 days');
    INSERT INTO technical_visits
      (request_id, assigned_to, scheduled_date, scheduled_time, created_by, created_at)
    VALUES
      (r_id, uid_tecnico, CURRENT_DATE + 2, '09:00', uid_tecnico, NOW() - INTERVAL '6 days');
  END IF;

  -- ── 3. Visita Técnica Solicitada — sem agendamento (para rota) ─────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00003') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, fundamentacao, created_by,
       created_at, updated_at)
    VALUES
      ('SOL-2026-00003', 'substituicao', 'visita_tecnica_solicitada', 'chamado', 'CHM-2026-4588',
       pid_sandra, eid_emef003, 'avaria',
       uid_atend,
       NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_imp, b_epson, m_l3150, 2);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,          'requisitado',             'Solicitação criada.',        uid_atend,  NOW() - INTERVAL '5 days'),
      (r_id, 'requisitado', 'visita_tecnica_solicitada','Visita técnica solicitada.', uid_tecnico, NOW() - INTERVAL '4 days');
  END IF;

  -- ── 4. Aguardando Aprovação ────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00004') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, created_by,
       created_at, updated_at)
    VALUES
      ('SOL-2026-00004', 'acrescimo', 'aguardando_aprovacao', 'sei', '23.1.0000456/2026-12',
       pid_luciana, eid_gren,
       uid_atend,
       NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES
      (r_id, it_note, b_lenovo, m_thinkpad,   5),
      (r_id, it_mon,  b_samsung, m_s24,        5);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,          'requisitado',        'Solicitação criada.',                  uid_atend,  NOW() - INTERVAL '12 days'),
      (r_id, 'requisitado', 'aguardando_aprovacao','Encaminhado para aprovação da gestão.',uid_gestor, NOW() - INTERVAL '3 days');
  END IF;

  -- ── 5. Aprovado — DIT ainda não ciente (KPI "Pendente DIT") ───────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00005') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, approved_by, approved_at, created_by,
       created_at, updated_at)
    VALUES
      ('SOL-2026-00005', 'emprestimo', 'aprovado', 'sei', '23.1.0000501/2026-03',
       pid_paulo, eid_emef004,
       uid_gestor, NOW() - INTERVAL '1 day',
       uid_atend,
       NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_desk, b_lenovo, m_ideacentre, 8);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,                 'requisitado',        'Solicitação criada.',         uid_atend,  NOW() - INTERVAL '15 days'),
      (r_id, 'requisitado',        'aguardando_aprovacao','Encaminhado para aprovação.', uid_gestor, NOW() - INTERVAL '3 days'),
      (r_id, 'aguardando_aprovacao','aprovado',           'Aprovado pela gestão.',       uid_gestor, NOW() - INTERVAL '1 day');
  END IF;

  -- ── 6. Aprovado — DIT ciente (pronto para separação) ──────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00006') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, approved_by, approved_at,
       dit_ciente_at, dit_ciente_by,
       created_by, created_at, updated_at)
    VALUES
      ('SOL-2026-00006', 'acrescimo', 'aprovado', 'email', NULL,
       pid_fernando, eid_sme,
       uid_gestor, NOW() - INTERVAL '3 days',
       NOW() - INTERVAL '2 days', uid_tecnico,
       uid_atend,
       NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES
      (r_id, it_note, b_dell, m_inspiron,  3),
      (r_id, it_mon,  b_hp,   m_elitedisp, 3);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,                 'requisitado',        'Solicitação criada.',          uid_atend,  NOW() - INTERVAL '20 days'),
      (r_id, 'requisitado',        'aguardando_aprovacao','Encaminhado para aprovação.',  uid_gestor, NOW() - INTERVAL '5 days'),
      (r_id, 'aguardando_aprovacao','aprovado',           'Aprovado pela gestão.',        uid_gestor, NOW() - INTERVAL '3 days'),
      (r_id, 'aprovado',           'aprovado',           'DIT ciente. Ciência registrada.', uid_tecnico, NOW() - INTERVAL '2 days');
  END IF;

  -- ── 7. Indisponível no Estoque (KPI "Sem Estoque") ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00007') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, approved_by, approved_at,
       dit_ciente_at, dit_ciente_by,
       created_by, created_at, updated_at)
    VALUES
      ('SOL-2026-00007', 'emprestimo', 'indisponivel_estoque', 'sei', '23.1.0000612/2026-04',
       pid_maria, eid_emef001,
       uid_gestor, NOW() - INTERVAL '10 days',
       NOW() - INTERVAL '9 days', uid_tecnico,
       uid_atend,
       NOW() - INTERVAL '25 days', NOW() - INTERVAL '7 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_note, b_lenovo, m_thinkpad, 20);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,                 'requisitado',        'Solicitação criada.',                        uid_atend,  NOW() - INTERVAL '25 days'),
      (r_id, 'requisitado',        'aguardando_aprovacao','Encaminhado para aprovação.',               uid_gestor, NOW() - INTERVAL '12 days'),
      (r_id, 'aguardando_aprovacao','aprovado',           'Aprovado pela gestão.',                     uid_gestor, NOW() - INTERVAL '10 days'),
      (r_id, 'aprovado',           'aprovado',           'DIT ciente. Ciência registrada.',            uid_tecnico, NOW() - INTERVAL '9 days'),
      (r_id, 'aprovado',           'indisponivel_estoque','Notebooks ThinkPad indisponíveis em estoque. Solicitação entra em fila de espera.', uid_tecnico, NOW() - INTERVAL '7 days');
  END IF;

  -- ── 8. Em Execução (movimentação vinculada em andamento) ──────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00008') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, approved_by, approved_at,
       dit_ciente_at, dit_ciente_by,
       created_by, created_at, updated_at)
    VALUES
      ('SOL-2026-00008', 'substituicao', 'em_execucao', 'chamado', 'CHM-2026-3901',
       pid_sandra, eid_emef003, 'avaria',
       uid_gestor, NOW() - INTERVAL '20 days',
       NOW() - INTERVAL '18 days', uid_tecnico,
       uid_atend,
       NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_desk, b_dell, m_optiplex, 2);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,                 'requisitado',        'Solicitação criada.',                                uid_atend,  NOW() - INTERVAL '30 days'),
      (r_id, 'requisitado',        'visita_tecnica_solicitada','Visita técnica solicitada.',                   uid_tecnico, NOW() - INTERVAL '28 days'),
      (r_id, 'visita_tecnica_solicitada','aguardando_aprovacao','Visita concluída. Resultado: Defeito constatado.', uid_tecnico, NOW() - INTERVAL '25 days'),
      (r_id, 'aguardando_aprovacao','aprovado',           'Aprovado pela gestão.',                             uid_gestor, NOW() - INTERVAL '20 days'),
      (r_id, 'aprovado',           'aprovado',           'DIT ciente. Ciência registrada.',                   uid_tecnico, NOW() - INTERVAL '18 days'),
      (r_id, 'aprovado',           'em_execucao',        'Movimentação #3 registrada — status atualizado automaticamente.', uid_tecnico, NOW() - INTERVAL '5 days');
  END IF;

  -- ── 9. Concluído (ciclo completo) ─────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00009') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, approved_by, approved_at,
       dit_ciente_at, dit_ciente_by,
       created_by, created_at, updated_at)
    VALUES
      ('SOL-2026-00009', 'emprestimo', 'concluido', 'email', NULL,
       pid_paulo, eid_emef004,
       uid_gestor, NOW() - INTERVAL '35 days',
       NOW() - INTERVAL '33 days', uid_tecnico,
       uid_atend,
       NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_imp, b_hp, m_laserjet, 1);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,                 'requisitado',        'Solicitação criada.',                                   uid_atend,  NOW() - INTERVAL '45 days'),
      (r_id, 'requisitado',        'aguardando_aprovacao','Encaminhado para aprovação.',                          uid_gestor, NOW() - INTERVAL '40 days'),
      (r_id, 'aguardando_aprovacao','aprovado',           'Aprovado pela gestão.',                                uid_gestor, NOW() - INTERVAL '35 days'),
      (r_id, 'aprovado',           'aprovado',           'DIT ciente. Ciência registrada.',                      uid_tecnico, NOW() - INTERVAL '33 days'),
      (r_id, 'aprovado',           'em_execucao',        'Movimentação registrada — status atualizado automaticamente.', uid_tecnico, NOW() - INTERVAL '20 days'),
      (r_id, 'em_execucao',        'concluido',          'Entrega confirmada — movimentação concluída.',          uid_tecnico, NOW() - INTERVAL '15 days');
  END IF;

  -- ── 10. Cancelado ─────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00010') THEN
    INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, created_by,
       created_at, updated_at)
    VALUES
      ('SOL-2026-00010', 'acrescimo', 'cancelado', 'sei', '23.1.0000288/2026-01',
       pid_jose, eid_emef002,
       uid_atend,
       NOW() - INTERVAL '50 days', NOW() - INTERVAL '42 days')
    RETURNING id INTO r_id;
    INSERT INTO request_catalog_items (request_id, item_type_id, brand_id, model_id, quantity)
    VALUES (r_id, it_mon, b_samsung, m_s24, 4);
    INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by, changed_at)
    VALUES
      (r_id, NULL,         'requisitado','Solicitação criada.',                                    uid_atend,  NOW() - INTERVAL '50 days'),
      (r_id, 'requisitado','cancelado',  'Cancelado: unidade não necessita mais dos equipamentos.',uid_gestor, NOW() - INTERVAL '42 days');
  END IF;

END $$;

COMMIT;
