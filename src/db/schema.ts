import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text as pgText,
  serial,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Enums
export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "IN_PREPARATION",
  "FINISHED",
]);

export const consumptionMethodEnum = pgEnum("consumption_method", [
  "TAKEAWAY",
  "DELIVERY",
]);

export type ConsumptionMethod =
  (typeof consumptionMethodEnum.enumValues)[number];

export const promotionTypeEnum = pgEnum("promotion_type", [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "BUY_ONE_GET_ONE",
]);

export const deliveryZones = pgTable("delivery_zone", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  deliveryFee: integer("delivery_fee").notNull(),
  coveredCeps: pgText("covered_ceps").array().notNull().default([]),
  coveredNeighborhoods: pgText("covered_neighborhoods")
    .array()
    .notNull()
    .default([]),
  radiusKm: decimal("radius_km", { precision: 5, scale: 2 }),
  minOrderValueForFree: integer("min_order_value_for_free").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  availableHours: pgText("available_hours").default(
    '{"start": "09:00", "end": "22:00"}',
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tables
export const menuCategories = pgTable("menu_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("product", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  imageUrl: text("image_url").notNull(),
  ingredients: pgText("ingredients").array().notNull(),
  menuCategoryId: uuid("menu_category_id")
    .notNull()
    .references(() => menuCategories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const promotions = pgTable("promotion", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: promotionTypeEnum("type").notNull(),
  value: integer("value").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  appliesToCategoryId: uuid("applies_to_category_id").references(
    () => menuCategories.id,
    { onDelete: "cascade" },
  ),
  appliesToProductId: uuid("applies_to_product_id").references(
    () => products.id,
    { onDelete: "cascade" },
  ),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const combos = pgTable("combo", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  imageUrl: text("image_url").notNull(),
  menuCategoryId: uuid("menu_category_id")
    .notNull()
    .references(() => menuCategories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const comboProducts = pgTable("combo_product", {
  id: uuid("id").primaryKey().defaultRandom(),
  comboId: uuid("combo_id")
    .notNull()
    .references(() => combos.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  isOptional: boolean("is_optional").default(false).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orders = pgTable("order", {
  id: serial("id").primaryKey(),
  total: integer("total").notNull(),
  deliveryFee: integer("delivery_fee"),
  customerName: text("customer_name").notNull(),
  customerCpf: text("customer_cpf").notNull(),
  status: orderStatusEnum("status").notNull(),
  consumptionMethod: consumptionMethodEnum("consumption_method").notNull(),
  deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id, {
    onDelete: "set null",
  }),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNeighborhood: text("delivery_neighborhood"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderProducts = pgTable("order_product", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
  promotionId: uuid("promotion_id").references(() => promotions.id, {
    onDelete: "set null",
  }),
  comboId: uuid("combo_id").references(() => combos.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const deliveryZonesRelations = relations(deliveryZones, ({ many }) => ({
  orders: many(orders),
}));

export const menuCategoriesRelations = relations(
  menuCategories,
  ({ many }) => ({
    products: many(products),
    promotions: many(promotions, { relationName: "appliesToCategory" }),
    combos: many(combos),
  }),
);

export const productsRelations = relations(products, ({ one, many }) => ({
  menuCategory: one(menuCategories, {
    fields: [products.menuCategoryId],
    references: [menuCategories.id],
  }),
  orderProducts: many(orderProducts),
  promotions: many(promotions, { relationName: "appliesToProduct" }),
  comboProducts: many(comboProducts),
}));

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  appliesToCategory: one(menuCategories, {
    fields: [promotions.appliesToCategoryId],
    references: [menuCategories.id],
    relationName: "appliesToCategory",
  }),
  appliesToProduct: one(products, {
    fields: [promotions.appliesToProductId],
    references: [products.id],
    relationName: "appliesToProduct",
  }),
  orderProducts: many(orderProducts),
}));

export const combosRelations = relations(combos, ({ one, many }) => ({
  menuCategory: one(menuCategories, {
    fields: [combos.menuCategoryId],
    references: [menuCategories.id],
  }),
  comboProducts: many(comboProducts),
  orderProducts: many(orderProducts),
}));

export const comboProductsRelations = relations(comboProducts, ({ one }) => ({
  combo: one(combos, {
    fields: [comboProducts.comboId],
    references: [combos.id],
  }),
  product: one(products, {
    fields: [comboProducts.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  deliveryZone: one(deliveryZones, {
    fields: [orders.deliveryZoneId],
    references: [deliveryZones.id],
  }),
  orderProducts: many(orderProducts),
}));

export const orderProductsRelations = relations(orderProducts, ({ one }) => ({
  product: one(products, {
    fields: [orderProducts.productId],
    references: [products.id],
  }),
  order: one(orders, {
    fields: [orderProducts.orderId],
    references: [orders.id],
  }),
  promotion: one(promotions, {
    fields: [orderProducts.promotionId],
    references: [promotions.id],
  }),
  combo: one(combos, {
    fields: [orderProducts.comboId],
    references: [combos.id],
  }),
}));

export const events = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  attraction: text("attraction"),
  eventDate: date("event_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time"),
  location: text("location").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const eventReservations = pgTable("event_reservation", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  partySize: integer("party_size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventsRelations = relations(events, ({ many }) => ({
  reservations: many(eventReservations),
}));

export const eventReservationsRelations = relations(
  eventReservations,
  ({ one }) => ({
    event: one(events, {
      fields: [eventReservations.eventId],
      references: [events.id],
    }),
  }),
);
