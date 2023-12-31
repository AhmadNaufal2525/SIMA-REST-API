const UserModel = require('../model/users.model');
const {initializeApp} = require('firebase/app');
const AsetModel = require("../model/aset.model");
const PeminjamanModel = require('../model/peminjaman.model');
const PengembalianModel = require('../model/pengembalian.model');
const config = require('../config/firebase.config');
const { getStorage, ref, getDownloadURL, uploadBytesResumable } = require("firebase/storage");
const multer = require('multer');
const PengembalianHistoryModel = require('../model/pengembalianHIstory.model');
const axios = require("axios");
const dotenv = require("dotenv");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
dotenv.config();


initializeApp(config.firebaseConfig);

const storage = getStorage();

const upload = multer({ storage: multer.memoryStorage() });

const createPengembalian = async (req, res) => {
  try {
    upload.single('foto')(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          error: {
            message: "Multer error",
            details: err.message,
          },
        });
      } else if (err) {
        return res.status(500).json({
          error: {
            message: "Error uploading file",
            details: err.message,
          },
        });
      }

      const {
        kondisi_aset,
        tanggal_pengembalian,
        lokasi,
        tagNumber,
        username,
      } = req.body;

      const aset = await AsetModel.findOne({ tag_number: tagNumber });

      if (!aset) {
        return res.status(404).json({
          error: {
            message: "Asset not found",
          },
        });
      }

      if (!aset.is_borrowed) {
        return res.status(400).json({
          error: {
            message: "Asset is not currently borrowed",
          },
        });
      }

      const user = await UserModel.findOne({ username });

      if (!user) {
        return res.status(404).json({
          error: {
            message: "User not found",
          },
        });
      }

      const existingPeminjaman = await PeminjamanModel.findOne({
        id_aset: aset._id,
        id_user: user._id,
        status: "Approved",
      });

      if (!existingPeminjaman) {
        return res.status(400).json({
          error: {
            message: "No approved borrowing found for this asset and user",
          },
        });
      }

      const photoFile = req.file;
      if (!photoFile || !photoFile.buffer) {
        return res.status(400).json({
          error: {
            message: "File data is missing or invalid",
          },
        });
      }

      const photoFileName = `Aset:${existingPeminjaman._id}`;
      const storageRef = ref(storage, photoFileName);

      const metadata = {
        contentType: 'image/png'
      };
      
      const photoSnapshot = await uploadBytesResumable(storageRef, photoFile.buffer, metadata);
      const photoURL = await getDownloadURL(photoSnapshot.ref);

      const newPengembalian = new PengembalianModel({
        lokasi,
        kondisi_aset,
        tanggal_pengembalian,
        status: "Pending",
        jenis: "Pengembalian",
        id_aset: aset._id,
        id_user: user._id,
        foto: photoURL,
      });

      const savedPengembalian = await newPengembalian.save();

      await aset.save();
      await existingPeminjaman.save();

      res.status(201).json({
        message: "Pengembalian berhasil dibuat",
        pengembalian: savedPengembalian,
      });
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: "Error creating pengembalian",
        details: error.message,
      },
    });
  }
};

const getAllPengembalian = async (req, res) => {
  try {
    const pengembalian = await PengembalianModel.find()
      .populate("id_aset")
      .populate("id_user", "username");
    res
      .status(200)
      .json({ message: "Daftar pengambalian berhasil diambil", pengembalian });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengambil daftar pengembalian: " + error.message });
  }
};

const getPengembalianByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    const pengembalian = await PengembalianModel.find({ id_user: userId }).populate(
      "id_aset"
    );

    if (pengembalian.length === 0) {
      return res.status(404).json({ error: "Tidak ada pengembalian untuk pengguna ini" });
    }

    res.status(200).json({ message: "Pengembalian berhasil diambil", pengembalian });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil pengembalian: " + error.message });
  }
};


const getPengembalianById = async (req, res) => {
  const pengembalianId = req.params.id;
  try {
    const pengembalian = await PengembalianModel.findById(pengembalianId)
      .populate("id_aset")
      .populate("id_user", "username");

    if (!pengembalian) {
      return res.status(404).json({ message: "Pengembalian not found" });
    }

    res
      .status(200)
      .json({ message: "Pengembalian berhasil diambil", pengembalian });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengambil pengembalian: " + error.message });
  }
};

const sendNotification = async (topics, title, body) => {
  const url = "https://fcm.googleapis.com/fcm/send";
  const headers = {
    "Content-Type": "application/json",
    Authorization:`key=${process.env.FCM_SERVER_KEY}`,
  };

  try {
    const response = await axios.post(
      url,
      {
        to: topics,
        notification: {
          title: title,
          body: body,
        },
      },
      { headers }
    );

    return response.data;
  } catch (error) {
    throw new Error("Error sending notification: " + error.message);
  }
};

