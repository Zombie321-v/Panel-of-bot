const fetch = require("node-fetch"); // node-fetch install hona chahiye
const FIREBASE_URL = "https://smarttrader-license-default-rtdb.firebaseio.com/licenses.json"; // tumhara Firebase URL

// Generate random license key
function generateLicenseKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i !== 15) key += "-";
  }
  return key;
}

// Calculate stats from licenses object
function calculateStats(licenses) {
  let totalActive = 0,
    totalDeactivated = 0,
    totalExpired = 0,
    totalCreated = Object.keys(licenses).length;
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

// Fetch licenses from Firebase
async function fetchLicenses() {
  const res = await fetch(FIREBASE_URL);
  const data = await res.json();
  return data || {};
}

// Save licenses to Firebase (merge)
async function saveLicenses(licenses) {
  await fetch(FIREBASE_URL, {
    method: "PATCH", // PATCH = add/update without overwriting all
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(licenses)
  });
}

// API Handler
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  let licenses = await fetchLicenses(); // Load existing licenses from Firebase

  if (req.method === "GET") {
    return res.status(200).json({ success: true, licenses, stats: calculateStats(licenses) });
  }

  if (req.method === "POST") {
    const { action, clientName, type, duration } = req.body;
    if (action !== "create")
      return res.status(400).json({ success: false, message: "Invalid action" });

    const licenseKey = generateLicenseKey();
    const now = new Date();
    let expiryDate = new Date(now);
    if (type === "weekly") expiryDate.setDate(now.getDate() + 7 * duration);
    else expiryDate.setMonth(now.getMonth() + duration);

    licenses[licenseKey] = {
      clientName,
      type,
      duration,
      createdAt: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      isActive: true,
      accountNumber: null,
      deactivatedAt: null
    };

    await saveLicenses({ [licenseKey]: licenses[licenseKey] }); // Save new license to Firebase

    return res
      .status(200)
      .json({ success: true, licenseKey, expiryDate, stats: calculateStats(licenses) });
  }

  if (req.method === "PUT") {
    const { action, licenseKey } = req.body;
    if (action !== "deactivate")
      return res.status(400).json({ success: false, message: "Invalid action" });
    if (!licenses[licenseKey])
      return res.status(404).json({ success: false, message: "License not found" });

    licenses[licenseKey].isActive = false;
    licenses[licenseKey].deactivatedAt = new Date().toISOString();

    await saveLicenses({ [licenseKey]: licenses[licenseKey] }); // Update Firebase

    return res.status(200).json({ success: true, stats: calculateStats(licenses) });
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
};
