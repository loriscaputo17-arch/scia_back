const { Spare, Location, Warehouses, maintenanceListSpareAdded, 
  ElemetModel, Parts, OrganizationCompanyNCAGE,
 Maintenance_ListSpare, Maintenance_List, Element } = require("../models");
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
    const { name, id, page, ship_id } = req.query;

    const where = {};
    if (name) where.Part_name = name;
    if (id) where.ID = id;
    if (ship_id) where.ship_id = ship_id;

    const spares = await Spare.findAll({
      where,
      include: [
        { model: ElemetModel, as: "elementModel" },
        {
          model: Parts, as: "part",
          include: [{ model: OrganizationCompanyNCAGE, as: "organizationCompanyNCAGE" }],
        },
      ],
    });

    // ⭐ Recupera Maintenance_ListSpare per installed_quantity e manutenzioni collegate
    const spareIds = spares.map(s => s.ID);

    const maintenanceSpares = spareIds.length
      ? await Maintenance_ListSpare.findAll({
          where: { Spare_ID: { [Op.in]: spareIds } },
          attributes: ['Spare_ID', 'Spare_quantity', 'Maintenance_List_ID'],
        })
      : [];

    const installedQtyMap = {};
    const spareToMaintenanceMap = {};

    maintenanceSpares.forEach(ms => {
      const record = ms.toJSON();
      const sid = record.Spare_ID;
      const qty = Number(record.Spare_quantity) || 0;
      installedQtyMap[sid] = (installedQtyMap[sid] || 0) + qty;

      if (!spareToMaintenanceMap[sid]) spareToMaintenanceMap[sid] = [];
      spareToMaintenanceMap[sid].push(record.Maintenance_List_ID);
    });

    // ⭐ Recupera manutenzioni collegate
    const allMaintenanceIds = [...new Set(Object.values(spareToMaintenanceMap).flat().filter(Boolean))];

    const maintenanceList = allMaintenanceIds.length
      ? await Maintenance_List.findAll({
          where: { id: allMaintenanceIds },
          attributes: [
            'id', 'name',
            'End_Item_ElementModel_ID',
            'Maintenance_Item_ElementModel_ID',
            'System_ElementModel_ID',
            'RecurrencyType_ID',
            'MaintenanceLevel_ID',
            'Operational_Not_operational',
            'Mean_elapsed_time_MELAP',
            'Personnel_no',
            'Service_or_Maintenance_Manual_Link',
            'Service_or_Maintenance_manual_ParagraphAndPage',
          ],
          include: [
            { model: maintenanceLevel, as: "maintenance_level" },
            { model: recurrencyType, as: "recurrency_type" },
          ],
        })
      : [];

    const maintenanceMap = {};
    maintenanceList.forEach(m => {
      const record = m.toJSON();
      maintenanceMap[record.id] = record;
    });

    // ⭐ Per ogni spare, trova ElementModel_ID tramite manutenzione
    const spareToElementModelMap = {};
    Object.entries(spareToMaintenanceMap).forEach(([spareId, maintenanceIds]) => {
      for (const mId of maintenanceIds) {
        const m = maintenanceMap[mId];
        if (!m) continue;
        const elementModelId = m.End_Item_ElementModel_ID || m.Maintenance_Item_ElementModel_ID || m.System_ElementModel_ID;
        if (elementModelId) {
          spareToElementModelMap[spareId] = elementModelId;
          break;
        }
      }
    });

    // ⭐ Recupera Elements
    const elementModelIds = [...new Set(Object.values(spareToElementModelMap).filter(Boolean))];

    const elements = elementModelIds.length
      ? await Element.findAll({
          where: {
            element_model_id: { [Op.in]: elementModelIds },
            ...(ship_id ? { ship_id } : {}),
          },
          include: [{ model: ElemetModel, as: "element_model" }],
        })
      : [];

    const elementByModelId = {};
    elements.forEach(el => {
      const record = el.toJSON();
      if (!elementByModelId[record.element_model_id]) {
        elementByModelId[record.element_model_id] = record;
      }
    });

    // ⭐ Genera signed URL per documento
    const getSignedFileUrl = async (fileName) => {
      try {
        const list = await s3.listObjectsV2({
          Bucket: BUCKET_NAME,
          Prefix: "",
        }).promise();

        const normalize = (str) =>
          str.toLowerCase().replace(/\s+/g, "_").replace(/\.[^/.]+$/, "");

        const normalizedSearch = normalize(fileName);
        const found = list.Contents.find((obj) => {
          const keyName = obj.Key.split("/").pop();
          return normalize(keyName).includes(normalizedSearch);
        });

        if (!found) return null;

        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: found.Key });
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Errore cercando file su S3:", err);
        return null;
      }
    };

    const enrichedSpares = await Promise.all(
      spares.map(async (spare) => {
        // Locations
        const locationIds = spare.location
          ?.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];

        const locations = await Location.findAll({
          where: { id: locationIds },
          attributes: ["id", "location", "ship_id", "warehouse_id"],
        });

        const warehouseIds = [...new Set(locations.map(loc => loc.warehouse_id).filter(Boolean))];

        const warehouses = await Promise.all(
          (await Warehouses.findAll({
            where: { id: warehouseIds },
            attributes: ["id", "name", "icon_url"],
          })).map(async (w) => {
            let signedIconUrl = null;
            if (w.icon_url) {
              const key = w.icon_url.replace(/^https?:\/\/[^/]+\//, "");
              const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
              try {
                signedIconUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
              } catch {
                signedIconUrl = w.icon_url;
              }
            }
            return { ...w.toJSON(), icon_url: signedIconUrl };
          })
        );

        // Document URL dal part
        let documentFileUrl = null;
        if (spare.part?.Document_file_link) {
          documentFileUrl = await getSignedFileUrl(spare.part.Document_file_link);
          if (documentFileUrl && page) {
            documentFileUrl = `${documentFileUrl}#page=${page}`;
          }
        }

        // Element
        const directElementModelId = spare.element_model_id;
        const fallbackElementModelId = spareToElementModelMap[spare.ID];
        const resolvedElementModelId = directElementModelId || fallbackElementModelId;
        const element = resolvedElementModelId ? (elementByModelId[resolvedElementModelId] || null) : null;

        // Manutenzioni collegate a questo spare
        const linkedMaintenanceIds = spareToMaintenanceMap[spare.ID] || [];
        const linkedMaintenances = linkedMaintenanceIds
          .map(mId => maintenanceMap[mId])
          .filter(Boolean);

        return {
          ...spare.toJSON(),
          locations,
          warehouses,
          documentFileUrl,
          installed_quantity: installedQtyMap[spare.ID] || 1,
          Element: element,
          maintenances: linkedMaintenances, // ⭐ manutenzioni che usano questo spare
        };
      })
    );

    res.status(200).json({ spares: enrichedSpares });

  } catch (error) {
    console.error("Error fetching spare:", error);
    res.status(500).json({ error: "Error fetching spare" });
  }
};
 
