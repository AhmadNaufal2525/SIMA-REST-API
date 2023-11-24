const { initializeApp } = require('firebase/app');
const { getStorage, ref, getDownloadURL, uploadBytesResumable } = require('firebase/storage');
const multer = require('multer');
const config = require('../config/firebase.config');
const UserModel = require('../model/users.model');
const AsetModel = require('../model/aset.model');
const PeminjamanModel = require('../model/peminjaman.model');
const PengembalianModel = require('../model/pengembalian.model');

initializeApp(config.firebaseConfig);

const storage = getStorage();

const upload = multer({ storage: multer.memoryStorage() });

const createPengembalian = async (req, res) => {
  try {
    upload.single('photo')(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          error: {
            message: 'Multer error',
            details: err.message,
          },
        });
      } else if (err) {
        return res.status(500).json({
          error: {
            message: 'Error uploading file',
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

      // Rest of your existing code to validate and process the 'pengembalian'

      // Your existing code for processing 'pengembalian'

      // New code for uploading the photo to Firebase Storage
      const photoFile = req.file;
      if (!photoFile || !photoFile.buffer) {
        return res.status(400).json({
          error: {
            message: 'File data is missing or invalid',
          },
        });
      }

      const pengembalian = new PengembalianModel(); // Assuming PengembalianModel initializes a new object

      // Set the properties with the data from req.body
      pengembalian.kondisi_aset = kondisi_aset;
      pengembalian.tanggal_pengembalian = tanggal_pengembalian;
      pengembalian.lokasi = lokasi;
      pengembalian.tagNumber = tagNumber;
      pengembalian.username = username;

      const photoFileName = `Aset${existingPeminjaman._id}_${Date.now()}.jpg`;
      const storageRef = ref(storage, photoFileName);

      const photoSnapshot = await uploadBytesResumable(storageRef, photoFile.buffer);
      const photoURL = await getDownloadURL(photoSnapshot.ref);

      // Update 'pengembalian' object with the photoURL
      pengembalian.foto = photoURL;

      // Save the updated 'pengembalian' object
      const savedPengembalian = await pengembalian.save();

      // Return the response
      res.status(201).json({
        message: 'Pengembalian berhasil dibuat',
        pengembalian: savedPengembalian,
      });
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: 'Error creating pengembalian',
        details: error.message,
      },
    });
  }
};

module.exports = { createPengembalian };
