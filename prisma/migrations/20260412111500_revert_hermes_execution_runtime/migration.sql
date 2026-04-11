-- Revert Hermes execution runtime from the active public schema.
-- Preserve existing Hermes rows by archiving them into a private schema first.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('hermes_execution_jobs', 'hermes_execution_events')
    ) THEN
        EXECUTE 'CREATE SCHEMA IF NOT EXISTS archive';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'hermes_execution_jobs'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'archive'
          AND table_name = 'hermes_execution_jobs_20260412111500'
    ) THEN
        EXECUTE '
            CREATE TABLE archive.hermes_execution_jobs_20260412111500 AS
            SELECT
                id,
                workspace_id,
                requested_by_user_id,
                thread_id,
                run_id,
                origin_message_id,
                job_kind::text AS job_kind,
                launch_source::text AS launch_source,
                runtime_mode::text AS runtime_mode,
                status::text AS status,
                status_reason,
                target_type::text AS target_type,
                target_id,
                project_id,
                issue_id,
                workflow_run_id,
                doc_id,
                requires_human_input,
                waiting_approval_id,
                retry_count,
                runtime_session_id,
                runtime_job_id,
                runtime_agent_name,
                runtime_metadata,
                request_summary,
                user_intent,
                context_snapshot,
                input_payload,
                latest_result_summary,
                latest_result_data,
                latest_error,
                last_heartbeat_at,
                started_at,
                finished_at,
                cancelled_at,
                created_at,
                updated_at
            FROM public.hermes_execution_jobs
        ';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'hermes_execution_events'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'archive'
          AND table_name = 'hermes_execution_events_20260412111500'
    ) THEN
        EXECUTE '
            CREATE TABLE archive.hermes_execution_events_20260412111500 AS
            SELECT
                id,
                job_id,
                workspace_id,
                event_index,
                event_type::text AS event_type,
                status_after_event::text AS status_after_event,
                summary,
                payload,
                related_approval_id,
                related_run_step_id,
                related_execution_record_id,
                created_at
            FROM public.hermes_execution_events
        ';
    END IF;
END $$;

DROP TABLE IF EXISTS "public"."hermes_execution_events";
DROP TABLE IF EXISTS "public"."hermes_execution_jobs";

DROP TYPE IF EXISTS "public"."HermesExecutionEventType";
DROP TYPE IF EXISTS "public"."HermesExecutionJobKind";
DROP TYPE IF EXISTS "public"."HermesExecutionJobStatus";
DROP TYPE IF EXISTS "public"."HermesLaunchSource";
DROP TYPE IF EXISTS "public"."HermesRuntimeMode";
