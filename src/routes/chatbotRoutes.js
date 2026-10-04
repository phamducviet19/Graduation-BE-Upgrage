const express = require('express');
const router = express.Router();
const { chatWithGemini } = require("../controllers/chatbotController.js");

router.post("/chat", chatWithGemini);

module.exports = router;
