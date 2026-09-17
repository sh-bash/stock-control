CREATE TABLE IF NOT EXISTS "stock_valuation_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty_on_hand" numeric(18, 4) NOT NULL,
	"total_value" numeric(18, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_valuation_snapshot_date_product_warehouse_unique" UNIQUE("snapshot_date","product_id","warehouse_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_valuation_snapshot" ADD CONSTRAINT "stock_valuation_snapshot_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_valuation_snapshot" ADD CONSTRAINT "stock_valuation_snapshot_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