exports.getSpares = async (req, res) => {
  try {
    const { ship_id, page = 1, limit = 30, search, eswbs_code, inGiacenza, nonDisponibile, magazzino } = req.query;

    if (!ship_id) return res.status(400).json({ error: "ship_id is required" });

    const offset = (Number(page) - 1) * Number(limit);
    const limitN = Number(limit);

    const where = { ship_id };
    if (search) {
      where.Part_name = { [Op.like]: `%${search}%` };
    }

    const spares = await Spare.findAll({
      where,
      include: [
        { model: ElemetModel, as: "elementModel" },
        {
          model: Parts, as: "part",
          include: [{ model: OrganizationCompanyNCAGE, as: "organizationCompanyNCAGE" }],
        },
      ],
    });

    // ⭐ Recupera Maintenance_ListSpare per installed_quantity e collegamento manutenzioni
    const spareIds = spares.map(s => s.ID);

    const maintenanceSpares = spareIds.length
      ? await Maintenance_ListSpare.findAll({
          where: { Spare_ID: { [Op.in]: spareIds } },
          attributes: ['Spare_ID', 'Spare_quantity', 'Maintenance_List_ID'],
        })
      : [];

    const installedQtyMap = {};
    const spareToMaintenanceMap = {};

    maintenanceSpares.forEach(ms => {
      const record = ms.toJSON();
      const id = record.Spare_ID;
      const qty = Number(record.Spare_quantity) || 0;
      installedQtyMap[id] = (installedQtyMap[id] || 0) + qty;

      if (!spareToMaintenanceMap[id]) spareToMaintenanceMap[id] = [];
      spareToMaintenanceMap[id].push(record.Maintenance_List_ID);
    });

    // ⭐ Recupera manutenzioni collegate per trovare ElementModel
    const allMaintenanceIds = [...new Set(Object.values(spareToMaintenanceMap).flat().filter(Boolean))];

    const maintenanceList = allMaintenanceIds.length
      ? await Maintenance_List.findAll({
          where: { id: allMaintenanceIds },
          attributes: ['id', 'End_Item_ElementModel_ID', 'Maintenance_Item_ElementModel_ID', 'System_ElementModel_ID'],
        })
      : [];

    const maintenanceMap = {};
    maintenanceList.forEach(m => {
      const record = m.toJSON();
      maintenanceMap[record.id] = record;
    });

    // ⭐ Per ogni spare, trova ElementModel_ID tramite manutenzione
    const spareToElementModelMap = {};
    Object.entries(spareToMaintenanceMap).forEach(([spareId, maintenanceIds]) => {
      for (const mId of maintenanceIds) {
        const m = maintenanceMap[mId];
        if (!m) continue;
        const elementModelId = m.End_Item_ElementModel_ID || m.Maintenance_Item_ElementModel_ID || m.System_ElementModel_ID;
        if (elementModelId) {
          spareToElementModelMap[spareId] = elementModelId;
          break;
        }
      }
    });

    // ⭐ Recupera Elements tramite element_model_id
    const elementModelIds = [...new Set(Object.values(spareToElementModelMap).filter(Boolean))];

    const elements = elementModelIds.length
      ? await Element.findAll({
          where: {
            element_model_id: { [Op.in]: elementModelIds },
            ship_id,
          },
          include: [{ model: ElemetModel, as: "element_model" }],
        })
      : [];

    const elementByModelId = {};
    elements.forEach(el => {
      const record = el.toJSON();
      if (!elementByModelId[record.element_model_id]) {
        elementByModelId[record.element_model_id] = record;
      }
    });

    // ── Raccogli tutti i location ID
    const allLocationIds = [];
    spares.forEach(spare => {
      const ids = spare.location
        ?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
      allLocationIds.push(...ids);
    });

    const uniqueLocationIds = [...new Set(allLocationIds)];

    const allLocations = uniqueLocationIds.length
      ? await Location.findAll({
          where: { id: uniqueLocationIds },
          attributes: ['id', 'location', 'ship_id', 'warehouse_id'],
        })
      : [];

    const allWarehouseIds = [...new Set(allLocations.map(loc => loc.warehouse_id).filter(Boolean))];

    const allWarehouses = allWarehouseIds.length
      ? await Warehouses.findAll({
          where: { id: allWarehouseIds },
          attributes: ['id', 'name', 'icon_url'],
        })
      : [];

    const extractS3Key = (url) => {
      if (!url) return null;
      try {
        const u = new URL(url);
        return u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
      } catch { return url; }
    };

    const warehouseMap = {};
    await Promise.all(allWarehouses.map(async (w) => {
      let signedIconUrl = null;
      if (w.icon_url) {
        const key = extractS3Key(w.icon_url);
        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
        try {
          signedIconUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        } catch { signedIconUrl = w.icon_url; }
      }
      warehouseMap[w.id] = { ...w.toJSON(), icon_url: signedIconUrl };
    }));

    const locationMap = {};
    allLocations.forEach(loc => { locationMap[loc.id] = loc; });

    // ── Assembla i dati
    const parseQty = (q) => q ? parseFloat(q.toString().replace(',', '.').replace(/[^0-9.-]/g, '')) : 0;

    let enriched = spares.map(spare => {
      const locationIds = spare.location
        ?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
      const locations = locationIds.map(id => locationMap[id]).filter(Boolean);
      const warehouseIds = [...new Set(locations.map(loc => loc.warehouse_id).filter(Boolean))];
      const warehouses = warehouseIds.map(id => warehouseMap[id]).filter(Boolean);

      // ⭐ Element: prima da elementModel diretto, poi tramite manutenzione
      const directElementModelId = spare.element_model_id;
      const fallbackElementModelId = spareToElementModelMap[spare.ID];
      const resolvedElementModelId = directElementModelId || fallbackElementModelId;
      const element = resolvedElementModelId ? (elementByModelId[resolvedElementModelId] || null) : null;

      return {
        ...spare.toJSON(),
        locations,
        warehouses,
        installed_quantity: installedQtyMap[spare.ID] || 1,
        Element: element,
      };
    });

    // ── Filtri JS
    if (eswbs_code) {
      enriched = enriched.filter(s => s.elementModel?.ESWBS_code?.startsWith(eswbs_code));
    }
    if (inGiacenza === "1") {
      enriched = enriched.filter(s => parseQty(s.quantity) > 0);
    }
    if (nonDisponibile === "1") {
      enriched = enriched.filter(s => parseQty(s.quantity) <= 0);
    }
    if (magazzino) {
      const tipi = magazzino.split(",");
      enriched = enriched.filter(s => (s.warehouses || []).some(w => {
        const name = w.name?.toLowerCase() || "";
        if (tipi.includes("onboard")  && name.includes("a bordo"))   return true;
        if (tipi.includes("dockside") && name.includes("banchina"))  return true;
        if (tipi.includes("drydock")  && name.includes("bacino"))    return true;
        if (tipi.includes("external") && name.includes("fornitore")) return true;
        return false;
      }));
    }

    // ⭐ Raggruppa spare con stesso Part_name sommando quantità
    const groupedMap = {};
    enriched.forEach(spare => {
      const key = spare.Part_name?.trim().toLowerCase() || spare.ID;

      if (!groupedMap[key]) {
        groupedMap[key] = { ...spare };
      } else {
        // Somma installed_quantity
        groupedMap[key].installed_quantity = (groupedMap[key].installed_quantity || 0) + (spare.installed_quantity || 0);

        // Somma quantity in giacenza
        const existingQty = parseQty(groupedMap[key].quantity);
        const newQty = parseQty(spare.quantity);
        groupedMap[key].quantity = String(existingQty + newQty);

        // Unisci locations senza duplicati
        const existingLocationIds = new Set(groupedMap[key].locations.map(l => l.id));
        spare.locations.forEach(l => {
          if (!existingLocationIds.has(l.id)) groupedMap[key].locations.push(l);
        });

        // Unisci warehouses senza duplicati
        const existingWarehouseIds = new Set(groupedMap[key].warehouses.map(w => w.id));
        spare.warehouses.forEach(w => {
          if (!existingWarehouseIds.has(w.id)) groupedMap[key].warehouses.push(w);
        });
      }
    });

    enriched = Object.values(groupedMap);

    const total = enriched.length;
    const paginated = enriched.slice(offset, offset + limitN);

    res.status(200).json({ spares: paginated, total, hasMore: offset + limitN < total });

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

    const locationData = Array.isArray(updateData.locationData)
      ? updateData.locationData
      : updateData.locationData
        ? [updateData.locationData]
        : [];

    if (!locationData.length || !locationData[0]?.newLocation) {
      return res.status(400).json({ message: "newLocation is required" });
    }

    const newLocation = locationData[0].newLocation;

    let locationRecord = await Location.findOne({
      where: { location: newLocation, ship_id, user_id }
    });

    if (!locationRecord) {
      locationRecord = await Location.create({
        warehouse_id: 1,
        location: newLocation,
        ship_id,
        user_id
      });
    }

    const newLocationId = locationRecord.id;

    // Aggiorna anche la quantità se fornita
    const newQuantity = locationData[0].quantity ?? null;
    const updateFields = { location: newLocationId };
    if (newQuantity !== null) updateFields.quantity = String(newQuantity);

    const [updated] = await Spare.update(updateFields, { where: { id } });

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

    const spares = await Spare.findAll({ where }); // 👈 rimosso include Warehouses

    for (const spare of spares) {
      const locationIds = typeof spare.location === "string"
        ? spare.location.split(",").map(id => parseInt(id.trim(), 10))
        : [];

      const locations = await Location.findAll({
        where: { id: { [Op.in]: locationIds } },
        attributes: ["id", "location", "ship_id", "warehouse_id"],
      });

      spare.dataValues.locationData = locations;

      // carica warehouse separatamente
      const warehouseIds = [...new Set(locations.map(l => l.warehouse_id).filter(Boolean))];
      const warehouses = warehouseIds.length
        ? await Warehouses.findAll({ where: { id: warehouseIds }, attributes: ["id", "name", "icon_url"] })
        : [];
      spare.dataValues.warehouseData = warehouses.map(w => w.toJSON());
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
