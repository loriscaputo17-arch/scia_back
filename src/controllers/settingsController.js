const { UserSettings } = require("../models");

exports.getSettings = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const settings = await UserSettings.findOne({ where: { user_id } });

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ error: "Error fetching user settings" });
  }
}; 

exports.updateSettings = async (req, res) => {
  try {
    const {
      user_id,
      is_notifications_enabled_maintenance,
      maintenance_frequency,
      is_notifications_enabled_checklist,
      checklist_frequency,
      license,
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    await UserSettings.upsert({
      user_id,
      is_notifications_enabled_maintenance,
      maintenance_frequency,
      is_notifications_enabled_checklist,
      checklist_frequency,
      license,
    });

    return res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return res.status(500).json({ error: "Error updating user settings" });
  }
};

