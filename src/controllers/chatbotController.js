// src/controllers/chatbotController.js
const dotenv = require("dotenv");
dotenv.config();

const { Op, Sequelize } = require("sequelize");
const { Product, ProductAttribute, ProductAttributeValue, Category, ProductImage } = require("../models");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const CANDIDATE_MODELS = ["gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-flash-latest"];

const generateContentWithFallback = async (requestConfig) => {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      console.log(`🤖 Đang gọi Gemini API với model: ${model}...`);
      const resp = await ai.models.generateContent({
        ...requestConfig,
        model,
      });
      return { resp, modelUsed: model };
    } catch (err) {
      console.warn(`⚠️ Model ${model} gặp lỗi (${err.status || err.message}), thử model tiếp theo...`);
      lastError = err;
      if (err.status === 400 && err.message?.includes("API key not valid")) {
        throw err;
      }
    }
  }
  throw lastError;
};

// ==========================================
// HỖ TRỢ TRÍCH XUẤT NGÂN SÁCH & DANH MỤC
// ==========================================
const extractBudget = (message) => {
  if (!message) return null;
  const patterns = [
    { pattern: /(\d+)\s*(triệu|tr|m)/i, multiplier: 1000000 },
    { pattern: /(\d+)k/i, multiplier: 1000 },
    { pattern: /(\d+)\s*đến\s*(\d+)\s*(triệu|tr)/i, range: true, multiplier: 1000000 },
  ];

  for (const { pattern, multiplier, range } of patterns) {
    const match = message.match(pattern);
    if (match && range) {
      return {
        min: parseInt(match[1]) * multiplier,
        max: parseInt(match[2]) * multiplier
      };
    } else if (match) {
      const value = parseInt(match[1]) * multiplier;
      return { min: value * 0.8, max: value * 1.2, target: value };
    }
  }

  const numbers = message.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    const num = parseInt(numbers[0]);
    if (num >= 1000000) return { min: num * 0.8, max: num * 1.2, target: num };
    if (num >= 5 && num <= 150) {
      const value = num * 1000000;
      return { min: value * 0.8, max: value * 1.2, target: value };
    }
  }
  return null;
};

// Tìm kiếm sản phẩm liên quan từ kho hàng
const findRelevantProducts = async (message, budget) => {
  try {
    const msgLower = (message || '').toLowerCase();
    
    // Tìm các từ khóa linh kiện
    const categoryKeywords = {
      CPU: ['cpu', 'intel', 'amd', 'ryzen', 'core i', 'chip'],
      GPU: ['gpu', 'vga', 'card', 'rtx', 'gtx', 'radeon', 'màn hình'],
      RAM: ['ram', 'ddr4', 'ddr5', 'bộ nhớ'],
      MAINBOARD: ['main', 'mainboard', 'bo mạch', 'b660', 'b550', 'b760'],
      SSD: ['ssd', 'ổ cứng', 'nvme', 'm.2', 'storage'],
      CASE: ['case', 'vỏ', 'thùng máy'],
      HEATSINK: ['tản', 'cooler', 'fan', 'aio', 'heatsink'],
      MONITOR: ['màn hình', 'monitor', '144hz', '165hz', '24 inch', '27 inch'],
      KEYBOARD: ['bàn phím', 'keyboard', 'phím cơ'],
      MOUSE: ['chuột', 'mouse']
    };

    let targetCategories = [];
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => msgLower.includes(kw))) {
        targetCategories.push(cat);
      }
    }

    // Lấy danh sách sản phẩm từ DB
    const allProducts = await Product.findAll({
      include: [
        {
          model: Category,
          attributes: ['id', 'name']
        },
        {
          model: ProductAttributeValue,
          include: [{ model: ProductAttribute, attributes: ['name'] }],
          required: false
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["image_url", "is_main"],
          required: false
        }
      ],
      order: [
        ['stock', 'DESC'],
        ['price', 'ASC']
      ],
      limit: 80
    });

    if (allProducts.length === 0) return [];

    let scoredProducts = allProducts.map(p => {
      let score = 0;
      const pName = p.name.toLowerCase();
      const catName = p.Category?.name?.toUpperCase() || '';
      
      // Khớp danh mục
      if (targetCategories.includes(catName)) score += 15;
      
      // Khớp từ khóa tìm kiếm
      const searchTerms = msgLower.split(/\s+/).filter(w => w.length > 2);
      searchTerms.forEach(term => {
        if (pName.includes(term)) score += 10;
      });

      // Khớp khoảng giá ngân sách
      if (budget) {
        if (p.price >= budget.min && p.price <= budget.max) {
          score += 15;
        } else if (budget.target) {
          const diffRatio = Math.abs(p.price - budget.target) / budget.target;
          if (diffRatio < 0.3) score += 8;
        }
      }

      // Ưu tiên còn hàng
      if (p.stock > 0) score += 5;

      return { product: p, score };
    });

    // Sắp xếp theo độ phù hợp
    scoredProducts.sort((a, b) => b.score - a.score);

    // Nếu không khớp từ khóa cụ thể nào (ví dụ khách hỏi chung "tư vấn build PC" hoặc "chào bạn")
    // thì lấy đại diện đa dạng các danh mục chính
    if (scoredProducts[0].score <= 5) {
      const distinctCats = {};
      const balancedProducts = [];
      for (const p of allProducts) {
        const cat = p.Category?.name || 'Khác';
        if (!distinctCats[cat] || distinctCats[cat] < 2) {
          distinctCats[cat] = (distinctCats[cat] || 0) + 1;
          balancedProducts.push(p);
        }
        if (balancedProducts.length >= 15) break;
      }
      return balancedProducts;
    }

    return scoredProducts.slice(0, 15).map(item => item.product);
  } catch (err) {
    console.error("❌ findRelevantProducts error:", err.message);
    return [];
  }
};

