<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_admin();
$id = (int)($_GET['id'] ?? 0);
header('Location: /admin_users.php' . ($id > 0 ? '?expanded=' . $id : ''));
exit;