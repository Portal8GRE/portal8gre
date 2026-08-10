# Portal 8ª GRE — v0.3

Versão integrada do Portal 8ª GRE com banco Supabase e nova visualização do módulo de Transporte.

## Novidades da v0.3
- Calendário mensal de agendamentos de transporte.
- S10, Logan e Polo identificados por cores.
- Clique em uma data para visualizar todos os deslocamentos do dia.
- Alternância entre visualização em Calendário e Lista.
- Acesso aos detalhes: escola/destino, responsável, participantes, saída, retorno, finalidade e status.
- Novo agendamento diretamente a partir de uma data vazia do calendário.
- Validação de conflito de horário para o mesmo veículo.
- Previsão de retorno passa a ser obrigatória para permitir a verificação de conflito.

## Publicação
Substitua os arquivos do repositório GitHub pelos arquivos desta versão. A Vercel fará um novo deployment automaticamente após o commit na branch principal.

## Supabase
Esta versão usa as mesmas tabelas da v0.2. Não é necessário alterar o banco para usar o novo calendário.
