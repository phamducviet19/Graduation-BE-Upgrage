const { PcBuild, PcBuildDetail, Product, User, ProductImage, ProductAttributeValue, ProductAttribute, Category} = require("../models");
const { Op } = require("sequelize");
const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenAI } = require("@google/genai");

// Khởi tạo Gemini AI
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

// Helper chuẩn hóa danh sách ID sản phẩm (hỗ trợ mảng số, mảng chuỗi số, hoặc mảng object { product_id, ... } / { id, ... })
const normalizeProductIds = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item && typeof item === "object") {
        return parseInt(item.product_id ?? item.id, 10);
      }
      return parseInt(item, 10);
    })
    .filter((id) => !isNaN(id) && id > 0);
};

// ================== CREATE BUILD ==================
exports.createPcBuild = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { name, product_ids, items } = req.body;
    const rawProducts = product_ids || items;

    if (!user_id || !name || !Array.isArray(rawProducts)) {
      return res.status(400).json({ message: "Missing or invalid fields" });
    }

    const normalizedProductIds = normalizeProductIds(rawProducts);
    if (normalizedProductIds.length === 0) {
      return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 linh kiện hợp lệ" });
    }

    // 🔹 1️⃣ Lấy thông tin category của từng sản phẩm
    const products = await Product.findAll({
      where: { id: normalizedProductIds },
      attributes: ["id", "category_id"],
    });

    if (products.length === 0) {
      return res.status(400).json({ message: "Không tìm thấy linh kiện nào trong hệ thống" });
    }

    // 🔹 2️⃣ Lấy danh sách category_id tương ứng với từng sản phẩm
    const productCategoryMap = new Map(products.map((p) => [p.id, p.category_id]));
    const categoryIds = normalizedProductIds.map((pid) => productCategoryMap.get(pid)).filter(Boolean);

    // 🔹 3️⃣ Kiểm tra trùng category
    const duplicates = categoryIds.filter(
      (id, index) => categoryIds.indexOf(id) !== index
    );
    if (duplicates.length > 0) {
      return res.status(400).json({
        message: "You cannot add more than one product from the same category",
      });
    }

    // 🔹 4️⃣ Tạo build mới
    const build = await PcBuild.create({ user_id, name });

    // 🔹 5️⃣ Thêm chi tiết sản phẩm
    const details = normalizedProductIds.map((pid) => ({
      build_id: build.id,
      product_id: pid,
    }));
    await PcBuildDetail.bulkCreate(details);

    res.status(201).json({
      message: "PC Build created successfully",
      build_id: build.id,
    });
  } catch (error) {
    console.error("Error creating PC build:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================== GET ALL BUILDS ==================
exports.getAllPcBuilds = async (req, res) => {
  try {
    const user_id = req.user.id;

    const builds = await PcBuild.findAll({
      where: { user_id },
      include: [
        {
          model: PcBuildDetail,
          include: [
            {
              model: Product,
              include: [
                {
                  model: ProductImage,
                  as: "images",
                  attributes: ["id", "image_url", "is_main", "created_at"],
                  required: false,
                }
              ]
            }
          ],
        },
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Chuẩn hóa ảnh giống các API khác
    const formattedBuilds = builds.map((build) => {
      const b = build.toJSON();

      // xử lý từng PcBuildDetail → Product
      b.PcBuildDetails = b.PcBuildDetails.map((detail) => {
        if (detail.Product) {
          const prod = detail.Product;
          const imgs = prod.images || [];

          prod.images = imgs.map((img) => img.image_url);
          prod.mainImage = imgs.find((img) => img.is_main)?.image_url || null;
        }
        return detail;
      });

      return b;
    });

    res.json(formattedBuilds);
  } catch (error) {
    console.error("Error fetching PC builds:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================== GET SINGLE BUILD (thuộc user hiện tại) ==================
exports.getPcBuildById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const build = await PcBuild.findOne({
      where: {
        id,
        user_id,
      },
      include: [
        {
          model: PcBuildDetail,
          include: [
            {
              model: Product,
              include: [
                {
                  model: ProductImage,
                  as: "images",
                  attributes: ["id", "image_url", "is_main", "created_at"],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!build) {
      return res.status(404).json({ message: "Build not found or not authorized" });
    }

    // ===== Chuẩn hóa ảnh giống getAllPcBuilds =====
    const b = build.toJSON();

    b.PcBuildDetails = b.PcBuildDetails.map((detail) => {
      if (detail.Product) {
        const prod = detail.Product;
        const imgs = prod.images || [];

        prod.images = imgs.map((img) => img.image_url);
        prod.mainImage = imgs.find((img) => img.is_main)?.image_url || null;
      }
      return detail;
    });

    res.json(b);
  } catch (error) {
    console.error("Error fetching PC build:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================== UPDATE BUILD ==================
exports.updatePcBuild = async (req, res) => {
  try {
    const { id } = req.params; // id của build
    const { name, product_ids, items } = req.body;

    // Kiểm tra tồn tại
    const build = await PcBuild.findByPk(id);
    if (!build) {
      return res.status(404).json({ message: "Build not found" });
    }

    // Cập nhật tên (nếu có)
    if (name) build.name = name;
    await build.save();

    // Nếu có cập nhật danh sách sản phẩm
    const rawProducts = product_ids || items;
    if (Array.isArray(rawProducts)) {
      const normalizedProductIds = normalizeProductIds(rawProducts);

      // Xóa chi tiết cũ
      await PcBuildDetail.destroy({ where: { build_id: id } });

      // Thêm chi tiết mới
      if (normalizedProductIds.length > 0) {
        const details = normalizedProductIds.map((pid) => ({
          build_id: id,
          product_id: pid,
        }));
        await PcBuildDetail.bulkCreate(details);
      }
    }

    res.json({ message: "PC Build updated successfully" });
  } catch (error) {
    console.error("Error updating PC build:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================== DELETE BUILD ==================
exports.deletePcBuild = async (req, res) => {
  try {
    const { id } = req.params;

    const build = await PcBuild.findByPk(id);
    if (!build) {
      return res.status(404).json({ message: "Build not found" });
    }

    await build.destroy();
    res.json({ message: "Build deleted successfully" });
  } catch (error) {
    console.error("Error deleting PC build:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



// Build With AI
exports.buildPCWithAI = async (req, res) => {
  try {
    // Kiểm tra API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY chưa được cấu hình trong .env" 
      });
    }

    // Kiểm tra req.body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: "Request body is empty",
        message: "Vui lòng gửi yêu cầu của bạn trong trường 'request'"
      });
    }

    const userId = req.user.id;
    const { 
      request,          // Text mô tả nhu cầu của user
      minStock = 1,     // Chỉ lấy sản phẩm còn hàng
      autoSave = false  // Tự động lưu build
    } = req.body;

    // Validate
    if (!request || request.trim().length < 5) {
      return res.status(400).json({ 
        error: "Vui lòng mô tả nhu cầu của bạn chi tiết hơn",
        example: "Tôi muốn build PC gaming 20 triệu chơi mượt Valorant, CS2 và edit video nhẹ"
      });
    }

    // ==========================================
    // BƯỚC 1: LẤY VÀ ÁNH XẠ DANH MỤC THÔNG MINH
    // ==========================================
    const allCategoriesInDb = await Category.findAll();
    console.log('📁 Danh mục hiện có trong DB:', allCategoriesInDb.map(c => `"${c.name}"`).join(', '));

    // Định nghĩa chuẩn hóa các danh mục cho PC Build
    const COMPONENT_DEFINITIONS = [
      { key: 'CPU', label: 'CPU', match: ['cpu', 'processor', 'vi xử lý', 'chip'] },
      { key: 'MAINBOARD', label: 'MAINBOARD', match: ['mainboard', 'main', 'bo mạch', 'motherboard', 'mobo'] },
      { key: 'RAM', label: 'RAM', match: ['ram', 'memory', 'bộ nhớ'] },
      { key: 'GPU', label: 'GPU', match: ['gpu', 'vga', 'card màn hình', 'card đồ họa'] },
      { key: 'SSD', label: 'SSD', match: ['ssd', 'storage', 'm.2', 'nvme', 'ổ cứng ssd'] },
      { key: 'CASE', label: 'CASE', match: ['case', 'vỏ máy', 'thùng máy', 'vỏ case'] },
      { key: 'CPU COOLER', label: 'CPU COOLER', match: ['heatsink', 'cpu cooler', 'cooler', 'tản nhiệt', 'fan'] },
      { key: 'PSU', label: 'PSU', match: ['psu', 'nguồn', 'power supply', 'nguồn máy'] }
    ];

    const categoryMap = {}; // key chuẩn -> Category instance
    for (const def of COMPONENT_DEFINITIONS) {
      const matchedCat = allCategoriesInDb.find(c => {
        const cName = c.name.toLowerCase().trim();
        return def.match.some(m => cName === m || cName.includes(m));
      });
      if (matchedCat) {
        categoryMap[def.key] = matchedCat;
      }
    }

    console.log('✅ Đã ánh xạ các danh mục khả dụng:', Object.keys(categoryMap).join(', '));

    // Lấy sản phẩm khả dụng cho từng danh mục
    const productsData = {};
    for (const [key, categoryObj] of Object.entries(categoryMap)) {
      // Ưu tiên sản phẩm còn hàng
      let products = await Product.findAll({
        where: {
          category_id: categoryObj.id,
          stock: { [Op.gte]: minStock }
        },
        include: [
          {
            model: ProductAttributeValue,
            include: [ProductAttribute]
          },
          {
            model: ProductImage,
            as: "images",
            attributes: ["image_url", "is_main"],
            required: false
          }
        ],
        order: [['price', 'ASC']]
      });

      // Nếu không còn hàng, nới lỏng điều kiện lấy để vẫn có gợi ý
      if (products.length === 0) {
        products = await Product.findAll({
          where: { category_id: categoryObj.id },
          include: [
            {
              model: ProductAttributeValue,
              include: [ProductAttribute]
            },
            {
              model: ProductImage,
              as: "images",
              attributes: ["image_url", "is_main"],
              required: false
            }
          ],
          order: [['price', 'ASC']]
        });
      }

      if (products.length > 0) {
        productsData[key] = products.map(p => {
          const attrs = {};
          p.ProductAttributeValues?.forEach(av => {
            const attrName = av.ProductAttribute?.name;
            if (attrName) {
              attrs[attrName] = av.value_text || av.value_number || av.value_boolean || '';
            }
          });

          const imgs = p.images || [];
          const mainImage = imgs.find(img => img.is_main)?.image_url || imgs[0]?.image_url || null;

          return {
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            stock: p.stock,
            description: p.description?.substring(0, 150) || '',
            attributes: attrs,
            mainImage
          };
        });
      }
    }

    // Các linh kiện tối thiểu bắt buộc phải có để build
    const essentialKeys = ['CPU', 'MAINBOARD', 'RAM'];
    const missingEssentials = essentialKeys.filter(k => !productsData[k] || productsData[k].length === 0);
    if (missingEssentials.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Cửa hàng đang thiếu các linh kiện nòng cốt",
        message: `Hiện tại kho thiếu sản phẩm ở các danh mục: ${missingEssentials.join(', ')}`,
        missingCategories: missingEssentials
      });
    }

    // ==========================================
    // BƯỚC 2: TẠO PROMPT CHUYÊN NGHIỆP CHO AI
    // ==========================================
    const availableCategories = Object.keys(productsData);
    const totalProductsCount = Object.values(productsData).reduce((sum, arr) => sum + arr.length, 0);

    const productsText = Object.entries(productsData).map(([category, products]) => {
      const productList = products.map((p, idx) => {
        const specSummary = Object.entries(p.attributes)
          .filter(([_, v]) => Boolean(v))
          .map(([k, v]) => `${k}: ${v}`)
          .slice(0, 4)
          .join(', ');
        const specs = specSummary ? ` | ${specSummary}` : '';
        return `  ${idx + 1}. [ID:${p.id}] ${p.name} | Giá: ${p.price.toLocaleString('vi-VN')}đ${specs} | Kho: ${p.stock}`;
      }).join('\n');
      
      return `[DANH MỤC: ${category}] (${products.length} sản phẩm):\n${productList}`;
    }).join('\n\n');

    const psuNote = !productsData['PSU'] 
      ? `\n⚠️ LƯU Ý KHO HÀNG: Cửa hàng hiện chưa có sẵn linh kiện PSU (Nguồn) trong kho. Bạn hãy chọn đủ các linh kiện có sẵn ở các danh mục khác. Trong phần giải thích, hãy tính tổng công suất tiêu thụ (TDP) và khuyến nghị loại nguồn thích hợp (Wattage, chuẩn 80 Plus) để khách hàng mua bổ sung.`
      : '';

    const prompt = `Bạn là Chuyên gia kỹ thuật và Tư vấn phần cứng PC hàng đầu của Sale PC với hơn 10 năm kinh nghiệm.

YÊU CẦU CỦA KHÁCH HÀNG:
"${request}"

DANH SÁCH SẢN PHẨM KHẢ DỤNG TẠI CỬA HÀNG (${totalProductsCount} sản phẩm thuộc ${availableCategories.length} danh mục):
${productsText}
${psuNote}

QUY TẮC PHẦN CỨNG & TƯƠNG THÍCH BẮT BUỘC:
1. ⚙️ Tương thích Socket:
   - Intel Core Gen 12, 13, 14 (i3/i5/i7) socket LGA1700 BẮT BUỘC đi với Mainboard socket LGA1700 (B660, B760, Z690, Z790).
   - AMD Ryzen 5000 series (5600X, 5800X) socket AM4 BẮT BUỘC đi với Mainboard socket AM4 (B550, X570, A520).
   - TUYỆT ĐỐI KHÔNG ghép CPU Intel với Mainboard AMD hoặc ngược lại.
2. ⚡ Tương thích RAM: Mainboard hỗ trợ DDR4 phải ghép với RAM DDR4, Mainboard DDR5 đi với RAM DDR5.
3. 🎯 Tối ưu cấu hình & ngân sách:
   - Phân bổ ngân sách thông minh (Gaming ưu tiên GPU ~35-45%, CPU ~20-25%; Đồ họa/Lập trình ưu tiên CPU & RAM).
   - Nếu khách có nêu ngân sách, tổng giá tiền phải bám sát (trong khoảng ±10% ngân sách khách đưa ra).
4. 🆔 Chọn đúng ID: Chỉ chọn productId có thực trong danh sách trên, mỗi danh mục chọn tối đa 1 sản phẩm tốt nhất.

ĐỊNH DẠNG PHẢN HỒI (BẮT BUỘC 2 PHẦN):

PHẦN 1: JSON CẤU HÌNH (Đặt ngay đầu phản hồi trong block \`\`\`json):
\`\`\`json
{
  "analysis": {
    "budget": 20000000,
    "purpose": "Gaming Esports & Làm việc văn phòng",
    "mainUse": "Chơi mượt Valorant, CS2, LOL và làm việc đa nhiệm",
    "specialRequirements": ["Mát mẻ", "Dễ nâng cấp sau này"]
  },
  "products": [
    {"category": "CPU", "productId": 1, "reason": "Lý do lựa chọn ngắn gọn"},
    {"category": "MAINBOARD", "productId": 5, "reason": "Lý do lựa chọn ngắn gọn"},
    {"category": "RAM", "productId": 10, "reason": "Lý do lựa chọn ngắn gọn"},
    {"category": "GPU", "productId": 16, "reason": "Lý do lựa chọn ngắn gọn"},
    {"category": "SSD", "productId": 25, "reason": "Lý do lựa chọn ngắn gọn"},
    {"category": "CASE", "productId": 20, "reason": "Lý do lựa chọn ngắn gọn"},
    {"category": "CPU COOLER", "productId": 40, "reason": "Lý do lựa chọn ngắn gọn"}
  ],
  "totalPrice": 19500000,
  "budgetStatus": "Tối ưu trong ngân sách"
}
\`\`\`

PHẦN 2: BÀI TƯ VẤN & GIẢI THÍCH CHUYÊN SÂU (Bằng Markdown đẹp mắt, chuẩn văn phong chuyên gia):

### 🎯 1. Phân Tích Nhu Cầu & Bài Toán Ngân Sách
(Tóm tắt nhu cầu của khách, định hướng cấu hình tối ưu nhất cho tầm tiền).

### 💻 2. Chi Tiết Cấu Hình & Lý Do Lựa Chọn
(Điểm qua từng linh kiện đã chọn: Tên sản phẩm, giá bán, lý do chọn, điểm mạnh công nghệ và độ tương thích hoàn hảo).

### 🎮 3. Đánh Giá Hiệu Năng Thực Tế
- **Gaming Esports (Valorant, CS2, League of Legends, FC Online):** Dự đoán mức FPS ở độ phân giải Full HD (1080p).
- **Game AAA nặng (GTA V, Black Myth: Wukong, Cyberpunk 2077):** Dự đoán mức thiết lập đồ họa và FPS trải nghiệm.
- **Công việc / Đồ họa / Đa nhiệm:** Đánh giá khả năng dựng hình, render video, chỉnh sửa ảnh hoặc học tập, làm việc.

### ⚡ 4. Khả Năng Nâng Cấp Về Sau (Upgrade Path)
(Gợi ý khả năng nâng cấp thêm RAM, gắn thêm ổ cứng SSD/HDD, hoặc nâng cấp VGA sau 2-3 năm).

### 🔌 5. Khuyến Nghị Về Nguồn (PSU) & Tản Nhiệt
(Tính toán tổng điện năng tiêu thụ TDP của CPU + GPU, đưa ra mức công suất nguồn Wattage và chuẩn khuyến nghị, ví dụ: Nguồn 550W - 650W 80 Plus Bronze).

### 💡 6. Lời Khuyên & Lưu Ý Kỹ Thuật
(2-3 mẹo hữu ích khi vận hành để máy luôn mát mẻ, bền bỉ và ổn định nhất).

Trả lời bằng tiếng Việt, chuyên nghiệp, nhiệt tình và rõ ràng!`;

    // ==========================================
    // BƯỚC 3: GỌI GEMINI API VỚI RETRY/FALLBACK
    // ==========================================
    console.log('🤖 Đang gọi Gemini API tạo PC Build...');

    const { resp, modelUsed } = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 4000,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        }
      ]
    });

    let responseText = "";
    if (resp?.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = resp.candidates[0].content.parts[0].text;
    } else if (typeof resp?.response?.text === 'function') {
      responseText = resp.response.text();
    } else if (resp?.response?.text) {
      responseText = resp.response.text;
    }

    if (!responseText) {
      throw new Error("Không nhận được phản hồi từ AI");
    }

    console.log('✅ Đã nhận response từ AI, độ dài:', responseText.length);

    // ==========================================
    // BƯỚC 4: PARSE JSON VÀ BÁI TƯ VẤN
    // ==========================================
    let buildData = null;
    let explanation = responseText;

    // Tìm JSON block trong response
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        buildData = JSON.parse(jsonMatch[1].trim());
        explanation = responseText.replace(jsonMatch[0], '').trim();
        console.log('✅ Parse JSON thành công');
      } catch (e) {
        console.error("❌ Parse JSON regex error:", e.message);
      }
    }

    // Fallback: Tìm dấu { đầu tiên và } cuối cùng nếu regex code block không match
    if (!buildData) {
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const rawJson = responseText.substring(firstBrace, lastBrace + 1);
          buildData = JSON.parse(rawJson);
          explanation = responseText.substring(lastBrace + 1).trim();
          console.log('✅ Parse JSON fallback thành công');
        } catch (err) {
          console.error("❌ Fallback JSON parse error:", err.message);
        }
      }
    }

    if (!buildData || !Array.isArray(buildData.products) || buildData.products.length === 0) {
      return res.status(500).json({
        success: false,
        error: "AI không thể tạo cấu hình phù hợp",
        message: "Vui lòng thử mô tả chi tiết hơn về nhu cầu và tầm giá của bạn.",
        partialResponse: explanation.substring(0, 500)
      });
    }

    // ==========================================
    // BƯỚC 5: TẢI SẢN PHẨM TỪ DB & ĐỐI CHIẾU
    // ==========================================
    const selectedProductIds = buildData.products
      .map(p => parseInt(p.productId))
      .filter(id => !isNaN(id) && id > 0);

    const selectedProducts = await Product.findAll({
      where: { id: selectedProductIds },
      include: [
        { model: Category },
        {
          model: ProductAttributeValue,
          include: [ProductAttribute]
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["image_url", "is_main"],
          required: false
        }
      ]
    });

    console.log(`✅ Lấy được ${selectedProducts.length}/${selectedProductIds.length} sản phẩm từ DB`);

    const finalBuild = buildData.products.map(item => {
      const product = selectedProducts.find(p => p.id === parseInt(item.productId));
      if (!product) {
        console.warn(`⚠️ Bỏ qua linh kiện ID ${item.productId} không tìm thấy`);
        return null;
      }

      const imgs = product.images || [];
      const mainImage = imgs.find(img => img.is_main)?.image_url || imgs[0]?.image_url || null;

      const keyAttributes = {};
      product.ProductAttributeValues?.forEach(av => {
        const name = av.ProductAttribute?.name;
        if (name) {
          keyAttributes[name] = av.value_text || av.value_number || av.value_boolean;
        }
      });

      return {
        category: item.category,
        reason: item.reason || '',
        product: {
          id: product.id,
          name: product.name,
          price: parseFloat(product.price),
          priceFormatted: parseFloat(product.price).toLocaleString('vi-VN') + 'đ',
          stock: product.stock,
          category: product.Category?.name || item.category,
          description: product.description?.substring(0, 200) || '',
          mainImage,
          keyAttributes
        }
      };
    }).filter(Boolean);

    // Tính tổng giá thực tế từ sản phẩm trong DB
    const actualTotal = finalBuild.reduce((sum, item) => sum + item.product.price, 0);

    // Kiểm tra các danh mục khả dụng còn thiếu
    const selectedCategories = finalBuild.map(item => item.category?.toUpperCase());
    const missingCategories = availableCategories.filter(cat => {
      return !selectedCategories.some(sc => sc === cat || sc.includes(cat) || cat.includes(sc));
    });

    // ==========================================
    // BƯỚC 6: TỰ ĐỘNG LƯU BUILD NẾU autoSave = true
    // ==========================================
    let savedBuildId = null;
    if (autoSave && finalBuild.length >= 4) {
      try {
        const buildName = `AI Build - ${new Date().toLocaleDateString('vi-VN', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
        
        const newBuild = await PcBuild.create({
          user_id: userId,
          name: buildName
        });

        const buildDetails = finalBuild.map(item => ({
          build_id: newBuild.id,
          product_id: item.product.id
        }));
        await PcBuildDetail.bulkCreate(buildDetails);

        savedBuildId = newBuild.id;
        console.log(`✅ Đã tự động lưu build ID: ${savedBuildId}`);
      } catch (saveError) {
        console.error("❌ Lỗi khi lưu build:", saveError.message);
      }
    }

    // ==========================================
    // BƯỚC 7: TRẢ VỀ KẾT QUẢ ĐẦY ĐỦ
    // ==========================================
    return res.json({
      success: true,
      userRequest: request,
      analysis: buildData.analysis || {
        purpose: "Đa nhiệm & Gaming",
        budget: actualTotal
      },
      build: {
        products: finalBuild,
        totalProducts: finalBuild.length,
        totalPrice: actualTotal,
        totalPriceFormatted: actualTotal.toLocaleString('vi-VN') + 'đ',
        estimatedBudget: buildData.analysis?.budget || actualTotal,
        budgetStatus: buildData.budgetStatus || "Tối ưu theo kho hàng"
      },
      explanation: explanation,
      savedBuildId: savedBuildId,
      warnings: [
        ...(!productsData['PSU'] ? [
          '⚠️ Cửa hàng hiện chưa có sẵn linh kiện Nguồn (PSU) trong kho. Vui lòng xem phần khuyến nghị nguồn để chọn loại nguồn phù hợp.'
        ] : []),
        ...(missingCategories.length > 0 ? [
          `Linh kiện có thể bổ sung thêm: ${missingCategories.join(', ')}`
        ] : [])
      ],
      metadata: {
        timestamp: new Date().toISOString(),
        aiModel: modelUsed || "gemini-flash-lite-latest",
        autoSaved: !!savedBuildId,
        categoriesScanned: availableCategories,
        productsScanned: totalProductsCount
      }
    });

  } catch (err) {
    console.error("❌ AI Build error:", err);
    return res.status(500).json({
      success: false,
      error: "Không thể tạo cấu hình PC",
      message: err.message,
      suggestion: "Vui lòng thử lại với mô tả chi tiết hơn hoặc liên hệ nhân viên để được hỗ trợ trực tiếp."
    });
  }
};
