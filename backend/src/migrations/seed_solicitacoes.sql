-- =============================================================================
-- Seed — Módulo de Solicitações de TI (dados de apresentação)
-- Executar APÓS 010_solicitacoes_v4.sql
-- Usa IDs reais do banco — sem inserções em units/users/people/catalog
--
-- Usuários:
--   admin    id=1   Administrador do Sistema
--   manager  id=16  José Carlos Nascimento de Sá
--   operator id=26  Robine Veloso de Oliveira Lima
--   operator id=37  Divanildo de Oliveira Ramos Junior
--
-- Unidades (type=ESCOLAR):
--   id=1664  CMEI CELESTE VIDAL             RPA 3
--   id=1212  CRECHE ALTO JOSE DO PINHO      RPA 3
--   id=1299  CRECHE MENINO JESUS CASA FORTE RPA 3
--   id=1306  CMEI ALCIDES RESTELLI TEDESCO  RPA 4
--   id=1409  CRECHE ASSOCIACAO CRISTA FEM.  RPA 4
--   id=1457  CMEI DA MANGUEIRA              RPA 5
--   id=1548  CRECHE DA ESTANCIA             RPA 5
--
-- Pessoas (people):
--   id=1 Sandra Maria do Nascimento
--   id=3 Mariana Pessoa
--   id=4 Paloma Oliveira
--   id=6 Roberto Salvador
--   id=7 Lucas da Silva
--   id=8 Evanilda Gomes
--
-- item_types: 1=Desktop 4=Notebook 6=Monitor 7=Impressora 10=Projetor
-- brands:     2=DELL 3=LG 4=HP 6=POSITIVO 8=CASIO 10=AOC 15=LENOVO
-- models:     3=XJ-F211WN(Projetor) 7=THINKSTANTION P340(Desktop)
--             11=445 G9(Notebook)   14=24BL550J-B(Monitor)
--             20=24E3QF(Monitor)    21=LATITUDE 3420(Notebook)
--             23=THINKPAD E14(Notebook) 25=MASTER D610(Desktop)
-- =============================================================================

BEGIN;

DO $$
DECLARE r_id INT;
BEGIN

-- ── 1. Requisitado — acréscimo notebooks ─────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00001') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,notes,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00001','acrescimo','requisitado','email',1,1664,
    'Laboratório sem equipamentos funcionais para o ano letivo. Solicitação urgente.',
    37, NOW()-'14 days'::interval, NOW()-'14 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,15,23,15);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES (r_id,NULL,'requisitado','Solicitação registrada via e-mail.',37,NOW()-'14 days'::interval);
END IF;

-- ── 2. Requisitado — empréstimo projetor ─────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00002') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,notes,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00002','emprestimo','requisitado','sei',3,1306,
    'Projetor para uso nas atividades pedagógicas do segundo semestre.',
    26, NOW()-'9 days'::interval, NOW()-'9 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,10,8,3,2);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES (r_id,NULL,'requisitado','Solicitação registrada via SEI.',26,NOW()-'9 days'::interval);
END IF;

-- ── 3. Visita Técnica — agendada RPA 3 ───────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00003') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00003','substituicao','visita_tecnica_solicitada','chamado','CHM-2026-4521',
    4,1212,'avaria',37,NOW()-'11 days'::interval,NOW()-'9 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,15,7,3);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',37,NOW()-'11 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica agendada para verificação.',37,NOW()-'9 days'::interval);
  INSERT INTO technical_visits (request_id,assigned_to,scheduled_date,scheduled_time,created_by,created_at)
  VALUES (r_id,26,CURRENT_DATE+3,'09:00',37,NOW()-'9 days'::interval);
END IF;

-- ── 4. Visita Técnica — agendada RPA 4 ───────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00004') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00004','substituicao','visita_tecnica_solicitada','chamado','CHM-2026-4673',
    6,1409,'avaria',26,NOW()-'8 days'::interval,NOW()-'6 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,4,11,5);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',26,NOW()-'8 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica agendada.',26,NOW()-'6 days'::interval);
  INSERT INTO technical_visits (request_id,assigned_to,scheduled_date,scheduled_time,created_by,created_at)
  VALUES (r_id,37,CURRENT_DATE+1,'13:30',26,NOW()-'6 days'::interval);
