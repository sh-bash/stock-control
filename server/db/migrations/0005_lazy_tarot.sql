CREATE TABLE IF NOT EXISTS "delivery_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"do_id" uuid NOT NULL,
	"so_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_delivered" numeric(18, 4) NOT NULL,
	"cogs_per_unit" numeric(18, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_do" varchar(50) NOT NULL,
	"so_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"delivery_date" date NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_orders_no_do_unique" UNIQUE("no_do")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"so_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_order" numeric(18, 4) NOT NULL,
	"sell_price" numeric(18, 2) NOT NULL,
	"qty_delivered" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_so" varchar(50) NOT NULL,
	"customer_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"use_do" boolean DEFAULT false NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_orders_no_so_unique" UNIQUE("no_so")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_return" numeric(18, 4) NOT NULL,
	"restore_hpp" numeric(18, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_return" varchar(50) NOT NULL,
	"source_type" varchar(10) NOT NULL,
	"source_id" uuid NOT NULL,
	"return_date" date NOT NULL,
	"condition" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_returns_no_return_unique" UNIQUE("no_return")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_order_items" ADD CONSTRAINT "delivery_order_items_do_id_delivery_orders_id_fk" FOREIGN KEY ("do_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_order_items" ADD CONSTRAINT "delivery_order_items_so_item_id_sale_order_items_id_fk" FOREIGN KEY ("so_item_id") REFERENCES "public"."sale_order_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_order_items" ADD CONSTRAINT "delivery_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_so_id_sale_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sale_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_so_id_sale_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sale_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_return_id_sale_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sale_returns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
