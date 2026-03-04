<?php
/**
 * API área de clientes Rableb
 * Base de datos y uploads en la misma carpeta que este archivo (raíz de public).
 * Si no existen, se crean solos la primera vez que se llama a la API.
 */

$uploadDir = __DIR__ . '/uploads';
$dbPath    = __DIR__ . '/panel.sqlite';

if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}
if (!file_exists($dbPath)) {
    @touch($dbPath);
}
if (!file_exists($dbPath)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo crear la base de datos. Comprobá permisos de escritura en la carpeta donde está api.php.']);
    exit;
}

/* ─── headers ──────────────────────────────────────────────── */
$isDownload = (($_GET['action'] ?? $_POST['action'] ?? '') === 'report-download');
if (!$isDownload) {
    header('Content-Type: application/json; charset=utf-8');
}
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/* ─── db ────────────────────────────────────────────────────── */
function getDb(): PDO {
    global $dbPath;
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA foreign_keys=ON');
    return $pdo;
}

function initDb(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL UNIQUE,
            role       TEXT NOT NULL DEFAULT 'user',
            name       TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS login_codes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL,
            code       TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_lc_email   ON login_codes(email)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_lc_expires ON login_codes(expires_at)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clients (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            slug       TEXT NOT NULL UNIQUE,
            notes      TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_users (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            user_id   INTEGER NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
            UNIQUE(client_id, user_id)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS reports (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id     INTEGER NOT NULL,
            title         TEXT    NOT NULL,
            period_date   TEXT    NOT NULL,
            filename      TEXT    NOT NULL,
            original_name TEXT    NOT NULL,
            file_size     INTEGER NOT NULL DEFAULT 0,
            uploaded_by   INTEGER,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (client_id)   REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE SET NULL
        )
    ");

    // Super admin inicial
    $exists = $pdo->query("SELECT COUNT(*) FROM users WHERE email='info@rableb.com'")->fetchColumn();
    if ($exists == 0) {
        $pdo->prepare("INSERT INTO users (email, role, name) VALUES ('info@rableb.com','super_admin','Super Admin')")->execute();
    }
}

/* ─── helpers ───────────────────────────────────────────────── */
function isLocalhost(): bool {
    $h = $_SERVER['HTTP_HOST'] ?? '';
    return in_array($h, ['localhost','127.0.0.1','localhost:5173','127.0.0.1:5173','localhost:8080','127.0.0.1:8080'], true);
}

function req(): array {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($ct, 'multipart/form-data') || str_contains($ct, 'application/x-www-form-urlencoded')) {
        return array_merge($_GET, $_POST);
    }
    $raw = file_get_contents('php://input');
    $dec = json_decode((string)$raw, true);
    return is_array($dec) ? array_merge($_GET, $dec) : $_GET;
}

function ok(array $data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode(array_merge(['ok' => true], $data));
}

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
}

function getToken(): string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($h, 'Bearer ')) return substr($h, 7);
    return $_GET['token'] ?? $_POST['token'] ?? '';
}

