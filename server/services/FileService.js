import { fs, path, crypto } from "#lib";
import { config, securityConfig } from "#config";
import { uploadPaths } from "#constants";

/**
 * FileService (static)
 * Validates and stores uploaded files with anonymized filenames.
 * Uses express-fileupload's file objects (file.mv, file.name, ...).
 */
class FileService {
  static uploadDir = uploadPaths.root;
  static allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
  ];
  static maxFileSize = securityConfig.maxFileSize; // 10MB

  /**
   * Ensure a directory exists (created recursively)
   */
  static ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Ensure a sub-directory of uploads/ exists, guarding against path traversal
   * @param {string} subDir - e.g. "avatars/123"
   */
  static ensureUploadDir(subDir) {
    const safe = String(subDir).replace(/[^a-zA-Z0-9_\-/]/g, "");
    if (!safe) throw new Error("Invalid upload sub-directory");

    const dir = path.join(this.uploadDir, safe);

    // Ensure the resolved path stays inside the uploads root
    const resolved = path.resolve(dir);
    const uploadsRoot = path.resolve(this.uploadDir);
    if (!resolved.startsWith(uploadsRoot)) {
      throw new Error("Invalid upload path");
    }

    return this.ensureDir(dir);
  }

  /**
   * Validate a file's type and size
   * @returns {Object} { valid, error }
   */
  static validateFile(file) {
    if (!file) {
      return { valid: false, error: "No file provided" };
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: "File type not allowed" };
    }
    if (file.size > this.maxFileSize) {
      return { valid: false, error: "File size exceeds limit (10MB)" };
    }
    return { valid: true };
  }

  /**
   * Save a file into uploads/<subDir> with a random filename
   * @returns {Object} { filename, path, mimetype, size }
   */
  static async saveFile(file, subDir) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const dir = this.ensureUploadDir(subDir);

    const ext = path
      .extname(file.name)
      .replace(/[^a-zA-Z0-9.]/g, "")
      .toLowerCase();
    const randomName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const filePath = path.join(dir, randomName);

    await file.mv(filePath);

    return {
      filename: randomName,
      path: filePath,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Editor media helpers (TipTap)
  //
  // Unlike saveFile (which returns fs info), these return a public web URL
  // (`/uploads/<folder>/<filename>`) that the client can render directly, since
  // uploads/ is served statically. Validation uses config.upload.* limits/types.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Save a media file under uploads/<folder>/ with a random filename and copy a
   * pristine duplicate to uploads/originals/<folder>/ (best-effort).
   * @returns {string} public URL `/uploads/<folder>/<filename>`
   */
  static async saveMediaWithOriginal(file, folder) {
    const dir = this.ensureUploadDir(folder);
    // Forward-slash sub-path so ensureUploadDir's char guard keeps the separator.
    const originalsDir = this.ensureUploadDir(`originals/${folder}`);

    const ext = path
      .extname(file.name)
      .replace(/[^a-zA-Z0-9.]/g, "")
      .toLowerCase();
    const randomName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const filePath = path.join(dir, randomName);

    await file.mv(filePath);

    // Copy the untouched original for the "download original" feature. A failure
    // here must not break the main upload, so we only warn.
    try {
      fs.copyFileSync(filePath, path.join(originalsDir, randomName));
    } catch (copyErr) {
      console.warn("Original copy failed:", copyErr.message);
    }

    return `/${uploadPaths.root}/${folder}/${randomName}`;
  }

  /**
   * Upload an editor image. Validates against config.upload image types/size.
   * @returns {string} public URL
   */
  static async uploadImage(file, folder = "content") {
    if (!file) throw new Error("No file provided");

    const { allowedImageTypes, maxImageSize } = config.upload;
    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new Error(
        `Invalid file type: ${file.mimetype}. Allowed: ${allowedImageTypes.join(", ")}`,
      );
    }
    if (file.size > maxImageSize) {
      throw new Error(
        `File too large. Max size: ${Math.round(maxImageSize / 1024 / 1024)}MB`,
      );
    }

    return this.saveMediaWithOriginal(file, folder);
  }

  /**
   * Upload an editor video. Validates against config.upload video types/size.
   * @returns {string} public URL
   */
  static async uploadVideo(file, folder = "videos") {
    if (!file) throw new Error("No file provided");

    const { allowedVideoTypes, maxVideoSize } = config.upload;
    if (!allowedVideoTypes.includes(file.mimetype)) {
      throw new Error(
        `Invalid file type: ${file.mimetype}. Allowed: ${allowedVideoTypes.join(", ")}`,
      );
    }
    if (file.size > maxVideoSize) {
      throw new Error(
        `File too large. Max size: ${Math.round(maxVideoSize / 1024 / 1024)}MB`,
      );
    }

    return this.saveMediaWithOriginal(file, folder);
  }

  /**
   * Upload an editor document (PDF/Word/Excel/PowerPoint/text). Preserves the
   * original extension and keeps a sanitized human-readable display name.
   * @param {string|null} customName - optional display name (without extension)
   * @returns {{ url: string, name: string, size: number, mimetype: string }}
   */
  static async uploadDocument(file, folder = "documents", customName = null) {
    if (!file) throw new Error("No file provided");

    const { allowedDocTypes, maxDocSize } = config.upload;
    if (!allowedDocTypes.includes(file.mimetype)) {
      throw new Error(
        `Invalid file type: ${file.mimetype}. Only document files (PDF, Word, Excel, PowerPoint, text) are allowed.`,
      );
    }
    if (file.size > maxDocSize) {
      throw new Error(
        `File too large. Max size: ${Math.round(maxDocSize / 1024 / 1024)}MB`,
      );
    }

    const dir = this.ensureUploadDir(folder);

    // Preserve the original extension; sanitize the rest of the name.
    const origName = path.basename(file.name);
    const ext = path.extname(origName);
    const baseRaw =
      customName && String(customName).trim()
        ? String(customName).trim()
        : path.basename(origName, ext);
    const sanitizedBase =
      baseRaw
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 120) || "document";
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase() || "";

    // Random hex prefix keeps stored filenames unguessable/unique; the trailing
    // human name keeps downloads friendly.
    const displayName = `${sanitizedBase}${sanitizedExt}`;
    const storedName = `${crypto.randomBytes(16).toString("hex")}-${displayName}`;
    const filePath = path.join(dir, storedName);

    await file.mv(filePath);

    return {
      url: `/${uploadPaths.root}/${folder}/${storedName}`,
      name: displayName,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * Delete a single file (ignores missing files)
   */
  static deleteFile(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("File delete error:", error);
    }
  }

  /**
   * Delete multiple files (array of objects with a `path`)
   */
  static deleteFiles(files) {
    files.forEach((file) => this.deleteFile(file.path));
  }
}

export { FileService };
