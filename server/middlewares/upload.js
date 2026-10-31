import { t } from "#utils";

/**
 * Per-route upload size guard.
 *
 * express-fileupload is mounted once with a single global limit (the largest
 * allowed type). This factory lets each media route enforce its own, smaller
 * per-type limit and respond with a clean 413 envelope BEFORE the file reaches
 * FileService.
 *
 * @param {number} maxBytes - Maximum allowed size (bytes) for any file on the route.
 * @returns {Function} Express middleware
 */
const uploadLimit = (maxBytes) => (req, res, next) => {
  if (req.files) {
    for (const key of Object.keys(req.files)) {
      const entry = req.files[key];
      // A field may hold a single file or an array of files.
      const files = Array.isArray(entry) ? entry : [entry];
      for (const file of files) {
        if (file && typeof file.size === "number" && file.size > maxBytes) {
          return res.status(413).json({
            success: false,
            message: t(req.lang, "common.fileTooLarge", {
              mb: Math.round(maxBytes / 1024 / 1024),
            }),
          });
        }
      }
    }
  }
  next();
};

export { uploadLimit };
