const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, trim: true, lowercase: true },
  telegramId: { type: Number },
}, { timestamps: true });

UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ telegramId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', UserSchema);
