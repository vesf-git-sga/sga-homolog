-- Canal de entrada EducaGestor para solicitações de Acréscimo
-- Armazena o Protocolo da Ocorrência em input_channel_details (ex.: 000001500)

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_input_channel_check;

ALTER TABLE requests
  ADD CONSTRAINT requests_input_channel_check
  CHECK (input_channel IN ('email', 'sei', 'chamado', 'educagestor'));