END IF;

-- ── 5. Visita Técnica — sem agendamento RPA 5 (painel de rotas) ──────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00005') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00005','substituicao','visita_tecnica_solicitada','chamado','CHM-2026-4800',
    7,1457,'avaria',26,NOW()-'5 days'::interval,NOW()-'4 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,7,4,NULL,2);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',26,NOW()-'5 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica solicitada. Aguardando agendamento.',26,NOW()-'4 days'::interval);
  INSERT INTO technical_visits (request_id,assigned_to,created_by,created_at)
  VALUES (r_id,37,26,NOW()-'4 days'::interval);
END IF;

-- ── 6. Visita Técnica — sem agendamento RPA 5 (segunda, para densidade da rota)
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00006') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00006','substituicao','visita_tecnica_solicitada','chamado','CHM-2026-4855',
    8,1548,'avaria',37,NOW()-'3 days'::interval,NOW()-'2 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,6,25,2);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',37,NOW()-'3 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica solicitada. Aguardando agendamento.',37,NOW()-'2 days'::interval);
  INSERT INTO technical_visits (request_id,assigned_to,created_by,created_at)
  VALUES (r_id,26,37,NOW()-'2 days'::interval);
END IF;

-- ── 7. Visita Realizada (aguardando encaminhamento para aprovação) ────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00007') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00007','substituicao','visita_realizada','chamado','CHM-2026-3977',
    1,1299,'avaria',26,NOW()-'20 days'::interval,NOW()-'10 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,6,3,14,8);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',26,NOW()-'20 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica agendada.',26,NOW()-'18 days'::interval),
    (r_id,'visita_tecnica_solicitada','visita_realizada','Visita concluída. Defeito constatado: monitores com queima de placa.',37,NOW()-'10 days'::interval);
  INSERT INTO technical_visits (request_id,assigned_to,scheduled_date,scheduled_time,result,findings,completed_by,completed_at,created_by,created_at)
  VALUES (r_id,37,CURRENT_DATE-11,'10:00','constatada','Queima de placa de vídeo em 8 monitores LG do laboratório de informática.',37,NOW()-'10 days'::interval,26,NOW()-'18 days'::interval);
END IF;

-- ── 8. Aguardando Aprovação — acréscimo multi-item ───────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00008') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00008','acrescimo','aguardando_aprovacao','sei','23.1.0000456/2026-12',
    4,1664,26,NOW()-'18 days'::interval,NOW()-'5 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES
    (r_id,4,15,23,10),
    (r_id,6,10,20,10);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'18 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para análise e aprovação da gestão.',16,NOW()-'5 days'::interval);
END IF;

-- ── 9. Aguardando Aprovação — substituição pós-visita ────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00009') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00009','substituicao','aguardando_aprovacao','chamado','CHM-2026-4100',
    8,1306,'avaria',37,NOW()-'22 days'::interval,NOW()-'4 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,2,21,4);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',37,NOW()-'22 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica agendada.',37,NOW()-'20 days'::interval),
    (r_id,'visita_tecnica_solicitada','aguardando_aprovacao','Visita realizada. Defeito constatado. Encaminhado para aprovação.',37,NOW()-'4 days'::interval);
  INSERT INTO technical_visits (request_id,assigned_to,scheduled_date,scheduled_time,result,findings,completed_by,completed_at,created_by,created_at)
  VALUES (r_id,37,CURRENT_DATE-15,'14:00','constatada','4 desktops com defeito no HD. Substituição necessária.',37,NOW()-'4 days'::interval,37,NOW()-'20 days'::interval);
END IF;

-- ── 10. Aprovado — DIT ainda não ciente ──────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00010') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,approved_by,approved_at,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00010','acrescimo','aprovado','email',
    3,1457,16,NOW()-'1 day'::interval,
    26,NOW()-'16 days'::interval,NOW()-'1 day'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,6,25,6);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'16 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'3 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'1 day'::interval);
