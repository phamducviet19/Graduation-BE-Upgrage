module.exports = (db) => {
  const {
    User,
    Brand,
    Category,
    Product,
    ProductImage,
    ProductAttribute,
    ProductAttributeValue,
    Wishlist,
    ProductCompare,
    Cart,
    Order,
    OrderDetail,
    Payment,
    Promotion,
    Warranty,
    Supplier,
    ImportReceipt,
    ImportDetail,
    PcBuild,
    PcBuildDetail
  } = db;

  // ===== User relations =====
  User.hasMany(Order, { foreignKey: "user_id" });
  Order.belongsTo(User, { foreignKey: "user_id" });

  User.hasMany(Wishlist, { foreignKey: "user_id" });
  Wishlist.belongsTo(User, { foreignKey: "user_id" });

  User.hasMany(ProductCompare, { foreignKey: "user_id" });
  ProductCompare.belongsTo(User, { foreignKey: "user_id" });

  User.hasMany(Cart, { foreignKey: "user_id" });
  Cart.belongsTo(User, { foreignKey: "user_id" });

  User.hasMany(PcBuild, { foreignKey: "user_id" });
  PcBuild.belongsTo(User, { foreignKey: "user_id" });

  // ===== Brand / Category / Product =====
  Brand.hasMany(Product, {
    foreignKey: "brand_id",
    onDelete: "RESTRICT", // hoặc "CASCADE" hoặc "SET NULL"
    onUpdate: "CASCADE"
  });

  Product.belongsTo(Brand, {
    foreignKey: "brand_id"
  });

  Category.hasMany(Product, {
    foreignKey: "category_id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE"
  });

  Product.belongsTo(Category, {
    foreignKey: "category_id"
  });


  Category.hasMany(ProductAttribute, { foreignKey: "category_id" });
  ProductAttribute.belongsTo(Category, { foreignKey: "category_id" });

  Product.hasMany(ProductImage, { foreignKey: "product_id", as: "images" });
  ProductImage.belongsTo(Product, { foreignKey: "product_id", as: "product" });


  Product.hasMany(ProductAttributeValue, { foreignKey: "product_id" });
  ProductAttributeValue.belongsTo(Product, { foreignKey: "product_id" });

  ProductAttribute.hasMany(ProductAttributeValue, { foreignKey: "attribute_id" });
  ProductAttributeValue.belongsTo(ProductAttribute, { foreignKey: "attribute_id" });

  Product.hasMany(Wishlist, { foreignKey: "product_id" });
  Wishlist.belongsTo(Product, { foreignKey: "product_id" });

  Product.hasMany(ProductCompare, { foreignKey: "product_id" });
  ProductCompare.belongsTo(Product, { foreignKey: "product_id" });

  Product.hasMany(Cart, { foreignKey: "product_id" });
  Cart.belongsTo(Product, { foreignKey: "product_id" });

  Product.hasMany(OrderDetail, { foreignKey: "product_id" });
  OrderDetail.belongsTo(Product, { foreignKey: "product_id" });

  Product.hasMany(ImportDetail, { foreignKey: "product_id" });
  ImportDetail.belongsTo(Product, { foreignKey: "product_id" });

  Product.hasOne(Warranty, { foreignKey: "product_id" });
  Warranty.belongsTo(Product, { foreignKey: "product_id" });

  PcBuildDetail.belongsTo(Product, { foreignKey: "product_id" });
  Product.hasMany(PcBuildDetail, { foreignKey: "product_id" });

  // ===== Orders / OrderDetails / Payments =====
  Order.hasMany(OrderDetail, { foreignKey: "order_id" });
  OrderDetail.belongsTo(Order, { foreignKey: "order_id" });

  Order.hasOne(Payment, { foreignKey: "order_id" });
  Payment.belongsTo(Order, { foreignKey: "order_id" });

  // ===== Suppliers / Imports =====
  Supplier.hasMany(ImportReceipt, { foreignKey: "supplier_id" });
  ImportReceipt.belongsTo(Supplier, { foreignKey: "supplier_id" });

  ImportReceipt.hasMany(ImportDetail, { foreignKey: "receipt_id" });
  ImportDetail.belongsTo(ImportReceipt, { foreignKey: "receipt_id" });

  // ===== PC Builds =====
  PcBuild.hasMany(PcBuildDetail, { foreignKey: "build_id" });
  PcBuildDetail.belongsTo(PcBuild, { foreignKey: "build_id" });
};
