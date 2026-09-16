CREATE TABLE IF NOT EXISTS "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_order" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"qty_received" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_po" varchar(50) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_no_po_unique" UNIQUE("no_po")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receiving_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiving_id" uuid NOT NULL,
	"shipment_item_id" uuid NOT NULL,
	"po_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_received" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"shipping_cost_per_unit" numeric(18, 4) NOT NULL,
	"hpp" numeric(18, 4) NOT NULL,
	"stock_layer_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receivings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_receiving" varchar(50) NOT NULL,
	"shipment_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"receive_date" date NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "receivings_no_receiving_unique" UNIQUE("no_receiving")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"po_item_id" uuid NOT NULL,
	"qty_shipped" numeric(18, 4) NOT NULL,
	"weight" numeric(18, 4),
	"allocated_shipping_cost_per_unit" numeric(18, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_po_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_shipment" varchar(50) NOT NULL,
	"expedition_id" uuid NOT NULL,
	"ship_date" date NOT NULL,
	"total_shipping_cost" numeric(18, 2) NOT NULL,
	"allocation_method" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_no_shipment_unique" UNIQUE("no_shipment")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_id" uuid NOT NULL,
	"receive_date" date NOT NULL,
	"qty_original" numeric(18, 4) NOT NULL,
	"qty_remaining" numeric(18, 4) NOT NULL,
	"hpp" numeric(18, 4) NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"transaction_type" varchar(30) NOT NULL,
	"reference_type" varchar(30) NOT NULL,
	"reference_id" uuid NOT NULL,
	"reference_no" varchar(50),
	"transaction_date" timestamp NOT NULL,
	"qty_in" numeric(18, 4) DEFAULT '0' NOT NULL,
	"qty_out" numeric(18, 4) DEFAULT '0' NOT NULL,
	"hpp_used" numeric(18, 4),
	"running_balance_qty" numeric(18, 4) NOT NULL,
	"running_balance_value" numeric(18, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_ledger_id_transaction_date_pk" PRIMARY KEY("id","transaction_date")
) PARTITION BY RANGE ("transaction_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty_on_hand" numeric(18, 4) DEFAULT '0' NOT NULL,
	"qty_reserved" numeric(18, 4) DEFAULT '0' NOT NULL,
	"qty_available" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_summary_product_warehouse_unique" UNIQUE("product_id","warehouse_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_receiving_id_receivings_id_fk" FOREIGN KEY ("receiving_id") REFERENCES "public"."receivings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_shipment_item_id_shipment_items_id_fk" FOREIGN KEY ("shipment_item_id") REFERENCES "public"."shipment_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivings" ADD CONSTRAINT "receivings_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivings" ADD CONSTRAINT "receivings_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receivings" ADD CONSTRAINT "receivings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipment_po_ref" ADD CONSTRAINT "shipment_po_ref_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipment_po_ref" ADD CONSTRAINT "shipment_po_ref_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipments" ADD CONSTRAINT "shipments_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_layers" ADD CONSTRAINT "stock_layers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_layers" ADD CONSTRAINT "stock_layers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_summary" ADD CONSTRAINT "stock_summary_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_summary" ADD CONSTRAINT "stock_summary_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_layers_product_warehouse_status_receivedate_idx" ON "stock_layers" USING btree ("product_id","warehouse_id","status","receive_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_ledger_product_warehouse_txndate_idx" ON "stock_ledger" USING btree ("product_id","warehouse_id","transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_ledger_reference_idx" ON "stock_ledger" USING btree ("reference_type","reference_id");--> statement-breakpoint
-- ============================================================
-- stock_ledger monthly partitions (PRD §8: "Partitioning stock_ledger
-- per bulan, setup dari Fase 3, jangan tunggu data besar").
-- Indexes created above on the parent partitioned table are automatically
-- inherited by every partition, current and future (PostgreSQL 12+).
-- A monthly job (see server/jobs) should create next month's partition
-- ahead of time; stock_ledger_default catches anything outside range
-- as a safety net so inserts never fail while that job is pending.
-- ============================================================
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_01" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_02" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_03" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_04" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_05" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_06" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_07" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_08" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_09" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_10" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_11" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2026_12" PARTITION OF "stock_ledger" FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_2027_01" PARTITION OF "stock_ledger" FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger_default" PARTITION OF "stock_ledger" DEFAULT;