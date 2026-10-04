const crypto = require("crypto");
const qs = require("qs");
const { Payment, Order, OrderDetail, Cart, Product, sequelize } = require("../models");

// =========================================================
// Hàm sắp xếp object chuẩn theo VNPay (Sử dụng cho cả 2 hàm)
// =========================================================
function sortObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        obj = {};
    }

    let sorted = {};
    let keys = Object.keys(obj); 
    keys.sort();

    keys.forEach((key) => {
        // Mã hóa giá trị, sau đó thay %20 bằng + (Chuẩn VNPay)
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
    });
    
    return sorted;
}


// Hàm định dạng thời gian theo chuẩn VNPay (yyyyMMddHHmmss) múi giờ GMT+7 (Việt Nam)
function formatVnpDate(date) {
    const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return vnTime.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
}


// =========================================================
// 1. Tạo URL Thanh Toán (createPaymentUrl)
// =========================================================
exports.createPaymentUrl = (req, res) => {
    let { amount, orderId } = req.body;

    amount = Math.round(Number(amount));
    if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
    }

    const vnpUrl = (process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html").trim();
    const returnUrl = (process.env.VNP_RETURN_URL || "http://localhost:5000/api/payment/vnpay_return").trim();
    const tmnCode = (process.env.VNP_TMN_CODE || "").trim();
    const secretKey = (process.env.VNP_HASH_SECRET || "").trim();

    if (!tmnCode || !secretKey) {
        return res.status(500).json({ message: "Thiếu cấu hình VNP_TMN_CODE hoặc VNP_HASH_SECRET trong .env" });
    }

    // Chuẩn hóa địa chỉ IP về IPv4 (tránh lỗi ::1 trên localhost)
    let ipAddr =
        req.headers["x-forwarded-for"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        "127.0.0.1";
    if (typeof ipAddr === "string" && ipAddr.includes(",")) {
        ipAddr = ipAddr.split(",")[0].trim();
    }
    if (ipAddr === "::1" || (typeof ipAddr === "string" && ipAddr.includes("::ffff:"))) {
        ipAddr = "127.0.0.1";
    }

    const now = new Date();
    const expireDate = new Date(now.getTime() + 15 * 60 * 1000); // Hết hạn sau 15 phút
    const createDateStr = formatVnpDate(now);
    const expireDateStr = formatVnpDate(expireDate);

    // Gắn orderId vào đầu vnp_TxnRef để lấy lại chính xác khi callback
    const vnp_TxnRef = `${orderId}_${Date.now()}`;

    let vnp_Params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Locale: "vn",
        vnp_CurrCode: "VND",
        vnp_TxnRef: vnp_TxnRef,
        vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
        vnp_OrderType: "other",
        vnp_Amount: amount * 100,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDateStr,
        vnp_ExpireDate: expireDateStr,
    };

    vnp_Params = sortObject(vnp_Params);

    const signData = qs.stringify(vnp_Params, { encode: false });

    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    vnp_Params["vnp_SecureHash"] = signed;

    const finalUrl = vnpUrl + "?" + qs.stringify(vnp_Params, { encode: false });

    res.json({ paymentUrl: finalUrl });
};


