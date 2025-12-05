const { Spare, Cart, ElemetModel, Parts, OrganizationCompanyNCAGE } = require("../models");

exports.getProduct = async (req, res) => {
  try {
    const { ship_id } = req.query;

    const where = {};
    if (ship_id) where.ship_id = ship_id;

    const spares = await Spare.findAll({ where });

    res.status(200).json({ spares });
  } catch (error) {
    console.error("Errore nel recupero dei ricambi:", error);
    res.status(500).json({ error: "Errore nel recupero dei ricambi" });
  }
};

exports.getCart = async (req, res) => {
  try {
    const { user_id } = req.query;

    const where = {};
    if (user_id) where.user_id = user_id;

    const cartItems = await Cart.findAll({
  where,
  include: [
    {
      model: Spare,
      as: "spare",
      include: [
        {
          model: ElemetModel,
          as: "elementModel"
        },
        {
          model: Parts,
          as: "part",
          include: [
            {
              model: OrganizationCompanyNCAGE,
              as: "organizationCompanyNCAGE"
            }
          ]
        }
      ]
    }
  ]
});


    res.status(200).json({ cart: cartItems });
  } catch (error) {
    console.error("Errore nel recupero del carrello:", error);
    res.status(500).json({ error: "Errore nel recupero del carrello" });
  }
};

exports.addProduct = async (req, res) => {
  try {
    const { spare_id, user_id, quantity, status } = req.body;

    if (!spare_id || !user_id || !quantity || !status) {
      return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
    }

    const existingEntry = await Cart.findOne({
      where: { spare_id, user_id }
    });

    if (existingEntry) {
      existingEntry.quantity += Number(quantity);
      existingEntry.status = status;
      await existingEntry.save();
      return res.status(200).json({ message: "Prodotto aggiornato nel carrello", cartItem: existingEntry });
    }

    const newEntry = await Cart.create({ spare_id, user_id, quantity, status });

    res.status(201).json({ message: "Prodotto aggiunto al carrello", cartItem: newEntry });
  } catch (error) {
    console.error("Errore durante l'aggiunta al carrello:", error);
    res.status(500).json({ error: "Errore durante l'aggiunta al carrello" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, status } = req.body;

    const cartItem = await Cart.findOne({ where: { spare_id: id } });

    if (!cartItem) {
      return res.status(404).json({ error: "Prodotto non trovato nel carrello" });
    }

    if (quantity !== undefined) cartItem.quantity = quantity;
    if (status !== undefined) cartItem.status = status;

    await cartItem.save();
    res.status(200).json({ message: "Prodotto aggiornato", cartItem });

  } catch (error) {
    console.error("Errore durante l'aggiornamento del carrello:", error);
    res.status(500).json({ error: "Errore interno" });
  }
};

exports.removeProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const cartItem = await Cart.findOne({ where: { spare_id: id } });

    if (!cartItem) {
      return res.status(404).json({ error: "Prodotto non trovato nel carrello" });
    }

    await cartItem.destroy();
    res.status(200).json({ message: "Prodotto rimosso dal carrello" });

  } catch (error) {
    console.error("Errore durante la rimozione:", error);
    res.status(500).json({ error: "Errore interno" });
  }
};