END IF;

-- ── 11. Aprovado — DIT ainda não ciente (segundo — KPI Pendente DIT = 2) ──────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00011') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,approved_by,approved_at,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00011','emprestimo','aprovado','sei','23.1.0000701/2026-05',
    7,1548,16,NOW()-'2 days'::interval,
    37,NOW()-'20 days'::interval,NOW()-'2 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,4,11,8);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',37,NOW()-'20 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'4 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'2 days'::interval);
END IF;

-- ── 12. Aprovado — DIT ciente ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00012') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00012','acrescimo','aprovado','email',
    1,1212,16,NOW()-'5 days'::interval,
    NOW()-'4 days'::interval,26,
    26,NOW()-'25 days'::interval,NOW()-'4 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES
    (r_id,4,2,21,5),
    (r_id,6,10,20,5);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'25 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'7 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'5 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',26,NOW()-'4 days'::interval);
END IF;

-- ── 13. Aprovado — DIT ciente (substituição) ──────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00013') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00013','substituicao','aprovado','chamado','CHM-2026-3801',
    6,1299,'avaria',16,NOW()-'8 days'::interval,
    NOW()-'6 days'::interval,37,
    37,NOW()-'30 days'::interval,NOW()-'6 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,15,7,3);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',37,NOW()-'30 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica agendada.',37,NOW()-'28 days'::interval),
    (r_id,'visita_tecnica_solicitada','aguardando_aprovacao','Defeito constatado. Encaminhado para aprovação.',37,NOW()-'15 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'8 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',37,NOW()-'6 days'::interval);
END IF;

-- ── 14. Indisponível no Estoque — Notebook (KPI "Sem Estoque") ───────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00014') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00014','acrescimo','indisponivel_estoque','sei','23.1.0000612/2026-04',
    4,1664,16,NOW()-'15 days'::interval,
    NOW()-'13 days'::interval,26,
    26,NOW()-'35 days'::interval,NOW()-'10 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,15,23,20);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'35 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'18 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'15 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',26,NOW()-'13 days'::interval),
    (r_id,'aprovado','indisponivel_estoque','ThinkPad E14 indisponíveis em estoque. Solicitação entra em fila de espera.',26,NOW()-'10 days'::interval);
END IF;

-- ── 15. Indisponível no Estoque — Desktop ────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00015') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00015','emprestimo','indisponivel_estoque','email',
    8,1409,16,NOW()-'20 days'::interval,
    NOW()-'18 days'::interval,37,
    37,NOW()-'40 days'::interval,NOW()-'12 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,6,25,12);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',37,NOW()-'40 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'23 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'20 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',37,NOW()-'18 days'::interval),
    (r_id,'aprovado','indisponivel_estoque','Desktops Positivo MASTER D610 sem estoque. Aguardará reposição.',37,NOW()-'12 days'::interval);
END IF;

-- ── 16. Em Execução ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00016') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00016','acrescimo','em_execucao','email',
    3,1306,16,NOW()-'28 days'::interval,
    NOW()-'26 days'::interval,26,
    26,NOW()-'45 days'::interval,NOW()-'8 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,4,11,5);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'45 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'30 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'28 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',26,NOW()-'26 days'::interval),
    (r_id,'aprovado','em_execucao','Movimentação vinculada — entrega em andamento.',26,NOW()-'8 days'::interval);
END IF;