// ==========================================
// MAIN CHATBOT - TRẢ LỜI THÔNG MINH BẰNG GEMINI
// ==========================================
exports.chatWithGemini = async (req, res) => {
  try {
    const { message, chatHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Tin nhắn không được để trống" });
    }

    const userMessage = message.trim();
    const budget = extractBudget(userMessage);

    // 1. Tìm các sản phẩm liên quan trong database để làm ngữ cảnh
    const relevantProducts = await findRelevantProducts(userMessage, budget);

    // Chuẩn bị thông tin sản phẩm để truyền cho AI
    const inventoryContext = relevantProducts.map(p => {
      const specs = p.ProductAttributeValues?.slice(0, 3).map(av => 
        `${av.ProductAttribute?.name}: ${av.value_text || av.value_number || ''}`
      ).filter(Boolean).join(', ') || '';
      
      const specText = specs ? ` | Thông số: ${specs}` : '';
      return `- [ID:${p.id}] ${p.name} (Danh mục: ${p.Category?.name || 'Linh kiện'}) | Giá: ${parseFloat(p.price).toLocaleString('vi-VN')}đ | Tình trạng: ${p.stock > 0 ? `Còn hàng (${p.stock})` : 'Tạm hết'}${specText}`;
    }).join('\n');

    // 2. Tạo Master Prompt cho Gemini
    const systemInstruction = `Bạn là Trợ lý AI kiêm Chuyên viên Tư vấn Công nghệ hàng đầu tại hệ thống cửa hàng máy tính Sale PC.

PHONG CÁCH VÀ NGUYÊN TẮC TƯ VẤN:
- **Thái độ:** Nhiệt tình, thân thiện, am hiểu chuyên sâu phần cứng máy tính và luôn lắng nghe nhu cầu khách hàng.
- **Xưng hô:** Xưng "mình" hoặc "em", gọi khách là "bạn" hoặc "anh/chị".
- **Sản phẩm & Giá cả:** Luôn sử dụng thông tin và giá bán thực tế từ kho hàng của Sale PC bên dưới. Khi giới thiệu linh kiện, hãy nêu tên chính xác kèm giá bán rõ ràng (VD: 4.200.000đ).
- **Khi khách hàng muốn build PC / tư vấn cấu hình:**
  + Tự động ghép cấu hình cân đối từ các linh kiện có sẵn trong kho (CPU, Mainboard, RAM, GPU, SSD, Case, Tản nhiệt).
  + Kiểm tra độ tương thích (Socket Intel LGA1700 vs AMD AM4/AM5, RAM DDR4/DDR5).
  + Tính tổng chi phí cụ thể và so sánh với ngân sách của khách.
  + Đưa ra dự đoán hiệu năng chơi game (FPS) hoặc làm việc thực tế.
  + Khuyến nghị mức nguồn (Wattage) phù hợp.
- **Khi khách hàng hỏi so sánh hoặc thông số:** Phân tích điểm mạnh, điểm yếu khách quan và đưa ra lời khuyên nên chọn linh kiện nào.
- **Khi khách hàng chào hỏi hoặc cảm ơn:** Đáp lại niềm nở, giới thiệu các dịch vụ của cửa hàng (tư vấn build PC, nâng cấp máy, chọn linh kiện giá tốt).
- **Kết thúc phản hồi:** Luôn có 1 câu hỏi gợi mở tự nhiên để hỗ trợ khách hàng tốt hơn (VD: "Bạn dự định chơi những tựa game nào là chủ yếu?", "Bạn có cần tư vấn thêm về màn hình hay phím chuột không?").
- **Định dạng:** Dùng Markdown đẹp mắt, ngắt dòng thoáng, dùng icon/emoji sinh động.`;

    const prompt = `DANH SÁCH SẢN PHẨM KHẢ DỤNG TẠI CỬA HÀNG SALE PC HIỆN NAY:
${inventoryContext || 'Cửa hàng có đầy đủ các linh kiện PC chính hãng.'}

YÊU CẦU CỦA KHÁCH HÀNG:
"${userMessage}"

Hãy đóng vai chuyên viên Sale PC và trả lời khách hàng một cách xuất sắc nhất!`;

    // 3. Chuẩn bị lịch sử hội thoại cho Gemini
    const formattedHistory = (Array.isArray(chatHistory) ? chatHistory.slice(-6) : [])
      .filter(msg => msg && msg.content && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'model'))
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    const messages = [
      ...formattedHistory,
      {
        role: "user",
        parts: [{ text: `${systemInstruction}\n\n${prompt}` }]
      }
    ];

    // 4. Gọi Gemini API với cơ chế dự phòng
    console.log('🤖 Đang gọi Gemini Chatbot API...');
    const { resp } = await generateContentWithFallback({
      contents: messages,
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
        maxOutputTokens: 2500,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        }
      ]
    });

    let replyText = "Xin lỗi bạn, mình chưa xử lý được câu hỏi này. Bạn có thể mô tả chi tiết hơn nhu cầu không ạ?";
    if (resp?.candidates?.[0]?.content?.parts?.[0]?.text) {
      replyText = resp.candidates[0].content.parts[0].text;
    } else if (typeof resp?.response?.text === 'function') {
      replyText = resp.response.text();
    } else if (resp?.response?.text) {
      replyText = resp.response.text;
    }

    // 5. Chuẩn bị thẻ sản phẩm gợi ý kèm hình ảnh cho giao diện
    const suggestedProducts = relevantProducts.slice(0, 4).map(p => {
      const imgs = p.images || [];
      const mainImage = imgs.find(img => img.is_main)?.image_url || imgs[0]?.image_url || null;
      return {
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        priceFormatted: parseFloat(p.price).toLocaleString('vi-VN') + 'đ',
        category: p.Category?.name || 'Linh kiện',
        stock: p.stock,
        mainImage
      };
    });

    return res.json({
      success: true,
      reply: replyText,
      products: suggestedProducts,
      context: {
        budget
      }
    });

  } catch (err) {
    console.error("❌ Chatbot error:", err);
    return res.status(500).json({
      success: false,
      reply: "Hệ thống tư vấn đang bận một chút, bạn thử lại sau giây lát nhé!",
      error: err.message
    });
  }
};

// ======================
// API PHỤ TRỢ
// ======================
exports.searchProducts = async (req, res) => {
  try {
    const { keyword, category, minPrice, maxPrice, inStock } = req.query;
    
    const where = {};
    
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${keyword}%` } },
        { description: { [Op.iLike]: `%${keyword}%` } }
      ];
    }
    
    if (category) {
      const cat = await Category.findOne({
        where: { name: { [Op.iLike]: `%${category}%` } }
      });
      if (cat) where.category_id = cat.id;
    }
    
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseInt(minPrice);
      if (maxPrice) where.price[Op.lte] = parseInt(maxPrice);
    }
    
    if (inStock === 'true') {
      where.stock = { [Op.gt]: 0 };
    }
    
    const products = await Product.findAll({
      where,
      include: [
        { model: ProductAttributeValue, include: [ProductAttribute], required: false },
        { model: Category, attributes: ['name'] }
      ],
      limit: 20
    });
    
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'description']
    });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ error: "Failed to get categories" });
  }
};