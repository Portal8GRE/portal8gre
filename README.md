# Portal 8ª GRE — V0.6

Versão de produção com autenticação Supabase, conexão automática pela Vercel e atualização do módulo de Agendamento de Transporte.

## Novidades da V0.6

- Agendamento de Transporte exclusivo da Gerência Regional (Administrador mantém acesso técnico).
- Coordenação, técnicos e escolas ficam em modo somente visualização no Transporte.
- Gerência pode criar, editar, cancelar, marcar como realizado e excluir agendamentos.
- Após excluir, o sistema reabre a agenda do mesmo dia com opção de criar novo agendamento.
- Alerta amarelo quando já existe viagem para a mesma escola ou município na mesma data, sugerindo compartilhamento de veículo e/ou horário.
- Mantido bloqueio de conflito quando o mesmo veículo já está ocupado no intervalo informado.
- Auditoria automática de INSERT, UPDATE e DELETE do Transporte no `audit_log`.

## Atualização do banco

Antes de publicar a V0.6, execute no Supabase SQL Editor:

`supabase/update-v06.sql`

Execute apenas uma vez no mesmo projeto que já está em uso.

## Publicação

Substitua os arquivos do mesmo repositório GitHub já conectado à Vercel. Não crie outro projeto Vercel e não altere `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY`.


## V0.6.3 — correção definitiva do Transporte

A V0.6.3 muda o método de criação do agendamento:
- o front-end não faz mais INSERT direto na tabela `agendamentos_transporte`;
- o Portal chama a função segura `create_transport_booking`;
- o próprio banco identifica o usuário autenticado e grava `created_by`;
- somente `admin` e `gerencia` conseguem criar;
- os demais usuários continuam somente visualizando;
- editar e excluir continuam restritos à Gerência/Admin.

### Publicação
1. Execute `supabase/update-v063.sql` no SQL Editor.
2. Substitua TODOS os arquivos da aplicação pelos da V0.6.3 no mesmo repositório.
3. Aguarde o novo deployment da Vercel.
4. Confirme no rodapé que aparece `v0.6.3`.
5. Saia e entre novamente no Portal antes do primeiro teste.


## V0.6.4 — correção do envio do formulário de Transporte

Diagnóstico:
- o navegador estava enviando o formulário de Transporte como GET;
- isso era visível porque os campos do agendamento apareciam na URL (`?data=...&veiculo=...`);
- portanto o problema já não estava no SQL: o front-end não estava interceptando o envio de forma confiável.

Correção:
- o botão de salvar deixou de ser um botão `submit`;
- o formulário não pode mais navegar por GET;
- o salvamento é disparado diretamente por JavaScript;
- novos registros continuam usando a RPC `create_transport_booking` criada na V0.6.3;
- após gravar, o sistema recarrega os dados e confirma que o registro realmente voltou do Supabase;
- os scripts receberam `?v=0.6.4` para evitar cache de versões antigas no navegador.

Não é necessário executar novo SQL se `update-v063.sql` já foi executado com Success.


## V0.6.5 — correção do falso aviso após salvar

O agendamento já estava sendo gravado no Supabase, mas a V0.6.4 fazia uma
segunda conferência comparando o horário do formulário (`HH:MM`) com o horário
retornado pelo PostgreSQL (`HH:MM:SS`). Essa diferença fazia o Portal concluir,
incorretamente, que o registro não havia voltado do banco.

A V0.6.5:
- confirma o registro pelo UUID retornado pelo Supabase;
- não exibe mais o falso aviso de falha;
- mantém o agendamento salvo normalmente;
- não exige nenhuma nova alteração SQL no Supabase.

Basta publicar esta versão no GitHub/Vercel.


## V0.7.0 — Gestão → Acompanhamento de Aulas

Inclui módulo integrado ao Portal para importar o PDF “Comparativo de Previsão de Aulas com Aulas Ministradas” do iSEDUC, armazenar o PDF e o histórico no Supabase, consolidar turmas/disciplinas, calcular a previsão proporcional até a data de referência, exibir pendências e permitir vinculação de professor à turma/disciplina.

### Publicação
1. Execute `supabase/update-v070.sql` no SQL Editor do mesmo Supabase.
2. Substitua TODOS os arquivos do Portal pelos arquivos da V0.7.0 no mesmo repositório GitHub.
3. Aguarde o deploy automático da Vercel.
4. Confirme no rodapé `v0.7.0`.
5. Entre em Gestão → Acompanhamento de Aulas.

Não é necessário alterar as variáveis da Vercel.