function userByToken(PDO $pdo, string $token): ?array {
    if ($token === '') return null;
    $s = $pdo->prepare("
        SELECT u.id, u.email, u.role, u.name
        FROM login_codes lc
        JOIN users u ON u.email = lc.email
        WHERE lc.code = ? AND lc.expires_at > datetime('now')
        LIMIT 1
    ");
    $s->execute([$token]);
    return $s->fetch(PDO::FETCH_ASSOC) ?: null;
}

function auth(PDO $pdo): array {
    $u = userByToken($pdo, getToken());
    if (!$u) { fail('No autorizado', 401); exit; }
    return $u;
}

function superAdmin(PDO $pdo): array {
    $u = auth($pdo);
    if ($u['role'] !== 'super_admin') { fail('Sin permiso', 403); exit; }
    return $u;
}

function makeSlug(string $name, PDO $pdo): string {
    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
    $slug = trim($slug, '-') ?: 'cliente';
    $base = $slug; $i = 1;
    while ($pdo->prepare("SELECT id FROM clients WHERE slug=?")->execute([$slug]) && $pdo->prepare("SELECT id FROM clients WHERE slug=?")->execute([$slug]) ? $pdo->query("SELECT id FROM clients WHERE slug='$slug'")->fetch() : false) {
        $slug = $base . '-' . $i++;
    }
    // Cleaner loop
    $slug = $base;
    for ($i = 1; ; $i++) {
        $st = $pdo->prepare("SELECT id FROM clients WHERE slug=?");
        $st->execute([$slug]);
        if (!$st->fetch()) break;
        $slug = $base . '-' . $i;
    }
    return $slug;
}

function compressPdf(string $input, string $output): bool {
    $gs = trim((string)shell_exec('which gs 2>/dev/null || which ghostscript 2>/dev/null'));
    if ($gs === '') return false;
    $cmd = escapeshellarg($gs)
        . ' -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook'
        . ' -dNOPAUSE -dQUIET -dBATCH'
        . ' -sOutputFile=' . escapeshellarg($output)
        . ' ' . escapeshellarg($input) . ' 2>/dev/null';
    exec($cmd, $out, $code);
    if ($code !== 0 || !file_exists($output) || filesize($output) < 512) return false;
    return filesize($output) < filesize($input);
}

function formatBytes(int $bytes): string {
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1048576) return round($bytes/1024, 1) . ' KB';
    return round($bytes/1048576, 1) . ' MB';
}

