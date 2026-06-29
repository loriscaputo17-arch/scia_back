const { JobExecution, Job, Ship, Element, JobStatus } = require("../models");

// Get details of a single execution
exports.getExecutionById = async (req, res) => {
    try {
        const { executionId } = req.params;
        const execution = await JobExecution.findByPk(executionId);
        if (!execution) return res.status(404).json({ message: "Esecuzione non trovata" });
        res.json(execution);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new execution
exports.createExecution = async (req, res) => {
    try {
        const newExecution = await JobExecution.create(req.body);
        res.status(201).json({ message: "Esecuzione creata con successo", executionId: newExecution.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update execution
exports.updateExecution = async (req, res) => {
    try {
        const { executionId } = req.params;
        const [updated] = await JobExecution.update(req.body, { where: { id: executionId } });
        if (!updated) return res.status(404).json({ message: "Esecuzione non trovata" });
        res.json({ message: "Esecuzione aggiornata con successo" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete execution
exports.deleteExecution = async (req, res) => {
    try {
        const { executionId } = req.params;
        const deleted = await JobExecution.destroy({ where: { id: executionId } });
        if (!deleted) return res.status(404).json({ message: "Esecuzione non trovata" });
        res.json({ message: "Esecuzione eliminata con successo" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
