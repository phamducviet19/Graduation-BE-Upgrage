const { User } = require('../models');
const bcrypt = require('bcrypt');

// Lấy thông tin cá nhân (profile)
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // req.user được gán từ authMiddleware (giải mã JWT)
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'role', 'phone', 'address', 'created_at']
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
        message: 'User profile fetched successfully',
        user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Cập nhật thông tin user
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, password, phone, address } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }
    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getProfile, updateProfile };
