<?php
// Of video — PHP 安装与环境检测（无 Docker 部署）
$root = __DIR__;
$configFile = $root . '/config.php';
$writableDirs = [ $root . '/data', $root . '/data/mockjobs' ];

function ensure_dir($path) {
    if (!is_dir($path)) {
        @mkdir($path, 0777, true);
    }
    return is_dir($path) && is_writable($path);
}

$errors = [];
$messages = [];

// 环境检测
$phpVersionOk = version_compare(PHP_VERSION, '8.0.0', '>=');
$extCurl = function_exists('curl_init');
foreach ($writableDirs as $d) {
    if (!ensure_dir($d)) {
        $errors[] = '目录不可写：' . str_replace($root . '/', '', $d);
    }
}

$config = [
    'ENABLED_VIDEO_PROVIDERS' => 'mock',
    'REPLICATE_API_TOKEN' => '',
];
if (is_file($configFile)) {
    $cfg = include $configFile;
    if (is_array($cfg)) $config = array_merge($config, $cfg);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $providers = isset($_POST['ENABLED_VIDEO_PROVIDERS']) ? trim((string)$_POST['ENABLED_VIDEO_PROVIDERS']) : 'mock';
    $token = isset($_POST['REPLICATE_API_TOKEN']) ? trim((string)$_POST['REPLICATE_API_TOKEN']) : '';
    if ($providers === '') $providers = 'mock';
    $config = [
        'ENABLED_VIDEO_PROVIDERS' => $providers,
        'REPLICATE_API_TOKEN' => $token,
    ];

    $cfgStr = "<?php\nreturn " . var_export($config, true) . ";\n";
    $ok = @file_put_contents($configFile, $cfgStr);
    if ($ok === false) {
        $errors[] = '写入配置文件失败：' . basename($configFile) . '（请检查文件权限）';
    } else {
        $messages[] = '配置已保存到 ' . basename($configFile);
    }
}

header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>安装与环境检测 - Of video</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; margin: 0; padding: 0; background: #0b1020; color: #eaeefb; }
  header { padding: 24px; background: linear-gradient(135deg, #0b1020, #101a3a); border-bottom: 1px solid rgba(255,255,255,0.06); }
  main { padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 16px 0; }
  .ok { color: #46d369; }
  .bad { color: #ff6b6b; }
  .muted { color: #aab3cf; }
  label { display: block; margin: 12px 0 6px; }
  input[type=text], textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(10,13,26,0.6); color: #eaeefb; }
  button { padding: 10px 16px; border: none; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; }
  a.btn { display: inline-block; padding: 10px 16px; border-radius: 8px; background: #374151; color: #fff; text-decoration: none; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>安装与环境检测（PHP，无 Docker）</h1>
  <div class="muted">该向导会检测 PHP 运行环境，并可选写入配置文件 config.php</div>
</header>
<main>
  <div class="card">
    <h2>环境检测</h2>
    <ul>
      <li>PHP 版本：<?php echo $phpVersionOk ? '<span class="ok">' . PHP_VERSION . '（OK）</span>' : '<span class="bad">' . PHP_VERSION . '（需要 >= 8.0）</span>'; ?></li>
      <li>cURL 扩展（用于 Replicate）：<?php echo $extCurl ? '<span class="ok">已启用</span>' : '<span class="bad">未启用</span>'; ?></li>
      <li>数据目录写入：
        <ul>
            <?php foreach ($writableDirs as $d): $ok = is_writable($d); ?>
            <li><?php echo str_replace($root . '/', '', $d); ?>：<?php echo $ok ? '<span class="ok">可写</span>' : '<span class="bad">不可写</span>'; ?></li>
            <?php endforeach; ?>
        </ul>
      </li>
    </ul>
  </div>

  <?php if ($messages): ?>
    <div class="card" style="border-color:#2dd4bf">
      <strong>提示：</strong>
      <ul>
        <?php foreach ($messages as $m): ?><li><?php echo htmlspecialchars($m, ENT_QUOTES, 'UTF-8'); ?></li><?php endforeach; ?>
      </ul>
    </div>
  <?php endif; ?>

  <?php if ($errors): ?>
    <div class="card" style="border-color:#f59e0b">
      <strong>注意：</strong>
      <ul>
        <?php foreach ($errors as $e): ?><li><?php echo htmlspecialchars($e, ENT_QUOTES, 'UTF-8'); ?></li><?php endforeach; ?>
      </ul>
    </div>
  <?php endif; ?>

  <div class="card">
    <h2>配置（可选）</h2>
    <form method="post">
      <label for="ENABLED_VIDEO_PROVIDERS">启用的视频供应商（逗号分隔）</label>
      <input type="text" id="ENABLED_VIDEO_PROVIDERS" name="ENABLED_VIDEO_PROVIDERS" value="<?php echo htmlspecialchars($config['ENABLED_VIDEO_PROVIDERS'] ?? 'mock', ENT_QUOTES, 'UTF-8'); ?>" placeholder="例如：mock,replicate">

      <label for="REPLICATE_API_TOKEN">Replicate API Token（可选）</label>
      <input type="text" id="REPLICATE_API_TOKEN" name="REPLICATE_API_TOKEN" value="<?php echo htmlspecialchars($config['REPLICATE_API_TOKEN'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" placeholder="如果启用 replicate，请填写令牌">

      <div style="margin-top:12px">
        <button type="submit">保存配置</button>
        <a class="btn" href="/">访问首页</a>
        <a class="btn" href="/api/healthz" target="_blank">健康检查</a>
        <a class="btn" href="/api/video/providers" target="_blank">查看供应商</a>
      </div>
      <p class="muted" style="margin-top:8px">保存后将生成 config.php。生产环境建议不要将该文件提交到版本库。</p>
    </form>
  </div>

  <div class="grid">
    <div class="card">
      <h3>运行方式 A：PHP 内置服务器（推荐开发/快速部署）</h3>
      <ol>
        <li>在服务器上安装 PHP 8.0+（需包含 curl 扩展以使用 Replicate）</li>
        <li>在项目目录执行：<code>php -S 0.0.0.0:3000 router.php</code></li>
        <li>访问 <a href="http://localhost:3000/" target="_blank">http://localhost:3000/</a>（/api/* 已自动路由到 router.php）</li>
      </ol>
    </div>
    <div class="card">
      <h3>运行方式 B：Nginx/Apache + PHP（生产）</h3>
      <ol>
        <li>将站点根指向本目录（包含 index.html / index.php）</li>
        <li>Nginx/Apache 将 /api/* 与 /healthz 重写到 router.php</li>
        <li>确保 data/ 目录具有写入权限</li>
      </ol>
    </div>
  </div>
</main>
</body>
</html>
