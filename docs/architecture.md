# Arquitetura Kage 0.6.4

Código original preservado. src/ contém bot, web e serviços existentes; backend/ concentra operações, políticas, RBAC, mídia, agenda e recuperação. bot-shared/ guarda contratos/políticas Zod. public/ é frontend ESM pt-BR. types/ contém contratos TypeScript usados também pelo cliente JSDoc. docs/, legal/, templates/ e migrations/ acompanham a entrega.

Fluxo: OAuth2 identify/guilds → sessão cifrada/CSRF/Origin → autorização atual por guilda/cargo → idempotência → schema → prévia → confirmação → claim queued → worker/lease → autorização e precondições por item → Discord → checkpoint/auditoria. Identidade vem da sessão. Senha/token não chegam ao navegador. A intenção durável permite explicar um resultado incerto, sem prometer transação com uma API externa.

Sessão: ID regenerado no login, prazo absoluto de uma hora e inatividade de trinta minutos; bootstrap e chamadas autenticadas verificam revogação por epoch. Polling de fundo não estende atividade. Logout destrói a sessão. Token OAuth2 AES-GCM e sessões connect-mongo cifradas. /health mede processo; /ready depende de banco e bot.

Modelos da mesma conexão: GuildConfig, Audit, Ticket, Operation, Profile, Receipt; WizardDraft, IdempotencyKey, UserPreference, BackupManifest, Punishment, ChannelLock, NativeControl/Revision, StructureControl, SecurityPolicy/Decision, VerificationChallenge, MediaAsset, PublishedMessage, Schedule, GuildAccess, SessionEpoch, ModerationPolicy, Escalation, MemberAutomation, BoostGrant e LogPolicy. Índices únicos, TTL e fila entram na migração aditiva, incluindo modelos originais. Nenhuma coleção foi apagada.

Claims e leases usam MongoDB; testes locais simulam consultas/concorrência. Outros processos podem disputar queued, mas running expirado vai para revisão. Não há retomada cega de efeito potencialmente enviado. Controles nativo e estrutural serializam mudanças de sua guilda e permanecem bloqueados em unknown até reconciliação autorizada.

Configuração e auditoria confirmada usam outbox no mesmo documento/CAS. Flusher idempotente elimina pendência após gravar Audit; falha conserva o registro. APIs não expõem a outbox. Campos privados e retenção são filtrados nas leituras.

Detalhes dos limites, retenções, payloads e adaptações estão em implementation.md. O roteiro de staging e verification.md distinguem testes locais das integrações ainda não executadas.
