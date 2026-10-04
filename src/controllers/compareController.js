const { ProductCompare, Product, ProductAttributeValue, ProductAttribute, Category, ProductImage } = require("../models");
const { Op } = require("sequelize");

const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenAI } = require("@google/genai");

// Khởi tạo Gemini AI từ env
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

// Thêm sản phẩm vào danh sách so sánh
exports.addToCompare = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;
    // kiểm tra sản phẩm có tồn tại
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    // lấy tất cả sản phẩm đã có trong compare list của user
    const existingCompares = await ProductCompare.findAll({
      where: { user_id: userId },
      include: [{ model: Product }]
    });
    // lọc những sản phẩm cùng category
    const sameCategoryCompares = existingCompares.filter(
      (item) => item.Product.category_id === product.category_id
    );
    // nếu đã đủ 3 sản phẩm thì không cho thêm
    if (sameCategoryCompares.length >= 3) {
      return res.status(400).json({
        message: "You can only compare up to 3 products in the same category"
      });
    }
    // kiểm tra có bị trùng không
    const isAlreadyAdded = sameCategoryCompares.find(
      (item) => item.product_id === productId
    );
    if (isAlreadyAdded) {
      return res.status(400).json({ message: "Product already in compare list" });
    }
    // thêm vào bảng compare
    const compareItem = await ProductCompare.create({
      user_id: userId,
      product_id: productId,
      category_id: product.category_id
    });

    res.json({ message: "Added to compare list", compareItem });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCompareList = async (req, res) => {
  try {
    const userId = req.user.id;

    // lấy toàn bộ danh sách compare
    const compareItems = await ProductCompare.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          include: [
            { model: Category }, // để lấy category_name

            // lấy thuộc tính
            {
              model: ProductAttributeValue,
              include: [ProductAttribute],
            },

            // ⭐ LẤY ẢNH — giống getProductById
            {
              model: ProductImage,
              as: "images",
              attributes: ["id", "image_url", "is_main", "created_at"],
              required: false,
            },
          ],
        },
      ],
    });

    if (compareItems.length === 0) {
      return res.json({ message: "Compare list is empty" });
    }

    // Xử lý ảnh giống getProductById
    const processed = compareItems.map(item => {
      const product = item.Product.toJSON();

      const imgs = product.images || [];
      product.images = imgs.map(img => img.image_url);
      product.mainImage = imgs.find(img => img.is_main)?.image_url || null;

      return { ...item.toJSON(), Product: product };
    });

    // nhóm theo category_name
    const grouped = {};
    processed.forEach((item) => {
      const categoryName = item.Product.Category.name;
      if (!grouped[categoryName]) grouped[categoryName] = [];
      grouped[categoryName].push(item.Product);
    });

    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Xóa sản phẩm khỏi danh sách so sánh
