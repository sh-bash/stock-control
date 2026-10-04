CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(30) NOT NULL,
	"owner_id" uuid NOT NULL,
	"path" varchar(300) NOT NULL,
	"file_name" varchar(200),
	"mime" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comparison_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comparison_id" uuid NOT NULL,
	"request_item_id" uuid,
	"supplier_id" uuid,
	"name" varchar(200) NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'RMB' NOT NULL,
	"moq" numeric(18, 4),
	"lead_time_days" integer,
	"weight_kg" numeric(12, 3),
	"length_cm" numeric(10, 2),
	"width_cm" numeric(10, 2),
	"height_cm" numeric(10, 2),
	"pack_length_cm" numeric(10, 2),
	"pack_width_cm" numeric(10, 2),
	"pack_height_cm" numeric(10, 2),
	"notes" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"promoted_product_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_type" varchar(30) NOT NULL,
	"ref_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"is_issue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_comparison" varchar(50) NOT NULL,
	"request_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"notes" text,
	"exchange_rate" numeric(18, 4) DEFAULT '1' NOT NULL,
	"weights" jsonb,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_comparisons_no_comparison_unique" UNIQUE("no_comparison")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"product_id" uuid,
	"name" varchar(200) NOT NULL,
	"spec" text,
	"qty" numeric(18, 4) NOT NULL,
	"unit" varchar(30),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_request" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"notes" text,
	"needed_date" date,
	"needs_approval" boolean DEFAULT true NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_requests_no_request_unique" UNIQUE("no_request")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_batch" varchar(50) NOT NULL,
	"file_name" varchar(200),
	"import_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'committed' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"opening_rows" integer DEFAULT 0 NOT NULL,
	"adjust_in_rows" integer DEFAULT 0 NOT NULL,
	"adjust_out_rows" integer DEFAULT 0 NOT NULL,
	"unchanged_rows" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_import_batches_no_batch_unique" UNIQUE("no_batch")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty_before" numeric(18, 4) NOT NULL,
	"qty_import" numeric(18, 4) NOT NULL,
	"qty_diff" numeric(18, 4) NOT NULL,
	"hpp" numeric(18, 4),
	"action" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_kg" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "width_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "height_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_length_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_width_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_height_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "price_foreign" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "comparison_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "currency" varchar(3) DEFAULT 'IDR' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "exchange_rate" numeric(18, 4) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "total_weight" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "tracking_no" varchar(100);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "eta_date" date;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "notes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_candidates" ADD CONSTRAINT "comparison_candidates_comparison_id_product_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."product_comparisons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_candidates" ADD CONSTRAINT "comparison_candidates_request_item_id_product_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."product_request_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_candidates" ADD CONSTRAINT "comparison_candidates_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_candidates" ADD CONSTRAINT "comparison_candidates_promoted_product_id_products_id_fk" FOREIGN KEY ("promoted_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_comparisons" ADD CONSTRAINT "product_comparisons_request_id_product_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."product_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_comparisons" ADD CONSTRAINT "product_comparisons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_request_id_product_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."product_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_import_batches" ADD CONSTRAINT "stock_import_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_import_rows" ADD CONSTRAINT "stock_import_rows_batch_id_stock_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_import_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_import_rows" ADD CONSTRAINT "stock_import_rows_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_import_rows" ADD CONSTRAINT "stock_import_rows_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_owner_idx" ON "attachments" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_comments_ref_idx" ON "document_comments" USING btree ("ref_type","ref_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_candidate_id_comparison_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."comparison_candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_request_id_product_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."product_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_comparison_id_product_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."product_comparisons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