-- ── 17. Em Execução — substituição ───────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00017') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00017','substituicao','em_execucao','chamado','CHM-2026-3200',
    7,1548,'avaria',16,NOW()-'35 days'::interval,
    NOW()-'33 days'::interval,37,
    37,NOW()-'55 days'::interval,NOW()-'7 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,6,10,20,4);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto por avaria.',37,NOW()-'55 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita técnica agendada.',37,NOW()-'53 days'::interval),
    (r_id,'visita_tecnica_solicitada','aguardando_aprovacao','Defeito constatado. Encaminhado.',37,NOW()-'45 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'35 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',37,NOW()-'33 days'::interval),
    (r_id,'aprovado','em_execucao','Movimentação vinculada — retirada e entrega em andamento.',37,NOW()-'7 days'::interval);
END IF;

-- ── 18. Concluído ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00018') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00018','acrescimo','concluido','email',
    1,1212,16,NOW()-'50 days'::interval,
    NOW()-'48 days'::interval,26,
    26,NOW()-'70 days'::interval,NOW()-'20 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,2,21,3);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'70 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para aprovação.',16,NOW()-'55 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado pela gestão.',16,NOW()-'50 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente. Ciência registrada.',26,NOW()-'48 days'::interval),
    (r_id,'aprovado','em_execucao','Movimentação vinculada — entrega iniciada.',26,NOW()-'30 days'::interval),
    (r_id,'em_execucao','concluido','Entrega confirmada — movimentação concluída com sucesso.',26,NOW()-'20 days'::interval);
END IF;

-- ── 19. Concluído — segundo (substituição ciclo completo) ─────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00019') THEN
  INSERT INTO requests (protocol,type,status,input_channel,input_channel_details,requester_person_id,unit_id,fundamentacao,approved_by,approved_at,dit_ciente_at,dit_ciente_by,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00019','substituicao','concluido','chamado','CHM-2026-2500',
    6,1409,'avaria',16,NOW()-'60 days'::interval,
    NOW()-'58 days'::interval,37,
    37,NOW()-'80 days'::interval,NOW()-'25 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,1,15,7,2);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Chamado aberto.',37,NOW()-'80 days'::interval),
    (r_id,'requisitado','visita_tecnica_solicitada','Visita agendada.',37,NOW()-'78 days'::interval),
    (r_id,'visita_tecnica_solicitada','aguardando_aprovacao','Defeito constatado.',37,NOW()-'70 days'::interval),
    (r_id,'aguardando_aprovacao','aprovado','Aprovado.',16,NOW()-'60 days'::interval),
    (r_id,'aprovado','aprovado','DIT ciente.',37,NOW()-'58 days'::interval),
    (r_id,'aprovado','em_execucao','Entrega iniciada.',37,NOW()-'40 days'::interval),
    (r_id,'em_execucao','concluido','Desktops substituídos. Movimentação encerrada.',37,NOW()-'25 days'::interval);
END IF;

-- ── 20. Reprovado ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00020') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,notes,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00020','acrescimo','reprovado','email',
    3,1306,'Solicitação não atende os critérios mínimos para acréscimo de equipamentos.',
    16,NOW()-'40 days'::interval,NOW()-'32 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,4,15,23,30);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'40 days'::interval),
    (r_id,'requisitado','aguardando_aprovacao','Encaminhado para análise.',16,NOW()-'35 days'::interval),
    (r_id,'aguardando_aprovacao','reprovado','Reprovado: quantidade solicitada (30 unidades) supera o limite por solicitação.',16,NOW()-'32 days'::interval);
END IF;

-- ── 21. Cancelado ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM requests WHERE protocol = 'SOL-2026-00021') THEN
  INSERT INTO requests (protocol,type,status,input_channel,requester_person_id,unit_id,created_by,created_at,updated_at)
  VALUES ('SOL-2026-00021','emprestimo','cancelado','email',
    8,1457,26,NOW()-'60 days'::interval,NOW()-'52 days'::interval)
  RETURNING id INTO r_id;
  INSERT INTO request_catalog_items (request_id,item_type_id,brand_id,model_id,quantity)
  VALUES (r_id,10,8,3,1);
  INSERT INTO request_status_history (request_id,old_status,new_status,notes,changed_by,changed_at)
  VALUES
    (r_id,NULL,'requisitado','Solicitação registrada.',26,NOW()-'60 days'::interval),
    (r_id,'requisitado','cancelado','Cancelado a pedido da unidade — projetor foi emprestado de outra escola.',16,NOW()-'52 days'::interval);
END IF;

END $$;

COMMIT;