exports.removeFromCompare = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    await ProductCompare.destroy({
      where: { user_id: userId, product_id: productId }
    });

    res.json({ message: "Removed from compare list" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Thêm vào file chatbotController.js

// ======================
// API SO SÁNH SẢN PHẨM VỚI AI
// ======================
exports.compareWithAI = async (req, res) => {
  try {
    // Kiểm tra API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY chưa được cấu hình trong .env" 
      });
    }

    const userId = req.user.id;
    
    // Không cần body gì cả, chỉ lấy từ compare list

    // Lấy tất cả sản phẩm trong compare list của user
    const compareItems = await ProductCompare.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          include: [
            { model: Category },
            {
              model: ProductAttributeValue,
              include: [ProductAttribute],
            },
            {
              model: ProductImage,
              as: "images",
              attributes: ["image_url", "is_main"],
              required: false,
            },
          ],
        },
      ],
    });

    if (compareItems.length === 0) {
      return res.status(400).json({ 
        error: "Danh sách so sánh trống. Vui lòng thêm sản phẩm trước." 
      });
    }

    if (compareItems.length < 2) {
      return res.status(400).json({ 
        error: "Cần ít nhất 2 sản phẩm để so sánh",
        currentCount: compareItems.length
      });
    }

    // Lấy products
    const productsToCompare = compareItems.map(item => item.Product);

    // Kiểm tra không quá 5 sản phẩm
    if (productsToCompare.length > 5) {
      return res.status(400).json({ 
        error: "Chỉ có thể so sánh tối đa 5 sản phẩm cùng lúc. Vui lòng xóa bớt sản phẩm.",
        currentCount: productsToCompare.length
      });
    }

    // Kiểm tra sản phẩm cùng loại
    const categories = [...new Set(productsToCompare.map(p => p.Category.name))];
    const isSameCategory = categories.length === 1;

    // ======================
    // CHUẨN BỊ DỮ LIỆU CHO AI
    // ======================
    const productsData = productsToCompare.map((p, index) => {
      const attributes = p.ProductAttributeValues?.map(av => ({
        name: av.ProductAttribute?.name,
        value: av.value_text || av.value_number || av.value_boolean || 'N/A'
      })) || [];

      // Nhóm attributes theo loại
      const groupedAttrs = {
        performance: [],
        specs: [],
        features: []
      };

      attributes.forEach(attr => {
        const name = attr.name?.toLowerCase() || '';
        if (name.includes('mhz') || name.includes('ghz') || name.includes('core') || 
            name.includes('thread') || name.includes('boost') || name.includes('tdp')) {
          groupedAttrs.performance.push(attr);
        } else if (name.includes('socket') || name.includes('chipset') || 
                   name.includes('size') || name.includes('memory')) {
          groupedAttrs.specs.push(attr);
        } else {
          groupedAttrs.features.push(attr);
        }
      });

      // Lấy ảnh
      const imgs = p.images || [];
      const mainImage = imgs.find(img => img.is_main)?.image_url || imgs[0]?.image_url || null;

      return {
        index: index + 1,
        id: p.id,
        name: p.name,
        price: p.price,
        priceFormatted: p.price.toLocaleString('vi-VN') + 'đ',
        stock: p.stock,
        available: p.stock > 0,
        category: p.Category?.name || 'Không xác định',
        description: p.description?.substring(0, 200) || 'Không có mô tả',
        mainImage,
        attributes: groupedAttrs,
        allAttributes: attributes
      };
    });

    // Tính toán thống kê
    const prices = productsData.map(p => p.price);
    const priceStats = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      range: Math.max(...prices) - Math.min(...prices)
    };

    // ======================
    // XÂY DỰNG PROMPT - TỰ ĐỘNG PHÁT HIỆN LOẠI SO SÁNH
    // ======================
    
    // Tự động xác định loại so sánh dựa trên category
    let compareType = 'general';
    const categoryName = categories[0]?.toLowerCase() || '';
    
    if (categoryName.includes('cpu') || categoryName.includes('gpu') || categoryName.includes('vga')) {
      compareType = 'performance';
    } else if (categoryName.includes('case') || categoryName.includes('monitor')) {
      compareType = 'features';
    }

    const compareTypes = {
      general: {
        title: "So sánh tổng quan",
        focus: "Đánh giá toàn diện về hiệu năng, giá trị, tính năng và phù hợp với từng nhu cầu sử dụng"
      },
      performance: {
        title: "So sánh hiệu năng",
        focus: "Phân tích chi tiết về sức mạnh xử lý, benchmark, hiệu suất thực tế, khả năng chơi game và làm việc"
      },
      features: {
        title: "So sánh tính năng",
        focus: "So sánh các tính năng kỹ thuật, thiết kế, chất lượng, khả năng tương thích"
      }
    };

    const selectedCompareType = compareTypes[compareType];

    // ======================
    // TẠO PROMPT CHO GEMINI
    // ======================
    const productsText = productsData.map(p => 
      `[SẢN PHẨM ${p.index}] ${p.name}
💰 Giá: ${p.priceFormatted} ${p.price === priceStats.min ? '🏆 RẺ NHẤT' : p.price === priceStats.max ? '💎 ĐẮT NHẤT' : ''}
📦 Tình trạng: ${p.available ? '✅ Còn hàng (' + p.stock + ' cái)' : '❌ Hết hàng'}
🏷️ Danh mục: ${p.category}

⚡ HIỆU NĂNG:
${p.attributes.performance.map(a => `  • ${a.name}: ${a.value}`).join('\n') || '  Chưa có thông số'}

📊 THÔNG SỐ KỸ THUẬT:
${p.attributes.specs.map(a => `  • ${a.name}: ${a.value}`).join('\n') || '  Chưa có thông số'}

🎯 TÍNH NĂNG:
${p.attributes.features.map(a => `  • ${a.name}: ${a.value}`).join('\n') || '  Chưa có thông số'}

📝 Mô tả: ${p.description}
`).join('\n' + '='.repeat(80) + '\n');

    const prompt = `Bạn là Chuyên gia Đánh giá Phần cứng và So sánh Linh kiện PC hàng đầu tại Sale PC.

NHIỆM VỤ: ${selectedCompareType.title}
TRỌNG TÂM: ${selectedCompareType.focus}

THÔNG TIN SẢN PHẨM TẠI CỬA HÀNG:
${productsText}

THỐNG KÊ GIÁ CẢ:
• Giá thấp nhất: ${priceStats.min.toLocaleString('vi-VN')}đ
• Giá cao nhất: ${priceStats.max.toLocaleString('vi-VN')}đ
• Giá trung bình: ${priceStats.avg.toLocaleString('vi-VN')}đ
• Chênh lệch giá: ${priceStats.range.toLocaleString('vi-VN')}đ

${!isSameCategory ? '⚠️ LƯU Ý: Các sản phẩm thuộc danh mục khác nhau (' + categories.join(', ') + ')' : ''}

YÊU CẦU BÀI PHÂN TÍCH SO SÁNH (Markdown chuyên nghiệp, số liệu rõ ràng):

### 📊 1. BẢNG SO SÁNH TỔNG QUAN
(Tạo Markdown Table gồm: Tên sản phẩm, Giá bán tại shop, Thông số mấu chốt, Điểm hiệu năng ước tính / Đánh giá sao ⭐, Phân khúc).

### ⚡ 2. PHÂN TÍCH HIỆU NĂNG THỰC TẾ
(Kết hợp thông số tại shop với kiến thức benchmark thực tế của bạn):
- **Trải nghiệm Gaming (FPS):** So sánh chênh lệch FPS ở độ phân giải 1080p/2K ở các tựa game phổ biến (Esports & AAA). Sản phẩm nào vượt trội hơn bao nhiêu %?
- **Khả năng làm việc & Đồ họa:** Render video, Photoshop, AutoCAD, đa nhiệm.
- **Nhiệt độ & Tiêu thụ điện năng:** Mức độ tỏa nhiệt, công suất nguồn yêu cầu.

### 🔍 3. ĐIỂM MẠNH & ĐIỂM YẾU CỦA TỪNG SẢN PHẨM
(Phân tích chi tiết từng sản phẩm: Điều gì làm nó đáng tiền? Hạn chế hoặc điểm cần lưu ý là gì?).

### 💰 4. ĐÁNH GIÁ GIÁ TRỊ TRÊN GIÁ THÀNH (P/P - PRICE TO PERFORMANCE)
(So sánh độ chênh lệch giá tiền với mức chênh lệch hiệu năng mang lại. Có xứng đáng để chi thêm tiền không?).

### 🎯 5. KHUYẾN NGHỊ MUA SẮM DỨT KHOÁT
- 🏆 **Lựa chọn hiệu năng đỉnh nhất:** [Tên sản phẩm] - Lý do.
- 💎 **Lựa chọn P/P đáng mua nhất:** [Tên sản phẩm] - Lý do.
- 💡 **Khuyên dùng cụ thể:** Người dùng nào (game thủ, văn phòng, sinh viên đồ họa) nên chọn sản phẩm nào?

Trình bày bằng tiếng Việt chuyên nghiệp, ngôn từ sắc sảo, khách quan và giàu giá trị thông tin!`;

    // ======================
    // GỌI GEMINI API
    // ======================
    const messages = [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];

    const { resp } = await generateContentWithFallback({
      contents: messages,
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: 3500,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        }
      ]
    });

    // Lấy kết quả
    let comparisonText = "Không thể tạo so sánh.";
    if (resp?.candidates?.[0]?.content?.parts?.[0]?.text) {
      comparisonText = resp.candidates[0].content.parts[0].text;
    } else if (typeof resp?.response?.text === 'function') {
      comparisonText = resp.response.text();
    } else if (resp?.response?.text) {
      comparisonText = resp.response.text;
    }

    // ======================
    // TRẢ VỀ KẾT QUẢ
    // ======================
    return res.json({
      success: true,
      comparison: comparisonText,
      compareType: selectedCompareType.title,
      products: productsData.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        priceFormatted: p.priceFormatted,
        stock: p.stock,
        available: p.available,
        category: p.category,
        mainImage: p.mainImage,
        isPriceCheapest: p.price === priceStats.min,
        isPriceMostExpensive: p.price === priceStats.max
      })),
      statistics: {
        totalProducts: productsData.length,
        sameCategory: isSameCategory,
        categories,
        priceRange: priceStats,
        availableProducts: productsData.filter(p => p.available).length
      },
      suggestions: {
        bestValue: productsData.find(p => p.price === priceStats.min)?.name,
        premium: productsData.find(p => p.price === priceStats.max)?.name,
        mostStock: productsData.reduce((max, p) => p.stock > max.stock ? p : max).name
      }
    });

  } catch (err) {
    console.error("Compare with AI error:", err.message || err);
    
    return res.status(500).json({
      success: false,
      error: "Không thể so sánh sản phẩm",
      message: err.message?.substring(0, 200),
      fallback: "Vui lòng thử lại hoặc liên hệ hotline để được hỗ trợ trực tiếp."
    });
  }
};
