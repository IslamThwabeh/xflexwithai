#!/usr/bin/env node

/**
 * Admin User Generator for Cloudflare D1
 * Generates SQL INSERT statement with bcrypt hashed password
 * 
 * Usage: npx tsx scripts/create-admin.ts YourPassword123
 */

import bcrypt from "bcryptjs";

async function generateAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🛠️  Admin User Generator

Usage:
  npx tsx scripts/create-admin.ts YourPassword123 [email] [name]

Parameters:
  - password: Admin password (min 8 chars recommended)
  - email: (optional) Admin email, default: admin@xflexacademy.com
  - name: (optional) Admin name, default: Admin
  
Examples:
  npx tsx scripts/create-admin.ts MySecurePass@2024
  npx tsx scripts/create-admin.ts MySecurePass@2024 admin2@xflexacademy.com "Admin Two"

Output:
  SQL INSERT statement with bcrypt hashed password ready for Cloudflare D1
    `);
    process.exit(1);
  }

  const password = args[0];
  const email = args[1] || "admin@xflexacademy.com";
  const name = args[2] || "Admin";

  try {
    console.log("🔐 Generating admin user...\n");
    
    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate SQL INSERT for Cloudflare D1
    const sql = `INSERT INTO admins (email, passwordHash, name, createdAt, updatedAt, lastSignedIn)
VALUES (
  '${email}',
  '${passwordHash}',
  '${name}',
  datetime('now'),
  datetime('now'),
  datetime('now')
);`;

    console.log("✅ Admin user SQL generated:\n");
    console.log("─".repeat(70));
    console.log(sql);
    console.log("─".repeat(70));
    
    console.log("\n📋 Login Credentials:");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    
    console.log("\n📍 Next Steps:");
    console.log("  1. Go to Cloudflare D1 Dashboard");
    console.log("  2. Select your database (cf374361-2caa-4597-a38d-5cecced7827d)");
    console.log("  3. Open SQL Console");
    console.log("  4. Paste the SQL above");
    console.log("  5. Click Execute");
    console.log("  6. Login at: https://xflexacademy.com/admin/login");
    
    console.log("\n⚠️  Security Reminder:");
    console.log("  - Change this password after first login");
    console.log("  - Use a strong password in production");
    console.log("  - Never share your admin credentials\n");

  } catch (error) {
    console.error("❌ Error generating admin:", error);
    process.exit(1);
  }
}

generateAdmin();
