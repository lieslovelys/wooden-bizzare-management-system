// P1-10: folds the historical bootstrap (formerly backend/index.sql, now deleted) into the
// migration chain, so `npm run migrate` alone builds a fresh database — no more separate
// `psql -f backend/index.sql` step first. Timestamped earlier than every other migration so it
// always runs first.
//
// This is a faithful transcription of the old index.sql, not a rewrite — schema, 3 enum types,
// 9 tables with their FKs, the attendance indexes, and the 2 views, run as raw SQL rather than
// translated into pgm.createTable/etc calls. node-pg-migrate's own tracking table
// (`pgmigrations`) is what makes this safe to "re-run" going forward: once applied, `npm run
// migrate` skips it automatically, unlike the old bare `psql -f index.sql`, which errored on a
// second run because `CREATE TYPE` has no `IF NOT EXISTS` form in Postgres.
export const shorthands = undefined;

const UP_SQL = `
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "suffix" AS ENUM('None', 'Sr.', 'Jr.', 'II', 'III', 'IV', 'V');
CREATE TYPE "task_status" AS ENUM('Assigned', 'In Progress', 'For QA', 'Rework', 'Approved', 'Repair');
CREATE TYPE "user_role" AS ENUM('Admin', 'Production Manager', 'Inventory Staff', 'Quality Checker', 'Worker');

CREATE TABLE "users" (
	"user_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" varchar(255),
	"user_password" varchar(255),
	"first_name" varchar(255),
	"middle_name" varchar(255),
	"last_name" varchar(255),
	"suffix" suffix,
	"user_role" user_role,
	"created_at" date DEFAULT now()
);

CREATE TABLE "worker_details" (
	"detail_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "worker_details_detail_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint,
	"job_type" varchar(50),
	"job_role" varchar(100),
	"contact" varchar(50),
	"rate" numeric(10, 2),
	"photo" text,
	CONSTRAINT "worker_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE
);

CREATE TABLE "attendance" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"worker_id" bigint NOT NULL,
	"date" date NOT NULL,
	"day_of_week" varchar(15),
	"time_in" time,
	"time_out" time,
	"status" varchar(20) DEFAULT 'Absent',
	"late_minutes" integer DEFAULT 0,
	"overtime_minutes" integer DEFAULT 0,
	"notes" text,
	"photo" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "unique_worker_date" UNIQUE("worker_id","date"),
	CONSTRAINT "attendance_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "worker_details"("detail_id") ON DELETE CASCADE,
	CONSTRAINT "attendance_status_check" CHECK (((status)::text = ANY (ARRAY[('Present'::character varying)::text, ('Absent'::character varying)::text, ('Half-day'::character varying)::text, ('Late'::character varying)::text])))
);

CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"total_stock" integer NOT NULL,
	"unit" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL
);

CREATE TABLE "item_variants" (
	"id" serial PRIMARY KEY,
	"item_id" integer,
	"variant_name" varchar(100) NOT NULL,
	"current_stock" integer NOT NULL,
	"min_stock" integer NOT NULL,
	CONSTRAINT "item_variants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE
);

CREATE TABLE "projects" (
	"id" serial PRIMARY KEY,
	"project_name" varchar(255) NOT NULL,
	"client_name" varchar(255) NOT NULL,
	"contact_number" varchar(50),
	"date_ordered" date,
	"client_payment" numeric(12, 2),
	"priority_level" varchar(50),
	"due_date" date,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"status" varchar(50) DEFAULT 'Pending',
	"date_completed" date
);

CREATE TABLE "job_assignments" (
	"assignment_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_assignments_assignment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" integer,
	"worker_id" bigint,
	"stage_name" varchar(100) NOT NULL,
	"start_date" date,
	"due_date" date,
	"status" task_status DEFAULT 'Assigned',
	"qa_checker_id" bigint,
	"qa_notes" text,
	"date_completed" timestamp,
	"date_submitted" date,
	CONSTRAINT "job_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
	CONSTRAINT "job_assignments_qa_checker_id_fkey" FOREIGN KEY ("qa_checker_id") REFERENCES "users"("user_id") ON DELETE SET NULL,
	CONSTRAINT "job_assignments_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("user_id") ON DELETE CASCADE
);

CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY,
	"type" varchar(50),
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"target_role" varchar(50),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"reference_id" integer
);

CREATE TABLE "project_profit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_profit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" integer NOT NULL,
	"client_payment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"worker_wages" numeric(12, 2) DEFAULT '0' NOT NULL,
	"materials_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_expenses" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_expenses" numeric(12, 2) GENERATED ALWAYS AS (((worker_wages + materials_cost) + other_expenses)) STORED,
	"net_profit" numeric(12, 2) GENERATED ALWAYS AS ((((client_payment - worker_wages) - materials_cost) - other_expenses)) STORED,
	"recorded_by" bigint,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "project_profit_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
	CONSTRAINT "project_profit_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("user_id") ON DELETE SET NULL
);

CREATE TABLE "project_expense_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_expense_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"profit_id" bigint NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "project_expense_items_profit_id_fkey" FOREIGN KEY ("profit_id") REFERENCES "project_profit"("id") ON DELETE CASCADE
);

CREATE TABLE "project_variables" (
	"id" serial PRIMARY KEY,
	"project_id" integer,
	"variable_name" varchar(255) NOT NULL,
	"variable_detail" text,
	CONSTRAINT "project_variables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_attendance_date" ON "attendance" ("date");
CREATE INDEX "idx_attendance_day_of_week" ON "attendance" ("day_of_week");
CREATE INDEX "idx_attendance_status" ON "attendance" ("status");
CREATE INDEX "idx_attendance_worker" ON "attendance" ("worker_id");

CREATE VIEW "attendance_summary" AS (
	SELECT
		wd.detail_id AS worker_id,
		u.first_name,
		u.last_name,
		count(a.id) AS total_logs,
		count(CASE WHEN a.status::text = 'Present'::text THEN 1 END) AS days_present,
		count(CASE WHEN a.status::text = 'Late'::text THEN 1 END) AS days_late,
		count(CASE WHEN a.status::text = 'Absent'::text THEN 1 END) AS days_absent,
		count(CASE WHEN a.status::text = 'Half-day'::text THEN 1 END) AS days_halfday,
		count(CASE WHEN a.time_out IS NOT NULL THEN 1 END) AS days_complete,
		COALESCE(sum(a.late_minutes), 0::bigint) AS total_late_minutes,
		COALESCE(sum(a.overtime_minutes), 0::bigint) AS total_overtime_minutes,
		min(a.date) AS first_log,
		max(a.date) AS last_log
	FROM worker_details wd
	JOIN users u ON u.user_id = wd.user_id
	LEFT JOIN attendance a ON a.worker_id = wd.detail_id
	GROUP BY wd.detail_id, u.first_name, u.last_name
);

CREATE VIEW "project_profit_summary" AS (
	SELECT
		p.id AS project_id,
		p.project_name,
		p.client_name,
		pp.client_payment,
		pp.worker_wages,
		pp.materials_cost,
		pp.other_expenses,
		pp.total_expenses,
		pp.net_profit,
		pp.updated_at
	FROM projects p
	JOIN project_profit pp ON pp.project_id = p.id
);
`;

export const up = (pgm) => {
  pgm.sql(UP_SQL);
};

// Reverting migration zero means "back to an empty database." Originally written as
// `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` — simpler, but wrong: it also destroys
// node-pg-migrate's own `pgmigrations` bookkeeping table, which the tool then immediately
// fails trying to write to right after running this `down` (confirmed by actually running it
// against a scratch database). Explicit drops instead, leaving the schema itself — and
// `pgmigrations`, a sibling object in it — untouched.
export const down = (pgm) => {
  pgm.sql(`
DROP VIEW IF EXISTS "project_profit_summary";
DROP VIEW IF EXISTS "attendance_summary";
DROP TABLE IF EXISTS "project_variables", "project_expense_items", "project_profit",
  "notifications", "job_assignments", "item_variants", "inventory_items", "projects",
  "attendance", "worker_details", "users" CASCADE;
DROP TYPE IF EXISTS "user_role";
DROP TYPE IF EXISTS "task_status";
DROP TYPE IF EXISTS "suffix";
`);
};
