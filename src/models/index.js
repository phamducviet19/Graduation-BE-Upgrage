'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const sequelize = require('../config/db'); // file db.js export ra instance Sequelize
const basename = path.basename(__filename);

const db = {};

// Load all models dynamically
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&            // bỏ qua file ẩn
      file !== basename &&                  // bỏ qua index.js
      file.slice(-3) === '.js' &&           // chỉ lấy .js
      file.indexOf('.test.js') === -1 &&    // bỏ test file
      file !== 'associates.js'              // bỏ associates.js
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Import associations
require('./associates')(db);

// Add sequelize instance & Sequelize lib vào db để export
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
