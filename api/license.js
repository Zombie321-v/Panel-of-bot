import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "licenses.json");

function readLicenses() {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({}));
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
}

function writeLicenses(licenses) {
    fs.writeFileSync(filePath, JSON.stringify(licenses, null, 2));
}

function generateLicenseKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "";
    for (let i = 0; i < 16; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
        if ((i + 1) % 4 === 0 && i !== 15) key += "-";
    }
    return key;
}

function calculateStats(licenses) {
    let totalActive = 0;
    let totalDeactivated = 0;
    let totalExpired = 0;
    let totalCreated = Object.keys(licenses).length;

    const now = new Date();

    for (const license of Object.values(licenses)) {
        if (!license.isActive) totalDeactivated++;
        else {
            const expiry = new Date(license.expiryDate);
            if (now > expiry) totalExpired++;
            else totalActive++;
        }
    }

    return { totalActive, totalDeactivated, totalExpired, totalCreated };
}

export default function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    let licenses = readLicenses();

    // ===== GET ALL =====
    if (req.method === "GET") {
        return res.status(200).json({ success: true, licenses, stats: calculateStats(licenses) });
    }

    // ===== CREATE =====
    if (req.method === "POST") {
        const { action, clientName, type, duration } = req.body;
        if (action !== "create") return res.status(400).json({ success: false, message: "Invalid action" });
        if (!clientName || !type || !duration) return res.status(400).json({ success: false, message: "Missing fields" });

        const licenseKey = generateLicenseKey();
        const now = new Date();
        let expiryDate = new Date(now);
        if (type === "weekly") expiryDate.setDate(now.getDate() + (7 * duration));
        else expiryDate.setMonth(now.getMonth() + duration);

        licenses[licenseKey] = {
            clientName,
            type,
            duration,
            createdAt: now,
            expiryDate,
            isActive: true,
            accountNumber: null,
            deactivatedAt: null
        };

        writeLicenses(licenses);

        return res.status(200).json({ success: true, licenseKey, expiryDate, stats: calculateStats(licenses) });
    }

    // ===== DEACTIVATE =====
    if (req.method === "PUT") {
        const { action, licenseKey } = req.body;
        if (action !== "deactivate") return res.status(400).json({ success: false, message: "Invalid action" });
        if (!licenses[licenseKey]) return res.status(404).json({ success: false, message: "License not found" });

        licenses[licenseKey].isActive = false;
        licenses[licenseKey].deactivatedAt = new Date();

        writeLicenses(licenses);

        return res.status(200).json({ success: true, stats: calculateStats(licenses) });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
}
