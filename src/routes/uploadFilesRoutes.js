const multer = require('multer');
const express = require("express");
const router = express.Router();
const uploadFilesController = require("../controllers/uploadFilesController");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/* Failures Notes */
router.post("/uploadPhoto", upload.single("file"), uploadFilesController.uploadPhoto);
router.post("/uploadAudio", upload.single("file"), uploadFilesController.uploadAudio);
router.post("/uploadText", upload.single("content"), uploadFilesController.uploadTextNote);
router.get("/getAudios/:failureId/:type", uploadFilesController.getAudios);
router.get("/getPhotos/:failureId/:type", uploadFilesController.getPhotos);
router.get("/getTextNotes/:failureId/:type", uploadFilesController.getTextNotes);

/* General Notes */
router.post("/uploadPhotoGeneral", upload.single("file"), uploadFilesController.uploadPhotoGeneral);
router.post("/uploadAudioGeneral", upload.single("file"), uploadFilesController.uploadAudioGeneral);
router.post("/uploadTextGeneral", upload.single("content"), uploadFilesController.uploadTextNoteGeneral);
router.get("/getAudiosGeneral/:failureId/:type", uploadFilesController.getAudiosGeneral);
router.get("/getPhotosGeneral/:failureId/:type", uploadFilesController.getPhotosGeneral);
router.get("/getTextNotesGeneral/:failureId/:type", uploadFilesController.getTextNotesGeneral);

module.exports = router;