// =========================================================
// 2. Xử Lý Return URL từ VNPay (vnpayReturn)
// =========================================================
exports.vnpayReturn = async (req, res) => {
    try {
        let vnp_Params = { ...req.query };

        const secureHash = vnp_Params["vnp_SecureHash"];
        delete vnp_Params["vnp_SecureHash"];
        delete vnp_Params["vnp_SecureHashType"];
        
        // --- 1. Sắp xếp và Tạo signData ---
        vnp_Params = sortObject(vnp_Params); 

        const signData = qs.stringify(vnp_Params, { encode: false }); 

        const secretKey = (process.env.VNP_HASH_SECRET || "").trim();
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 

        // --- 2. Kiểm tra Checksum ---
        if (secureHash !== signed) {
            return res.status(200).json({ RspCode: '97', Message: "Checksum failed" });
        }
        
        // --- 3. Xử lý logic nghiệp vụ ---
        const transactionStatus = vnp_Params["vnp_TransactionStatus"];
        const responseCode = vnp_Params["vnp_ResponseCode"];

        // Lấy orderId từ vnp_TxnRef (dạng "orderId_timestamp") hoặc từ vnp_OrderInfo
        let orderId = NaN;
        const txnRef = decodeURIComponent(vnp_Params["vnp_TxnRef"] || "");
        if (txnRef.includes("_")) {
            orderId = parseInt(txnRef.split("_")[0], 10);
        }

        if (isNaN(orderId)) {
            const orderInfoEncoded = vnp_Params["vnp_OrderInfo"] || "";
            const orderInfoDecoded = decodeURIComponent(orderInfoEncoded.replace(/\+/g, " "));
            const match = orderInfoDecoded.match(/(\d+)\s*$/);
            if (match) {
                orderId = parseInt(match[1], 10);
            }
        }

        const amount = Number(vnp_Params["vnp_Amount"]) / 100;

        if (isNaN(orderId)) {
            console.error("Lỗi Fatal: Không lấy được orderId hợp lệ từ VNPay Return:", vnp_Params);
            return res.status(200).json({ RspCode: '99', Message: "Invalid Order ID format." });
        }

        const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").trim();

        if (transactionStatus === "00" && responseCode === "00") {
             await Payment.create({ 
                 order_id: orderId, 
                 amount: amount,
                 method: "VNPAY",
                 status: "Success",
             });
             await Order.update(
                 { status: "Confirmed" },
                 { where: { id: orderId } }
             );

             // Xóa giỏ hàng sau khi thanh toán thành công
             const order = await Order.findByPk(orderId);
             if (order) {
                 await Cart.destroy({ where: { user_id: order.user_id } });
             }

             return res.redirect(`${frontendUrl}/payment-success?orderId=${orderId}`); 
        } else {
            await Payment.create({
                order_id: orderId,
                amount: amount,
                method: "VNPAY",
                status: "Failed",
            });
            await Order.update(
                { status: "Cancelled" },
                { where: { id: orderId } }
            );

            // 1. Hoàn lại số lượng tồn kho (stock) cho các sản phẩm
            const orderDetails = await OrderDetail.findAll({ where: { order_id: orderId } });
            for (const detail of orderDetails) {
                await Product.update(
                    { stock: sequelize.literal(`stock + ${detail.quantity}`) },
                    { where: { id: detail.product_id } }
                );
            }

            // 2. Bảo toàn và khôi phục giỏ hàng cho user (nếu giỏ hàng đã bị mất)
            const order = await Order.findByPk(orderId);
            if (order) {
                for (const detail of orderDetails) {
                    const existingItem = await Cart.findOne({
                        where: { user_id: order.user_id, product_id: detail.product_id }
                    });
                    if (!existingItem) {
                        await Cart.create({
                            user_id: order.user_id,
                            product_id: detail.product_id,
                            quantity: detail.quantity
                        });
                    }
                }
            }

            return res.redirect(`${frontendUrl}/payment-failed?orderId=${orderId}`);
        }

    } catch (err) {
        console.error("VNPAY RETURN ERROR:", err);
        return res.status(200).json({ RspCode: '99', Message: "Internal server error" });
    }
};

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [
        {
          model: Order,
          attributes: ["id", "user_id", "total_amount", "status"]
        }
      ],
      order: [["id", "DESC"]]
    });

    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    console.error("getAllPayments error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy chi tiết thanh toán
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [{ model: Order }]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thanh toán" });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error("getPaymentById error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Tìm theo Order ID
exports.getPaymentsByOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const payments = await Payment.findAll({
      where: { order_id },
      include: [{ model: Order }]
    });

    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    console.error("getPaymentsByOrder error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.getMyPayments = async (req, res) => {
  try {
    const user_id = req.user.id; // Lấy từ middleware auth

    const payments = await Payment.findAll({
      include: [
        {
          model: Order,
          where: { user_id },
          attributes: ["id", "total_amount", "status"]
        }
      ],
      order: [["id", "DESC"]]
    });

    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    console.error("getMyPayments error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Client: lấy chi tiết thanh toán của chính mình
exports.getMyPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const payment = await Payment.findOne({
      where: { id },
      include: [
        {
          model: Order,
          where: { user_id }
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thanh toán" });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error("getMyPaymentById error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};