/* ─── router ────────────────────────────────────────────────── */
try {
    $pdo = getDb();
    initDb($pdo);
    $r   = req();
    $act = $r['action'] ?? '';

    switch ($act) {

        /* ═══════════════ AUTH ═══════════════ */

        case 'login-request': {
            $email = strtolower(trim((string)($r['email'] ?? '')));
            if (!$email) { fail('Email requerido'); exit; }

            $st = $pdo->prepare("SELECT id,email,role,name FROM users WHERE email=?");
            $st->execute([$email]);
            $user = $st->fetch(PDO::FETCH_ASSOC);

            if (isLocalhost()) {
                if (!$user) {
                    $pdo->prepare("INSERT INTO users (email,role,name) VALUES (?,'user',?)")->execute([$email, explode('@',$email)[0]]);
                    $st->execute([$email]);
                    $user = $st->fetch(PDO::FETCH_ASSOC);
                }
                $token = bin2hex(random_bytes(24));
                $exp   = date('Y-m-d H:i:s', strtotime('+7 days'));
                $pdo->prepare("INSERT INTO login_codes (email,code,expires_at) VALUES (?,?,?)")->execute([$email,$token,$exp]);
                ok(['bypass'=>true,'token'=>$token,'user'=>$user]);
                exit;
            }

            if (!$user) { fail('Usuario no registrado', 404); exit; }

            $code = str_pad((string)random_int(0,999999), 6, '0', STR_PAD_LEFT);
            $exp  = date('Y-m-d H:i:s', strtotime('+10 minutes'));
            $pdo->prepare("INSERT INTO login_codes (email,code,expires_at) VALUES (?,?,?)")->execute([$email,$code,$exp]);

            $subject = 'Tu código de acceso — Área de clientes Rableb';
            $body    = "Hola {$user['name']},\n\nTu código es: {$code}\n\nVálido 10 minutos. Si no lo pediste, ignora este mensaje.";
            @mail($email, $subject, $body, "From: noreply@rableb.com\r\nReply-To: info@rableb.com\r\nContent-Type: text/plain; charset=UTF-8");

            ok(['message'=>'Código enviado']);
            exit;
        }

        case 'login-verify': {
            $email = strtolower(trim((string)($r['email'] ?? '')));
            $code  = trim((string)($r['code'] ?? ''));
            if (!$email || !$code) { fail('Email y código requeridos'); exit; }

            $st = $pdo->prepare("SELECT id FROM login_codes WHERE email=? AND code=? AND expires_at>datetime('now') ORDER BY created_at DESC LIMIT 1");
            $st->execute([$email,$code]);
            if (!$st->fetch()) { fail('Código inválido o expirado'); exit; }

            $pdo->prepare("DELETE FROM login_codes WHERE email=?")->execute([$email]);

            $st = $pdo->prepare("SELECT id,email,role,name FROM users WHERE email=?");
            $st->execute([$email]);
            $user = $st->fetch(PDO::FETCH_ASSOC);

            $token = bin2hex(random_bytes(24));
            $exp   = date('Y-m-d H:i:s', strtotime('+7 days'));
            $pdo->prepare("INSERT INTO login_codes (email,code,expires_at) VALUES (?,?,?)")->execute([$email,$token,$exp]);

            ok(['token'=>$token,'user'=>$user]);
            exit;
        }

        case 'me': {
            $u = userByToken($pdo, getToken());
            if (!$u) { fail('Sesión inválida', 401); exit; }
            ok(['user'=>$u]);
            exit;
        }

        /* ═══════════════ USERS ═══════════════ */

        case 'users-list': {
            superAdmin($pdo);
            $users = $pdo->query("SELECT id,email,role,name,created_at FROM users ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
            ok(['users'=>$users]);
            exit;
        }

        case 'users-create': {
            superAdmin($pdo);
            $email = strtolower(trim((string)($r['email'] ?? '')));
            $name  = trim((string)($r['name'] ?? ''));
            $role  = in_array($r['role']??'',['super_admin','user']) ? $r['role'] : 'user';
            if (!$email) { fail('Email requerido'); exit; }
            if (!$name) $name = explode('@',$email)[0];
            try {
                $pdo->prepare("INSERT INTO users (email,role,name) VALUES (?,?,?)")->execute([$email,$role,$name]);
                $id = $pdo->lastInsertId();
                ok(['user'=>['id'=>$id,'email'=>$email,'role'=>$role,'name'=>$name]]);
            } catch (\PDOException $e) {
                fail('El email ya existe', 409);
            }
            exit;
        }

        case 'users-update': {
            superAdmin($pdo);
            $id   = (int)($r['id']??0);
            $name = trim((string)($r['name']??''));
            $role = in_array($r['role']??'',['super_admin','user']) ? $r['role'] : null;
            $email = strtolower(trim((string)($r['email']??'')));
            if ($id <= 0) { fail('ID requerido'); exit; }
            $st = $pdo->prepare("SELECT email FROM users WHERE id=?");
            $st->execute([$id]);
            $u = $st->fetch(PDO::FETCH_ASSOC);
            if (!$u) { fail('Usuario no encontrado', 404); exit; }
            if ($u['email'] === 'info@rableb.com' && $role === 'user') { fail('No se puede quitar rol super admin al principal', 403); exit; }
            $updates = [];
            $params = [];
            if ($name !== '') { $updates[] = 'name=?'; $params[] = $name; }
            if ($role !== null) { $updates[] = 'role=?'; $params[] = $role; }
            if ($email !== '' && $email !== $u['email']) {
                $chk = $pdo->prepare("SELECT id FROM users WHERE email=? AND id!=?");
                $chk->execute([$email,$id]);
                if ($chk->fetch()) { fail('El email ya existe', 409); exit; }
                $updates[] = 'email=?'; $params[] = $email;
            }
            if (count($updates) === 0) { ok(); exit; }
            $params[] = $id;
            $pdo->prepare("UPDATE users SET ".implode(',',$updates)." WHERE id=?")->execute($params);
            ok();
            exit;
        }

        case 'users-delete': {
            superAdmin($pdo);
            $id = (int)($r['id']??0);
            if ($id <= 0) { fail('ID requerido'); exit; }
            $st = $pdo->prepare("SELECT email FROM users WHERE id=?");
            $st->execute([$id]);
            $u = $st->fetch(PDO::FETCH_ASSOC);
            if ($u && $u['email'] === 'info@rableb.com') { fail('No se puede eliminar al super admin principal', 403); exit; }
            $pdo->prepare("DELETE FROM users WHERE id=?")->execute([$id]);
            ok();
            exit;
        }

        /* ═══════════════ CLIENTS ═══════════════ */

        case 'clients-list': {
            $u = auth($pdo);
            if ($u['role'] === 'super_admin') {
                $clients = $pdo->query("SELECT * FROM clients ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $st = $pdo->prepare("
                    SELECT c.* FROM clients c
                    JOIN client_users cu ON cu.client_id=c.id
                    WHERE cu.user_id=?
                    ORDER BY c.name ASC
                ");
                $st->execute([$u['id']]);
                $clients = $st->fetchAll(PDO::FETCH_ASSOC);
            }
            ok(['clients'=>$clients]);
            exit;
        }

        case 'clients-create': {
            superAdmin($pdo);
            $name      = trim((string)($r['name']??''));
            $notes     = trim((string)($r['notes']??''));
            $userEmail = strtolower(trim((string)($r['user_email']??'')));
            if (!$name) { fail('Nombre requerido'); exit; }
            $slug = makeSlug($name, $pdo);
            $pdo->prepare("INSERT INTO clients (name,slug,notes) VALUES (?,?,?)")->execute([$name,$slug,$notes?:null]);
            $id = (int)$pdo->lastInsertId();
            if ($userEmail !== '') {
                $st = $pdo->prepare("SELECT id FROM users WHERE email=?");
                $st->execute([$userEmail]);
                $uid = $st->fetchColumn();
                if (!$uid) {
                    $pdo->prepare("INSERT INTO users (email,role,name) VALUES (?,'user',?)")->execute([$userEmail, explode('@',$userEmail)[0]]);
                    $uid = $pdo->lastInsertId();
                }
                try { $pdo->prepare("INSERT INTO client_users (client_id,user_id) VALUES (?,?)")->execute([$id,$uid]); } catch (\PDOException $e) {}
            }
            ok(['client'=>['id'=>$id,'name'=>$name,'slug'=>$slug,'notes'=>$notes]]);
            exit;
        }

        case 'clients-update': {
            superAdmin($pdo);
            $id    = (int)($r['id']??0);
            $name  = trim((string)($r['name']??''));
            $notes = trim((string)($r['notes']??''));
            if ($id<=0 || !$name) { fail('Datos inválidos'); exit; }
            $pdo->prepare("UPDATE clients SET name=?,notes=? WHERE id=?")->execute([$name,$notes?:null,$id]);
            ok();
            exit;
        }

        case 'clients-delete': {
            superAdmin($pdo);
            $id = (int)($r['id']??0);
            if ($id<=0) { fail('ID requerido'); exit; }
            $dir = $uploadDir . '/' . $id;
            if (is_dir($dir)) { foreach(glob($dir.'/*')as$f) @unlink($f); @rmdir($dir); }
            $pdo->prepare("DELETE FROM clients WHERE id=?")->execute([$id]);
            ok();
            exit;
        }

        case 'clients-get': {
            $slug = trim((string)($r['slug']??''));
            if (!$slug) { fail('Slug requerido'); exit; }
            $st = $pdo->prepare("SELECT id,name,slug,notes FROM clients WHERE slug=?");
            $st->execute([$slug]);
            $client = $st->fetch(PDO::FETCH_ASSOC);
            if (!$client) { fail('Cliente no encontrado', 404); exit; }
            ok(['client'=>$client]);
            exit;
        }

        /* ═══════════════ CLIENT ↔ USERS ═══════════════ */

        case 'client-users-list': {
            superAdmin($pdo);
            $cid = (int)($r['client_id']??0);
            if ($cid<=0) { fail('client_id requerido'); exit; }
            $st = $pdo->prepare("
                SELECT u.id,u.email,u.name,u.role
                FROM users u JOIN client_users cu ON cu.user_id=u.id
                WHERE cu.client_id=? ORDER BY u.email ASC
            ");
            $st->execute([$cid]);
            ok(['users'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        case 'client-users-add': {
            superAdmin($pdo);
            $cid = (int)($r['client_id']??0);
            $uid = (int)($r['user_id']??0);
            if ($cid<=0||$uid<=0) { fail('Datos inválidos'); exit; }
            try {
                $pdo->prepare("INSERT INTO client_users (client_id,user_id) VALUES (?,?)")->execute([$cid,$uid]);
            } catch(\PDOException $e) { /* already linked */ }
            ok();
            exit;
        }

        case 'client-users-remove': {
            superAdmin($pdo);
            $cid = (int)($r['client_id']??0);
            $uid = (int)($r['user_id']??0);
            if ($cid<=0||$uid<=0) { fail('Datos inválidos'); exit; }
            $pdo->prepare("DELETE FROM client_users WHERE client_id=? AND user_id=?")->execute([$cid,$uid]);
            ok();
            exit;
        }

        case 'user-clients-list': {
            superAdmin($pdo);
            $uid = (int)($r['user_id']??0);
            if ($uid<=0) { fail('user_id requerido'); exit; }
            $st = $pdo->prepare("
                SELECT c.id, c.name, c.slug
                FROM clients c
                JOIN client_users cu ON cu.client_id=c.id
                WHERE cu.user_id=?
                ORDER BY c.name ASC
            ");
            $st->execute([$uid]);
            ok(['clients'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        /* ═══════════════ REPORTS ═══════════════ */

        case 'reports-list': {
            $slug     = trim((string)($r['slug']??''));
            $clientId = (int)($r['client_id']??0);

            if ($slug !== '') {
                // Acceso público
                $st = $pdo->prepare("SELECT id FROM clients WHERE slug=?");
                $st->execute([$slug]);
                $row = $st->fetch(PDO::FETCH_ASSOC);
                if (!$row) { fail('Cliente no encontrado', 404); exit; }
                $clientId = (int)$row['id'];
            } else {
                $u = auth($pdo);
                if ($clientId<=0) { fail('client_id requerido'); exit; }
                if ($u['role'] !== 'super_admin') {
                    $st = $pdo->prepare("SELECT id FROM client_users WHERE client_id=? AND user_id=?");
                    $st->execute([$clientId,$u['id']]);
                    if (!$st->fetch()) { fail('Sin acceso', 403); exit; }
                }
            }

            $st = $pdo->prepare("
                SELECT r.id, r.title, r.period_date, r.original_name, r.file_size, r.created_at,
                       u.name AS uploaded_by_name
                FROM reports r
                LEFT JOIN users u ON u.id = r.uploaded_by
                WHERE r.client_id=?
                ORDER BY r.period_date DESC, r.created_at DESC
            ");
            $st->execute([$clientId]);
            ok(['reports'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        case 'report-upload': {
            $user     = superAdmin($pdo);
            $clientId = (int)($r['client_id']??0);
            $title    = trim((string)($r['title']??''));
            $period   = trim((string)($r['period_date']??''));

            if ($clientId<=0)  { fail('client_id requerido'); exit; }
            if (!$title)       { fail('Título requerido'); exit; }
            if (!$period)      { fail('Período requerido'); exit; }
            if (empty($_FILES['file'])) { fail('Archivo requerido'); exit; }

            $file = $_FILES['file'];
            if ($file['error'] !== UPLOAD_ERR_OK) { fail('Error al subir archivo'); exit; }

            $mime = mime_content_type($file['tmp_name']);
            if (!in_array($mime, ['application/pdf','application/x-pdf'])) {
                fail('Solo se permiten archivos PDF');
                exit;
            }

            $clientDir = $uploadDir . '/' . $clientId;
            if (!is_dir($clientDir)) mkdir($clientDir, 0755, true);

            $filename = uniqid('rep_', true) . '.pdf';
            $dest     = $clientDir . '/' . $filename;
            $tmpComp  = $clientDir . '/tmp_' . $filename;

            if (compressPdf($file['tmp_name'], $tmpComp)) {
                move_uploaded_file($file['tmp_name'], $dest);
                rename($tmpComp, $dest);
            } else {
                @unlink($tmpComp);
                move_uploaded_file($file['tmp_name'], $dest);
            }

            $size = filesize($dest);
            $pdo->prepare("
                INSERT INTO reports (client_id,title,period_date,filename,original_name,file_size,uploaded_by)
                VALUES (?,?,?,?,?,?,?)
            ")->execute([$clientId,$title,$period,$filename,$file['name'],$size,$user['id']]);

            $id = $pdo->lastInsertId();
            ok(['report'=>['id'=>$id,'title'=>$title,'period_date'=>$period,'file_size'=>$size,'original_name'=>$file['name']]]);
            exit;
        }

        case 'report-delete': {
            superAdmin($pdo);
            $id = (int)($r['id']??0);
            if ($id<=0) { fail('ID requerido'); exit; }
            $st = $pdo->prepare("SELECT client_id,filename FROM reports WHERE id=?");
            $st->execute([$id]);
            $rep = $st->fetch(PDO::FETCH_ASSOC);
            if ($rep) {
                @unlink($uploadDir . '/' . $rep['client_id'] . '/' . $rep['filename']);
                $pdo->prepare("DELETE FROM reports WHERE id=?")->execute([$id]);
            }
            ok();
            exit;
        }

        case 'report-download': {
            // Este endpoint envía el archivo directamente (no JSON)
            $id   = (int)($r['id']??0);
            $slug = trim((string)($r['slug']??''));
            $tok  = getToken();

            if ($id<=0) { http_response_code(400); header('Content-Type: text/plain'); echo 'ID inválido'; exit; }

            $st = $pdo->prepare("SELECT r.*, c.slug AS client_slug FROM reports r JOIN clients c ON c.id=r.client_id WHERE r.id=?");
            $st->execute([$id]);
            $rep = $st->fetch(PDO::FETCH_ASSOC);
            if (!$rep) { http_response_code(404); header('Content-Type: text/plain'); echo 'Informe no encontrado'; exit; }

            $ok = false;
            if ($slug !== '' && $slug === $rep['client_slug']) {
                $ok = true;
            } else {
                $u = userByToken($pdo, $tok);
                if ($u) {
                    if ($u['role'] === 'super_admin') {
                        $ok = true;
                    } else {
                        $cu = $pdo->prepare("SELECT id FROM client_users WHERE client_id=? AND user_id=?");
                        $cu->execute([$rep['client_id'],$u['id']]);
                        $ok = (bool)$cu->fetch();
                    }
                }
            }

            if (!$ok) { http_response_code(403); header('Content-Type: text/plain'); echo 'Sin acceso'; exit; }

            $path = $uploadDir . '/' . $rep['client_id'] . '/' . $rep['filename'];
            if (!file_exists($path)) { http_response_code(404); header('Content-Type: text/plain'); echo 'Archivo no encontrado en el servidor'; exit; }

            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . rawurlencode($rep['original_name']) . '"');
            header('Content-Length: ' . filesize($path));
            header('Cache-Control: private, max-age=0');
            header('X-Content-Type-Options: nosniff');
            readfile($path);
            exit;
        }

        default:
            fail('Acción no válida');
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'Error del servidor','detail'=>$e->getMessage()]);
}