const acceptPengembalian = async (req, res) => {
  try {
    const pengembalianId = req.params.id;
    const adminId = req.body.adminId;
    const pengembalian = await PengembalianModel.findById(pengembalianId);

    if (!pengembalian) {
      return res.status(404).json({ error: 'Pengembalian not found' });
    }

    if (pengembalian.status === 'Approved') {
      return res.status(400).json({ error: 'Peminjaman already approved' });
    }

    const aset = await AsetModel.findById(pengembalian.id_aset);
    if (!aset) {
      return res.status(404).json({ error: 'Corresponding asset not found' });
    }
    aset.is_borrowed = false;
    await aset.save();

    const historyEntry = new PengembalianHistoryModel({
      id_pengembalian: pengembalian._id,
      id_user: pengembalian.id_user,
      action: 'Approved',
      id_admin: adminId,
    });
    
    pengembalian.status = "Approved";
    await pengembalian.save();
    await historyEntry.save();

    const topics = '/topics/accept_pengembalian'
    const notificationTitle = "Notifikasi Pengembalian";
    const notificationBody = "Pengembalian anda telah disetujui oleh Admin";
    await sendNotification(
      topics,
      notificationTitle,
      notificationBody
    );

    res.status(200).json({ message: 'Pengembalian accepted', pengembalian, adminId });
  } catch (error) {
    res.status(500).json({ error: 'Error accepting pengembalian: ' + error.message });
  }
};


const rejectPengembalian = async (req, res) => {
  try {
    const pengembalianId = req.params.id;
    const adminId = req.body.adminId;
    const pengembalian = await PengembalianModel.findById(pengembalianId);

    if (!pengembalian) {
      return res.status(404).json({ error: 'Pengembalian not found' });
    }

    if (pengembalian.status === 'Approved') {
      return res.status(400).json({ error: 'Peminjaman already approved' });
    }

    const aset = await AsetModel.findById(pengembalian.id_aset);
    if (!aset) {
      return res.status(404).json({ error: 'Corresponding asset not found' });
    }

    const historyEntry = new PengembalianHistoryModel({
      id_pengembalian: pengembalian._id,
      id_user: pengembalian.id_user,
      action: 'Rejected',
      id_admin: adminId,
    });
    
    pengembalian.status = "Rejected";
    await pengembalian.save();
    await historyEntry.save();

    const topics = '/topics/reject_pengembalian'
    const notificationTitle = "Notifikasi Pengembalian";
    const notificationBody = "Pengembalian anda ditolak, silahkan ajukan kembali aset yang akan dikembalikan";
    await sendNotification(
      topics,
      notificationTitle,
      notificationBody
    );

    res.status(200).json({ message: 'Pengembalian rejected', pengembalian, adminId });
  } catch (error) {
    res.status(500).json({ error: 'Error accepting pengembalian: ' + error.message });
  }
};

const getPengembalianHistory = async (req, res) => {
  try {
    const pengembalianHistory = await PengembalianHistoryModel.find()
      .populate({
        path: 'id_pengembalian',
        populate: { path: 'id_aset' }
      })
      .populate('id_aset')
      .populate('id_user','username')
      .populate('id_admin', 'username');

    if (pengembalianHistory.length === 0) {
      return res.status(404).json({ error: 'No pengembalian history found' });
    }

    res.status(200).json({
      message: 'Pengembalian history retrieved successfully',
      pengembalianHistory,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving pengembalian history: ' + error.message });
  }
};

const getPengembalianHistoryById = async (req, res) => {
  try {
    const pengembalianHistoryId = req.params.id;
    const pengembalianHistory = await PengembalianHistoryModel.findById(pengembalianHistoryId)
      .populate({
        path: 'id_pengembalian',
        populate: { path: 'id_aset' }
      })
      .populate('id_user','username')
      .populate('id_admin', 'username');

    if (!pengembalianHistory) {
      return res.status(404).json({ error: 'Pengembalian history not found' });
    }

    res.status(200).json({
      message: 'Pengembalian history retrieved successfully',
      pengembalianHistory,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving pengembalian history: ' + error.message });
  }
};

const getPengembalianHistoryToCSV = async (req, res) => {
  try {
    const pengembalianHistory = await PengembalianHistoryModel.find()
      .populate({
        path: 'id_pengembalian',
        populate: { path: 'id_aset' }
      })
      .populate('id_user', 'username')
      .populate('id_admin', 'username');

    if (pengembalianHistory.length === 0) {
      return res.status(404).json({ error: 'No pengembalian history found' });
    }

    const csvHeaders = [
      { id: 'id', title: 'ID' },
      { id: 'id_pengembalian', title: 'Pengembalian ID' },
      { id: 'aset', title: 'Aset' },
      { id: 'username_user', title: 'User' },
      { id: 'action', title: 'Action' },
      { id: 'tanggal', title: 'Tanggal' },
      { id: 'admin', title: 'Admin' }
    ];

    const records = pengembalianHistory.map(history => ({
      id: history._id,
      id_pengembalian: history.id_pengembalian._id,
      aset: history.id_pengembalian.id_aset.name,
      username_user: history.id_user.username,
      action: history.action,
      tanggal: history.createdAt,
      admin: history.id_admin.username
    }));

    const csvWriter = createCsvWriter({
      path: 'Riwayat Pengembalian.csv',
      header: csvHeaders
    });
    await csvWriter.writeRecords(records);

    res.status(200).json({ message: 'Pengembalian history exported to CSV' });
  } catch (error) {
    res.status(500).json({ error: 'Error exporting pengembalian history to CSV: ' + error.message });
  }
};


module.exports = { createPengembalian, getAllPengembalian, getPengembalianById, getPengembalianByUserId, rejectPengembalian, acceptPengembalian, getPengembalianHistory, getPengembalianHistoryById, getPengembalianHistoryToCSV };
