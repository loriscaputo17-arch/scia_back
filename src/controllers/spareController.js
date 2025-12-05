const { Spare, Location, Warehouses, maintenanceListSpareAdded, ElemetModel, Parts, OrganizationCompanyNCAGE } = require("../models");
const { Op } = require("sequelize");

require('dotenv').config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3 = new AWS.S3();

const BUCKET_NAME = 'scia-project-questit';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
  
exports.getSpare = async (req, res) => {
  try {
    const { name, id, page } = req.query; // 👈 aggiunto anche page opzionale

    const where = {};
    if (name) where.Part_name = name;
    if (id) where.ID = id;

    const spares = await Spare.findAll({
      where,
      include: [
        {
          model: ElemetModel,
          as: "elementModel",
        },
        {
          model: Parts,
          as: "part",
          include: [
            {
              model: OrganizationCompanyNCAGE,
              as: "organizationCompanyNCAGE",
            },
          ],
        },
      ],
    });

    // funzione per generare signed url
    const getSignedFileUrl = async (fileName) => {
      try {
        const list = await s3
          .listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: "", // se i tuoi file sono dentro una cartella, cambia qui
          })
          .promise();

        const found = list.Contents.find((obj) =>
          obj.Key.toLowerCase().includes(fileName.toLowerCase())
        );

        if (!found) return null;

        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: found.Key,
        });

        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Errore cercando file su S3:", err);
        return null;
      }
    };

    const enrichedSpares = await Promise.all(
      spares.map(async (spare) => {
        const locationIds =
          spare.location
            ?.split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id)) || [];

        const locations = await Location.findAll({
          where: { id: locationIds },
          attributes: ["id", "location", "ship_id", "warehouse"],
        });

        const warehouseIds = [...new Set(locations.map((loc) => loc.warehouse))];

        let warehouses = await Warehouses.findAll({
          where: { id: warehouseIds },
          attributes: ["id", "name", "icon_url"],
        });

        warehouses = await Promise.all(
          warehouses.map(async (w) => {
            let signedIconUrl = null;

            if (w.icon_url) {
              const key = w.icon_url.replace(/^https?:\/\/[^/]+\//, "");
              const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
              });

              try {
                signedIconUrl = await getSignedUrl(s3Client, command, {
                  expiresIn: 3600,
                });
              } catch (err) {
                console.warn(
                  "Errore generando signed URL per icon_url:",
                  w.icon_url,
                  err
                );
                signedIconUrl = w.icon_url;
              }
            }

            return {
              ...w.toJSON(),
              icon_url: signedIconUrl,
            };
          })
        );

        // 🔥 qui prendiamo il documento da part.Document_file_link
        let documentFileUrl = null;
        if (spare.part && spare.part.Document_file_link) {
          documentFileUrl = await getSignedFileUrl(
            spare.part.Document_file_link
          );

          // se c'è parametro page, aggiungi #page=xx
          if (documentFileUrl && page) {
            documentFileUrl = `${documentFileUrl}#page=${page}`;
          }
        }

        return {
          ...spare.toJSON(),
          elementModel: spare.elementModel,
          part: spare.part,
          locations,
          warehouses,
          documentFileUrl,
        };
      })
    );

    res.status(200).json({ spares: enrichedSpares });
  } catch (error) {
    console.error("Error fetching spares:", error);
    res.status(500).json({ error: "Error fetching spares" });
  }
};
 
exports.getSpares = async (req, res) => {
  try {
    const { ship_id } = req.query;

    if (!ship_id) {
      return res.status(400).json({ error: "ship_id is required" });
    }

    const spares = await Spare.findAll({
      where: { ship_id },
      include: [
        {
          model: ElemetModel,
          as: "elementModel",
        },
        {
          model: Parts,
          as: "part",
          include: [
            {
              model: OrganizationCompanyNCAGE,
              as: "organizationCompanyNCAGE",
            },
          ],
        },
      ],
    });

    const enrichedSpares = await Promise.all(spares.map(async spare => {
      const locationIds = spare.location
        ?.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id)) || [];

      const locations = await Location.findAll({
        where: { id: locationIds },
        attributes: ['id', 'location', 'ship_id', 'warehouse_id']
      });

      const warehouseIds = [...new Set(locations.map(loc => loc.warehouse))];

      const extractS3Key = (url) => {
        if (!url) return null;
        try {
          const u = new URL(url);
          return u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
        } catch (e) {
          return url;
        }
      };

      let warehouses = await Warehouses.findAll({
        where: { id: warehouseIds },
        attributes: ['id', 'name', 'icon_url']
      });

      warehouses = await Promise.all(
        warehouses.map(async (w) => {
          let signedIconUrl = null;

          if (w.icon_url) {
            const key = extractS3Key(w.icon_url);

            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            });

            try {
              signedIconUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            } catch (err) {
              console.warn("Errore generando signed URL per icon_url:", w.icon_url, err);
              signedIconUrl = w.icon_url; // fallback
            }
          }

          return {
            ...w.toJSON(),
            icon_url: signedIconUrl,
          };
        })
      );

      return {
        ...spare.toJSON(),
        elementModel: spare.elementModel,
        locations,
        warehouses
      };
    }));

    res.status(200).json({ spares: enrichedSpares });

  } catch (error) {
    console.error("Error fetching spares:", error);
    res.status(500).json({ error: "Error fetching spares" });
  }
};

