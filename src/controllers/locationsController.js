const { Location, Warehouses, Spare } = require("../models");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const BUCKET_NAME = 'scia-project-questit';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const extractS3Key = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
  } catch (e) {
    return url;
  }
};

exports.getLocations = async (req, res) => {
  try {
    const { ship_id, user_id } = req.query;

    if (!ship_id || !user_id) {
      return res.status(400).json({ error: "Missing ship_id or user_id" });
    }

    const locations = await Location.findAll({
      where: { ship_id },
      include: [
        {
          model: Warehouses,
          as: "warehouseInfo",
          attributes: ["id", "name", "icon_url", "user_id"],
        },
      ],
    });

    const spares = await Spare.findAll({
      where: { ship_id },
      attributes: ["location", "quantity"],
    });

    const spareCountMap = {};
    spares.forEach((spare) => {
      const locationId = spare.location;
      if (!locationId) return;
      const qty = parseInt(spare.quantity) || 0;
      spareCountMap[locationId] = (spareCountMap[locationId] || 0) + qty;
    });

    const enrichedLocations = await Promise.all(
      locations.map(async (loc) => {
        const locJson = loc.toJSON();
        const warehouse = locJson.warehouseInfo;

        if (warehouse?.icon_url) {
          const key = extractS3Key(warehouse.icon_url);

          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          });

          try {
            const signedIconUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            locJson.warehouseInfo.icon_url = signedIconUrl;
          } catch (err) {
            console.warn("Errore generando signed URL per icon_url:", warehouse.icon_url, err);
          }
        }

        const spareCount = spareCountMap[loc.id] || 0;
        return {
          ...locJson,
          spare_count: spareCount,
        };
      })
    );

    res.status(200).json({ locations: enrichedLocations });

  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Error fetching locations" });
  }
};

exports.addLocation = async (req, res) => {
  try {
    const { warehouse, ship_id, user_id, location } = req.body;

    if (!warehouse || !ship_id || !user_id || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newLocation = await Location.create({
      warehouse,
      ship_id,
      user_id,
      location,
    });

    res.status(201).json({
      message: "Ubicazione creata con successo",
      location: newLocation,
    });

  } catch (error) {
    console.error("Errore nella creazione dell'ubicazione:", error);
    res.status(500).json({ error: "Errore durante la creazione della nuova ubicazione" });
  }
};
