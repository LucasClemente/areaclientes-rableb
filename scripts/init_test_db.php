<?php
/**
 * Crea/resetea la base de datos local de prueba.
 * Ejecutar desde la raíz del proyecto: php scripts/init_test_db.php
 * La BD y uploads se crean en public/ (no se suben al servidor con el build).
 */

$publicDir = __DIR__ . '/../public';
$uploadDir = $publicDir . '/uploads';
$dbPath    = $publicDir . '/panel.sqlite';

if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
if (file_exists($dbPath)) unlink($dbPath);

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys=ON');

$pdo->exec("
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
");
$pdo->exec("
    CREATE TABLE login_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
");
$pdo->exec("
    CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
");
$pdo->exec("
    CREATE TABLE client_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        user_id   INTEGER NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
        UNIQUE(client_id, user_id)
    )
");
$pdo->exec("
    CREATE TABLE reports (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id     INTEGER NOT NULL,
        title         TEXT    NOT NULL,
        period_date   TEXT    NOT NULL,
        filename      TEXT    NOT NULL,
        original_name TEXT    NOT NULL,
        file_size     INTEGER NOT NULL DEFAULT 0,
        uploaded_by   INTEGER,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
");

// Usuarios
$users = [
    ['info@rableb.com',    'super_admin', 'Super Admin'],
    ['cliente1@test.com',  'user',        'Cliente Uno'],
    ['maria@ejemplo.com',  'user',        'María García'],
];
$us = $pdo->prepare("INSERT INTO users (email, role, name) VALUES (?, ?, ?)");
foreach ($users as $u) $us->execute($u);

// Clientes
$clients = [
    ['Empresa Demo S.A.',  'empresa-demo',   'Cliente de demo'],
    ['Comercio Norte',     'comercio-norte', ''],
];
$cs = $pdo->prepare("INSERT INTO clients (name, slug, notes) VALUES (?, ?, ?)");
foreach ($clients as $c) $cs->execute($c);

// Vincular usuarios a clientes
$cu = $pdo->prepare("INSERT INTO client_users (client_id, user_id) VALUES (?, ?)");
$cu->execute([1, 2]); // Cliente Uno → Empresa Demo
$cu->execute([2, 3]); // María → Comercio Norte

// Crear PDF dummy para pruebas
if (!is_dir($uploadDir . '/1')) mkdir($uploadDir . '/1', 0755, true);
if (!is_dir($uploadDir . '/2')) mkdir($uploadDir . '/2', 0755, true);
file_put_contents($uploadDir . '/1/rep_demo1.pdf', '%PDF-1.4 test file');
file_put_contents($uploadDir . '/1/rep_demo2.pdf', '%PDF-1.4 test file 2');
file_put_contents($uploadDir . '/2/rep_demo3.pdf', '%PDF-1.4 test file 3');

// Informes
$adminId = 1;
$rs = $pdo->prepare("INSERT INTO reports (client_id, title, period_date, filename, original_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
$rs->execute([1, 'Informe SEO',          '2024-01', 'rep_demo1.pdf', 'informe-seo-enero-2024.pdf',    18, $adminId]);
$rs->execute([1, 'Informe Redes Sociales','2024-01', 'rep_demo2.pdf', 'informe-redes-enero-2024.pdf', 18, $adminId]);
$rs->execute([2, 'Informe SEO',          '2024-02', 'rep_demo3.pdf', 'informe-seo-feb-2024.pdf',     18, $adminId]);

echo "✓ Base de datos de prueba creada en: {$dbPath}\n\n";
echo "Usuarios:\n";
foreach ($users as $u) echo "  • {$u[0]} ({$u[1]})\n";
echo "\nClientes:\n";
echo "  • Empresa Demo S.A. → slug: empresa-demo\n";
echo "  • Comercio Norte    → slug: comercio-norte\n";
echo "\nEnlaces públicos:\n";
echo "  http://localhost:8080/#/p/empresa-demo\n";
echo "  http://localhost:8080/#/p/comercio-norte\n";
echo "\nPara probar: npm run build && php -S localhost:8080 -t dist\n";
