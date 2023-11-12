const mongoose = require('mongoose');

const peminjamanHistorySchema = new mongoose.Schema(
  {
    id_peminjaman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Peminjaman',
      required: true,
    },
    id_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['rejected', 'approved'],
    },
  },
  { timestamps: true, versionKey: false }
);

const PeminjamanHistory = mongoose.model('PeminjamanHistory', peminjamanHistorySchema);

module.exports = PeminjamanHistory;