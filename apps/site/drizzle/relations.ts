import { relations } from "drizzle-orm/relations";
import { menuCategory, combo, branch, comboProduct, product, deliveryZone, orderProduct, order, promotion } from "./schema";

export const comboRelations = relations(combo, ({one, many}) => ({
	menuCategory: one(menuCategory, {
		fields: [combo.menuCategoryId],
		references: [menuCategory.id]
	}),
	branch: one(branch, {
		fields: [combo.branchId],
		references: [branch.id]
	}),
	comboProducts: many(comboProduct),
	orderProducts: many(orderProduct),
}));

export const menuCategoryRelations = relations(menuCategory, ({one, many}) => ({
	combos: many(combo),
	products: many(product),
	branch: one(branch, {
		fields: [menuCategory.branchId],
		references: [branch.id]
	}),
	promotions: many(promotion),
}));

export const branchRelations = relations(branch, ({many}) => ({
	combos: many(combo),
	products: many(product),
	menuCategories: many(menuCategory),
	deliveryZones: many(deliveryZone),
	promotions: many(promotion),
	orders: many(order),
}));

export const comboProductRelations = relations(comboProduct, ({one}) => ({
	combo: one(combo, {
		fields: [comboProduct.comboId],
		references: [combo.id]
	}),
	product: one(product, {
		fields: [comboProduct.productId],
		references: [product.id]
	}),
}));

export const productRelations = relations(product, ({one, many}) => ({
	comboProducts: many(comboProduct),
	menuCategory: one(menuCategory, {
		fields: [product.menuCategoryId],
		references: [menuCategory.id]
	}),
	branch: one(branch, {
		fields: [product.branchId],
		references: [branch.id]
	}),
	orderProducts: many(orderProduct),
	promotions: many(promotion),
}));

export const deliveryZoneRelations = relations(deliveryZone, ({one, many}) => ({
	branch: one(branch, {
		fields: [deliveryZone.branchId],
		references: [branch.id]
	}),
	orders: many(order),
}));

export const orderProductRelations = relations(orderProduct, ({one}) => ({
	product: one(product, {
		fields: [orderProduct.productId],
		references: [product.id]
	}),
	order: one(order, {
		fields: [orderProduct.orderId],
		references: [order.id]
	}),
	promotion: one(promotion, {
		fields: [orderProduct.promotionId],
		references: [promotion.id]
	}),
	combo: one(combo, {
		fields: [orderProduct.comboId],
		references: [combo.id]
	}),
}));

export const orderRelations = relations(order, ({one, many}) => ({
	orderProducts: many(orderProduct),
	branch: one(branch, {
		fields: [order.branchId],
		references: [branch.id]
	}),
	deliveryZone: one(deliveryZone, {
		fields: [order.deliveryZoneId],
		references: [deliveryZone.id]
	}),
}));

export const promotionRelations = relations(promotion, ({one, many}) => ({
	orderProducts: many(orderProduct),
	menuCategory: one(menuCategory, {
		fields: [promotion.appliesToCategoryId],
		references: [menuCategory.id]
	}),
	product: one(product, {
		fields: [promotion.appliesToProductId],
		references: [product.id]
	}),
	branch: one(branch, {
		fields: [promotion.branchId],
		references: [branch.id]
	}),
}));