exports.updateSpare = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      quantity,
      location_onboard,
      location_dock,
      location_basin,
      eswbs,
      system_description
    } = req.body;

    const [updated] = await Spare.update(
      {
        quantity,
        location_onboard,
        location_dock,
        location_basin,
        eswbs,
        system_description
      },
      {
        where: { id }
      }
    );

    if (updated) {
      res.status(200).json({ message: "Spare updated successfully", updated_id: id });
    } else {
      res.status(404).json({ message: "Spare not found" });
    }

  } catch (error) {
    console.error("Error updating spare:", error);
    res.status(500).json({ error: "Error updating spare" });
  }
};

exports.moveSpare = async (req, res) => {
  try {
    const { id } = req.params;
    const { updateData, ship_id, user_id } = req.body;

    if (!updateData || !ship_id || !user_id) {
      return res.status(400).json({ message: "updateData, ship_id, and user_id are required" });
    }

    const newLocation = updateData.locationData[0].newLocation;
    //console.log(newLocation)

    let locationRecord = await Location.findOne({
      where: {
        location: newLocation,
        ship_id: ship_id,
        user_id: user_id
      }
    });

    if (!locationRecord) {
      locationRecord = await Location.create({
        warehouse_id: 1,
        location: newLocation,
        ship_id: ship_id,
        user_id: user_id
      });
    }

    const newLocationId = locationRecord.id;

    const [updated] = await Spare.update(
      { location: newLocationId },
      { where: { id } }
    );

    if (updated) {
      res.status(200).json({ message: "Spare location updated successfully", updated_id: id });
    } else {
      res.status(404).json({ message: "Spare not found" });
    }

  } catch (error) {
    console.error("Error updating spare location:", error);
    res.status(500).json({ error: "Error updating spare location" });
  }
};

exports.fetchSpareById = async (req, res) => {
  try {
    const { ean13, partNumber, eswbsSearch } = req.query;

    const where = {};
    if (ean13) where.ean13 = ean13;
    if (partNumber) where.serial_number = partNumber;
    if (eswbsSearch) where.eswbsSearch = eswbsSearch;

    const spares = await Spare.findAll({
      where,
      include: [
        {
          model: Warehouses,
          as: "warehouseData",
          attributes: ["id", "name", "icon_url"],
        }
      ]
    });

    for (const spare of spares) {
      const locationIds = typeof spare.location === "string"
        ? spare.location.split(",").map(id => parseInt(id.trim(), 10))
        : [];

      const locations = await Location.findAll({
        where: {
          id: {
            [Op.in]: locationIds
          }
        },
        attributes: ["id", "location", "ship_id"]
      });

      spare.dataValues.locationData = locations;
    }

    res.status(200).json({ spares });

  } catch (error) {
    console.error("Error fetching spares:", error);
    res.status(500).json({ error: "Error fetching spares" });
  }
};

exports.submitProduct = async (req, res) => {
  try {
    const {
      quantity,
      eswbs,
      description,
      ship_id,
      user_id,
      ean13,
      partNumber,
      originalName,
      supplier,
      supplierNcage,
      manufacturerNcage,
      manufacturerPartNumber,
      price,
      leadTime,
      warehouse,
      location,
      stock,
      image,
    } = req.body;

    //console.log(req.body)

    let locationRecord = await Location.findOne({
      where: {
        location: location,
        ship_id: ship_id,
        user_id: user_id
      }
    });

    if (!locationRecord) {
      locationRecord = await Location.create({
        warehouse_id: warehouse,
        location: location,
        ship_id: ship_id,
        user_id: user_id
      });
    }

    const newLocationId = locationRecord.id;

    const newSpare = await Spare.create({
      name: originalName,
      original_denomination: originalName,
      serial_number: partNumber,
      company: supplier,
      NCAGE: manufacturerNcage,
      NCAGE_supplier: supplierNcage,
      price: price,
      quantity:stock,
      ean13,
      eswbs,
      description: description,
      ship_id,
      user_id: user_id,
      warehouse,
      image: image,
      location: newLocationId
    });

    res.status(201).json({
      message: "Spare created successfully",
      spare: newSpare
    });
  } catch (error) {
    console.error("Error submitting product:", error);
    res.status(500).json({ error: "Error submitting product" });
  }
};

exports.uploadProductImage = async (req, res) => {
  const userId = req.body.userId;
  const file = req.file;
  const partNumber = req.body.partNumber;
  const originalName = req.body.originalName;

  //console.log(req.file)

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileName = `shipsFiles/${originalName}_${partNumber}.jpg`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    const imageUrl = uploadResult.Location;

    res.status(200).json({
      message: "Immagine caricata con successo e aggiornata nel DB",
      url: imageUrl,
    });
  } catch (error) {
    console.error("Errore upload su S3 o aggiornamento DB:", error);
    res.status(500).json({ error: "Errore nel caricamento dell'immagine" });
  }
};

const uploadImageToS3 = async (file, originalName, partNumber) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  const fileName = `shipsFiles/${originalName}_${partNumber}.jpg`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const uploadResult = await s3.upload(params).promise();
  return uploadResult.Location; // imageUrl
};

exports.addSpareMaintenanceList = async (req, res) => {
  const { brand, model, part_number, description, maintenanceList_id } = req.body;
  const file = req.file;

  try {
    let photo_url = null;
    if (file) {
      photo_url = await uploadImageToS3(file, brand, part_number);
    }

    const newEntry = await maintenanceListSpareAdded.create({
      brand,
      model,
      part_number,
      description,
      maintenanceList_id,
      photo_url,
    });

    res.status(201).json({
      message: "Elemento aggiunto con successo alla Maintenance List",
      data: newEntry,
    });
  } catch (error) {
    console.error("Errore durante l'aggiunta alla lista:", error);
    res.status(500).json({ error: error.message });
  }
};
