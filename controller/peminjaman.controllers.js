const PeminjamanModel = require('../models/peminjaman.model');
const AsetModel = require('../models/aset.model');
const UserModel = require('../models/users.model');

module.exports.createPeminjaman = (req, res) => {
  const { lokasi, kondisi_aset, tanggal_peminjaman, tujuan_peminjaman, assetName, username } = req.body;
  AsetModel.findOne({ nama_alat: assetName })
    .then((asset) => {
      if (!asset) {
        return res.status(404).json({
          error: {
            message: "Asset not found",
          },
        });
      }

      if (asset.is_borrowed) {
        return res.status(400).json({
          error: {
            message: "Asset is already borrowed",
          },
        });
      }

      UserModel.findOne({ username: username })
        .then((user) => {
          if (!user) {
            return res.status(404).json({
              error: {
                message: "User not found",
              },
            });
          }

          const newPeminjaman = new PeminjamanModel({
            lokasi,
            kondisi_aset,
            tanggal_peminjaman,
            tujuan_peminjaman,
            id_aset: asset._id,
            id_user: user._id,
            status: "Pending",
          });

          newPeminjaman.save()
            .then((peminjaman) => {
              asset.is_borrowed = true;
              asset.save()
                .then(() => {
                  res.status(201).json({
                    message: "Peminjaman berhasil dibuat",
                    data: {
                      peminjaman,
                      asset: {
                        nama_alat: asset.nama_alat,
                        tag_number: asset.tag_number,
                        merek: asset.merek,
                        tipe: asset.tipe,
                        nomor_seri: asset.nomor_seri,
                        penanggung_jawab: asset.penanggung_jawab,
                        lokasi_alat: asset.lokasi_alat,
                      },
                      user: {
                        username: user.username,
                      },
                    },
                  });
                })
                .catch((assetErr) => {
                  res.status(500).json({
                    error: {
                      message: "Error updating asset status",
                      details: assetErr.message,
                    },
                  });
                });
            })
            .catch((peminjamanErr) => {
              res.status(500).json({
                error: {
                  message: "Error creating peminjaman",
                  details: peminjamanErr.message,
                },
              });
            });
        })
        .catch((userErr) => {
          res.status(500).json({
            error: {
              message: "Error finding user",
              details: userErr.message,
            },
          });
        });
    })
    .catch((assetErr) => {
      res.status(500).json({
        error: {
          message: "Error finding asset",
          details: assetErr.message,
        },
      });
    });
};


module.exports.getAllPeminjaman = async (req, res) => {
  try {
    const peminjaman = await PeminjamanModel.find();
    res.status(200).json({ message: 'Daftar peminjaman berhasil diambil', peminjaman });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil daftar peminjaman: ' + error.message });
  }
};

module.exports.getPeminjamanById = async (req, res) => {
  try {
    const peminjamanId = req.params.id;
    const peminjaman = await PeminjamanModel.findById(peminjamanId);
    if (!peminjaman) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }
    res.status(200).json({ message: 'Peminjaman berhasil diambil', peminjaman });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil peminjaman: ' + error.message });
  }
};
