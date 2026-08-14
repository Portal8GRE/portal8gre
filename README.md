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


## V0.7.1 — Acompanhamento de Aulas revisado
- Acompanhamento de Aulas movido para **Gestão e Inspeção**.
- Professor removido.
- Novo filtro de modalidade: **EJA, Ensino Fundamental, Ensino Médio e Outros**.
- Ao selecionar uma escola, Disciplina e Turma exibem somente opções daquela escola; Modalidade também é limitada à escola.
- Ordenação: menor/maior % de registro, mais sem lançamento, mais aguardando, escola A–Z e disciplina A–Z.
- Ranking de escolas com opção menor/maior registro.
- Leitor PDF refeito para registros multilinha, especialmente EJA, turmas externas e disciplinas extensas.
- Antes de salvar, o sistema compara registros detectados no PDF com registros reconhecidos. Se a leitura ficar abaixo de 99,5%, a importação é bloqueada.
- A quantidade de aulas previstas é inferida da carga horária e da duração média real das aulas da turma, importante para aulas de 45, 50 ou 60 minutos.
- Se `update-v070.sql` já foi executado com Success, não há SQL novo.
- Reimporte o PDF após publicar esta versão; relatórios antigos incompletos permanecem apenas no histórico.


## V0.7.2 — correção das escolas que não apareciam

Causa identificada:
- o PDF pode gerar milhares de linhas em `aulas_relatorio_itens`;
- o Portal fazia apenas uma consulta `select()` ao Supabase;
- por padrão, uma consulta retorna no máximo uma quantidade limitada de linhas;
- assim, somente o primeiro bloco de registros era carregado e as escolas que
  apareciam depois desse bloco não entravam nos filtros/painel, mesmo estando
  salvas no banco.

Correção:
- `listClassItems()` agora busca o relatório em páginas de 1.000 registros;
- todas as páginas são concatenadas antes de montar escolas, modalidades,
  disciplinas, turmas, ranking e indicadores;
- o cabeçalho do módulo mostra `carregados de total` para permitir conferência.

Não há SQL novo nesta versão.
Não é necessário reimportar o PDF se a importação anterior foi salva com sucesso.


## V0.7.3 — simplificação da página inicial
- Localização da 8ª GRE vinculada ao Google Maps:
  https://maps.app.goo.gl/dnmW89pxRaRda2Yu5
- Removida a frase “Dados integrados para acompanhar, planejar e intervir com mais agilidade.”
- Removido o card “Sistema Integrado” e o botão “+ Novo registro”.
- Removido o card “Informações do Sistema” e as informações técnicas sobre Supabase, armazenamento e permissões.
- Removido o indicador “Banco online” do cabeçalho interno.
- Removida a aba/setor “Gestão” da navegação e da página inicial.
- Mantidos os setores: Gerência Regional, Ensino e Aprendizagem, Gestão e Inspeção, Administração e Prestação de Contas.
- Não há SQL novo nesta versão.


## V0.7.4 — Portal sem informações técnicas + perfil Visualização

Alterações visíveis:
- retiradas referências a banco de dados, Supabase, Vercel, conexão e configuração técnica;
- retirada a mensagem de criação de contas via Supabase da tela de Usuários;
- retirada a área Configurações da interface;
- mensagens de erro passam a ser institucionais, sem diagnóstico técnico exposto;
- criado o perfil **Visualização**.

Perfil Visualização:
- pode consultar Transporte, Visitas, Gestão e Inspeção, Acompanhamento de Aulas, Escolas e demais áreas liberadas;
- não pode criar, editar, excluir, importar relatórios ou alterar permissões;
- a restrição foi aplicada tanto na interface quanto no banco para Visitas e Gestão/Inspeção.

Antes de usar o perfil Visualização, execute:
`supabase/update-v074.sql`


## V0.7.5 — correção do salvamento de Usuários

Causa:
- o formulário de edição de usuário ainda podia ser enviado pelo navegador como formulário GET;
- isso fazia os campos `id`, `nome` e `role` aparecerem na URL e nenhuma alteração chegar ao banco.

Correção:
- o formulário de usuário não realiza mais envio nativo;
- o botão Salvar é um botão comum controlado pelo JavaScript;
- o salvamento chama diretamente `updateProfile`;
- após salvar, a tabela é atualizada imediatamente;
- se houver falha, o Portal mostra uma mensagem simples;
- a versão deixou de aparecer no rodapé, para manter a interface sem informações técnicas.

Não há SQL novo nesta versão.
Se `update-v074.sql` já foi executado com Success, basta publicar os arquivos da V0.7.5.
