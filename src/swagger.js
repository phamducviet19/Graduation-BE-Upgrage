const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0", // Chuẩn OpenAPI
    info: {
      title: "API Documentation",
      version: "1.0.0",
      description: "Test API bằng Swagger",
    },
    servers: [
      {
        url: "http://localhost:5000/api", // base URL
      },
    ],
  },
  apis: ["./src/routes/*.js"], // nơi chứa file định nghĩa API (dùng comment)
};

const swaggerSpec = swaggerJsDoc(options);

function swaggerDocs(app, port) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`Swagger Docs: http://localhost:${port}/api-docs`);
}

module.exports = swaggerDocs;
