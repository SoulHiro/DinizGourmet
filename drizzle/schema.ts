import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  foreignKey,
  integer,
  numeric,
  serial,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const consumptionMethod = pgEnum("consumption_method", [
  "TAKEAWAY",
  "DELIVERY",
]);
export const orderStatus = pgEnum("order_status", [
  "PENDING",
  "IN_PREPARATION",
  "FINISHED",
]);
export const promotionType = pgEnum("promotion_type", [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "BUY_ONE_GET_ONE",
]);

export const branch = pgTable("branch", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  address: text().notNull(),
  phone: text(),
  email: text(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const combo = pgTable(
  "combo",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    price: integer().notNull(),
    imageUrl: text("image_url").notNull(),
    menuCategoryId: uuid("menu_category_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.menuCategoryId],
      foreignColumns: [menuCategory.id],
      name: "combo_menu_category_id_menu_category_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.branchId],
      foreignColumns: [branch.id],
      name: "combo_branch_id_branch_id_fk",
    }).onDelete("cascade"),
  ],
);

export const comboProduct = pgTable(
  "combo_product",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    comboId: uuid("combo_id").notNull(),
    productId: uuid("product_id").notNull(),
    quantity: integer().default(1).notNull(),
    isOptional: boolean("is_optional").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.comboId],
      foreignColumns: [combo.id],
      name: "combo_product_combo_id_combo_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [product.id],
      name: "combo_product_product_id_product_id_fk",
    }).onDelete("cascade"),
  ],
);

export const product = pgTable(
  "product",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    price: integer().notNull(),
    imageUrl: text("image_url").notNull(),
    ingredients: text().array().notNull(),
    menuCategoryId: uuid("menu_category_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.menuCategoryId],
      foreignColumns: [menuCategory.id],
      name: "product_menu_category_id_menu_category_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.branchId],
      foreignColumns: [branch.id],
      name: "product_branch_id_branch_id_fk",
    }).onDelete("cascade"),
  ],
);

export const menuCategory = pgTable(
  "menu_category",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    branchId: uuid("branch_id"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.branchId],
      foreignColumns: [branch.id],
      name: "menu_category_branch_id_branch_id_fk",
    }).onDelete("cascade"),
  ],
);

export const deliveryZone = pgTable(
  "delivery_zone",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    branchId: uuid("branch_id").notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    coveredCeps: text("covered_ceps").array().default([""]).notNull(),
    coveredNeighborhoods: text("covered_neighborhoods")
      .array()
      .default([""])
      .notNull(),
    radiusKm: numeric("radius_km", { precision: 5, scale: 2 }),
    minOrderValueForFree: integer("min_order_value_for_free").default(0),
    isActive: boolean("is_active").default(true).notNull(),
    availableHours: text("available_hours").default(
      '{"start": "09:00", "end": "22:00"}',
    ),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.branchId],
      foreignColumns: [branch.id],
      name: "delivery_zone_branch_id_branch_id_fk",
    }).onDelete("cascade"),
  ],
);

export const orderProduct = pgTable(
  "order_product",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    orderId: integer("order_id").notNull(),
    quantity: integer().notNull(),
    price: integer().notNull(),
    promotionId: uuid("promotion_id"),
    comboId: uuid("combo_id"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.productId],
      foreignColumns: [product.id],
      name: "order_product_product_id_product_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [order.id],
      name: "order_product_order_id_order_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.promotionId],
      foreignColumns: [promotion.id],
      name: "order_product_promotion_id_promotion_id_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.comboId],
      foreignColumns: [combo.id],
      name: "order_product_combo_id_combo_id_fk",
    }).onDelete("set null"),
  ],
);

export const promotion = pgTable(
  "promotion",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    type: promotionType().notNull(),
    value: integer().notNull(),
    startDate: timestamp("start_date", { mode: "string" }).notNull(),
    endDate: timestamp("end_date", { mode: "string" }).notNull(),
    appliesToCategoryId: uuid("applies_to_category_id"),
    appliesToProductId: uuid("applies_to_product_id"),
    branchId: uuid("branch_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.appliesToCategoryId],
      foreignColumns: [menuCategory.id],
      name: "promotion_applies_to_category_id_menu_category_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.appliesToProductId],
      foreignColumns: [product.id],
      name: "promotion_applies_to_product_id_product_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.branchId],
      foreignColumns: [branch.id],
      name: "promotion_branch_id_branch_id_fk",
    }).onDelete("cascade"),
  ],
);

export const order = pgTable(
  "order",
  {
    id: serial().primaryKey().notNull(),
    total: integer().notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    status: orderStatus().notNull(),
    consumptionMethod: consumptionMethod("consumption_method").notNull(),
    branchId: uuid("branch_id").notNull(),
    deliveryZoneId: uuid("delivery_zone_id"),
    deliveryAddress: text("delivery_address").notNull(),
    deliveryCep: text("delivery_cep").notNull(),
    deliveryNeighborhood: text("delivery_neighborhood"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    customerName: text("customer_name").notNull(),
    customerCpf: text("customer_cpf").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.branchId],
      foreignColumns: [branch.id],
      name: "order_branch_id_branch_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.deliveryZoneId],
      foreignColumns: [deliveryZone.id],
      name: "order_delivery_zone_id_delivery_zone_id_fk",
    }).onDelete("set null"),
  ],
);
