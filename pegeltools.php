<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

grant_public_pegel_access();
redirect('/tool.php?name=pegelTool');
