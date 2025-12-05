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

      // notifiche standard
      isNotificationsEnabledMaintenance,
      maintenanceFrequency,
      isNotificationsEnabledChecklist,
      checklistFrequency,
      license,

      // upcoming
      isUpcomingMaintenanceEnabled,
      isUpcomingChecklistEnabled,
      isUpcomingSpareEnabled,

      // planning
      isPlanningMaintenanceEnabled,
      planningMaintenanceFrequency,
      isPlanningChecklistEnabled,
      planningChecklistFrequency,
      isPlanningSpareEnabled,
      planningSpareFrequency,
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    await UserSettings.upsert({
      user_id,

      // notifiche standard
      is_notifications_enabled_maintenance: isNotificationsEnabledMaintenance,
      maintenance_frequency: maintenanceFrequency,
      is_notifications_enabled_checklist: isNotificationsEnabledChecklist,
      checklist_frequency: checklistFrequency,
      license,

      // upcoming
      is_upcoming_maintenance_enabled: isUpcomingMaintenanceEnabled,
      is_upcoming_checklist_enabled: isUpcomingChecklistEnabled,
      is_upcoming_spare_enabled: isUpcomingSpareEnabled,

      // planning
      is_planning_maintenance_enabled: isPlanningMaintenanceEnabled,
      planning_maintenance_frequency: planningMaintenanceFrequency,
      is_planning_checklist_enabled: isPlanningChecklistEnabled,
      planning_checklist_frequency: planningChecklistFrequency,
      is_planning_spare_enabled: isPlanningSpareEnabled,
      planning_spare_frequency: planningSpareFrequency,
    });

    res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ error: "Error updating user settings" });
  }
};

